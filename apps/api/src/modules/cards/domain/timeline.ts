/**
 * @file The timeline's collapse hint (docs/03 §5.2): consecutive events of one card within 30 minutes are one row.
 */
export const COLLAPSE_WINDOW_MS = 30 * 60 * 1000;

export interface TimelineEvent {
  readonly id: string;
  readonly cardId: string;
  readonly kind: string;
  readonly createdAt: Date;
}

export interface CollapsedRow<E extends TimelineEvent> {
  /** The newest event of the row. */
  readonly event: E;
  /** The oldest: paging continues after it. */
  readonly last: E;
  /** How many more events the row folds. */
  readonly collapsed: number;
  /** Distinct kinds of the folded events, the shown one excluded. */
  readonly collapsedKinds: readonly string[];
}

/** `events` come newest first. A row spans at most the window, measured from its newest event. */
export function collapseTimeline<E extends TimelineEvent>(events: readonly E[]): CollapsedRow<E>[] {
  const rows: { event: E; last: E; folded: E[] }[] = [];
  for (const event of events) {
    const row = rows[rows.length - 1];
    if (
      row &&
      row.event.cardId === event.cardId &&
      row.event.createdAt.getTime() - event.createdAt.getTime() <= COLLAPSE_WINDOW_MS
    ) {
      row.folded.push(event);
      row.last = event;
    } else {
      rows.push({ event, last: event, folded: [] });
    }
  }
  return rows.map(({ event, last, folded }) => ({
    event,
    last,
    collapsed: folded.length,
    collapsedKinds: [...new Set(folded.map((item) => item.kind))],
  }));
}
