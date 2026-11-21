/**
 * @file The journey's derived facts: phases, effort, what a step waits for, and the finish estimate.
 */
import { describe, expect, it } from 'vitest';

import type { PlanStep } from '../cards/types';
import {
  blockersOf,
  effortOf,
  finishEstimate,
  journeySteps,
  nextStepOf,
  phaseGroups,
  phaseState,
  SIZE_WEIGHT,
  toneOf,
} from './journey';

const step = (id: string, over: Partial<PlanStep> = {}): PlanStep => ({
  id,
  title: `Step ${id}`,
  done: false,
  ...over,
});
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 12)).toISOString();

describe('phaseGroups', () => {
  const phases = [
    { id: 'p0', title: 'Setup' },
    { id: 'p1', title: 'Build', note: 'Frontend' },
  ];

  it('groups steps under their phase in phase order, keeping each step’s number in the plan', () => {
    const steps = journeySteps([
      step('a', { phaseId: 'p1', role: 'frontend' }),
      step('b', { phaseId: 'p0', done: true }),
      step('c', { phaseId: 'p1', role: 'frontend' }),
    ]);
    const groups = phaseGroups(phases, steps);
    expect(groups.map((g) => [g.phase?.id, g.steps.map((s) => s.n)])).toEqual([
      ['p0', [2]],
      ['p1', [1, 3]],
    ]);
    expect(groups[1]).toMatchObject({
      done: 0,
      total: 2,
      hasNext: true,
      roles: [{ role: 'frontend', n: 2 }],
    });
    expect(groups[0]?.hasNext).toBe(false);
  });

  it('a plan saved before phases is one unnamed group', () => {
    const groups = phaseGroups([], journeySteps([step('a'), step('b')]));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ phase: null, index: 0, total: 2, hasNext: true });
  });

  it('a step outside any phase, or naming one that is gone, goes last in the unnamed group', () => {
    const groups = phaseGroups(
      phases,
      journeySteps([step('a', { phaseId: 'p0' }), step('b'), step('c', { phaseId: 'x' })]),
    );
    expect(groups.map((g) => g.phase?.id ?? null)).toEqual(['p0', 'p1', null]);
    expect(groups[2]?.steps.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('keeps every one of 20 phases, with tones cycling over eight', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, title: `Phase ${i}` }));
    const groups = phaseGroups(many, journeySteps(many.map((p) => step(p.id, { phaseId: p.id }))));
    expect(groups).toHaveLength(20);
    expect([toneOf(0), toneOf(7), toneOf(8), toneOf(19)]).toEqual(['0', '7', '0', '3']);
  });
});

describe('phaseState', () => {
  it('says done, now or todo', () => {
    expect(phaseState({ done: 2, total: 2, hasNext: false })).toBe('done');
    expect(phaseState({ done: 1, total: 2, hasNext: true })).toBe('now');
    expect(phaseState({ done: 1, total: 2, hasNext: false })).toBe('todo');
    expect(phaseState({ done: 0, total: 0, hasNext: false })).toBe('todo');
  });
});

describe('journeySteps', () => {
  it('reads an older plan’s details from its text, after by number', () => {
    const [, second] = journeySteps([step('a'), step('b')], [{}, { why: 'Because', size: 'L', after: [1] }]);
    expect(second).toMatchObject({ n: 2, why: 'Because', size: 'L', after: ['a'] });
  });

  it('dates a done step by its task when Hub has no date for the step', () => {
    const steps = journeySteps(
      [step('a', { done: true, taskKey: 'T-1' }), step('b', { done: true, doneAt: day(3), taskKey: 'T-2' })],
      null,
      () => day(9),
    );
    expect(steps.map((s) => s.doneAt)).toEqual([day(9), day(3)]);
  });
});

