/**
 * @file What the deadline engine does to a card. System rows, so no route or tool reaches them (docs/04 §2).
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
} from '@/modules/cards';

const remindSchema = z.object({
  reason: z.enum(['before_due', 'overdue', 'stale', 'orphaned_claim']),
  offsetHours: z.number().int().positive().optional(),
  /** A decision's new `remindersSent`. */
  remindersSent: z.array(z.number().int()).optional(),
});
type RemindInput = z.infer<typeof remindSchema>;

/** One `reminder_sent` event; the routing table decides who hears (docs/07 §1). */
@Injectable()
@CardActionHandler()
export class CardRemindAction implements CardActionDefinition<RemindInput> {
  readonly action = 'card.remind';
  readonly payload = remindSchema;

  plan({ payload }: CardActionContext<RemindInput>): CardActionPlan {
    return {
      ...(payload.remindersSent ? { detail: { remindersSent: payload.remindersSent } } : {}),
      event: {
        kind: 'reminder_sent',
        data: {
          reason: payload.reason,
          ...(payload.offsetHours ? { offsetHours: payload.offsetHours } : {}),
        },
      },
      summary: `Reminder (${payload.reason})`,
    };
  }
}

const escalateSchema = z.object({ afterHours: z.number().int().positive() });
type EscalateInput = z.infer<typeof escalateSchema>;

/** After this the pm may decide too: `permissionFactsFor` reads `escalatedToRole` (docs/07 §5.2). */
@Injectable()
@CardActionHandler()
export class DecisionEscalateAction implements CardActionDefinition<EscalateInput> {
  readonly action = 'decision.escalate';
  readonly payload = escalateSchema;

  plan({ now, payload }: CardActionContext<EscalateInput>): CardActionPlan {
    return {
      detail: { escalatedAt: now, escalatedToRole: 'pm' },
      event: { kind: 'escalated', data: { toRole: 'pm', afterHours: payload.afterHours } },
    };
  }
}
