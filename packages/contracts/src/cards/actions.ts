/**
 * @file The one set of rules for which actions a card offers, and whether it waits on the member.
 * @description Moved from the approved design (redesign/hub/today/v5-peacock-app/kit/card-actions.tsx and
 * `session.ts`, review B2): everything derives from the card's current state, never from whether someone touched
 * it. The web draws buttons from this and the API exposes it on `CardFull`, so they cannot disagree. Whether an
 * action is enabled comes from the permission matrix, which is what `CardService.apply` enforces, so an enabled
 * action is one the API accepts.
 */
import { isAllowed, type PermissionAction, type PermissionFacts } from '../permissions';
import { type Role, ROLES, type Specialty } from '../roles';
import type { CardType } from './card';

/** What the rules need to know about a card. Reads and `apply` both build it. */
export interface ActionableCard {
  readonly type: CardType;
  readonly status: string;
  readonly ownerRole: string | null;
  readonly assigneeId: string | null;
  readonly createdById: string | null;
  readonly archivedAt: Date | string | null;
  readonly detail: Readonly<Record<string, unknown>> | null;
  /** An open card blocks this one. Keeps a ready task from being claimed. */
  readonly blocked?: boolean;
  /** A handoff past `handoffs.stale_hours`. */
  readonly stale?: boolean;
  /** The port task of an approved redesign (docs/09 §10): Claim belongs to it. */
  readonly portTask?: {
    readonly key: string;
    readonly status: string;
    readonly ownerRole: string | null;
    readonly specialty: Specialty | null;
    readonly blocked: boolean;
  } | null;
}

export type ActionMode = 'form' | 'confirm' | 'now';

export interface AvailableAction {
  /** The verb: a machine transition, or `claim` on a redesign's port task. */
  readonly action: string;
  readonly permission: PermissionAction;
  /** Rendered disabled when false (docs/08 §5.6: an action is not hidden for lack of a role). */
  readonly enabled: boolean;
  /** The role that would allow it, for the tooltip. Present only when the matrix refuses it. */
  readonly needsRole?: Role;
  /** `form`: the section shows a form; `confirm`: a dialog; `now`: runs at once. */
  readonly mode: ActionMode;
  readonly destructive?: boolean;
  /** The dialog asks for a reason. */
  readonly reason?: boolean;
  /** Verify by the member who delivered: allowed with a required note, never the filled button (D24). */
  readonly selfVerify?: boolean;
  /** The card the action runs on, when it is not this one: a redesign's port task. */
  readonly targetKey?: string;
}

/** How the card relates to the member, for the permission table. */
export function permissionFactsFor(
  card: Pick<ActionableCard, 'ownerRole' | 'assigneeId' | 'createdById' | 'detail'>,
  memberId: string | null,
): PermissionFacts {
  const detail = card.detail ?? {};
  return {
    routedRoles: [card.ownerRole, detail['escalatedToRole'] as string | null | undefined],
    specialty: (detail['specialty'] ?? null) as Specialty | null,
    isAssignee: memberId !== null && card.assigneeId === memberId,
    isCreator: memberId !== null && card.createdById === memberId,
    isDeliverer: memberId !== null && detail['deliveredById'] === memberId,
  };
}

interface Spec {
  readonly verb: string;
  readonly mode: ActionMode;
  /** The permission row, when it is not `<type>.<verb>`. */
  readonly row?: PermissionAction;
  readonly destructive?: boolean;
  readonly reason?: boolean;
  /** Not shown at all to a member who may not do it: it is someone else's own work. */
  readonly private?: boolean;
}

const cancel: Spec = { verb: 'cancel', mode: 'confirm', destructive: true, reason: true };
const abandon: Spec = { verb: 'abandon', mode: 'confirm', destructive: true, reason: true };
const reject: Spec = { verb: 'reject', mode: 'confirm', destructive: true, reason: true };
const park: Spec = { verb: 'park', mode: 'confirm', reason: true };
const dismiss: Spec = { verb: 'dismiss', mode: 'confirm', destructive: true, reason: true };
const toPlan: Spec = { verb: 'to_plan', mode: 'form' };

