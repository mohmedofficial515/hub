/**
 * @file Backups (docs/16 D61 to D63) on the throwaway test database: a real `pg_dump` into a scratch folder, the documents Hub wrote, the
 * history, keep (pin), delete, retention, the owner-only rule, the nightly time and its catch-up on a fake clock, a failure reaching the
 * inbox, the low-disk warning, the folder rules, a restart cutting a backup off, and `pnpm hub:restore` into a second throwaway database.
 * @description Nothing here touches F:/HubBackups or the owner's database: `HUB_BACKUP_DIR` is a temp folder, and the dump runs in the test's
 * own Postgres container, found by its published port. `QUEUE_MODE=inline` keeps the nightly timer off, so the test calls `tick()`.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { type BackupDto, type BackupsDto, localInstant } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';

import { PrismaClient } from '@/generated/prisma/client';
import { type FakeClock } from '@/infra/clock/clock';
import { BackupMachine, BackupScheduler, BackupsService } from '@/modules/backups';
import { DocsIndexerService } from '@/modules/docs';

import { anAccount, aToken, Browser, join as joinProject, PASSWORD } from '../helpers/auth';
import { aProject } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { readE2eState } from '../setup/e2e-state';
import { maintenanceClients } from '../setup/per-test-setup';

const REPO_ROOT = resolve(__dirname, '../../../..');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

describe('backups', () => {
  const scratchRoot = mkdtempSync(join(tmpdir(), 'hub-e2e-backups-'));
  const backupDir = join(scratchRoot, 'HubBackups');
  let app: INestApplication;
  let clock: FakeClock;
  let browser: Browser;
  let slug: string;
  let workspaceId: string;
  let ownerId: string;
  let ownerEmail: string;
  let docsRoot: string;

  const prisma = () => maintenanceClients().prisma;
  const service = () => app.get(BackupsService, { strict: false });
  const scheduler = () => app.get(BackupScheduler, { strict: false });
  const machine = () => app.get(BackupMachine, { strict: false });
  const base = () => `/workspaces/${slug}/backups`;
  const history = async (): Promise<BackupsDto> =>
    (await browser.get(base()).expect(200)).body.data as BackupsDto;
  /** A local date and time on the machine's clock, as the schedule reads it. */
  const local = (date: string, time: string) => localInstant(date, time, service().timezone);
  const backUpNow = async (): Promise<BackupDto> => {
    const started = (await browser.post(base()).expect(202)).body.data as BackupDto;
    expect(started.status).toBe('running');
    await service().idle();
    return started;
  };

  beforeAll(async () => {
    process.env['HUB_BACKUP_DIR'] = backupDir;
    ({ app, clock } = await createTestApp({ realAuth: true }));
  });

  afterAll(() => {
    delete process.env['HUB_BACKUP_DIR'];
    rmSync(scratchRoot, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    clock.set(new Date('2026-11-08T09:00:00.000Z'));
    const account = await anAccount(prisma());
    ownerId = account.id;
    ownerEmail = account.email;
    const project = await aProject(app);
    slug = project.slug;
    workspaceId = project.id;
    await joinProject(prisma(), workspaceId, ownerId, ['owner']);
    browser = new Browser(app);
    await browser.post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(200);
    rmSync(backupDir, { recursive: true, force: true });
    docsRoot = mkdtempSync(join(scratchRoot, 'docs-'));
  });

  /** A docs folder with one document Hub has saved once, so it has a revision and its current text lives only in the file. */
  async function aSavedDoc(): Promise<string> {
    writeFileSync(join(docsRoot, 'guide.md'), '# Guide\n\nThe first text.\n');
    const source = await prisma().source.create({
      data: { workspaceId, kind: 'local_path', name: 'docs', config: { path: docsRoot, purpose: 'docs' } },
    });
    await app
      .get(DocsIndexerService, { strict: false })
      .index({ id: source.id, name: 'docs', workspaceId, config: { path: docsRoot, purpose: 'docs' } });
    const card = await prisma().card.findFirstOrThrow({ where: { workspaceId, type: 'doc' } });
    await browser
      .post(`/workspaces/${slug}/docs/save`, {
        key: card.key,
        content: '# Guide\n\nThe second text, saved through Hub.\n',
        baseHash: sha('# Guide\n\nThe first text.\n'),
      })
      .expect(200);
    return card.key;
  }

  it('backs up now: a real dump, the documents Hub wrote and a manifest with no secret, in a folder outside the repository', async () => {
    await aSavedDoc();
    const started = await backUpNow();
    const list = await history();
    const done = list.items.find((item) => item.id === started.id)!;
    expect(done).toMatchObject({ status: 'done', trigger: 'manual', docs: 1, pinned: false, missing: false });
    expect(done.sizeBytes).toBeGreaterThan(1000);
    expect(done.path!.startsWith(backupDir)).toBe(true);
    expect(readdirSync(done.path!).sort()).toEqual(['docs', 'hub.dump', 'manifest.json']);
    // pg_dump's custom format starts with PGDMP.
    expect(readFileSync(join(done.path!, 'hub.dump')).subarray(0, 5).toString()).toBe('PGDMP');
    const copied = readFileSync(join(done.path!, 'docs', slug, 'docs', 'guide.md'), 'utf8');
    expect(copied).toContain('The second text');
    const manifest = readFileSync(join(done.path!, 'manifest.json'), 'utf8');
    expect(JSON.parse(manifest)).toMatchObject({ format: 1, database: { file: 'hub.dump' } });
    expect(manifest).toContain('.env and every secret');
    expect(manifest).not.toMatch(/HUB_SECRET_KEY|HUB_JWT_SECRET|postgres:\/\//);
    expect(readdirSync(backupDir).some((name) => name.endsWith('.partial'))).toBe(false);
    expect(list.settings).toMatchObject({
      folder: backupDir,
      folderSource: 'default',
      time: '03:00',
      keep: 14,
      enabled: true,
    });
    expect(list.nextAt).toBe(local('2026-11-09', '03:00').toISOString());
    expect(list.running).toBe(false);
    // The System tab reads the same backup.
    const system = await browser.get(`/workspaces/${slug}/system`).expect(200);
    expect(system.body.data.backup.sizeBytes).toBe(done.sizeBytes);
    expect(await prisma().auditLog.findFirst({ where: { action: 'backups.run' } })).not.toBeNull();
  });

  it('is the owner’s alone, and never reachable with a token', async () => {
    const pm = await anAccount(prisma());
    await joinProject(prisma(), workspaceId, pm.id, ['pm']);
    const other = new Browser(app);
    await other.post('/auth/sign-in', { email: pm.email, password: PASSWORD }).expect(200);
    await other.get(base()).expect(403);
    await other.post(base()).expect(403);
    const { token } = await aToken(prisma(), ownerId);
    const refused = await request(app.getHttpServer() as Server)
      .post(`/api/v1${base()}`)
      .set('authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(refused.status);
    const read = await request(app.getHttpServer() as Server)
      .get(`/api/v1${base()}`)
      .set('authorization', `Bearer ${token}`);
    expect([401, 403]).toContain(read.status);
    expect(await prisma().backup.count()).toBe(0);
  });

  it('runs one at a time', async () => {
    let release!: () => void;
    jest.spyOn(machine(), 'dump').mockImplementation(async (file: string) => {
      await new Promise<void>((done) => (release = done));
      writeFileSync(file, 'PGDMP');
    });
    await browser.post(base()).expect(202);
    const second = await browser.post(base()).expect(409);
    expect(second.body.error.code).toBe('hub.backups.running');
    expect((await history()).running).toBe(true);
    release();
    await service().idle();
    expect((await history()).running).toBe(false);
  });

  it('runs at the nightly time, catches a missed night up once at boot, and never retries a night by itself', async () => {
    jest.spyOn(machine(), 'dump').mockImplementation(async (file: string) => writeFileSync(file, 'PGDMP'));
    // Hub was off at 03:00: at 09:00 the first tick catches that night up, once.
    clock.set(local('2026-11-08', '09:00'));
    const caught = await scheduler().tick();
    expect(caught).toMatchObject({ trigger: 'catch_up', status: 'done' });
    expect(await scheduler().tick()).toBeNull();
    // Off for three nights: one backup when it is back, for the latest night.
    clock.set(local('2026-11-11', '12:00'));
    expect(await scheduler().tick()).toMatchObject({ trigger: 'catch_up' });
    expect(await scheduler().tick()).toBeNull();
    // On time.
    clock.set(new Date(local('2026-11-12', '03:00').getTime() + 30_000));
    expect(await scheduler().tick()).toMatchObject({ trigger: 'scheduled', status: 'done' });
    const rows = await prisma().backup.findMany({ orderBy: { startedAt: 'asc' } });
    expect(rows.map((row) => row.slotAt?.toISOString())).toEqual([
      local('2026-11-08', '03:00').toISOString(),
      local('2026-11-11', '03:00').toISOString(),
      local('2026-11-12', '03:00').toISOString(),
    ]);
    // Off in the settings: nothing runs. Days have passed on the clock, so the session signs in again.
    clock.set(local('2026-11-13', '03:05'));
    await browser.post('/auth/sign-in', { email: ownerEmail, password: PASSWORD }).expect(200);
    await browser.patch(`${base()}/settings`, { enabled: false }).expect(200);
    expect(await scheduler().tick()).toBeNull();
    expect((await history()).nextAt).toBeNull();
  });

  it('a failed night is in the history and in every owner’s inbox, and leaves no half folder', async () => {
    jest.spyOn(machine(), 'dump').mockRejectedValue(new Error('pg_dump failed: connection to <url> refused'));
    const failed = await scheduler().tick();
    expect(failed).toMatchObject({ status: 'failed' });
    const row = (await history()).items[0]!;
    expect(row.failure).toContain('pg_dump failed');
    expect(row.path).toBeNull();
    expect(existsSync(backupDir) ? readdirSync(backupDir) : []).toEqual([]);
    const notice = await prisma().notification.findFirst({ where: { userId: ownerId, workspaceId } });
    expect((notice?.data as { i18n?: { key?: string } }).i18n?.key).toBe('backup_failed');
    expect((notice?.data as { link?: { view: string; query?: { tab: string } } }).link).toEqual({
      view: 'settings',
      query: { tab: 'backups' },
    });
    // The night is not retried by itself.
    expect(await scheduler().tick()).toBeNull();
  });

  it('keeps the newest unpinned backups and every pinned one; delete is the owner’s press and keeps the line', async () => {
    jest.spyOn(machine(), 'dump').mockImplementation(async (file: string) => writeFileSync(file, 'PGDMP'));
    await browser.patch(`${base()}/settings`, { keep: 2 }).expect(200);
    const first = await backUpNow();
    clock.advance(60_000);
    await browser.post(`${base()}/${first.id}/pin`, { pinned: true }).expect(200);
    const second = await backUpNow();
    clock.advance(60_000);
    const third = await backUpNow();
    clock.advance(60_000);
    const fourth = await backUpNow();
    const byId = async () => new Map((await history()).items.map((item) => [item.id, item]));
    let rows = await byId();
    // Pinned forever; of the unpinned, the newest two stay.
    expect(rows.get(first.id)).toMatchObject({ pinned: true, deletedAt: null });
    expect(rows.get(second.id)).toMatchObject({ deletedBy: 'retention' });
    expect(existsSync(join(backupDir))).toBe(true);
    expect(rows.get(third.id)?.deletedAt).toBeNull();
    expect(rows.get(fourth.id)?.deletedAt).toBeNull();
    const secondRow = await prisma().backup.findUniqueOrThrow({ where: { id: second.id } });
    expect(existsSync(secondRow.path!)).toBe(false);

    // The owner deletes one: its folder goes, its line stays.
    const deleted = await browser.delete(`${base()}/${third.id}`).expect(200);
    expect(deleted.body.data).toMatchObject({ deletedBy: 'owner' });
    rows = await byId();
    expect(rows.get(third.id)?.deletedAt).not.toBeNull();
    expect(existsSync(rows.get(third.id)!.path!)).toBe(false);
    expect(await prisma().backup.count()).toBe(4);
    // Twice is refused, as is keeping a deleted one.
    await browser.delete(`${base()}/${third.id}`).expect(409);
    await browser.post(`${base()}/${third.id}/pin`, { pinned: true }).expect(409);
    await browser.delete(`${base()}/00000000-0000-7000-8000-000000000000`).expect(404);
    expect(await prisma().auditLog.count({ where: { action: 'backups.delete' } })).toBe(1);

    // Unpinned, it is back under the rule: two unpinned are left, within the two kept.
    await browser.post(`${base()}/${first.id}/pin`, { pinned: false }).expect(200);
    rows = await byId();
    expect(rows.get(first.id)?.deletedAt).toBeNull();
    // Fewer to keep applies at once, oldest first.
    await browser.patch(`${base()}/settings`, { keep: 1 }).expect(200);
    rows = await byId();
    expect(rows.get(first.id)?.deletedBy).toBe('retention');
    expect(rows.get(fourth.id)?.deletedAt).toBeNull();
  });

  it('a folder deleted outside Hub reads as missing', async () => {
    jest.spyOn(machine(), 'dump').mockImplementation(async (file: string) => writeFileSync(file, 'PGDMP'));
    const started = await backUpNow();
    const row = await prisma().backup.findUniqueOrThrow({ where: { id: started.id } });
    rmSync(row.path!, { recursive: true, force: true });
    expect((await history()).items[0]).toMatchObject({ missing: true, deletedAt: null });
  });

  it('warns when the backup drive is low on space', async () => {
    jest
      .spyOn(machine(), 'disk')
      .mockResolvedValue({ freeBytes: 2 * 1024 ** 3, totalBytes: 500 * 1024 ** 3 });
    expect((await history()).disk).toEqual({
      freeBytes: 2 * 1024 ** 3,
      totalBytes: 500 * 1024 ** 3,
      low: true,
    });
    jest
      .spyOn(machine(), 'disk')
      .mockResolvedValue({ freeBytes: 200 * 1024 ** 3, totalBytes: 500 * 1024 ** 3 });
    expect((await history()).disk?.low).toBe(false);
  });

  it('takes a folder outside every Git checkout, and goes back to the default', async () => {
    const inRepo = await browser
      .patch(`${base()}/settings`, { folder: join(REPO_ROOT, 'backups') })
      .expect(422);
    expect(inRepo.body.error.code).toBe('hub.backups.folder_in_repo');
    const relative = await browser.patch(`${base()}/settings`, { folder: 'HubBackups' }).expect(422);
    expect(relative.body.error.code).toBe('hub.backups.folder_invalid');
    const chosen = join(scratchRoot, 'Chosen');
    const saved = await browser
      .patch(`${base()}/settings`, { folder: chosen, time: '04:30', keep: 7 })
      .expect(200);
    expect(saved.body.data).toMatchObject({
      folder: chosen,
      folderSource: 'setting',
      time: '04:30',
      keep: 7,
    });
    const back = await browser.patch(`${base()}/settings`, { folder: null }).expect(200);
    expect(back.body.data).toMatchObject({ folder: backupDir, folderSource: 'default' });
    await browser.patch(`${base()}/settings`, { time: '25:00' }).expect(400);
  });

  it('a backup a restart cut off is failed, not left running', async () => {
    await prisma().backup.create({ data: { trigger: 'manual', startedAt: clock.now(), status: 'running' } });
    expect(await service().markInterrupted()).toBe(1);
    expect((await history()).items[0]).toMatchObject({
      status: 'failed',
      failure: 'Cut off by a restart of Hub',
    });
  });

  describe('pnpm hub:restore', () => {
    const state = readE2eState();
    const source = new URL(state.databaseUrl);
    const throwaway = new URL(state.databaseUrl);
    throwaway.pathname = '/hub_restore_e2e';
    let restored: PrismaClient | undefined;
    let health: Server | undefined;

    const container = () =>
      spawnSync('docker', ['ps', '--filter', `publish=${source.port}`, '--format', '{{.Names}}'], {
        encoding: 'utf8',
      })
        .stdout.trim()
        .split(/\r?\n/)[0]!;
    const restore = (args: string[]) =>
      new Promise<{ status: number; out: string }>((done) => {
        const child = spawn(process.execPath, [join(REPO_ROOT, 'scripts/hub-restore.mjs'), ...args], {
          cwd: REPO_ROOT,
        });
        let out = '';
        child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
        child.stderr.on('data', (chunk: Buffer) => (out += chunk.toString()));
        child.on('close', (code) => done({ status: code ?? 1, out }));
      });

    beforeAll(() => {
      const name = container();
      spawnSync('docker', ['exec', name, 'dropdb', '-U', source.username, '--if-exists', 'hub_restore_e2e']);
      const created = spawnSync(
        'docker',
        ['exec', name, 'createdb', '-U', source.username, 'hub_restore_e2e'],
        {
          encoding: 'utf8',
        },
      );
      if (created.status !== 0) throw new Error(`createdb failed: ${created.stderr}`);
    });

    afterAll(async () => {
      await restored?.$disconnect();
      health?.close();
      spawnSync('docker', [
        'exec',
        container(),
        'dropdb',
        '-U',
        source.username,
        '--if-exists',
        'hub_restore_e2e',
      ]);
    });

    it('refuses while Hub answers, and restores into a throwaway database once it does not', async () => {
      await aSavedDoc();
      const started = await backUpNow();
      const row = await prisma().backup.findUniqueOrThrow({ where: { id: started.id } });

      health = createServer((_request, response) => response.end('{"status":"ok"}'));
      await new Promise<void>((ready) => health!.listen(0, '127.0.0.1', ready));
      const liveUrl = `http://127.0.0.1:${(health.address() as AddressInfo).port}`;
      const refused = await restore([
        row.path!,
        '--yes',
        '--database-url',
        throwaway.toString(),
        '--api-url',
        liveUrl,
      ]);
      expect(refused.status).toBe(1);
      expect(refused.out).toContain('Hub is running');
      health.close();
      health = undefined;

      const done = await restore([
        row.path!,
        '--yes',
        '--database-url',
        throwaway.toString(),
        '--api-url',
        'http://127.0.0.1:9',
      ]);
      expect(done.out).toContain('Restored.');
      expect(done.status).toBe(0);
      expect(done.out).toContain(join(row.path!, 'docs'));
      restored = new PrismaClient({ adapter: new PrismaPg({ connectionString: throwaway.toString() }) });
      expect(await restored.workspace.count({ where: { slug } })).toBe(1);
      expect(await restored.docRevision.count()).toBe(1);
      // The backup's own line is in the copy too, still running: it was taken while it ran.
      expect(await restored.backup.count({ where: { id: started.id } })).toBe(1);
    }, 120_000);

    it('says what to give it when the path holds no backup', async () => {
      const missing = mkdtempSync(join(scratchRoot, 'empty-'));
      mkdirSync(join(missing, 'inside'));
      const answer = await restore([
        missing,
        '--yes',
        '--database-url',
        throwaway.toString(),
        '--api-url',
        'http://127.0.0.1:9',
      ]);
      expect(answer.status).toBe(1);
      expect(answer.out).toContain('No backup at');
    });
  });
});
