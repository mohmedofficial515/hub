/**
 * @file group.ts
 * @description How inbox items read on the page. The API sends flat items and the client merges a `groupKey` within 30 minutes (docs/04 §3.17). The
 * 14 kinds are 6 families in the filter, because 14 options help nobody.
 */
import type { InboxItem, NotificationKind } from '@hub/contracts';

export type KindFamily = 'routed' | 'mention' | 'watch' | 'reminder' | 'brief' | 'system';

export const FAMILIES: KindFamily[] = ['routed', 'mention', 'watch', 'reminder', 'brief', 'system'];

export const KINDS_OF: Record<KindFamily, NotificationKind[]> = {
  routed: [
    'routed_decision',
    'routed_need',
    'routed_handoff',
    'routed_review',
    'routed_idea',
    'review_requested',
    'escalation',
    'task_ready',
  ],
  mention: ['mention'],
  watch: ['watch_update', 'unblocked'],
  reminder: ['deadline_reminder'],
  brief: ['brief'],
  system: ['system'],
};

const GROUP_MS = 30 * 60_000;

export interface InboxGroup {
  /** The newest item of the group: the row shows it. */
  lead: InboxItem;
  ids: string[];
  /** Merged items beyond the lead. */
  more: number;
  unread: boolean;
}

/** A read item never hides behind an unread one, so `e` on a row always does what it says. */
export function groupItems(items: readonly InboxItem[]): InboxGroup[] {
  const out: InboxGroup[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (
      last &&
      item.groupKey &&
      last.lead.groupKey === item.groupKey &&
      !last.lead.readAt === !item.readAt &&
      Date.parse(last.lead.createdAt) - Date.parse(item.createdAt) <= GROUP_MS
    ) {
      last.ids.push(item.id);
      last.more += 1;
    } else {
      out.push({ lead: item, ids: [item.id], more: 0, unread: !item.readAt });
    }
  }
  return out;
}

export interface InboxSection {
  id: 'today' | 'yesterday' | 'earlier';
  groups: InboxGroup[];
}

export function sectionsOf(
  groups: readonly InboxGroup[],
  dayKeyOf: (iso: string) => string,
  todayKey: string,
  yesterdayKey: string,
): InboxSection[] {
  const buckets: InboxSection[] = [
    { id: 'today', groups: [] },
    { id: 'yesterday', groups: [] },
    { id: 'earlier', groups: [] },
  ];
  for (const group of groups) {
    const key = dayKeyOf(group.lead.createdAt);
    buckets[key === todayKey ? 0 : key === yesterdayKey ? 1 : 2]?.groups.push(group);
  }
  return buckets.filter((bucket) => bucket.groups.length > 0);
}
