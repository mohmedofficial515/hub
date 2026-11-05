/**
 * @file Runs the session grace job from its own queue.
 */
import { Injectable } from '@nestjs/common';

import { BaseProcessor, QUEUES, QueueService, type SimpleJob } from '@/infra/queue/queue.service';

import { SESSION_RECONCILE_JOB, type SessionReconcileData, SessionsService } from './sessions.service';

@Injectable()
export class SessionReconcileProcessor extends BaseProcessor<SessionReconcileData> {
  protected readonly queueName = QUEUES.sessions;

  constructor(
    queues: QueueService,
    private readonly sessions: SessionsService,
  ) {
    super(queues);
  }

  async process(job: SimpleJob<SessionReconcileData>): Promise<void> {
    if (job.name === SESSION_RECONCILE_JOB) await this.sessions.reconcile(job.data);
  }
}
