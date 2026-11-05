/**
 * @file stream.ts
 * @description What the Timeline shows against what the API last said (docs/09 §5). At the top of the page new events prepend; scrolled down the
 * rows hold still and only a count grows. Pure, so the rule is tested without a browser.
 */
import type { CardEvent, HubCard } from '@/features/cards/types';

export interface StreamRow {
  /** The row's newest event id. */
  id: string;
  event: CardEvent;
  card: HubCard;
  /** How many more events of this card the row folds. */
  collapsed: number;
  collapsedKinds: string[];
}

const at = (row: StreamRow) => Date.parse(row.event.at);
const eventsIn = (row: StreamRow) => 1 + row.collapsed;

export interface Reconciled {
  rows: StreamRow[];
  /** Events that arrived and are not on screen yet: the pill's number. */
  pending: number;
}

/**
 * Keep `shown` in place while taking everything from `incoming` that does not move the page: fresher card facts, older pages loaded below, and
 * cards that are gone. An event that folds into a row already on screen counts only for what it adds.
 */
export function reconcile(shown: readonly StreamRow[], incoming: readonly StreamRow[]): Reconciled {
  const newest = Math.max(0, ...shown.map(at));
  const oldest = shown.length ? Math.min(...shown.map(at)) : Infinity;
  const ids = new Set(incoming.map((row) => row.id));
  // Incoming is newest first, so the first row of a card holds its latest state.
  const latest = new Map<string, HubCard>();
  for (const row of incoming) if (!latest.has(row.card.key)) latest.set(row.card.key, row.card);

  const fresh = incoming.filter((row) => at(row) > newest);
  const kept = shown.flatMap((row) => {
    const card = latest.get(row.card.key);
    return card ? [{ ...row, card }] : [];
  });
  const older = incoming.filter((row) => at(row) < oldest);

  const pending = fresh.reduce((sum, row) => {
    // The row on screen was folded into this one, so its events were already seen.
    const folded = kept
      .filter((old) => old.card.key === row.card.key && !ids.has(old.id))
      .reduce((n, old) => n + eventsIn(old), 0);
    return sum + Math.max(1, eventsIn(row) - folded);
  }, 0);

  return { rows: [...kept, ...older], pending };
}

/** Ids `next` adds at the top of `previous`: they fade in, and nothing else does. */
export function freshIds(previous: readonly StreamRow[], next: readonly StreamRow[]): Set<string> {
  if (previous.length === 0) return new Set();
  const newest = Math.max(...previous.map(at));
  return new Set(next.filter((row) => at(row) > newest).map((row) => row.id));
}

/** Only the newest row of a card offers its actions; older rows are history. */
export function newestOfCard(rows: readonly StreamRow[]): Set<string> {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.card.key)) out.add(row.id);
    seen.add(row.card.key);
  }
  return out;
}

export const countEvents = (rows: readonly StreamRow[]) => rows.reduce((sum, row) => sum + eventsIn(row), 0);

/** The events a row folds, from the card's own history (newest first). The API sends only how many. */
export function foldedEvents(
  all: readonly CardEvent[],
  row: Pick<StreamRow, 'event' | 'collapsed'>,
): CardEvent[] {
  return all
    .filter((event) => event.seq < row.event.seq && event.kind !== 'watched' && event.kind !== 'unwatched')
    .slice(0, row.collapsed);
}

export type Slot =
  { kind: 'row'; row: StreamRow } | { kind: 'gap'; id: string; ms: number } | { kind: 'tide'; id: string };

export interface StreamDay {
  key: string;
  iso: string;
  slots: Slot[];
  count: number;
}

/** Anything shorter reads as normal rhythm. A longer pause gets a label on the spine, so distance reads as time. */
export const QUIET_AFTER_MS = 3 * 3_600_000;

/** Days, with the pauses and the last-visit line in their place between rows. */
export function buildDays(
  rows: readonly StreamRow[],
  since: string | null,
  dayKeyOf: (iso: string) => string,
): StreamDay[] {
  const sinceMs = since ? Date.parse(since) : null;
  const out: StreamDay[] = [];
  const first = rows[0];
  // The line goes where the rows change sides, and only if there are rows on both.
  let tideDone = sinceMs === null || !first || at(first) < sinceMs || !rows.some((r) => at(r) < sinceMs);
  let previous: StreamRow | null = null;
  for (const row of rows) {
    const key = dayKeyOf(row.event.at);
    let day = out[out.length - 1];
    if (!day || day.key !== key) {
      day = { key, iso: row.event.at, slots: [], count: 0 };
      out.push(day);
      previous = null;
    }
    if (!tideDone && sinceMs !== null && at(row) < sinceMs) {
      day.slots.push({ kind: 'tide', id: 'tide' });
      tideDone = true;
    } else if (previous) {
      const ms = at(previous) - at(row);
      if (ms >= QUIET_AFTER_MS) day.slots.push({ kind: 'gap', id: `gap-${row.id}`, ms });
    }
    day.slots.push({ kind: 'row', row });
    day.count += eventsIn(row);
    previous = row;
  }
  return out;
}

export interface RailDay {
  key: string;
  iso: string;
  count: number;
}

export function buildRail(rows: readonly StreamRow[], dayKeyOf: (iso: string) => string): RailDay[] {
  const out: RailDay[] = [];
  for (const row of rows) {
    const key = dayKeyOf(row.event.at);
    const last = out[out.length - 1];
    if (last?.key === key) last.count += eventsIn(row);
    else out.push({ key, iso: row.event.at, count: eventsIn(row) });
  }
  return out;
}
