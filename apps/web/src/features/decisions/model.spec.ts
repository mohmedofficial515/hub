/**
 * @file model.spec.ts
 * @description The docket's bands and what counts as routed to me.
 */
import { describe, expect, it } from 'vitest';

import type { DecisionCard } from '../cards/types';
import { bandOf, byDeadline, routedToMe } from './model';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function decision(over: Partial<DecisionCard> = {}, detail: Partial<DecisionCard['decision']> = {}) {
  return {
    key: 'D-1',
    priority: 'P2',
    decision: { deciderRole: 'owner', options: [], ...detail },
    ...over,
  } as DecisionCard;
}

describe('bandOf', () => {
  it('reads the deadline', () => {
    expect(bandOf(decision({ dueAt: inHours(-1) }))).toBe('overdue');
    expect(bandOf(decision({ dueAt: inHours(3) }))).toBe('soon');
    expect(bandOf(decision({ dueAt: inHours(48) }))).toBe('later');
    expect(bandOf(decision())).toBe('later');
  });

  it('treats an escalated decision as overdue, whatever its date', () => {
    expect(bandOf(decision({ dueAt: inHours(48) }, { escalatedAt: inHours(-1) }))).toBe('overdue');
  });
});

describe('byDeadline', () => {
  it('runs earliest first, with no deadline last', () => {
    const a = decision({ key: 'A', dueAt: inHours(5) });
    const b = decision({ key: 'B', dueAt: inHours(1) });
    const c = decision({ key: 'C' });
    expect([a, c, b].sort(byDeadline).map((d) => d.key)).toEqual(['B', 'A', 'C']);
  });
});

describe('routedToMe', () => {
  it('counts the decider and the escalation target', () => {
    expect(routedToMe(decision(), ['owner'])).toBe(true);
    expect(routedToMe(decision(), ['qa'])).toBe(false);
    expect(routedToMe(decision({}, { escalatedToRole: 'pm' }), ['pm'])).toBe(true);
  });
});
