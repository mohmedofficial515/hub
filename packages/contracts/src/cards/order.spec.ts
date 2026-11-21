/**
 * @file The next decision is the same one on every page (review R8).
 */
import { describe, expect, it } from 'vitest';

import { compareKeys, compareWaiting } from './order';

const card = (key: string, dueAt: string | null, priority = 'P2') => ({ key, dueAt, priority });
const keys = (list: { key: string }[]) => list.map((c) => c.key);

describe('compareWaiting', () => {
  it('goes by deadline, then priority, then key', () => {
    const due = '2026-11-19T18:42:00.000Z';
    const list = [
      card('GTV-2', due),
      card('GTV-1', due),
      card('GTV-10', due),
      card('GTV-9', due, 'P0'),
      card('GTV-3', null, 'P0'),
      card('GTV-4', '2026-11-10T00:00:00.000Z'),
    ];
    expect(keys(list.sort(compareWaiting))).toEqual(['GTV-4', 'GTV-9', 'GTV-1', 'GTV-2', 'GTV-10', 'GTV-3']);
  });

  it('two without a deadline fall through to priority', () => {
    expect(compareWaiting(card('A-1', null, 'P3'), card('A-2', null, 'P1'))).toBeGreaterThan(0);
  });
});

describe('compareKeys', () => {
  it('reads the number as a number', () => {
    expect(['GTV-10', 'GTV-9'].sort(compareKeys)).toEqual(['GTV-9', 'GTV-10']);
  });
});
