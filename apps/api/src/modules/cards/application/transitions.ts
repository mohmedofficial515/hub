/**
 * @file `POST /cards/{key}/transition` (docs/04 §3.8): the moves with no dedicated endpoint, and nothing else.
 * @description Decide, deliver, verify, acknowledge and approve carry a payload, so they must use their own route.
 */
import type { CardType, PermissionAction } from '@hub/contracts';

interface Move {
  readonly from?: readonly string[];
  readonly to: string;
  readonly action: PermissionAction;
}

const MOVES: Partial<Record<CardType, readonly Move[]>> = {
  task: [
    { from: ['backlog'], to: 'ready', action: 'task.mark_ready' },
    { from: ['ready'], to: 'backlog', action: 'task.mark_backlog' },
    { from: ['in_review'], to: 'in_progress', action: 'task.resume' },
    { to: 'cancelled', action: 'task.cancel' },
  ],
  need: [
    { from: ['requested'], to: 'in_progress', action: 'need.start' },
    { to: 'cancelled', action: 'need.cancel' },
  ],
  release: [{ to: 'released', action: 'release.release' }],
};

export function transitionActionFor(type: CardType, status: string, to: string): PermissionAction | null {
  const move = MOVES[type]?.find((item) => item.to === to && (!item.from || item.from.includes(status)));
  return move?.action ?? null;
}
