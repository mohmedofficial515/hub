'use client';

/**
 * @file store.ts
 * @description What the design's `kit/card-store.ts` was, on the real API: query hooks over TanStack Query, and writes that update the
 * caches optimistically and roll back on failure. The API is the authority; the stream confirms what the write predicted.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { currentRoute, useRoute } from '@/components/shell/router';
import { del, get, getPage, type Paginated, patch, post } from '@/lib/api/client';
import { nowMs } from '@/lib/format';
import { getQueryClient } from '@/lib/query-client';

import { patchRows } from '../live/apply-event';
import { qk } from './keys';
import {
  type CardFullDto,
  type CardSummaryDto,
  type CommentDto,
  type EventDto,
  toComment,
  toEvent,
  toHubCard,
  toListItem,
} from './map';
import type {
  CardComment,
  CardEvent,
  CardListItem,
  CardType,
  HubCard,
  LinkKind,
  Priority,
  Role,
} from './types';

const cardsPath = (ws: string) => `workspaces/${ws}/cards`;

const ws = () => currentRoute().ws;

export interface CardFilters {
  type?: CardType[];
  status?: string[];
  role?: Role[];
  assignee?: string;
  q?: string;
  /** The Deleted view (D28). */
  archived?: boolean;
  flags?: string[];
  /** `me`: only cards waiting on this member. */
  awaiting?: 'me';
  sort?: 'lastEvent' | 'created' | 'due' | 'priority';
  limit?: number;
}

export async function fetchCards(
  slug: string,
  { archived, ...filters }: CardFilters = {},
): Promise<Paginated<CardListItem>> {
  const page = await getPage<CardSummaryDto>(archived ? `${cardsPath(slug)}/deleted` : cardsPath(slug), {
    limit: 100,
    ...filters,
  });
  return { ...page, items: page.items.map(toListItem) };
}

/** A list with its loading and error state. Every page renders those states from here. */
export function useCardsQuery(filters: CardFilters = {}): UseQueryResult<Paginated<CardListItem>> {
  const { ws: slug } = useRoute();
  return useQuery({
    queryKey: qk.cardList(slug, filters as Record<string, unknown>),
    queryFn: () => fetchCards(slug, filters),
    enabled: !!slug,
  });
}

/** Only the rows. Deleted cards are left out unless asked for (D28). */
export function useCards(opts: { archived?: boolean } = {}): CardListItem[] {
  return useCardsQuery(opts.archived ? { archived: true } : {}).data?.items ?? [];
}

/** One card, full, with its detail. The sheet and anything else that needs more than a row. */
export function useCardQuery(key: string | null | undefined) {
  const { ws: slug } = useRoute();
  return useQuery({
    queryKey: qk.card(slug, key ?? ''),
    enabled: !!key && !!slug,
    queryFn: async () => toHubCard(await get<CardFullDto>(`${cardsPath(slug)}/${key}`)),
  });
}

export function useCard(key: string | null | undefined): HubCard | undefined {
  return useCardQuery(key).data;
}

export function useCardEvents(key: string | null | undefined): UseQueryResult<CardEvent[]> {
  const { ws: slug } = useRoute();
  return useQuery({
    queryKey: qk.events(slug, key ?? ''),
    enabled: !!key && !!slug,
    queryFn: async () =>
      (await getPage<EventDto>(`${cardsPath(slug)}/${key}/events`, { limit: 100 })).items.map(toEvent),
  });
}

export function useCardComments(key: string | null | undefined): UseQueryResult<CardComment[]> {
  const { ws: slug } = useRoute();
  return useQuery({
    queryKey: qk.comments(slug, key ?? ''),
    enabled: !!key && !!slug,
    queryFn: async () =>
      (await getPage<CommentDto>(`${cardsPath(slug)}/${key}/comments`, { limit: 100 })).items.map(toComment),
  });
}

/** Server search, for the palette and the pickers. */
export function useCardSearch(q: string, opts: { types?: CardType[]; limit?: number } = {}) {
  const { ws: slug } = useRoute();
  const text = q.trim();
  return useQuery({
    queryKey: [...qk.search(slug, text), opts] as const,
    enabled: text.length >= 2 && !!slug,
    queryFn: async () => {
      const found = await get<{ cards: CardSummaryDto[] }>(`workspaces/${slug}/search`, {
        q: text,
        includeDocs: true,
        limit: opts.limit ?? 8,
        types: opts.types,
      });
      return found.cards.map(toListItem);
    },
  });
}

