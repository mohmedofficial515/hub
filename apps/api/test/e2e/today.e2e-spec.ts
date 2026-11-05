/**
 * @file Today, counters and briefs over HTTP (docs/04 §3.23, §3.19), against real events and the fake clock.
 */
import { BriefsService } from '@/modules/digests';

import { aDecision, aHandoff, aNeed, aProject, aTask, created, db } from '../setup/card-harness';
import { closeTestApps, createTestApp, type TestApp } from '../setup/create-test-app';

const HOUR = 3_600_000;

describe('today', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApps();
  });

  it('counters come from state, and agree with the lists on every action', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant', 'backend']);
    const decision = await created(pm, aDecision('accountant'));
    await created(pm, aNeed('accountant'));
    await created(pm, aHandoff('backend'));
    const task = await created(pm, aTask());

    const read = async () => (await accountant.get('/counters').expect(200)).body.data;
    let counters = await read();
    expect(counters).toMatchObject({
      inboxUnread: 4,
      awaitingMe: 3,
      decisionsOpen: 1,
      decisionsMine: 1,
      decisionsOverdue: 0,
      needsOpen: 1,
      needsMine: 1,
      handoffsPending: 1,
      handoffsMine: 1,
      tasksReadyForMe: 1,
      redesignInReview: 0,
      noSummarySessions: 0,
      planningOpen: 0,
      invitesPending: 0,
      sourceProblems: 0,
    });
    const listed = (await accountant.get('/cards', { awaiting: 'me' }).expect(200)).body.data;
    expect(listed).toHaveLength(counters.awaitingMe);

    const full = (await accountant.get(`/cards/${decision.key}`).expect(200)).body.data;
    await accountant
      .post(`/decisions/${decision.key}/decide`, {
        optionId: full.detail.options[0].id,
        rationale: 'Yes, cheaper',
      })
      .expect(200);
    await accountant.post(`/tasks/${task.key}/claim`).expect(200);
    counters = await read();
    expect(counters).toMatchObject({
      inboxUnread: 2,
      awaitingMe: 2,
      decisionsOpen: 0,
      decisionsMine: 0,
      tasksReadyForMe: 0,
    });
    await pm.post('/cards', { type: 'idea', title: 'A thought', detail: { problem: 'Why not' } }).expect(201);
    expect((await read()).planningOpen).toBe(1);
  });

  it('since last visit is one count, leaves out my own events, and clears on visit only', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    await qa.post('/today/seen').expect(204);
    testApp.clock.advance(1000);

    const first = await created(pm, aTask());
    await pm.patch(`/cards/${first.key}`, { title: 'Renamed' }).expect(200);
    await created(qa, aTask({ title: 'My own' }));

    const today = (await qa.get('/today').expect(200)).body.data;
    expect(today.changesSince.total).toBe(2);
    expect(today.counters.newEvents).toBe(2);
    expect(today.changesSince.events).toHaveLength(1);
    expect(today.changesSince.events[0].collapsed).toBe(1);

    // Reading twice clears nothing; the visit does.
    expect((await qa.get('/counters').expect(200)).body.data.newEvents).toBe(2);
    testApp.clock.advance(1000);
    await qa.post('/today/seen').expect(204);
    testApp.clock.advance(1000);
    const after = (await qa.get('/today').expect(200)).body.data;
    expect(after.counters.newEvents).toBe(0);
    expect(after.changesSince.events).toEqual([]);
    await pm.patch(`/cards/${first.key}`, { title: 'Again' }).expect(200);
    expect((await qa.get('/counters').expect(200)).body.data.newEvents).toBe(1);
  });

  it('a deleted card leaves every number', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    await accountant.post('/today/seen').expect(204);
    testApp.clock.advance(1000);
    const decision = await created(pm, aDecision('accountant'));
    expect((await accountant.get('/counters').expect(200)).body.data).toMatchObject({
      inboxUnread: 1,
      awaitingMe: 1,
      decisionsOpen: 1,
      newEvents: 1,
    });
    await pm.post(`/cards/${decision.key}/delete`).expect(200);
    expect((await accountant.get('/counters').expect(200)).body.data).toMatchObject({
      inboxUnread: 0,
      awaitingMe: 0,
      decisionsOpen: 0,
      newEvents: 0,
    });
  });

  it('shows awaiting, ready, deadlines and an honest empty brief', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const empty = (await accountant.get('/today').expect(200)).body.data;
    expect(empty).toMatchObject({
      timezone: 'Europe/Istanbul',
      awaitingMe: [],
      readyTasks: [],
      deadlines: [],
      noSummarySessions: [],
      sources: [],
      weekly: null,
      brief: { narrative: null, generatedNow: true, id: null, kind: 'morning' },
    });
    expect(empty.brief.markdown).toContain('Nothing is waiting for you.');

    const dueAt = new Date(testApp.clock.now().getTime() + 10 * HOUR).toISOString();
    const decision = await created(pm, aDecision('accountant', { dueAt }));
    const today = (await accountant.get('/today').expect(200)).body.data;
    expect(today.awaitingMe.map((card: { key: string }) => card.key)).toEqual([decision.key]);
    expect(today.awaitingMe[0].awaiting).toBe('decide');
    expect(today.awaitingMe[0].detail.question).toBe('Which way?');
    expect(today.deadlines.map((card: { key: string }) => card.key)).toEqual([decision.key]);
    expect(today.brief.sections.awaitingMe.decisions[0].key).toBe(decision.key);
  });

  it('team stats are real: activity per day, totals with the previous week, flow by type', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const sara = await project.member(['backend']);

    // Thursday 2026-11-05 09:00 UTC is the harness's start, unless an earlier test moved it.
    testApp.clock.set(new Date('2026-10-29T09:00:00Z'));
    const old = await created(pm, aDecision('owner'));
    const oldFull = (await pm.get(`/cards/${old.key}`).expect(200)).body.data;
    const owner = await project.member(['owner']);
    await owner
      .post(`/decisions/${old.key}/decide`, {
        optionId: oldFull.detail.options[0].id,
        rationale: 'Last week',
      })
      .expect(200);

    testApp.clock.set(new Date('2026-11-05T09:00:00Z'));
    const fresh = await created(pm, aDecision('owner'));
    const freshFull = (await pm.get(`/cards/${fresh.key}`).expect(200)).body.data;
    await owner
      .post(`/decisions/${fresh.key}/decide`, {
        optionId: freshFull.detail.options[0].id,
        rationale: 'This week',
      })
      .expect(200);
    const task = await created(pm, aTask());
    await sara.post(`/tasks/${task.key}/claim`).expect(200);
    await sara.post(`/tasks/${task.key}/start`).expect(200);

    const { team } = (await sara.get('/today').expect(200)).body.data;
    expect(team.week).toEqual({ iso: '2026-W45', from: '2026-11-02', to: '2026-11-08' });
    expect(team.totals.find((row: { key: string }) => row.key === 'decided')).toEqual({
      key: 'decided',
      value: 1,
      prev: 1,
      available: true,
    });
    expect(team.totals.find((row: { key: string }) => row.key === 'commits').available).toBe(false);
    expect(team.totals.find((row: { key: string }) => row.key === 'closed')).toMatchObject({
      value: 1,
      prev: 1,
    });
    expect(team.flow).toEqual(
      expect.arrayContaining([
        { type: 'decision', created: 1, closed: 1 },
        { type: 'task', created: 1, closed: 0 },
      ]),
    );
    expect(team.days).toHaveLength(14);
    expect(team.days[13]).toBe('2026-11-05');
    const row = team.members.find((member: { userId: string }) => member.userId === sara.id);
    expect(row.activity[13]).toBe(2);
    expect(row.activity.slice(0, 13)).toEqual(Array(13).fill(0));
    expect(row.focus).toEqual({ key: task.key, title: 'A task', type: 'task' });
    const ownerRow = team.members.find((member: { userId: string }) => member.userId === owner.id);
    expect(ownerRow.cardsClosed).toBe(1);
    expect(ownerRow.activity[6]).toBe(1);
  });

  it('a narrative saved by the agent appears, and survives the morning job', async () => {
    const project = await aProject(testApp.app);
    const qa = await project.member(['qa']);
    testApp.clock.set(new Date('2026-11-05T03:00:00Z'));
    const today = (await qa.get('/today').expect(200)).body.data;
    const saved = await qa
      .put(`/briefs/morning/${today.date}/narrative`, { narrative: 'Yesterday the backend changed.' })
      .expect(200);
    expect(saved.body.data).toMatchObject({
      narrative: 'Yesterday the backend changed.',
      generatedNow: false,
    });
    expect(saved.body.data.narrativeBy.id).toBe(qa.id);

    testApp.clock.set(new Date('2026-11-05T05:00:00Z'));
    await testApp.app.get(BriefsService).runDue(project.id);
    const again = (await qa.get('/today').expect(200)).body.data;
    expect(again.brief.narrative).toBe('Yesterday the backend changed.');
    const refused = await qa
      .put(`/briefs/morning/${today.date}/narrative`, {
        narrative: 'token=ghp_0123456789abcdefghijklmnopqrstuvwxyz01',
      })
      .expect(422);
    expect(refused.body.error.code).toBe('hub.security.secret_detected');
  });

  it('the morning job stores a brief per member at the time, once, with an inbox item', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    await project.member(['qa']);
    const briefs = testApp.app.get(BriefsService);
    // 07:30 in Istanbul is 04:30 UTC.
    testApp.clock.set(new Date('2026-11-05T04:00:00Z'));
    expect((await briefs.runDue(project.id)).morning).toBe(0);
    testApp.clock.set(new Date('2026-11-05T04:31:00Z'));
    expect((await briefs.runDue(project.id)).morning).toBe(2);
    expect((await briefs.runDue(project.id)).morning).toBe(0);
    const brief = (await pm.get('/briefs/today').expect(200)).body.data;
    expect(brief.generatedNow).toBe(false);
    expect(brief.date).toBe('2026-11-05');
    expect(await db().notification.count({ where: { workspaceId: project.id, kind: 'brief' } })).toBe(2);
  });

  it('the weekly summary is stored on its day, once, and shows on Today', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const briefs = testApp.app.get(BriefsService);
    testApp.clock.set(new Date('2026-11-03T09:00:00Z'));
    const decision = await created(pm, aDecision('pm'));
    const full = (await pm.get(`/cards/${decision.key}`).expect(200)).body.data;
    await pm
      .post(`/decisions/${decision.key}/decide`, { optionId: full.detail.options[0].id, rationale: 'Agreed' })
      .expect(200);
    await created(pm, aHandoff('qa'));

    testApp.clock.set(new Date('2026-11-07T09:00:00Z'));
    expect((await briefs.runDue(project.id)).weekly).toBe(false);
    testApp.clock.set(new Date('2026-11-08T05:01:00Z'));
    expect((await briefs.runDue(project.id)).weekly).toBe(true);
    expect((await briefs.runDue(project.id)).weekly).toBe(false);

    const today = (await qa.get('/today').expect(200)).body.data;
    expect(today.weekly).toMatchObject({ kind: 'weekly', date: '2026-W45' });
    expect(today.weekly.sections.decided[0].key).toBe(decision.key);
    expect(today.weekly.sections.handoffs.created).toBe(1);
    await qa.put('/briefs/weekly/2026-W45/narrative', { narrative: 'A good week' }).expect(403);
    await pm.put('/briefs/weekly/2026-W45/narrative', { narrative: 'A good week' }).expect(200);
    const read = (await qa.get('/briefs/weekly/2026-W45').expect(200)).body.data;
    expect(read.narrative).toBe('A good week');
    await qa.get('/briefs/weekly/nope').expect(404);
  });

  it('timeline summary counts a day and a week', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    testApp.clock.set(new Date('2026-11-04T09:00:00Z'));
    await created(pm, aNeed('pm'));
    const { body } = await pm.get('/timeline/summary', { period: 'day', date: '2026-11-04' }).expect(200);
    expect(body.data).toMatchObject({
      from: '2026-11-04',
      to: '2026-11-04',
      byType: { need: 1 },
      byKind: { created: 1 },
    });
    expect(body.data.newNeeds).toHaveLength(1);
    expect(body.data.topActors[0].user.userId).toBe(pm.id);
    const week = await pm.get('/timeline/summary', { period: 'week', date: '2026-11-08' }).expect(200);
    expect(week.body.data).toMatchObject({ from: '2026-11-02', to: '2026-11-08', byKind: { created: 1 } });
    const other = await pm.get('/timeline/summary', { period: 'day', date: '2026-11-05' }).expect(200);
    expect(other.body.data.byKind).toEqual({});
  });
});
