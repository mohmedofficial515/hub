/**
 * @file `doc.create`: system only. The docs indexer (H2) creates doc cards, because docs live in Git (docs/15 §6).
 */
import { type CreateDocInput, createDocSchema } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import {
  type CardActionContext,
  type CardActionDefinition,
  CardActionHandler,
  type CardActionPlan,
  defined,
} from '@/modules/cards';

@Injectable()
@CardActionHandler()
export class DocCreateAction implements CardActionDefinition<CreateDocInput> {
  readonly action = 'doc.create';
  readonly payload = createDocSchema;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {}

  plan({ payload }: CardActionContext<CreateDocInput>): CardActionPlan {
    return {
      create: {
        title: payload.title,
        source: 'docs',
        ...(payload.repo ? { repo: payload.repo } : {}),
        ...(payload.externalKey ? { externalKey: payload.externalKey } : {}),
      },
      detail: defined({ ...payload.detail, lastIndexedAt: this.clock.now() }),
    };
  }
}
