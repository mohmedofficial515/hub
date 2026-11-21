'use client';

/**
 * @file studio-source.ts
 * @description Which studio chat became which idea or plan. The card says so itself (`sourceChatId`, `sourceMessageId`, owner decision 9c, 2026-11-19),
 * so a second browser, or the same member on another machine, sees the session as saved. A save made in this tab is known at once, before the list
 * refreshes. What an older version kept in this browser's localStorage is read as a migration: once found, the card is given its chat, and nothing is
 * written to localStorage any more.
 */
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { currentRoute, useRoute } from '@/components/shell/router';
import { get, patch } from '@/lib/api/client';

import { qk } from '../cards/keys';

export type StudioKind = 'idea' | 'plan';

/** A card a studio chat became, and the reply it holds now. */
export interface StudioSource {
  key: string;
  messageId: string | null;
}

const LEGACY_KEYS: Record<StudioKind, string> = {
  idea: 'hub:idea-studio:accepted',
  plan: 'hub:plan-studio:saved',
};
const SEGMENT: Record<StudioKind, string> = { idea: 'ideas', plan: 'plans' };

/** Chat and message ids are uuids. Anything else (a reply still streaming, a test's id) is never sent to the API. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string | null | undefined): id is string => !!id && UUID.test(id);

// ── This tab's saves, and the old localStorage records, read only ─────────────────────────────────

interface Memory {
  chats: Map<string, StudioSource>;
  messages: Map<string, string>;
  /** Keys deleted since they were saved: nothing points at them any more. */
  gone: Set<string>;
}
const memory: Record<StudioKind, Memory> = {
  idea: { chats: new Map(), messages: new Map(), gone: new Set() },
  plan: { chats: new Map(), messages: new Map(), gone: new Set() },
};
const listeners = new Set<() => void>();
let version = 0;
const changed = () => {
  version += 1;
  for (const fn of listeners) fn();
};

/** The records of an older version: `<messageId>` and `chat:<chatId>`, each to a card key. Read, never written. */
function legacy(kind: StudioKind): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(LEGACY_KEYS[kind]) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

const live = (kind: StudioKind, key: string | undefined) =>
  key && !memory[kind].gone.has(key) ? key : undefined;

/** What this tab knows of a chat: its own save, or an old record. */
export function knownChat(kind: StudioKind, chatId: string): StudioSource | null {
  const own = memory[kind].chats.get(chatId);
  if (own && live(kind, own.key)) return own;
  const records = legacy(kind);
  const key = live(kind, records[`chat:${chatId}`]);
  if (!key) return null;
  const messageId = Object.entries(records).find(
    ([id, value]) => value === key && !id.startsWith('chat:'),
  )?.[0];
  return { key, messageId: messageId ?? null };
}

/** The card a reply became, as this tab knows it. */
export function knownMessage(kind: StudioKind, messageId: string): string | null {
  return live(kind, memory[kind].messages.get(messageId) ?? legacy(kind)[messageId]) ?? null;
}

/** The chat a card came from, as this tab knows it: what a card saved before owner decision 9c has nowhere else. */
export function knownChatOf(kind: StudioKind, key: string): string | null {
  if (memory[kind].gone.has(key)) return null;
  for (const [chatId, source] of memory[kind].chats) if (source.key === key) return chatId;
  for (const [id, value] of Object.entries(legacy(kind)))
    if (value === key && id.startsWith('chat:')) return id.slice(5);
  return null;
}

/** A save just made: known here at once, whatever the list says until it refreshes. */
export function rememberSave(kind: StudioKind, key: string, chatId: string | null, messageId: string | null) {
  memory[kind].gone.delete(key);
  if (chatId) memory[kind].chats.set(chatId, { key, messageId });
  if (messageId) memory[kind].messages.set(messageId, key);
  changed();
}

/** A card deleted since it was saved: the next save makes a new one. */
export function forgetKey(kind: StudioKind, key: string) {
  memory[kind].gone.add(key);
  for (const [id, source] of [...memory[kind].chats]) if (source.key === key) memory[kind].chats.delete(id);
  for (const [id, value] of [...memory[kind].messages]) if (value === key) memory[kind].messages.delete(id);
  changed();
}

