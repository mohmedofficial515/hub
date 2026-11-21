/**
 * @file The indexer's other moves: a changed file, a removed one, one that came back. System rows (docs/04 §2).
 * @description `quiet`: a run may touch hundreds of files, so these publish nothing per card. The run ends with one
 * `docs.indexed` message for open pages.
 */
import { type CreateDocInput, createDocSchema } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  defined,
} from '@/modules/cards';

const updateDocSchema = createDocSchema.pick({ title: true, detail: true });
type UpdateDocInput = Pick<CreateDocInput, 'title' | 'detail'>;

@Injectable()
@CardActionHandler()
export class DocUpdateAction implements CardActionDefinition<UpdateDocInput> {
  readonly action = 'doc.update';
  readonly payload = updateDocSchema;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  plan({ payload }: CardActionContext<UpdateDocInput>): CardActionPlan {
    return {
      patch: { title: payload.title },
      detail: defined({ ...payload.detail, lastIndexedAt: this.clock.now() }),
      event: { kind: 'field_changed', data: { field: 'content' } },
      quiet: true,
    };
  }
}

const empty = z.object({});

@Injectable()
@CardActionHandler()
export class DocMarkRemovedAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'doc.mark_removed';
  readonly payload = empty as unknown as z.ZodType<Record<string, never>>;

  plan(): CardActionPlan {
    return { quiet: true };
  }
}

@Injectable()
@CardActionHandler()
export class DocMarkCurrentAction implements CardActionDefinition<Record<string, never>> {
  readonly action = 'doc.mark_current';
  readonly payload = empty as unknown as z.ZodType<Record<string, never>>;

  plan(): CardActionPlan {
    return { quiet: true };
  }
}
