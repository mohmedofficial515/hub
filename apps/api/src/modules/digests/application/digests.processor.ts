/**
 * @file Stores what is due every five minutes (docs/07 §5). The times are settings, so nothing re-registers when one changes.
 */
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { BaseProcessor, QUEUES, QueueService, type SimpleJob } from '@/infra/queue/queue.service';

import { BriefsService } from './briefs.service';

const TICK_MS = 5 * 60 * 1000;

@Injectable()
export class DigestsProcessor extends BaseProcessor {
  protected readonly queueName = QUEUES.digests;

  constructor(
    queues: QueueService,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly briefs: BriefsService,
  ) {
    super(queues);
  }

  override onModuleInit(): void {
    super.onModuleInit();
    this.queues.schedule(this.queueName, 'digests-due', 'due', TICK_MS);
  }

  async process(_job: SimpleJob): Promise<void> {
    const workspaces = await this.txHost.tx.workspace.findMany({
      where: { status: { not: 'closed' } },
      select: { id: true },
    });
    for (const workspace of workspaces) await this.briefs.runDue(workspace.id);
  }
}
