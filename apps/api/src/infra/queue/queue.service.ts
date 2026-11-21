/**
 * @file BullMQ wrapper: named queues, processors, the PROCESS_ROLE gate and inline mode.
 * @description Thin on purpose. Queues open on first use, so the OpenAPI export needs no Redis. Workers
 * start only where PROCESS_ROLE is worker or all. `QUEUE_MODE=inline` runs a job in the caller's process,
 * for deterministic tests (docs/11 §1.1). To add work: extend `BaseProcessor` and add it to a module.
 */
import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { type Job, type JobsOptions, Queue, Worker } from 'bullmq';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

/** Every queue, so names stay in one place. */
export const QUEUES = {
  outbox: 'hub-outbox',
  capture: 'hub-capture',
  sessions: 'hub-sessions',
  digests: 'hub-digests',
  reminders: 'hub-reminders',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface SimpleJob<T = unknown> {
  readonly name: string;
  readonly data: T;
}

type JobHandler = (job: SimpleJob) => Promise<void>;

function connectionOf(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class QueueService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers: Worker[] = [];
  private readonly handlers = new Map<QueueName, JobHandler>();
  private readonly schedules: { queue: QueueName; id: string; everyMs: number; name: string }[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get isInline(): boolean {
    return this.config.QUEUE_MODE === 'inline';
  }

  get runsWorkers(): boolean {
    return this.config.PROCESS_ROLE !== 'api' && !this.isInline;
  }

  private queue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: connectionOf(this.config.REDIS_URL) });
      queue.on('error', (error) => this.logger.warn(`Queue ${name}: ${error.message}`));
      this.queues.set(name, queue);
    }
    return queue;
  }

  /** Adds a job. In inline mode the handler runs before this resolves. */
  async add<T>(name: QueueName, jobName: string, data: T, options?: JobsOptions): Promise<void> {
    if (this.isInline) {
      await this.handlers.get(name)?.({ name: jobName, data });
      return;
    }
    await this.queue(name).add(jobName, data, options);
  }

  register(name: QueueName, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  /** For the system page. Inline mode has no queues, so it is all zeros. */
  async counts(name: QueueName): Promise<{
    name: string;
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  }> {
    if (this.isInline) return { name, waiting: 0, active: 0, failed: 0, delayed: 0 };
    const counts = await this.queue(name).getJobCounts('waiting', 'active', 'failed', 'delayed');
    return {
      name,
      waiting: counts['waiting'] ?? 0,
      active: counts['active'] ?? 0,
      failed: counts['failed'] ?? 0,
      delayed: counts['delayed'] ?? 0,
    };
  }

  /** A repeating job, started with the workers. Ignored in inline mode: tests call the work directly. */
  schedule(name: QueueName, id: string, jobName: string, everyMs: number): void {
    this.schedules.push({ queue: name, id, everyMs, name: jobName });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.runsWorkers) return;
    for (const [name, handler] of this.handlers) {
      const worker = new Worker(
        name,
        async (job: Job) => handler({ name: job.name, data: job.data as unknown }),
        {
          connection: connectionOf(this.config.REDIS_URL),
        },
      );
      worker.on('error', (error) => this.logger.warn(`Worker ${name}: ${error.message}`));
      worker.on('failed', (job, error) => this.logger.warn(`Job ${name}/${job?.name}: ${error.message}`));
      this.workers.push(worker);
    }
    for (const entry of this.schedules) {
      await this.queue(entry.queue).upsertJobScheduler(
        entry.id,
        { every: entry.everyMs },
        { name: entry.name },
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}

/** Extend, name the queue, implement `process`. Registers itself when the module starts. */
export abstract class BaseProcessor<T = unknown> implements OnModuleInit {
  protected abstract readonly queueName: QueueName;

  constructor(protected readonly queues: QueueService) {}

  onModuleInit(): void {
    this.queues.register(this.queueName, (job) => this.process(job as SimpleJob<T>));
  }

  abstract process(job: SimpleJob<T>): Promise<void>;
}

@Global()
@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
