/**
 * @file `save_doc` and revisions (docs/16 §10), on a temp docs folder: base version, traversal, restore, the secret filter, the warning on a similar doc, and a folder that lives on a paired device.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { BridgeHub } from '@/modules/devices';
import { DocsIndexerService } from '@/modules/docs';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const SECRET = `ghp_${'s'.repeat(40)}`;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

describe('save_doc', () => {
  let app: INestApplication;
  let port: number;
  let browser: Browser;
  let userId: string;
  let slug: string;
  let workspaceId: string;
  let root: string;
  let scratch: string;
  const sockets: WebSocket[] = [];

  const prisma = () => maintenanceClients().prisma;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
  });

  async function aSource(name: string, config: object): Promise<string> {
    const source = await prisma().source.create({
      data: { workspaceId, kind: 'local_path', name, config },
    });
    return source.id;
  }

  async function index(sourceId: string, name: string, path: string): Promise<void> {
    await app.get(DocsIndexerService, { strict: false }).index({
      id: sourceId,
      name,
      workspaceId,
      config: { path, purpose: 'docs' },
    });
  }

  beforeEach(async () => {
    const account = await anAccount(prisma());
    userId = account.id;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), project.id, userId, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
    scratch = mkdtempSync(join(tmpdir(), 'hub-e2e-save-'));
    root = join(scratch, 'docs');
    mkdirSync(root);
    writeFileSync(join(root, 'guide.md'), '---\nowner: me\n---\n# Guide\n\nThe first text about refunds.\n');
    const sourceId = await aSource('docs', { path: root, purpose: 'docs' });
    await index(sourceId, 'docs', root);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.terminate();
    rmSync(scratch, { recursive: true, force: true });
  });

  const save = (body: object) => browser.post(`/workspaces/${slug}/docs/save`, body);
  const guideKey = async () => {
    const card = await prisma().card.findFirstOrThrow({ where: { workspaceId, type: 'doc' } });
    return card.key;
  };
  const read = async (key: string) =>
    (await browser.get(`/workspaces/${slug}/docs/${key}`).expect(200)).body.data as {
      content: string;
      fileHash: string;
    };

  it('writes the file on the version it read, keeps the earlier text, and re-indexes at once', async () => {
    const key = await guideKey();
    const before = readFileSync(join(root, 'guide.md'), 'utf8');
    const doc = await read(key);
    expect(doc.fileHash).toBe(sha(before));
    const saved = await save({
      key,
      content: '# Guide\n\nA second text on payments.\n',
      baseHash: doc.fileHash,
      reason: 'better',
    }).expect(200);
    expect(saved.body.data).toMatchObject({ key, source: 'docs', path: 'guide.md', unchanged: false });
    const file = readFileSync(join(root, 'guide.md'), 'utf8');
    expect(file).toContain('A second text');
    // Front matter was not in what the writer saw, so it is not lost.
    expect(file.startsWith('---\nowner: me\n---\n')).toBe(true);
    expect(saved.body.data.hash).toBe(sha(file));

    const revisions = await browser.get(`/workspaces/${slug}/docs/${key}/revisions`).expect(200);
    expect(revisions.body.data).toHaveLength(1);
    expect(revisions.body.data[0]).toMatchObject({ contentHash: sha(before), reason: 'better' });
    const revision = await browser
      .get(`/workspaces/${slug}/docs/${key}/revisions/${revisions.body.data[0].id}`)
      .expect(200);
    expect(revision.body.data.content).toBe(before);

    const search = await browser.get(`/workspaces/${slug}/search?q=payments`).expect(200);
    expect(JSON.stringify(search.body)).toContain(key);
    const row = await prisma().auditLog.findFirst({ where: { action: 'docs.save' } });
    expect(row?.summary).toContain('guide.md');
  });

  it('refuses a stale base and a missing one, and leaves the file alone', async () => {
    const key = await guideKey();
    const before = readFileSync(join(root, 'guide.md'), 'utf8');
    const stale = await save({ key, content: 'x', baseHash: sha('an older text') }).expect(409);
    expect(stale.body.error.code).toBe('hub.docs.stale_base');
    expect(stale.body.error.details.currentHash).toBe(sha(before));
    const missing = await save({ key, content: 'x' }).expect(422);
    expect(missing.body.error.code).toBe('hub.docs.base_required');
    expect(readFileSync(join(root, 'guide.md'), 'utf8')).toBe(before);
    expect(await prisma().docRevision.count()).toBe(0);
  });

  it('two saves on one version: exactly one wins', async () => {
    const key = await guideKey();
    const { fileHash } = await read(key);
    const answers = await Promise.all([
      save({ key, content: '# Guide\n\nFirst writer.\n', baseHash: fileHash }),
      save({ key, content: '# Guide\n\nSecond writer.\n', baseHash: fileHash }),
    ]);
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
    expect(await prisma().docRevision.count()).toBe(1);
  });

  it('saving the same text changes nothing, and adds no revision', async () => {
    const key = await guideKey();
    const { content, fileHash } = await read(key);
    const answer = await save({ key, content, baseHash: fileHash }).expect(200);
    expect(answer.body.data).toMatchObject({ unchanged: true, revisionId: null });
    expect(await prisma().docRevision.count()).toBe(0);
  });

  it('blocks every path that leaves the source, and anything not Markdown', async () => {
    writeFileSync(join(scratch, 'outside.md'), 'keep');
    for (const path of [
      '../outside.md',
      'a/../../outside.md',
      '..\\outside.md',
      join(scratch, 'outside.md'),
      'C:/Windows/x.md',
      '/etc/x.md',
      '.git/x.md',
      'run.exe',
      'a\0.md',
    ]) {
      const answer = await save({ source: 'docs', path, content: 'x' });
      expect([path, answer.status, answer.body.error?.code]).toEqual([path, 422, 'hub.docs.bad_path']);
    }
    expect(readFileSync(join(scratch, 'outside.md'), 'utf8')).toBe('keep');
  });

  it('a link inside the source cannot lead out of it', async () => {
    const outside = join(scratch, 'elsewhere');
    mkdirSync(outside);
    symlinkSync(outside, join(root, 'out'), 'junction');
    const answer = await save({ source: 'docs', path: 'out/new.md', content: '# New\n' }).expect(422);
    expect(answer.body.error.code).toBe('hub.docs.bad_path');
    expect(existsSync(join(outside, 'new.md'))).toBe(false);
  });

  it('refuses a source that is not a local docs folder, or does not exist', async () => {
    await aSource('lab', { path: root, purpose: 'lab' });
    const lab = await save({ source: 'lab', path: 'a.md', content: 'x' }).expect(422);
    expect(lab.body.error.code).toBe('hub.docs.source_not_writable');
    const none = await save({ source: 'nope', path: 'a.md', content: 'x' }).expect(422);
    expect(none.body.error.code).toBe('hub.docs.source_not_writable');
  });

  it('refuses a secret, and will not store a revision of a file that holds one', async () => {
    const key = await guideKey();
    const { fileHash } = await read(key);
    const refused = await save({ key, content: `token ${SECRET}`, baseHash: fileHash }).expect(422);
    expect(refused.body.error.code).toBe('hub.security.secret_detected');
    expect(readFileSync(join(root, 'guide.md'), 'utf8')).not.toContain(SECRET);

    const dirty = `# Guide\n\n${SECRET}\n`;
    writeFileSync(join(root, 'guide.md'), dirty);
    const over = await save({ key, content: '# Guide\n\nclean\n', baseHash: sha(dirty) }).expect(422);
    expect(over.body.error.code).toBe('hub.security.secret_detected');
    expect(JSON.stringify(await prisma().docRevision.findMany())).not.toContain(SECRET);
    expect(readFileSync(join(root, 'guide.md'), 'utf8')).toBe(dirty);
  });

  it('a new file needs no base, is indexed as a card, and warns about a similar document', async () => {
    const answer = await save({
      source: 'docs',
      path: 'more/guide-two.md',
      content: '# Guide\n\nAnother text about refunds.\n',
    }).expect(200);
    expect(answer.body.data.revisionId).toBeNull();
    expect(answer.body.data.key).toMatch(/-\d+$/);
    expect(existsSync(join(root, 'more', 'guide-two.md'))).toBe(true);
    expect(answer.body.data.similar[0]).toMatchObject({ path: 'guide.md' });
    // A file that appeared meanwhile is not a new file any more.
    const again = await save({ source: 'docs', path: 'more/guide-two.md', content: '# X\n' }).expect(422);
    expect(again.body.error.code).toBe('hub.docs.base_required');
  });

  it('restores a revision, keeps what was there, and can be undone', async () => {
    const key = await guideKey();
    const original = readFileSync(join(root, 'guide.md'), 'utf8');
    const { fileHash } = await read(key);
    await save({ key, content: '# Guide\n\nChanged.\n', baseHash: fileHash }).expect(200);
    const changed = readFileSync(join(root, 'guide.md'), 'utf8');
    const list = await browser.get(`/workspaces/${slug}/docs/${key}/revisions`).expect(200);
    const id = list.body.data[0].id as string;

    const restored = await browser
      .post(`/workspaces/${slug}/docs/${key}/revisions/${id}/restore`, {})
      .expect(200);
    expect(readFileSync(join(root, 'guide.md'), 'utf8')).toBe(original);
    expect(restored.body.data.revisionId).not.toBeNull();
    const after = await browser.get(`/workspaces/${slug}/docs/${key}/revisions`).expect(200);
    expect(after.body.data).toHaveLength(2);
    expect(after.body.data[0].contentHash).toBe(sha(changed));

    const stale = await browser
      .post(`/workspaces/${slug}/docs/${key}/revisions/${id}/restore`, { baseHash: sha('old') })
      .expect(409);
    expect(stale.body.error.code).toBe('hub.docs.stale_base');
    await browser
      .post(`/workspaces/${slug}/docs/${key}/revisions/00000000-0000-7000-8000-000000000000/restore`, {})
      .expect(404);
  });

  it('a role that only reads cannot save', async () => {
    const reader = await anAccount(prisma());
    await joinProject(prisma(), workspaceId, reader.id, ['accountant']);
    const other = new Browser(app);
    await other.post('/auth/sign-in', { email: reader.email, password: PASSWORD }).expect(200);
    await other
      .post(`/workspaces/${slug}/docs/save`, { source: 'docs', path: 'a.md', content: 'x' })
      .expect(403);
  });

  describe('over MCP', () => {
    it('get_doc shows the version, save_doc uses it, and the revision tools work', async () => {
      const { token } = await aToken(prisma(), userId, 'mcp');
      const client = new Client({ name: 'test', version: '0' });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}`, 'X-Hub-Project': slug } },
        }),
      );
      const textOf = (answer: unknown) =>
        (answer as { content: { text: string }[] }).content.map((part) => part.text).join('\n');
      const key = await guideKey();
      const read = textOf(await client.callTool({ name: 'get_doc', arguments: { key } }));
      const version = /Version: (\w+)/.exec(read)?.[1];
      expect(version).toBe(sha(readFileSync(join(root, 'guide.md'), 'utf8')));
      const saved = textOf(
        await client.callTool({
          name: 'save_doc',
          arguments: { key, content: '# Guide\n\nThrough MCP.\n', baseHash: version },
        }),
      );
      expect(saved).toContain('not committed');
      const stale = (await client.callTool({
        name: 'save_doc',
        arguments: { key, content: '# Guide\n\nAgain.\n', baseHash: version },
      })) as { isError?: boolean };
      expect(stale.isError).toBe(true);
      const list = textOf(await client.callTool({ name: 'list_doc_revisions', arguments: { key } }));
      const id = /`([0-9a-f-]{36})`/.exec(list)?.[1];
      await client.callTool({ name: 'restore_doc_revision', arguments: { key, revision: id } });
      expect(readFileSync(join(root, 'guide.md'), 'utf8')).toContain('The first text');
      await client.close();
    });
  });

  describe('a folder on a paired device', () => {
    it('reads and writes through the bridge, with the root on its list, and an offline device is a clear error', async () => {
      const started = await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/api/v1/pairing/start')
        .send({ name: 'Holder', platform: 'win32' })
        .expect(201);
      const { deviceCode, userCode } = started.body.data as Record<string, string>;
      await browser.post(`/pairing/${userCode}/approve`).expect(204);
      const polled = await request(app.getHttpServer() as Parameters<typeof request>[0])
        .post('/api/v1/pairing/poll')
        .send({ deviceCode })
        .expect(200);
      const { deviceId, credential } = polled.body.data as { deviceId: string; credential: string };
      await aSource('remote', { path: 'D:/remote/docs', purpose: 'docs', deviceId });

      const offline = await save({ source: 'remote', path: 'a.md', content: '# A\n' }).expect(409);
      expect(offline.body.error.code).toBe('hub.docs.unavailable');

      const frames: {
        type: string;
        id: string;
        action: string;
        args: Record<string, unknown>;
        docRoots?: string[];
      }[] = [];
      const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
        headers: { authorization: `Bearer ${credential}` },
      });
      socket.on('message', (data) => {
        const frame = JSON.parse((data as Buffer).toString()) as (typeof frames)[number];
        frames.push(frame);
        if (frame.type !== 'action') return;
        const answer =
          frame.action === 'doc.read'
            ? { exists: false, text: null, hash: null }
            : { outcome: 'written', hash: sha('# A\n') };
        socket.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, data: answer }));
      });
      await new Promise((done) => socket.once('open', done));
      socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
      const hub = app.get(BridgeHub, { strict: false });
      for (let tries = 0; tries < 200 && !hub.isOnline(deviceId); tries += 1) {
        await new Promise((done) => setTimeout(done, 20));
      }
      expect(frames.find((frame) => frame.type === 'welcome')?.docRoots).toEqual(['D:/remote/docs']);

      sockets.push(socket);
      const saved = await save({ source: 'remote', path: 'a.md', content: '# A\n' }).expect(200);
      expect(saved.body.data).toMatchObject({ source: 'remote', path: 'a.md', hash: sha('# A\n') });
      const write = frames.find((frame) => frame.action === 'doc.write');
      expect(write?.args).toMatchObject({
        root: 'D:/remote/docs',
        path: 'a.md',
        text: '# A\n',
        baseHash: null,
      });
    });
  });
});
