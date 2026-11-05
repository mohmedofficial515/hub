/**
 * @file rules.ts
 * @description The Releases page's reasoning with no React: which finished cards are in no release yet (09 §16), and shipped releases grouped by
 * month on the date spine.
 */
import type { CardListItem, CardType, ReleaseCard } from '@/features/cards/types';
import { dayKey } from '@/lib/format';

/** The order a manifest lists its cards in. */
export const TYPE_ORDER: CardType[] = ['decision', 'task', 'handoff', 'redesign', 'change', 'need', 'doc'];

/** Finished, per type (09 §16). */
export const FINISHED: Partial<Record<CardType, string>> = {
  task: 'done',
  handoff: 'applied',
  decision: 'decided',
  redesign: 'ported',
};

const releasedAt = (release: ReleaseCard) => release.release.releasedAt ?? release.createdAt;

/** Finished, in no release, and since the last shipped release. */
export function eligibleForRelease(
  cards: readonly CardListItem[],
  releases: readonly ReleaseCard[],
): CardListItem[] {
  const taken = new Set(
    releases.flatMap((r) => [...r.release.includedKeys, ...(r.release.includedIds ?? [])]),
  );
  const shipped = releases.filter((r) => r.status === 'released').map((r) => Date.parse(releasedAt(r)));
  const since = shipped.length ? Math.max(...shipped) : 0;
  return cards.filter(
    (c) =>
      FINISHED[c.type] === c.status &&
      !taken.has(c.key) &&
      !taken.has(c.id) &&
      Date.parse(c.closedAt ?? c.lastEventAt) > since,
  );
}

export interface MonthGroup {
  key: string;
  iso: string;
  rows: ReleaseCard[];
}

/** Newest first, grouped by month. */
export function shippedByMonth(releases: readonly ReleaseCard[]): MonthGroup[] {
  const sorted = releases
    .filter((r) => r.status === 'released')
    .sort((a, b) => Date.parse(releasedAt(b)) - Date.parse(releasedAt(a)));
  const groups: MonthGroup[] = [];
  for (const row of sorted) {
    const iso = releasedAt(row);
    const key = dayKey(iso).slice(0, 7);
    const group = groups.find((g) => g.key === key);
    if (group) group.rows.push(row);
    else groups.push({ key, iso, rows: [row] });
  }
  return groups;
}

export const releaseDate = releasedAt;

export const hasNotes = (notes: ReleaseCard['release']['notes']) =>
  !!(notes.team || notes.owner || notes.accountant);

/** Who wrote the notes last: the newest event that touched them. A template's skeleton has no author but the system. */
export function notesAuthor(
  events: readonly {
    kind: string;
    actorKind: 'user' | 'agent' | 'system';
    actorId?: string | undefined;
    data: Record<string, unknown>;
  }[],
): { kind: 'user' | 'agent' | 'system'; memberId?: string | undefined } {
  const touched = events.filter((e) => {
    return e.kind === 'notes_generated' || /"field":"notes"/.test(JSON.stringify(e.data));
  });
  const last = touched.at(-1);
  if (!last || last.kind === 'notes_generated') return { kind: 'system' };
  return { kind: last.actorKind, memberId: last.actorId };
}
