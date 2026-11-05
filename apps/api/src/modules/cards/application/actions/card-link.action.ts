/**
 * @file Link and unlink (docs/04 §3.8): one row, and one event on each card.
 * @description `blocks` and `parent` must not loop. The other card's event comes from a trusted follow-up marked
 * `mirror`, which writes no row. It is locked in the same transaction, so a blocked flag is never half true.
 */
import { LINK_INPUT_KINDS, linkInputSchema } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppException } from '@/shared/errors';

import type {
  CardActionContext,
  CardActionDefinition,
  CardActionPlan,
  CardView,
} from '../../domain/card-action';
import {
  inverseLinkKind,
  isDirected,
  type StoredLink,
  toStoredLink,
  wouldCreateCycle,
} from '../../domain/links';
import { CardActionHandler } from '../card-action.registry';
import { CardRepository } from '../ports/card.repository';

export const cardLinkPayloadSchema = linkInputSchema.extend({
  op: z.enum(['add', 'remove']),
  /** Internal: this is the event on the other end. A client body never carries it. */
  mirror: z.boolean().optional(),
});
type LinkPayload = z.infer<typeof cardLinkPayloadSchema>;

@Injectable()
@CardActionHandler()
export class CardLinkAction implements CardActionDefinition<LinkPayload> {
  readonly action = 'card.link';
  readonly payload = cardLinkPayloadSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload }: CardActionContext<LinkPayload>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.link needs a card');
    const kind = payload.op === 'add' ? 'linked' : 'unlinked';
    const event = { kind, data: { kind: payload.kind, otherCardKey: payload.key } } as const;
    if (payload.mirror) return { event };

    if (payload.key === card.key) throw new AppException('hub.cards.link_self');
    const other = await this.cards.findCard(actor.workspaceId, { cardKey: payload.key });
    if (!other || other.archivedAt) throw new AppException('hub.cards.not_found');

    const edge = toStoredLink(payload.kind, card.id, other.id);
    return {
      event,
      write: payload.op === 'add' ? () => this.add(card, edge, actor.userId) : () => this.remove(card, edge),
      followUps: () => [
        {
          action: 'card.link',
          target: { cardId: other.id },
          payload: { op: payload.op, kind: inverseLinkKind(payload.kind), key: card.key, mirror: true },
          trusted: true,
        },
      ],
    };
  }

  private async add(card: CardView, edge: StoredLink, createdById: string | null): Promise<void> {
    const reversed = { fromCardId: edge.toCardId, toCardId: edge.fromCardId, kind: edge.kind };
    const exists =
      (await this.cards.findLink(card, edge)) ||
      (!isDirected(edge.kind) && (await this.cards.findLink(card, reversed)));
    if (exists) throw new AppException('hub.cards.link_exists');
    if (isDirected(edge.kind)) {
      const loops = await wouldCreateCycle(edge.fromCardId, edge.toCardId, (ids) =>
        this.cards.findLinkTargets(card, ids, edge.kind),
      );
      if (loops) throw new AppException('hub.cards.link_cycle');
    }
    await this.cards.insertLink(card, edge, createdById);
  }

  private async remove(card: CardView, edge: StoredLink): Promise<void> {
    const reversed = { fromCardId: edge.toCardId, toCardId: edge.fromCardId, kind: edge.kind };
    if (await this.cards.findLink(card, edge)) {
      await this.cards.deleteLink(card, edge);
    } else if (!isDirected(edge.kind) && (await this.cards.findLink(card, reversed))) {
      await this.cards.deleteLink(card, reversed);
    } else {
      throw new AppException('hub.common.not_found');
    }
  }
}

export { LINK_INPUT_KINDS };
