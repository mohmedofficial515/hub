/**
 * @file model.spec.ts
 * @description The Tasks page's order and Mine rule.
 */
import { describe, expect, it } from 'vitest';

import type { Role, TaskCard } from '../cards/types';
import { columnsOf, isMine, matchesFilters, sortList } from './model';

const roles: Role[] = ['backend'];

function task(key: string, over: Partial<TaskCard> = {}): TaskCard {
  return {
    key,
    type: 'task',
    status: 'ready',
    title: key,
    priority: 'P2',
    ownerRole: null,
    lastEventAt: new Date().toISOString(),
    task: { specialty: 'backend', origin: 'manual' },
    ...over,
  } as TaskCard;
}

describe('isMine', () => {
  it('holds what I claimed and what is ready for my roles, nothing else', () => {
    expect(isMine(task('A', { assigneeId: 'me', status: 'in_progress' }), 'me', roles)).toBe(true);
    expect(isMine(task('B', { ownerRole: 'backend' }), 'me', roles)).toBe(true);
    expect(isMine(task('C', { ownerRole: 'backend', status: 'backlog' }), 'me', roles)).toBe(false);
    expect(isMine(task('D', { ownerRole: 'qa' }), 'me', roles)).toBe(false);
  });
});

describe('columnsOf', () => {
  it('puts mine first, then priority, and leaves cancelled and old done off the board', () => {
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const columns = columnsOf(
      [
        task('P0', { priority: 'P0' }),
        task('MINE', { ownerRole: 'backend', priority: 'P3' }),
        task('GONE', { status: 'cancelled' }),
        task('OLD', { status: 'done', lastEventAt: old }),
        task('NEW', { status: 'done' }),
      ],
      'me',
      roles,
    );
    expect(columns.ready.map((c) => c.key)).toEqual(['MINE', 'P0']);
    expect(columns.done.map((c) => c.key)).toEqual(['NEW']);
  });
});

describe('sortList', () => {
  it('hides cancelled unless asked for, and sorts keys by number', () => {
    const cards = [task('T-10'), task('T-9'), task('T-1', { status: 'cancelled' })];
    const sorted = sortList(cards, { status: null, sort: 'key', desc: false }, 'me', roles);
    expect(sorted.map((c) => c.key)).toEqual(['T-9', 'T-10']);
    const cancelled = sortList(cards, { status: 'cancelled', sort: 'key', desc: false }, 'me', roles);
    expect(cancelled.map((c) => c.key)).toEqual(['T-1']);
  });
});

describe('matchesFilters', () => {
  const none = { specialties: [], priority: null, module: null, q: '', review: false, mine: false };
  it('reads each filter', () => {
    const card = task('GTV-1', { title: 'Refund flow', priority: 'P1' });
    expect(matchesFilters(card, { ...none, q: 'refund' }, 'me', roles)).toBe(true);
    expect(matchesFilters(card, { ...none, q: 'other' }, 'me', roles)).toBe(false);
    expect(matchesFilters(card, { ...none, priority: 'P0' }, 'me', roles)).toBe(false);
    expect(matchesFilters(card, { ...none, specialties: ['qa'] }, 'me', roles)).toBe(false);
    expect(matchesFilters(card, { ...none, review: true }, 'me', roles)).toBe(false);
  });
});