/** The fields a save writes on its card: the chat and the reply, when they are real ids. */
export function sourceFields(chatId: string | null, messageId: string | null) {
  return {
    ...(isUuid(chatId) ? { sourceChatId: chatId } : {}),
    ...(isUuid(messageId) ? { sourceMessageId: messageId } : {}),
  };
}

// ── The API's answer ─────────────────────────────────────────────────────────────────────────────

interface SourceRow {
  key: string;
  detail?: { sourceChatId?: string | null; sourceMessageId?: string | null } | null;
}

async function fetchSource(ws: string, kind: StudioKind, chatId: string): Promise<StudioSource | null> {
  const rows = await get<SourceRow[]>(`workspaces/${ws}/${SEGMENT[kind]}`, { sourceChat: chatId, limit: 1 });
  const row = rows?.[0];
  return row ? { key: row.key, messageId: row.detail?.sourceMessageId ?? null } : null;
}

const backfilled = new Set<string>();

/**
 * An old record found for a chat the API knows nothing of: the card is given its chat once, so every browser sees it from now on. A member who may not
 * edit the card leaves it as it was; this tab still knows.
 */
function backfill(ws: string, kind: StudioKind, chatId: string, source: StudioSource) {
  if (!isUuid(chatId) || backfilled.has(source.key)) return;
  backfilled.add(source.key);
  void patch(`workspaces/${ws}/${SEGMENT[kind]}/${source.key}`, sourceFields(chatId, source.messageId)).catch(
    () => undefined,
  );
}

/** For a save: the card this chat became, from this tab, the API, or an old record. */
export async function findSaved(kind: StudioKind, chatId: string): Promise<StudioSource | null> {
  const own = memory[kind].chats.get(chatId);
  if (own && live(kind, own.key)) return own;
  if (isUuid(chatId)) {
    const { ws } = currentRoute();
    const found = await fetchSource(ws, kind, chatId).catch(() => null);
    if (found && live(kind, found.key)) return found;
  }
  return knownChat(kind, chatId);
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** The card a studio chat became, live: this tab's save first, then the API, then an old record (which is then written to the card). */
export function useStudioSource(kind: StudioKind, chatId: string): StudioSource | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  const { ws } = useRoute();
  const query = useQuery({
    queryKey: qk.cardList(ws, { view: SEGMENT[kind], sourceChat: chatId }),
    enabled: !!ws && isUuid(chatId),
    queryFn: () => fetchSource(ws, kind, chatId),
  });
  const own = memory[kind].chats.get(chatId);
  if (own && live(kind, own.key)) return own;
  const server = query.data;
  if (server && live(kind, server.key)) return server;
  const old = knownChat(kind, chatId);
  if (old && query.isSuccess) backfill(ws, kind, chatId, old);
  return old;
}

/** The plan a reply became, live: this tab's save, then the API (any browser's save), then an old record. */
export function useMessagePlan(messageId: string | null | undefined): string | null {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
  const { ws } = useRoute();
  const query = useQuery({
    queryKey: qk.cardList(ws, { view: 'plans', sourceMessage: messageId }),
    enabled: !!ws && isUuid(messageId),
    queryFn: async () => {
      const rows = await get<SourceRow[]>(`workspaces/${ws}/plans`, { sourceMessage: messageId, limit: 1 });
      return rows?.[0]?.key ?? null;
    },
  });
  if (!messageId) return null;
  const own = live('plan', memory.plan.messages.get(messageId));
  return own ?? live('plan', query.data ?? undefined) ?? knownMessage('plan', messageId);
}

/** For a save from a reply: the plan it already became, from this tab, the API or an old record. */
export async function findMessagePlan(messageId: string): Promise<string | null> {
  const own = live('plan', memory.plan.messages.get(messageId));
  if (own) return own;
  if (isUuid(messageId)) {
    const { ws } = currentRoute();
    const rows = await get<SourceRow[]>(`workspaces/${ws}/plans`, {
      sourceMessage: messageId,
      limit: 1,
    }).catch(() => null);
    const key = live('plan', rows?.[0]?.key);
    if (key) return key;
  }
  return knownMessage('plan', messageId);
}
