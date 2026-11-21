import { useSyncExternalStore } from 'react';
import type { Locale } from '@lab/i18n';
import {
  NOW,
  cardByKey,
  cards,
  type CardEvent,
  type CardLink,
  type CardType,
  type HubCard,
  type LinkKind,
  type Priority,
  type Role,
} from '@lab/mocks/hub-app';
import type { CardAction } from './i18n';

/**
 * The lab's stand-in for the API and its cache. The catalogue in `@lab/mocks/hub-app` is read-only; every
 * mutation goes in an overlay here, so the sheet, the sidebar counters and every page stay in agreement, and
 * Undo restores exactly what was there. Pages read through `useCard` / `useCards` / `actedOn`.
 */
interface Entry {
  card: HubCard;
  acted?: CardAction;
}

const overlay = new Map<string, Entry>();
let created: HubCard[] = [];
let version = 0;
let nextSeq = 300;
let nextEvent = 1;
const listeners = new Set<() => void>();

function bump() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Re-render when any card changes. Most code wants `useCard` or `useCards`. */
export function useCardStoreVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function getCard(key: string): HubCard | undefined {
  return overlay.get(key)?.card ?? created.find((c) => c.key === key) ?? cardByKey(key);
}

export function useCard(key: string | null | undefined) {
  useCardStoreVersion();
  return key ? getCard(key) : undefined;
}

export function allCards(): HubCard[] {
  const base = [...created, ...cards];
  return base.map((c) => overlay.get(c.key)?.card ?? c);
}

/** Every card with the store's changes applied. Archived cards are left out unless asked for (08 P6). */
export function useCards(opts: { archived?: boolean } = {}) {
  useCardStoreVersion();
  const list = allCards();
  return opts.archived ? list : list.filter((c) => !c.archivedAt);
}

/** The last action a member took on this card, while it has not been undone. Today uses it to drop the row. */
export const actedOn = (key: string) => overlay.get(key)?.acted;

/** Cards whose last action is `action`, oldest first (Today's "Working on" chip uses `claim`). */
export const cardsActedWith = (action: CardAction) => [...overlay.values()].filter((e) => e.acted === action).map((e) => e.card);

const NEXT_STATUS: Partial<Record<CardAction, string>> = {
  decide: 'decided',
  withdraw: 'withdrawn',
  verify: 'verified',
  deliver: 'delivered',
  cancel: 'cancelled',
  acknowledge: 'acknowledged',
  apply: 'applied',
  dismiss: 'dismissed',
  approve: 'approved',
  reject: 'rejected',
  submit: 'in_review',
  done: 'done',
  send_to_review: 'review',
  mark_ported: 'ported',
  release: 'released',
  mark_ready: 'ready',
};

const EVENT_KIND: Partial<Record<CardAction, string>> = {
  decide: 'decided',
  deliver: 'delivered',
  verify: 'verified',
  acknowledge: 'acknowledged',
  apply: 'applied',
  dismiss: 'dismissed',
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
  claim: 'claimed',
  unclaim: 'unclaimed',
  mark_ported: 'ported',
};

export interface ActionPayload {
  optionId?: string;
  optionTitle?: string;
  rationale?: string;
  location?: string;
  note?: string;
  reason?: string;
  /** `submit`: the pull request, optional (09 §6). */
  prUrl?: string;
  /** `mark_ported`: "<branch>@<sha> (<repo>)". */
  ref?: string;
  /** `decide`: store an ADR skeleton (09 §7). */
  draftAdr?: boolean;
  /** `apply`: the task this handoff was applied through (09 §9). */
  taskKey?: string;
  /** `verify`: the person verifying is the person who delivered (owner decision 2026-11-04). The note is required, and History says so. */
  selfVerify?: boolean;
}

function eventFor(card: HubCard, kind: string, memberId: string, data: CardEvent['data']): CardEvent {
  return {
    id: `local-${nextEvent++}`,
    seq: card.events.length + 1,
    kind,
    actorKind: 'user',
    actorId: memberId,
    via: 'web',
    at: NOW,
    data,
  };
}