/** Whatever the caches know about a key, without a request. For code that runs in a handler. */
export function getCard(key: string, slug: string = ws()): CardListItem | HubCard | undefined {
  const client = getQueryClient();
  const full = client.getQueryData<HubCard>(qk.card(slug, key));
  if (full) return full;
  for (const [, data] of client.getQueriesData<Paginated<CardListItem>>({ queryKey: qk.cards(slug) })) {
    const row = data?.items?.find((c) => c.key === key);
    if (row) return row;
  }
  return undefined;
}

export function allCards(slug: string = ws()): CardListItem[] {
  const seen = new Map<string, CardListItem>();
  for (const [, data] of getQueryClient().getQueriesData<Paginated<CardListItem>>({
    queryKey: qk.cards(slug),
  })) {
    for (const row of data?.items ?? []) if (!seen.has(row.key)) seen.set(row.key, row);
  }
  return [...seen.values()];
}

// ── Optimistic writes ───────────────────────────────────────────────────────────────────────────

export interface OptimisticPatch {
  key: string;
  /** Applied to the row and the open card. */
  fields?: Partial<CardListItem> & Record<string, unknown>;
  /** Removes the row from every list (delete). */
  removeFromLists?: boolean;
  /** Changes only the full card. */
  card?: (card: HubCard) => HubCard;
}

/**
 * The one write path. It predicts the change in every cache, sends the request, puts back exactly what was there if the request
 * fails, and then rereads what it touched, so a prediction can never outlive the server's answer.
 */
export async function writeCard<T>(
  patchSpec: OptimisticPatch,
  request: () => Promise<T>,
  slug: string = ws(),
): Promise<T> {
  const client = getQueryClient();
  const { key } = patchSpec;
  await client.cancelQueries({ queryKey: qk.card(slug, key) });
  await client.cancelQueries({ queryKey: qk.cards(slug) });

  const previousCard = client.getQueryData<HubCard>(qk.card(slug, key));
  const previousLists = client.getQueriesData({ queryKey: qk.cards(slug) });

  if (patchSpec.removeFromLists) patchRows(client, slug, (rows) => rows.filter((r) => r.key !== key));
  else if (patchSpec.fields) {
    const { fields } = patchSpec;
    patchRows(client, slug, (rows) => rows.map((r) => (r.key === key ? { ...r, ...fields } : r)));
  }
  if (previousCard) {
    let next = previousCard;
    if (patchSpec.fields) next = { ...next, ...patchSpec.fields } as HubCard;
    if (patchSpec.card) next = patchSpec.card(next);
    client.setQueryData(qk.card(slug, key), next);
  }

  try {
    return await request();
  } catch (error) {
    if (previousCard) client.setQueryData(qk.card(slug, key), previousCard);
    for (const [queryKey, data] of previousLists) client.setQueryData(queryKey, data);
    throw error;
  } finally {
    void client.invalidateQueries({ queryKey: qk.card(slug, key) });
    void client.invalidateQueries({ queryKey: qk.events(slug, key) });
    void client.invalidateQueries({ queryKey: qk.comments(slug, key) });
    void client.invalidateQueries({ queryKey: qk.cards(slug) });
    void client.invalidateQueries({ queryKey: qk.counters(slug) });
    void client.invalidateQueries({ queryKey: qk.today(slug) });
    void client.invalidateQueries({ queryKey: qk.inbox(slug) });
  }
}

export const isoNow = () => new Date(nowMs()).toISOString();

export function addComment(key: string, text: string) {
  return post<CommentDto>(`${cardsPath(ws())}/${key}/comments`, { body: text }).finally(() => {
    const client = getQueryClient();
    void client.invalidateQueries({ queryKey: qk.comments(ws(), key) });
    void client.invalidateQueries({ queryKey: qk.events(ws(), key) });
    void client.invalidateQueries({ queryKey: qk.card(ws(), key) });
  });
}

export function toggleWatch(card: Pick<HubCard, 'key' | 'watching' | 'watchers'>, memberId: string) {
  const on = card.watching;
  return writeCard(
    {
      key: card.key,
      card: (c) => ({
        ...c,
        watching: !on,
        watchers: on ? c.watchers.filter((id) => id !== memberId) : [...c.watchers, memberId],
      }),
    },
    () =>
      on
        ? del<void>(`${cardsPath(ws())}/${card.key}/watch`)
        : post<void>(`${cardsPath(ws())}/${card.key}/watch`),
  );
}

