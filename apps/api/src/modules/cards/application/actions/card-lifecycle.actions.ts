/**
 * @file Delete and restore (D28), and the `unblocked` event a dependant gets when a blocker closes.
 * @description Delete maps onto `archived_at`: the card leaves every page, count and search, and its events and
 * audit rows stay (D17). A deleted card stops blocking others.
 */
import { type OptionalReasonInput, optionalReasonSchema } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppException } from '@/shared/errors';

import type { CardActionContext, CardActionDefinition, CardActionPlan } from '../../domain/card-action';
import { CardActionHandler } from '../card-action.registry';
import { CardRepository } from '../ports/card.repository';

@Injectable()
@CardActionHandler()
export class CardDeleteAction implements CardActionDefinition<OptionalReasonInput> {
  readonly action = 'card.delete';
  readonly payload = optionalReasonSchema;

  plan({ payload, now }: CardActionContext<OptionalReasonInput>): CardActionPlan {
    return {
      patch: { archivedAt: now },
      event: { kind: 'archived', data: payload.reason ? { reason: payload.reason } : {} },
      releasesDependants: true,
    };
  }
}

@Injectable()
@CardActionHandler()
export class CardRestoreAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'card.restore';
  readonly payload = z.object({}) as unknown as z.ZodType<Record<string, never>>;
  readonly allowOnDeleted = true;

  plan({ card }: CardActionContext<Record<string, never>>): CardActionPlan {
    if (!card?.archivedAt) throw new AppException('hub.cards.invalid_transition');
    return { patch: { archivedAt: null }, event: { kind: 'restored' } };
  }
}

const unblockSchema = z.object({ byCardKey: z.string() });
type UnblockInput = z.infer<typeof unblockSchema>;

/** Always a trusted follow-up of the action that closed the blocker. Its row belongs to nobody. */
@Injectable()
@CardActionHandler()
export class CardUnblockAction implements CardActionDefinition<UnblockInput> {
  readonly action = 'card.unblock';
  readonly payload = unblockSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ card, payload }: CardActionContext<UnblockInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.unblock needs a card');
    const stillBlocked = await this.cards.hasOpenBlockers(card);
    const watchers = stillBlocked ? [] : await this.cards.findWatcherIds(card.id);
    return {
      event: { kind: 'unblocked', data: { byCardKey: payload.byCardKey } },
      notify: stillBlocked
        ? []
        : [
            {
              kind: 'unblocked',
              i18nKey: 'unblocked',
              userIds: [...(card.assigneeId ? [card.assigneeId] : []), ...watchers],
              params: { byCardKey: payload.byCardKey },
            },
          ],
    };
  }
}
