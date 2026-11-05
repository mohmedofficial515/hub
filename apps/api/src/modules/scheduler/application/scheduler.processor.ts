/**
 * @file `scheduler.tick` every five minutes (docs/07 §5). One repeating job walks the projects, so a new project
 * needs no registration.
 */
import { Injectable } from '@nestjs/common';

import { BaseProcessor, QUEUES, QueueService, type SimpleJob } from '@/infra/queue/queue.service';

import { SchedulerService } from './scheduler.service';

const TICK_MS = 5 * 60 * 1000;

@Injectable()
export class SchedulerProcessor extends BaseProcessor {
  protected readonly queueName = QUEUES.reminders;

  constructor(
    queues: QueueService,
    private readonly scheduler: SchedulerService,
  ) {
    super(queues);
  }

  override onModuleInit(): void {
    super.onModuleInit();
    this.queues.schedule(this.queueName, 'scheduler-tick', 'tick', TICK_MS);
  }

  async process(_job: SimpleJob): Promise<void> {
    await this.scheduler.tickAll();
  }
}
