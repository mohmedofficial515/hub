import { useSyncExternalStore } from 'react';
import { inboxFor, type InboxItem } from '@lab/mocks/hub-app/inbox';
import { NOW, type HubScenario } from '@lab/mocks/hub-app';

/**
 * Read and archive state of the Inbox. It is separate from the card store because a notification is not a card,
 * and it lives in the kit because the sidebar badge and Today's tile read the same number (09 §15: "Mark all read
 * clears the badge"). `POST /inbox/{id}/read`, `POST /inbox/read-all` and `POST /inbox/{id}/archive` stand-ins.
 */
type Scenario = HubScenario | 'error';

const read = new Map<string, string | null>();
const archived = new Map<string, string | null>();
let version = 0;
let lastScenario: Scenario | null = null;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useInboxVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

/** A new scenario starts from a clean slate, as the card store does. */
function sync(scenario: Scenario) {
  if (scenario === lastScenario) return;
  lastScenario = scenario;
  read.clear();
  archived.clear();
}

const withState = (item: InboxItem): InboxItem => ({
  ...item,
  readAt: read.has(item.id) ? (read.get(item.id) ?? null) : item.readAt,
  archivedAt: archived.has(item.id) ? (archived.get(item.id) ?? null) : item.archivedAt,
});

export function inboxItems(scenario: Scenario): InboxItem[] {
  sync(scenario);
  return inboxFor(scenario)
    .map(withState)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Every item with its current state, newest first. */
export function useInbox(scenario: Scenario): InboxItem[] {
  useInboxVersion();
  return inboxItems(scenario);
}

/** The sidebar badge: unread and not archived. */
export const unreadCount = (scenario: Scenario) => inboxItems(scenario).filter((i) => !i.readAt && !i.archivedAt).length;

function write(target: Map<string, string | null>, ids: string[], value: string | null) {
  const before = ids.map((id) => [id, target.has(id), target.get(id)] as const);
  for (const id of ids) target.set(id, value);
  bump();
  return () => {
    for (const [id, had, previous] of before) {
      if (had) target.set(id, previous ?? null);
      else target.delete(id);
    }
    bump();
  };
}

/** Each returns its undo, which restores exactly what was there. */
export const markInboxRead = (ids: string[]) => write(read, ids, NOW);
export const markInboxUnread = (ids: string[]) => write(read, ids, null);
export const archiveInbox = (ids: string[]) => write(archived, ids, NOW);
export const restoreInbox = (ids: string[]) => write(archived, ids, null);

/**
 * Review M1: acting on a card answers its notifications, wherever the action was taken. They stay in the list as history, read.
 * Returns the undo, which makes unread again only what this call changed.
 */
export function markCardsRead(cardKeys: string[]) {
  if (!lastScenario) return () => {};
  const ids = inboxItems(lastScenario)
    .filter((i) => i.cardKey && cardKeys.includes(i.cardKey) && !i.readAt)
    .map((i) => i.id);
  return ids.length ? markInboxRead(ids) : () => {};
}

/** The same for a notification about a source, which has no card (the failing source's item, once it is fixed). */
export function markSourceRead(sourceId: string) {
  if (!lastScenario) return () => {};
  const ids = inboxItems(lastScenario)
    .filter((i) => i.sourceId === sourceId && !i.readAt)
    .map((i) => i.id);
  return ids.length ? markInboxRead(ids) : () => {};
}
