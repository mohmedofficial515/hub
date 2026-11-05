// The stand-in for `GET /workspaces/{ws}/timeline` (04 §3.9, 09 §5). The real query reads `card_events` joined to cards
// (03 §5.2), so this reads `card.events` from the cards it is handed and never keeps a second copy. An action taken in
// the sheet therefore lands at the top of the stream by itself. Keys GTV-290..GTV-295 belong to this file;
// `index.ts` spreads `extraChanges` into `cards`.

import type { CardEvent, ChangeCard, HubCard, L } from './index';

const l = (ar: string, en: string): L => ({ ar, en });
const T = (d: string, hm: string) => `2026-${d}T${hm}:00+03:00`;

const github = { actorKind: 'system', adapter: 'github', via: 'adapter' } as const;

function commitEvents(key: string, commits: ChangeCard['change']['commits'], authorLogin: string): CardEvent[] {
  return commits.map((c, i) => ({ id: `${key}-c${i + 1}`, seq: i + 1, kind: 'commit', at: c.at, ...github, data: { sha: c.sha, message: c.message, authorLogin, files: c.files, additions: c.additions, deletions: c.deletions } }));
}

const change = (card: Partial<ChangeCard> & Pick<ChangeCard, 'key' | 'title' | 'change' | 'createdAt' | 'events'>): ChangeCard =>
  ({
    type: 'change',
    status: 'recorded',
    priority: 'P2',
    ownerRole: null,
    lastEventAt: card.events[card.events.length - 1]?.at ?? card.createdAt,
    createdByKind: 'system',
    createdVia: 'adapter',
    tags: [],
    watchers: [],
    links: [],
    comments: [],
    attachments: [],
    ...card,
  }) as ChangeCard;

const walletCommits = [
  { sha: 'd41c9e0', message: 'wallet: top-up sheet skeleton', at: T('11-03', '18:30'), files: 3, additions: 88, deletions: 4 },
  { sha: '8ab27f1', message: 'wallet: quick amounts', at: T('11-03', '18:41'), files: 2, additions: 46, deletions: 6 },
  { sha: 'e0f6153', message: 'wallet: RTL pass on the sheet', at: T('11-03', '18:52'), files: 4, additions: 31, deletions: 22 },
  { sha: '17c3ad8', message: 'wallet: phone snapshot test', at: T('11-03', '19:00'), files: 3, additions: 75, deletions: 3 },
];

const paytrCommits = [
  { sha: '3e8f0a4', message: 'paytr: hash the live callback', at: T('11-03', '16:12'), files: 4, additions: 96, deletions: 12 },
  { sha: 'bb19c02', message: 'paytr: reject replayed callbacks', at: T('11-03', '16:35'), files: 2, additions: 42, deletions: 5 },
];

export const extraChanges: ChangeCard[] = [
  change({
    // 09 §5 acceptance: 4 commits inside 30 minutes collapse to one row with +3.
    key: 'GTV-290',
    title: l('شحن المحفظة: ورقة الشحن على الجوال', 'Wallet top-up: the phone sheet'),
    ownerRole: 'frontend',
    repo: 'web',
    module: 'wallet',
    branch: 'feat/wallet-topup',
    assigneeId: 'u-karim',
    createdAt: T('11-03', '18:30'),
    events: commitEvents('GTV-290', walletCommits, 'karim-adel'),
    change: { kind: 'commits', authorLogin: 'karim-adel', authorUserId: 'u-karim', commits: walletCommits, commitCount: 4, filesChanged: 12, additions: 240, deletions: 35, windowStart: T('11-03', '18:30'), windowEnd: T('11-03', '19:00') },
  }),
  change({
    key: 'GTV-291',
    title: l('محوّل PayTR: تأمين رد الاتصال الحي', 'PayTR adapter: secure the live callback'),
    priority: 'P1',
    ownerRole: 'backend',
    repo: 'backend',
    module: 'payments',
    branch: 'feat/paytr-live',
    assigneeId: 'u-yousef',
    createdAt: T('11-03', '16:12'),
    links: [{ kind: 'relates', key: 'GTV-259' }],
    events: commitEvents('GTV-291', paytrCommits, 'yousef-q'),
    change: { kind: 'commits', authorLogin: 'yousef-q', authorUserId: 'u-yousef', commits: paytrCommits, commitCount: 2, filesChanged: 6, additions: 138, deletions: 17, windowStart: T('11-03', '16:12'), windowEnd: T('11-03', '16:35') },
  }),
  change({
    // The session Today lists under "no summary" (`noSummarySessions`, same id).
    key: 'GTV-292',
    title: l('جلسة: تسجيل الجلسات في Hub', 'Session: session logging in Hub'),
    ownerRole: 'backend',
    repo: 'hub',
    branch: 'feat/h1-02-session-logging',
    assigneeId: 'u-owner',
    createdByKind: 'agent',
    createdById: 'u-owner',
    createdVia: 'hook',
    createdAt: T('11-03', '17:20'),
    events: [{ id: 'GTV-292-s1', seq: 1, kind: 'session_logged', at: T('11-03', '17:20'), actorKind: 'agent', actorId: 'u-owner', via: 'hook', data: { sessionId: '7f3a…c21', hasSummary: false } }],
    change: { kind: 'session', authorUserId: 'u-owner', commits: [], commitCount: 4, filesChanged: 9, additions: 310, deletions: 48, session: { sessionId: '7f3a…c21', durationSec: 5760, noSummary: true } },
  }),
];

