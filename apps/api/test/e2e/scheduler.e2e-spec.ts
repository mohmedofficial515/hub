/**
 * @file The deadline engine with a fake clock (docs/07 §8, H3-05 acceptance).
 */
import { SchedulerService } from '@/modules/scheduler';

import { aDecision, aHandoff, aNeed, aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { closeTestApps, createTestApp, type TestApp } from '../setup/create-test-app';

const HOUR = 3_600_000;

describe('scheduler tick', () => {
  let testApp: TestApp;
  let scheduler: SchedulerService;

  beforeAll(async () => {
    testApp = await createTestApp();
    scheduler = testApp.app.get(SchedulerService);
  });

  afterAll(async () => {
    await closeTestApps();
  });

  const count = (cardId: string, kind: string) =>
    eventsOf(cardId).then((rows) => rows.filter((row) => row.kind === kind).length);

  it('a decision due in 30 h gets 24 h and 2 h exactly once, goes overdue, and escalates once', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const dueAt = new Date(testApp.clock.now().getTime() + 30 * HOUR).toISOString();
    const decision = await created(pm, aDecision('accountant', { dueAt }));
    const inbox = async () =>
      (
        await db().notification.findMany({
          where: { userId: accountant.id, kind: { in: ['deadline_reminder', 'escalation'] } },
        })
      ).length;

    await scheduler.tick(project.id);
    expect(await count(decision.id, 'reminder_sent')).toBe(0);

    testApp.clock.advance(6 * HOUR);
    expect((await scheduler.tick(project.id)).reminders).toBe(1);
    expect((await scheduler.tick(project.id)).reminders).toBe(0);
    expect(await inbox()).toBe(1);

    testApp.clock.advance(22 * HOUR);
    expect((await scheduler.tick(project.id)).reminders).toBe(1);
    expect((await scheduler.tick(project.id)).reminders).toBe(0);
    expect(await inbox()).toBe(2);

    testApp.clock.advance(3 * HOUR);
    expect((await scheduler.tick(project.id)).reminders).toBe(1);
    expect((await scheduler.tick(project.id)).escalations).toBe(0);
    const { body: overdue } = await accountant.get(`/cards/${decision.key}`).expect(200);
    expect(overdue.data.flags.overdue).toBe(true);

    testApp.clock.advance(24 * HOUR);
    const { escalations } = await scheduler.tick(project.id);
    expect(escalations).toBe(1);
    expect((await scheduler.tick(project.id)).escalations).toBe(0);
    expect(await count(decision.id, 'escalated')).toBe(1);

    const { body } = await pm.get(`/cards/${decision.key}`).expect(200);
    expect(body.data.detail).toMatchObject({ escalatedToRole: 'pm', remindersSent: [24, 2, 0] });
    expect(body.data.flags.escalated).toBe(true);
    // pm created it, so the system still told them: the actor of an escalation is nobody.
    const told = await db().notification.findMany({ where: { userId: pm.id, kind: 'escalation' } });
    expect(told).toHaveLength(1);
    // After escalation the pm may decide (docs/07 §5.2).
    await pm
      .post(`/decisions/${decision.key}/decide`, {
        optionId: body.data.detail.options[0].id,
        rationale: 'Late, so I took it',
      })
      .expect(200);
    testApp.clock.advance(HOUR);
    expect(await scheduler.tick(project.id)).toMatchObject({ reminders: 0, escalations: 0 });
  });

  it('a stale handoff is reminded every 24 h, and stops once acknowledged', async () => {
    const project = await aProject(testApp.app);
    const backend = await project.member(['backend']);
    const frontend = await project.member(['frontend']);
    const handoff = await created(backend, aHandoff('frontend'));

    testApp.clock.advance(47 * HOUR);
    expect((await scheduler.tick(project.id)).staleHandoffs).toBe(0);
    testApp.clock.advance(2 * HOUR);
    expect((await scheduler.tick(project.id)).staleHandoffs).toBe(1);
    expect((await scheduler.tick(project.id)).staleHandoffs).toBe(0);
    testApp.clock.advance(25 * HOUR);
    expect((await scheduler.tick(project.id)).staleHandoffs).toBe(1);
    const rows = await db().notification.findMany({
      where: { userId: frontend.id, kind: 'deadline_reminder' },
    });
    expect(rows).toHaveLength(2);

    await frontend.post(`/handoffs/${handoff.key}/acknowledge`, {}).expect(200);
    testApp.clock.advance(25 * HOUR);
    expect((await scheduler.tick(project.id)).staleHandoffs).toBe(0);
  });

  it('a stale need is reminded every 48 h, to the responsible role and the requester', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    await created(pm, aNeed('accountant'));
    testApp.clock.advance(5 * 24 * HOUR + HOUR);
    expect((await scheduler.tick(project.id)).staleNeeds).toBe(1);
    testApp.clock.advance(47 * HOUR);
    expect((await scheduler.tick(project.id)).staleNeeds).toBe(0);
    testApp.clock.advance(2 * HOUR);
    expect((await scheduler.tick(project.id)).staleNeeds).toBe(1);
    expect(
      await db().notification.count({ where: { userId: accountant.id, kind: 'deadline_reminder' } }),
    ).toBe(2);
    expect(await db().notification.count({ where: { userId: pm.id, kind: 'deadline_reminder' } })).toBe(2);
  });

  it('asks about a claim left alone for 14 days, once per 14 days', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const backend = await project.member(['backend']);
    const task = await created(pm, aTask());
    await backend.post(`/tasks/${task.key}/claim`).expect(200);
    testApp.clock.advance(13 * 24 * HOUR);
    expect((await scheduler.tick(project.id)).orphanedClaims).toBe(0);
    testApp.clock.advance(2 * 24 * HOUR);
    expect((await scheduler.tick(project.id)).orphanedClaims).toBe(1);
    expect((await scheduler.tick(project.id)).orphanedClaims).toBe(0);
    testApp.clock.advance(15 * 24 * HOUR);
    expect((await scheduler.tick(project.id)).orphanedClaims).toBe(1);
  });

  it('leaves a deleted card alone', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const dueAt = new Date(testApp.clock.now().getTime() + HOUR).toISOString();
    const decision = await created(pm, aDecision('owner', { dueAt }));
    await pm.post(`/cards/${decision.key}/delete`).expect(200);
    testApp.clock.advance(2 * HOUR);
    expect(await scheduler.tick(project.id)).toMatchObject({ reminders: 0, escalations: 0 });
  });
});
