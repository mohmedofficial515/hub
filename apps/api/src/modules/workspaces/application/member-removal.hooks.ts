/**
 * @file What else happens when a member leaves a project: their claimed tasks go back (docs/04 §3.5).
 * @description Runs after the removal commits. Each task goes through `CardService.apply` as the owner or pm who
 * removed the member, so it gets its own event and audit row and says who caused it. While the `task.unclaim` handler is not registered there is nothing
 * to call, so this does nothing rather than failing the removal.
 */
import type { MemberActor } from '@hub/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardActionRegistry, CardService } from '@/modules/cards';

const OPEN_TASK_STATUSES = ['claimed', 'in_progress'];

@Injectable()
export class MemberRemovalHooks {
  private readonly logger = new Logger(MemberRemovalHooks.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly registry: CardActionRegistry,
  ) {}

  async run(actor: MemberActor, userId: string): Promise<void> {
    if (!this.registry.get('task.unclaim')) return;
    const tasks = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'task',
        assigneeId: userId,
        archivedAt: null,
        status: { in: OPEN_TASK_STATUSES },
      },
      select: { id: true },
    });
    for (const task of tasks) {
      try {
        await this.cards.apply(actor, { cardId: task.id }, 'task.unclaim', {});
      } catch (error) {
        // A task in a state that cannot be unclaimed must not undo a removal that has already committed.
        this.logger.warn(`Could not unclaim ${task.id}: ${String(error)}`);
      }
    }
  }
}
