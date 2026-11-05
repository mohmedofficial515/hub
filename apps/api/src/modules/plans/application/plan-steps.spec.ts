/**
 * @file Plan step normalisation.
 */
import { normalizeSteps, specialtyOfStep } from './plan-steps';

describe('normalizeSteps', () => {
  it('gives each new step an id', () => {
    const steps = normalizeSteps([
      { title: 'One', done: false },
      { title: 'Two', done: false },
    ]);
    expect(steps.map((step) => step.id)).toEqual(['s1', 's2']);
  });

  it('a step with a task keeps its task and its done, whatever the client sends', () => {
    const existing = [{ id: 's1', title: 'One', taskKey: 'GTV-1', done: true }];
    const [step] = normalizeSteps([{ id: 's1', title: 'Renamed', done: false }], existing);
    expect(step).toEqual({ id: 's1', title: 'Renamed', taskKey: 'GTV-1', done: true });
  });

  it('a step with no task takes done from the client', () => {
    const [step] = normalizeSteps(
      [{ id: 's1', title: 'One', done: true }],
      [{ id: 's1', title: 'One', done: false }],
    );
    expect(step?.done).toBe(true);
  });

  it('does not reuse an existing id for a new step', () => {
    const steps = normalizeSteps(
      [
        { id: 's2', title: 'Kept', done: false },
        { title: 'New', done: false },
      ],
      [{ id: 's2', title: 'Kept', done: false }],
    );
    expect(steps.map((step) => step.id)).toEqual(['s2', 's3']);
  });
});

describe('specialtyOfStep', () => {
  it('maps a craft role, and falls back for others', () => {
    expect(specialtyOfStep({ id: 'a', title: 't', role: 'designer', done: false }, 'ops')).toBe('design');
    expect(specialtyOfStep({ id: 'a', title: 't', role: 'pm', done: false }, 'ops')).toBe('ops');
    expect(specialtyOfStep({ id: 'a', title: 't', done: false }, 'docs')).toBe('docs');
  });
});
