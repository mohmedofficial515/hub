/**
 * @file Excerpts as segments, and how results are grouped.
 */
import { describe, expect, it } from 'vitest';

import { isSearchable, nextRecent, type SearchDto, toResults, toSegments } from './search';

describe('toSegments', () => {
  it('splits on mark and keeps the marked words', () => {
    expect(toSegments('the <mark>refund</mark> goes')).toEqual([
      { text: 'the ', mark: false },
      { text: 'refund', mark: true },
      { text: ' goes', mark: false },
    ]);
  });
  it('drops any other tag and shows entities as text, so markup cannot get in', () => {
    const out = toSegments('<script>alert(1)</script>a &lt;b&gt; <img src=x onerror=y>');
    expect(out).toEqual([{ text: 'alert(1)a <b> ', mark: false }]);
  });
  it('is empty for no excerpt', () => {
    expect(toSegments(null)).toEqual([]);
  });
});

const summary = (key: string) =>
  ({ id: key, key, type: 'task', title: key, status: 'ready', priority: 'P2', ownerRole: null }) as never;
const dto: SearchDto = {
  cards: [{ ...(summary('GTV-1') as object), highlight: 'x <mark>y</mark>' } as never, summary('GTV-2')],
  docs: [
    {
      card: summary('GTV-9'),
      path: 'docs/21.ar.md',
      chunks: [{ heading: 'H', anchor: 'h', excerpt: '<mark>z</mark>' }],
    },
  ],
};

describe('toResults', () => {
  it('groups docs and cards', () => {
    const r = toResults(dto, 'y', 'all');
    expect(r.cards.map((c) => c.key)).toEqual(['GTV-1', 'GTV-2']);
    expect(r.docs[0]).toMatchObject({ key: 'GTV-9', lang: 'ar', path: 'docs/21.ar.md' });
    expect(r.exactKey).toBe(false);
  });
  it('honours the scope', () => {
    expect(toResults(dto, 'y', 'docs').cards).toEqual([]);
    expect(toResults(dto, 'y', 'cards').docs).toEqual([]);
  });
  it('puts an exact key alone at the top', () => {
    const r = toResults(dto, 'gtv-2', 'all');
    expect(r.exactKey).toBe(true);
    expect(r.cards.map((c) => c.key)).toEqual(['GTV-2']);
    expect(r.docs).toEqual([]);
  });
});

describe('helpers', () => {
  it('needs two letters to search', () => {
    expect(isSearchable(' a ')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
  });
  it('keeps recents unique, newest first, six at most', () => {
    expect(nextRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
    expect(nextRecent(['1', '2', '3', '4', '5', '6'], '7')).toHaveLength(6);
  });
});
