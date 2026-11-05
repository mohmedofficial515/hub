/**
 * @file Handoff actions (docs/04 §3.13, D25). Owner and pm may acknowledge any; apply stays with the receiving role.
 * @description Applying may create a task, which carries the handoff's prompt and goes to who applied it.
 */
import {
  type AcknowledgeHandoffInput,
  acknowledgeHandoffSchema,
  type ApplyHandoffInput,
  applyHandoffSchema,
  type CreateHandoffInput,
  createHandoffSchema,
  type Role,
  type Specialty,
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
  detailText,
  linkFollowUps,
  ReasonTransition,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

const TITLE_LIMIT = 200;

/** The specialty of a task created for a role. A role with no craft of its own gets `ops`. */
const ROLE_SPECIALTY: Partial<Record<Role, Specialty>> = {
  backend: 'backend',
  frontend: 'frontend',
  designer: 'design',
  qa: 'qa',
};

export function specialtyOfRole(role: string | null | undefined): Specialty {
  return ROLE_SPECIALTY[role as Role] ?? 'ops';
}

@Injectable()
@CardActionHandler()
export class HandoffCreateAction implements CardActionDefinition<CreateHandoffInput> {
  readonly action = 'handoff.create';
  readonly payload = createHandoffSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, payload }: CardActionContext<CreateHandoffInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    const source = detail.sourceKey
      ? await this.cards.findCard(actor.workspaceId, { cardKey: detail.sourceKey })
      : null;
    if (detail.sourceKey && !source) throw new AppException('hub.cards.not_found');
    const followUps = linkFollowUps(payload.links);
    return {
      create: { ...baseCreateFields(payload), ownerRole: detail.toRole },
      detail: {
        kind: detail.kind,
        fromRole: detail.fromRole,
        toRole: detail.toRole,
        severity: detail.severity ?? 'info',
        summary: detail.summary,
        prompt: detail.prompt ?? null,
        payload: detail.payload ?? {},
        sourceCardId: source?.id ?? null,
      },
      ...(followUps ? { followUps } : {}),
      notify: [
        {
          kind: 'routed_handoff',
          i18nKey: 'routed_handoff',
          roles: [detail.toRole],
          data: { action: 'acknowledge' },
        },
      ],
    };
  }
}

@Injectable()
@CardActionHandler()
export class HandoffAcknowledgeAction implements CardActionDefinition<AcknowledgeHandoffInput> {
  readonly action = 'handoff.acknowledge';
  readonly payload = acknowledgeHandoffSchema;
  readonly forbiddenCode = 'hub.handoffs.not_recipient';

  plan({ actor, card, payload, now }: CardActionContext<AcknowledgeHandoffInput>): CardActionPlan {
    if (card?.status === 'acknowledged') throw new AppException('hub.handoffs.already_acknowledged');
    return {
      detail: { acknowledgedById: actor.userId, acknowledgedAt: now },
      event: { kind: 'acknowledged', data: payload.note ? { note: payload.note } : {} },
    };
  }
}

@Injectable()
@CardActionHandler()
export class HandoffApplyAction implements CardActionDefinition<ApplyHandoffInput> {
  readonly action = 'handoff.apply';
  readonly payload = applyHandoffSchema;
  readonly forbiddenCode = 'hub.handoffs.not_recipient';

  constructor(private readonly cards: CardRepository) {}

  private async existingTask(card: CardView, key: string): Promise<CardView> {
    const task = await this.cards.findCard(card.workspaceId, { cardKey: key });
    if (!task || task.archivedAt) throw new AppException('hub.cards.not_found');
    if (task.type !== 'task') throw new AppException('hub.cards.type_mismatch');
    return task;
  }

  private newTaskPayload(card: CardView, input: NonNullable<ApplyHandoffInput['createTask']>) {
    const specialty = input.specialty ?? specialtyOfRole(card.ownerRole);
    return {
      title: input.title ?? `Apply ${card.key}: ${card.title}`.slice(0, TITLE_LIMIT),
      priority: card.priority,
      ownerRole: card.ownerRole,
      assignToActor: true,
      detail: {
        specialty,
        origin: 'handoff',
        prompt: detailText(card, 'prompt') || detailText(card, 'summary', card.title),
      },
    };
  }

  async plan({ actor, card, payload, now }: CardActionContext<ApplyHandoffInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('handoff.apply needs a card');
    const existing = payload.taskKey ? await this.existingTask(card, payload.taskKey) : null;
    return {
      event: { kind: 'applied', data: payload.note ? { note: payload.note } : {} },
      ...(payload.createTask && !existing
        ? {
            prepare: () => [
              {
                action: 'task.create',
                target: null,
                payload: this.newTaskPayload(card, payload.createTask ?? {}),
                trusted: true,
              },
            ],
          }
        : {}),
      write: async (written, prepared) => {
        const task = existing ?? prepared[0]?.card ?? null;
        await this.cards.updateDetail(written, {
          appliedById: actor.userId,
          appliedAt: now,
          appliedTaskId: task?.id ?? null,
        });
        if (!task) return {};
        const edge = { fromCardId: written.id, toCardId: task.id, kind: 'relates' };
        if (!(await this.cards.findLink(written, edge))) {
          await this.cards.insertLink(written, edge, actor.userId);
        }
        return { taskCardKey: task.key };
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class HandoffDismissAction extends ReasonTransition {
  readonly action = 'handoff.dismiss';
  readonly forbiddenCode = 'hub.handoffs.not_recipient';

  override plan(context: Parameters<ReasonTransition['plan']>[0]): CardActionPlan {
    return { event: { kind: 'dismissed', data: { reason: context.payload.reason } } };
  }
}
