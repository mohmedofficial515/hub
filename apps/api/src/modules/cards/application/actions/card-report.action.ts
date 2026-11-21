/**
 * @file A work report on a card (docs/16 §7.2, D52): stored as evidence on the card with its event, and the one place a report can move a task.
 * @description The checks were already judged against real steps by `WorkReportsService`, which is the only caller. This judges what needs the card's lock: a task that may go to In review goes, in the same transaction, recorded as the agent's action with the reason. It only ever goes to In review: nothing here can complete a task.
 */
import { isAllowed, permissionFactsFor, type WorkReport, workReportSchema } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import type { CardActionContext, CardActionDefinition, CardActionPlan } from '../../domain/card-action';
import { CardActionHandler } from '../card-action.registry';

const MOVE_NOTE = 'Moved by the report: every check is verified against a real step that succeeded (D52).';

@Injectable()
@CardActionHandler()
export class CardReportWorkAction implements CardActionDefinition<WorkReport> {
  readonly action = 'card.report_work';
  readonly payload = workReportSchema;

  plan({ actor, card, payload }: CardActionContext<WorkReport>): CardActionPlan {
    if (!card) throw new Error('card.report_work needs a card');
    const move = this.moveOf(payload, card, actor);
    const report: WorkReport = { ...payload, move };
    return {
      event: { kind: 'work_reported', data: report },
      summary: `Work report on ${card.key}: ${payload.counts.verified} of ${payload.counts.total} checks verified${move.moved ? ', moved to In review' : ''}`,
      ...(move.moved
        ? {
            followUps: () => [
              {
                action: 'task.submit_review' as const,
                target: { cardId: card.id },
                payload: { note: MOVE_NOTE },
                // Asked below with the card's facts, so the report still records why it stayed if the matrix says no.
                trusted: true,
              },
            ],
          }
        : {}),
    };
  }

  private moveOf(
    report: WorkReport,
    card: NonNullable<CardActionContext<WorkReport>['card']>,
    actor: CardActionContext<WorkReport>['actor'],
  ): WorkReport['move'] {
    const stays = (reason: WorkReport['move']['reason']) => ({ moved: false, reason, from: null, to: null });
    if (report.move.reason !== 'all_verified') return stays(report.move.reason);
    if (card.type !== 'task') return stays('not_a_task');
    if (card.status !== 'in_progress') return stays('wrong_status');
    const facts = permissionFactsFor(card, actor.userId);
    if (!isAllowed('task.submit_review', actor.roles, facts)) return stays('not_permitted');
    return { moved: true, reason: 'all_verified', from: 'in_progress', to: 'in_review' };
  }
}
