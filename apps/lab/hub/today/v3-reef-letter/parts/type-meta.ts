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
 * Full class strings per card type (Tailwind only sees literal class names, so they are spelled out).
 * The hue of each type lives in tokens.css; components never pick a colour themselves.
 */
export const typeClass: Record<CardType, { soft: string; fg: string; seg: string; dot: string }> = {
  task: { soft: 'bg-type-task-soft', fg: 'text-type-task-fg', seg: 'stroke-(--seg-task)', dot: 'bg-type-task' },
  decision: { soft: 'bg-type-decision-soft', fg: 'text-type-decision-fg', seg: 'stroke-(--seg-decision)', dot: 'bg-type-decision' },
  need: { soft: 'bg-type-need-soft', fg: 'text-type-need-fg', seg: 'stroke-(--seg-need)', dot: 'bg-type-need' },
  change: { soft: 'bg-type-change-soft', fg: 'text-type-change-fg', seg: 'stroke-(--seg-change)', dot: 'bg-type-change' },
  handoff: { soft: 'bg-type-handoff-soft', fg: 'text-type-handoff-fg', seg: 'stroke-(--seg-handoff)', dot: 'bg-type-handoff' },
  redesign: { soft: 'bg-type-redesign-soft', fg: 'text-type-redesign-fg', seg: 'stroke-(--seg-redesign)', dot: 'bg-type-redesign' },
  doc: { soft: 'bg-type-doc-soft', fg: 'text-type-doc-fg', seg: 'stroke-(--seg-doc)', dot: 'bg-type-doc' },
  release: { soft: 'bg-type-release-soft', fg: 'text-type-release-fg', seg: 'stroke-(--seg-release)', dot: 'bg-type-release' },
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

/** Heatmap ramp "lagoon depth": 5 steps of one hue, with a numeric legend. */
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
