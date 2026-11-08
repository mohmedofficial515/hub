/**
 * @file The Skills page (docs/16 §11, D64 to D66) over real credentials: Hub's skills listed, created and saved with each earlier text kept, Hub's protocols read only,
 * the owner's personal skills read only with Move to Hub, and the plugin sync reaching a scripted device, which then counts as synced for each skill it took.
 * @description Every path is a temp folder: a copy of the team pack and a scratch personal folder. Nothing writes to the repository or to `~/.claude`. The device speaks the
 * bridge's frames and answers `plugin.sync` as a bridge that took the version would.
 */
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { SkillDetail, Skills, SkillWritten } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { WebSocket } from 'ws';

import { BridgeHub, PluginSyncService } from '@/modules/devices';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const PACK = resolve(__dirname, '../../../../packages/team-pack');
const SECRET = `ghp_${'s'.repeat(40)}`;

interface ActionFrame {
  readonly type: 'action';
  readonly id: string;
  readonly action: string;
  readonly args: Record<string, unknown>;
}

async function until<T>(check: () => T | Promise<T>, timeoutMs = 15_000): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw new Error('Timed out waiting');
}

/** A bridge that answers `plugin.sync` with the version it was sent, or a refusal when told to fail. */
class SyncingDevice {
  readonly actions: ActionFrame[] = [];
  fail = false;

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const frame = JSON.parse((data as Buffer).toString()) as { type: string } & ActionFrame;
      if (frame.type !== 'action') return;
      this.actions.push(frame);
      if (frame.action !== 'plugin.sync') return;
      socket.send(
        JSON.stringify(
          this.fail
            ? {
                type: 'result',
                id: frame.id,
                ok: false,
                error: { code: 'failed', message: 'Claude Code could not update the plugin' },
              }
            : {
                type: 'result',
                id: frame.id,
                ok: true,
                data: { outcome: 'updated', version: frame.args['version'] },
              },
        ),
      );
    });
  }

  syncs(): ActionFrame[] {
    return this.actions.filter((frame) => frame.action === 'plugin.sync');
  }
}

const hashOf = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Every file under a folder with its hash, to prove a folder was not touched. */
function fingerprint(folder: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else out[`${prefix}${entry.name}`] = hashOf(full);
    }
  };
  walk(folder, '');
  return out;
}

