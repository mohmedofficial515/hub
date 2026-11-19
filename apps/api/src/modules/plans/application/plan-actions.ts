/**
 * @file Plan actions (D29, docs/15 §4). Every save of the body adds a `plan_revised` event keeping the previous
 * text, so history shows revisions and any can come back. "Create tasks from steps" writes the keys back, and a
 * step's `done` follows its task through `plan.sync_step`.
 */
import {
  type CreatePlanInput,
  createPlanSchema,
  type PlanPhase,
  type PlanStep,
  type PlanToTasksInput,
  planToTasksSchema,
  type ReasonInput,
  reasonSchema,
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

import { canonicalStep, normalizeSteps, phaseProblem, specialtyOfStep, withDone } from './plan-steps';
import { StudioSourceCheck } from './studio-source.check';

/** The plan's steps, each with its keys in one order (see `canonicalStep`), so a compare with normalised steps does not depend on JSONB. */
function stepsOf(card: CardView): PlanStep[] {
  return ((card.detail?.['steps'] ?? []) as PlanStep[]).map(canonicalStep);
}

/** Each phase with its keys in one order: Postgres keeps JSONB keys in its own order, so a compare must not depend on it. */
const canonicalPhase = (phase: PlanPhase): PlanPhase => ({
  id: phase.id,
  title: phase.title,
  ...(phase.note ? { note: phase.note } : {}),
});

function phasesOf(card: CardView): PlanPhase[] {
  return ((card.detail?.['phases'] ?? []) as PlanPhase[]).map(canonicalPhase);
}

/** Refuses steps that name a phase the plan does not have, or a phase being removed while steps still name it. */
function assertPhases(
  steps: readonly PlanStep[],
  phases: readonly PlanPhase[],
  before?: readonly PlanPhase[],
) {
  const problem = phaseProblem(steps, phases, before);
  if (problem) throw new AppException(problem.code, { params: { phase: problem.phase } });
}

@Injectable()
@CardActionHandler()
export class PlanCreateAction implements CardActionDefinition<CreatePlanInput> {
  readonly action = 'plan.create';
  readonly payload = createPlanSchema;

  constructor(
    private readonly cards: CardRepository,
    private readonly sources: StudioSourceCheck,
  ) {}

  async plan({ actor, payload }: CardActionContext<CreatePlanInput>): Promise<CardActionPlan> {
    const { detail } = payload;
    await this.sources.assertOwn(actor, detail);
    const idea = detail.sourceIdeaKey
      ? await this.cards.findCard(actor.workspaceId, { cardKey: detail.sourceIdeaKey })
      : null;
    if (detail.sourceIdeaKey && !idea) throw new AppException('hub.cards.not_found');
    const followUps = linkFollowUps(payload.links);
    const steps = normalizeSteps(detail.steps);
    const phases = detail.phases ?? [];
    assertPhases(steps, phases);
    return {
      create: { ...baseCreateFields(payload) },
      detail: {
        steps,
        phases,
        sourceIdeaId: idea?.id ?? null,
        sourceChatId: detail.sourceChatId ?? null,
        sourceMessageId: detail.sourceMessageId ?? null,
      },
      ...(followUps ? { followUps } : {}),
    };
  }
}

@Injectable()
@CardActionHandler()
export class PlanUpdateAction implements CardActionDefinition<UpdatePlanInput> {
  readonly action = 'plan.update';
  readonly payload = updatePlanSchema;

  constructor(private readonly sources: StudioSourceCheck) {}

  async plan({ actor, card, payload, now }: CardActionContext<UpdatePlanInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('plan.update needs a card');
    const header = card as unknown as Record<string, unknown>;
    const fields = (['title', 'priority', 'tags'] as const).filter(
      (field) =>
        payload[field] !== undefined &&
        JSON.stringify(header[field] ?? null) !== JSON.stringify(payload[field]),
    );
    const bodyChanged = payload.body !== undefined && payload.body !== card.body;
    const current = stepsOf(card);
    const steps = payload.steps ? normalizeSteps(payload.steps, current, now) : current;
    const stepsChanged = JSON.stringify(steps) !== JSON.stringify(current);
    const currentPhases = phasesOf(card);
    const phases = payload.phases?.map(canonicalPhase) ?? currentPhases;
    const phasesChanged = JSON.stringify(phases) !== JSON.stringify(currentPhases);
    if (stepsChanged || phasesChanged) assertPhases(steps, phases, currentPhases);
    // The studio chat a save came from (owner decision 9c): only the writer's own chat, and named on the event, so the
    // history says who tied the card to a session.
    const source = (['sourceChatId', 'sourceMessageId'] as const).filter(
      (field) => payload[field] !== undefined && payload[field] !== (card.detail?.[field] ?? null),
    );
    if (fields.length === 0 && !bodyChanged && !stepsChanged && !phasesChanged && source.length === 0)
      return { noop: true };
    if (source.length > 0) {
      await this.sources.assertOwn(actor, {
        ...(source.includes('sourceChatId') ? { sourceChatId: payload.sourceChatId } : {}),
        // A message alone is checked against the chat the card keeps, or the one this save names.
        ...(source.includes('sourceMessageId')
          ? {
              sourceMessageId: payload.sourceMessageId,
              sourceChatId:
                payload.sourceChatId ?? (card.detail?.['sourceChatId'] as string | null | undefined),
            }
          : {}),
      });
    }

    const revision = Number(card.detail?.['revision'] ?? 1) + 1;
    const detail: JsonObject = {
      ...(stepsChanged ? { steps } : {}),
      ...(phasesChanged ? { phases } : {}),
      ...(bodyChanged ? { revision } : {}),
      ...Object.fromEntries(source.map((field) => [field, payload[field] ?? null])),
    };
    const changes = [
      ...fields.map((field) => ({ field, from: header[field] ?? null, to: payload[field] })),
      ...source.map((field) => ({ field, from: card.detail?.[field] ?? null, to: payload[field] ?? null })),
    ];
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
              ...(phasesChanged ? { phases } : {}),
            },
          }
        : stepsChanged || phasesChanged
          ? {
              kind: 'plan_steps_changed',
              data: {
                steps,
                ...(phasesChanged ? { phases } : {}),
                ...(changes.length > 0 ? { changes } : {}),
              },
            }
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

/** In review back to draft, saying what to change (owner decision 9b). The reason is on the event, where History and the timeline show it. */
@Injectable()
@CardActionHandler()
export class PlanRequestChangesAction implements CardActionDefinition<ReasonInput> {
  readonly action = 'plan.request_changes';
  readonly payload: z.ZodType<ReasonInput> = reasonSchema;

  plan({ payload }: CardActionContext<ReasonInput>): CardActionPlan {
    return { event: { kind: 'changes_requested', data: { reason: payload.reason } } };
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
    const phaseTitle = new Map(phasesOf(card).map((phase) => [phase.id, phase.title]));
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
              prompt: `Step of plan ${card.key} (${card.title}): ${step.title}${
                step.phaseId && phaseTitle.has(step.phaseId)
                  ? `
Phase: ${phaseTitle.get(step.phaseId)}`
                  : ''
              }${
                step.why
                  ? `
Why: ${step.why}`
                  : ''
              }`,
              ...(step.acceptance ? { acceptance: step.acceptance } : {}),
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

  plan({ card, payload, now }: CardActionContext<SyncInput>): CardActionPlan {
    if (!card) throw new Error('plan.sync_step needs a card');
    const found = stepsOf(card);
    const step = found.find((item) => item.taskKey === payload.taskKey);
    if (!step || step.done === payload.done) return { noop: true };
    const steps = found.map((item) => (item === step ? withDone(item, payload.done, now) : item));
    return { detail: { steps }, event: { kind: 'plan_steps_changed', data: { steps } } };
  }
}
