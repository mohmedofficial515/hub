/**
 * @file The system page and `/metrics` (docs/04 §3.23, H2-07), as far as local sources go. A value with no source
 * behind it is null, never invented: there is no backup job in this release.
 */
import type { SystemData } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { runUnscoped } from '@/infra/prisma/workspace-scope';
import { QUEUES } from '@/infra/queue/queue.service';
import { QueueService } from '@/infra/queue/queue.service';
import { RedisClients } from '@/infra/redis/redis.module';
import { RealtimeHub } from '@/modules/realtime';
import { LAB_BASE } from '@/modules/redesign';
import { SourcesService } from '@/modules/workspaces';

import { WORKER_HEARTBEAT_KEY } from './source-run.processor';
import { SourceRunnerService } from './source-runner.service';

const WORKER_ALIVE_MS = 5 * 60 * 1000;
const VERSION = process.env['HUB_VERSION'] ?? process.env['npm_package_version'] ?? 'dev';

const label = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

@Injectable()
export class SystemService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly sources: SourcesService,
    private readonly runner: SourceRunnerService,
    private readonly queues: QueueService,
    private readonly redis: RedisClients,
    private readonly hub: RealtimeHub,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async queueCounts(): Promise<SystemData['queues']> {
    try {
      return await Promise.all(Object.values(QUEUES).map((name) => this.queues.counts(name)));
    } catch {
      return [];
    }
  }

  private async outbox(): Promise<SystemData['outbox']> {
    const tx = this.txHost.tx;
    const [pending, failed, oldest] = await Promise.all([
      tx.notificationJob.count({ where: { status: 'pending' } }),
      tx.notificationJob.count({ where: { status: 'failed' } }),
      tx.notificationJob.findFirst({
        where: { status: 'pending' },
        orderBy: { nextAttemptAt: 'asc' },
        select: { nextAttemptAt: true },
      }),
    ]);
    return {
      pending,
      failed,
      oldestPendingAgeSec: oldest
        ? Math.max(0, Math.round((this.clock.now().getTime() - oldest.nextAttemptAt.getTime()) / 1000))
        : null,
    };
  }

  private async worker(): Promise<SystemData['worker']> {
    const last = await this.redis.main.get(WORKER_HEARTBEAT_KEY).catch(() => null);
    return {
      alive: last !== null && this.clock.now().getTime() - Date.parse(last) < WORKER_ALIVE_MS,
      lastHeartbeatAt: last,
    };
  }

  async get(workspaceId: string): Promise<SystemData> {
    const sources = await this.sources.list(workspaceId);
    const [size] = await this.txHost.tx.$queryRaw<
      { size: bigint }[]
    >`SELECT pg_database_size(current_database()) AS size`;
    return {
      version: { api: VERSION, web: VERSION, lab: LAB_BASE },
      sources: await Promise.all(
        sources.map(async (source) => ({
          id: source.id,
          name: source.name,
          kind: source.kind,
          enabled: source.enabled,
          lagSec: source.lagSec,
          lastError: source.lastError,
          lastSuccessAt: source.lastSuccessAt,
          consecutiveFailures: await this.runner.consecutiveFailures(source.id),
        })),
      ),
      queues: await this.queueCounts(),
      outbox: await this.outbox(),
      sse: { connections: this.hub.connectionCount() },
      backup: { lastAt: null, sizeBytes: null },
      db: {
        sizeBytes: Number(size?.size ?? 0),
        cards: await this.txHost.tx.card.count({ where: { workspaceId } }),
        events: await this.txHost.tx.cardEvent.count({ where: { workspaceId } }),
      },
      worker: await this.worker(),
    };
  }

  /** Prometheus text. Hand-written on purpose: a handful of gauges does not earn a dependency. Crosses projects. */
  async metrics(): Promise<string> {
    const lines: string[] = [];
    const gauge = (name: string, help: string, rows: readonly { labels?: string; value: number }[]): void => {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
      for (const row of rows) lines.push(`${name}${row.labels ? `{${row.labels}}` : ''} ${row.value}`);
    };
    const now = this.clock.now().getTime();
    await runUnscoped('metrics sum over every project', async () => {
      const tx = this.txHost.tx;
      gauge('hub_cards_total', 'Cards, deleted ones included', [{ value: await tx.card.count() }]);
      gauge('hub_events_total', 'Card events', [{ value: await tx.cardEvent.count() }]);
      gauge('hub_docs_chunks_total', 'Indexed document chunks', [{ value: await tx.docChunk.count() }]);
      const sources = await tx.source.findMany({
        where: { enabled: true },
        select: { name: true, kind: true, lastSuccessAt: true, lastError: true },
      });
      gauge(
        'hub_source_lag_seconds',
        'Seconds since the last good run',
        sources
          .filter((source) => source.lastSuccessAt)
          .map((source) => ({
            labels: `source="${label(source.name)}",kind="${label(source.kind)}"`,
            value: Math.round((now - (source.lastSuccessAt?.getTime() ?? now)) / 1000),
          })),
      );
      gauge(
        'hub_source_failing',
        '1 when the last run failed',
        sources.map((source) => ({
          labels: `source="${label(source.name)}"`,
          value: source.lastError ? 1 : 0,
        })),
      );
      gauge('hub_outbox_pending', 'Notification jobs waiting', [
        { value: await tx.notificationJob.count({ where: { status: 'pending' } }) },
      ]);
    });
    gauge('hub_sse_connections', 'Open event streams', [{ value: this.hub.connectionCount() }]);
    const worker = await this.worker();
    gauge('hub_worker_alive', '1 when the worker ticked in the last 5 minutes', [
      { value: worker.alive ? 1 : 0 },
    ]);
    gauge(
      'hub_queue_jobs',
      'Jobs by queue and state',
      (await this.queueCounts()).flatMap((queue) =>
        (['waiting', 'active', 'failed', 'delayed'] as const).map((state) => ({
          labels: `queue="${queue.name}",state="${state}"`,
          value: queue[state],
        })),
      ),
    );
    return `${lines.join('\n')}\n`;
  }
}
