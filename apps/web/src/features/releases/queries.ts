'use client';

/**
 * @file queries.ts
 * @description The Releases page's reads and its two writes that are not card actions (docs/04 §3.20). All under the cards prefix, so the stream and
 * every write keep them current.
 */
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, toHubCard } from '@/features/cards/map';
import { useCardsQuery, writeCard } from '@/features/cards/store';
import type { CardListItem, ReleaseCard } from '@/features/cards/types';
import { getPage, patch, post } from '@/lib/api/client';

import { FINISHED, hasNotes } from './rules';

export function useReleases() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'releases' }),
    enabled: !!ws,
    queryFn: async () => {
      const page = await getPage<CardFullDto>(`workspaces/${ws}/releases`, { limit: 100 });
      return { ...page, items: page.items.map((dto) => toHubCard(dto) as ReleaseCard) };
    },
  });
}

/** Finished cards, the pool a release picks from. */
export function useFinishedCards() {
  return useCardsQuery({
    type: ['task', 'handoff', 'decision', 'redesign'],
    status: Object.values(FINISHED),
    sort: 'lastEvent',
    limit: 100,
  });
}

/** How many cards a release holds, whichever way the API named them. */
export const includedCount = (r: ReleaseCard['release']) =>
  Math.max(r.includedKeys.length, r.includedIds?.length ?? 0);

/**
 * The cards a release includes, with their type and title. The API answers with ids and has no read by id, so they come from the pool of finished cards.
 * A card older than the pool still counts in `includedCount`, and is simply not listed.
 */
export function useIncluded(r: ReleaseCard['release'], pool: readonly CardListItem[]): CardListItem[] {
  const ids = new Set([...r.includedKeys, ...(r.includedIds ?? [])]);
  return pool.filter((c) => ids.has(c.id) || ids.has(c.key));
}

const releasePath = (ws: string, key: string) => `workspaces/${ws}/releases/${key}`;

/** Fills the empty audiences from the included cards. */
export const generateNotes = (ws: string, key: string) =>
  writeCard({ key }, () => post<unknown>(`${releasePath(ws, key)}/generate-notes`), ws);

/**
 * Rebuild: `generate-notes` only fills what is empty, so the old text is cleared first. Its caller keeps that text, because putting it back is a real
 * inverse and the page offers it as Undo.
 */
export async function rebuildNotes(ws: string, card: ReleaseCard) {
  if (hasNotes(card.release.notes)) {
    await patch<unknown>(releasePath(ws, card.key), { notes: { team: null, owner: null, accountant: null } });
  }
  await generateNotes(ws, card.key);
}

export const restoreNotes = (ws: string, key: string, notes: ReleaseCard['release']['notes']) =>
  writeCard({ key }, () => patch<unknown>(releasePath(ws, key), { notes }), ws);