export function addLink(key: string, kind: LinkKind, otherKey: string) {
  return writeCard({ key, card: (c) => ({ ...c, links: [...c.links, { kind, key: otherKey }] }) }, () =>
    post<CardFullDto>(`${cardsPath(ws())}/${key}/links`, { kind, key: otherKey }),
  );
}

export function removeLink(key: string, kind: LinkKind, otherKey: string) {
  return writeCard(
    { key, card: (c) => ({ ...c, links: c.links.filter((l) => !(l.kind === kind && l.key === otherKey)) }) },
    () => del<CardFullDto>(`${cardsPath(ws())}/${key}/links`, { kind, key: otherKey }),
  );
}

/** D28: delete hides a card everywhere and can be undone. */
export function setArchived(key: string, archived: boolean) {
  const at = archived ? isoNow() : undefined;
  return writeCard({ key, removeFromLists: archived, card: (c) => ({ ...c, archivedAt: at }) }, () =>
    post<CardFullDto>(`${cardsPath(ws())}/${key}/${archived ? 'delete' : 'restore'}`),
  );
}

export function updateCard(
  key: string,
  fields: { priority?: Priority; branch?: string; title?: string; body?: string },
) {
  return writeCard({ key, fields }, () => patch<CardFullDto>(`${cardsPath(ws())}/${key}`, fields));
}

export interface NewCardInput {
  type: 'task' | 'decision' | 'need' | 'handoff' | 'release' | 'idea' | 'plan';
  title: string;
  ownerRole?: Role;
  priority?: Priority;
  body?: string;
  dueAt?: string;
  links?: { kind: LinkKind; key: string }[];
  detail?: Record<string, unknown>;
}

/** `POST /cards`. The row arrives through the list's refetch; the caller gets the key at once. */
export async function createCard(input: NewCardInput): Promise<{ key: string }> {
  const slug = ws();
  const created = await post<{ key: string }>(cardsPath(slug), input);
  const client = getQueryClient();
  void client.invalidateQueries({ queryKey: qk.cards(slug) });
  void client.invalidateQueries({ queryKey: qk.counters(slug) });
  void client.invalidateQueries({ queryKey: qk.today(slug) });
  return created;
}

/** Statuses after which a card no longer blocks anything (docs/09 §6). */
const CLOSED = new Set([
  'decided',
  'withdrawn',
  'superseded',
  'verified',
  'cancelled',
  'applied',
  'dismissed',
  'done',
  'approved',
  'ported',
  'rejected',
  'released',
]);

/** The keys still blocking this card, from the status the API sent with each link. */
export const openBlockers = (card: Pick<HubCard, 'links'>) =>
  card.links.filter((l) => l.kind === 'blocked_by' && !CLOSED.has(l.card?.status ?? '')).map((l) => l.key);

/** The task that does a redesign's port (docs/09 §10). */
export function portTaskOf(card: CardListItem | HubCard): CardListItem | HubCard | undefined {
  if (card.type !== 'redesign' || !('redesign' in card)) return undefined;
  const key = card.redesign.portTaskKey;
  if (!key) return undefined;
  return getCard(key) ?? card.links.find((l) => l.key === key)?.card;
}

/** Ready for me: `GET /tasks/ready`. Listed under the cards prefix, so every write and event refreshes it. */
export function useReadyTasks(): UseQueryResult<CardListItem[]> {
  const { ws: slug } = useRoute();
  return useQuery({
    queryKey: qk.cardList(slug, { ready: true }),
    enabled: !!slug,
    queryFn: async () =>
      (await getPage<CardSummaryDto>(`workspaces/${slug}/tasks/ready`, { limit: 100 })).items.map(toListItem),
  });
}

/** `handoffs.stale_hours` (docs/03 §7). A handoff past this is the type's version of overdue. */
export const HANDOFF_STALE_HOURS = 48;
export const handoffAgeMs = (card: Pick<CardListItem, 'createdAt'>) => nowMs() - Date.parse(card.createdAt);
export const isHandoffStale = (card: Pick<CardListItem, 'createdAt' | 'status'>) =>
  card.status === 'pending' && handoffAgeMs(card) > HANDOFF_STALE_HOURS * 3_600_000;
