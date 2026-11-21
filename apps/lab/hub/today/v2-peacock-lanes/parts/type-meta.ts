import {
  ArrowLeftRight,
  Bug,
  Calculator,
  ClipboardList,
  Crown,
  FileText,
  GitCommitHorizontal,
  KeyRound,
  MonitorSmartphone,
  Palette,
  PenTool,
  Rocket,
  Scale,
  Server,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react';
import type { CardType, Priority, Role } from '@lab/mocks/hub-today';

/**
 * Full class strings per card type (Tailwind only sees literal class names, so they are spelled
 * out). The hue of each type lives in tokens.css; components never pick a colour themselves.
 */
export const typeClass: Record<
  CardType,
  { dot: string; soft: string; fg: string; stripe: string; fill: string; stroke: string; ring: string }
> = {
  task: { dot: 'bg-type-task', soft: 'bg-type-task-soft', fg: 'text-type-task-fg', stripe: 'border-type-task', fill: 'fill-type-task', stroke: 'stroke-type-task', ring: 'ring-type-task' },
  decision: { dot: 'bg-type-decision', soft: 'bg-type-decision-soft', fg: 'text-type-decision-fg', stripe: 'border-type-decision', fill: 'fill-type-decision', stroke: 'stroke-type-decision', ring: 'ring-type-decision' },
  need: { dot: 'bg-type-need', soft: 'bg-type-need-soft', fg: 'text-type-need-fg', stripe: 'border-type-need', fill: 'fill-type-need', stroke: 'stroke-type-need', ring: 'ring-type-need' },
  change: { dot: 'bg-type-change', soft: 'bg-type-change-soft', fg: 'text-type-change-fg', stripe: 'border-type-change', fill: 'fill-type-change', stroke: 'stroke-type-change', ring: 'ring-type-change' },
  handoff: { dot: 'bg-type-handoff', soft: 'bg-type-handoff-soft', fg: 'text-type-handoff-fg', stripe: 'border-type-handoff', fill: 'fill-type-handoff', stroke: 'stroke-type-handoff', ring: 'ring-type-handoff' },
  redesign: { dot: 'bg-type-redesign', soft: 'bg-type-redesign-soft', fg: 'text-type-redesign-fg', stripe: 'border-type-redesign', fill: 'fill-type-redesign', stroke: 'stroke-type-redesign', ring: 'ring-type-redesign' },
  doc: { dot: 'bg-type-doc', soft: 'bg-type-doc-soft', fg: 'text-type-doc-fg', stripe: 'border-type-doc', fill: 'fill-type-doc', stroke: 'stroke-type-doc', ring: 'ring-type-doc' },
  release: { dot: 'bg-type-release', soft: 'bg-type-release-soft', fg: 'text-type-release-fg', stripe: 'border-type-release', fill: 'fill-type-release', stroke: 'stroke-type-release', ring: 'ring-type-release' },
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

/** Heatmap ramp, 5 steps of one hue (research §4 pattern 3). */
export const heatClass = ['bg-(--heat-0)', 'bg-(--heat-1)', 'bg-(--heat-2)', 'bg-(--heat-3)', 'bg-(--heat-4)'];
export const HEAT_BUCKETS = [
  { min: 0, max: 0 },
  { min: 1, max: 2 },
  { min: 3, max: 5 },
  { min: 6, max: 8 },
  { min: 9, max: Infinity },
];
export function heatLevel(v: number) {
  return HEAT_BUCKETS.findIndex((b) => v >= b.min && v <= b.max);
}

export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