function apply(card: HubCard, action: CardAction, memberId: string, p: ActionPayload): HubCard {
  const status =
    NEXT_STATUS[action] ??
    (action === 'claim' && card.type === 'task' ? 'claimed' : action === 'unclaim' ? 'ready' : action === 'start' ? 'in_progress' : action === 'reopen' ? (card.status === 'in_review' ? 'in_progress' : 'ready') : card.status);
  const data: CardEvent['data'] = {};
  if (p.optionTitle) data.optionTitle = p.optionTitle;
  if (p.rationale) data.rationale = p.rationale;
  if (p.location) data.location = p.location;
  if (p.note) data.note = p.note;
  if (p.reason) data.reason = p.reason;
  if (p.ref) data.ref = p.ref;
  if (p.selfVerify) data.selfVerified = true;
  if (status !== card.status && !EVENT_KIND[action]) {
    data.from = card.status;
    data.to = status;
  }
  const event = eventFor(card, EVENT_KIND[action] ?? 'status_changed', memberId, data);
  const next = { ...card, status, lastEventAt: NOW, events: [...card.events, event] } as HubCard;
  const note = (text: string | undefined) => (text ? { ar: text, en: text } : undefined);

  if (next.type === 'decision' && action === 'decide') {
    next.decision = { ...next.decision, chosenOptionId: p.optionId, rationale: note(p.rationale), decidedById: memberId, decidedAt: NOW, ...(p.draftAdr ? { adrStatus: 'drafted' as const } : {}) };
    next.flags = { ...next.flags, overdue: false, escalated: false };
  }
  if (next.type === 'need' && action === 'deliver') next.need = { ...next.need, location: p.location, deliveredById: memberId, deliveredAt: NOW };
  if (next.type === 'need' && action === 'verify') next.need = { ...next.need, verifiedById: memberId, verifiedAt: NOW, verificationNote: note(p.note), selfVerified: !!p.selfVerify };
  if (next.type === 'handoff' && action === 'acknowledge') next.handoff = { ...next.handoff, acknowledgedById: memberId, acknowledgedAt: NOW };
  if (next.type === 'handoff' && action === 'apply') next.handoff = { ...next.handoff, appliedById: memberId, appliedAt: NOW, appliedTaskKey: p.taskKey ?? next.handoff.appliedTaskKey };
  if (next.type === 'redesign' && action === 'approve') next.redesign = { ...next.redesign, approvedById: memberId, approvedAt: NOW, decisionNote: note(p.note) };
  if (next.type === 'redesign' && action === 'reject') next.redesign = { ...next.redesign, rejectedById: memberId, rejectedAt: NOW, decisionNote: note(p.note) };
  if (next.type === 'redesign' && action === 'mark_ported') next.redesign = { ...next.redesign, portedRef: p.ref };
  if (next.type === 'release' && action === 'release') next.release = { ...next.release, releasedAt: NOW };
  if (next.type === 'task' && action === 'claim') {
    next.assigneeId = memberId;
    next.task = { ...next.task, claimedById: memberId, claimedAt: NOW };
  }
  if (next.type === 'task' && action === 'unclaim') {
    next.assigneeId = undefined;
    next.task = { ...next.task, claimedById: undefined, claimedAt: undefined };
  }
  if (next.type === 'task' && action === 'start') next.task = { ...next.task, startedAt: NOW };
  if (next.type === 'task' && action === 'done') next.task = { ...next.task, doneAt: NOW };
  if (next.type === 'task' && action === 'submit' && p.prUrl) next.task = { ...next.task, prUrl: p.prUrl };
  if (next.type === 'task' && action === 'reopen') {
    next.task = { ...next.task, doneAt: undefined };
    // 04 §3.10: a closed task goes back to the shelf; a task in review goes back to its claimer.
    if (next.status === 'ready') {
      next.assigneeId = undefined;
      next.task = { ...next.task, claimedById: undefined, claimedAt: undefined, startedAt: undefined };
    }
  }
  return next;
}

/** Apply an action. Returns the undo for it, which restores the card exactly as it was. */
export function actOn(key: string, action: CardAction, memberId: string, payload: ActionPayload = {}): () => void {
  const card = getCard(key);
  if (!card) return () => {};
  const previous = overlay.get(key);
  // 04 §3.11 and §3.12: deciding a decision or verifying a need clears the cards it was blocking. Undo restores them too.
  const freed = (action === 'decide' || action === 'verify' ? card.links.filter((l) => l.kind === 'blocks') : []).map((l) => l.key);
  const freedBefore = freed.map((k) => [k, overlay.get(k)] as const);
  let next = apply(card, action, memberId, payload);
  // 09 §10: approval creates the port task. A card that already has one in the catalogue keeps it.
  let createdPort: string | undefined;
  if (next.type === 'redesign' && action === 'approve' && !portTaskOf(next)) {
    createdPort = makePortTask(next, memberId);
    next = { ...next, redesign: { ...next.redesign, portTaskKey: createdPort }, links: [...next.links, { kind: 'relates', key: createdPort }] };
  }
  overlay.set(key, { card: next, acted: action });
  for (const k of freed) {
    const other = getCard(k);
    if (!other) continue;
    // The blocker just closed, so this reads the rest. "Unblocked" is said only when nothing else holds the card.
    const stillBlocked = openBlockers(other).length > 0;
    overlay.set(k, {
      card: { ...other, flags: { ...other.flags, blocked: stillBlocked }, ...(stillBlocked ? {} : { lastEventAt: NOW, events: [...other.events, eventFor(other, 'unblocked', memberId, { by: key })] }) } as HubCard,
      acted: overlay.get(k)?.acted,
    });
  }
  bump();
  return () => {
    if (previous) overlay.set(key, previous);
    else overlay.delete(key);
    if (createdPort) created = created.filter((c) => c.key !== createdPort);
    for (const [k, before] of freedBefore) {
      if (before) overlay.set(k, before);
      else overlay.delete(k);
    }
    bump();
  };
}

