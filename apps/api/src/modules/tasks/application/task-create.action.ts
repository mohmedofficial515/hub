/**
 * @file `task.create`: the worked example of a card action.
 * @description Initial status is `ready` when a prompt or acceptance is given, otherwise `backlog`, and the
 * role defaults from the specialty (docs/04 §3.8). A ready task tells the role holders. `assignToActor` is for
 * another action creating a task for the member doing it, such as applying a handoff; a client body never has it.
 */
import { createTaskSchema, SPECIALTY_DEFAULT_ROLE } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  baseCreateFields,
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  linkFollowUps,
} from '@/modules/cards';

export const taskCreatePayloadSchema = createTaskSchema.extend({ assignToActor: z.boolean().optional() });
export type TaskCreatePayload = z.infer<typeof taskCreatePayloadSchema>;

@Injectable()
@CardActionHandler()
export class TaskCreateAction implements CardActionDefinition<TaskCreatePayload> {
  readonly action = 'task.create';
  readonly payload = taskCreatePayloadSchema;

  plan({ actor, payload }: CardActionContext<TaskCreatePayload>): CardActionPlan {
    const { detail } = payload;
    const ownerRole = payload.ownerRole ?? SPECIALTY_DEFAULT_ROLE[detail.specialty];
    const ready = Boolean(detail.prompt || detail.acceptance);
    const assigneeId = payload.assignToActor ? actor.userId : null;
    const followUps = linkFollowUps(payload.links);
    return {
      create: {
        ...baseCreateFields(payload),
        status: ready ? 'ready' : 'backlog',
        ownerRole,
        assigneeId,
      },
      detail: {
        specialty: detail.specialty,
        effort: detail.effort ?? null,
        acceptance: detail.acceptance ?? null,
        prompt: detail.prompt ?? null,
        origin: detail.origin ?? 'manual',
      },
      ...(assigneeId ? { watchers: [{ userId: assigneeId, reason: 'assignee' }] } : {}),
      ...(followUps ? { followUps } : {}),
      notify: ready
        ? [{ kind: 'task_ready', i18nKey: 'task_ready', roles: [ownerRole], data: { action: 'claim' } }]
        : [],
    };
  }
}
