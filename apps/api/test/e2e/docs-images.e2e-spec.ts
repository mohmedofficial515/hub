/**
 * @file `GET /docs/{key}/image` (decision 13b, docs/04 §3.15): an image a document names, from its source's local folder.
 * Traversal first, then types, size, the headers that keep an SVG inert, caching, and another project's member.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';

import { DocsIndexerService } from '@/modules/docs';

import { anAccount, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>\n';

describe('doc images', () => {
  let app: INestApplication;
  let browser: Browser;
  let slug: string;
  let workspaceId: string;
  let scratch: string;
  let root: string;
  let key: string;

  const prisma = () => maintenanceClients().prisma;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
  });

  beforeEach(async () => {
    const account = await anAccount(prisma());
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), project.id, account.id, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);

    scratch = mkdtempSync(join(tmpdir(), 'hub-e2e-images-'));
    root = join(scratch, 'docs');
    mkdirSync(join(root, 'guide', 'img'), { recursive: true });
    mkdirSync(join(root, 'assets'));
    writeFileSync(
      join(root, 'guide', 'intro.md'),
      '# Intro\n\n![flow](img/flow.png)\n\n![logo](../assets/logo.svg)\n',
    );
    writeFileSync(join(root, 'guide', 'img', 'flow.png'), PNG);
    writeFileSync(join(root, 'guide', 'img', 'notes.txt'), 'not an image\n');
    writeFileSync(join(root, 'assets', 'logo.svg'), SVG);
    writeFileSync(join(scratch, 'secret.png'), PNG);
    mkdirSync(join(root, 'private'));
    writeFileSync(join(root, 'private', 'shot.png'), PNG);
    mkdirSync(join(root, '.git'));
    writeFileSync(join(root, '.git', 'x.png'), PNG);
    mkdirSync(join(root, 'guide', 'node_modules'));
    writeFileSync(join(root, 'guide', 'node_modules', 'y.png'), PNG);
    const source = await prisma().source.create({
      data: {
        workspaceId,
        kind: 'local_path',
        name: 'docs',
        config: { path: root, purpose: 'docs', exclude: ['private/**'] },
      },
    });
    await app.get(DocsIndexerService, { strict: false }).index({
      id: source.id,
      name: 'docs',
      workspaceId,
      config: { path: root, purpose: 'docs', exclude: ['private/**'] },
    });
    key = (await prisma().card.findFirstOrThrow({ where: { workspaceId, type: 'doc' } })).key;
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  const image = (src: string, docKey = key) =>
    browser.get(`/workspaces/${slug}/docs/${docKey}/image?src=${encodeURIComponent(src)}`);

  describe('refuses a way out of the source', () => {
    it.each([
      ['../../secret.png'],
      ['img/../../../secret.png'],
      ['%2e%2e/%2e%2e/secret.png'],
      ['/etc/passwd.png'],
      ['C:/Windows/win.png'],
      ['img\\flow.png'],
      ['//evil.test/a.png'],
      ['https://evil.test/a.png'],
      ['data:image/png;base64,AAAA'],
    ])('%s', async (src) => {
      const { body } = await image(src).expect(422);
      expect(body.error.code).toBe('hub.docs.image_bad_path');
    });

    it('a link inside the source that leads out of it is not found', async () => {
      symlinkSync(scratch, join(root, 'guide', 'out'), 'junction');
      const { body } = await image('out/secret.png').expect(404);
      expect(body.error.code).toBe('hub.docs.image_not_found');
    });
  });

  it('is not found in a folder the source leaves out: its own exclude, .git and node_modules', async () => {
    for (const src of ['../private/shot.png', '../.git/x.png', 'node_modules/y.png']) {
      expect((await image(src).expect(404)).body.error.code).toBe('hub.docs.image_not_found');
    }
  });

  it('a link inside the source into a left-out folder is not found either', async () => {
    symlinkSync(join(root, 'private'), join(root, 'guide', 'shots'), 'junction');
    expect((await image('shots/shot.png').expect(404)).body.error.code).toBe('hub.docs.image_not_found');
  });

  it('serves a png next to the document, with its type, caching and an inert CSP', async () => {
    const { headers, body } = await image('img/flow.png').expect(200);
    expect(headers['content-type']).toBe('image/png');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['cache-control']).toBe('private, max-age=300');
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(Buffer.isBuffer(body) ? body.length : Number(headers['content-length'])).toBe(PNG.length);
    await image('img/flow.png').set('If-None-Match', String(headers['etag'])).expect(304);
  });

  it('serves an svg one folder up, still inside the source, under the same CSP', async () => {
    const { headers } = await image('../assets/logo.svg').expect(200);
    expect(headers['content-type']).toBe('image/svg+xml');
    expect(headers['content-security-policy']).toContain('sandbox');
  });

  it('refuses a file that is not an image, a missing one, and one over the cap', async () => {
    expect((await image('img/notes.txt').expect(415)).body.error.code).toBe('hub.docs.image_type_refused');
    expect((await image('img/nope.png').expect(404)).body.error.code).toBe('hub.docs.image_not_found');
    writeFileSync(join(root, 'guide', 'img', 'huge.png'), Buffer.alloc(10 * 1024 * 1024 + 1));
    expect((await image('img/huge.png').expect(413)).body.error.code).toBe('hub.docs.image_too_large');
  });

  it('a card that is not a document, or an unknown key, is not found', async () => {
    expect((await image('img/flow.png', 'NOPE-1').expect(404)).body.error.code).toBe('hub.docs.not_found');
  });

  it("another project's member has no way in", async () => {
    const stranger = await anAccount(prisma());
    const other = await aProject(app);
    await joinProject(prisma(), other.id, stranger.id, ['owner']);
    const outsider = new Browser(app);
    await outsider.post('/auth/sign-in', { email: stranger.email, password: PASSWORD }).expect(200);
    const foreign = await outsider.get(`/workspaces/${slug}/docs/${key}/image?src=img%2Fflow.png`);
    expect([403, 404]).toContain(foreign.status);
    expect(foreign.headers['content-type']).not.toBe('image/png');
    const own = await outsider.get(`/workspaces/${other.slug}/docs/${key}/image?src=img%2Fflow.png`);
    expect(own.status).toBe(404);
  });
});
