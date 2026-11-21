/**
 * @file Which actions count as acting on a card, and which take one back (review M1, docs/15 §8).
 * @description Acting marks that card's notifications read for the one who acted. The inverse of the act restores
 * exactly those, so Undo on the web and the same verb from Claude Code cannot differ. Talking about a card is not
 * acting on it: a comment or a watch leaves the item unread.
 */
import type { PermissionAction } from '@hub/contracts';

const NOT_ACTS: ReadonlySet<string> = new Set([
  'card.comment',
  'card.comment_edit',
  'card.comment_redact',
  'card.link',
  'card.watch',
  'card.edit_content',
  'card.edit_routing',
  'card.unblock',
  'card.remind',
  'task.edit_detail',
  'decision.edit_options',
  'decision.draft_adr',
  'decision.escalate',
  'idea.update',
  'plan.update',
  'plan.sync_step',
  'plan.restore_revision',
  'release.edit',
  'task.close_as_ported',
]);

export function isAct(action: PermissionAction): boolean {
  return !NOT_ACTS.has(action) && !action.endsWith('.create');
}

/** An action, and the acts it takes back. The left side is what Undo calls (`features/cards/rules.ts`). */
const INVERSES: Partial<Record<PermissionAction, readonly PermissionAction[]>> = {
  'task.unclaim': ['task.claim'],
  'task.mark_backlog': ['task.mark_ready'],
  'task.mark_ready': ['task.mark_backlog'],
  'task.resume': ['task.submit_review', 'task.review'],
  'task.reopen': ['task.complete', 'task.review', 'task.cancel'],
  'card.restore': ['card.delete'],
  'idea.reopen': ['idea.park', 'idea.reject', 'idea.accept'],
};

export function actsTakenBack(action: PermissionAction): readonly PermissionAction[] {
  return INVERSES[action] ?? [];
}
