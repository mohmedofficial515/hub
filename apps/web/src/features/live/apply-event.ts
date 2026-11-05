/**
 * @file apply-event.ts
 * @description What one message on the stream does to the query caches (docs/15 §7). Rows and an open sheet take the new status at
 * once, then the affected queries refetch, so a page gets live updates by using the keys in `features/cards/keys.ts`.
 */
import type { RealtimeCardEvent } from '@hub/contracts';
import type { QueryClient } from '@tanstack/react-query';

import { qk } from '@/features/cards/keys';
import type { CardListItem, HubCard } from '@/features/cards/types';

/** The API's realtime message, or the name docs/04 §4 uses for the same fact. */
export type CardEventMessage = Pick<RealtimeCardEvent, 'cardKey' | 'kind' | 'status' | 'at'> &
  Partial<Pick<RealtimeCardEvent, 'cardType' | 'seq' | 'eventId'>>;

const LEAVES_LISTS = new Set(['archived']);

export function asCardEvent(data: unknown): CardEventMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const cardKey = d.cardKey ?? d.key;
  if (typeof cardKey !== 'string') return null;
  const event =
    typeof d.event === 'object' && d.event !== null ? (d.event as Record<string, unknown>) : undefined;
  const kind = d.kind ?? event?.kind ?? 'field_changed';
  return {
    cardKey,
    kind: kind as RealtimeCardEvent['kind'],
    status: typeof d.status === 'string' ? d.status : '',
    at:
      typeof d.at === 'string'
        ? d.at
        : typeof d.lastEventAt === 'string'
          ? d.lastEventAt
          : new Date().toISOString(),
  };
}

type ListData = CardListItem[] | { items: CardListItem[] } | undefined;

function mapRows(data: ListData, fn: (rows: CardListItem[]) => CardListItem[]): ListData {
  if (!data) return data;
  if (Array.isArray(data)) return fn(data);
  if (Array.isArray(data.items)) return { ...data, items: fn(data.items) };
  return data;
}

/** Patch every cached list of this project. */
export function patchRows(client: QueryClient, ws: string, fn: (rows: CardListItem[]) => CardListItem[]) {
  client.setQueriesData<ListData>({ queryKey: qk.cards(ws) }, (data) => mapRows(data, fn));
}

export function applyCardEvent(client: QueryClient, ws: string, event: CardEventMessage) {
  const { cardKey: key, kind, status, at } = event;

  if (LEAVES_LISTS.has(kind)) {
    patchRows(client, ws, (rows) => rows.filter((r) => r.key !== key));
  } else if (status) {
    patchRows(client, ws, (rows) => rows.map((r) => (r.key === key ? { ...r, status, lastEventAt: at } : r)));
  }
  client.setQueryData<HubCard>(qk.card(ws, key), (card) =>
    card && status ? { ...card, status, lastEventAt: at } : card,
  );

  void client.invalidateQueries({ queryKey: qk.card(ws, key) });
  void client.invalidateQueries({ queryKey: qk.events(ws, key) });
  if (kind === 'commented' || kind === 'redacted') {
    void client.invalidateQueries({ queryKey: qk.comments(ws, key) });
  }
  // A created or restored card has no row to patch; everything else may have moved between filtered lists.
  void client.invalidateQueries({ queryKey: qk.cards(ws), exact: false });
  void client.invalidateQueries({ queryKey: qk.counters(ws) });
  void client.invalidateQueries({ queryKey: qk.today(ws) });
  void client.invalidateQueries({ queryKey: qk.timeline(ws) });
  void client.invalidateQueries({ queryKey: qk.inbox(ws) });
  void client.invalidateQueries({ queryKey: qk.admin(ws, 'audit') });
}

/** After a gap in the stream nothing can be assumed: every active query reads again. */
export function refetchEverything(client: QueryClient) {
  void client.invalidateQueries();
}

export interface LiveMessage {
  event: string;
  data: unknown;
}

/** Route a parsed message. Returns false when it is not one this client knows, which is not an error. */
export function applyLiveMessage(client: QueryClient, ws: string, message: LiveMessage): boolean {
  const { event, data } = message;
  // The cursor was too old to replay (docs/04 §3.22): nothing can be assumed.
  if (event === 'resync') {
    refetchEverything(client);
    return true;
  }
  if (event === 'counters') {
    client.setQueryData(qk.counters(ws), data);
    return true;
  }
  if (event === 'inbox.new' || event === 'inbox.read') {
    void client.invalidateQueries({ queryKey: qk.inbox(ws) });
    void client.invalidateQueries({ queryKey: qk.counters(ws) });
    return true;
  }
  if (event === 'source.run') {
    // A source's status and its runs moved.
    void client.invalidateQueries({ queryKey: qk.admin(ws, 'sources') });
    void client.invalidateQueries({ queryKey: qk.admin(ws, 'system') });
    return true;
  }
  if (event === 'workspace.updated' || event === 'project.updated') {
    void client.invalidateQueries({ queryKey: qk.workspace(ws) });
    void client.invalidateQueries({ queryKey: qk.workspaces });
    if (event === 'project.updated') {
      // Members, invites, settings, sources: an outside change, from another tab or from MCP (docs/15 §7).
      void client.invalidateQueries({ queryKey: qk.admin(ws) });
      void client.invalidateQueries({ queryKey: qk.members(ws) });
      // My own roles may be what changed, and the shell's permissions read them.
      void client.invalidateQueries({ queryKey: qk.me });
    }
    return true;
  }
  const card = asCardEvent(data);
  if (card) {
    applyCardEvent(client, ws, card);
    return true;
  }
  return false;
}
