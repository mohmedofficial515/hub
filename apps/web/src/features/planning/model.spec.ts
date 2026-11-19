/**
 * @file model.spec.ts
 * @description Which card the Planning page puts first, and the numbers it shows.
 */
import { describe, expect, it } from 'vitest';

import type { IdeaCard, PlanCard, Role } from '../cards/types';
import {
  excerptOf,
  guideOf,
  ideaIdOfPlan,
  isMineHere,
  mergeSteps,
  pickFocal,
  planFacts,
  planIdOfIdea,
  progressOf,
} from './model';

const owner: Role[] = ['owner'];
const backend: Role[] = ['backend'];

function plan(
  key: string,
  status: string,
  over: Partial<PlanCard> = {},
  steps: PlanCard['plan']['steps'] = [],
) {
  return {
    key,
    type: 'plan',
    status,
    priority: 'P2',
    ownerRole: null,
    createdById: 'someone',
    assigneeId: undefined,
    lastEventAt: '2026-11-01T00:00:00.000Z',
    plan: { body: '', steps },
    ...over,
  } as PlanCard;
}

function idea(key: string, status: string, over: Partial<IdeaCard> = {}) {
  return {
    key,
    type: 'idea',
    status,
    priority: 'P2',
    ownerRole: null,
    createdById: 'someone',
    lastEventAt: '2026-11-01T00:00:00.000Z',
    idea: {},
    ...over,
  } as IdeaCard;
}

const step = (id: string, over = {}) => ({ id, title: id, done: false, ...over });

describe('pickFocal', () => {
  it('puts a plan waiting for approval before everything', () => {
    const focal = pickFocal(
      [idea('I', 'exploring'), plan('D', 'draft'), plan('R', 'in_review')],
      owner,
      'me',
    );
    expect(focal).toMatchObject({ card: { key: 'R' }, action: 'approve' });
  });

  it('turns to an idea when no plan needs anything', () => {
    const focal = pickFocal([idea('O', 'open'), idea('E', 'exploring')], owner, 'me');
    expect(focal).toMatchObject({ card: { key: 'E' }, action: 'to_plan' });
  });

  it('breaks a tie by priority', () => {
    const focal = pickFocal(
      [plan('LOW', 'in_review', { priority: 'P3' }), plan('HIGH', 'in_review', { priority: 'P0' })],
      owner,
      'me',
    );
    expect(focal?.card.key).toBe('HIGH');
  });

  it('shows a moving plan with no action to a member who can do nothing with it', () => {
    const focal = pickFocal([plan('M', 'in_progress', {}, [step('a', { taskKey: 'T-1' })])], backend, 'me');
    expect(focal).toMatchObject({ card: { key: 'M' } });
    expect(focal?.action).toBeUndefined();
  });

  it('never fills a button for a member who may not act', () => {
    expect(pickFocal([plan('R', 'in_review')], backend, 'me')).toBeNull();
    expect(pickFocal([idea('E', 'exploring')], backend, 'me')).toBeNull();
  });

  it('offers finishing a plan once all its steps are done', () => {
    const focal = pickFocal(
      [plan('F', 'in_progress', {}, [step('a', { taskKey: 'T-1', done: true })])],
      owner,
      'me',
    );
    expect(focal).toMatchObject({ card: { key: 'F' }, action: 'finish' });
  });
});

describe('progressOf', () => {
  it('counts done steps and steps with no task', () => {
    const counted = plan('P', 'draft', {}, [step('a', { done: true, taskKey: 'T-1' }), step('b')]);
    expect(progressOf(counted)).toEqual({ done: 1, total: 2, withoutTask: 1 });
  });
});

describe('isMineHere', () => {
  it('counts what I wrote and what is routed to my roles', () => {
    expect(isMineHere(idea('A', 'open', { createdById: 'me' }), 'me', backend)).toBe(true);
    expect(isMineHere(idea('B', 'open', { idea: { role: 'backend' } }), 'me', backend)).toBe(true);
    expect(isMineHere(plan('C', 'draft', {}, [step('a', { role: 'backend' })]), 'me', backend)).toBe(true);
    expect(isMineHere(plan('D', 'draft'), 'me', backend)).toBe(false);
  });
});

describe('excerptOf', () => {
  it('skips headings and drops Markdown marks', () => {
    expect(excerptOf('# Title\n\nUse **two** [steps](http://x).\n\nMore.')).toBe('Use two steps.');
    expect(excerptOf(undefined)).toBe('');
  });
});

