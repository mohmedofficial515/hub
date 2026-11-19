/**
 * @file Idea actions (D29, docs/15 §4). "Turn into a plan" creates a linked Plan and moves the idea to accepted.
 */
import {
  type CreateIdeaInput,
  createIdeaSchema,
  type IdeaToPlanInput,
  ideaToPlanSchema,
  type UpdateIdeaInput,
  updateIdeaSchema,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  type CardView,
  linkFollowUps,
  OptionalReasonTransition,
  PlainTransition,
} from '@/modules/cards';
import { StudioSourceCheck } from '@/modules/plans';

@Injectable()
@CardActionHandler()
export class IdeaCreateAction implements CardActionDefinition<CreateIdeaInput> {
  readonly action = 'idea.create';
  readonly payload = createIdeaSchema;

  constructor(private readonly sources: StudioSourceCheck) {}

  async plan({ actor, payload }: CardActionContext<CreateIdeaInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    await this.sources.assertOwn(actor, detail);
    const followUps = linkFollowUps(payload.links);
    return {
      create: { ...baseCreateFields(payload), ownerRole: detail.role ?? null },
      detail: {
        problem: detail.problem ?? null,
        notes: detail.notes ?? null,
        role: detail.role ?? null,
        sourceChatId: detail.sourceChatId ?? null,
        sourceMessageId: detail.sourceMessageId ?? null,
      },
      ...(followUps ? { followUps } : {}),
    };
  }
}

const HEADER_FIELDS = ['title', 'body', 'priority', 'tags'] as const;
const DETAIL_FIELDS = ['problem', 'notes', 'role'] as const;
/** The studio chat a save came from (owner decision 9c): only the writer's own chat, named on the event like any edit. */
const SOURCE_FIELDS = ['sourceChatId', 'sourceMessageId'] as const;

@Injectable()
@CardActionHandler()
export class IdeaUpdateAction implements CardActionDefinition<UpdateIdeaInput> {
  readonly action = 'idea.update';
  readonly payload = updateIdeaSchema;

  constructor(private readonly sources: StudioSourceCheck) {}

  async plan({ actor, card, payload }: CardActionContext<UpdateIdeaInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('idea.update needs a card');
    const header = card as unknown as Record<string, unknown>;
    const detail = card.detail ?? {};
    const changedOf = (fields: readonly (keyof UpdateIdeaInput)[], current: Record<string, unknown>) =>
      fields.filter(
        (field) =>
          payload[field] !== undefined &&
          JSON.stringify(current[field] ?? null) !== JSON.stringify(payload[field] ?? null),
      );
    const headerChanged = changedOf(HEADER_FIELDS, header);
    const detailChanged = changedOf(DETAIL_FIELDS, detail);
    const sourceChanged = changedOf(SOURCE_FIELDS, detail);
    if (headerChanged.length + detailChanged.length + sourceChanged.length === 0) return { noop: true };
    if (sourceChanged.length > 0) {
      await this.sources.assertOwn(actor, {
        ...(sourceChanged.includes('sourceChatId') ? { sourceChatId: payload.sourceChatId } : {}),
        ...(sourceChanged.includes('sourceMessageId')
          ? {
              sourceMessageId: payload.sourceMessageId,
              sourceChatId: payload.sourceChatId ?? (detail['sourceChatId'] as string | null | undefined),
            }
          : {}),
      });
    }
    const pick = (fields: readonly (keyof UpdateIdeaInput)[]) =>
      Object.fromEntries(fields.map((field) => [field, payload[field]]));
    const detailPatch = [...detailChanged, ...sourceChanged];
    return {
      patch: {
        ...pick(headerChanged),
        ...(detailChanged.includes('role') ? { ownerRole: payload.role ?? null } : {}),
      },
      ...(detailPatch.length > 0 ? { detail: pick(detailPatch) } : {}),
      event: {
        kind: 'field_changed',
        data: { changes: [...headerChanged, ...detailChanged, ...sourceChanged].map((field) => ({ field })) },
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class IdeaExploreAction extends PlainTransition {
  readonly action = 'idea.explore';
}

@Injectable()
@CardActionHandler()
export class IdeaAcceptAction extends PlainTransition {
  readonly action = 'idea.accept';
}

@Injectable()
@CardActionHandler()
export class IdeaParkAction extends OptionalReasonTransition {
  readonly action = 'idea.park';
}

@Injectable()
@CardActionHandler()
export class IdeaRejectAction extends OptionalReasonTransition {
  readonly action = 'idea.reject';
}

@Injectable()
@CardActionHandler()
export class IdeaReopenAction extends PlainTransition {
  readonly action = 'idea.reopen';
}

function planBodyFrom(card: CardView): string | undefined {
  const parts = [card.detail?.['problem'], card.detail?.['notes'], card.body].filter(
    (part): part is string => typeof part === 'string' && part.length > 0,
  );
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

@Injectable()
@CardActionHandler()
export class IdeaToPlanAction implements CardActionDefinition<IdeaToPlanInput> {
  readonly action = 'idea.to_plan';
  readonly payload = ideaToPlanSchema;

  constructor(private readonly cards: CardRepository) {}

  plan({ actor, card, payload }: CardActionContext<IdeaToPlanInput>): CardActionPlan {
    if (!card) throw new Error('idea.to_plan needs a card');
    const body = payload.body ?? planBodyFrom(card);
    return {
      event: { kind: 'idea_to_plan' },
      prepare: () => [
        {
          action: 'plan.create',
          target: null,
          payload: {
            title: payload.title ?? card.title,
            ...(body ? { body } : {}),
            priority: card.priority,
            tags: [...card.tags],
            detail: {
              steps: [],
              sourceIdeaKey: card.key,
              ...(payload.sourceChatId ? { sourceChatId: payload.sourceChatId } : {}),
              ...(payload.sourceMessageId ? { sourceMessageId: payload.sourceMessageId } : {}),
            },
          },
          trusted: true,
        },
      ],
      write: async (written, prepared) => {
        const plan = prepared[0]?.card;
        if (!plan) throw new Error('idea.to_plan created no plan');
        await this.cards.updateDetail(written, { planCardId: plan.id });
        await this.cards.insertLink(
          written,
          { fromCardId: written.id, toCardId: plan.id, kind: 'relates' },
          actor.userId,
        );
        return { planKey: plan.key };
      },
    };
  }
}
