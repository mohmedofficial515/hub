/**
 * @file Today's three lists never repeat a card (owner decision 4): Do next leaves out what Awaiting me lists, and still fills to its limit.
 */
import type { DoNextItem } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { shownDoNext } from '@/components/workbench/panels';

const item = (key: string): DoNextItem => ({
  key,
  type: 'task',
  title: key,
  reasons: ['ready'],
  blocks: 0,
  runnable: true,
  score: 1,
});

describe('shownDoNext', () => {
  const ranked = ['GTV-1', 'GTV-2', 'GTV-3', 'GTV-4', 'GTV-5', 'GTV-6', 'GTV-7'].map(item);

  it('keeps the ranking and its limit when nothing is left out', () => {
    expect(shownDoNext(ranked, undefined, 3).map((i) => i.key)).toEqual(['GTV-1', 'GTV-2', 'GTV-3']);
    expect(shownDoNext(ranked, new Set(), 3)).toHaveLength(3);
  });

  it('leaves out the cards another list shows, and fills from further down', () => {
    const shown = shownDoNext(ranked, new Set(['GTV-1', 'GTV-3']), 5);
    expect(shown.map((i) => i.key)).toEqual(['GTV-2', 'GTV-4', 'GTV-5', 'GTV-6', 'GTV-7']);
  });
});
