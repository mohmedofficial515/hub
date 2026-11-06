/**
 * @file meta.ts
 * @description Ported from apps/lab/hub/today/v5-peacock-app/kit/meta.ts. Contract: apps/web/README.md.
 */
import {
  ArrowLeftRight,
  Ban,
  Bug,
  Calculator,
  Circle,
  CircleCheck,
  CirclePlay,
  ClipboardList,
  Clock,
  Crown,
  FileText,
  GitCommitHorizontal,
  KeyRound,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  MonitorSmartphone,
  Palette,
  PenTool,
  Rocket,
  Scale,
  Server,
  SquareCheck,
  TriangleAlert,
} from 'lucide-react';

import type { CardType, Priority, Role } from '@/features/cards/types';

/**
 * Full class strings per card type: Tailwind only sees literal class names, so they are spelled out.
 * The hue of each type lives in tokens.css. Components never pick a colour themselves.
 */
export const typeClass: Record<
  CardType,
  {
    dot: string;
    soft: string;
    fg: string;
    /** A chart mark's outline, never a card's edge. */ edge: string;
    fill: string;
    stroke: string;
  }
> = {
  task: {
    dot: 'bg-type-task',
    soft: 'bg-type-task-soft',
    fg: 'text-type-task-fg',
    edge: 'border-type-task',
    fill: 'fill-type-task',
    stroke: 'stroke-type-task',
  },
  decision: {
    dot: 'bg-type-decision',
    soft: 'bg-type-decision-soft',
    fg: 'text-type-decision-fg',
    edge: 'border-type-decision',
    fill: 'fill-type-decision',
    stroke: 'stroke-type-decision',
  },
  need: {
    dot: 'bg-type-need',
    soft: 'bg-type-need-soft',
    fg: 'text-type-need-fg',
    edge: 'border-type-need',
    fill: 'fill-type-need',
    stroke: 'stroke-type-need',
  },
  change: {
    dot: 'bg-type-change',
    soft: 'bg-type-change-soft',
    fg: 'text-type-change-fg',
    edge: 'border-type-change',
    fill: 'fill-type-change',
    stroke: 'stroke-type-change',
  },
  handoff: {
    dot: 'bg-type-handoff',
    soft: 'bg-type-handoff-soft',
    fg: 'text-type-handoff-fg',
    edge: 'border-type-handoff',
    fill: 'fill-type-handoff',
    stroke: 'stroke-type-handoff',
  },
  redesign: {
    dot: 'bg-type-redesign',
    soft: 'bg-type-redesign-soft',
    fg: 'text-type-redesign-fg',
    edge: 'border-type-redesign',
    fill: 'fill-type-redesign',
    stroke: 'stroke-type-redesign',
  },
  doc: {
    dot: 'bg-type-doc',
    soft: 'bg-type-doc-soft',
    fg: 'text-type-doc-fg',
    edge: 'border-type-doc',
    fill: 'fill-type-doc',
    stroke: 'stroke-type-doc',
  },
  release: {
    dot: 'bg-type-release',
    soft: 'bg-type-release-soft',
    fg: 'text-type-release-fg',
    edge: 'border-type-release',
    fill: 'fill-type-release',
    stroke: 'stroke-type-release',
  },
  idea: {
    dot: 'bg-type-idea',
    soft: 'bg-type-idea-soft',
    fg: 'text-type-idea-fg',
    edge: 'border-type-idea',
    fill: 'fill-type-idea',
    stroke: 'stroke-type-idea',
  },
  plan: {
    dot: 'bg-type-plan',
    soft: 'bg-type-plan-soft',
    fg: 'text-type-plan-fg',
    edge: 'border-type-plan',
    fill: 'fill-type-plan',
    stroke: 'stroke-type-plan',
  },
};

/** docs/08 §3.5 */
export const typeIcon: Record<CardType, LucideIcon> = {
  task: SquareCheck,
  decision: Scale,
  need: KeyRound,
  change: GitCommitHorizontal,
  handoff: ArrowLeftRight,
  redesign: Palette,
  doc: FileText,
  release: Rocket,
  idea: Lightbulb,
  plan: ListChecks,
};

export const roleIcon: Record<Role, LucideIcon> = {
  owner: Crown,
  pm: ClipboardList,
  accountant: Calculator,
  backend: Server,
  frontend: MonitorSmartphone,
  designer: PenTool,
  qa: Bug,
};

export const prioClass: Record<Priority, string> = {
  P0: 'text-prio-p0',
  P1: 'text-prio-p1',
  P2: 'text-prio-p2',
  P3: 'text-prio-p3',
};

/** Avatar colours 1..12 (member.avatarColor). Literal classes so Tailwind generates them. */
export const avatarClass = [
  '',
  'bg-(--avatar-1)',
  'bg-(--avatar-2)',
  'bg-(--avatar-3)',
  'bg-(--avatar-4)',
  'bg-(--avatar-5)',
  'bg-(--avatar-6)',
  'bg-(--avatar-7)',
  'bg-(--avatar-8)',
  'bg-(--avatar-9)',
  'bg-(--avatar-10)',
  'bg-(--avatar-11)',
  'bg-(--avatar-12)',
];

export type Tone = 'danger' | 'warning' | 'success' | 'info' | 'muted';

export const toneClass: Record<Tone, string> = {
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  info: 'bg-info-soft text-info-soft-foreground',
  muted: 'bg-muted text-muted-foreground',
};

/** docs/08 §5.1 StatusBadge semantics. Any status not listed reads as a quiet `muted`. */
const STATUS_TONE: Record<string, Tone> = {
  done: 'success',
  verified: 'success',
  approved: 'success',
  merged: 'success',
  ported: 'success',
  released: 'success',
  decided: 'success',
  applied: 'success',
  in_progress: 'info',
  claimed: 'info',
  in_review: 'info',
  acknowledged: 'info',
  delivered: 'info',
  overdue: 'warning',
  accepted: 'success',
  exploring: 'info',
  abandoned: 'danger',
  stale: 'warning',
  escalated: 'danger',
  rejected: 'danger',
  dismissed: 'danger',
  cancelled: 'danger',
  withdrawn: 'danger',
  superseded: 'danger',
  failed: 'danger',
  removed: 'danger',
};

export const statusTone = (status: string): Tone => STATUS_TONE[status] ?? 'muted';

export function statusIcon(status: string): LucideIcon {
  const tone = statusTone(status);
  if (tone === 'success') return CircleCheck;
  if (tone === 'info') return CirclePlay;
  if (tone === 'warning') return Clock;
  if (tone === 'danger') return TriangleAlert;
  return status === 'blocked' ? Ban : Circle;
}

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Inset variant, for rows and tiles that sit flush inside a clipped parent. */
/** A stretched link's whole hit area takes the ring, rather than an underline the same as hover (review M17). */
export const stretchedFocus =
  'focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring';

export const focusRingInset =
  'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';
