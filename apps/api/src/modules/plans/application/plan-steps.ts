/**
 * @file The steps of a plan: giving each an id, and what a client may not change.
 * @description A step with a task follows its task (docs/15 §4), so an edit keeps its `taskKey` and `done`.
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
  return inputs.map((input) => {
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
    };
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
