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

describe('normalizeSteps when a writer numbers the steps by position', () => {
  const existing = [
    { id: 's1', title: 'Settings', taskKey: 'GTV-322', done: true },
    { id: 's2', title: 'Verify phone', taskKey: 'GTV-323', done: false },
  ];

  it('keeps each task on the step that names it after a step is inserted above', () => {
    const steps = normalizeSteps(
      [
        { id: 's1', title: 'ADR', done: false },
        { id: 's2', title: 'Settings', taskKey: 'GTV-322', done: false },
        { id: 's3', title: 'Verify phone', taskKey: 'GTV-323', done: false },
      ],
      existing,
    );
    expect(steps.map((s) => [s.title, s.taskKey ?? null, s.done])).toEqual([
      ['ADR', null, false],
      ['Settings', 'GTV-322', true],
      ['Verify phone', 'GTV-323', false],
    ]);
    expect(new Set(steps.map((s) => s.id)).size).toBe(3);
    expect(steps[1]?.id).toBe('s1');
    expect(steps[2]?.id).toBe('s2');
  });

  it('does not hand a task to a step whose id matches but names another task', () => {
    const [step] = normalizeSteps([{ id: 's1', title: 'Other', taskKey: 'GTV-999', done: false }], existing);
    expect(step?.taskKey).toBe('GTV-999');
    expect(step?.id).not.toBe('s1');
  });
});

describe('specialtyOfStep', () => {
  it('maps a craft role, and falls back for others', () => {
    expect(specialtyOfStep({ id: 'a', title: 't', role: 'designer', done: false }, 'ops')).toBe('design');
    expect(specialtyOfStep({ id: 'a', title: 't', role: 'pm', done: false }, 'ops')).toBe('ops');
    expect(specialtyOfStep({ id: 'a', title: 't', done: false }, 'docs')).toBe('docs');
  });
});
