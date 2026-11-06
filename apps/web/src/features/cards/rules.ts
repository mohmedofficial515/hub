/**
 * @file rules.ts
 * @description Which buttons a card shows, and which endpoint each action calls. The rules themselves live in `@hub/contracts` (`actionsFor`), and
 * the API sends their answer on `CardFull.actions`, so web and API cannot disagree. While a write is in flight the status is only predicted, so
 * the same function runs here on the predicted card.
 */
import {
  type ActionableCard,
  actionsFor as contractActionsFor,
  type AvailableAction as ContractAction,
  awaitedAction as contractAwaitedAction,
  CARD_MACHINES,
} from '@hub/contracts';

import type { CardAction } from '@/lib/i18n/kit-dict';

import type { CardListItem, CardType, HubCard, Role } from './types';

/** The contract's answer, with the verb narrowed to what the kit has words for. */
export type AvailableAction = Omit<ContractAction, 'action'> & { action: CardAction };

export function toActionable(card: CardListItem | HubCard): ActionableCard {
  const detail = (card as unknown as Record<string, unknown>)[card.type];
  return {
    type: card.type,
    status: card.status,
    ownerRole: card.ownerRole,
    assigneeId: card.assigneeId ?? null,
    createdById: card.createdById ?? null,
    archivedAt: card.archivedAt ?? null,
    detail: (detail ?? null) as Record<string, unknown> | null,
    blocked: card.flags?.blocked === true,
    stale: card.flags?.stale === true,
  };
}

/** The server's list when it answered for this status, otherwise the same rules on what the card is predicted to be. */
export function actionsFor(
  card: CardListItem | HubCard,
  roles: readonly Role[],
  memberId: string | null,
): AvailableAction[] {
  if (card.serverActions && card.serverActionsStatus === card.status)
    return card.serverActions as AvailableAction[];
  return contractActionsFor(toActionable(card), roles, memberId) as AvailableAction[];
}

/** The action that keeps a card waiting on me (review B2). A row carries the API's answer; a predicted status asks the rules again. */
export function awaitedAction(card: CardListItem | HubCard, roles: readonly Role[], memberId: string | null) {
  return contractAwaitedAction(toActionable(card), roles, memberId) as AvailableAction | null;
}

/** The status a successful action leads to, from the shared machine. The prediction of an optimistic write. */
export function predictedStatus(type: CardType, status: string, action: CardAction): string | undefined {
  const transition = CARD_MACHINES[type].transitions[action];
  return transition?.from.includes(status) ? transition.to : undefined;
}

/** The action that takes this one back, where the API has one. A toast offers Undo only then: nothing else would be honest. */
const INVERSE: Partial<Record<CardType, Partial<Record<CardAction, CardAction>>>> = {
  task: {
    claim: 'unclaim',
    mark_ready: 'mark_backlog',
    mark_backlog: 'mark_ready',
    submit_review: 'resume',
  },
};

export const inverseOf = (type: CardType, action: CardAction) => INVERSE[type]?.[action];

/** What the forms collect. `actionRequest` sends what each endpoint takes (docs/04 §3.10 to §3.20). */
export interface ActionPayload {
  optionId?: string | undefined;
  optionTitle?: string | undefined;
  rationale?: string | undefined;
  location?: string | undefined;
  note?: string | undefined;
  reason?: string | undefined;
  /** `submit_review`: the pull request, optional (09 §6). */
  prUrl?: string | undefined;
  /** `mark_ported`: "<branch>@<sha> (<repo>)". */
  ref?: string | undefined;
  /** `decide`: store an ADR skeleton (09 §7). */
  draftAdr?: boolean | undefined;
  /** `apply`: the task this handoff was applied through (09 §9). */
  taskKey?: string | undefined;
  /** `apply`: create the task in the same request. */
  createTask?: { title: string; specialty: string } | undefined;
  /** `verify`: the person verifying is the person who delivered (D24). The note is required, and History says so. */
  selfVerify?: boolean | undefined;
}

const SEGMENT: Partial<Record<CardType, string>> = {
  task: 'tasks',
  decision: 'decisions',
  need: 'needs',
  handoff: 'handoffs',
  redesign: 'redesign',
  release: 'releases',
  idea: 'ideas',
  plan: 'plans',
};

/** Where the URL differs from the verb with hyphens. */
const PATH: Partial<Record<CardAction, string>> = {
  complete: 'done',
  send_to_review: 'submit-review',
};

export interface ActionRequest {
  path: string;
  body: Record<string, unknown>;
}

export function actionRequest(
  slug: string,
  type: CardType,
  key: string,
  action: CardAction,
  p: ActionPayload,
): ActionRequest {
  const segment = SEGMENT[type] ?? 'cards';
  const body: Record<string, unknown> = {};
  if (p.optionId) body.optionId = p.optionId;
  if (p.rationale) body.rationale = p.rationale;
  if (p.draftAdr) body.draftAdr = true;
  if (p.location) body.location = p.location;
  if (p.note) body.note = p.note;
  if (p.reason) body.reason = p.reason;
  if (p.prUrl) body.prUrl = p.prUrl;
  if (p.ref) body.ref = p.ref;
  if (p.taskKey) body.taskKey = p.taskKey;
  if (p.createTask) body.createTask = p.createTask;
  return {
    path: `workspaces/${slug}/${segment}/${key}/${PATH[action] ?? action.replaceAll('_', '-')}`,
    body,
  };
}