describe('mergeSteps', () => {
  const before = [
    step('a', { taskKey: 'T-1', done: true, title: 'Build' }),
    step('b', { done: true, title: 'Talk to the supplier' }),
  ];

  it('keeps a step’s task, and its task’s done, whatever the form sent', () => {
    const out = mergeSteps(before, [{ id: 'a', title: 'Build it', done: false }]);
    expect(out).toEqual([{ id: 'a', title: 'Build it', taskKey: 'T-1', done: true }]);
  });

  it('takes the done it was sent for a step with no task, so a step done through Claude stays done', () => {
    expect(mergeSteps(before, [{ id: 'b', title: 'Talk', done: true }])[0]).toMatchObject({
      id: 'b',
      done: true,
    });
    expect(mergeSteps(before, [{ id: 'b', title: 'Talk', done: false }])[0]).toMatchObject({ done: false });
  });

  it('keeps a new step with an id for now, in the order sent', () => {
    const out = mergeSteps(before, [
      { title: 'New one', role: 'qa' },
      { id: 'a', title: 'Build' },
    ]);
    expect(out.map((s) => s.id)).toEqual(['tmp-0', 'a']);
    expect(out[0]).toEqual({ id: 'tmp-0', title: 'New one', role: 'qa', done: false });
  });
});

describe('guideOf', () => {
  it('asks for steps on a draft with none, and for review on one with steps', () => {
    expect(guideOf(plan('D', 'draft'), owner, 'me')).toEqual({ kind: 'noSteps' });
    expect(guideOf(plan('D', 'draft', {}, [step('a')]), owner, 'me')).toEqual({ kind: 'review' });
  });

  it('asks the one who may approve to approve, and tells anyone else who it waits for', () => {
    expect(guideOf(plan('R', 'in_review', {}, [step('a')]), owner, 'me')).toEqual({ kind: 'approve' });
    expect(guideOf(plan('R', 'in_review', {}, [step('a')]), backend, 'me')).toEqual({ kind: 'waitApproval' });
  });

  it('asks for tasks on an approved plan with steps that have none, else to start', () => {
    expect(
      guideOf(plan('A', 'approved', {}, [step('a'), step('b', { taskKey: 'T-2' })]), owner, 'me'),
    ).toEqual({
      kind: 'createTasks',
      n: 1,
    });
    expect(guideOf(plan('A', 'approved', {}, [step('a', { taskKey: 'T-1' })]), owner, 'me')).toEqual({
      kind: 'start',
    });
  });

  it('names the next step of a moving plan and its task, or says it has none, or that all are done', () => {
    const moving = plan('M', 'in_progress', {}, [
      step('a', { taskKey: 'T-1', done: true }),
      step('Ship it', { taskKey: 'T-2' }),
    ]);
    expect(guideOf(moving, owner, 'me')).toEqual({
      kind: 'step',
      index: 1,
      total: 2,
      title: 'Ship it',
      taskKey: 'T-2',
    });
    expect(guideOf(plan('M', 'in_progress', {}, [step('a')]), owner, 'me')).toEqual({
      kind: 'stepNoTask',
      index: 0,
      total: 1,
    });
    expect(
      guideOf(plan('M', 'in_progress', {}, [step('a', { done: true, taskKey: 'T-1' })]), owner, 'me'),
    ).toEqual({
      kind: 'finish',
    });
  });

  it('leaves an idea, and an ended plan, to their status', () => {
    expect(guideOf(idea('I', 'open'), owner, 'me')).toEqual({ kind: 'status' });
    expect(guideOf(plan('X', 'done'), owner, 'me')).toEqual({ kind: 'status' });
  });
});

describe('planFacts, planIdOfIdea, ideaIdOfPlan', () => {
  it('reads what the API keeps on the detail, and nothing that is not there', () => {
    const p = plan('P', 'approved', {
      plan: {
        body: '',
        steps: [],
        approvedById: 'u1',
        approvedAt: '2026-11-02T00:00:00.000Z',
        revision: 3,
        sourceIdeaId: 'i1',
      },
    } as unknown as Partial<PlanCard>);
    expect(planFacts(p)).toEqual({ approvedById: 'u1', approvedAt: '2026-11-02T00:00:00.000Z', revision: 3 });
    expect(ideaIdOfPlan(p)).toBe('i1');
    expect(planFacts(plan('Q', 'draft'))).toEqual({});
    expect(
      planIdOfIdea(idea('I', 'accepted', { idea: { planCardId: 'p1' } } as unknown as Partial<IdeaCard>)),
    ).toBe('p1');
    expect(planIdOfIdea(idea('J', 'open'))).toBeUndefined();
  });
});
