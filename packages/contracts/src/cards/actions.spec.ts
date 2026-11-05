/**
 * @file Which actions a card offers and when it waits on a member (review B2, D24, D25).
 */
import { describe, expect, it } from 'vitest';

import { type ActionableCard, actionsFor, awaitedAction } from './actions';

const ME = 'me';
const card = (overrides: Partial<ActionableCard>): ActionableCard => ({
  type: 'task',
  status: 'ready',
  ownerRole: null,
  assigneeId: null,
  createdById: 'someone',
  archivedAt: null,
  detail: {},
  ...overrides,
});
const verbs = (c: ActionableCard, roles: Parameters<typeof actionsFor>[1]) =>
  actionsFor(c, roles, ME).map((a) => a.action);

describe('actionsFor', () => {
  it('offers nothing on a deleted card', () => {
    const decision = card({ type: 'decision', status: 'open', ownerRole: 'owner', archivedAt: new Date() });
    expect(actionsFor(decision, ['owner'], ME)).toEqual([]);
  });

  it('shows Decide disabled with the needed role to a member without it', () => {
    const decision = card({ type: 'decision', status: 'open', ownerRole: 'accountant' });
    const [decide] = actionsFor(decision, ['backend'], ME);
    expect(decide).toMatchObject({ action: 'decide', enabled: false, needsRole: 'accountant' });
  });

  it('hides another member’s private moves, and shows them to the assignee', () => {
    const task = card({ status: 'claimed', ownerRole: 'backend', detail: { specialty: 'backend' } });
    expect(verbs(task, ['qa'])).toEqual(['cancel']);
    expect(verbs({ ...task, assigneeId: ME }, ['backend'])).toEqual(['start', 'unclaim', 'cancel']);
  });

  it('a blocked ready task cannot be claimed', () => {
    const task = card({ ownerRole: 'backend', detail: { specialty: 'backend' }, blocked: true });
    expect(actionsFor(task, ['backend'], ME)[0]).toMatchObject({ action: 'claim', enabled: false });
  });

  it('D24: self-verify is enabled and flagged, for a member with no role in the need', () => {
    const need = card({
      type: 'need',
      status: 'delivered',
      ownerRole: 'accountant',
      detail: { deliveredById: ME },
    });
    expect(actionsFor(need, ['qa'], ME)[0]).toMatchObject({
      action: 'verify',
      enabled: true,
      selfVerify: true,
    });
  });

  it('D25: owner acknowledges any handoff, but only the receiving role applies', () => {
    const pending = card({ type: 'handoff', status: 'pending', ownerRole: 'frontend' });
    expect(actionsFor(pending, ['owner'], ME)[0]).toMatchObject({ action: 'acknowledge', enabled: true });
    const acknowledged = { ...pending, status: 'acknowledged' };
    expect(actionsFor(acknowledged, ['owner'], ME)[0]).toMatchObject({
      action: 'apply',
      enabled: false,
      needsRole: 'frontend',
    });
  });

  it('a plan offers tasks while a step has none, and done only when every step is done', () => {
    const plan = card({
      type: 'plan',
      status: 'in_progress',
      createdById: ME,
      detail: { steps: [{ id: 'a', taskKey: 'GTV-1', done: true }, { id: 'b' }] },
    });
    expect(verbs(plan, ['backend'])).toEqual(['to_tasks', 'abandon']);
    const finished = { ...plan, detail: { steps: [{ id: 'a', taskKey: 'GTV-1', done: true }] } };
    expect(verbs(finished, ['backend'])).toEqual(['finish', 'abandon']);
  });

  it('an approved redesign offers the port task’s Claim first, pointing at the task', () => {
    const redesign = card({
      type: 'redesign',
      status: 'approved',
      portTask: {
        key: 'GTV-9',
        status: 'ready',
        ownerRole: 'frontend',
        specialty: 'frontend',
        blocked: false,
      },
    });
    expect(actionsFor(redesign, ['frontend'], ME)[0]).toMatchObject({
      action: 'claim',
      targetKey: 'GTV-9',
      enabled: true,
    });
    expect(verbs({ ...redesign, portTask: null }, ['frontend'])).toEqual(['mark_ported']);
  });
});

