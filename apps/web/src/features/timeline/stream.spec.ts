/**
 * @file The Timeline's live rule (docs/09 §5): what holds still, what the pill counts, where the last-visit line and pauses go.
 */
import { describe, expect, it } from 'vitest';

import type { CardEvent, HubCard } from '@/features/cards/types';

import {
  buildDays,
  buildRail,
  foldedEvents,
  freshIds,
  newestOfCard,
  reconcile,
  type StreamRow,
} from './stream';

const row = (id: string, key: string, atIso: string, collapsed = 0, status = 'open'): StreamRow => ({
  id,
  event: { id, seq: 1, kind: 'status_changed', actorKind: 'user', via: 'web', at: atIso, data: {} },
  card: { key, status } as HubCard,
  collapsed,
  collapsedKinds: [],
});

const T = (hour: number) => `2026-11-05T${String(hour).padStart(2, '0')}:00:00.000Z`;
const dayOf = (iso: string) => iso.slice(0, 10);

describe('reconcile', () => {
  it('keeps the rows on screen and counts what arrived', () => {
    const shown = [row('b', 'K-2', T(10)), row('a', 'K-1', T(9))];
    const out = reconcile(shown, [row('c', 'K-3', T(11), 2), ...shown]);
    expect(out.rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(out.pending).toBe(3);
  });

  it('takes fresher card facts without moving anything', () => {
    const out = reconcile([row('a', 'K-1', T(9))], [row('a', 'K-1', T(9), 0, 'decided')]);
    expect(out.rows[0]?.card.status).toBe('decided');
    expect(out.pending).toBe(0);
  });

  it('drops a card that is gone, even while scrolled down', () => {
    const out = reconcile([row('b', 'K-2', T(10)), row('a', 'K-1', T(9))], [row('a', 'K-1', T(9))]);
    expect(out.rows.map((r) => r.id)).toEqual(['a']);
  });

  it('appends older pages below', () => {
    const out = reconcile([row('b', 'K-2', T(10))], [row('b', 'K-2', T(10)), row('a', 'K-1', T(9))]);
    expect(out.rows.map((r) => r.id)).toEqual(['b', 'a']);
    expect(out.pending).toBe(0);
  });

  it('counts one for an event folded into a row already seen', () => {
    const out = reconcile([row('a', 'K-1', T(9), 1)], [row('n', 'K-1', T(10), 2)]);
    expect(out.rows.map((r) => r.id)).toEqual(['a']);
    expect(out.pending).toBe(1);
  });
});

describe('freshIds', () => {
  it('marks only what is newer, and nothing on first load', () => {
    expect([...freshIds([], [row('a', 'K', T(9))])]).toEqual([]);
    expect([...freshIds([row('a', 'K', T(9))], [row('b', 'K', T(10)), row('a', 'K', T(9))])]).toEqual(['b']);
  });
});

describe('newestOfCard', () => {
  it('gives each card one row that may act', () => {
    const rows = [row('c', 'K-1', T(11)), row('b', 'K-2', T(10)), row('a', 'K-1', T(9))];
    expect([...newestOfCard(rows)]).toEqual(['c', 'b']);
  });
});

describe('foldedEvents', () => {
  const ev = (seq: number, kind = 'commit') => ({ seq, kind }) as CardEvent;
  it('takes the n before the row, leaving watches out', () => {
    const all = [ev(5), ev(4), ev(3, 'watched'), ev(2), ev(1)];
    expect(foldedEvents(all, { event: ev(5), collapsed: 2 }).map((e) => e.seq)).toEqual([4, 2]);
  });
});

describe('buildDays', () => {
  it('draws the last-visit line between the rows it separates', () => {
    const days = buildDays([row('b', 'K', T(10)), row('a', 'K', T(8))], T(9), dayOf);
    expect(days[0]?.slots.map((s) => s.kind)).toEqual(['row', 'tide', 'row']);
  });

  it('leaves the line out when every row is on one side', () => {
    expect(buildDays([row('b', 'K', T(10))], T(9), dayOf)[0]?.slots.map((s) => s.kind)).toEqual(['row']);
    expect(buildDays([row('a', 'K', T(8))], T(9), dayOf)[0]?.slots.map((s) => s.kind)).toEqual(['row']);
  });

  it('labels a pause of three hours or more, and counts folded events', () => {
    const days = buildDays([row('b', 'K', T(12), 3), row('a', 'K', T(8))], null, dayOf);
    expect(days[0]?.slots.map((s) => s.kind)).toEqual(['row', 'gap', 'row']);
    expect(days[0]?.count).toBe(5);
  });

  it('starts a new day where the date changes', () => {
    const days = buildDays([row('b', 'K', T(1)), row('a', 'K', '2026-11-04T23:00:00.000Z')], null, dayOf);
    expect(days.map((d) => d.key)).toEqual(['2026-11-05', '2026-11-04']);
    expect(buildRail([row('b', 'K', T(1)), row('a', 'K', T(2), 1)], dayOf)[0]?.count).toBe(3);
  });
});
