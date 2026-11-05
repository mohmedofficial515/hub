/**
 * @file How each enabled source is doing, from its own record and its last runs. Read by Today, the counters and the
 * system page, so "failing" means one thing everywhere (review M4, M5).
 */
import type { SourceDto, SourceHealth } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { SettingsService, SourcesService } from '@/modules/workspaces';

const DAY = 86_400_000;
const LAG_FACTOR = 3;
const ORDER: Readonly<Record<SourceHealth['status'], number>> = {
  failing: 0,
  lagging: 1,
  never_run: 2,
  ok: 3,
};

function targetOf(source: SourceDto): string | null {
  const config = source.config as { path?: string; owner?: string; repo?: string };
  if (config.path) return config.path;
  return config.owner && config.repo ? `${config.owner}/${config.repo}` : null;
}

@Injectable()
export class SourceHealthService {
  constructor(
    private readonly sources: SourcesService,
    private readonly settings: SettingsService,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async intervalSec(workspaceId: string, source: SourceDto): Promise<number> {
    const purpose = (source.config as { purpose?: string }).purpose;
    if (source.kind === 'lab' || purpose === 'lab') {
      return this.settings.value(workspaceId, 'capture.lab.interval_sec');
    }
    if (source.kind === 'docs_folder' || purpose === 'docs') {
      return this.settings.value(workspaceId, 'capture.docs.interval_sec');
    }
    return this.settings.value(workspaceId, 'capture.github.interval_sec');
  }

  async list(workspaceId: string): Promise<SourceHealth[]> {
    const enabled = (await this.sources.list(workspaceId)).filter((source) => source.enabled);
    const since = new Date(this.clock.now().getTime() - DAY);
    const rows = await Promise.all(
      enabled.map(async (source): Promise<SourceHealth> => {
        const runs = await this.txHost.tx.captureRun.findMany({
          where: { sourceId: source.id, startedAt: { gte: since } },
          select: { created: true, updated: true },
        });
        const interval = await this.intervalSec(workspaceId, source);
        const lagging = source.lagSec !== null && source.lagSec > interval * LAG_FACTOR;
        return {
          id: source.id,
          name: source.name,
          kind: source.kind,
          status: source.lastError
            ? 'failing'
            : source.lastSuccessAt === null
              ? 'never_run'
              : lagging
                ? 'lagging'
                : 'ok',
          lagSec: source.lagSec,
          lastSuccessAt: source.lastSuccessAt,
          lastError: source.lastError,
          target: targetOf(source),
          runs24h: runs.length,
          cards24h: runs.reduce((sum, run) => sum + run.created + run.updated, 0),
        };
      }),
    );
    return rows.sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }
}
