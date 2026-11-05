import {
  ArrowLeftRight,
  Bot,
  Bug,
  Calculator,
  ClipboardList,
  Crown,
  FileText,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
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
import type { CardType, EventKind, Role } from '@lab/mocks/hub-today';

/** docs/08 §3.5. On this page a type is this icon + its word, in the tile's own text colour. */
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

export const eventIcon: Record<EventKind, LucideIcon> = {
  commits: GitCommitHorizontal,
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  session: Bot,
  handoff: ArrowLeftRight,
  decided: Scale,
  redesign: Palette,
  doc: FileText,
  release: Rocket,
  need_delivered: KeyRound,
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

/** Heatmap ramp: 5 steps of the fish's yellow line (never the primary), read on the green tile. */
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
