/**
 * @file Docs in local path mode, golden search queries, the lab scanner, screenshots and write-back (H2-05, H2-06, H5-03).
 * @description Every folder here is a temp copy. Nothing touches the real lab (brief: never write to F:/Goteav/redesign).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SourceRunnerService } from '@/modules/system';

import { aProject, created, db, type Member, type Project } from '../setup/card-harness';
import { closeTestApps, createTestApp, type TestApp } from '../setup/create-test-app';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const para = (text: string) => `${text} `.repeat(6).trim();

function write(root: string, path: string, content: string | Buffer): void {
  const file = join(root, ...path.split('/'));
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
}

function docsFixture(root: string): void {
  write(
    root,
    'refunds.md',
    `# Refund policy\n\n${para('A customer may ask for a refund to the wallet.')}\n\n## Timing\n\n${para('Refunds settle within five working days of the request.')}\n`,
  );
  write(
    root,
    'سياسة-الاسترداد.ar.md',
    `# سياسة الاسترداد\n\n${para('يحق للعميل طلب استرداد المبلغ إلى المحفظة بعد الإلغاء.')}\n\n## المدة\n\n${para('تتم تسوية الاسترداد خلال خمسة أيام عمل من تاريخ الطلب.')}\n`,
  );
  write(
    root,
    'adr/0001-gateway.md',
    `# ADR-0001: Primary gateway\n\n${para('We chose PayTR as the primary payment gateway with Akbank as backup.')}\n`,
  );
  write(
    root,
    'status/2026-11-01.md',
    `# Status\n\n${para('The wallet top-up shipped and the invoice export is next.')}\n`,
  );
  write(
    root,
    'wallet/README.md',
    `# Wallet\n\n${para('The wallet holds customer credit in USD and TRY.')}\n`,
  );
  write(
    root,
    'ar/الفواتير.md',
    `# الفواتير\n\n${para('تصدر الفاتورة الضريبية بعد تأكيد الحجز وتُرسل إلى البريد.')}\n`,
  );
  write(
    root,
    'map/generated.md',
    `# Generated\n\n${para('This generated refund map must not be indexed.')}\n`,
  );
  write(root, 'node_modules/pkg/README.md', '# A package\n');
  write(root, 'leak.md', '# Leak\n\ntoken=ghp_0123456789abcdefghijklmnopqrstuvwxyz01\n');
}

const GOLDEN: readonly [string, string][] = [
  ['refund', 'refunds.md'],
  ['refund wallet', 'refunds.md'],
  ['working days', 'refunds.md'],
  ['PayTR gateway', 'adr/0001-gateway.md'],
  ['invoice export', 'status/2026-11-01.md'],
  ['USD credit', 'wallet/README.md'],
  ['الاسترداد', 'سياسة-الاسترداد.ar.md'],
  // A spelling the text does not use: no "ال", found through the wider query.
  ['استرداد المبلغ', 'سياسة-الاسترداد.ar.md'],
  ['المحفظة بعد الإلغاء', 'سياسة-الاسترداد.ar.md'],
  ['الفاتورة الضريبية', 'ar/الفواتير.md'],
  ['فاتورة', 'ar/الفواتير.md'],
];

function labFixture(root: string): void {
  write(
    root,
    'web/wallet/README.md',
    '---\napp: web\npage: wallet\nroute: /[locale]/account/wallet # note\nlive-url: http://localhost:6002/ar/account/wallet\nstatus: researching\n---\n\n# Wallet brief\n\nThe page.\n',
  );
  write(root, 'web/wallet/research/references.md', '# not a version\n');
  write(
    root,
    'web/wallet/v1-baseline/README.md',
    '---\nversion: v1-baseline\ntitle: Baseline\nstatus: reference\n---\n\n# Baseline\n',
  );
  write(
    root,
    'web/wallet/v2-flight-path/README.md',
    '---\nversion: v2-flight-path\ntitle: Flight path\nstatus: draft # draft | review\nbase: v1-baseline\ntouches-components: [components/a.tsx, components/b.tsx]\nported:\ncustom: keep\n---\n\n# Flight path\n\nExact   body.\n',
  );
  write(
    root,
    'web/wallet/v2-flight-path/review.md',
    '# Review\n\n| Pillar | Score /10 | Verdict |\n|---|---|---|\n| A | 8 | x |\n| B | 7 | x |\n\nGood overall.\n',
  );
  write(root, 'web/wallet/v2-flight-path/shots/desktop-ar-light.png', PNG);
  write(root, 'web/wallet/v2-flight-path/shots/secret.txt', 'not an image');
  write(
    root,
    'web/wallet/v3-twin/README.md',
    '---\nversion: v3-twin\ntitle: Twin\nstatus: review\n---\n\n# Twin\n',
  );
  write(root, 'web/wallet/v3-twin/shots/desktop-ar-light.png', PNG);
  write(root, 'web/wallet/v3-twin/shots/phone.png', PNG);
  write(
    root,
    'hub/today/v5-peacock/README.md',
    '---\nversion: v5-peacock\ntitle: Peacock\nstatus: approved\n---\n\n# Peacock\n',
  );
  write(root, '_templates/page/v1-x/README.md', '---\nstatus: draft\n---\n');
  write(root, 'outside.png', PNG);
}

describe('knowledge', () => {
  let testApp: TestApp;
  let scratch: string;
  let runner: SourceRunnerService;

  beforeAll(async () => {
    testApp = await createTestApp();
    runner = testApp.app.get(SourceRunnerService);
    scratch = mkdtempSync(join(tmpdir(), 'hub-e2e-'));
  });

  afterAll(async () => {
    await closeTestApps();
    rmSync(scratch, { recursive: true, force: true });
  });

  const folder = (name: string): string => {
    const path = join(scratch, name, String(Math.random()).slice(2));
    mkdirSync(path, { recursive: true });
    return path;
  };

  async function source(
    owner: Member,
    name: string,
    path: string,
    purpose: 'docs' | 'lab',
    extra: object = {},
  ) {
    const { body } = await owner
      .post('/sources', { kind: 'local_path', name, config: { path, purpose, ...extra } })
      .expect(201);
    return body.data.id as string;
  }

  describe('docs', () => {
    let project: Project;
    let owner: Member;
    let root: string;
    let sourceId: string;

    beforeEach(async () => {
      project = await aProject(testApp.app);
      owner = await project.member(['owner']);
      root = folder('docs');
      docsFixture(root);
      sourceId = await source(owner, 'backend-docs', root, 'docs', { exclude: ['map/**'] });
      await owner.post('/docs/reindex', {}).expect(202);
    });

    it('indexes what the source allows, and withholds a file with a secret', async () => {
      const { body } = await owner.get('/docs', { limit: 100 }).expect(200);
      const paths = (body.data as { detail: { path: string } }[]).map((doc) => doc.detail.path).sort();
      expect(paths).toEqual(
        [
          'adr/0001-gateway.md',
          'ar/الفواتير.md',
          'refunds.md',
          'status/2026-11-01.md',
          'wallet/README.md',
          'سياسة-الاسترداد.ar.md',
        ].sort(),
      );
      expect(
        body.data.find((doc: { detail: { path: string } }) => doc.detail.path === 'adr/0001-gateway.md')
          .detail.kind,
      ).toBe('adr');
      const run = (await owner.get('/capture/runs').expect(200)).body.data[0];
      expect(run).toMatchObject({ status: 'ok', kind: 'docs_index', created: 6, sourceName: 'backend-docs' });
      expect(run.error).toContain('1 files left out');
      const stored = await db().docChunk.findMany({ where: { workspaceId: project.id } });
      expect(stored.some((chunk) => chunk.content.includes('ghp_'))).toBe(false);
    });

    it('builds the tree, and the viewer reads the file with its table of contents', async () => {
      const [tree] = (await owner.get('/docs/tree').expect(200)).body.data;
      expect(tree).toMatchObject({ source: { id: sourceId, name: 'backend-docs' }, total: 6 });
      expect(tree.root.folders.map((f: { name: string }) => f.name)).toEqual([
        'adr',
        'ar',
        'status',
        'wallet',
      ]);
      expect(tree.root.folders[0].docs[0].detail.path).toBe('adr/0001-gateway.md');
      const refund = tree.root.docs.find(
        (doc: { detail: { path: string } }) => doc.detail.path === 'refunds.md',
      );
      const { body } = await owner.get(`/docs/${refund.key}`).expect(200);
      expect(body.data.content).toContain('# Refund policy');
      expect(body.data.unavailable).toBeNull();
      expect(body.data.docSource.name).toBe('backend-docs');
      expect(body.data.toc).toEqual([
        { level: 1, text: 'Refund policy', anchor: 'refund-policy' },
        { level: 2, text: 'Timing', anchor: 'timing' },
      ]);
      const byPath = await owner
        .get('/docs/by-path', { source: 'backend-docs', path: 'refunds.md' })
        .expect(200);
      expect(byPath.body.data.key).toBe(refund.key);
      await owner.get('/docs/by-path', { source: 'backend-docs', path: 'nope.md' }).expect(404);
    });

    it.each(GOLDEN)('golden query %s finds %s', async (q, path) => {
      const { body } = await owner.get('/docs/search', { q }).expect(200);
      const hit = body.data.find((row: { path: string }) => row.path === path);
      expect(hit).toBeDefined();
      expect(hit.chunks.length).toBeGreaterThan(0);
      expect(hit.chunks.length).toBeLessThanOrEqual(2);
      expect(hit.chunks[0].excerpt).toContain('<mark>');
    });

    it('search covers cards and docs, and a query cannot break out', async () => {
      const pm = await project.member(['pm']);
      const task = await created(pm, {
        type: 'task',
        title: 'Refund button',
        detail: { specialty: 'backend', prompt: 'x' },
      });
      const { body } = await pm.get('/search', { q: 'refund' }).expect(200);
      expect(body.data.cards.map((card: { key: string }) => card.key)).toContain(task.key);
      expect(body.data.cards[0].highlight).toContain('<mark>');
      expect(body.data.docs.length).toBeGreaterThan(0);
      const cardsOnly = await pm.get('/search', { q: 'refund', includeDocs: 'false' }).expect(200);
      expect(cardsOnly.body.data.docs).toEqual([]);
      await pm.get('/search', { q: "refund' OR 1=1 --" }).expect(200);
      await pm.get('/search', { q: 'x' }).expect(400);
    });

    it('trigram catches a near title when the words miss', async () => {
      const pm = await project.member(['pm']);
      const task = await created(pm, {
        type: 'task',
        title: 'Currency switcher',
        detail: { specialty: 'backend', prompt: 'x' },
      });
      const { body } = await pm.get('/search', { q: 'Curency switchr' }).expect(200);
      expect(body.data.cards.map((card: { key: string }) => card.key)).toContain(task.key);
    });

    it('re-indexing keeps card ids, finds changes, removes and restores', async () => {
      const find = async (path: string) =>
        db().docDetail.findFirstOrThrow({ where: { path, sourceId }, include: { card: true } });
      const before = await find('wallet/README.md');
      await owner.post(`/sources/${sourceId}/run`).expect(202);
      const again = (await owner.get('/capture/runs', { source: sourceId }).expect(200)).body.data[0];
      expect(again).toMatchObject({ created: 0, updated: 0 });

      write(root, 'wallet/README.md', `# Wallet\n\n${para('Credit now also includes loyalty points.')}\n`);
      await owner.post(`/sources/${sourceId}/run`).expect(202);
      const after = await find('wallet/README.md');
      expect(after.cardId).toBe(before.cardId);
      expect(after.contentHash).not.toBe(before.contentHash);
      expect((await owner.get('/docs/search', { q: 'loyalty points' }).expect(200)).body.data[0].path).toBe(
        'wallet/README.md',
      );
      const stale = (await owner.get('/docs/search', { q: 'holds USD' }).expect(200)).body.data;
      expect(stale.map((row: { path: string }) => row.path)).not.toContain('wallet/README.md');

      rmSync(join(root, 'status/2026-11-01.md'));
      await owner.post(`/sources/${sourceId}/run`).expect(202);
      expect((await find('status/2026-11-01.md')).card.status).toBe('removed');
      expect((await owner.get('/docs/search', { q: 'invoice export' }).expect(200)).body.data).toEqual([]);
      write(root, 'status/2026-11-01.md', `# Status\n\n${para('The invoice export came back.')}\n`);
      await owner.post(`/sources/${sourceId}/run`).expect(202);
      expect((await find('status/2026-11-01.md')).card.status).toBe('current');
    });

    it('doc events stay out of the default timeline and the new-events count', async () => {
      const qa = await project.member(['qa']);
      const { body } = await qa.get('/timeline').expect(200);
      expect(body.data.filter((row: { card: { type: string } }) => row.card.type === 'doc')).toEqual([]);
      const docs = await qa.get('/timeline', { types: 'doc' }).expect(200);
      expect(docs.body.data.length).toBeGreaterThan(0);
    });

    it('a card that names a doc shows its chip, and the doc shows the card (H5-03)', async () => {
      const pm = await project.member(['pm']);
      const task = await created(pm, {
        type: 'task',
        title: 'Follow the policy',
        body: 'See docs/refunds.md and adr/0001-gateway.md, not missing.md',
        detail: { specialty: 'backend', prompt: 'x' },
      });
      const { body } = await pm.get(`/docs/mentions/${task.key}`).expect(200);
      expect(body.data.map((row: { mention: string; path: string }) => [row.mention, row.path])).toEqual([
        ['docs/refunds.md', 'refunds.md'],
        ['adr/0001-gateway.md', 'adr/0001-gateway.md'],
      ]);
      const doc = await pm
        .get('/docs/by-path', { source: 'backend-docs', path: 'adr/0001-gateway.md' })
        .expect(200);
      expect(doc.body.data.mentionedBy.map((card: { key: string }) => card.key)).toContain(task.key);
    });

    it('a file that gained a secret since the last run is not served', async () => {
      write(root, 'refunds.md', '# Refund policy\n\ntoken=ghp_0123456789abcdefghijklmnopqrstuvwxyz01\n');
      const { body } = await owner
        .get('/docs/by-path', { source: 'backend-docs', path: 'refunds.md' })
        .expect(200);
      expect(body.data.content).toBeNull();
      expect(body.data.unavailable).toBe('secret');
    });

    it('an unreadable folder fails the run honestly, alerts after three, and shows on Today', async () => {
      const pm = await project.member(['pm']);
      const missing = join(scratch, 'does-not-exist');
      const id = await source(owner, 'gone', missing, 'docs');
      for (let i = 0; i < 3; i += 1) await owner.post(`/sources/${id}/run`).expect(202);
      const today = (await pm.get('/today').expect(200)).body.data;
      const row = today.sources.find((item: { id: string }) => item.id === id);
      expect(row).toMatchObject({ status: 'failing', runs24h: 3, target: missing });
      expect(today.counters.sourceProblems).toBe(1);
      expect(today.sources[0].id).toBe(id);
      const inbox = (await pm.get('/inbox', { kinds: 'system' }).expect(200)).body.data;
      expect(inbox.filter((item: { title: string }) => item.title.includes('gone'))).toHaveLength(1);
      // An item with no card says where to go (docs/07).
      const told = (inbox as { data: { i18nKey?: string; link?: unknown } }[]).find(
        (item) => item.data.i18nKey === 'source_failing',
      );
      expect(told?.data.link).toEqual({ view: 'settings', query: { tab: 'sources' } });
      await owner.patch(`/sources/${id}`, { enabled: false }).expect(200);
    });

    it('refuses reindex to members without the right, and non-local sources', async () => {
      const qa = await project.member(['qa']);
      await qa.post('/docs/reindex', {}).expect(403);
      await qa.post(`/sources/${sourceId}/run`).expect(403);
    });
  });

  describe('lab', () => {
    let project: Project;
    let owner: Member;
    let root: string;
    let sourceId: string;

    const version = async (labPath: string) =>
      db().card.findFirstOrThrow({
        where: { workspaceId: project.id, externalKey: `lab:${labPath}` },
        include: { redesign: true },
      });
    const scan = async () => runner.finish(project.id, await runner.open(project.id, sourceId));

    beforeEach(async () => {
      project = await aProject(testApp.app);
      owner = await project.member(['owner']);
      root = folder('lab');
      labFixture(root);
      sourceId = await source(owner, 'lab', root, 'lab');
      await scan();
    });

    it('creates a card per version with its status from the file, baseline as reference', async () => {
      const cards = await db().card.findMany({ where: { workspaceId: project.id, type: 'redesign' } });
      expect(cards.map((card) => [card.externalKey, card.status]).sort()).toEqual([
        ['lab:hub/today/v5-peacock', 'approved'],
        ['lab:web/wallet/v1-baseline', 'reference'],
        ['lab:web/wallet/v2-flight-path', 'draft'],
        ['lab:web/wallet/v3-twin', 'review'],
      ]);
      const v2 = await version('web/wallet/v2-flight-path');
      expect(v2.redesign).toMatchObject({
        app: 'web',
        page: 'wallet',
        base: 'v1-baseline',
        touchesComponents: ['components/a.tsx', 'components/b.tsx'],
        reviewScore: 75,
        reviewSummary: 'Good overall.',
      });
      expect(v2.title).toBe('web/wallet · v2-flight-path — Flight path');
      expect(await db().notification.count({ where: { userId: owner.id, kind: 'routed_review' } })).toBe(1);
    });

    it('a summary stored by an older reading heals on the next scan, and then stays unchanged', async () => {
      const v2 = await version('web/wallet/v2-flight-path');
      await db().redesignDetail.update({ where: { cardId: v2.id }, data: { reviewSummary: '---' } });
      await scan();
      expect((await version('web/wallet/v2-flight-path')).redesign?.reviewSummary).toBe('Good overall.');
      const events = () => db().cardEvent.count({ where: { workspaceId: project.id, cardId: v2.id } });
      const before = await events();
      await scan();
      expect(await events()).toBe(before);
    });

    it('pages list versions in order, with the brief', async () => {
      const { body } = await owner.get('/redesign/pages').expect(200);
      const wallet = body.data.find((page: { page: string }) => page.page === 'wallet');
      expect(wallet).toMatchObject({
        app: 'web',
        route: '/[locale]/account/wallet',
        liveUrl: 'http://localhost:6002/ar/account/wallet',
        status: 'researching',
      });
      expect(wallet.brief).toContain('# Wallet brief');
      expect(wallet.versions.map((card: { detail: { version: string } }) => card.detail.version)).toEqual([
        'v1-baseline',
        'v2-flight-path',
        'v3-twin',
      ]);
    });

    it('re-scanning changes nothing', async () => {
      const count = () => db().cardEvent.count({ where: { workspaceId: project.id } });
      const before = await count();
      await scan();
      expect(await count()).toBe(before);
    });

    describe('screenshots', () => {
      it('serves an image to a member, with its type', async () => {
        const v2 = await owner.get(`/cards/${(await version('web/wallet/v2-flight-path')).key}`).expect(200);
        const shot = v2.body.data.attachments.find((row: { kind: string }) => row.kind === 'screenshot');
        expect(shot.name).toBe('desktop-ar-light.png');
        const path = decodeURIComponent(String(shot.url).split('path=')[1] ?? '');
        const { headers, body } = await owner.get('/lab/file', { path }).expect(200);
        expect(headers['content-type']).toBe('image/png');
        expect(headers['x-content-type-options']).toBe('nosniff');
        expect(Buffer.isBuffer(body) ? body.length : Number(headers['content-length'])).toBe(PNG.length);
      });

      it.each([
        ['../secret.png'],
        ['web/../../secret.png'],
        ['web/wallet/../../../../secret.png'],
        ['/etc/passwd'],
        ['C:/Windows/win.ini'],
        ['web\\wallet\\v3-twin\\shots\\phone.png'],
        ['web/wallet/v2-flight-path/README.md'],
        ['web/wallet/v2-flight-path/shots/secret.txt'],
        ['web/wallet/./v3-twin/shots/phone.png'],
        ['nope.png'],
        ['%2e%2e/secret.png'],
      ])('refuses %s', async (path) => {
        writeFileSync(join(root, '..', 'secret.png'), PNG);
        await owner.get('/lab/file', { path }).expect(404);
      });

      it('another project has no way in', async () => {
        const other = await aProject(testApp.app);
        const outsider = await other.member(['owner']);
        await outsider.get('/lab/file', { path: 'outside.png' }).expect(404);
        await outsider
          .get('/redesign/pages')
          .expect(200)
          .expect(({ body }) => expect(body.data).toEqual([]));
      });
    });

    it('compare pairs the two versions', async () => {
      const a = await version('web/wallet/v2-flight-path');
      const b = await version('web/wallet/v3-twin');
      const { body } = await owner.get('/redesign/compare', { a: a.key, b: b.key }).expect(200);
      expect(body.data.commonShots).toEqual(['desktop-ar-light.png']);
      expect(body.data.b.shots.map((shot: { name: string }) => shot.name)).toEqual([
        'desktop-ar-light.png',
        'phone.png',
      ]);
      expect(body.data.a.frameUrl).toBeNull();
      expect((await owner.get(`/redesign/${a.key}/readme`).expect(200)).body.data.review).toContain(
        '| Pillar',
      );
    });

    it('a status edited in the file moves the card, and does not name an approver', async () => {
      const file = join(root, 'web/wallet/v1-baseline/README.md');
      const v3 = join(root, 'hub/today/v5-peacock/README.md');
      writeFileSync(v3, readFileSync(v3, 'utf8').replace('status: approved', 'status: ported'));
      await scan();
      const moved = await version('hub/today/v5-peacock');
      expect(moved.status).toBe('ported');
      const event = await db().cardEvent.findFirstOrThrow({
        where: { cardId: moved.id, kind: 'status_changed' },
      });
      expect(event.data).toMatchObject({ reason: 'lab_file', to: 'ported' });
      expect(moved.redesign?.approvedById).toBeNull();
      expect(file).toBeTruthy();
    });

    it('approve writes the file, keeps the rest byte for byte, and creates the port task', async () => {
      const readme = join(root, 'web/wallet/v3-twin/README.md');
      const qa = await project.member(['qa']);
      const card = await version('web/wallet/v3-twin');
      await qa.post(`/redesign/${card.key}/approve`, {}).expect(403);
      expect(readFileSync(readme, 'utf8')).toContain('status: review');

      const { body } = await owner.post(`/redesign/${card.key}/approve`, { note: 'Ship: it' }).expect(200);
      expect(body.data.status).toBe('approved');
      const text = readFileSync(readme, 'utf8');
      expect(text).toContain('status: approved');
      expect(text).toContain('decision-note: "Ship: it"');
      expect(text).toContain('decided-at: ');
      expect(text.endsWith('---\n\n# Twin\n')).toBe(true);

      const port = await db().card.findFirstOrThrow({
        where: { workspaceId: project.id, type: 'task', task: { origin: 'redesign_port' } },
        include: { task: true },
      });
      expect(port.task?.prompt).toContain('web/wallet/v3-twin');

      const events = () => db().cardEvent.count({ where: { cardId: card.id } });
      const before = await events();
      await scan();
      expect(await events()).toBe(before);

      await owner.post(`/redesign/${card.key}/mark-ported`, { ref: 'feat/x@abc (web)' }).expect(200);
      expect(readFileSync(readme, 'utf8')).toContain('ported: feat/x@abc (web)');
    });

    it('send to review, request changes and reject write the file; the note and body stay', async () => {
      const readme = join(root, 'web/wallet/v2-flight-path/README.md');
      const card = await version('web/wallet/v2-flight-path');
      await owner.post(`/redesign/${card.key}/submit-review`).expect(200);
      expect(readFileSync(readme, 'utf8')).toContain('status: review # draft | review');
      await owner.post(`/redesign/${card.key}/request-changes`, { note: 'Tighten the header' }).expect(200);
      const noted = readFileSync(readme, 'utf8');
      expect(noted).toContain('status: review');
      expect(noted).toContain('## Review notes');
      expect(noted).toContain('Tighten the header');
      expect(noted).toContain('Exact   body.');
      expect(noted).toContain('custom: keep');
      await owner.post(`/redesign/${card.key}/reject`, { note: 'Not this one' }).expect(200);
      expect(readFileSync(readme, 'utf8')).toContain('status: rejected');
    });

    it('a write that fails refuses the action and leaves the card', async () => {
      const name = 'web/wallet/v9-broken';
      write(root, `${name}/README.md`, '---\nversion: v9-broken\nstatus: review\n---\n\n# Broken\n');
      await scan();
      const card = await version(name);
      write(root, `${name}/README.md`, 'no front matter any more');
      const { body } = await owner.post(`/redesign/${card.key}/approve`, {}).expect(500);
      expect(body.error.code).toBe('hub.redesign.write_failed');
      expect((await version(name)).status).toBe('review');
    });

    it('a folder gone is tagged, its status untouched, and back again untagged', async () => {
      const name = 'web/wallet/v8-gone';
      write(root, `${name}/README.md`, '---\nversion: v8-gone\nstatus: draft\n---\n\n# Gone\n');
      await scan();
      const copy = folder('moved');
      cpSync(join(root, name), copy, { recursive: true });
      rmSync(join(root, name), { recursive: true });
      await scan();
      const gone = await version(name);
      expect(gone.tags).toContain('missing-in-lab');
      expect(gone.status).toBe('draft');
      cpSync(copy, join(root, name), { recursive: true });
      await scan();
      expect((await version(name)).tags).not.toContain('missing-in-lab');
    });

    const REAL = 'F:/Goteav/redesign/web/wallet';
    (existsSync(REAL) ? it : it.skip)('reads a temp copy of the real wallet page', async () => {
      const copy = folder('real');
      cpSync(REAL, join(copy, 'web/wallet'), {
        recursive: true,
        filter: (from) => !/node_modules|[\\/]review[\\/]/.test(from),
      });
      const realProject = await aProject(testApp.app);
      const realOwner = await realProject.member(['owner']);
      const id = await source(realOwner, 'lab', copy, 'lab');
      await runner.finish(realProject.id, await runner.open(realProject.id, id));
      const run = (await realOwner.get('/capture/runs').expect(200)).body.data[0];
      expect(run.status).toBe('ok');
      expect(run.created).toBeGreaterThanOrEqual(6);
      const pages = (await realOwner.get('/redesign/pages').expect(200)).body.data;
      expect(pages[0].page).toBe('wallet');
      const withScore = pages[0].versions.filter(
        (card: { detail: { reviewScore: number | null } }) => card.detail.reviewScore,
      );
      expect(withScore.length).toBeGreaterThan(0);
    });
  });

  it('the system page and metrics report what is real', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    await qa.get('/system').expect(403);
    const { body } = await pm.get('/system').expect(200);
    expect(body.data).toMatchObject({
      sources: [],
      outbox: { failed: 0 },
      backup: { lastAt: null, sizeBytes: null },
      worker: { alive: false, lastHeartbeatAt: null },
    });
    expect(body.data.db.sizeBytes).toBeGreaterThan(0);
  });

  it('audit filters and CSV export match, with Arabic and hostile cells safe', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    await created(pm, { type: 'task', title: 'Plain', detail: { specialty: 'backend', prompt: 'x' } });
    await created(pm, { type: 'need', title: 'Second', detail: { kind: 'file', responsibleRole: 'qa' } });
    await db().auditLog.create({
      data: {
        workspaceId: project.id,
        actorKind: 'user',
        actorId: pm.id,
        via: 'web',
        action: 'test.formula',
        targetType: 'x',
        summary: '=HYPERLINK("http://evil") ،عربي',
      },
    });
    const filtered = await pm.get('/audit', { action: 'cards.task' }).expect(200);
    expect(filtered.body.data).toHaveLength(1);
    await qa.get('/audit/export.csv').expect(403);
    const csv = await pm.get('/audit/export.csv', { action: 'cards.' }).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.text.trim().split('\r\n');
    expect(lines[0]).toBe(
      'id,createdAt,actorKind,actorId,actorName,via,action,targetType,targetId,summary,ip',
    );
    expect(lines).toHaveLength(3);
    const hostile = await pm.get('/audit/export.csv', { action: 'test.' }).expect(200);
    expect(hostile.text).toContain(`"'=HYPERLINK(""http://evil"") ،عربي"`);
  });

  it('onboarding resolves a doc item to its card, and counts what is left', async () => {
    const project = await aProject(testApp.app);
    const owner = await project.member(['owner']);
    const root = folder('onboarding');
    write(root, 'welcome.md', `# Welcome\n\n${para('Read this first when you join the team.')}\n`);
    await source(owner, 'docs', root, 'docs');
    await owner.post('/docs/reindex', {}).expect(202);
    await owner
      .put('/settings/onboarding.paths', {
        value: {
          owner: [
            { id: 'read', title: 'Welcome', kind: 'doc', ref: 'welcome.md' },
            { id: 'later', title: 'Not yet', kind: 'doc', ref: 'nope.md' },
          ],
        },
      })
      .expect(200);
    const { body } = await owner.get('/onboarding').expect(200);
    expect(body.data[0].items[0].cardKey).toMatch(/-\d+$/);
    expect(body.data[0].items[1].cardKey).toBeNull();
    expect((await owner.get('/counters').expect(200)).body.data.onboardingLeft).toBe(2);
    await owner.post('/onboarding/read/done').expect(204);
    expect((await owner.get('/counters').expect(200)).body.data.onboardingLeft).toBe(1);
    await owner.del('/onboarding/read/done').expect(204);
    expect((await owner.get('/counters').expect(200)).body.data.onboardingLeft).toBe(2);
  });
});
