/**
 * @file Card event kinds (docs/03 §5.2), and the realtime message published after commit.
 */
import type { ActorKind, Via } from './actor';
import type { CardType } from './cards/card';

export const EVENT_KINDS = [
  'created',
  'status_changed',
  'field_changed',
  'claimed',
  'unclaimed',
  'commented',
  'linked',
  'unlinked',
  'decided',
  'reminder_sent',
  'escalated',
  'delivered',
  'verified',
  'acknowledged',
  'applied',
  'dismissed',
  'commit',
  'pr_opened',
  'pr_merged',
  'pr_closed',
  'session_logged',
  'approved',
  'rejected',
  'changes_requested',
  'ported',
  'unblocked',
  'archived',
  'restored',
  'redacted',
  'watch',
  'unwatch',
  'plan_revised',
  'plan_steps_changed',
  'idea_to_plan',
  'plan_to_tasks',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** The Redis channel carrying a workspace's events; the SSE stream (docs/15 §7) subscribes to it. */
export function workspaceEventsChannel(workspaceId: string): string {
  return `ws:${workspaceId}:events`;
}

/** Published once per card event, after the transaction commits. Carries no body text. */
export interface RealtimeCardEvent {
  readonly eventId: string;
  readonly workspaceId: string;
  readonly cardId: string;
  readonly cardKey: string;
  readonly cardType: CardType;
  readonly seq: number;
  readonly kind: EventKind;
  readonly status: string;
  readonly actorKind: Extract<ActorKind, 'user' | 'agent' | 'system'>;
  readonly actorId: string | null;
  readonly via: Via;
  readonly at: string;
}

/**
 * Anything else on the same channel: notifications, briefs, source runs (docs/04 §4). `audience` picks the
 * connections; card events go to every member of the project.
 */
export interface RealtimeEnvelope {
  readonly event: string;
  readonly data: unknown;
  readonly audience: 'all' | { readonly userIds: readonly string[] } | { readonly roles: readonly string[] };
}

/** What travels on the channel. `streamId` is the id of the entry in the replay buffer, the SSE `id:`. */
export type RealtimeMessage = (RealtimeCardEvent | RealtimeEnvelope) & { readonly streamId: string };

/** The Redis stream holding a project's last events, for `Last-Event-ID`. */
export function workspaceEventsStream(workspaceId: string): string {
  return `ws:${workspaceId}:stream`;
}

/** How much of the stream a reconnect may replay (docs/04 §3.22). */
export const REALTIME_REPLAY = { maxEntries: 500, maxAgeMs: 10 * 60 * 1000 } as const;
