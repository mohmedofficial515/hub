/**
 * @file Do next (docs/16 §11): which open work to offer first, and why, from real state only.
 */
import { describe, expect, it } from 'vitest';

import type { CardSummary } from './cards';
import { doNext, type DoNextCard } from './do-next';

const NOW = Date.parse('2026-11-06T12:00:00Z');

const card = (key: string, extra: Partial<DoNextCard> = {}): DoNextCard => ({
  key,
  type: 'task',
  title: `Title of ${key}`,
  status: 'ready',
  priority: 'P2',
  ownerRole: 'backend',
  blocksCount: 0,
  awaiting: null,
  archivedAt: null,
  closedAt: null,
  dueAt: null,
  flags: { blocked: false, overdue: false },
  ...extra,
});

const keys = (items: readonly { key: string }[]) => items.map((item) => item.key);

describe('what is offered', () => {
  it('a ready or claimed task, and an open decision', () => {
    const items = doNext(
      [card('A-1'), card('A-2', { status: 'claimed' }), card('A-3', { type: 'decision', status: 'open' })],
      {},
    );
    expect(keys(items).sort()).toEqual(['A-1', 'A-2', 'A-3']);
  });

  it.each(['backlog', 'in_progress', 'in_review', 'done', 'cancelled'])(
    'not a task that is %s: it is not waiting to be started',
    (status) => {
      expect(doNext([card('A-1', { status })], {})).toEqual([]);
    },
  );

  it.each(['decided', 'withdrawn', 'superseded'])('not a decision that is %s', (status) => {
    expect(doNext([card('A-1', { type: 'decision', status })], {})).toEqual([]);
  });

  it('not any other type, whatever its status says', () => {
    expect(doNext([card('A-1', { type: 'idea', status: 'open' })], {})).toEqual([]);
    expect(doNext([card('A-2', { type: 'need', status: 'ready' })], {})).toEqual([]);
  });

  it('not blocked, not archived, not closed', () => {
    const items = doNext(
      [
        card('A-1', { flags: { blocked: true, overdue: false } }),
        card('A-2', { archivedAt: '2026-01-01T00:00:00Z' }),
        card('A-3', { closedAt: '2026-01-01T00:00:00Z' }),
      ],
      {},
    );
    expect(items).toEqual([]);
  });
});

describe('roles', () => {
  const cards = [
    card('A-1', { ownerRole: 'backend' }),
    card('A-2', { ownerRole: 'frontend' }),
    card('A-3', { ownerRole: null }),
  ];

  it('a role sees what its role owns', () => {
    expect(keys(doNext(cards, { role: 'backend' }))).toEqual(['A-1']);
  });

  it('the owner sees all, and so does no role at all', () => {
    expect(doNext(cards, { role: 'owner' })).toHaveLength(3);
    expect(doNext(cards, { role: null })).toHaveLength(3);
    expect(doNext(cards, {})).toHaveLength(3);
  });
});

describe('the score', () => {
  it('overdue 100, each blocked card 30, P0 25, P1 12', () => {
    const score = (extra: Partial<DoNextCard>) => doNext([card('A-1', extra)], {})[0]?.score;
    expect(score({})).toBe(0);
    expect(score({ flags: { blocked: false, overdue: true } })).toBe(100);
    expect(score({ blocksCount: 2 })).toBe(60);
    expect(score({ priority: 'P0' })).toBe(25);
    expect(score({ priority: 'P1' })).toBe(12);
    expect(score({ priority: 'P0', blocksCount: 1, flags: { blocked: false, overdue: true } })).toBe(155);
  });

  it('a due date in the past is overdue when the time is given, and only then', () => {
    const late = card('A-1', { dueAt: '2026-11-01T00:00:00Z' });
    const later = card('A-2', { dueAt: '2026-12-01T00:00:00Z' });
    expect(doNext([late], { nowMs: NOW })[0]).toMatchObject({ score: 100, reasons: ['overdue', 'ready'] });
    expect(doNext([later], { nowMs: NOW })[0]?.score).toBe(0);
    expect(doNext([late], {})[0]?.score).toBe(0);
  });

  it('highest first, and a tie goes by key, in number order', () => {
    const items = doNext(
      [card('A-10'), card('A-2'), card('A-3', { priority: 'P1' }), card('A-4', { blocksCount: 1 })],
      {},
    );
    expect(keys(items)).toEqual(['A-4', 'A-3', 'A-2', 'A-10']);
  });

  it('a limit keeps the best', () => {
    const items = doNext([card('A-1'), card('A-2', { priority: 'P0' }), card('A-3')], { limit: 2 });
    expect(keys(items)).toEqual(['A-2', 'A-1']);
  });
});

describe('an item', () => {
  it('a task can run, and says why, with how many it blocks', () => {
    const [item] = doNext([card('A-1', { blocksCount: 2, flags: { blocked: false, overdue: true } })], {});
    expect(item).toEqual({
      key: 'A-1',
      type: 'task',
      title: 'Title of A-1',
      reasons: ['overdue', 'blocks', 'ready'],
      blocks: 2,
      runnable: true,
      score: 160,
    });
  });

  it('a decision cannot run: someone decides it', () => {
    const [item] = doNext([card('A-1', { type: 'decision', status: 'open' })], {});
    expect(item).toMatchObject({ reasons: ['decision'], runnable: false, blocks: 0 });
  });

  it('a whole CardSummary is accepted', () => {
    const summary: CardSummary = {
      ...card('A-1'),
      id: 'x',
      type: 'task',
      priority: 'P2',
      assignee: null,
      module: null,
      repo: null,
      branch: null,
      tags: [],
      commentCount: 0,
      lastEventAt: '2026-11-06T00:00:00Z',
      createdAt: '2026-11-06T00:00:00Z',
      createdBy: { kind: 'user', userId: null, displayName: null, via: 'web' },
      source: 'manual',
      flags: { blocked: false, overdue: false, escalated: false, stale: false, noSummary: false },
    };
    expect(keys(doNext([summary], {}))).toEqual(['A-1']);
  });
});
