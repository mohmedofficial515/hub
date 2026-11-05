import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  CircleHelp,
  Compass,
  FileText,
  GitCommitHorizontal,
  Inbox,
  KeyRound,
  Palette,
  Rocket,
  Scale,
  Settings,
  SquareCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { NavGroup } from '../i18n';
import type { ViewId } from './router';

export type CounterKey = 'inbox' | 'timeline' | 'tasks' | 'decisions' | 'needs' | 'handoffs' | 'redesign' | 'onboarding' | 'members' | 'settings';

export interface ViewDef {
  id: ViewId;
  icon: LucideIcon;
  /** null = the top pair, above the groups (08 §2). */
  group: NavGroup | null;
  /** The sidebar badge it shows, if any. */
  counter?: CounterKey;
  /** Second key of the `g` sequence (08 §12), if it has one. */
  goKey?: string;
  Page: LazyExoticComponent<ComponentType>;
}

/**
 * The one list of views: the sidebar, the router, the palette, the breadcrumb and the `g` shortcuts all read it.
 * Each page lives in `pages/<id>/page.tsx`; filling that folder is all it takes to add one.
 */
export const views: ViewDef[] = [
  { id: 'today', icon: CalendarDays, group: null, goKey: 't', Page: lazy(() => import('../pages/today/page')) },
  { id: 'inbox', icon: Inbox, group: null, counter: 'inbox', goKey: 'i', Page: lazy(() => import('../pages/inbox/page')) },
  { id: 'timeline', icon: GitCommitHorizontal, group: 'work', counter: 'timeline', goKey: 'l', Page: lazy(() => import('../pages/timeline/page')) },
  { id: 'tasks', icon: SquareCheck, group: 'work', counter: 'tasks', goKey: 'k', Page: lazy(() => import('../pages/tasks/page')) },
  { id: 'decisions', icon: Scale, group: 'work', counter: 'decisions', goKey: 'd', Page: lazy(() => import('../pages/decisions/page')) },
  { id: 'needs', icon: KeyRound, group: 'work', counter: 'needs', goKey: 'n', Page: lazy(() => import('../pages/needs/page')) },
  { id: 'handoffs', icon: ArrowLeftRight, group: 'work', counter: 'handoffs', goKey: 'h', Page: lazy(() => import('../pages/handoffs/page')) },
  { id: 'redesign', icon: Palette, group: 'work', counter: 'redesign', goKey: 'r', Page: lazy(() => import('../pages/redesign/page')) },
  { id: 'releases', icon: Rocket, group: 'work', Page: lazy(() => import('../pages/releases/page')) },
  { id: 'docs', icon: FileText, group: 'knowledge', Page: lazy(() => import('../pages/docs/page')) },
  { id: 'ask', icon: CircleHelp, group: 'knowledge', Page: lazy(() => import('../pages/ask/page')) },
  { id: 'onboarding', icon: Compass, group: 'knowledge', counter: 'onboarding', Page: lazy(() => import('../pages/onboarding/page')) },
  { id: 'members', icon: Users, group: 'workspace', counter: 'members', Page: lazy(() => import('../pages/members/page')) },
  { id: 'settings', icon: Settings, group: 'workspace', counter: 'settings', Page: lazy(() => import('../pages/settings/page')) },
];

export const viewById = (id: ViewId) => views.find((v) => v.id === id)!;
export const NAV_GROUPS: NavGroup[] = ['work', 'knowledge', 'workspace'];
