'use client';

/**
 * @file session.ts
 * @description Who is looking, in which project, and the numbers scoped to them. Replaces the design's `kit/session.ts`, whose persona and
 * scenario came from the lab. Roles are read live for the project in the URL (docs/15 §5).
 */
import type { Role } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useRoute } from '@/components/shell/router';
import { get, getPage } from '@/lib/api/client';
import { hoursFromNow } from '@/lib/format';
import type { CardAction } from '@/lib/i18n/kit-dict';
import { getQueryClient } from '@/lib/query-client';

import { qk } from '../cards/keys';
import { avatarHue, type CardSummaryDto } from '../cards/map';
import { fetchCards, useReadyTasks } from '../cards/store';
import type { CardListItem, Member } from '../cards/types';

export interface WorkspaceRef {
  id: string;
  slug: string;
  name: string;
  keyPrefix: string;
  roles: Role[];
  timezone: string;
  defaultLocale: 'ar' | 'en';
  totpRequired?: boolean;
  /** Cards waiting on me, where the list endpoint provides it. */
  awaitingCount?: number;
  status?: 'active' | 'paused' | 'closed';
  description?: string | null;
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  locale: 'ar' | 'en';
  avatarColor: string | number | null;
  totpEnabled: boolean;
  createdAt: string;
  workspaces: WorkspaceRef[];
}

export const fetchMe = () => get<Me>('auth/me');

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: 5 * 60_000 });
}

export function useWorkspaces() {
  return useQuery({ queryKey: qk.workspaces, queryFn: () => get<WorkspaceRef[]>('workspaces') });
}

export interface WorkspaceDetail extends WorkspaceRef {
  myRoles?: Role[];
}

export function useWorkspace() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.workspace(ws),
    enabled: !!ws,
    queryFn: () => get<WorkspaceDetail>(`workspaces/${ws}`),
  });
}

interface MemberDto {
  id?: string;
  userId?: string;
  displayName: string;
  email?: string;
  avatarColor?: string | number | null;
  roles?: Role[];
  lastActiveAt?: string | null;
  lastSeenAt?: string | null;
  online?: boolean;
}

const toMember = (dto: MemberDto): Member => {
  const id = dto.userId ?? dto.id ?? '';
  return {
    id,
    name: dto.displayName,
    email: dto.email,
    avatarColor: avatarHue(dto.avatarColor, id),
    roles: dto.roles ?? [],
    lastActiveAt: dto.lastActiveAt ?? dto.lastSeenAt ?? undefined,
    online: dto.online,
  };
};

export function useMembers() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.members(ws),
    enabled: !!ws,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await getPage<MemberDto>(`workspaces/${ws}/members`, { limit: 100 })).items.map(toMember),
  });
}

/** A member by id, from the cached list. Used inside rows, so it never starts a request of its own per row. */
export function useMember(id: string | null | undefined): Member | undefined {
  const { data } = useMembers();
  return id ? data?.find((m) => m.id === id) : undefined;
}

export function memberById(ws: string, id: string): Member | undefined {
  return getQueryClient()
    .getQueryData<Member[]>(qk.members(ws))
    ?.find((m) => m.id === id);
}

export interface Session {
  me: Member;
  roles: Role[];
  isOwner: boolean;
  /** Owner or PM: Members and Settings counters are theirs (08 §2). */
  isManager: boolean;
  workspace: WorkspaceRef | undefined;
  loading: boolean;
  error: boolean;
}

const NOBODY: Member = { id: '', name: '', avatarColor: 1, roles: [] };

export function useSession(): Session {
  const { ws } = useRoute();
  const me = useMe();
  return useMemo(() => {
    const workspace = me.data?.workspaces.find((w) => w.slug === ws);
    const roles = workspace?.roles ?? [];
    const member: Member = me.data
      ? {
          id: me.data.id,
          name: me.data.displayName,
          email: me.data.email,
          avatarColor: avatarHue(me.data.avatarColor, me.data.id),
          roles,
        }
      : NOBODY;
    return {
      me: member,
      roles,
      isOwner: roles.includes('owner'),
      isManager: roles.includes('owner') || roles.includes('pm'),
      workspace,
      loading: me.isPending,
      error: me.isError,
    };
  }, [me.data, me.isPending, me.isError, ws]);
}

// ── Numbers scoped to me (review M9, docs/08 §2) ─────────────────────────────────────────────────

/** `GET /counters` (docs/04 §3.23). */
export interface Counters {
  inboxUnread: number;
  awaitingMe: number;
  decisionsOpen: number;
  decisionsOverdue: number;
  decisionsMine?: number;
  needsOpen: number;
  needsMine?: number;
  handoffsPending: number;
  handoffsMine?: number;
  tasksReadyForMe: number;
  redesignInReview: number;
  noSummarySessions: number;
  newEvents?: number;
  onboardingLeft?: number;
  invitesPending?: number;
  sourceProblems?: number;
  planningOpen?: number;
}

export function useCounters() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.counters(ws),
    enabled: !!ws,
    queryFn: () => get<Counters>(`workspaces/${ws}/counters`),
  });
}

/** `GET /inbox/count`. Under the inbox key, so the stream and every write keep it current. */
export function useInboxCount() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.inbox(ws), 'count'] as const,
    enabled: !!ws,
    queryFn: () => get<{ unread: number }>(`workspaces/${ws}/inbox/count`),
  });
}