/** A write that is not a status action: a release's notes, for instance. */
export function patchCard(key: string, update: (card: HubCard) => HubCard) {
  const card = getCard(key);
  if (!card) return;
  const entry = overlay.get(key);
  overlay.set(key, { card: update(card), acted: entry?.acted });
  bump();
}

export function addComment(key: string, memberId: string, text: string) {
  patchCard(key, (card) => ({
    ...card,
    lastEventAt: NOW,
    comments: [
      ...card.comments,
      { id: `local-c${nextEvent++}`, authorKind: 'user', authorId: memberId, via: 'web', body: { ar: text, en: text }, at: NOW },
    ],
    events: [...card.events, eventFor(card, 'commented', memberId, { excerpt: text.slice(0, 80) })],
  }));
}

export function toggleWatch(key: string, memberId: string) {
  patchCard(key, (card) => {
    const on = card.watchers.includes(memberId);
    return {
      ...card,
      watchers: on ? card.watchers.filter((id) => id !== memberId) : [...card.watchers, memberId],
      events: [...card.events, eventFor(card, on ? 'unwatch' : 'watch', memberId, {})],
    };
  });
}

export function addLink(key: string, memberId: string, kind: LinkKind, otherKey: string) {
  const link: CardLink = { kind, key: otherKey };
  patchCard(key, (card) => ({ ...card, links: [...card.links, link], events: [...card.events, eventFor(card, 'linked', memberId, { kind, otherCardKey: otherKey })] }));
}

/** A card of a type `createCard` does not build (a release). It can be opened right away. */
export function addCard(card: HubCard) {
  created = [card, ...created];
  bump();
}

/** A key for a card made in this session. */
export const nextCardKey = () => `GTV-${nextSeq++}`;

/** Re-render store readers after a change kept outside the store (onboarding progress feeds a sidebar count). */
export const notifyCardStore = bump;

/** 08 P6: nothing is deleted. Archive hides a card from lists and Restore brings it back. */
/** Statuses after which a card no longer blocks anything (09 §6: "blocked_by links to open cards"). */
const CLOSED = new Set(['decided', 'withdrawn', 'superseded', 'verified', 'cancelled', 'applied', 'dismissed', 'done', 'approved', 'ported', 'rejected', 'released']);

/** The keys still blocking this card. Reads the store, so deciding the blocker unblocks the task on every page. */
export const openBlockers = (card: HubCard) => card.links.filter((l) => l.kind === 'blocked_by' && !CLOSED.has(getCard(l.key)?.status ?? '')).map((l) => l.key);

/**
 * The task that does a redesign's port (09 §10). `portTaskKey` is what the real API returns. The catalogue's GTV-252 only links
 * its task, so a `blocks` link to a port-origin task counts too.
 */
export function portTaskOf(card: HubCard): HubCard | undefined {
  if (card.type !== 'redesign') return undefined;
  const direct = card.redesign.portTaskKey ? getCard(card.redesign.portTaskKey) : undefined;
  if (direct) return direct;
  return card.links.map((l) => (l.kind === 'blocks' ? getCard(l.key) : undefined)).find((c) => c?.type === 'task' && c.task.origin === 'redesign_port');
}

function makePortTask(card: Extract<HubCard, { type: 'redesign' }>, memberId: string) {
  const r = card.redesign;
  const key = `GTV-${nextSeq++}`;
  const title = { ar: `نقل ${r.page} ${r.version}`, en: `Port ${r.page} ${r.version}` };
  const task = {
    key,
    type: 'task',
    status: 'ready',
    title,
    priority: card.priority,
    ownerRole: 'frontend',
    repo: r.app === 'web' ? 'web' : 'dashboard',
    createdAt: NOW,
    lastEventAt: NOW,
    createdByKind: 'system',
    createdVia: 'adapter',
    tags: [],
    watchers: [memberId],
    links: [{ kind: 'relates', key: card.key }],
    comments: [],
    attachments: [],
    events: [{ id: `local-${nextEvent++}`, seq: 1, kind: 'created', actorKind: 'system', adapter: 'lab', via: 'adapter', at: NOW, data: { title: title.en, priority: card.priority } }],
    task: { specialty: 'frontend', origin: 'redesign_port', prompt: `Port ${r.labPath}. Touches: ${r.touchesComponents.join(', ')}` },
  } as unknown as HubCard;
  created = [task, ...created];
  return key;
}

