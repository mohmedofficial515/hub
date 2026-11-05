/**
 * @file Plan actions (D29, docs/15 §4). Every save of the body adds a `plan_revised` event keeping the previous
 * text, so history shows revisions and any can come back. "Create tasks from steps" writes the keys back, and a
 * step's `done` follows its task through `plan.sync_step`.
 */
import {
  type CreatePlanInput,
  createPlanSchema,
  type PlanStep,
  type PlanToTasksInput,
  planToTasksSchema,
  restorePlanRevisionSchema,
  type UpdatePlanInput,
  updatePlanSchema,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  type CardView,
  type JsonObject,
  linkFollowUps,
  OptionalReasonTransition,
  PlainTransition,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { normalizeSteps, specialtyOfStep } from './plan-steps';

function stepsOf(card: CardView): PlanStep[] {
  return ((card.detail?.['steps'] ?? []) as PlanStep[]).map((step) => ({ ...step }));
}

@Injectable()
@CardActionHandler()
export class PlanCreateAction implements CardActionDefinition<CreatePlanInput> {
  readonly action = 'plan.create';
  readonly payload = createPlanSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, payload }: CardActionContext<CreatePlanInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    const idea = detail.sourceIdeaKey
      ? await this.cards.findCard(actor.workspaceId, { cardKey: detail.sourceIdeaKey })
      : null;
    if (detail.sourceIdeaKey && !idea) throw new AppException('hub.cards.not_found');
    const followUps = linkFollowUps(payload.links);
    return {
      create: { ...baseCreateFields(payload) },
      detail: { steps: normalizeSteps(detail.steps), sourceIdeaId: idea?.id ?? null },
      ...(followUps ? { followUps } : {}),
    };
  }
}

@Injectable()
@CardActionHandler()
export class PlanUpdateAction implements CardActionDefinition<UpdatePlanInput> {
  readonly action = 'plan.update';
  readonly payload = updatePlanSchema;

  plan({ card, payload }: CardActionContext<UpdatePlanInput>): CardActionPlan {
    if (!card) throw new Error('plan.update needs a card');
    const header = card as unknown as Record<string, unknown>;
    const fields = (['title', 'priority', 'tags'] as const).filter(
      (field) =>
        payload[field] !== undefined &&
        JSON.stringify(header[field] ?? null) !== JSON.stringify(payload[field]),
    );
    const bodyChanged = payload.body !== undefined && payload.body !== card.body;
    const current = stepsOf(card);
    const steps = payload.steps ? normalizeSteps(payload.steps, current) : current;
    const stepsChanged = JSON.stringify(steps) !== JSON.stringify(current);
    if (fields.length === 0 && !bodyChanged && !stepsChanged) return { noop: true };

    const revision = Number(card.detail?.['revision'] ?? 1) + 1;
    const detail: JsonObject = {
      ...(stepsChanged ? { steps } : {}),
      ...(bodyChanged ? { revision } : {}),
    };
    const changes = fields.map((field) => ({ field, from: header[field] ?? null, to: payload[field] }));
    return {
      patch: {
        ...Object.fromEntries(fields.map((field) => [field, payload[field]])),
        ...(bodyChanged ? { body: payload.body ?? null } : {}),
      },
      ...(Object.keys(detail).length > 0 ? { detail } : {}),
      event: bodyChanged
        ? {
            kind: 'plan_revised',
            data: {
              revision,
              previousBody: card.body,
              ...(changes.length > 0 ? { changes } : {}),
              ...(stepsChanged ? { steps } : {}),
            },
          }
        : stepsChanged
          ? { kind: 'plan_steps_changed', data: { steps, ...(changes.length > 0 ? { changes } : {}) } }
          : { kind: 'field_changed', data: { changes } },
    };
  }
}

const restoreActionSchema = z.object({ restoreRevision: restorePlanRevisionSchema.shape.revision });
type RestoreInput = z.infer<typeof restoreActionSchema>;

