/**
 * @file Permission matrix as a data table (docs/04 §2, changed by D24, D25, D27, D28, D29, docs/15 §5).
 * @description One row per action, one grant per role. Actor kind plays no part (D27), so a member's
 * Claude Code may do what the member may do on the web. `surface: 'web_only'` keeps secret values and
 * API tokens out of MCP, which is the one limit D27 leaves. `CardFull.allowedActions` is computed from this.
 */
import type { Role } from './roles';
import { ROLES, type Specialty, SPECIALTY_ROLES } from './roles';

/**
 * Y allowed · N not allowed · R the card's routed role is one of the actor's roles ·
 * S the task's specialty maps to one of the actor's roles · A the actor is the assignee ·
 * C the actor created the card · V a need's verifier: its routed role, its requester, or whoever delivered it (D24).
 */
export type Grant = 'Y' | 'N' | 'R' | 'S' | 'A' | 'C' | 'V';
/** `system` rows have no route and no tool: adapters, and follow-ups inside an action that was already permitted. */
export type Surface = 'any' | 'web_only' | 'system';

/** Grants in the order of ROLES: owner, pm, accountant, backend, frontend, designer, qa. */
type Row = readonly [Grant, Grant, Grant, Grant, Grant, Grant, Grant];

const EVERYONE: Row = ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y'];
const OWNER_PM: Row = ['Y', 'Y', 'N', 'N', 'N', 'N', 'N'];
const OWNER_ONLY: Row = ['Y', 'N', 'N', 'N', 'N', 'N', 'N'];
const OWNER_PM_CREATOR: Row = ['Y', 'Y', 'C', 'C', 'C', 'C', 'C'];
const OWNER_PM_ROUTED: Row = ['Y', 'Y', 'R', 'R', 'R', 'R', 'R'];
const OWNER_PM_SPECIALTY: Row = ['Y', 'Y', 'N', 'S', 'S', 'S', 'S'];
const OWNER_PM_ASSIGNEE: Row = ['Y', 'Y', 'N', 'A', 'A', 'A', 'A'];
const OWNER_PM_TASK_CREATOR: Row = ['Y', 'Y', 'N', 'C', 'C', 'C', 'C'];
const OWNER_PM_VERIFIER: Row = ['Y', 'Y', 'V', 'V', 'V', 'V', 'V'];
/** A task in review moves for its reviewers, as well as for the assignee (docs/09 §6, approved design `actionsFor`). */
const REVIEWERS: Row = ['Y', 'Y', 'N', 'A', 'A', 'A', 'Y'];
const SYSTEM_ONLY: Row = ['N', 'N', 'N', 'N', 'N', 'N', 'N'];

