/**
 * @file H0-06: every decision and need action (docs/04 §3.11, §3.12, D24, D27).
 */
import type { INestApplication } from '@nestjs/common';

import { aDecision, aNeed, aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp, type TestApp } from '../setup/create-test-app';

const SECRET = `ghp_${'a1B2'.repeat(9)}`;

describe('decisions', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
  });

  it('creates with slug ids, the routed role and the default deadline, and tells the decider', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const { body } = await pm.post('/cards', aDecision('accountant')).expect(201);
    expect(body.data).toMatchObject({
      status: 'open',
      ownerRole: 'accountant',
      detail: {
        deciderRole: 'accountant',
        adrStatus: 'none',
        options: [
          { id: 'left', title: 'Left', pros: ['short'], cons: [], cost: null, recommended: true },
          { id: 'right', title: 'Right' },
        ],
      },
    });
    const due = Date.parse(body.data.dueAt as string) - testApp.clock.now().getTime();
    expect(due).toBe(3 * 86_400_000);
    const rows = await db().notification.findMany({ where: { workspaceId: project.id } });
    expect(rows).toMatchObject([{ userId: accountant.id, kind: 'routed_decision' }]);
  });

  it('needs two options, and accepts a title with no latin letters', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const one = aDecision('pm');
    one.detail.options = [{ title: 'Only' }] as typeof one.detail.options;
    const refused = await pm.post('/cards', one).expect(400);
    expect(refused.body.error.code).toBe('hub.decisions.options_min');

    const arabic = aDecision('pm');
    arabic.detail.options = [{ title: 'يمين' }, { title: 'يسار' }] as typeof arabic.detail.options;
    const { body } = await pm.post('/cards', arabic).expect(201);
    const ids = (body.data.detail.options as { id: string }[]).map((option) => option.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.startsWith('option-'))).toBe(true);
  });

  it('decide: decided, one event, an ADR skeleton, and D27 lets an agent do it', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const agent = await project.member(['accountant'], 'agent');
    const decision = await created(pm, aDecision('accountant'));

    const { body } = await agent
      .post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'It is shorter' })
      .expect(200);
    expect(body.data).toMatchObject({
      status: 'decided',
      event: { kind: 'decided' },
      detail: {
        chosenOptionId: 'left',
        rationale: 'It is shorter',
        decidedBy: { id: agent.id },
        adrStatus: 'drafted',
      },
    });
    expect(body.data.closedAt).not.toBeNull();
    expect(body.data.detail.adrBody).toContain('**Left**');
    const events = await eventsOf(decision.id);
    expect(events.map((event) => event.kind)).toEqual(['created', 'decided']);
    expect(events[1]).toMatchObject({
      actorKind: 'agent',
      via: 'mcp',
      data: { optionId: 'left', optionTitle: 'Left', from: 'open', to: 'decided' },
    });
  });

  it('decide by a user without the decider role answers 403; the owner may', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const owner = await project.member(['owner']);
    const decision = await created(pm, aDecision('accountant'));
    const refused = await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' })
      .expect(403);
    expect(refused.body.error.code).toBe('hub.decisions.not_decider');
    await owner.post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);
  });

  it('decide refuses an unknown option, and deciding twice', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const decision = await created(pm, aDecision('pm'));
    const missing = await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: 'nope', rationale: 'r' })
      .expect(404);
    expect(missing.body.error.code).toBe('hub.decisions.option_not_found');
    await pm.post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);
    const twice = await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: 'right', rationale: 'r' })
      .expect(409);
    expect(twice.body.error.code).toBe('hub.decisions.already_decided');
  });

  it('a decided decision emits unblocked on every card it blocked, and tells the assignee', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const backend = await project.member(['backend']);
    const decision = await created(pm, aDecision('pm'));
    const a = await created(pm, aTask({ title: 'A', links: [{ kind: 'blocked_by', key: decision.key }] }));
    const b = await created(pm, aTask({ title: 'B', links: [{ kind: 'blocked_by', key: decision.key }] }));
    await pm.patch(`/cards/${a.key}`, { assignee: backend.id }).expect(200);

    const { body } = await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' })
      .expect(200);
    expect(body.data.detail.adrBody).toContain(a.key);

    for (const card of [a, b]) {
      expect((await eventsOf(card.id)).at(-1)).toMatchObject({
        kind: 'unblocked',
        data: { byCardKey: decision.key },
      });
    }
    const rows = await db().notification.findMany({
      where: { workspaceId: project.id, kind: 'unblocked', cardId: a.id },
    });
    expect(rows).toMatchObject([{ userId: backend.id }]);
    const audit = await db().auditLog.count({
      where: { workspaceId: project.id, action: 'cards.card.unblock' },
    });
    expect(audit).toBe(2);
  });

  it('a card still blocked by another is told nothing, but its event says what closed', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const backend = await project.member(['backend']);
    const first = await created(pm, aDecision('pm', { title: 'First' }));
    const second = await created(pm, aDecision('pm', { title: 'Second' }));
    const task = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: first.key }] }));
    await pm.post(`/cards/${task.key}/links`, { kind: 'blocked_by', key: second.key }).expect(201);
    await pm.patch(`/cards/${task.key}`, { assignee: backend.id }).expect(200);

    await pm.post(`/decisions/${first.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);
    await expect(
      db().notification.count({ where: { workspaceId: project.id, kind: 'unblocked' } }),
    ).resolves.toBe(0);
    await pm.post(`/decisions/${second.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);
    await expect(
      db().notification.count({ where: { workspaceId: project.id, kind: 'unblocked' } }),
    ).resolves.toBe(1);
  });

  it('options edit only while open, by the creator or a manager', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const other = await project.member(['backend']);
    const decision = await created(creator, aDecision('qa'));
    const options = [{ id: 'a', title: 'A' }, { title: 'B' }];
    await other.patch(`/decisions/${decision.key}/options`, { options }).expect(403);
    const { body } = await creator.patch(`/decisions/${decision.key}/options`, { options }).expect(200);
    expect(body.data.detail.options.map((o: { id: string }) => o.id)).toEqual(['a', 'b']);
    await creator.patch(`/decisions/${decision.key}/options`, { options: [{ title: 'One' }] }).expect(400);
    await creator.post(`/decisions/${decision.key}/decide`, { optionId: 'a', rationale: 'r' }).expect(200);
    const closed = await creator.patch(`/decisions/${decision.key}/options`, { options }).expect(409);
    expect(closed.body.error.code).toBe('hub.decisions.already_decided');
  });

  it('withdraw needs a reason, and only an open decision', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const decision = await created(creator, aDecision('qa'));
    await creator.post(`/decisions/${decision.key}/withdraw`).expect(400);
    const { body } = await creator
      .post(`/decisions/${decision.key}/withdraw`, { reason: 'moot' })
      .expect(200);
    expect(body.data.status).toBe('withdrawn');
    await creator.post(`/decisions/${decision.key}/withdraw`, { reason: 'moot' }).expect(409);
  });

  it('supersede: owner or pm, by another decision, linked once', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const old = await created(pm, aDecision('pm', { title: 'Old' }));
    const replacement = await created(pm, aDecision('pm', { title: 'New' }));
    const task = await created(pm, aTask());
    await pm.post(`/decisions/${old.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);

    await qa.post(`/decisions/${old.key}/supersede`, { byKey: replacement.key }).expect(403);
    await pm.post(`/decisions/${old.key}/supersede`, { byKey: task.key }).expect(409);
    await pm.post(`/decisions/${old.key}/supersede`, { byKey: 'ZZ-1' }).expect(404);
    const { body } = await pm.post(`/decisions/${old.key}/supersede`, { byKey: replacement.key }).expect(200);
    expect(body.data.status).toBe('superseded');
    expect(body.data.links).toMatchObject([{ kind: 'relates', card: { key: replacement.key } }]);
  });

  it('draft ADR: replaces the body and keeps it through decide', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const decision = await created(pm, aDecision('pm'));
    await qa.put(`/decisions/${decision.key}/adr`, { body: 'x' }).expect(403);
    const { body } = await pm
      .put(`/decisions/${decision.key}/adr`, { body: '# My ADR', path: 'docs/adr/x.md' })
      .expect(200);
    expect(body.data.detail).toMatchObject({
      adrBody: '# My ADR',
      adrStatus: 'drafted',
      adrPath: 'docs/adr/x.md',
    });
    const decided = await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' })
      .expect(200);
    expect(decided.body.data.detail.adrBody).toBe('# My ADR');
  });

  it('lists open by deadline, filters, and shows what each blocks', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const later = await created(pm, aDecision('pm', { title: 'Later', dueAt: '2031-01-01T00:00:00.000Z' }));
    const soon = await created(pm, aDecision('qa', { title: 'Soon', dueAt: '2030-01-01T00:00:00.000Z' }));
    const late = await created(pm, aDecision('pm', { title: 'Late', dueAt: '2020-01-01T00:00:00.000Z' }));
    const blocked = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: soon.key }] }));

    const { body } = await pm.get('/decisions').expect(200);
    expect(body.data.map((c: { key: string }) => c.key)).toEqual([late.key, soon.key, later.key]);
    expect(body.data[1].blocks).toMatchObject([{ key: blocked.key }]);
    expect(body.data[1].detail.question).toBe('Which way?');

    expect((await qa.get('/decisions', { mine: 'true' }).expect(200)).body.data).toMatchObject([
      { key: soon.key },
    ]);
    expect((await pm.get('/decisions', { overdue: 'true' }).expect(200)).body.data).toMatchObject([
      { key: late.key },
    ]);
    expect((await pm.get('/decisions', { deciderRole: 'qa' }).expect(200)).body.data).toHaveLength(1);
    expect((await pm.get('/decisions', { status: 'decided' }).expect(200)).body.data).toEqual([]);
  });
});

describe('needs', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('runs requested, in progress, delivered, verified, and tells the responsible role', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const need = await created(pm, aNeed('accountant'));
    const rows = await db().notification.findMany({ where: { workspaceId: project.id } });
    expect(rows).toMatchObject([{ userId: accountant.id, kind: 'routed_need' }]);

    expect((await accountant.post(`/needs/${need.key}/start`).expect(200)).body.data.status).toBe(
      'in_progress',
    );
    const delivered = await accountant
      .post(`/needs/${need.key}/deliver`, { location: 'Vault / tax', note: 'done' })
      .expect(200);
    expect(delivered.body.data).toMatchObject({
      status: 'delivered',
      event: { kind: 'delivered' },
      detail: { location: 'Vault / tax', deliveredBy: { id: accountant.id } },
    });
    const verified = await pm.post(`/needs/${need.key}/verify`).expect(200);
    expect(verified.body.data).toMatchObject({
      status: 'verified',
      event: { kind: 'verified' },
      detail: { verifiedBy: { id: pm.id } },
    });
    expect(verified.body.data.closedAt).not.toBeNull();
  });

  it('deliver: the responsible role only, a location, and never a secret', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const need = await created(pm, aNeed('accountant'));

    const wrong = await qa.post(`/needs/${need.key}/deliver`, { location: 'x' }).expect(403);
    expect(wrong.body.error.code).toBe('hub.needs.not_responsible');
    const none = await pm.post(`/needs/${need.key}/deliver`, {}).expect(400);
    expect(none.body.error.code).toBe('hub.needs.location_required');

    const secret = await pm.post(`/needs/${need.key}/deliver`, { location: SECRET }).expect(422);
    expect(secret.body.error).toMatchObject({
      code: 'hub.security.secret_detected',
      details: { pattern: 'github_token' },
    });
    expect(JSON.stringify(secret.body)).not.toContain(SECRET);
    expect((await eventsOf(need.id)).map((event) => event.kind)).toEqual(['created']);
  });

  it('D24: who delivered may verify only with a note, and the event records it', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner', 'accountant']);
    const need = await created(owner, aNeed('owner'));
    await owner.post(`/needs/${need.key}/deliver`, { location: 'Vault' }).expect(200);

    const card = (await owner.get(`/cards/${need.key}`).expect(200)).body.data;
    expect(card.awaitedAction).toMatchObject({ action: 'verify', selfVerify: true });

    const refused = await owner.post(`/needs/${need.key}/verify`).expect(400);
    expect(refused.body.error.code).toBe('hub.needs.self_verify_note_required');
    const { body } = await owner.post(`/needs/${need.key}/verify`, { note: 'I checked' }).expect(200);
    expect(body.data.detail.verificationNote).toBe('I checked');
    expect((await eventsOf(need.id)).at(-1)?.data).toMatchObject({ selfVerified: true, note: 'I checked' });
  });

  it('the requester verifies with no role in it; a bystander does not', async () => {
    const project = await aProject(app);
    const requester = await project.member(['qa']);
    const accountant = await project.member(['accountant']);
    const bystander = await project.member(['backend']);
    const need = await created(requester, aNeed('accountant'));
    await accountant.post(`/needs/${need.key}/deliver`, { location: 'Vault' }).expect(200);

    await bystander.post(`/needs/${need.key}/verify`).expect(403);
    await requester.post(`/needs/${need.key}/verify`).expect(200);
  });

  it('reject delivery goes back to in progress and forgets who delivered', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const need = await created(pm, aNeed('accountant'));
    await accountant.post(`/needs/${need.key}/deliver`, { location: 'Vault' }).expect(200);
    await pm.post(`/needs/${need.key}/reject-delivery`).expect(400);
    const { body } = await pm.post(`/needs/${need.key}/reject-delivery`, { reason: 'wrong' }).expect(200);
    expect(body.data).toMatchObject({ status: 'in_progress', detail: { deliveredBy: null } });
    await accountant.post(`/needs/${need.key}/deliver`, { location: 'Other' }).expect(200);
  });

  it('cancel: a reason, by the creator or a manager', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const other = await project.member(['backend']);
    const need = await created(creator, aNeed('accountant'));
    await other.post(`/needs/${need.key}/cancel`, { reason: 'x' }).expect(403);
    await creator.post(`/needs/${need.key}/cancel`).expect(400);
    const { body } = await creator.post(`/needs/${need.key}/cancel`, { reason: 'moot' }).expect(200);
    expect(body.data.status).toBe('cancelled');
  });

  it('a verified need unblocks what it blocked', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const need = await created(pm, aNeed('pm'));
    const task = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: need.key }] }));
    await pm.post(`/needs/${need.key}/deliver`, { location: 'Vault' }).expect(200);
    expect((await pm.get(`/cards/${task.key}`).expect(200)).body.data.flags.blocked).toBe(true);
    await pm.post(`/needs/${need.key}/verify`, { note: 'ok' }).expect(200);
    expect((await pm.get(`/cards/${task.key}`).expect(200)).body.data.flags.blocked).toBe(false);
    expect((await eventsOf(task.id)).at(-1)?.kind).toBe('unblocked');
  });

  it('lists open by priority, with filters', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const low = await created(pm, { ...aNeed('accountant'), priority: 'P3' });
    const high = await created(pm, { ...aNeed('owner'), priority: 'P0' });

    const { body } = await pm.get('/needs').expect(200);
    expect(body.data.map((c: { key: string }) => c.key)).toEqual([high.key, low.key]);
    expect(body.data[0].blocks).toEqual([]);
    expect((await accountant.get('/needs', { mine: 'true' }).expect(200)).body.data).toMatchObject([
      { key: low.key },
    ]);
    expect((await pm.get('/needs', { responsibleRole: 'owner' }).expect(200)).body.data).toHaveLength(1);
    expect((await pm.get('/needs', { status: 'verified' }).expect(200)).body.data).toEqual([]);
    expect((await pm.get('/needs', { stale: 'true' }).expect(200)).body.data).toEqual([]);
  });
});
