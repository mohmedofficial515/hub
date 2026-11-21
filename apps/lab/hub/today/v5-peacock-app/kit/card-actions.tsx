import { useT } from '@lab/i18n';
import { members, type HubCard, type Role } from '@lab/mocks/hub-app';
import { closeCard, currentRoute } from '../shell/router';
import { actOn, getCard, openBlockers, portTaskOf, type ActionPayload } from './card-store';
import { markCardsRead } from './inbox-store';
import { kitMessages, type CardAction } from './i18n';
import { focusRowWhenReady } from './keyboard-list';
import { useSession } from './session';
import { Ltr, fill } from './text';
import { showToast } from './toast';

export interface AvailableAction {
  action: CardAction;
  /** Rendered disabled, with `reason` as its tooltip (08 §5.6: an action is not hidden for lack of a role). */
  enabled: boolean;
  /** The role that would allow it. */
  needsRole?: Role;
  /** `form`: the section shows a form; `confirm`: ConfirmDialog; `now`: runs at once. */
  mode: 'form' | 'confirm' | 'now';
  destructive?: boolean;
  /** ConfirmDialog asks for a reason. */
  reason?: boolean;
  /** `verify` by the member who delivered: allowed, with a required note, and never the page's filled button (owner decision 2026-11-04). */
  selfVerify?: boolean;
}

const can = (roles: Role[], ...need: Role[]) => need.some((r) => roles.includes(r));

function guard(action: CardAction, mode: AvailableAction['mode'], roles: Role[], need: Role[] | null, extra: Partial<AvailableAction> = {}): AvailableAction {
  const enabled = need === null || can(roles, ...need);
  return { action, mode, enabled, needsRole: enabled ? undefined : (need?.[0] ?? undefined), ...extra };
}

/** Per-type actions by status, in display order; the first is the primary. 08 §5.4 and 01 §4.1. */
export function actionsFor(card: HubCard, roles: Role[], memberId: string): AvailableAction[] {
  const owner = card.ownerRole;
  const managers: Role[] = ['owner', 'pm'];
  switch (card.type) {
    case 'decision': {
      if (card.status !== 'open') return [];
      // 09 §7: role = deciderRole or owner.
      const deciders: Role[] = [card.decision.deciderRole, ...(card.decision.escalatedToRole ? [card.decision.escalatedToRole] : []), 'owner'];
      return [
        guard('decide', 'form', roles, deciders),
        ...(can(roles, ...managers) || card.createdById === memberId ? [guard('withdraw', 'confirm', roles, null, { destructive: true, reason: true })] : []),
      ];
    }
    case 'need': {
      const responsible: Role[] = [card.need.responsibleRole];
      if (card.status === 'requested')
        return [
          guard('deliver', 'form', roles, responsible),
          guard('start', 'now', roles, responsible),
          guard('cancel', 'confirm', roles, managers, { destructive: true, reason: true }),
        ];
      if (card.status === 'in_progress') return [guard('deliver', 'form', roles, responsible), guard('cancel', 'confirm', roles, managers, { destructive: true, reason: true })];
      // 09 §8: the requester's role or pm/owner verifies. Owner decision 2026-11-04: whoever delivered may too, with a required note.
      if (card.status === 'delivered') {
        const self = card.need.deliveredById === memberId;
        return [guard('verify', 'form', roles, self ? null : [...(members.find((m) => m.id === card.need.requesterId)?.roles ?? []), ...managers], { selfVerify: self })];
      }
      return [];
    }
    case 'handoff': {
      const to: Role[] = [card.handoff.toRole];
      // Owner decision 2026-11-04: owner and pm may acknowledge any handoff, under their own name. Apply stays with the receiver.
      // 09 §9: dismiss is the receiver or pm.
      if (card.status === 'pending') return [guard('acknowledge', 'form', roles, [...to, ...managers]), guard('dismiss', 'confirm', roles, [...to, 'pm'], { destructive: true, reason: true })];
      if (card.status === 'acknowledged') return [guard('apply', 'form', roles, to), guard('dismiss', 'confirm', roles, [...to, 'pm'], { destructive: true, reason: true })];
      return [];
    }
    case 'redesign': {
      if (card.status === 'review')
        return [
          guard('approve', 'form', roles, ['owner']),
          guard('request_changes', 'form', roles, ['owner']),
          guard('reject', 'form', roles, ['owner'], { destructive: true }),
        ];
      if (card.status === 'draft') return [guard('send_to_review', 'now', roles, ['designer', 'frontend', 'owner', 'pm'])];
      if (card.status === 'approved') {
        // 09 §10: approval created a port task, and Claim is that task's. Once it is claimed the card has nothing left to claim.
        const port = portTaskOf(card);
        const claimable = port?.status === 'ready' && port.ownerRole ? port.ownerRole : null;
        return [...(claimable ? [{ ...guard('claim', 'now', roles, [claimable]), enabled: roles.includes(claimable) && openBlockers(port!).length === 0 }] : []), guard('mark_ported', 'form', roles, ['frontend', 'pm', 'owner'])];
      }
      return [];
    }
    case 'release':
      return card.status === 'planned' ? [guard('release', 'now', roles, managers)] : [];
    case 'task': {
      const blocked = card.status === 'ready' && openBlockers(card).length > 0;
      // 09 §6: claiming takes the specialty's role, or pm. Moving a claimed task is the claimer's, so nobody else sees those buttons.
      const specialtyRoles: Role[] = owner ? [owner, 'pm'] : [];
      const claimer = card.task.claimedById === memberId;
      const manager = can(roles, ...managers);
      const reviewers: Role[] = ['qa', 'pm', 'owner'];
      const cancel = guard('cancel', 'confirm', roles, managers, { destructive: true, reason: true });
      if (card.status === 'backlog') return [guard('mark_ready', 'now', roles, card.createdById === memberId ? null : managers), cancel];
      if (card.status === 'ready') return [{ ...guard('claim', 'now', roles, specialtyRoles.length ? specialtyRoles : null), enabled: !blocked && (specialtyRoles.length === 0 || can(roles, ...specialtyRoles)) }, cancel];
      if (card.status === 'claimed') return [...(claimer ? [guard('start', 'now', roles, null)] : []), ...(claimer || manager ? [guard('unclaim', 'now', roles, null)] : []), cancel];
      if (card.status === 'in_progress') return [...(claimer ? [guard('submit', 'form', roles, null)] : []), ...(claimer || manager ? [guard('unclaim', 'now', roles, null)] : []), cancel];
      if (card.status === 'in_review') return [guard('done', 'now', roles, reviewers), guard('reopen', 'form', roles, reviewers), cancel];
      if ((card.status === 'done' || card.status === 'cancelled') && manager) return [guard('reopen', 'now', roles, managers)];
      return [];
    }
    default:
      return [];
  }
}

