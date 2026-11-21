/**
 * @file journey.ts
 * @description What a plan's own page derives for its journey (apps/lab/hub/plan-page/v5-live-plan, approved 2026-11-19): steps numbered in the
 * whole plan and grouped under their phases, effort by size, what a step waits for, and a finish estimate from the pace so far. Nothing here is
 * stored; each is computed from the card. A plan saved before phases is one unnamed group. A step whose task waits in review is not done (only the
 * owner closes a task), but it counts apart as "in review", so work sent for review shows on the journey before the owner closes it (owner, 2026-11-21).
 */
import type { PlanPhase, PlanStep, Role } from '../cards/types';
import type { StepExtra, StepSize } from './plan-text';

/** The Plan Studio's weights (contracts `plan.ts`: S about an hour, M about a day, L more). A step with no size counts as M. */
export const SIZE_WEIGHT: Record<StepSize, number> = { S: 1, M: 3, L: 8 };

/** A step as the page shows it: its number in the whole plan, its details, and when it became done. */
export interface JourneyStep extends PlanStep {
  /** 1-based position in the whole plan: a step keeps its plan number inside a phase. */
  n: number;
  /** Its task waits in review: not done yet, but its work is in. */
  review?: boolean;
}

export const weightOf = (step: Pick<PlanStep, 'size'>) => SIZE_WEIGHT[step.size ?? 'M'];

/**
 * Each step numbered, with an older plan's details read from its text (`extras`, `after` there is by number) where the step has none, and the
 * date a step was done from its task when Hub has none for the step itself.
 */
export function journeySteps(
  steps: readonly PlanStep[],
  extras?: readonly StepExtra[] | null,
  closedAt?: (taskKey: string) => string | undefined,
  inReview?: (taskKey: string) => boolean,
): JourneyStep[] {
  return steps.map((step, index) => {
    const extra = extras?.[index];
    const after =
      step.after ?? extra?.after?.flatMap((n) => (steps[n - 1] ? [steps[n - 1]!.id] : [])) ?? undefined;
    const why = step.why ?? extra?.why;
    const size = step.size ?? extra?.size;
    const acceptance = step.acceptance ?? extra?.acceptance;
    const doneAt = step.done
      ? (step.doneAt ?? (step.taskKey ? closedAt?.(step.taskKey) : undefined))
      : undefined;
    const review = !step.done && !!step.taskKey && !!inReview?.(step.taskKey);
    return {
      ...step,
      n: index + 1,
      ...(review ? { review } : {}),
      ...(why ? { why } : {}),
      ...(size ? { size } : {}),
      ...(after?.length ? { after } : {}),
      ...(acceptance ? { acceptance } : {}),
      ...(doneAt ? { doneAt } : { doneAt: undefined }),
    };
  });
}

export interface PhaseGroup {
  /** Null for the steps outside any phase: a plan with no phases, or a step that names none. */
  phase: PlanPhase | null;
  /** 0-based phase number, as the owner writes "Phase 0". */
  index: number;
  steps: JourneyStep[];
  done: number;
  /** Steps whose task waits in review: counted apart from `done`. */
  review: number;
  total: number;
  roles: { role: Role; n: number }[];
  /** Holds the plan's next step: the first one not done. */
  hasNext: boolean;
}

function roleMix(steps: readonly JourneyStep[]) {
  const counts = new Map<Role, number>();
  for (const step of steps) if (step.role) counts.set(step.role, (counts.get(step.role) ?? 0) + 1);
  return [...counts.entries()].map(([role, n]) => ({ role, n })).sort((a, b) => b.n - a.n);
}

/** The plan's next step: the first one neither done nor in review, else the first one not done. */
export const nextStepOf = <T extends Pick<JourneyStep, 'done' | 'review'>>(steps: readonly T[]) =>
  steps.find((step) => !step.done && !step.review) ?? steps.find((step) => !step.done);

/** Steps under their phase, in phase order. Steps with no known phase go last, in one unnamed group. */
export function phaseGroups(phases: readonly PlanPhase[], steps: readonly JourneyStep[]): PhaseGroup[] {
  const nextId = nextStepOf(steps)?.id;
  const known = new Set(phases.map((phase) => phase.id));
  const build = (phase: PlanPhase | null, index: number, own: JourneyStep[]): PhaseGroup => ({
    phase,
    index,
    steps: own,
    done: own.filter((step) => step.done).length,
    review: own.filter((step) => step.review).length,
    total: own.length,
    roles: roleMix(own),
    hasNext: !!nextId && own.some((step) => step.id === nextId),
  });
  const groups = phases.map((phase, index) =>
    build(
      phase,
      index,
      steps.filter((step) => step.phaseId === phase.id),
    ),
  );
  const loose = steps.filter((step) => !step.phaseId || !known.has(step.phaseId));
  if (loose.length > 0 || groups.length === 0) groups.push(build(null, groups.length, loose));
  return groups;
}

/** The steps a step waits for that are not done yet. */
export function blockersOf(step: Pick<PlanStep, 'after'>, all: readonly JourneyStep[]): JourneyStep[] {
  return (step.after ?? []).flatMap((id) => {
    const found = all.find((other) => other.id === id);
    return found && !found.done ? [found] : [];
  });
}

/** Effort done, in review and in all, in size points. */
export function effortOf(steps: readonly (Pick<PlanStep, 'size' | 'done'> & { review?: boolean })[]) {
  let done = 0;
  let review = 0;
  let total = 0;
  for (const step of steps) {
    const weight = weightOf(step);
    total += weight;
    if (step.done) done += weight;
    else if (step.review) review += weight;
  }
  return { done, review, total };
}

export interface FinishEstimate {
  date: Date;
  /** Points done a day so far. */
  pace: number;
  /** Points still to do. */
  left: number;
}

/** The fewest dated steps a pace is read from: two points are not a pace. */
export const ESTIMATE_MIN_DATED = 3;

/**
 * When the plan may finish at the pace so far: the points of the dated done steps, over the days since the first of them, applied to what is
 * left. Null with fewer than three dated steps, or nothing left to do.
 */
export function finishEstimate(
  steps: readonly Pick<PlanStep, 'size' | 'done' | 'doneAt'>[],
  now: Date,
): FinishEstimate | null {
  const dated = steps.flatMap((step) => {
    if (!step.done || !step.doneAt) return [];
    const at = Date.parse(step.doneAt);
    return Number.isNaN(at) ? [] : [{ at, weight: weightOf(step) }];
  });
  if (dated.length < ESTIMATE_MIN_DATED) return null;
  const first = Math.min(...dated.map((d) => d.at));
  const days = Math.max(1, (now.getTime() - first) / 86_400_000);
  const pace = dated.reduce((sum, d) => sum + d.weight, 0) / days;
  const { done, total } = effortOf(steps);
  const left = total - done;
  if (pace <= 0 || left <= 0) return null;
  return { date: new Date(now.getTime() + (left / pace) * 86_400_000), pace, left };
}

export type PhaseState = 'done' | 'now' | 'todo';

/** Done: every step done. Now: holds the next step. Todo: the rest, even when some steps were done out of order. */
export function phaseState(group: Pick<PhaseGroup, 'done' | 'total' | 'hasNext'>): PhaseState {
  if (group.total > 0 && group.done === group.total) return 'done';
  if (group.hasNext) return 'now';
  return 'todo';
}

/** A phase's tone: one of eight hues (`journey.css`), cycled, so phase 8 and phase 0 share a hue but never sit side by side. */
export const toneOf = (index: number) => String(index % 8);