/** Brings a past revision back as a new revision, so nothing is lost and the restore itself is history. */
@Injectable()
@CardActionHandler()
export class PlanRestoreRevisionAction implements CardActionDefinition<RestoreInput> {
  readonly action = 'plan.restore_revision';
  readonly payload = restoreActionSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ card, payload }: CardActionContext<RestoreInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('plan.restore_revision needs a card');
    const event = await this.cards.findRevisionEvent(card, payload.restoreRevision);
    if (!event) throw new AppException('hub.plans.revision_not_found');
    const body = (event.data['previousBody'] ?? null) as string | null;
    const revision = Number(card.detail?.['revision'] ?? 1) + 1;
    return {
      patch: { body },
      detail: { revision },
      event: {
        kind: 'plan_revised',
        data: { revision, previousBody: card.body, restoredFrom: payload.restoreRevision },
      },
    };
  }
}

@Injectable()
@CardActionHandler()
export class PlanSubmitReviewAction extends PlainTransition {
  readonly action = 'plan.submit_review';
}

@Injectable()
@CardActionHandler()
export class PlanApproveAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'plan.approve';
  readonly payload = z.object({}) as unknown as z.ZodType<Record<string, never>>;

  plan({ actor, now }: CardActionContext<Record<string, never>>): CardActionPlan {
    return { detail: { approvedById: actor.userId, approvedAt: now } };
  }
}

@Injectable()
@CardActionHandler()
export class PlanStartAction extends PlainTransition {
  readonly action = 'plan.start';
}

@Injectable()
@CardActionHandler()
export class PlanFinishAction extends PlainTransition {
  readonly action = 'plan.finish';
}

@Injectable()
@CardActionHandler()
export class PlanAbandonAction extends OptionalReasonTransition {
  readonly action = 'plan.abandon';
}

@Injectable()
@CardActionHandler()
export class PlanToTasksAction implements CardActionDefinition<PlanToTasksInput> {
  readonly action = 'plan.to_tasks';
  readonly payload = planToTasksSchema;

  constructor(private readonly cards: CardRepository) {}

  plan({ actor, card, payload }: CardActionContext<PlanToTasksInput>): CardActionPlan {
    if (!card) throw new Error('plan.to_tasks needs a card');
    const steps = stepsOf(card);
    const pending = steps.filter((step) => !step.taskKey);
    if (pending.length === 0) return { noop: true };
    const fallback = payload.defaultSpecialty ?? 'ops';
    return {
      event: { kind: 'plan_to_tasks' },
      prepare: () =>
        pending.map((step) => ({
          action: 'task.create' as const,
          target: null,
          trusted: true,
          payload: {
            title: step.title,
            priority: card.priority,
            ...(step.role ? { ownerRole: step.role } : {}),
            detail: {
              specialty: specialtyOfStep(step, fallback),
              origin: 'plan',
              prompt: `Step of plan ${card.key} (${card.title}): ${step.title}`,
            },
          },
        })),
      write: async (written, prepared) => {
        const keyOf = new Map(pending.map((step, index) => [step.id, prepared[index]?.card]));
        for (const task of prepared) {
          await this.cards.insertLink(
            written,
            { fromCardId: task.card.id, toCardId: written.id, kind: 'parent' },
            actor.userId,
          );
        }
        const updated = steps.map((step) => {
          const task = keyOf.get(step.id);
          return task ? { ...step, taskKey: task.key } : step;
        });
        await this.cards.updateDetail(written, { steps: updated });
        return { taskKeys: prepared.map((task) => task.card.key) };
      },
    };
  }
}

const syncSchema = z.object({ taskKey: z.string(), done: z.boolean() });
type SyncInput = z.infer<typeof syncSchema>;

/** A step follows its task (docs/15 §4). Always a trusted follow-up of the task's action. */
@Injectable()
@CardActionHandler()
export class PlanSyncStepAction implements CardActionDefinition<SyncInput> {
  readonly action = 'plan.sync_step';
  readonly payload = syncSchema;

  plan({ card, payload }: CardActionContext<SyncInput>): CardActionPlan {
    if (!card) throw new Error('plan.sync_step needs a card');
    const steps = stepsOf(card);
    const step = steps.find((item) => item.taskKey === payload.taskKey);
    if (!step || step.done === payload.done) return { noop: true };
    step.done = payload.done;
    return { detail: { steps }, event: { kind: 'plan_steps_changed', data: { steps } } };
  }
}