export interface MyCounts {
  inbox: number;
  newEvents: number;
  tasksReady: number;
  decisions: { mine: number; all: number; overdue: number };
  needs: { mine: number; all: number };
  handoffs: { mine: number; all: number };
  redesigns: { mine: number; all: number };
  planning: number;
  onboarding: number;
  invites: number;
  sourceProblems: number;
}

export const toMyCounts = (c: Counters | undefined): MyCounts => ({
  inbox: c?.inboxUnread ?? 0,
  newEvents: c?.newEvents ?? 0,
  tasksReady: c?.tasksReadyForMe ?? 0,
  decisions: {
    mine: c?.decisionsMine ?? c?.decisionsOpen ?? 0,
    all: c?.decisionsOpen ?? 0,
    overdue: c?.decisionsOverdue ?? 0,
  },
  needs: { mine: c?.needsMine ?? c?.needsOpen ?? 0, all: c?.needsOpen ?? 0 },
  handoffs: { mine: c?.handoffsMine ?? c?.handoffsPending ?? 0, all: c?.handoffsPending ?? 0 },
  redesigns: { mine: c?.redesignInReview ?? 0, all: c?.redesignInReview ?? 0 },
  planning: c?.planningOpen ?? 0,
  onboarding: c?.onboardingLeft ?? 0,
  invites: c?.invitesPending ?? 0,
  sourceProblems: c?.sourceProblems ?? 0,
});

/**
 * Numbers everyone reads: the sidebar badges and the Today band. "Mine" is the same list as the rows, so a count and its list cannot disagree
 * (review M9). What only `/counters` knows counts as zero until it answers, so no badge shows a number nobody computed.
 */
export function useMyCounts(): MyCounts {
  const counters = useCounters().data;
  const inbox = useInboxCount().data?.unread;
  const stack = useAwaitingQuery().data;
  const ready = useReadyTasks().data;
  return useMemo(() => {
    const base = { ...toMyCounts(counters), ...(inbox === undefined ? {} : { inbox }) };
    if (!stack) return ready ? { ...base, tasksReady: ready.length } : base;
    const mine = (type: CardListItem['type']) => stack.filter((row) => row.type === type);
    const decisions = mine('decision');
    return {
      ...base,
      tasksReady: ready?.length ?? base.tasksReady,
      decisions: {
        mine: decisions.length,
        all: base.decisions.all || decisions.length,
        overdue: decisions.filter(isOverdue).length,
      },
      needs: { mine: mine('need').length, all: base.needs.all || mine('need').length },
      handoffs: { mine: mine('handoff').length, all: base.handoffs.all || mine('handoff').length },
      redesigns: { mine: mine('redesign').length, all: base.redesigns.all || mine('redesign').length },
    };
  }, [counters, inbox, stack, ready]);
}

// ── Awaiting me (docs/09 §4) ─────────────────────────────────────────────────────────────────────

export type AwaitingGroup = 'urgent' | 'soon' | 'rest';

export type AwaitingCard = CardListItem & {
  group: AwaitingGroup;
  action: CardAction;
};

const PRIO = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const ORDER: AwaitingGroup[] = ['urgent', 'soon', 'rest'];

export const isLate = (c: Pick<CardListItem, 'flags' | 'dueAt'>) =>
  !!(c.flags?.overdue || c.flags?.escalated || (c.dueAt && hoursFromNow(c.dueAt) < 0));
export const isOverdue = (c: Pick<CardListItem, 'flags' | 'dueAt'>) =>
  !!(c.flags?.overdue || (c.dueAt && hoursFromNow(c.dueAt) < 0));

function groupOf(c: CardListItem): AwaitingGroup {
  if (isLate(c) || c.flags?.stale) return 'urgent';
  if (c.dueAt && hoursFromNow(c.dueAt) <= 24) return 'soon';
  return 'rest';
}

/**
 * Review B2: the API decides what waits on me from the card's current state and says the verb on the row, so it swaps as the card moves (Acknowledge
 * becomes Apply) and the row leaves when nothing remains. Urgent first, then the next 24 h, then the rest by date and priority (review M3).
 */
export function buildAwaiting(rows: CardListItem[]): AwaitingCard[] {
  return rows
    .flatMap((row) =>
      row.awaiting ? [{ ...row, action: row.awaiting as CardAction, group: groupOf(row) }] : [],
    )
    .sort(
      (a, b) =>
        ORDER.indexOf(a.group) - ORDER.indexOf(b.group) ||
        (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
        PRIO[a.priority] - PRIO[b.priority],
    );
}

/** `GET /cards?awaiting=me`. It sits under the cards prefix, so writes and the stream keep it current. */
export function useAwaitingQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { awaiting: 'me' }),
    enabled: !!ws,
    queryFn: () => fetchCards(ws, { awaiting: 'me' }),
    select: (page) => page.items,
  });
}

export function useAwaiting(): AwaitingCard[] {
  const rows = useAwaitingQuery().data;
  return useMemo(() => buildAwaiting(rows ?? []), [rows]);
}

export { useReadyTasks };

export interface TodayData {
  awaitingMe: CardSummaryDto[];
  readyTasks: CardSummaryDto[];
  deadlines: CardSummaryDto[];
  [section: string]: unknown;
}

/** `GET /today` (docs/04 §3.23), for the Today page. */
export function useToday() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.today(ws),
    enabled: !!ws,
    queryFn: () => get<TodayData>(`workspaces/${ws}/today`),
  });
}