describe('effortOf and blockersOf', () => {
  it('weighs S 1, M 3, L 8, and a step with no size as M', () => {
    expect(SIZE_WEIGHT).toEqual({ S: 1, M: 3, L: 8 });
    expect(effortOf([step('a', { size: 'S', done: true }), step('b', { size: 'L' }), step('c')])).toEqual({
      done: 1,
      review: 0,
      total: 12,
    });
  });

  it('names the steps a step still waits for, and none once they are done', () => {
    const all = journeySteps([step('a', { done: true }), step('b'), step('c', { after: ['a', 'b'] })]);
    expect(blockersOf(all[2]!, all).map((s) => s.n)).toEqual([2]);
    expect(blockersOf(all[1]!, all)).toEqual([]);
  });
});

describe('finishEstimate', () => {
  const now = new Date(day(11));

  it('is null with fewer than three dated done steps', () => {
    expect(
      finishEstimate(
        [step('a', { done: true, doneAt: day(9) }), step('b', { done: true, doneAt: day(10) }), step('c')],
        now,
      ),
    ).toBeNull();
    expect(
      finishEstimate(
        [step('a', { done: true }), step('b', { done: true }), step('c', { done: true }), step('d')],
        now,
      ),
    ).toBeNull();
  });

  it('applies the pace so far to what is left', () => {
    // 3 M steps (9 points) over the 10 days since the first: 0.9 a day. 2 L steps left: 16 points, so about 17.8 days.
    const steps = [
      step('a', { done: true, doneAt: day(1) }),
      step('b', { done: true, doneAt: day(5) }),
      step('c', { done: true, doneAt: day(10) }),
      step('d', { size: 'L' }),
      step('e', { size: 'L' }),
    ];
    const estimate = finishEstimate(steps, now);
    expect(estimate?.left).toBe(16);
    expect(estimate?.pace).toBeCloseTo(0.9);
    expect(Math.round(((estimate?.date.getTime() ?? 0) - now.getTime()) / 86_400_000)).toBe(18);
  });

  it('is null when nothing is left', () => {
    const steps = [1, 2, 3].map((d) => step(`s${d}`, { done: true, doneAt: day(d) }));
    expect(finishEstimate(steps, now)).toBeNull();
  });
});

describe('steps in review', () => {
  const phases = [
    { id: 'p0', title: 'Setup' },
    { id: 'p1', title: 'Build' },
  ];
  const plan = [
    step('a', { phaseId: 'p0', taskKey: 'T-1', role: 'owner' }),
    step('b', { phaseId: 'p1', taskKey: 'T-2', size: 'L' }),
    step('c', { phaseId: 'p1', taskKey: 'T-3', done: true }),
    step('d', { phaseId: 'p1', taskKey: 'T-4' }),
  ];
  const reviewing = new Set(['T-2', 'T-3', 'T-4']);
  const steps = journeySteps(plan, null, undefined, (key) => reviewing.has(key));

  it('marks a step whose task waits in review, but never a done one or one without a task', () => {
    expect(steps.map((s) => !!s.review)).toEqual([false, true, false, true]);
    const loose = journeySteps([step('x')], null, undefined, () => true);
    expect(loose[0]!.review).toBeUndefined();
  });

  it('counts review apart from done, in steps and in effort', () => {
    const [p0, p1] = phaseGroups(phases, steps);
    expect([p0!.done, p0!.review, p1!.done, p1!.review]).toEqual([0, 0, 1, 2]);
    expect(effortOf(steps)).toEqual({ done: 3, review: 11, total: 17 });
  });

  it('a phase with only steps in review is not done', () => {
    const [, p1] = phaseGroups(
      phases,
      journeySteps(plan.slice(1, 2), null, undefined, () => true),
    );
    expect(phaseState(p1!)).not.toBe('done');
  });

  it('the next step skips steps in review, and falls back to them when nothing else is left', () => {
    expect(nextStepOf(steps)?.id).toBe('a');
    const onlyReview = journeySteps(plan.slice(1), null, undefined, (key) => reviewing.has(key));
    expect(nextStepOf(onlyReview)?.id).toBe('b');
  });
});
