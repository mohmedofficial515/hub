/**
 * @file The routing table, row by row (docs/07 §8).
 */
import type { CardType, EventKind } from '@hub/contracts';

import { actsTakenBack, isAct } from './acts';
import { type Notice, routeEvent, type RoutingCard } from './routing';

const card = (type: CardType, overrides: Partial<RoutingCard> = {}): RoutingCard => ({
  type,
  status: 'open',
  ownerRole: 'accountant',
  createdById: 'creator',
  assigneeId: null,
  detail: null,
  ...overrides,
});

const route = (
  kind: EventKind,
  c: RoutingCard,
  data: Record<string, unknown> = {},
  previous?: string | null,
) => routeEvent({ kind, data }, c, previous === undefined ? c.ownerRole : previous);

const brief = (notices: Notice[]) =>
  notices.map((n) => ({
    kind: n.kind,
    roles: n.roles ?? [],
    userIds: n.userIds ?? [],
    watchers: n.watchers ?? false,
    action: n.action ?? null,
  }));

describe('routeEvent', () => {
  it('a new decision goes to the decider role and the owner', () => {
    expect(brief(route('created', card('decision')))).toEqual([
      {
        kind: 'routed_decision',
        roles: ['accountant', 'owner'],
        userIds: [],
        watchers: false,
        action: 'decide',
      },
    ]);
  });

  it.each([
    ['need', 'routed_need', 'deliver'],
    ['handoff', 'routed_handoff', 'acknowledge'],
  ] as const)('a new %s goes to the routed role', (type, kind, action) => {
    expect(brief(route('created', card(type)))[0]).toMatchObject({ kind, roles: ['accountant'], action });
  });

  it('a ready task goes to every role its specialty maps to, a backlog one to nobody', () => {
    const task = card('task', { status: 'ready', detail: { specialty: 'ops' } });
    expect(brief(route('created', task))[0]).toMatchObject({
      kind: 'task_ready',
      roles: ['backend', 'frontend'],
      action: 'claim',
    });
    expect(route('created', card('task', { status: 'backlog' }))).toEqual([]);
    expect(brief(route('status_changed', task, { to: 'ready' }))[0]?.kind).toBe('task_ready');
  });

  it('a task in review asks qa and tells watchers', () => {
    expect(brief(route('status_changed', card('task'), { to: 'in_review' }))).toEqual([
      { kind: 'review_requested', roles: ['qa'], userIds: [], watchers: false, action: 'review' },
      { kind: 'watch_update', roles: [], userIds: [], watchers: true, action: null },
    ]);
  });

  it('a redesign in review asks the owner and qa', () => {
    expect(brief(route('status_changed', card('redesign'), { to: 'review' }))[0]).toMatchObject({
      kind: 'routed_review',
      roles: ['owner', 'qa'],
    });
  });

  it('a change of routed role reaches the new role', () => {
    const notices = route('field_changed', card('decision'), { changes: { ownerRole: {} } }, 'pm');
    expect(brief(notices)[0]).toMatchObject({ kind: 'routed_decision', roles: ['accountant'] });
  });

  it.each(['tags', 'module', 'readme', 'content', 'facts', 'branches'])(
    'a watcher does not hear about %s',
    (field) => {
      expect(route('field_changed', card('task'), { changes: { [field]: {} } })).toEqual([]);
      expect(route('field_changed', card('doc'), { field })).toEqual([]);
    },
  );

  it('any other edit tells watchers', () => {
    expect(brief(route('field_changed', card('task'), { changes: { title: {} } }))[0]?.watchers).toBe(true);
  });

  it.each(['commit', 'watch', 'unwatch'] as const)('%s tells nobody', (kind) => {
    expect(route(kind, card('task'))).toEqual([]);
  });

  it('a decision taken tells the creator and watchers', () => {
    expect(brief(route('decided', card('decision')))[0]).toMatchObject({
      kind: 'watch_update',
      userIds: ['creator'],
      watchers: true,
    });
  });

  it('a delivered need asks the requester and the owner to verify', () => {
    expect(brief(route('delivered', card('need')))[0]).toMatchObject({
      roles: ['owner'],
      userIds: ['creator'],
      action: 'verify',
    });
  });

  it.each(['verified', 'acknowledged', 'applied', 'dismissed'] as const)(
    '%s tells the creator and watchers',
    (kind) => {
      expect(brief(route(kind, card('handoff')))[0]).toMatchObject({ userIds: ['creator'], watchers: true });
    },
  );

  it.each(['approved', 'rejected', 'changes_requested'] as const)(
    'a redesign %s tells its creator, designers and watchers',
    (kind) => {
      expect(brief(route(kind, card('redesign')))[0]).toMatchObject({
        roles: ['designer'],
        userIds: ['creator'],
        watchers: true,
      });
    },
  );

  it('a plan sent back for changes tells its creator and watchers, not the designers', () => {
    expect(brief(route('changes_requested', card('plan', { ownerRole: null })))).toEqual([
      { kind: 'watch_update', roles: [], userIds: ['creator'], watchers: true, action: null },
    ]);
  });

  it('ported tells the owner and watchers', () => {
    expect(brief(route('ported', card('redesign')))[0]).toMatchObject({ roles: ['owner'], watchers: true });
  });

  it('a reminder reaches the routed role, and watchers only on decisions', () => {
    const decision = brief(route('reminder_sent', card('decision'), { offsetHours: 24 }))[0];
    expect(decision).toMatchObject({ kind: 'deadline_reminder', roles: ['accountant'], watchers: true });
    const handoff = brief(route('reminder_sent', card('handoff'), { reason: 'stale' }))[0];
    expect(handoff).toMatchObject({ kind: 'deadline_reminder', watchers: false });
    const need = brief(route('reminder_sent', card('need'), { reason: 'stale' }))[0];
    expect(need).toMatchObject({ roles: ['accountant'], userIds: ['creator'] });
  });

  it('an orphaned claim asks only its assignee', () => {
    const task = card('task', { assigneeId: 'sara' });
    expect(brief(route('reminder_sent', task, { reason: 'orphaned_claim' }))[0]).toMatchObject({
      kind: 'watch_update',
      userIds: ['sara'],
    });
  });

  it('an escalation reaches pm and owner', () => {
    expect(brief(route('escalated', card('decision')))[0]).toMatchObject({
      kind: 'escalation',
      roles: ['pm', 'owner'],
      action: 'decide',
    });
  });

  it('a session with no summary tells its member', () => {
    const noSummary = route('session_logged', card('change'), { hasSummary: false, userId: 'me' });
    expect(brief(noSummary)[0]).toMatchObject({ kind: 'system', userIds: ['me'] });
    expect(route('session_logged', card('change'), { hasSummary: true })).toEqual([]);
  });

  it('a release tells every member', () => {
    expect(brief(route('created', card('release')))[0]?.roles).toContain('qa');
    expect(brief(route('status_changed', card('release'), { to: 'released' }))[0]?.roles).toContain('owner');
  });

  it('a plan in review goes to owner and pm, an idea to its role', () => {
    expect(brief(route('status_changed', card('plan'), { to: 'in_review' }))[0]).toMatchObject({
      roles: ['owner', 'pm'],
      action: 'approve',
    });
    expect(brief(route('created', card('idea', { detail: { role: 'designer' } })))[0]).toMatchObject({
      kind: 'routed_idea',
      roles: ['designer'],
    });
    expect(route('created', card('idea', { detail: { role: null } }))).toEqual([]);
  });

  it('docs and changes arriving from a source tell nobody', () => {
    expect(route('created', card('doc'))).toEqual([]);
    expect(route('created', card('change'))).toEqual([]);
  });
});

describe('acts', () => {
  it('doing the work counts; talking about it does not', () => {
    const work = ['decision.decide', 'task.claim', 'need.deliver', 'handoff.apply', 'card.delete'] as const;
    for (const action of work) expect(isAct(action)).toBe(true);
    for (const action of ['card.comment', 'card.watch', 'task.create', 'card.edit_content'] as const) {
      expect(isAct(action)).toBe(false);
    }
  });

  it('the inverse names what it takes back', () => {
    expect(actsTakenBack('task.unclaim')).toEqual(['task.claim']);
    expect(actsTakenBack('card.restore')).toEqual(['card.delete']);
    expect(actsTakenBack('decision.decide')).toEqual([]);
  });
});
