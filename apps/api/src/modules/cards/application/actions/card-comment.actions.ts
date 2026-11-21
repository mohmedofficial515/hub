/**
 * @file Comments: add (mentions notify, the author starts watching), edit own within 15 minutes, redact (docs/04 §3.8).
 * @description `apply` runs the secret filter over the body. Redaction empties the body and the excerpt the event
 * kept, so the text is gone from every read; the `redacted` event records that it happened.
 */
import { type CommentBodyInput, commentBodySchema, type PermissionAction } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppException } from '@/shared/errors';

import type { CardActionContext, CardActionDefinition, CardActionPlan } from '../../domain/card-action';
import { excerptOf, parseMentions } from '../../domain/mentions';
import { CardActionHandler } from '../card-action.registry';
import { CardRepository } from '../ports/card.repository';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
@CardActionHandler()
export class CardCommentAction implements CardActionDefinition<CommentBodyInput> {
  readonly action = 'card.comment';
  readonly payload = commentBodySchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload, now }: CardActionContext<CommentBodyInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.comment needs a card');
    const mentions = parseMentions(payload.body);
    // Only members of this project can be mentioned, so a stray id neither watches nor gets notified.
    const mentioned = await this.cards.findRecipients(card.workspaceId, [], mentions.userIds);
    return {
      event: { kind: 'commented' },
      write: async () => {
        const comment = await this.cards.insertComment({ actor, card, body: payload.body, now });
        return { commentId: comment.id, excerpt: excerptOf(payload.body) };
      },
      watchers: [
        ...mentioned.map((member) => ({ userId: member.userId, reason: 'mention' })),
        ...(actor.userId ? [{ userId: actor.userId, reason: 'commenter' }] : []),
      ],
      notify:
        mentioned.length > 0 || mentions.roles.length > 0
          ? [
              {
                kind: 'mention',
                i18nKey: 'mention',
                userIds: mentioned.map((member) => member.userId),
                roles: mentions.roles,
              },
            ]
          : [],
    };
  }
}

const editSchema = commentBodySchema.extend({ commentId: z.uuid() });
type EditInput = z.infer<typeof editSchema>;

@Injectable()
@CardActionHandler()
export class CardCommentEditAction implements CardActionDefinition<EditInput> {
  readonly action = 'card.comment_edit';
  readonly payload = editSchema;
  // The row's `C` means the comment's author, not the card's creator, so the plan decides.
  permissions(): readonly PermissionAction[] {
    return [];
  }

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload, now }: CardActionContext<EditInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.comment_edit needs a card');
    const comment = await this.cards.findComment(card, payload.commentId);
    if (!comment) throw new AppException('hub.cards.comment_not_found');
    if (comment.authorId !== actor.userId) throw new AppException('hub.cards.comment_not_author');
    if (comment.bodyRedactedAt || now.getTime() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new AppException('hub.cards.comment_not_author', { details: { reason: 'edit_window_closed' } });
    }
    return {
      event: { kind: 'field_changed', data: { changes: [{ field: 'comment', commentId: comment.id }] } },
      write: async () => {
        await this.cards.updateCommentBody(card, comment.id, payload.body, now);
      },
    };
  }
}

const redactSchema = z.object({ commentId: z.uuid() });
type RedactInput = z.infer<typeof redactSchema>;

@Injectable()
@CardActionHandler()
export class CardCommentRedactAction implements CardActionDefinition<RedactInput> {
  readonly action = 'card.comment_redact';
  readonly payload = redactSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ card, payload, now }: CardActionContext<RedactInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('card.comment_redact needs a card');
    const comment = await this.cards.findComment(card, payload.commentId);
    if (!comment) throw new AppException('hub.cards.comment_not_found');
    if (comment.bodyRedactedAt) return { noop: true };
    return {
      event: { kind: 'redacted', data: { commentId: comment.id } },
      write: async () => {
        await this.cards.redactComment(card, comment.id, now);
      },
    };
  }
}
