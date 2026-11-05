/**
 * @file Timeline collapse grouping.
 */
import { collapseTimeline } from './timeline';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 5, 12, minutes));
const event = (id: string, cardId: string, minutes: number, kind = 'commented') => ({
  id,
  cardId,
  kind,
  createdAt: at(minutes),
});

describe('collapseTimeline', () => {
  it('folds consecutive events of one card and lists the folded kinds', () => {
    const rows = collapseTimeline([
      event('3', 'a', 20, 'decided'),
      event('2', 'a', 10, 'commented'),
      event('1', 'a', 0, 'commented'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ collapsed: 2, collapsedKinds: ['commented'] });
    expect(rows[0]?.event.id).toBe('3');
    expect(rows[0]?.last.id).toBe('1');
  });

  it('another card between them breaks the row', () => {
    const rows = collapseTimeline([event('3', 'a', 20), event('2', 'b', 10), event('1', 'a', 0)]);
    expect(rows.map((row) => row.collapsed)).toEqual([0, 0, 0]);
  });

  it('a row spans at most 30 minutes from its newest event', () => {
    const rows = collapseTimeline([event('3', 'a', 55), event('2', 'a', 25), event('1', 'a', 20)]);
    expect(rows.map((row) => row.event.id)).toEqual(['3', '1']);
    expect(rows[0]?.collapsed).toBe(1);
  });

  it('leaves an empty list empty', () => {
    expect(collapseTimeline([])).toEqual([]);
  });
});