describe('awaitedAction (review B2)', () => {
  it('the verb follows the state: Acknowledge, then Apply, then nothing', () => {
    const handoff = card({ type: 'handoff', status: 'pending', ownerRole: 'frontend' });
    expect(awaitedAction(handoff, ['frontend'], ME)?.action).toBe('acknowledge');
    expect(awaitedAction({ ...handoff, status: 'acknowledged' }, ['frontend'], ME)?.action).toBe('apply');
    expect(awaitedAction({ ...handoff, status: 'applied' }, ['frontend'], ME)).toBeNull();
  });

  it('Deliver becomes Verify on the same row, for who delivered', () => {
    const need = card({ type: 'need', status: 'requested', ownerRole: 'owner' });
    expect(awaitedAction(need, ['owner'], ME)?.action).toBe('deliver');
    const delivered = { ...need, status: 'delivered', detail: { deliveredById: ME } };
    expect(awaitedAction(delivered, ['owner'], ME)).toMatchObject({ action: 'verify', selfVerify: true });
  });

  it('a delivered need waits on the member who asked for it', () => {
    const need = card({ type: 'need', status: 'delivered', ownerRole: 'owner', createdById: ME });
    expect(awaitedAction(need, ['qa'], ME)?.action).toBe('verify');
    expect(awaitedAction({ ...need, createdById: 'other' }, ['qa'], ME)).toBeNull();
  });

  it('owner may decide any decision, but only one routed to them waits on them', () => {
    const decision = card({ type: 'decision', status: 'open', ownerRole: 'accountant' });
    expect(awaitedAction(decision, ['owner'], ME)).toBeNull();
    expect(awaitedAction(decision, ['accountant'], ME)?.action).toBe('decide');
    const escalated = { ...decision, detail: { escalatedToRole: 'pm' } };
    expect(awaitedAction(escalated, ['pm'], ME)?.action).toBe('decide');
  });

  it('another role’s handoff joins a manager’s stack only once it is stale', () => {
    const handoff = card({ type: 'handoff', status: 'pending', ownerRole: 'frontend' });
    expect(awaitedAction(handoff, ['pm'], ME)).toBeNull();
    expect(awaitedAction({ ...handoff, stale: true }, ['pm'], ME)?.action).toBe('acknowledge');
  });

  it('a ready task is not awaited; a task in review waits on qa and pm but not on its assignee', () => {
    expect(awaitedAction(card({ ownerRole: 'qa', detail: { specialty: 'qa' } }), ['qa'], ME)).toBeNull();
    const review = card({ status: 'in_review', ownerRole: 'backend', assigneeId: 'other' });
    expect(awaitedAction(review, ['qa'], ME)?.action).toBe('complete');
    expect(awaitedAction({ ...review, assigneeId: ME }, ['pm'], ME)).toBeNull();
  });

  it('a redesign in review waits on the owner, and a plan in review on owner and pm', () => {
    const redesign = card({ type: 'redesign', status: 'review' });
    expect(awaitedAction(redesign, ['owner'], ME)?.action).toBe('approve');
    expect(awaitedAction(redesign, ['pm'], ME)).toBeNull();
    const plan = card({ type: 'plan', status: 'in_review', detail: { steps: [] } });
    expect(awaitedAction(plan, ['pm'], ME)?.action).toBe('approve');
    expect(awaitedAction(plan, ['backend'], ME)).toBeNull();
  });

  it('a deleted card waits on nobody', () => {
    const decision = card({ type: 'decision', status: 'open', ownerRole: 'owner', archivedAt: new Date() });
    expect(awaitedAction(decision, ['owner'], ME)).toBeNull();
  });
});
