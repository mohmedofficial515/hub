/**
 * @file views.tsx
 * @description The one list of views: the sidebar, the palette, the breadcrumb and the `g` shortcuts all read it. Ported from
 * v5 `shell/views.tsx`, with Planning first in Work (docs/15 §4). A route lives in `app/[locale]/[ws]/<id>/page.tsx`.
 */
import {
  ArrowLeftRight,
  CalendarDays,
  CircleHelp,
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
}

export const views: ViewDef[] = [
  { id: 'today', icon: CalendarDays, group: null, goKey: 't' },
  { id: 'inbox', icon: Inbox, group: null, counter: 'inbox', goKey: 'i' },
  { id: 'planning', icon: Lightbulb, group: 'work', counter: 'planning', goKey: 'p' },
  { id: 'timeline', icon: GitCommitHorizontal, group: 'work', counter: 'timeline', goKey: 'l' },
  { id: 'tasks', icon: SquareCheck, group: 'work', counter: 'tasks', goKey: 'k' },
  { id: 'decisions', icon: Scale, group: 'work', counter: 'decisions', goKey: 'd' },
  { id: 'needs', icon: KeyRound, group: 'work', counter: 'needs', goKey: 'n' },
  { id: 'handoffs', icon: ArrowLeftRight, group: 'work', counter: 'handoffs', goKey: 'h' },
  { id: 'redesign', icon: Palette, group: 'work', counter: 'redesign', goKey: 'r' },
  { id: 'releases', icon: Rocket, group: 'work', goKey: 'e' },
  { id: 'queue', icon: ListOrdered, group: 'work', goKey: 'q' },
  { id: 'live', icon: Radio, group: 'work', goKey: 'v' },
  { id: 'docs', icon: FileText, group: 'knowledge', goKey: 'o' },
  { id: 'ask', icon: CircleHelp, group: 'knowledge', goKey: 'a' },
  { id: 'onboarding', icon: Compass, group: 'knowledge', counter: 'onboarding', goKey: 'w' },
  { id: 'skills', icon: Sparkles, group: 'knowledge', goKey: 'c' },
  { id: 'members', icon: Users, group: 'workspace', counter: 'members', goKey: 'm' },
  { id: 'settings', icon: Settings, group: 'workspace', counter: 'settings', goKey: 's' },
  { id: 'schema', icon: Database, group: 'admin', goKey: 'b' },
];

export const viewById = (id: ViewId) => views.find((v) => v.id === id)!;
export const NAV_GROUPS: NavGroup[] = ['work', 'knowledge', 'workspace', 'admin'];
