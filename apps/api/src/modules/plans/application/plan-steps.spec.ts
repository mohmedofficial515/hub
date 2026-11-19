/**
 * @file Plan step normalisation.
 */
import { normalizeSteps, phaseProblem, specialtyOfStep, withDone } from './plan-steps';

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

describe('normalizeSteps with a step’s details (owner decision 9a)', () => {
  it('keeps why, size, after and acceptance', () => {
    const steps = normalizeSteps([
      { id: 's1', title: 'Schema', done: false, size: 'S' },
      {
        id: 's2',
        title: 'API',
        done: false,
        why: 'The page reads it.',
        size: 'M',
        after: ['s1'],
        acceptance: 'The e2e suite passes.',
      },
    ]);
    expect(steps[1]).toEqual({
      id: 's2',
      title: 'API',
      done: false,
      why: 'The page reads it.',
      size: 'M',
      after: ['s1'],
      acceptance: 'The e2e suite passes.',
    });
  });

  it('drops an after that names no earlier step: a later one, itself, or one that does not exist', () => {
    const steps = normalizeSteps([
      { id: 's1', title: 'One', done: false, after: ['s2'] },
      { id: 's2', title: 'Two', done: false, after: ['s2', 'nope', 's1', 's1'] },
    ]);
    expect(steps[0]?.after).toBeUndefined();
    expect(steps[1]?.after).toEqual(['s1']);
  });

  it('follows a step whose id Hub changed, so after still points at it', () => {
    const existing = [{ id: 's1', title: 'Settings', taskKey: 'GTV-322', done: true }];
    const steps = normalizeSteps(
      [
        { id: 's1', title: 'ADR', done: false },
        { id: 's2', title: 'Settings', taskKey: 'GTV-322', done: false, after: ['s1'] },
      ],
      existing,
    );
    const adr = steps[0]?.id;
    expect(adr).not.toBe('s1');
    expect(steps[1]).toMatchObject({ id: 's1', after: [adr] });
  });
});

describe('phases (v5-live-plan)', () => {
  const phases = [
    { id: 'p0', title: 'Setup' },
    { id: 'p1', title: 'Build' },
  ];

  it('keeps the phase a writer gives a step, and none when it gives none', () => {
    const steps = normalizeSteps([
      { title: 'Decide', done: false, phaseId: 'p0' },
      { title: 'Loose', done: false },
    ]);
    expect(steps.map((step) => step.phaseId ?? null)).toEqual(['p0', null]);
  });

  it('a plan with no phases and steps with none has no problem', () => {
    expect(phaseProblem(normalizeSteps([{ title: 'One', done: false }]), [])).toBeNull();
  });

  it('refuses a step that names a phase the plan does not have', () => {
    const steps = normalizeSteps([{ title: 'One', done: false, phaseId: 'p9' }]);
    expect(phaseProblem(steps, phases)).toEqual({ code: 'hub.plans.unknown_phase', phase: 'p9' });
  });

  it('refuses removing a phase that steps still name, by its title', () => {
    const steps = normalizeSteps([{ title: 'One', done: false, phaseId: 'p1' }]);
    expect(phaseProblem(steps, [phases[0]!], phases)).toEqual({
      code: 'hub.plans.phase_in_use',
      phase: 'Build',
    });
  });

  it('removing a phase is fine once its steps moved or left it in the same save', () => {
    const steps = normalizeSteps([
      { title: 'One', done: false, phaseId: 'p0' },
      { title: 'Two', done: false },
    ]);
    expect(phaseProblem(steps, [phases[0]!], phases)).toBeNull();
  });
});

describe('doneAt', () => {
  const now = new Date('2026-11-19T12:00:00.000Z');
  const later = new Date('2026-11-20T12:00:00.000Z');

  it('is set when a step that was not done becomes done, and kept while it stays done', () => {
    const [first] = normalizeSteps(
      [{ id: 's1', title: 'One', done: true }],
      [{ id: 's1', title: 'One', done: false }],
      now,
    );
    expect(first?.doneAt).toBe(now.toISOString());
    const [again] = normalizeSteps([{ id: 's1', title: 'Renamed', done: true }], [first!], later);
    expect(again?.doneAt).toBe(now.toISOString());
  });

  it('is never invented for a step that arrives done, and goes when the step is not done', () => {
    expect(normalizeSteps([{ title: 'Imported', done: true }], [], now)[0]).not.toHaveProperty('doneAt');
    const done = { id: 's1', title: 'One', done: true, doneAt: now.toISOString() };
    expect(normalizeSteps([{ id: 's1', title: 'One', done: false }], [done], later)[0]).not.toHaveProperty(
      'doneAt',
    );
  });

  it('follows a task: dated when it finishes, undated when it reopens', () => {
    const open = { id: 's1', title: 'One', taskKey: 'GTV-1', done: false };
    const done = withDone(open, true, now);
    expect(done).toMatchObject({ done: true, doneAt: now.toISOString() });
    expect(withDone(done, true, later).doneAt).toBe(now.toISOString());
    expect(withDone(done, false, later)).toEqual(open);
  });
});
