/**
 * @file Inbox grouping: a `groupKey` merges within 30 minutes, and read never hides behind unread (docs/04 §3.17).
 */
import type { InboxItem } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { FAMILIES, groupItems, KINDS_OF, sectionsOf } from './group';

const item = (id: string, createdAt: string, over: Partial<InboxItem> = {}): InboxItem => ({
  id,
  kind: 'watch_update',
  title: id,
  body: null,
  card: null,
  data: {},
  groupKey: 'g',
  createdAt,
  readAt: null,
  archivedAt: null,
  ...over,
});

describe('groupItems', () => {
  it('merges one key within 30 minutes', () => {
    const groups = groupItems([
      item('a', '2026-11-05T10:30:00Z'),
      item('b', '2026-11-05T10:10:00Z'),
      item('c', '2026-11-05T09:00:00Z'),
    ]);
    expect(groups.map((g) => g.ids)).toEqual([['a', 'b'], ['c']]);
    expect(groups[0]?.more).toBe(1);
  });

  it('never merges read with unread, or items with no key', () => {
    const at = '2026-11-05T10:00:00Z';
    expect(groupItems([item('a', at), item('b', at, { readAt: at })])).toHaveLength(2);
    expect(groupItems([item('a', at, { groupKey: null }), item('b', at, { groupKey: null })])).toHaveLength(
      2,
    );
  });
});

describe('sectionsOf', () => {
  it('sorts into today, yesterday and earlier, dropping empty ones', () => {
    const groups = groupItems([
      item('a', '2026-11-05T10:00:00Z', { groupKey: null }),
      item('b', '2026-10-01T10:00:00Z', { groupKey: null }),
    ]);
    const out = sectionsOf(groups, (iso) => iso.slice(0, 10), '2026-11-05', '2026-11-04');
    expect(out.map((s) => s.id)).toEqual(['today', 'earlier']);
  });
});

describe('KINDS_OF', () => {
  it('gives each kind one family', () => {
    const all = FAMILIES.flatMap((family) => KINDS_OF[family]);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(14);
  });
});
