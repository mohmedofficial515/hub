/**
 * @file Task moves (docs/04 §3.10). The machine and the matrix decide whether each may run; the rules here are
 * the ones they cannot express: claimed by someone else, blocked, and a plan's step following its task.
 */
import {
  type ClaimTaskInput,
  claimTaskSchema,
  type CompleteTaskInput,
  completeTaskSchema,
  type EditTaskDetailInput,
  editTaskDetailSchema,
  type PermissionAction,
  type SubmitTaskInput,
  submitTaskSchema,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  CardRepository,
  type CardView,
  defined,
  type FollowUp,
  type JsonObject,
  OptionalReasonTransition,
  ReasonTransition,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

/** A plan this task is a step of follows it (docs/15 §4). */
async function planStepFollowUps(
  cards: CardRepository,
  card: CardView,
  done: boolean,
): Promise<readonly FollowUp[]> {
  const parents = await cards.findParents(card);
  return parents
    .filter((parent) => parent.type === 'plan')
    .map((plan) => ({
      action: 'plan.sync_step',
      target: { cardId: plan.id },
      payload: { taskKey: card.key, done },
      trusted: true,
    }));
}

@Injectable()
@CardActionHandler()
export class TaskClaimAction implements CardActionDefinition<ClaimTaskInput> {
  readonly action = 'task.claim';
  readonly payload = claimTaskSchema;
  readonly forbiddenCode = 'hub.tasks.specialty_role_mismatch';

  constructor(private readonly cards: CardRepository) {}

  async plan({ actor, card, payload, now }: CardActionContext<ClaimTaskInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('task.claim needs a card');
    // Claiming what you already hold is not a change (docs/04 §3.10).
    if (card.status === 'claimed' && card.assigneeId === actor.userId) return { noop: true };
    if (card.assigneeId && card.assigneeId !== actor.userId && card.closedAt === null) {
      throw new AppException('hub.tasks.already_claimed', { details: { claimedBy: card.assigneeId } });
    }
    if (await this.cards.hasOpenBlockers(card)) throw new AppException('hub.tasks.blocked');
    return {
      patch: { assigneeId: actor.userId, ...(payload.branch ? { branch: payload.branch } : {}) },
      detail: {
        claimedById: actor.userId,
        claimedAt: now,
        ...(payload.branch ? { branch: payload.branch } : {}),
      },
      event: {
        kind: 'claimed',
        data: { userId: actor.userId, ...(payload.branch ? { branch: payload.branch } : {}) },
      },
      watchers: actor.userId ? [{ userId: actor.userId, reason: 'assignee' }] : [],
    };
  }
}

const emptySchema = z.object({}) as unknown as z.ZodType<Record<string, never>>;

@Injectable()
@CardActionHandler()
export class TaskUnclaimAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'task.unclaim';
  readonly payload = emptySchema;

  plan({ actor, card }: CardActionContext<Record<string, never>>): CardActionPlan {
    const manager = actor.roles.includes('owner') || actor.roles.includes('pm');
    if (!manager && card?.assigneeId !== actor.userId) throw new AppException('hub.tasks.not_claimer');
    return {
      patch: { assigneeId: null },
      detail: { claimedById: null, claimedAt: null, startedAt: null },
      event: { kind: 'unclaimed', data: { userId: card?.assigneeId ?? null } },
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskStartAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'task.start';
  readonly payload = emptySchema;
  readonly forbiddenCode = 'hub.tasks.not_claimer';

  plan({ now }: CardActionContext<Record<string, never>>): CardActionPlan {
    return { detail: { startedAt: now } };
  }
}

@Injectable()
@CardActionHandler()
export class TaskSubmitReviewAction implements CardActionDefinition<SubmitTaskInput> {
  readonly action = 'task.submit_review';
  readonly payload = submitTaskSchema;
  readonly forbiddenCode = 'hub.tasks.not_claimer';

  plan({ payload }: CardActionContext<SubmitTaskInput>): CardActionPlan {
    return {
      ...(payload.prUrl ? { detail: { prUrl: payload.prUrl } } : {}),
      event: { kind: 'status_changed', data: payload.note ? { reason: payload.note } : {} },
      notify: [
        { kind: 'review_requested', i18nKey: 'review_requested', roles: ['qa'], data: { action: 'review' } },
      ],
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskResumeAction extends OptionalReasonTransition {
  readonly action = 'task.resume';
  readonly forbiddenCode = 'hub.tasks.not_claimer';
}

@Injectable()
@CardActionHandler()
export class TaskCompleteAction implements CardActionDefinition<CompleteTaskInput> {
  readonly action = 'task.complete';
  readonly payload = completeTaskSchema;
  readonly forbiddenCode = 'hub.tasks.not_claimer';

  constructor(private readonly cards: CardRepository) {}

  /** A task in review also moves for its reviewers (docs/09 §6). */
  permissions(_payload: CompleteTaskInput, card: CardView | null): readonly PermissionAction[] {
    return [card?.status === 'in_review' ? 'task.review' : 'task.complete'];
  }

  async plan({ card, payload, now }: CardActionContext<CompleteTaskInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('task.complete needs a card');
    const steps = await planStepFollowUps(this.cards, card, true);
    return {
      detail: { doneAt: now },
      event: { kind: 'status_changed', data: payload.note ? { reason: payload.note } : {} },
      followUps: () => steps,
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskCancelAction extends ReasonTransition {
  readonly action = 'task.cancel';
}

const reopenSchema = z.object({ reason: z.string().trim().max(2000).optional() });
type ReopenInput = z.infer<typeof reopenSchema>;

@Injectable()
@CardActionHandler()
export class TaskReopenAction implements CardActionDefinition<ReopenInput> {
  readonly action = 'task.reopen';
  readonly payload = reopenSchema;

  constructor(private readonly cards: CardRepository) {}

  async plan({ card, payload }: CardActionContext<ReopenInput>): Promise<CardActionPlan> {
    if (!card) throw new Error('task.reopen needs a card');
    const steps = await planStepFollowUps(this.cards, card, false);
    return {
      patch: { assigneeId: null },
      detail: { claimedById: null, claimedAt: null, startedAt: null, doneAt: null },
      event: { kind: 'status_changed', data: payload.reason ? { reason: payload.reason } : {} },
      followUps: () => steps,
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskMarkReadyAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'task.mark_ready';
  readonly payload = emptySchema;

  plan({ card }: CardActionContext<Record<string, never>>): CardActionPlan {
    return {
      notify: card?.ownerRole
        ? [{ kind: 'task_ready', i18nKey: 'task_ready', roles: [card.ownerRole], data: { action: 'claim' } }]
        : [],
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskMarkBacklogAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'task.mark_backlog';
  readonly payload = emptySchema;

  plan(): CardActionPlan {
    return {};
  }
}

/** A trusted follow-up of marking a redesign ported. Its row belongs to nobody. */
@Injectable()
@CardActionHandler()
export class TaskCloseAsPortedAction implements CardActionDefinition<{ ref: string }> {
  readonly action = 'task.close_as_ported';
  readonly payload = z.object({ ref: z.string() });

  constructor(private readonly cards: CardRepository) {}

  async plan({ card, payload, now }: CardActionContext<{ ref: string }>): Promise<CardActionPlan> {
    if (!card) throw new Error('task.close_as_ported needs a card');
    const steps = await planStepFollowUps(this.cards, card, true);
    return {
      detail: { doneAt: now },
      event: { kind: 'status_changed', data: { reason: 'ported', ref: payload.ref } },
      followUps: () => steps,
    };
  }
}

@Injectable()
@CardActionHandler()
export class TaskEditDetailAction implements CardActionDefinition<EditTaskDetailInput> {
  readonly action = 'task.edit_detail';
  readonly payload = editTaskDetailSchema;

  plan({ card, payload }: CardActionContext<EditTaskDetailInput>): CardActionPlan {
    const current: JsonObject = card?.detail ?? {};
    const wanted = defined(payload) as JsonObject;
    const changed = Object.entries(wanted).filter(
      ([field, value]) => JSON.stringify(current[field] ?? null) !== JSON.stringify(value ?? null),
    );
    if (changed.length === 0) return { noop: true };
    const detail = Object.fromEntries(changed);
    return {
      detail,
      ...('branch' in detail ? { patch: { branch: detail['branch'] as string | null } } : {}),
      event: {
        kind: 'field_changed',
        data: {
          changes: changed.map(([field, value]) =>
            field === 'prompt' || field === 'acceptance'
              ? { field }
              : { field, from: current[field] ?? null, to: value ?? null },
          ),
        },
      },
    };
  }
}
