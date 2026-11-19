/**
 * @file views.tsx
 * @description The one list of views: the sidebar, the palette, the breadcrumb and the `g` shortcuts all read it. Ported from
 * v5 `shell/views.tsx`, with Planning first in Work (docs/15 §4). A route lives in `app/[locale]/[ws]/<id>/page.tsx`.
 * The groups follow the owner's decision of 2026-11-19: Work, Follow, Delivery, Knowledge, Project. Live is a tab of the queue now, so it has
 * no sidebar item; its `g v` key and its palette entry open that tab.
 */
import {
  ArrowLeftRight,
  CalendarDays,
  Compass,
  Database,
  FileText,
  GitCommitHorizontal,
  Inbox,
  KeyRound,
  Lightbulb,
  ListOrdered,
  type LucideIcon,
  Palette,
  Radio,
  Rocket,
  Scale,
  Search,
  Settings,
  Sparkles,
  SquareCheck,
  Users,
} from 'lucide-react';

import type { NavGroup } from '@/lib/i18n/shell-dict';

import type { ViewId } from './router';

export type CounterKey =
  | 'inbox'
  | 'timeline'
  | 'planning'
  | 'tasks'
  | 'decisions'
  | 'needs'
  | 'handoffs'
  | 'redesign'
  | 'onboarding'
  | 'members'
  | 'settings';

export interface ViewDef {
  id: ViewId;
  icon: LucideIcon;
  /** null = the top pair, above the groups (08 §2). */
  group: NavGroup | null;
  /** The sidebar badge it shows, if any. */
  counter?: CounterKey;
  /** Second key of the `g` sequence (08 §12), if it has one. */
  goKey?: string;
  /** false: reachable from the palette and its `g` key, but no sidebar item. */
  nav?: false;
  /** Where the palette and the `g` key go, when it is not the view's own page (Live is a tab of the queue). */
  to?: { view: ViewId; query: Record<string, string> };
}

export const views: ViewDef[] = [
  { id: 'today', icon: CalendarDays, group: null, goKey: 't' },
  { id: 'inbox', icon: Inbox, group: null, counter: 'inbox', goKey: 'i' },
  { id: 'planning', icon: Lightbulb, group: 'work', counter: 'planning', goKey: 'p' },
  { id: 'tasks', icon: SquareCheck, group: 'work', counter: 'tasks', goKey: 'k' },
  { id: 'decisions', icon: Scale, group: 'work', counter: 'decisions', goKey: 'd' },
  { id: 'needs', icon: KeyRound, group: 'work', counter: 'needs', goKey: 'n' },
  { id: 'handoffs', icon: ArrowLeftRight, group: 'work', counter: 'handoffs', goKey: 'h' },
  { id: 'timeline', icon: GitCommitHorizontal, group: 'follow', counter: 'timeline', goKey: 'l' },
  { id: 'queue', icon: ListOrdered, group: 'follow', goKey: 'q' },
  {
    id: 'live',
    icon: Radio,
    group: 'follow',
    goKey: 'v',
    nav: false,
    to: { view: 'queue', query: { show: 'live' } },
  },
  { id: 'redesign', icon: Palette, group: 'delivery', counter: 'redesign', goKey: 'r' },
  { id: 'releases', icon: Rocket, group: 'delivery', goKey: 'e' },
  { id: 'docs', icon: FileText, group: 'knowledge', goKey: 'o' },
  { id: 'ask', icon: Search, group: 'knowledge', goKey: 'a' },
  { id: 'onboarding', icon: Compass, group: 'knowledge', counter: 'onboarding', goKey: 'w' },
  { id: 'skills', icon: Sparkles, group: 'knowledge', goKey: 'c' },
  { id: 'schema', icon: Database, group: 'knowledge', goKey: 'b' },
  { id: 'members', icon: Users, group: 'workspace', counter: 'members', goKey: 'm' },
  { id: 'settings', icon: Settings, group: 'workspace', counter: 'settings', goKey: 's' },
];

export const viewById = (id: ViewId) => views.find((v) => v.id === id)!;
export const NAV_GROUPS: NavGroup[] = ['work', 'follow', 'delivery', 'knowledge', 'workspace'];