describe('skills', () => {
  let scratch: string;
  let teamPack: string;
  let personal: string;
  let app: INestApplication;
  let port: number;
  let hub: BridgeHub;
  let browser: Browser;
  let slug: string;
  let workspaceId: string;
  let ownerId: string;
  const sockets: WebSocket[] = [];

  const prisma = () => maintenanceClients().prisma;
  const api = () => request(app.getHttpServer() as Parameters<typeof request>[0]);
  const base = () => `/workspaces/${slug}/skills`;
  const list = async (who = browser): Promise<Skills> =>
    (await who.get(base()).expect(200)).body.data as Skills;
  const hubSkills = () => join(teamPack, 'plugin', 'skills');

  beforeAll(async () => {
    scratch = mkdtempSync(join(tmpdir(), 'hub-e2e-skills-'));
    teamPack = join(scratch, 'team-pack');
    personal = join(scratch, 'personal');
    for (const entry of ['.claude-plugin', 'plugin', 'package.json']) {
      cpSync(join(PACK, entry), join(teamPack, entry), { recursive: true });
    }
    process.env['HUB_TEAM_PACK_DIR'] = teamPack;
    process.env['HUB_PERSONAL_SKILLS_DIR'] = personal;
    process.env['HUB_PLUGIN_SYNC'] = 'auto';
    ({ app } = await createTestApp({ realAuth: true }));
    await app.listen(0);
    port = (app.getHttpServer() as { address(): AddressInfo }).address().port;
    hub = app.get(BridgeHub, { strict: false });
  });

  afterAll(() => {
    process.env['HUB_PLUGIN_SYNC'] = 'manual';
    delete process.env['HUB_PERSONAL_SKILLS_DIR'];
    for (const socket of sockets.splice(0)) socket.terminate();
    rmSync(scratch, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // A fresh plugin and personal folder for each test.
    rmSync(join(teamPack, 'plugin'), { recursive: true, force: true });
    cpSync(join(PACK, 'plugin'), join(teamPack, 'plugin'), { recursive: true });
    rmSync(personal, { recursive: true, force: true });
    mkdirSync(personal, { recursive: true });
    const account = await anAccount(prisma());
    ownerId = account.id;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), workspaceId, ownerId, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.terminate();
  });

  function aPersonalSkill(name: string, files: Record<string, string | Buffer>): string {
    const folder = join(personal, name);
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(folder, path, '..'), { recursive: true });
      writeFileSync(join(folder, path), text);
    }
    return folder;
  }

  async function aDevice(): Promise<{ deviceId: string; device: SyncingDevice }> {
    const started = await api()
      .post('/api/v1/pairing/start')
      .send({ name: 'Laptop', platform: 'win32' })
      .expect(201);
    const { deviceCode, userCode } = started.body.data as { deviceCode: string; userCode: string };
    await browser.post(`/pairing/${userCode}/approve`).expect(204);
    const claimed = (await api().post('/api/v1/pairing/poll').send({ deviceCode }).expect(200)).body.data as {
      deviceId: string;
      credential: string;
    };
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
      headers: { authorization: `Bearer ${claimed.credential}` },
    });
    sockets.push(socket);
    const device = new SyncingDevice(socket);
    await new Promise((done, fail) => {
      socket.once('open', done);
      socket.once('error', fail);
    });
    socket.send(JSON.stringify({ type: 'hello', protocol: 1, status: {}, actions: [] }));
    await until(() => hub.isOnline(claimed.deviceId));
    return { deviceId: claimed.deviceId, device };
  }

  describe('the list', () => {
    it("Hub's skills, with Hub's protocols marked, and the owner's personal ones", async () => {
      aPersonalSkill('notes', {
        'SKILL.md':
          '---\nname: notes\ndescription: "Keep notes: daily"\nuser-invocable: true\n---\n\nWrite notes.\n',
      });
      const skills = await list();
      expect(skills.hub.map((skill) => skill.name)).toEqual([
        'ask',
        'doc',
        'guide',
        'plan',
        'suggest',
        'work',
      ]);
      expect(skills.hub.every((skill) => skill.core && skill.source === 'hub')).toBe(true);
      expect(skills.hub.find((skill) => skill.name === 'suggest')).toMatchObject({
        userInvocable: true,
        nameInHub: false,
      });
      expect(skills.personal).toEqual([
        expect.objectContaining({
          name: 'notes',
          description: 'Keep notes: daily',
          source: 'personal',
          core: false,
          nameInHub: false,
        }),
      ]);
      expect(skills.personalFolder).toBe(personal);
      expect(skills.sync).toMatchObject({ mode: 'auto', devices: [] });
      expect(skills.sync.version).toMatch(/^0\.1\.0-sync\.[0-9a-f]{12}$/);
    });

    it("a pm reads Hub's skills, never the owner's personal ones", async () => {
      aPersonalSkill('notes', { 'SKILL.md': '---\nname: notes\ndescription: x\n---\n' });
      const pm = await anAccount(prisma());
      await joinProject(prisma(), workspaceId, pm.id, ['pm']);
      const pmBrowser = new Browser(app);
      await pmBrowser.post('/auth/sign-in', { email: pm.email, password: PASSWORD }).expect(200);
      const skills = await list(pmBrowser);
      expect(skills.hub.length).toBeGreaterThan(0);
      expect(skills.personal).toEqual([]);
      expect(skills.personalFolder).toBeNull();
      await pmBrowser.get(`${base()}/personal/notes`).expect(403);
      await pmBrowser.post(base(), { name: 'mine', description: 'x', body: 'y' }).expect(403);
    });

    it('a personal skill shows with any secret-looking value masked', async () => {
      aPersonalSkill('leaky', {
        'SKILL.md': `---\nname: leaky\ndescription: Uses a key\n---\n\nThe key is ${SECRET}.\n`,
      });
      const detail = (await browser.get(`${base()}/personal/leaky`).expect(200)).body.data as SkillDetail;
      expect(JSON.stringify(detail)).not.toContain(SECRET);
      expect(detail.body).toContain('The key is');
    });
  });

  describe('writing a Hub skill', () => {
    it('creates one as a folder of the team pack, audited, and every name of Hub is refused', async () => {
      const created = (
        await browser
          .post(base(), {
            name: 'tidy-repo',
            description: 'Tidy the repo: before a merge',
            body: 'Run the formatter.',
            userInvocable: true,
          })
          .expect(201)
      ).body.data as SkillWritten;
      expect(created.skill).toMatchObject({
        name: 'tidy-repo',
        description: 'Tidy the repo: before a merge',
        core: false,
        userInvocable: true,
      });
      expect(created.revisionId).toBeNull();
      const text = readFileSync(join(hubSkills(), 'tidy-repo', 'SKILL.md'), 'utf8');
      expect(text).toBe(
        '---\nname: tidy-repo\ndescription: "Tidy the repo: before a merge"\nuser-invocable: true\n---\n\nRun the formatter.\n',
      );
      expect(
        await prisma().auditLog.findFirst({ where: { action: 'skills.create', workspaceId } }),
      ).not.toBeNull();

      for (const name of ['tidy-repo', 'work', 'suggest']) {
        const refused = await browser.post(base(), { name, description: 'x', body: 'y' }).expect(409);
        expect(refused.body.error.code).toBe('hub.skills.name_taken');
      }
      await browser.post(base(), { name: 'Bad Name', description: 'x', body: 'y' }).expect(400);
      const leak = await browser
        .post(base(), { name: 'leak', description: 'x', body: `token ${SECRET}` })
        .expect(422);
      expect(leak.body.error.code).toBe('hub.security.secret_detected');
      expect(existsSync(join(hubSkills(), 'leak'))).toBe(false);
      expect(readdirSync(hubSkills()).some((name) => name.startsWith('.hub-'))).toBe(false);
    });

    it('a save keeps the earlier text, a stale save is refused, and a restore brings it back as a save', async () => {
      const created = (
        await browser.post(base(), { name: 'tidy', description: 'First', body: 'One.' }).expect(201)
      ).body.data as SkillWritten;
      const first = readFileSync(join(hubSkills(), 'tidy', 'SKILL.md'), 'utf8');
      const saved = (
        await browser
          .put(`${base()}/hub/tidy`, {
            description: 'Second',
            body: 'Two.',
            userInvocable: false,
            baseHash: created.skill.hash,
          })
          .expect(200)
      ).body.data as SkillWritten;
      expect(saved.revisionId).not.toBeNull();
      expect(saved.skill).toMatchObject({ description: 'Second', body: 'Two.\n', userInvocable: false });

      const stale = await browser
        .put(`${base()}/hub/tidy`, {
          description: 'Third',
          body: 'Three.',
          userInvocable: true,
          baseHash: created.skill.hash,
        })
        .expect(409);
      expect(stale.body.error.code).toBe('hub.skills.stale_base');

      const revisions = (await browser.get(`${base()}/hub/tidy/revisions`).expect(200)).body.data as {
        id: string;
        reason: string;
        savedBy: { id: string };
      }[];
      expect(revisions).toHaveLength(1);
      expect(revisions[0]).toMatchObject({ reason: 'edit', savedBy: { id: ownerId } });
      const kept = (await browser.get(`${base()}/hub/tidy/revisions/${revisions[0]!.id}`).expect(200)).body
        .data as { text: string };
      expect(kept.text).toBe(first);

      const restored = (
        await browser
          .post(`${base()}/hub/tidy/revisions/${revisions[0]!.id}/restore`, { baseHash: saved.skill.hash })
          .expect(200)
      ).body.data as SkillWritten;
      expect(restored.skill.description).toBe('First');
      expect(readFileSync(join(hubSkills(), 'tidy', 'SKILL.md'), 'utf8')).toBe(first);
      const after = (await browser.get(`${base()}/hub/tidy/revisions`).expect(200)).body.data as {
        reason: string;
      }[];
      expect(after.map((row) => row.reason)).toEqual(['restore', 'edit']);
    });

    it("Hub's own protocols are not written from here", async () => {
      const work = (await browser.get(`${base()}/hub/work`).expect(200)).body.data as SkillDetail;
      const refused = await browser
        .put(`${base()}/hub/work`, { description: 'x', body: 'y', userInvocable: true, baseHash: work.hash })
        .expect(409);
      expect(refused.body.error.code).toBe('hub.skills.core_read_only');
      expect(readFileSync(join(hubSkills(), 'work', 'SKILL.md'), 'utf8')).toBe(
        readFileSync(join(PACK, 'plugin', 'skills', 'work', 'SKILL.md'), 'utf8'),
      );
    });

    it('is session only: no token reaches any write', async () => {
      const { token } = await aToken(prisma(), ownerId);
      const bearer = (path: string) =>
        api().post(`/api/v1${base()}${path}`).set('authorization', `Bearer ${token}`);
      await bearer('').send({ name: 'x', description: 'x', body: 'x' }).expect(403);
      await bearer('/move').send({ name: 'x' }).expect(403);
      await bearer('/sync').send({}).expect(403);
      // Reading is open to a token, as list_skills is.
      await api().get(`/api/v1${base()}`).set('authorization', `Bearer ${token}`).expect(200);
    });
  });

  describe('Move to Hub', () => {
    it('copies the folder under its own name, changes only the name line, and leaves the original untouched', async () => {
      const original = aPersonalSkill('daily-notes', {
        'SKILL.md':
          '---\nname: notes-old\ndescription: Keep notes\nargument-hint: "<day>"\n---\n\nWrite notes.\n',
        'references/format.md': '# Format\n',
      });
      const before = fingerprint(original);
      const moved = (await browser.post(`${base()}/move`, { name: 'daily-notes' }).expect(201)).body
        .data as SkillWritten;
      expect(moved.skill).toMatchObject({
        name: 'daily-notes',
        source: 'hub',
        files: 2,
        otherFiles: ['references/format.md'],
      });
      const copy = readFileSync(join(hubSkills(), 'daily-notes', 'SKILL.md'), 'utf8');
      expect(copy).toBe(
        '---\nname: daily-notes\ndescription: Keep notes\nargument-hint: "<day>"\n---\n\nWrite notes.\n',
      );
      expect(readFileSync(join(hubSkills(), 'daily-notes', 'references', 'format.md'), 'utf8')).toBe(
        '# Format\n',
      );
      expect(fingerprint(original)).toEqual(before);
      expect((await list()).personal.find((skill) => skill.name === 'daily-notes')?.nameInHub).toBe(true);
      expect(
        await prisma().auditLog.findFirst({ where: { action: 'skills.move', workspaceId } }),
      ).not.toBeNull();
    });

    it('a name Hub has is refused, and the same skill moves under another name', async () => {
      aPersonalSkill('suggest', {
        'SKILL.md': '---\nname: suggest\ndescription: My own suggest\n---\n\nMine.\n',
      });
      expect((await list()).personal[0]?.nameInHub).toBe(true);
      const refused = await browser.post(`${base()}/move`, { name: 'suggest' }).expect(409);
      expect(refused.body.error.code).toBe('hub.skills.name_taken');
      const moved = (await browser.post(`${base()}/move`, { name: 'suggest', as: 'my-suggest' }).expect(201))
        .body.data as SkillWritten;
      expect(moved.skill.name).toBe('my-suggest');
      expect(readFileSync(join(hubSkills(), 'suggest', 'SKILL.md'), 'utf8')).toContain('name: suggest');
      expect(readFileSync(join(hubSkills(), 'my-suggest', 'SKILL.md'), 'utf8')).toContain('name: my-suggest');
    });

    it('refuses a binary file, a secret, too many files and a folder that is not there, copying nothing', async () => {
      aPersonalSkill('pictures', {
        'SKILL.md': '---\nname: pictures\ndescription: x\n---\n',
        'logo.png': Buffer.from([0x89, 0x50, 0x00, 0x01]),
      });
      expect((await browser.post(`${base()}/move`, { name: 'pictures' }).expect(422)).body.error.code).toBe(
        'hub.skills.not_text',
      );
      aPersonalSkill('leaky', {
        'SKILL.md': '---\nname: leaky\ndescription: x\n---\n',
        'notes.md': `key ${SECRET}`,
      });
      expect((await browser.post(`${base()}/move`, { name: 'leaky' }).expect(422)).body.error.code).toBe(
        'hub.security.secret_detected',
      );
      const many = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`f${index}.md`, 'x']));
      aPersonalSkill('huge', { 'SKILL.md': '---\nname: huge\ndescription: x\n---\n', ...many });
      expect((await browser.post(`${base()}/move`, { name: 'huge' }).expect(422)).body.error.code).toBe(
        'hub.skills.too_large',
      );
      expect((await browser.post(`${base()}/move`, { name: 'nowhere' }).expect(404)).body.error.code).toBe(
        'hub.skills.personal_not_found',
      );
      aPersonalSkill('Odd_Name', { 'SKILL.md': '---\nname: odd\ndescription: x\n---\n' });
      await browser.post(`${base()}/move`, { name: 'Odd_Name' }).expect(400);
      await browser.post(`${base()}/move`, { name: 'Odd_Name', as: 'odd-name' }).expect(201);
      for (const name of ['pictures', 'leaky', 'huge'])
        expect(existsSync(join(hubSkills(), name))).toBe(false);
    });
  });

  describe('the plugin sync', () => {
    it('a device that connects behind takes the current plugin, and each skill it took counts as synced on it', async () => {
      const { deviceId, device } = await aDevice();
      const [first] = await until(() => (device.syncs().length > 0 ? device.syncs() : null));
      const paths = (first!.args['files'] as { path: string }[]).map((file) => file.path);
      expect(paths).toContain('.claude-plugin/marketplace.json');
      expect(paths).toContain('plugin/skills/suggest/SKILL.md');
      expect(paths.some((path) => path.startsWith('bridge/') || path.includes('..'))).toBe(false);
      const version = first!.args['version'] as string;
      await until(
        async () =>
          (await prisma().device.findUnique({ where: { id: deviceId } }))?.pluginVersion === version,
      );
      const skills = await list();
      expect(skills.sync.devices).toEqual([
        expect.objectContaining({ id: deviceId, version, current: true, error: null }),
      ]);
      expect(skills.hub.every((skill) => skill.devices[0]?.synced)).toBe(true);
    });

    it('a change syncs every online device; until it lands the skill reads as not synced there', async () => {
      const { device } = await aDevice();
      await until(() => device.syncs().length === 1);
      const created = (await browser.post(base(), { name: 'tidy', description: 'x', body: 'y' }).expect(201))
        .body.data as SkillWritten;
      expect(created.syncing).toBe(1);
      expect(created.skill.devices[0]?.synced).toBe(false);
      await until(() => device.syncs().length === 2);
      const files = device.syncs()[1]!.args['files'] as { path: string }[];
      expect(files.map((file) => file.path)).toContain('plugin/skills/tidy/SKILL.md');
      await until(
        async () => (await list()).hub.find((skill) => skill.name === 'tidy')?.devices[0]?.synced === true,
      );
    });

    it('a failed sync is kept as the bridge said it, and Sync now tries again', async () => {
      const { deviceId, device } = await aDevice();
      await until(() => device.syncs().length === 1);
      device.fail = true;
      await browser.post(base(), { name: 'tidy', description: 'x', body: 'y' }).expect(201);
      await until(
        async () => (await prisma().device.findUnique({ where: { id: deviceId } }))?.pluginSyncError,
      );
      const failed = (await list()).sync.devices[0]!;
      expect(failed.current).toBe(false);
      expect(failed.error).toContain('Claude Code could not update the plugin');
      device.fail = false;
      const now = (await browser.post(`${base()}/sync`).expect(200)).body.data as {
        devices: { current: boolean; error: string | null }[];
      };
      expect(now.devices[0]).toMatchObject({ current: true, error: null });
    });

    it('in manual mode nothing syncs by itself', async () => {
      const sync = app.get(PluginSyncService, { strict: false });
      const spy = jest.spyOn(sync, 'mode', 'get').mockReturnValue('manual');
      try {
        const { device } = await aDevice();
        const created = (
          await browser.post(base(), { name: 'tidy', description: 'x', body: 'y' }).expect(201)
        ).body.data as SkillWritten;
        expect(created.syncing).toBe(0);
        await new Promise((done) => setTimeout(done, 300));
        expect(device.syncs()).toEqual([]);
      } finally {
        spy.mockRestore();
      }
    });

    it('a new device downloads the same plugin, with the skills the owner added', async () => {
      await browser.post(base(), { name: 'tidy', description: 'x', body: 'y' }).expect(201);
      const bundle = (await api().get('/api/v1/connect/bundle').expect(200)).body as {
        files: { path: string; text: string }[];
      };
      const market = JSON.parse(
        bundle.files.find((file) => file.path === 'team-pack/.claude-plugin/marketplace.json')!.text,
      );
      expect(market.plugins[0].version).toBe((await list()).sync.version);
      expect(bundle.files.map((file) => file.path)).toContain('team-pack/plugin/skills/tidy/SKILL.md');
      expect(bundle.files.map((file) => file.path)).toContain('team-pack/package.json');
    });
  });
});
