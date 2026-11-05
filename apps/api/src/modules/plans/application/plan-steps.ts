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
  const used = new Set<string>(existing.map((step) => step.id));
  let next = existing.length + 1;
  const freshId = (): string => {
    while (used.has(`s${next}`)) next += 1;
    const id = `s${next}`;
    used.add(id);
    return id;
  };
  return inputs.map((input) => {
    const before = input.id ? byId.get(input.id) : undefined;
    const id = input.id ?? freshId();
    used.add(id);
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
