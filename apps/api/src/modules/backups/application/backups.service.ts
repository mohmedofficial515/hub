/**
 * @file Backups of the main machine (docs/16 §10, D61 to D63): run one, list the history, keep (pin), delete, the settings, and the retention rule.
 * @description One backup at a time, as a folder under the owner's backup folder: `hub.dump` (`pg_dump --format=custom`), `docs/` with
 * the current text of each document Hub wrote through `save_doc` (their earlier texts are in the dump, as revisions), and `manifest.json`.
 * It is written as `<name>.partial` and renamed when complete, so a folder without the suffix is always whole. `.env`, the device
 * credentials and the Claude sign-in are never read. A row is never removed: deleting removes the folder and marks the row.
 */
import { existsSync, realpathSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';

import {
  BACKUP_DEFAULTS,
  BACKUP_LIMITS,
  type BackupDto,
  type BackupsDto,
  type BackupSettingsDto,
  type BackupSettingsInput,
  type BackupTrigger,
  isLowDisk,
  localPathSourceConfigSchema,
  type MemberActor,
} from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { runUnscoped } from '@/infra/prisma/workspace-scope';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { NotificationWriter } from '@/modules/notifications';
import { AppException } from '@/shared/errors';

import {
  backupFolderName,
  insideGitCheckout,
  isBackupFolderName,
  isUsableFolder,
  nextNightly,
  retentionVictims,
} from '../domain/backup-rules';
import { BackupMachine } from './backup-machine';

const MANIFEST_FORMAT = 1;

interface BackupRow {
  id: string;
  status: string;
  trigger: string;
  slotAt: Date | null;
  path: string | null;
  sizeBytes: bigint | null;
  docs: number | null;
  pinned: boolean;
  failure: string | null;
  startedAt: Date;
  endedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
}

/** Everything under a folder, in bytes. */
async function sizeOf(path: string): Promise<number> {
  const info = await stat(path);
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const entry of await readdir(path)) total += await sizeOf(join(path, entry));
  return total;
}

function machineTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  /** The backup running in this process, so a test or a shutdown can wait for it. */
  private current: Promise<void> | null = null;

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly machine: BackupMachine,
    private readonly audit: AuditService,
    private readonly notices: NotificationWriter,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get timezone(): string {
    return machineTimezone();
  }

  /** `HUB_BACKUP_DIR`, else `HubBackups` at the root of the drive Hub runs from (D61: drive F on the owner's machine). */
  defaultFolder(): string {
    if (this.config.HUB_BACKUP_DIR) return resolve(this.config.HUB_BACKUP_DIR);
    return join(parse(resolve(process.cwd())).root, 'HubBackups');
  }

  async settings(): Promise<BackupSettingsDto> {
    const row = await this.txHost.tx.backupSettings.findUnique({ where: { id: 1 } });
    const defaultFolder = this.defaultFolder();
    return {
      folder: row?.folder ?? defaultFolder,
      folderSource: row?.folder ? 'setting' : 'default',
      defaultFolder,
      time: row?.time ?? BACKUP_DEFAULTS.time,
      keep: row?.keep ?? BACKUP_DEFAULTS.keep,
      enabled: row?.enabled ?? BACKUP_DEFAULTS.enabled,
      timezone: this.timezone,
    };
  }

  /** A folder the owner may choose: absolute, not a drive root, and outside every Git checkout. */
  checkFolder(folder: string): string {
    if (!isUsableFolder(folder)) throw new AppException('hub.backups.folder_invalid');
    const full = resolve(folder);
    if (insideGitCheckout(full, existsSync)) throw new AppException('hub.backups.folder_in_repo');
    return full;
  }

  async updateSettings(actor: MemberActor, input: BackupSettingsInput): Promise<BackupSettingsDto> {
    const folder =
      input.folder === undefined ? undefined : input.folder === null ? null : this.checkFolder(input.folder);
    const data = {
      ...(folder !== undefined ? { folder } : {}),
      ...(input.time !== undefined ? { time: input.time } : {}),
      ...(input.keep !== undefined ? { keep: input.keep } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    };
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.backupSettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...data },
        update: data,
      });
      await this.audit.record(actor, {
        action: 'backups.settings.update',
        targetType: 'backup_settings',
        targetId: null,
        summary: `Changed the backup settings: ${Object.keys(data).join(', ') || 'nothing'}`,
      });
    });
    // Fewer to keep applies at once, to unpinned backups only.
    if (input.keep !== undefined) await this.applyRetention();
    return this.settings();
  }

  async list(): Promise<BackupsDto> {
    const [rows, settings] = await Promise.all([
      this.txHost.tx.backup.findMany({ orderBy: { startedAt: 'desc' }, take: BACKUP_LIMITS.historyMax }),
      this.settings(),
    ]);
    const disk = await this.machine.disk(settings.folder);
    return {
      items: rows.map((row) => this.toDto(row)),
      settings,
      disk: disk ? { ...disk, low: isLowDisk(disk.freeBytes, disk.totalBytes) } : null,
      nextAt: settings.enabled
        ? nextNightly(this.clock.now(), settings.time, settings.timezone).toISOString()
        : null,
      running: rows.some((row) => row.status === 'running'),
    };
  }

  /** The last finished backup, for the System tab. */
  async latest(): Promise<{ lastAt: string | null; sizeBytes: number | null }> {
    const row = await this.txHost.tx.backup.findFirst({
      where: { status: 'done', deletedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    return {
      lastAt: row?.endedAt?.toISOString() ?? null,
      sizeBytes: row?.sizeBytes === null || row?.sizeBytes === undefined ? null : Number(row.sizeBytes),
    };
  }

  /** "Back up now": answers with the running row; the page follows it to the end. */
  async runNow(actor: MemberActor): Promise<BackupDto> {
    const row = await this.begin('manual', null, actor.userId);
    await this.audit.record(actor, {
      action: 'backups.run',
      targetType: 'backup',
      targetId: row.id,
      summary: 'Started a backup',
    });
    this.track(this.execute(row));
    return this.toDto(row);
  }

  /** A nightly run from the scheduler. Resolves when it has finished, either way. */
  async runScheduled(trigger: Exclude<BackupTrigger, 'manual'>, slotAt: Date): Promise<BackupDto> {
    const row = await this.begin(trigger, slotAt, null);
    const done = this.execute(row);
    this.track(done);
    await done;
    return this.byId(row.id);
  }

  /** Waits for the backup running in this process, if any. */
  async idle(): Promise<void> {
    while (this.current) await this.current;
  }

  async pin(actor: MemberActor, id: string, pinned: boolean): Promise<BackupDto> {
    const row = await this.find(id);
    if (row.status !== 'done' || row.deletedAt) throw new AppException('hub.backups.wrong_state');
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.backup.update({ where: { id }, data: { pinned } });
      await this.audit.record(actor, {
        action: pinned ? 'backups.pin' : 'backups.unpin',
        targetType: 'backup',
        targetId: id,
        summary: pinned ? 'Kept a backup forever' : 'Let the retention rule handle a backup again',
      });
    });
    if (!pinned) await this.applyRetention();
    return this.byId(id);
  }

  /** The owner's press: the folder goes, the row stays, marked. */
  async remove(actor: MemberActor, id: string): Promise<BackupDto> {
    const row = await this.find(id);
    if (row.status === 'running' || row.deletedAt) throw new AppException('hub.backups.wrong_state');
    await this.removeFiles(row);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.backup.update({
        where: { id },
        data: { deletedAt: this.clock.now(), deletedBy: 'owner', deletedById: actor.userId, pinned: false },
      });
      await this.audit.record(actor, {
        action: 'backups.delete',
        targetType: 'backup',
        targetId: id,
        summary: `Deleted the backup of ${row.startedAt.toISOString()}`,
      });
    });
    return this.byId(id);
  }

  /** Removes the folders of the unpinned backups past the newest `keep`. */
  async applyRetention(): Promise<number> {
    const { keep } = await this.settings();
    const rows = await this.txHost.tx.backup.findMany({
      where: { status: 'done', deletedAt: null, pinned: false },
    });
    const victims = retentionVictims(rows, keep);
    for (const row of victims) {
      await this.removeFiles(row).catch((error: unknown) =>
        this.logger.warn(`Retention could not remove ${row.path ?? row.id}: ${String(error)}`),
      );
      await this.txHost.tx.backup.update({
        where: { id: row.id },
        data: { deletedAt: this.clock.now(), deletedBy: 'retention' },
      });
    }
    return victims.length;
  }

  /** At boot: a backup this process never finished was cut off by the restart. */
  async markInterrupted(): Promise<number> {
    const cut = await this.txHost.tx.backup.updateMany({
      where: { status: 'running' },
      data: { status: 'failed', failure: 'Cut off by a restart of Hub', endedAt: this.clock.now() },
    });
    return cut.count;
  }

  /** Whether the night of `slotAt` already has its run, whatever its outcome: a failed night is not retried by itself. */
  async hasSlot(slotAt: Date): Promise<boolean> {
    return (
      (await this.txHost.tx.backup.count({
        where: { slotAt, trigger: { in: ['scheduled', 'catch_up'] } },
      })) > 0
    );
  }

  // ── Running one ─────────────────────────────────────────────────────────────────────────────

  private track(work: Promise<void>): void {
    const tracked = work.finally(() => {
      if (this.current === tracked) this.current = null;
    });
    this.current = tracked;
  }

  private async begin(
    trigger: BackupTrigger,
    slotAt: Date | null,
    userId: string | null,
  ): Promise<BackupRow> {
    return this.txHost.withTransaction(async () => {
      // One at a time: the row is the lock, read and written in one transaction.
      await this.txHost.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hub.backups'))`;
      if ((await this.txHost.tx.backup.count({ where: { status: 'running' } })) > 0) {
        throw new AppException('hub.backups.running');
      }
      return this.txHost.tx.backup.create({
        data: { trigger, slotAt, startedById: userId, startedAt: this.clock.now(), status: 'running' },
      });
    });
  }

  private async execute(row: BackupRow): Promise<void> {
    const settings = await this.settings();
    const final = join(settings.folder, backupFolderName(row.startedAt, row.id));
    const partial = `${final}.partial`;
    try {
      this.checkFolder(settings.folder);
      await mkdir(partial, { recursive: true });
      await this.machine.dump(join(partial, 'hub.dump'));
      const docs = await this.copyDocs(join(partial, 'docs'));
      await writeFile(
        join(partial, 'manifest.json'),
        `${JSON.stringify(
          {
            format: MANIFEST_FORMAT,
            hub: 'Hub backup (docs/16 D61 to D63)',
            id: row.id,
            trigger: row.trigger,
            startedAt: row.startedAt.toISOString(),
            database: { file: 'hub.dump', format: 'pg_dump --format=custom' },
            docs,
            notIncluded: [
              '.env and every secret: Hub keeps none in its database',
              'device credentials (~/.hub on each device)',
              'the Claude Code sign-in',
              'Git repositories: they live in Git',
            ],
            restore:
              'pnpm hub:restore <this folder>   (stop Hub first; see docs/13 and docs/16 "Slice 6 as built")',
          },
          null,
          2,
        )}\n`,
      );
      await rename(partial, final);
      const sizeBytes = await sizeOf(final);
      await this.txHost.tx.backup.update({
        where: { id: row.id },
        data: {
          status: 'done',
          path: final,
          sizeBytes: BigInt(sizeBytes),
          docs: docs.length,
          endedAt: this.clock.now(),
        },
      });
      await this.applyRetention();
    } catch (error) {
      const failure = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await rm(partial, { recursive: true, force: true }).catch(() => undefined);
      await this.txHost.tx.backup.update({
        where: { id: row.id },
        data: { status: 'failed', failure, endedAt: this.clock.now() },
      });
      this.logger.warn(`A backup failed: ${failure}`);
      if (row.trigger !== 'manual') await this.noticeFailure(failure);
    }
  }

  /**
   * The current text of each document Hub has written (a doc with at least one revision), when its folder is on this machine.
   * Paths are checked against their source's folder, as `save_doc` checks them.
   */
  private async copyDocs(target: string): Promise<{ project: string; source: string; path: string }[]> {
    const copied: { project: string; source: string; path: string }[] = [];
    await runUnscoped('a backup copies the documents Hub wrote, in every project', async () => {
      const revised = await this.txHost.tx.docRevision.findMany({
        distinct: ['docCardId'],
        select: { docCardId: true },
      });
      if (revised.length === 0) return;
      const details = await this.txHost.tx.docDetail.findMany({
        where: { cardId: { in: revised.map((row) => row.docCardId) } },
        select: { path: true, sourceId: true, card: { select: { workspaceId: true } } },
      });
      const sources = await this.txHost.tx.source.findMany({
        where: { id: { in: [...new Set(details.map((detail) => detail.sourceId))] } },
        select: { id: true, name: true, config: true, workspaceId: true },
      });
      const workspaces = await this.txHost.tx.workspace.findMany({
        where: { id: { in: [...new Set(sources.map((source) => source.workspaceId))] } },
        select: { id: true, slug: true },
      });
      for (const detail of details) {
        const source = sources.find((row) => row.id === detail.sourceId);
        const config = localPathSourceConfigSchema.safeParse(source?.config);
        if (!source || !config.success || config.data.deviceId) continue;
        const root = resolve(config.data.path);
        const file = resolve(root, detail.path);
        const inside = relative(root, file);
        if (!inside || inside.startsWith('..') || isAbsolute(inside) || !existsSync(file)) continue;
        // A link out of the folder is not followed.
        if (relative(realpathSync(root), realpathSync(file)).startsWith('..')) continue;
        const project = workspaces.find((row) => row.id === source.workspaceId)?.slug ?? source.workspaceId;
        const destination = join(target, project, source.name, ...detail.path.split('/'));
        await mkdir(dirname(destination), { recursive: true });
        await copyFile(file, destination);
        copied.push({ project, source: source.name, path: detail.path });
      }
    });
    return copied;
  }

  /** A nightly failure reaches every owner's inbox once, in their first project. */
  private async noticeFailure(reason: string): Promise<void> {
    try {
      const owners = await runUnscoped(
        'a backup failure is told to every owner',
        async () =>
          await this.txHost.tx.membership.findMany({
            where: { roles: { has: 'owner' }, status: 'active' },
            orderBy: { joinedAt: 'asc' },
            select: { userId: true, workspaceId: true },
          }),
      );
      const firstOf = new Map<string, string>();
      for (const row of owners) if (!firstOf.has(row.userId)) firstOf.set(row.userId, row.workspaceId);
      for (const [userId, workspaceId] of firstOf) {
        const envelopes = await this.notices.deliver({ workspaceId, actorId: null, params: { reason } }, [
          {
            kind: 'system',
            i18nKey: 'backup_failed',
            userIds: [userId],
            link: { view: 'settings', query: { tab: 'backups' } },
            params: { reason },
          },
        ]);
        for (const envelope of envelopes) await this.realtime.publishEnvelope(workspaceId, envelope);
      }
    } catch (error) {
      this.logger.warn(`The backup failure notice could not be written: ${String(error)}`);
    }
  }

  /** Only a folder named by Hub's rule is removed. */
  private async removeFiles(row: Pick<BackupRow, 'path'>): Promise<void> {
    if (!row.path || !isBackupFolderName(basename(row.path))) return;
    await rm(row.path, { recursive: true, force: true });
  }

  private async find(id: string): Promise<BackupRow> {
    const row = /^[0-9a-f-]{36}$/i.test(id)
      ? await this.txHost.tx.backup.findUnique({ where: { id } })
      : null;
    if (!row) throw new AppException('hub.backups.not_found');
    return row;
  }

  private async byId(id: string): Promise<BackupDto> {
    return this.toDto(await this.find(id));
  }

  private toDto(row: BackupRow): BackupDto {
    return {
      id: row.id,
      status: row.status as BackupDto['status'],
      trigger: row.trigger as BackupDto['trigger'],
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
      path: row.path,
      sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
      docs: row.docs,
      pinned: row.pinned,
      failure: row.failure,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      deletedBy: (row.deletedBy as BackupDto['deletedBy']) ?? null,
      missing: row.status === 'done' && !row.deletedAt && !!row.path && !existsSync(row.path),
    };
  }
}