/** Per type and status, in display order; the first is the primary (docs/08 §5.4). */
const SPECS: Partial<Record<CardType, Readonly<Record<string, readonly Spec[]>>>> = {
  decision: {
    open: [
      { verb: 'decide', mode: 'form' },
      { verb: 'withdraw', mode: 'confirm', destructive: true, reason: true, private: true },
    ],
  },
  need: {
    requested: [{ verb: 'deliver', mode: 'form' }, { verb: 'start', mode: 'now' }, cancel],
    in_progress: [{ verb: 'deliver', mode: 'form' }, cancel],
    delivered: [
      { verb: 'verify', mode: 'form' },
      { verb: 'reject_delivery', mode: 'confirm', reason: true, private: true },
    ],
  },
  handoff: {
    pending: [{ verb: 'acknowledge', mode: 'form' }, dismiss],
    acknowledged: [{ verb: 'apply', mode: 'form' }, dismiss],
  },
  redesign: {
    draft: [{ verb: 'send_to_review', mode: 'now' }],
    review: [
      { verb: 'approve', mode: 'form' },
      { verb: 'request_changes', mode: 'form' },
      { verb: 'reject', mode: 'form', destructive: true },
    ],
    approved: [{ verb: 'mark_ported', mode: 'form' }],
  },
  release: { planned: [{ verb: 'release', mode: 'now' }] },
  task: {
    backlog: [{ verb: 'mark_ready', mode: 'now' }, cancel],
    ready: [{ verb: 'claim', mode: 'now' }, cancel],
    claimed: [
      { verb: 'start', mode: 'now', private: true },
      { verb: 'unclaim', mode: 'now', private: true },
      cancel,
    ],
    in_progress: [
      { verb: 'submit_review', mode: 'form', private: true },
      { verb: 'unclaim', mode: 'now', private: true },
      cancel,
    ],
    in_review: [
      { verb: 'complete', mode: 'now', row: 'task.review' },
      { verb: 'resume', mode: 'form' },
      cancel,
    ],
    done: [{ verb: 'reopen', mode: 'now', private: true }],
    cancelled: [{ verb: 'reopen', mode: 'now', private: true }],
  },
  idea: {
    open: [{ verb: 'explore', mode: 'now' }, toPlan, { verb: 'accept', mode: 'now' }, park, reject],
    exploring: [toPlan, { verb: 'accept', mode: 'now' }, park, reject],
    parked: [{ verb: 'reopen', mode: 'now' }],
    rejected: [{ verb: 'reopen', mode: 'now' }],
  },
  plan: {
    draft: [{ verb: 'submit_review', mode: 'now' }, { verb: 'to_tasks', mode: 'now' }, abandon],
    in_review: [{ verb: 'approve', mode: 'now' }, { verb: 'to_tasks', mode: 'now' }, abandon],
    approved: [{ verb: 'to_tasks', mode: 'now' }, { verb: 'start', mode: 'now' }, abandon],
    in_progress: [{ verb: 'finish', mode: 'now' }, { verb: 'to_tasks', mode: 'now' }, abandon],
    done: [{ ...abandon, private: true }],
  },
};

function firstRoleAllowing(action: PermissionAction, facts: PermissionFacts): Role | undefined {
  const roleOnly: PermissionFacts = {
    routedRoles: facts.routedRoles ?? [],
    specialty: facts.specialty ?? null,
  };
  const routed = roleOnly.routedRoles?.find((role): role is Role => ROLES.includes(role as Role));
  if (routed && isAllowed(action, [routed], roleOnly)) return routed;
  return ROLES.find((role) => isAllowed(action, [role], roleOnly));
}

function build(
  spec: Spec,
  type: CardType,
  roles: readonly Role[],
  facts: PermissionFacts,
  extra: { readonly unavailable?: boolean; readonly selfVerify?: boolean } = {},
): AvailableAction {
  const permission = spec.row ?? (`${type}.${spec.verb}` as PermissionAction);
  const allowed = isAllowed(permission, roles, facts);
  const needsRole = allowed ? undefined : firstRoleAllowing(permission, facts);
  return {
    action: spec.verb,
    permission,
    enabled: allowed && extra.unavailable !== true,
    mode: spec.mode,
    ...(needsRole ? { needsRole } : {}),
    ...(spec.destructive ? { destructive: true } : {}),
    ...(spec.reason ? { reason: true } : {}),
    ...(extra.selfVerify ? { selfVerify: true } : {}),
  };
}

