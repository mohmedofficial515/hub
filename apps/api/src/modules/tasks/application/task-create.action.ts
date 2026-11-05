/**
 * @file `task.create`: the worked example of a card action.
 * @description Initial status is `ready` when a prompt or acceptance is given, otherwise `backlog`, and the
 * role defaults from the specialty (docs/04 §3.8). A ready task tells the role holders.
 */
import { type CreateTaskInput, createTaskSchema, SPECIALTY_DEFAULT_ROLE } from '@hub/contracts';
import { Injectable } from '@nestjs/common';

import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
} from '@/modules/cards';

@Injectable()
@CardActionHandler()
export class TaskCreateAction implements CardActionDefinition<CreateTaskInput> {
  readonly action = 'task.create';
  readonly payload = createTaskSchema;

  plan({ payload }: CardActionContext<CreateTaskInput>): CardActionPlan {
    const { detail } = payload;
    const ownerRole = payload.ownerRole ?? SPECIALTY_DEFAULT_ROLE[detail.specialty];
    const ready = Boolean(detail.prompt || detail.acceptance);
    return {
      create: {
        title: payload.title,
        body: payload.body ?? null,
        status: ready ? 'ready' : 'backlog',
        ...(payload.priority ? { priority: payload.priority } : {}),
        ownerRole,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        tags: payload.tags ?? [],
        module: payload.module ?? null,
        repo: payload.repo ?? null,
      },
      detail: {
        specialty: detail.specialty,
        effort: detail.effort ?? null,
        acceptance: detail.acceptance ?? null,
        prompt: detail.prompt ?? null,
        origin: detail.origin ?? 'manual',
      },
      notify: ready
        ? [{ kind: 'task_ready', i18nKey: 'task_ready', roles: [ownerRole], data: { action: 'claim' } }]
        : [],
    };
  }
}
