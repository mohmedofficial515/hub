/**
 * @file The steps of a plan: giving each an id, and what a client may not change.
 * @description A step with a task follows its task (docs/15 §4), so an edit keeps its `taskKey` and `done`. Its why, size, after, acceptance and
 * phase are the writer's (owner decision 9a, v5-live-plan). `doneAt` is Hub's: set when a step that was not done becomes done, kept while it
 * stays done, and never invented for a step that arrives already done.
 */
import type { ErrorCode, PlanPhase, PlanStep, PlanStepInput, Role, Specialty } from '@hub/contracts';

export function normalizeSteps(
  inputs: readonly PlanStepInput[],
  existing: readonly PlanStep[] = [],
  now: Date = new Date(),
): PlanStep[] {
  const byId = new Map(existing.map((step) => [step.id, step]));
  const byTask = new Map(existing.filter((step) => step.taskKey).map((step) => [step.taskKey, step]));
  const used = new Set<string>(existing.map((step) => step.id));
  const given = new Set<string>();
  let next = existing.length + 1;
  const freshId = (): string => {
    while (used.has(`s${next}`)) next += 1;
    const id = `s${next}`;
    used.add(id);
    return id;
  };
  // A step that names one of this plan's tasks is that task's step, whatever id it carries: a writer who never saw the ids
  // and numbered the steps by position, then inserted one, must not move every task onto its neighbour.
  const claimed = new Set(
    inputs.flatMap((input) => (input.taskKey && byTask.has(input.taskKey) ? [input.taskKey] : [])),
  );
  const reserved = new Set([...claimed].map((key) => byTask.get(key)?.id));
  const steps = inputs.map((input) => {
    const ownTask = input.taskKey ? byTask.get(input.taskKey) : undefined;
    const sameId = !ownTask && input.id && !reserved.has(input.id) ? byId.get(input.id) : undefined;
    const sameStep =
      sameId &&
      (!sameId.taskKey ||
        (!claimed.has(sameId.taskKey) && (!input.taskKey || input.taskKey === sameId.taskKey)))
        ? sameId
        : undefined;
    const before = ownTask ?? sameStep;
    const wanted = before?.id ?? (input.id && !byId.has(input.id) ? input.id : undefined);
    const id = wanted && !given.has(wanted) ? wanted : freshId();
    given.add(id);
    const taskKey = before?.taskKey ?? input.taskKey;
    const done = before?.taskKey ? before.done : (input.done ?? false);
    const doneAt = !done ? undefined : before?.done ? before.doneAt : before ? now.toISOString() : undefined;
    return {
      id,
      title: input.title,
      ...(input.role ? { role: input.role } : {}),
      ...(taskKey ? { taskKey } : {}),
      done,
      ...(input.why ? { why: input.why } : {}),
      ...(input.size ? { size: input.size } : {}),
      ...(input.acceptance ? { acceptance: input.acceptance } : {}),
      ...(input.phaseId ? { phaseId: input.phaseId } : {}),
      ...(doneAt ? { doneAt } : {}),
    };
  });
  return withAfter(inputs, steps);
}

/**
 * `after` names earlier steps by id (owner decision 9a). An id the writer sent is followed to the id Hub gave that step, and anything that is not an
 * earlier step of this plan is dropped, so the order a page draws can never loop.
 */
function withAfter(inputs: readonly PlanStepInput[], steps: PlanStep[]): PlanStep[] {
  const renamed = new Map<string, string>();
  inputs.forEach((input, index) => {
    const id = steps[index]?.id;
    if (input.id && id && !renamed.has(input.id)) renamed.set(input.id, id);
  });
  const earlier = new Set<string>();
  return steps.map((step, index) => {
    const wanted = inputs[index]?.after ?? [];
    const after = [...new Set(wanted.map((ref) => renamed.get(ref) ?? ref))].filter((ref) =>
      earlier.has(ref),
    );
    earlier.add(step.id);
    return after.length > 0 ? { ...step, after } : step;
  });
}

/**
 * A step with its keys in the order `normalizeSteps` writes them. Postgres keeps JSONB keys in its own order (by length), so a step read back from
 * the database must be put in this order before it is compared with a step just normalised, or the same steps would always look changed.
 */
export function canonicalStep(step: PlanStep): PlanStep {
  return {
    id: step.id,
    title: step.title,
    ...(step.role ? { role: step.role } : {}),
    ...(step.taskKey ? { taskKey: step.taskKey } : {}),
    done: step.done === true,
    ...(step.why ? { why: step.why } : {}),
    ...(step.size ? { size: step.size } : {}),
    ...(step.acceptance ? { acceptance: step.acceptance } : {}),
    ...(step.phaseId ? { phaseId: step.phaseId } : {}),
    ...(step.doneAt ? { doneAt: step.doneAt } : {}),
    ...(step.after && step.after.length > 0 ? { after: [...step.after] } : {}),
  };
}

/** What is wrong with the steps' phases, if anything: the first step that names a phase the plan does not have. */
export interface PhaseProblem {
  code: Extract<ErrorCode, 'hub.plans.unknown_phase' | 'hub.plans.phase_in_use'>;
  phase: string;
}

/**
 * Every step's `phaseId` must name one of the plan's phases. A phase the plan had before and a step still names is being removed while in use,
 * which is said apart, so the writer knows to move those steps in the same save. A plan with no phases and steps with none is fine.
 */
export function phaseProblem(
  steps: readonly PlanStep[],
  phases: readonly PlanPhase[],
  before: readonly PlanPhase[] = [],
): PhaseProblem | null {
  const known = new Set(phases.map((phase) => phase.id));
  const had = new Set(before.map((phase) => phase.id));
  for (const step of steps) {
    if (!step.phaseId || known.has(step.phaseId)) continue;
    return had.has(step.phaseId)
      ? {
          code: 'hub.plans.phase_in_use',
          phase: before.find((p) => p.id === step.phaseId)?.title ?? step.phaseId,
        }
      : { code: 'hub.plans.unknown_phase', phase: step.phaseId };
  }
  return null;
}

/** A step's done as its task moved it, with the time it became done (and none once it is not done). */
export function withDone(step: PlanStep, done: boolean, now: Date = new Date()): PlanStep {
  const { doneAt: _doneAt, ...rest } = step;
  return done
    ? { ...rest, done, doneAt: step.done && step.doneAt ? step.doneAt : now.toISOString() }
    : { ...rest, done };
}

const ROLE_SPECIALTY: Partial<Record<Role, Specialty>> = {
  backend: 'backend',
  frontend: 'frontend',
  designer: 'design',
  qa: 'qa',
};

/** The specialty of a step's task: its role's, or the given default. */
export function specialtyOfStep(step: PlanStep, fallback: Specialty): Specialty {
  return (step.role && ROLE_SPECIALTY[step.role]) || fallback;
}
