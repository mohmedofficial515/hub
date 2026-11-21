/**
 * @file Runs a `local_path` source (docs/15 §3): docs into the index, the lab into redesign cards. One run, one
 * `capture_runs` row, and the source records how it went, which is what Today and the system page read.
 * @description Three failures in a row tell owner and pm once (H2-07). The error text a member sees is short and names
 * no secret. A GitHub kind waits for its token, so it says so instead of pretending.
 */
import type { LocalPathSourceConfig, SystemActor } from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { DocsIndexerService } from '@/modules/docs';
import { NotificationWriter } from '@/modules/notifications';
import { LabFilesService, LabScannerService } from '@/modules/redesign';
import { SettingsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';

const FAILURES_BEFORE_ALERT = 3;
const STALE_RUN_MS = 10 * 60 * 1000;

interface SourceRow {
  id: string;
  workspaceId: string;
  name: string;
  kind: string;
  enabled: boolean;
  config: unknown;
  cursor: unknown;
  lastRunAt: Date | null;
}

type Purpose = 'docs' | 'lab';

const purposeOf = (source: Pick<SourceRow, 'config'>): Purpose =>
  (source.config as { purpose?: string }).purpose === 'lab' ? 'lab' : 'docs';

const isDeleted = (source: Pick<SourceRow, 'config'>): boolean =>
  typeof (source.config as { deletedAt?: unknown }).deletedAt === 'string';

@Injectable()
export class SourceRunnerService {
  private readonly logger = new Logger(SourceRunnerService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly indexer: DocsIndexerService,
    private readonly scanner: LabScannerService,
    private readonly lab: LabFilesService,
    private readonly settings: SettingsService,
    private readonly writer: NotificationWriter,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async found(workspaceId: string, id: string): Promise<SourceRow> {
    const source = await this.txHost.tx.source.findUnique({ where: { id, workspaceId } });
    if (!source || isDeleted(source)) throw new AppException('hub.common.not_found');
    return source;
  }

  /** The sources of this project that serve a purpose: for "reindex" and "rescan". */
  async sourcesFor(workspaceId: string, purpose: Purpose): Promise<SourceRow[]> {
    const rows = await this.txHost.tx.source.findMany({
      where: { workspaceId, kind: 'local_path', enabled: true },
    });
    return rows.filter((row) => purposeOf(row) === purpose && !isDeleted(row));
  }

  /** Opens the run. A run already going refuses a second, for this source. */
  async open(workspaceId: string, sourceId: string): Promise<string> {
    const source = await this.found(workspaceId, sourceId);
    if (source.kind !== 'local_path') {
      throw new AppException('hub.workspaces.source_connection_failed', {
        details: { reason: 'not_available_in_this_release' },
      });
    }
    const since = new Date(this.clock.now().getTime() - STALE_RUN_MS);
    const running = await this.txHost.tx.captureRun.count({
      where: { sourceId, status: 'running', startedAt: { gte: since } },
    });
    if (running > 0) throw new AppException('hub.docs.reindex_running');
    const run = await this.txHost.tx.captureRun.create({
      data: {
        sourceId,
        kind: purposeOf(source) === 'lab' ? 'lab_scan' : 'docs_index',
        startedAt: this.clock.now(),
        cursorBefore: source.cursor as Prisma.InputJsonValue,
      },
    });
    return run.id;
  }

  private async execute(
    source: SourceRow,
  ): Promise<{ created: number; updated: number; cursor: Prisma.InputJsonValue; note?: string }> {
    if (purposeOf(source) === 'lab') {
      const location = await this.lab.locate(source.workspaceId);
      if (!location) throw new AppException('hub.redesign.lab_unavailable');
      const result = await this.scanner.scan(source.workspaceId, location, source.cursor ?? {});
      return {
        created: result.created,
        updated: result.updated + result.missing,
        cursor: result.cursor as unknown as Prisma.InputJsonValue,
        ...(result.problems.length > 0 ? { note: `${result.problems.length} versions left out` } : {}),
      };
    }
    const result = await this.indexer.index({
      id: source.id,
      name: source.name,
      workspaceId: source.workspaceId,
      config: source.config as LocalPathSourceConfig,
    });
    await this.realtime.publishEnvelope(source.workspaceId, {
      event: 'docs.indexed',
      data: {
        sourceId: source.id,
        created: result.created,
        updated: result.updated,
        removed: result.removed,
      },
      audience: 'all',
    });
    return {
      created: result.created,
      updated: result.updated + result.removed,
      cursor: { withheld: result.withheld } as Prisma.InputJsonValue,
      ...(result.withheld.length > 0
        ? { note: `${result.withheld.length} files left out: possible secret` }
        : {}),
    };
  }

  /** Does the work of an opened run. Never throws: a failure is recorded on the run and the source. */
  async finish(workspaceId: string, runId: string): Promise<void> {
    const run = await this.txHost.tx.captureRun.findUniqueOrThrow({ where: { id: runId } });
    const source = await this.found(workspaceId, run.sourceId);
    await this.tell(source, 'running', 0, 0);
    try {
      const outcome = await this.execute(source);
      const now = this.clock.now();
      await this.txHost.tx.captureRun.update({
        where: { id: runId },
        data: {
          status: 'ok',
          finishedAt: now,
          created: outcome.created,
          updated: outcome.updated,
          cursorAfter: outcome.cursor,
          error: outcome.note ?? null,
        },
      });
      await this.txHost.tx.source.update({
        where: { id: source.id, workspaceId },
        data: { lastRunAt: now, lastSuccessAt: now, lastError: null, cursor: outcome.cursor },
      });
      await this.tell(source, 'ok', outcome.created, outcome.updated);
    } catch (error) {
      await this.fail(source, runId, error);
    }
  }

  private async fail(source: SourceRow, runId: string, error: unknown): Promise<void> {
    const message = error instanceof AppException ? error.code : 'The folder could not be read';
    this.logger.warn(`Source ${source.name}: ${String(error)}`);
    const now = this.clock.now();
    await this.txHost.tx.captureRun.update({
      where: { id: runId },
      data: { status: 'failed', finishedAt: now, error: message },
    });
    await this.txHost.tx.source.update({
      where: { id: source.id, workspaceId: source.workspaceId },
      data: { lastRunAt: now, lastError: message },
    });
    await this.tell(source, 'failed', 0, 0);
    if ((await this.consecutiveFailures(source.id)) === FAILURES_BEFORE_ALERT) {
      const envelopes = await this.txHost.withTransaction(() =>
        this.writer.deliver(
          { workspaceId: source.workspaceId, actorId: null, params: { name: source.name } },
          [
            {
              kind: 'system',
              i18nKey: 'source_failing',
              roles: ['owner', 'pm'],
              link: { view: 'settings', query: { tab: 'sources' } },
            },
          ],
        ),
      );
      for (const envelope of envelopes) await this.realtime.publishEnvelope(source.workspaceId, envelope);
    }
  }

  async consecutiveFailures(sourceId: string): Promise<number> {
    const runs = await this.txHost.tx.captureRun.findMany({
      where: { sourceId, status: { not: 'running' } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: { status: true },
    });
    const first = runs.findIndex((run) => run.status !== 'failed');
    return first === -1 ? runs.length : first;
  }

  private tell(source: SourceRow, status: string, created: number, updated: number): Promise<void> {
    return this.realtime.publishEnvelope(source.workspaceId, {
      event: 'source.run',
      data: { sourceId: source.id, status, created, updated },
      audience: { roles: ['owner', 'pm'] },
    });
  }

  /** The tick: every enabled local source whose interval has passed. */
  async runDue(): Promise<number> {
    const sources = await this.dueSources();
    let done = 0;
    for (const source of sources) {
      try {
        await this.finish(source.workspaceId, await this.open(source.workspaceId, source.id));
        done += 1;
      } catch (error) {
        this.logger.warn(`Could not run ${source.name}: ${String(error)}`);
      }
    }
    return done;
  }

  private async dueSources(): Promise<SourceRow[]> {
    const workspaces = await this.txHost.tx.workspace.findMany({
      where: { status: { not: 'closed' } },
      select: { id: true },
    });
    const due: SourceRow[] = [];
    const now = this.clock.now().getTime();
    for (const { id } of workspaces) {
      const rows = await this.txHost.tx.source.findMany({
        where: { workspaceId: id, kind: 'local_path', enabled: true },
      });
      for (const row of rows.filter((candidate) => !isDeleted(candidate))) {
        const seconds =
          purposeOf(row) === 'lab'
            ? await this.settings.value(id, 'capture.lab.interval_sec')
            : await this.settings.value(id, 'capture.docs.interval_sec');
        if (!row.lastRunAt || row.lastRunAt.getTime() + seconds * 1000 <= now) due.push(row);
      }
    }
    return due;
  }

  async runs(actor: SystemActor | { workspaceId: string }, sourceId: string | undefined, limit = 50) {
    const sources = await this.txHost.tx.source.findMany({
      where: { workspaceId: actor.workspaceId, ...(sourceId ? { id: sourceId } : {}) },
      select: { id: true, name: true },
    });
    const names = new Map(sources.map((source) => [source.id, source.name]));
    const rows = await this.txHost.tx.captureRun.findMany({
      where: { sourceId: { in: [...names.keys()] } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: limit,
      select: {
        id: true,
        sourceId: true,
        kind: true,
        startedAt: true,
        finishedAt: true,
        status: true,
        created: true,
        updated: true,
        error: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      sourceName: names.get(row.sourceId) ?? '',
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    }));
  }
}
