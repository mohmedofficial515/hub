/**
 * @file phase-edit.ts
 * @description Editing a plan's phases in the sheet's form (v5-live-plan, batch 1 follow-up): fresh ids, moving and removing phases, and the rule the API
 * keeps (a step's phase must exist, a phase steps still name cannot go unless they move in the same save). The form never sends what the API would
 * refuse: removing a phase in use moves its steps first, to another phase or to none.
 */
import type { PlanPhase } from '@/features/cards/types';

/** A phase as the form holds it. `uid` is stable while editing; `id` is what the plan and its steps know it by. */
export interface PhaseDraft {
  uid: string;
  id: string;
  title: string;
  note: string;
}

/** The part of a step this module reads and writes: its phase, '' for none. */
export interface PhasedStep {
  phaseId: string;
}

/** The phases as the form starts them. */
export const phaseDrafts = (phases: readonly PlanPhase[]): PhaseDraft[] =>
  phases.map((phase) => ({ uid: phase.id, id: phase.id, title: phase.title, note: phase.note ?? '' }));

/** An id no phase of this plan has, nor had in this edit: `p<n>`, the smallest free n from the count up. */
export function freshPhaseId(
  phases: readonly Pick<PhaseDraft, 'id'>[],
  taken: Iterable<string> = [],
): string {
  const used = new Set([...phases.map((phase) => phase.id), ...taken]);
  let n = phases.length;
  while (used.has(`p${n}`)) n += 1;
  return `p${n}`;
}

/** Moves the item at `at` by `by` places, or returns the list unchanged at either end. */
export function moved<T>(list: readonly T[], at: number, by: number): T[] {
  const to = at + by;
  if (at < 0 || at >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(at, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** How many steps name this phase. */
export const stepsIn = (steps: readonly PhasedStep[], phaseId: string) =>
  steps.filter((step) => step.phaseId === phaseId).length;

/**
 * Removes a phase. Its steps move to `moveTo` (another phase's id, or '' for no phase) in the same edit, so the save is one the API accepts. A
 * `moveTo` that is the removed phase or names no phase left is treated as none.
 */
export function removePhase<S extends PhasedStep>(
  phases: readonly PhaseDraft[],
  steps: readonly S[],
  phaseId: string,
  moveTo = '',
): { phases: PhaseDraft[]; steps: S[] } {
  const left = phases.filter((phase) => phase.id !== phaseId);
  const target = moveTo && moveTo !== phaseId && left.some((phase) => phase.id === moveTo) ? moveTo : '';
  return {
    phases: left,
    steps: steps.map((step) => (step.phaseId === phaseId ? { ...step, phaseId: target } : step)),
  };
}

/** The phases as the API takes them: trimmed, with a note only when there is one. */
export const phasesToSave = (phases: readonly PhaseDraft[]): PlanPhase[] =>
  phases.map((phase) => ({
    id: phase.id,
    title: phase.title.trim(),
    ...(phase.note.trim() ? { note: phase.note.trim() } : {}),
  }));
