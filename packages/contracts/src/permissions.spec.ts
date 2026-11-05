/**
 * @file The permission table: decisions that changed in docs/15 keep their shape.
 */
import { describe, expect, it } from 'vitest';

import { CARD_MACHINES, CARD_TYPES } from './cards';
import { MCP_TOOLS } from './mcp/tools';
import {
  allowedActions,
  isAllowed,
  isPossible,
  PERMISSION_ACTIONS,
  type PermissionAction,
  surfaceOf,
} from './permissions';
import { ROLES } from './roles';

describe('isAllowed', () => {
  it('Y, N and the routed, specialty, assignee and creator grants hold as written', () => {
    expect(isAllowed('task.create', ['qa'])).toBe(true);
    expect(isAllowed('card.delete', ['qa'])).toBe(false);
    expect(isAllowed('decision.decide', ['backend'], { routedRoles: ['backend'] })).toBe(true);
    expect(isAllowed('decision.decide', ['backend'], { routedRoles: ['frontend'] })).toBe(false);
    expect(isAllowed('task.claim', ['designer'], { specialty: 'design' })).toBe(true);
    expect(isAllowed('task.claim', ['designer'], { specialty: 'backend' })).toBe(false);
    expect(isAllowed('task.start', ['backend'], { isAssignee: true })).toBe(true);
    expect(isAllowed('task.start', ['backend'], {})).toBe(false);
    expect(isAllowed('card.edit_content', ['qa'], { isCreator: true })).toBe(true);
  });

  it('D25: owner and pm acknowledge any handoff, but apply only as the receiving role', () => {
    expect(isAllowed('handoff.acknowledge', ['pm'], { routedRoles: ['frontend'] })).toBe(true);
    expect(isAllowed('handoff.apply', ['owner'], { routedRoles: ['frontend'] })).toBe(false);
    expect(isAllowed('handoff.apply', ['frontend'], { routedRoles: ['frontend'] })).toBe(true);
  });

  it('D29: only owner or pm approve a plan, D31 scope: only owner approves a redesign', () => {
    expect(isAllowed('plan.approve', ['pm'])).toBe(true);
    expect(isAllowed('plan.approve', ['backend'], { isCreator: true })).toBe(false);
    expect(isAllowed('redesign.approve', ['pm'])).toBe(false);
    expect(isAllowed('redesign.approve', ['owner'])).toBe(true);
  });

  it('D24: a need is verified by its routed role, its requester or whoever delivered it', () => {
    expect(isAllowed('need.verify', ['accountant'], { routedRoles: ['accountant'] })).toBe(true);
    expect(isAllowed('need.verify', ['qa'], { isCreator: true })).toBe(true);
    expect(isAllowed('need.verify', ['qa'], { isDeliverer: true })).toBe(true);
    expect(isAllowed('need.verify', ['qa'], { routedRoles: ['accountant'] })).toBe(false);
  });

  it('a task in review moves for qa, but qa cannot complete work still in progress', () => {
    expect(isAllowed('task.review', ['qa'])).toBe(true);
    expect(isAllowed('task.complete', ['qa'])).toBe(false);
  });

  it('system rows belong to nobody and have no surface', () => {
    for (const role of ROLES) expect(isAllowed('card.unblock', [role])).toBe(false);
    expect(surfaceOf('card.unblock')).toBe('system');
  });

  it('any member may create a project (D30)', () => {
    for (const role of ROLES) expect(isAllowed('project.create', [role])).toBe(true);
  });

  it('any of the actor roles may satisfy the row', () => {
    expect(isAllowed('card.delete', ['qa', 'pm'])).toBe(true);
  });

  it.each(['card.delete', 'card.restore'] as const)(
    '%s is for owner, pm and the card creator (D28)',
    (action) => {
      expect(isAllowed(action, ['owner'])).toBe(true);
      expect(isAllowed(action, ['pm'])).toBe(true);
      for (const role of ['accountant', 'backend', 'frontend', 'designer', 'qa'] as const) {
        expect(isAllowed(action, [role])).toBe(false);
        expect(isAllowed(action, [role], { isCreator: true })).toBe(true);
      }
    },
  );
});

describe('isPossible and allowedActions', () => {
  it('isPossible ignores card facts, and refuses a row that is N for all held roles', () => {
    expect(isPossible('task.start', ['backend'])).toBe(true);
    expect(isPossible('card.edit_routing', ['backend'])).toBe(false);
  });

  it('allowedActions lists what holds', () => {
    const actions = allowedActions(['qa'], { isCreator: true });
    expect(actions).toContain('card.edit_content');
    expect(actions).toContain('card.delete');
    expect(actions).not.toContain('card.edit_routing');
    expect(allowedActions(['qa'], {})).not.toContain('card.delete');
  });
});

describe('every machine transition has a permission row', () => {
  it.each(CARD_TYPES)('%s', (type) => {
    // change and doc move through adapters only, under the system actor.
    if (type === 'change' || type === 'doc') return;
    for (const verb of Object.keys(CARD_MACHINES[type].transitions)) {
      expect(PERMISSION_ACTIONS).toContain(`${type}.${verb}`);
    }
  });
});

describe('MCP parity (docs/15 §6)', () => {
  const covered = new Set<PermissionAction>(MCP_TOOLS.flatMap((tool) => tool.actions));

  it('every action with surface any has a tool', () => {
    const missing = PERMISSION_ACTIONS.filter(
      (action) => surfaceOf(action) === 'any' && !covered.has(action),
    );
    expect(missing).toEqual([]);
  });

  it('no tool performs a web-only action (D27 limits)', () => {
    expect([...covered].filter((action) => surfaceOf(action) === 'web_only')).toEqual([]);
  });

  it('tool names are unique and fit the 60 character limit', () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.length).toBeLessThanOrEqual(60);
  });
});