/** What somebody is waiting for me to do. Starting or submitting my own claimed work is not on this list, nor is anything destructive. */
const AWAITED = new Set<CardAction>(['decide', 'deliver', 'verify', 'acknowledge', 'apply', 'approve', 'claim']);

/** The action that keeps a card waiting on me (review B2), or undefined when it no longer does. The Awaiting rows, sidebar and Inbox all read this. */
export const awaitedAction = (card: HubCard, roles: Role[], memberId: string) => actionsFor(card, roles, memberId).find((a) => a.enabled && AWAITED.has(a.action));

/** Run the action on the card that carries it: a redesign's Claim belongs to its port task (09 §10). */
const actionTarget = (key: string, action: CardAction) => {
  const card = getCard(key);
  return action === 'claim' && card?.type === 'redesign' ? portTaskOf(card)?.key : key;
};

/**
 * Run an action the way the whole app does: write it, say so with Undo, leave the sheet. Undo restores the card and
 * puts focus back on its row. `cmd` adds a copyable command to the toast. A row that is the current target of
 * focus moves focus to its neighbour through `useKeyboardList`.
 */
export function usePerformAction() {
  const t = useT(kitMessages);
  const { me } = useSession();
  return (key: string, action: CardAction, payload: ActionPayload = {}, opts: { cmd?: string } = {}) => {
    const target = actionTarget(key, action);
    // No target, no write, and so no success message.
    if (!target) return;
    const undo = actOn(target, action, me.id, payload);
    const undoRead = markCardsRead(target === key ? [key] : [key, target]);
    if (currentRoute().cardKey === key) closeCard();
    showToast({
      message: fill(t.done[action], { key: <Ltr mono>{target}</Ltr> }),
      cmd: action === 'claim' ? `/hub:next ${target}` : opts.cmd,
      onUndo: () => {
        undo();
        undoRead();
        focusRowWhenReady(key);
      },
    });
  };
}