const MATRIX = {
  // Any card
  'card.read': EVERYONE,
  // Owner and pm read every deleted card; a member reads the ones they created (D28).
  'card.read_deleted': OWNER_PM_CREATOR,
  'card.edit_content': OWNER_PM_CREATOR,
  'card.edit_routing': OWNER_PM,
  'card.delete': OWNER_PM_CREATOR,
  'card.restore': OWNER_PM_CREATOR,
  'card.comment': EVERYONE,
  'card.comment_edit': ['C', 'C', 'C', 'C', 'C', 'C', 'C'],
  'card.comment_redact': OWNER_PM,
  'card.link': EVERYONE,
  'card.watch': EVERYONE,
  'card.unblock': SYSTEM_ONLY,
  'card.remind': SYSTEM_ONLY,

  // Tasks
  'task.create': EVERYONE,
  'task.edit_detail': OWNER_PM_SPECIALTY,
  'task.mark_ready': OWNER_PM_SPECIALTY,
  'task.mark_backlog': OWNER_PM_SPECIALTY,
  'task.claim': OWNER_PM_SPECIALTY,
  'task.unclaim': OWNER_PM_SPECIALTY,
  'task.start': OWNER_PM_ASSIGNEE,
  'task.submit_review': OWNER_PM_ASSIGNEE,
  'task.resume': REVIEWERS,
  'task.complete': OWNER_PM_ASSIGNEE,
  'task.review': REVIEWERS,
  'task.cancel': OWNER_PM_TASK_CREATOR,
  'task.reopen': OWNER_PM_TASK_CREATOR,
  'task.close_as_ported': SYSTEM_ONLY,

  // Decisions
  'decision.create': EVERYONE,
  'decision.edit_options': OWNER_PM_CREATOR,
  'decision.decide': ['Y', 'R', 'R', 'R', 'R', 'R', 'R'],
  'decision.withdraw': OWNER_PM_CREATOR,
  'decision.supersede': OWNER_PM,
  'decision.escalate': SYSTEM_ONLY,
  'decision.draft_adr': OWNER_PM_ROUTED,
  'decision.open_adr_pr': OWNER_PM_ROUTED,

  // Needs (D24: whoever delivered may verify; the service requires a note)
  'need.create': EVERYONE,
  'need.start': OWNER_PM_ROUTED,
  'need.deliver': OWNER_PM_ROUTED,
  'need.verify': OWNER_PM_VERIFIER,
  'need.reject_delivery': OWNER_PM_VERIFIER,
  'need.cancel': OWNER_PM_CREATOR,

  // Handoffs (D25: owner and pm may acknowledge any; apply stays with the receiving role)
  'handoff.create': EVERYONE,
  'handoff.acknowledge': OWNER_PM_ROUTED,
  'handoff.apply': ['R', 'R', 'R', 'R', 'R', 'R', 'R'],
  'handoff.dismiss': OWNER_PM_ROUTED,

  // Redesign
  'redesign.create': SYSTEM_ONLY,
  'redesign.sync': SYSTEM_ONLY,
  'redesign.send_to_review': ['Y', 'Y', 'N', 'N', 'Y', 'Y', 'N'],
  'redesign.approve': OWNER_ONLY,
  'redesign.reject': OWNER_ONLY,
  'redesign.request_changes': ['Y', 'Y', 'N', 'N', 'N', 'N', 'Y'],
  'redesign.mark_ported': ['Y', 'Y', 'N', 'N', 'Y', 'N', 'N'],
  'redesign.rescan': OWNER_PM,

  // Releases
  'release.create': OWNER_PM,
  'release.edit': OWNER_PM,
  'release.generate_notes': OWNER_PM,
  'release.release': OWNER_PM,

  // Ideas (D29)
  'idea.create': EVERYONE,
  'idea.update': OWNER_PM_CREATOR,
  'idea.explore': OWNER_PM_CREATOR,
  'idea.accept': OWNER_PM_CREATOR,
  'idea.park': OWNER_PM_CREATOR,
  'idea.reject': OWNER_PM_CREATOR,
  'idea.reopen': OWNER_PM_CREATOR,
  'idea.to_plan': OWNER_PM_CREATOR,

  // Plans (D29: approved is for owner or pm)
  'plan.create': EVERYONE,
  'plan.update': OWNER_PM_CREATOR,
  'plan.submit_review': OWNER_PM_CREATOR,
  'plan.approve': OWNER_PM,
  'plan.start': OWNER_PM_CREATOR,
  'plan.finish': OWNER_PM_CREATOR,
  'plan.abandon': OWNER_PM_CREATOR,
  'plan.to_tasks': OWNER_PM_CREATOR,
  'plan.sync_step': SYSTEM_ONLY,
  'plan.restore_revision': OWNER_PM_CREATOR,

  // Facts
  'change.create': SYSTEM_ONLY,
  'doc.create': SYSTEM_ONLY,
  'doc.update': SYSTEM_ONLY,
  'doc.mark_removed': SYSTEM_ONLY,
  'doc.mark_current': SYSTEM_ONLY,
  'session.log': EVERYONE,
  'brief.save': EVERYONE,
  'brief.save_weekly': OWNER_PM,
  'docs.read': EVERYONE,
  'docs.reindex': OWNER_PM,

  // Projects (D30: any member creates one and becomes its owner)
  'project.read': EVERYONE,
  'project.create': EVERYONE,
  'project.update': OWNER_PM,
  'project.close': OWNER_ONLY,
  'project.reopen': OWNER_ONLY,
  'project.switch': EVERYONE,

  // Project administration
  'member.read': EVERYONE,
  'member.invite': OWNER_PM,
  'member.change_roles': OWNER_PM,
  'member.disable': OWNER_PM,
  'member.github_identity': OWNER_PM,
  'settings.read': EVERYONE,
  'settings.write': OWNER_PM,
  'source.read': EVERYONE,
  'source.manage': OWNER_PM,
  'source.run': OWNER_PM,
  'source.set_secret': OWNER_PM,
  'audit.read': OWNER_PM,
  'notification.read': EVERYONE,
  'onboarding.use': EVERYONE,

  // Own account
  'token.manage': EVERYONE,
  'profile.manage': EVERYONE,

  // Devices (docs/16 §4, §5). Pairing makes a credential, and linking writes Claude Code's own config on a press (D44): web only.
  'device.manage': EVERYONE,
  'device.pair': EVERYONE,
  'device.link': OWNER_PM,
  // Chats (docs/16 §7). Running one and answering its approvals are the owner's own press: no token and no agent reaches them, so an agent cannot start agents or approve itself.
  'chat.read': EVERYONE,
  'chat.manage': EVERYONE,
  'chat.run': EVERYONE,
  'chat.answer': EVERYONE,
  // Writing a local-path doc (docs/16 §10). The accountant reads.
  'docs.write': ['Y', 'Y', 'N', 'Y', 'Y', 'Y', 'Y'],
} as const satisfies Record<string, Row>;