/** `handoffs.stale_hours` (03 §7). A handoff past this is the type's version of overdue. */
export const HANDOFF_STALE_HOURS = 48;
export const handoffAgeMs = (card: Pick<HubCard, 'createdAt'>) => Date.parse(NOW) - Date.parse(card.createdAt);
export const isHandoffStale = (card: Pick<HubCard, 'createdAt' | 'status'>) => card.status === 'pending' && handoffAgeMs(card) > HANDOFF_STALE_HOURS * 3_600_000;

// ── "Since last visit" (08 §2, review M4) ───────────────────────────────────────────────────────

let timelineSeen = false;

/** Visiting the Timeline clears the one "since last visit" count. The Timeline's pill is another thing: what arrived while there. */
export function markTimelineSeen() {
  if (timelineSeen) return;
  timelineSeen = true;
  bump();
}
export const isTimelineSeen = () => timelineSeen;

/** `PATCH /tasks/{key}`: the fields the board and the sheet edit in place. Each change is an event (04 §3.10). */
export function updateTask(key: string, memberId: string, fields: { priority?: Priority; branch?: string }) {
  patchCard(key, (card) => {
    if (card.type !== 'task') return card;
    let next: HubCard = card;
    if (fields.priority && fields.priority !== card.priority) {
      next = { ...next, priority: fields.priority, lastEventAt: NOW, events: [...next.events, eventFor(next, 'field_changed', memberId, { field: 'priority', from: card.priority, to: fields.priority })] } as HubCard;
    }
    if (fields.branch !== undefined && fields.branch !== card.task.branch) {
      next = { ...next, branch: fields.branch, task: { ...card.task, branch: fields.branch }, lastEventAt: NOW, events: [...next.events, eventFor(next, 'field_changed', memberId, { field: 'branch', from: card.task.branch ?? '', to: fields.branch })] } as HubCard;
    }
    return next;
  });
}

export function setArchived(key: string, memberId: string, archived: boolean) {
  patchCard(key, (card) => ({
    ...card,
    archivedAt: archived ? NOW : undefined,
    events: [...card.events, eventFor(card, archived ? 'archived' : 'restored', memberId, {})],
  }));
}

export interface NewCardInput {
  type: Extract<CardType, 'task' | 'decision' | 'need' | 'handoff'>;
  title: string;
  ownerRole: Role;
  priority: Priority;
  body?: string;
  memberId: string;
}

/** `NewCardDialog`'s write. The new card lands in the catalogue overlay and can be opened right away. */
export function createCard(input: NewCardInput): HubCard {
  const key = `GTV-${nextSeq++}`;
  const title = { ar: input.title, en: input.title };
  const common = {
    key,
    title,
    priority: input.priority,
    ownerRole: input.ownerRole,
    body: input.body ? { ar: input.body, en: input.body } : undefined,
    createdAt: NOW,
    lastEventAt: NOW,
    createdByKind: 'user' as const,
    createdById: input.memberId,
    createdVia: 'web' as const,
    tags: [],
    watchers: [input.memberId],
    links: [],
    comments: [],
    attachments: [],
    events: [
      {
        id: `local-${nextEvent++}`,
        seq: 1,
        kind: 'created',
        actorKind: 'user' as const,
        actorId: input.memberId,
        via: 'web' as const,
        at: NOW,
        data: { title: input.title, priority: input.priority },
      },
    ],
  };
  const card: HubCard =
    input.type === 'task'
      ? { ...common, type: 'task', status: 'ready', task: { specialty: 'backend', origin: 'manual' } }
      : input.type === 'decision'
        ? { ...common, type: 'decision', status: 'open', decision: { kind: 'product', question: title, options: [], deciderRole: input.ownerRole, remindersSent: [], adrStatus: 'none' } }
        : input.type === 'need'
          ? { ...common, type: 'need', status: 'requested', need: { kind: 'other', responsibleRole: input.ownerRole, requesterId: input.memberId } }
          : { ...common, type: 'handoff', status: 'pending', handoff: { fromRole: input.ownerRole, toRole: input.ownerRole, kind: 'other', severity: 'info', summary: title, payload: {} } };
  created = [card, ...created];
  bump();
  return card;
}

export function searchCards(query: string, locale: Locale, limit = 8): HubCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const list = allCards().filter((c) => c.key.toLowerCase().includes(q) || c.title[locale].toLowerCase().includes(q) || c.title.en.toLowerCase().includes(q));
  return list
    .sort((a, b) => Number(b.key.toLowerCase().startsWith(q)) - Number(a.key.toLowerCase().startsWith(q)))
    .slice(0, limit);
}

/** A new scenario starts from a clean slate, as a page reload would. */
export function resetCardStore() {
  overlay.clear();
  created = [];
  timelineSeen = false;
  nextSeq = 300;
  bump();
}