/**
 * Events that reach the page after it opened: what SSE `card.event` would push (09 §5). The first three have arrived by
 * the time the page paints, so the pill shows from the start. The fourth arrives 20 s later, to prove the rule: at the
 * top of the list it prepends, scrolled down it adds to the pill.
 */
export const liveEvents: { cardKey: string; event: CardEvent }[] = [
  { cardKey: 'GTV-260', event: { id: 'live-1', seq: 90, kind: 'commit', at: T('11-04', '08:36'), ...github, data: { sha: '5c02e7b', message: 'refund form: reason and refundTo', authorLogin: 'sara-alharbi', files: 3, additions: 58, deletions: 11 } } },
  { cardKey: 'GTV-278', event: { id: 'live-2', seq: 91, kind: 'status_changed', at: T('11-04', '08:41'), actorKind: 'user', actorId: 'u-karim', via: 'web', data: { from: 'claimed', to: 'in_progress' } } },
  { cardKey: 'GTV-255', event: { id: 'live-3', seq: 92, kind: 'commented', at: T('11-04', '08:43'), actorKind: 'user', actorId: 'u-karim', via: 'web', data: { excerpt: 'web also calls the old refund shape, I will sync it today' } } },
  { cardKey: 'GTV-259', event: { id: 'live-4', seq: 93, kind: 'commit', at: T('11-04', '08:44'), ...github, data: { sha: '91ad4e6', message: 'paytr: map live error codes', authorLogin: 'yousef-q', files: 2, additions: 37, deletions: 9 } } },
];

/** Watching a card is history, not news (03 §5.2: "not shown in the timeline, only in card history"). */
const HIDDEN = new Set(['watch', 'unwatch']);

export interface StreamEvent {
  event: CardEvent;
  card: HubCard;
}

/** 04 §3.9 `TimelineRow`, with the collapsed events themselves, so the "+n" expander needs no second request. */
export interface StreamRow extends StreamEvent {
  id: string;
  /** Older events folded into this row, newest first. */
  collapsed: CardEvent[];
}

const COLLAPSE_MS = 30 * 60_000;

/** Every event of these cards, newest first. Pass `live` for the events that have arrived. */
export function streamEvents(cards: HubCard[], live: { cardKey: string; event: CardEvent }[] = []): StreamEvent[] {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const out: StreamEvent[] = [];
  for (const card of cards) {
    for (const event of card.events) {
      if (HIDDEN.has(event.kind)) continue;
      // A change card is created by its first commit or PR, so its `created` event says nothing the next one does not.
      if (event.kind === 'created' && card.type === 'change' && card.events.length > 1) continue;
      out.push({ event, card });
    }
  }
  for (const { cardKey, event } of live) {
    const card = byKey.get(cardKey);
    if (card) out.push({ event, card });
  }
  return out.sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at) || b.event.seq - a.event.seq);
}

/** Consecutive events of one card within 30 minutes become one row (`timeline.collapse_minutes`, 09 §5). */
export function collapseStream(events: StreamEvent[]): StreamRow[] {
  const rows: StreamRow[] = [];
  for (const item of events) {
    const last = rows[rows.length - 1];
    if (last && last.card.key === item.card.key) {
      const edge = last.collapsed[last.collapsed.length - 1]?.at ?? last.event.at;
      if (Date.parse(edge) - Date.parse(item.event.at) <= COLLAPSE_MS) {
        last.collapsed.push(item.event);
        continue;
      }
    }
    rows.push({ ...item, id: item.event.id, collapsed: [] });
  }
  return rows;
}
