/**
 * @file The steps of a plan: giving each an id, and what a client may not change.
 * @description A step with a task follows its task (docs/15 §4), so an edit keeps its `taskKey` and `done`. Its why, size, after and acceptance
 * are the writer's (owner decision 9a).
 */
import type { PlanStep, PlanStepInput, Role, Specialty } from '@hub/contracts';

export function normalizeSteps(
  inputs: readonly PlanStepInput[],
  existing: readonly PlanStep[] = [],
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
    return {
      id,
      title: input.title,
      ...(input.role ? { role: input.role } : {}),
      ...(taskKey ? { taskKey } : {}),
      done: before?.taskKey ? before.done : (input.done ?? false),
      ...(input.why ? { why: input.why } : {}),
      ...(input.size ? { size: input.size } : {}),
      ...(input.acceptance ? { acceptance: input.acceptance } : {}),
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
