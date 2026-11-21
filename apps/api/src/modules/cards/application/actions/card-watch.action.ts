/**
 * @file Watch and unwatch (docs/04 §3.8). Watching what you already watch is not a change.
 */
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import type { CardActionContext, CardActionDefinition, CardActionPlan } from '../../domain/card-action';
import { CardActionHandler } from '../card-action.registry';
import { CardRepository } from '../ports/card.repository';

const watchSchema = z.object({ op: z.enum(['add', 'remove']) });
type WatchInput = z.infer<typeof watchSchema>;

@Injectable()
@CardActionHandler()
export class CardWatchAction implements CardActionDefinition<WatchInput> {
  readonly action = 'card.watch';
  readonly payload = watchSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload }: CardActionContext<WatchInput>): Promise<CardActionPlan> {
    if (!card || !actor.userId) throw new Error('card.watch needs a card and a member');
    const userId = actor.userId;
    const watching = await this.cards.isWatching(card.id, userId);
    if (payload.op === 'add') {
      if (watching) return { noop: true };
      return {
        event: { kind: 'watch', data: { userId, reason: 'manual' } },
        watchers: [{ userId, reason: 'manual' }],
      };
    }
    if (!watching) return { noop: true };
    return {
      event: { kind: 'unwatch', data: { userId } },
      write: async () => {
        await this.cards.removeWatcher(card.id, userId);
      },
    };
  }
}