export type PermissionAction = keyof typeof MATRIX;
export const PERMISSION_ACTIONS = Object.keys(MATRIX) as PermissionAction[];

const WEB_ONLY: ReadonlySet<PermissionAction> = new Set<PermissionAction>([
  'token.manage',
  'profile.manage',
  'source.set_secret',
  'device.pair',
  'device.link',
  'chat.run',
  'chat.answer',
]);

export function surfaceOf(action: PermissionAction): Surface {
  if (MATRIX[action] === SYSTEM_ONLY) return 'system';
  return WEB_ONLY.has(action) ? 'web_only' : 'any';
}

export function grantFor(action: PermissionAction, role: Role): Grant {
  const grant = MATRIX[action][ROLES.indexOf(role)];
  return grant ?? 'N';
}

/** What is known about the actor's relation to the card. All optional: no card means no relation. */
export interface PermissionFacts {
  readonly routedRoles?: readonly (string | null | undefined)[];
  readonly specialty?: Specialty | null;
  readonly isAssignee?: boolean;
  readonly isCreator?: boolean;
  /** A need delivered by the actor (D24). */
  readonly isDeliverer?: boolean;
}

function grantHolds(grant: Grant, role: Role, facts: PermissionFacts): boolean {
  switch (grant) {
    case 'Y':
      return true;
    case 'N':
      return false;
    case 'R':
      return (facts.routedRoles ?? []).includes(role);
    case 'S':
      return facts.specialty != null && SPECIALTY_ROLES[facts.specialty].includes(role);
    case 'A':
      return facts.isAssignee === true;
    case 'C':
      return facts.isCreator === true;
    case 'V':
      return (
        (facts.routedRoles ?? []).includes(role) || facts.isCreator === true || facts.isDeliverer === true
      );
  }
}

/** The one permission check. Any of the actor's roles may satisfy the row. */
export function isAllowed(
  action: PermissionAction,
  roles: readonly Role[],
  facts: PermissionFacts = {},
): boolean {
  return roles.some((role) => grantHolds(grantFor(action, role), role, facts));
}

/** Route-level check, before any card is loaded: could this set of roles ever do the action? */
export function isPossible(action: PermissionAction, roles: readonly Role[]): boolean {
  return roles.some((role) => grantFor(action, role) !== 'N');
}

/** Everything these roles may do on a card, for `CardFull.allowedActions`. */
export function allowedActions(roles: readonly Role[], facts: PermissionFacts): PermissionAction[] {
  return PERMISSION_ACTIONS.filter((action) => isAllowed(action, roles, facts));
}
