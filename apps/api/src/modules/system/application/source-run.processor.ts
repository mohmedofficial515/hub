/**
 * @file The worker's side of sources: runs what is due every minute and what someone asked for, and says it is alive.
 */
import { Injectable } from '@nestjs/common';

import { BaseProcessor, QUEUES, QueueService, type SimpleJob } from '@/infra/queue/queue.service';
import { RedisClients } from '@/infra/redis/redis.module';

import { SourceRunnerService } from './source-runner.service';

export const WORKER_HEARTBEAT_KEY = 'worker:heartbeat';
const TICK_MS = 60_000;

export interface RunJob {
  readonly workspaceId?: string;
  readonly runId?: string;
}

@Injectable()
export class SourceRunProcessor extends BaseProcessor<RunJob> {
  protected readonly queueName = QUEUES.capture;

  constructor(
    queues: QueueService,
    private readonly runner: SourceRunnerService,
    private readonly redis: RedisClients,
  ) {
    super(queues);
  }

  override onModuleInit(): void {
    super.onModuleInit();
    this.queues.schedule(this.queueName, 'sources-due', 'due', TICK_MS);
  }

  async process(job: SimpleJob<RunJob>): Promise<void> {
    if (job.data?.runId && job.data.workspaceId) {
      await this.runner.finish(job.data.workspaceId, job.data.runId);
      return;
    }
    await this.redis.main.set(WORKER_HEARTBEAT_KEY, new Date().toISOString());
    await this.runner.runDue();
  }
}
