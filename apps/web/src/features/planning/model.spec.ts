/**
 * @file model.spec.ts
 * @description Which card the Planning page puts first, and the numbers it shows.
 */
import { describe, expect, it } from 'vitest';

import type { IdeaCard, PlanCard, Role } from '../cards/types';
import { excerptOf, isMineHere, pickFocal, progressOf } from './model';

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
