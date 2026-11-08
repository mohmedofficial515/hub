/**
 * @file apply-event.ts
 * @description What one message on the stream does to the query caches (docs/15 §7). Rows and an open sheet take the new status at
 * once, then the affected queries refetch, so a page gets live updates by using the keys in `features/cards/keys.ts`.
 */
import type { CardType, ChatChanged, ChatLiveEvent, RealtimeCardEvent } from '@hub/contracts';
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

import { qk } from '@/features/cards/keys';
import type { CardListItem, HubCard } from '@/features/cards/types';
import { applyChatChanged, applyChatLive } from '@/features/chat/live';

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
    ...(typeof d.cardType === 'string' ? { cardType: d.cardType as CardType } : {}),
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

/** What a change asks to be read again. Plain data, so a batch can merge them. */
export interface Refetch {
  keys: readonly QueryKey[];
  /** The types whose lists may have moved. Empty means no list; absent means every list. */
  cardTypes?: readonly CardType[] | undefined;
}

/** The lists a page keeps under one name, and the only type each shows. A list not named here may hold any type. */
const LIST_TYPES: Readonly<Record<string, CardType>> = {
  tasks: 'task',
  decisions: 'decision',
  needs: 'need',
  handoffs: 'handoff',
  ideas: 'idea',
  plans: 'plan',
  releases: 'release',
  'lab-pages': 'redesign',
  'doc-tree': 'doc',
  onboarding: 'doc',
};

/** Can this list hold a card of one of these types? It only ever narrows: an unknown list says yes. */
export function listMayHold(filters: unknown, types: ReadonlySet<CardType>): boolean {
  if (typeof filters !== 'object' || filters === null) return true;
  const { view, type, ready } = filters as { view?: unknown; type?: unknown; ready?: unknown };
  if (ready === true) return types.has('task');
  if (typeof view === 'string') {
    const only = LIST_TYPES[view];
    if (only) return types.has(only);
  }
  if (Array.isArray(type) && type.length > 0) return type.some((name) => types.has(name as CardType));
  return true;
}

export function applyCardEvent(
  client: QueryClient,
  ws: string,
  event: CardEventMessage,
  refetch: (change: Refetch) => void = immediately(client, ws),
) {
  const { cardKey: key, kind, status, at, cardType } = event;

  if (LEAVES_LISTS.has(kind)) {
    patchRows(client, ws, (rows) => rows.filter((r) => r.key !== key));
  } else if (status) {
    patchRows(client, ws, (rows) => rows.map((r) => (r.key === key ? { ...r, status, lastEventAt: at } : r)));
  }
  client.setQueryData<HubCard>(qk.card(ws, key), (card) =>
    card && status ? { ...card, status, lastEventAt: at } : card,
  );

  // A created or restored card has no row to patch; anything else may have moved between filtered lists.
  refetch({
    cardTypes: cardType ? [cardType] : undefined,
    keys: [
      qk.card(ws, key),
      qk.events(ws, key),
      ...(kind === 'commented' || kind === 'redacted' ? [qk.comments(ws, key)] : []),
      qk.counters(ws),
      qk.today(ws),
      qk.timeline(ws),
      qk.inbox(ws),
      qk.admin(ws, 'audit'),
    ],
  });
}

/** Every list that may hold one of these types. */
function cardLists(ws: string, cardTypes: readonly CardType[] | undefined) {
  const types = cardTypes ? new Set(cardTypes) : null;
  return {
    queryKey: qk.cards(ws),
    ...(types ? { predicate: (query: Query) => listMayHold(query.queryKey[2], types) } : {}),
  };
}

/** Reads again now: tests, and a caller with no batch. */
function immediately(client: QueryClient, ws: string) {
  return (change: Refetch) => {
    for (const queryKey of change.keys) void client.invalidateQueries({ queryKey });
    if (change.cardTypes?.length !== 0) void client.invalidateQueries(cardLists(ws, change.cardTypes));
  };
}

/** A round of refetches never waits longer than this for an answer before the next may start. */
const ROUND_LIMIT_MS = 5_000;
/** Between rounds while things are calm: a change right after another still lands within the second. */
const CALM_GAP_MS = 200;
/** Between rounds in a burst, which is what keeps a heavy run under the per-user limit (docs/04 §1.7). */
const BUSY_GAP_MS = 2_000;
const BUSY_WINDOW_MS = 10_000;
const BUSY_ROUNDS = 8;

/**
 * Every message used to refetch every list at once, and a refetch cancels the one before it, so a burst both hit the 600 a minute limit and starved
 * the page of answers. Now one round runs at a time, starting at once when things are calm. Whatever arrives during a round joins the next, with its
 * lists merged, so no change is lost and nothing is cancelled. Measured by `apps/web/e2e/specs/busy-session.spec.ts`.
 */
export function createRefetchBatcher(client: QueryClient, ws: string, now: () => number = Date.now) {
  let keys = new Map<string, QueryKey>();
  /** Absent: no list. Null: every list. */
  let types: Set<CardType> | null | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let rounds: number[] = [];
  let stopped = false;

  const gap = () => {
    const since = now() - BUSY_WINDOW_MS;
    rounds = rounds.filter((at) => at > since);
    return rounds.length >= BUSY_ROUNDS ? BUSY_GAP_MS : CALM_GAP_MS;
  };

  const schedule = () => {
    if (timer !== null || running || stopped || (keys.size === 0 && types === undefined)) return;
    const wanted = gap();
    const last = rounds[rounds.length - 1];
    timer = setTimeout(
      () => {
        timer = null;
        void flush();
      },
      last === undefined ? 0 : Math.max(0, last + wanted - now()),
    );
  };

  const flush = async () => {
    const roundKeys = [...keys.values()];
    const roundTypes = types;
    keys = new Map();
    types = undefined;
    running = true;
    rounds.push(now());
    const refetches = [
      ...roundKeys.map((queryKey) => client.invalidateQueries({ queryKey })),
      ...(roundTypes === undefined
        ? []
        : [client.invalidateQueries(cardLists(ws, roundTypes === null ? undefined : [...roundTypes]))]),
    ];
    let limit: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled(refetches),
      new Promise((done) => {
        limit = setTimeout(done, ROUND_LIMIT_MS);
      }),
    ]);
    clearTimeout(limit);
    running = false;
    schedule();
  };

  return {
    add: (change: Refetch) => {
      for (const key of change.keys) keys.set(JSON.stringify(key), key);
      if (types !== null) {
        if (!change.cardTypes) types = null;
        else if (change.cardTypes.length > 0) {
          types ??= new Set();
          for (const type of change.cardTypes) types.add(type);
        }
      }
      schedule();
    },
    stop: () => {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
    },
  };
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
export function applyLiveMessage(
  client: QueryClient,
  ws: string,
  message: LiveMessage,
  refetch: (change: Refetch) => void = immediately(client, ws),
): boolean {
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
    refetch({ keys: [qk.inbox(ws), qk.counters(ws)], cardTypes: [] });
    return true;
  }
  // The chat panel (docs/16 §7). A long reply's pieces go straight into the open chat's cache.
  if (event === 'chat.event') {
    applyChatLive(client, ws, data as ChatLiveEvent);
    return true;
  }
  if (event === 'chat.changed') {
    applyChatChanged(client, ws, (data as ChatChanged).chatId);
    return true;
  }
  if (event === 'queue.changed') {
    void client.invalidateQueries({ queryKey: qk.queue(ws) });
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
    applyCardEvent(client, ws, card, refetch);
    return true;
  }
  return false;
}
