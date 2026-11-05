'use client';

/**
 * @file queries.ts
 * @description The Releases page's reads and its two writes that are not card actions (docs/04 §3.20). All under the cards prefix, so the stream and
 * every write keep them current.
 */
import { useQueries, useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, toHubCard } from '@/features/cards/map';
import { useCardsQuery, writeCard } from '@/features/cards/store';
import type { CardListItem, HubCard, ReleaseCard } from '@/features/cards/types';
import { get, getPage, patch, post } from '@/lib/api/client';

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

/**
 * The cards a release includes, with their type and title. Rows already in a cache answer at once; the rest are read one by one, under each card's key,
 * so a card changing elsewhere changes here too.
 */
export function useIncluded(
  keys: readonly string[],
  pool: readonly CardListItem[],
): (CardListItem | HubCard)[] {
  const { ws } = useRoute();
  const known = new Map(pool.map((c) => [c.key, c]));
  const missing = keys.filter((k) => !known.has(k));
  const reads = useQueries({
    queries: missing.map((key) => ({
      queryKey: qk.card(ws, key),
      queryFn: async () => toHubCard(await get<CardFullDto>(`workspaces/${ws}/cards/${key}`)),
    })),
  });
  reads.forEach((read) => {
    if (read.data) known.set(read.data.key, read.data);
  });
  return keys.map((k) => known.get(k)).filter((c): c is CardListItem | HubCard => !!c);
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
