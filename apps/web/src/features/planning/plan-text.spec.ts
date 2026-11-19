import { planToMarkdown, type ProposedPlan } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar/planning.json';
import en from '../../../messages/en/planning.json';
import { fitStepTitle, planBody } from './plan-studio';
import {
  AFTER_WORDS,
  readPlanText,
  sectionCount,
  splitPlanText,
  stepExtras,
  STEPS_HEADINGS,
} from './plan-text';

const plan: ProposedPlan = {
  title: 'Hotel bookings',
  goal: 'Sell hotels with one supplier.',
  approach: 'Start with the sandbox, then go live.',
  steps: [
    { title: 'Sign the supplier', role: 'pm', size: 'S', why: 'Nothing moves without the contract.' },
    {
      title: 'Build the search',
      role: 'backend',
      size: 'L',
      after: [1],
      why: 'Search: the first thing a customer sees.',
    },
    { title: 'Ship it', after: [1, 2] },
  ],
  checks: ['A booking reaches the supplier'],
  risks: ['Rates change daily'],
};

const stepsOf = (p: ProposedPlan) => p.steps.map((s) => ({ title: fitStepTitle(s.title) }));

describe('the words the split looks for', () => {
  it('are both catalogs’ own', () => {
    expect([...STEPS_HEADINGS].sort()).toEqual([en.planText.steps, ar.planText.steps].sort());
    expect([...AFTER_WORDS].sort()).toEqual([en.planText.after, ar.planText.after].sort());
  });
});

describe('splitPlanText', () => {
  it('takes the steps out of an English plan text and reads each one’s reason, size and the steps before it', () => {
    const body = planBody(plan);
    const { rest, extras } = splitPlanText(body, stepsOf(plan));
    expect(rest).not.toMatch(/## Steps/);
    expect(rest).not.toMatch(/Sign the supplier/);
    expect(rest).toMatch(/## Goal/);
    expect(rest).toMatch(/## Checks/);
    expect(extras).toEqual([
      { why: 'Nothing moves without the contract.', size: 'S' },
      { why: 'Search: the first thing a customer sees.', size: 'L', after: [1] },
      { after: [1, 2] },
    ]);
  });

  it('reads an Arabic plan text', () => {
    const words = { ...ar.planText, roles: { pm: 'مدير المشروع', backend: 'الخلفية' } };
    const body = planBody(plan, words);
    const { rest, extras } = splitPlanText(body, stepsOf(plan));
    expect(rest).not.toMatch(/## الخطوات/);
    expect(rest).toMatch(/## الهدف/);
    expect(extras?.[1]).toEqual({ why: 'Search: the first thing a customer sees.', size: 'L', after: [1] });
    expect(extras?.[2]).toEqual({ after: [1, 2] });
  });

  it('matches a step whose title was cut to fit a card', () => {
    const long = `${'A very long step title that keeps going, '.repeat(6)}and ends here`;
    const p: ProposedPlan = { ...plan, steps: [{ title: long, size: 'M', why: 'Because.' }] };
    const steps = stepsOf(p);
    expect(steps[0]!.title.endsWith('…')).toBe(true);
    const { extras } = splitPlanText(planBody(p), steps);
    expect(extras).toEqual([{ why: 'Because.', size: 'M' }]);
  });

  it('reads a plan with no goal or approach, whose text starts with the list', () => {
    const p: ProposedPlan = { title: 'Small', steps: [{ title: 'One' }, { title: 'Two', size: 'S' }] };
    const { rest, extras } = splitPlanText(planBody(p), stepsOf(p));
    expect(rest).toBe('');
    expect(extras).toEqual([{}, { size: 'S' }]);
  });

  it('leaves a hand-written text, or one with a different number of steps, as it is', () => {
    const hand = '## Approach\n\nWe do it carefully.\n\n## Steps\n\n1. Something else\n2. Another';
    expect(splitPlanText(hand, [{ title: 'Sign the supplier' }, { title: 'Ship it' }])).toEqual({
      rest: hand,
      extras: null,
    });
    const body = planBody(plan);
    expect(splitPlanText(body, stepsOf(plan).slice(0, 2))).toEqual({ rest: body, extras: null });
    expect(splitPlanText('Just a line.', [{ title: 'x' }])).toEqual({ rest: 'Just a line.', extras: null });
  });

  it('counts the sections of a text', () => {
    expect(sectionCount(planToMarkdown(plan))).toBeGreaterThan(2);
    expect(sectionCount('Plain words')).toBe(0);
  });
});

describe('a step’s details as data (owner decision 9a)', () => {
  const saved = [
    { id: 's1', title: 'Sign the supplier', size: 'S' as const, why: 'Nothing moves without the contract.' },
    { id: 's2', title: 'Build the search', after: ['s1'], acceptance: 'A search returns rates.' },
    { id: 's3', title: 'Ship it', after: ['s1', 's2', 'gone'] },
  ];

  it('reads why, size, after (as step numbers) and acceptance from the steps', () => {
    expect(stepExtras(saved)).toEqual([
      { why: 'Nothing moves without the contract.', size: 'S' },
      { after: [1], acceptance: 'A search returns rates.' },
      { after: [1, 2] },
    ]);
  });

  it('is null for steps that carry none of them: an older plan', () => {
    expect(stepExtras([{ id: 's1' }])).toBeNull();
  });

  it('prefers the data, and still takes the steps’ list out of the text', () => {
    const body = planBody(plan);
    const read = readPlanText(
      body,
      saved.map((s, i) => ({ ...s, title: fitStepTitle(plan.steps[i]!.title) })),
    );
    expect(read.extras?.[1]).toEqual({ after: [1], acceptance: 'A search returns rates.' });
    expect(read.rest).not.toContain('1. Sign the supplier');
  });

  it('falls back to the text for an older plan whose steps carry nothing', () => {
    const body = planBody(plan);
    const read = readPlanText(
      body,
      stepsOf(plan).map((s, i) => ({ ...s, id: `s${i + 1}` })),
    );
    expect(read.extras?.[0]).toEqual({ why: 'Nothing moves without the contract.', size: 'S' });
  });
});
