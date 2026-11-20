/**
 * @file Editing a plan's phases: fresh ids, moves, and removing a phase in use without ever sending what the API refuses.
 */
import { describe, expect, it } from 'vitest';

import { freshPhaseId, moved, phaseDrafts, phasesToSave, removePhase, stepsIn } from './phase-edit';

const phases = phaseDrafts([
  { id: 'p0', title: 'Setup', note: 'The owner' },
  { id: 'p1', title: 'Build' },
]);
const steps = [
  { id: 's1', phaseId: 'p0' },
  { id: 's2', phaseId: 'p1' },
  { id: 's3', phaseId: '' },
];

describe('phase editing', () => {
  it('gives a new phase an id no phase has, nor had in this edit', () => {
    expect(freshPhaseId(phases)).toBe('p2');
    expect(freshPhaseId([{ id: 'p0' }], ['p1'])).toBe('p2');
    expect(freshPhaseId([])).toBe('p0');
  });

  it('moves a phase, and leaves the list as it is at either end', () => {
    expect(moved(phases, 1, -1).map((p) => p.id)).toEqual(['p1', 'p0']);
    expect(moved(phases, 0, -1).map((p) => p.id)).toEqual(['p0', 'p1']);
    expect(moved(phases, 1, 1).map((p) => p.id)).toEqual(['p0', 'p1']);
  });

  it('removes a phase and moves its steps to another, or to none', () => {
    expect(stepsIn(steps, 'p0')).toBe(1);
    const into = removePhase(phases, steps, 'p0', 'p1');
    expect(into.phases.map((p) => p.id)).toEqual(['p1']);
    expect(into.steps.map((s) => s.phaseId)).toEqual(['p1', 'p1', '']);
    const loose = removePhase(phases, steps, 'p0');
    expect(loose.steps.map((s) => s.phaseId)).toEqual(['', 'p1', '']);
    // A target that is the removed phase, or no phase left, means none.
    expect(removePhase(phases, steps, 'p0', 'p0').steps[0]?.phaseId).toBe('');
    expect(removePhase(phases, steps, 'p0', 'p9').steps[0]?.phaseId).toBe('');
  });

  it('saves trimmed titles, and a note only when there is one', () => {
    expect(phasesToSave([{ uid: 'x', id: 'p0', title: ' A ', note: '  ' }])).toEqual([
      { id: 'p0', title: 'A' },
    ]);
    expect(phasesToSave(phases)).toEqual([
      { id: 'p0', title: 'Setup', note: 'The owner' },
      { id: 'p1', title: 'Build' },
    ]);
  });
});
