/**
 * @file Do next (docs/16 §11): what to start, ranked from real state with no AI, for Today and the panel.
 * @description The rule is `doNext` in `@hub/contracts`, the one both pages show; this only gathers what a card list has no room for: each open task's effort and each approved
 * or running plan's next step. Reading it changes nothing.
 */
import {
  doNext,
  type DoNextCard,
  type DoNextList,
  type DoNextQuery,
  type Effort,
  EFFORTS,
  type MemberActor,
  nextPlanSteps,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { CardQueryService } from '@/modules/cards';

const DEFAULT_LIMIT = 5;
/** Enough of each kind for a ranking: past this, the rest would not make a short list anyway. */
const PER_KIND = 100;

const effortOf = (value: unknown): Effort | null =>
  typeof value === 'string' && (EFFORTS as readonly string[]).includes(value) ? (value as Effort) : null;

interface StepLike {
  title?: unknown;
  role?: unknown;
  taskKey?: unknown;
  done?: unknown;
}

@Injectable()
export class NextService {
  constructor(
    private readonly query: CardQueryService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async next(actor: MemberActor, input: DoNextQuery): Promise<DoNextList> {
    const [tasks, decisions, plans] = await Promise.all([
      this.query.listWithDetail(actor, 'task', {
        statuses: ['ready', 'claimed'],
        sort: 'priority',
        limit: PER_KIND,
      }),
      this.query.listWithDetail(actor, 'decision', { statuses: ['open'], limit: PER_KIND }),
      this.query.listWithDetail(actor, 'plan', { statuses: ['approved', 'in_progress'], limit: PER_KIND }),
    ]);
    const cards: DoNextCard[] = [
      ...tasks.items.map((card) => ({ ...card, effort: effortOf(card.detail?.['effort']) })),
      ...decisions.items,
    ];
    const planSteps = nextPlanSteps(
      plans.items.map((plan) => ({
        key: plan.key,
        title: plan.title,
        status: plan.status,
        priority: plan.priority,
        archivedAt: plan.archivedAt,
        steps: ((plan.detail?.['steps'] ?? []) as StepLike[]).map((step) => ({
          title: typeof step.title === 'string' ? step.title : '',
          role: typeof step.role === 'string' ? step.role : null,
          taskKey: typeof step.taskKey === 'string' ? step.taskKey : null,
          done: step.done === true,
        })),
      })),
    );
    const items = doNext(cards, {
      role: input.role ?? null,
      limit: input.limit ?? DEFAULT_LIMIT,
      nowMs: this.clock.now().getTime(),
      planSteps,
    });
    return { items: items.map((item) => ({ ...item, reasons: [...item.reasons] })) };
  }
}