function stepsOf(card: ActionableCard): readonly { readonly taskKey?: string; readonly done?: boolean }[] {
  const value = card.detail?.['steps'];
  return Array.isArray(value) ? (value as { taskKey?: string; done?: boolean }[]) : [];
}

/** A spec that is not offered in this state, beyond what the table says. */
function isOffered(card: ActionableCard, spec: Spec): boolean {
  if (card.type !== 'plan') return true;
  if (spec.verb === 'to_tasks') return stepsOf(card).some((step) => !step.taskKey);
  // docs/15 §4: the plan offers done when all its steps are finished.
  if (spec.verb === 'finish') return stepsOf(card).every((step) => step.done === true);
  return true;
}

/** Per-type actions the card offers this member now, in display order; the first is the primary. */
export function actionsFor(
  card: ActionableCard,
  roles: readonly Role[],
  memberId: string | null,
): AvailableAction[] {
  if (card.archivedAt) return [];
  const facts = permissionFactsFor(card, memberId);
  const actions: AvailableAction[] = [];
  for (const spec of SPECS[card.type]?.[card.status] ?? []) {
    if (!isOffered(card, spec)) continue;
    const action = build(spec, card.type, roles, facts, {
      unavailable: card.type === 'task' && spec.verb === 'claim' && card.blocked === true,
      selfVerify: spec.verb === 'verify' && facts.isDeliverer === true,
    });
    if (spec.private && !isAllowed(action.permission, roles, facts)) continue;
    actions.push(action);
  }
  const port = card.type === 'redesign' && card.status === 'approved' ? card.portTask : null;
  if (port?.status === 'ready') {
    const portFacts: PermissionFacts = { routedRoles: [port.ownerRole], specialty: port.specialty };
    const claim = build({ verb: 'claim', mode: 'now', row: 'task.claim' }, 'task', roles, portFacts, {
      unavailable: port.blocked,
    });
    actions.unshift({ ...claim, targetKey: port.key });
  }
  return actions;
}

/** What somebody is waiting for a member to do. Starting one's own work is not on it, nor is anything destructive. */
const AWAITED = new Set([
  'decide',
  'deliver',
  'verify',
  'acknowledge',
  'apply',
  'approve',
  'claim',
  'complete',
]);

function isRoutedToMember(
  card: ActionableCard,
  action: AvailableAction,
  roles: readonly Role[],
  memberId: string | null,
): boolean {
  const facts = permissionFactsFor(card, memberId);
  const routed = (facts.routedRoles ?? []).some((role) => roles.includes(role as Role));
  const manager = roles.includes('owner') || roles.includes('pm');
  switch (card.type) {
    case 'decision':
      return routed;
    case 'need':
      // A delivered need waits on who asked for it and on who delivered it (docs/07 §6.1, D24).
      return (
        routed || (card.status === 'delivered' && (facts.isCreator === true || facts.isDeliverer === true))
      );
    case 'handoff':
      // Owner and pm may acknowledge any handoff, but their stack holds another role's only once it is stale.
      return routed || (manager && action.action === 'acknowledge' && card.stale === true);
    case 'redesign':
      // Approving is the owner's; Claim is the port task's role, which `enabled` has already judged.
      return true;
    case 'task':
      // A ready task is on the "ready for me" list, not here. A task in review waits on its reviewers.
      return (
        action.action === 'complete' &&
        facts.isAssignee !== true &&
        (roles.includes('qa') || roles.includes('pm'))
      );
    case 'plan':
      return manager;
    default:
      return false;
  }
}

/**
 * The action that keeps a card waiting on the member (review B2), or null when it no longer does. The row's verb
 * follows the card, so Acknowledge becomes Apply and Deliver becomes Verify on the same row.
 */
export function awaitedAction(
  card: ActionableCard,
  roles: readonly Role[],
  memberId: string | null,
): AvailableAction | null {
  return (
    actionsFor(card, roles, memberId).find(
      (action) =>
        action.enabled && AWAITED.has(action.action) && isRoutedToMember(card, action, roles, memberId),
    ) ?? null
  );
}
