/**
 * @file H0-06: every task action, through its route (docs/04 §3.10).
 */
import type { INestApplication } from '@nestjs/common';

import { aDecision, aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

describe('tasks', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('lists tasks with their detail and the keys blocking each', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const task = await created(pm, aTask({ title: 'Listed' }));
    const blocker = await created(pm, aDecision());
    await pm.post(`/cards/${blocker.key}/links`, { kind: 'blocks', key: task.key }).expect(201);

    const page = await pm.get('/tasks').expect(200);
    expect(page.body.data).toEqual([
      expect.objectContaining({
        key: task.key,
        detail: expect.objectContaining({ specialty: expect.any(String) }),
        blockedBy: [blocker.key],
      }),
    ]);
    const filtered = await pm.get('/tasks?status=done').expect(200);
    expect(filtered.body.data).toEqual([]);
  });

  it('runs the whole way: claim, start, submit, resume, submit, done, reopen, one event each', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const backend = await project.member(['backend']);
    const task = await created(pm, aTask({ title: 'Work' }));

    const claimed = await backend.post(`/tasks/${task.key}/claim`, { branch: 'feat/x' }).expect(200);
    expect(claimed.body.data).toMatchObject({
      status: 'claimed',
      branch: 'feat/x',
      assignee: { id: backend.id },
      event: { kind: 'claimed' },
      detail: { branch: 'feat/x', claimedBy: { id: backend.id } },
    });
    const started = await backend.post(`/tasks/${task.key}/start`).expect(200);
    expect(started.body.data.status).toBe('in_progress');
    expect(started.body.data.detail.startedAt).not.toBeNull();

    const submitted = await backend
      .post(`/tasks/${task.key}/submit-review`, { prUrl: 'https://example.test/pr/1', note: 'look' })
      .expect(200);
    expect(submitted.body.data).toMatchObject({
      status: 'in_review',
      detail: { prUrl: 'https://example.test/pr/1' },
    });
    await backend.post(`/tasks/${task.key}/resume`, { reason: 'one more' }).expect(200);
    await backend.post(`/tasks/${task.key}/submit-review`).expect(200);

    const done = await backend.post(`/tasks/${task.key}/done`, { note: 'shipped' }).expect(200);
    expect(done.body.data.status).toBe('done');
    expect(done.body.data.closedAt).not.toBeNull();
    expect(done.body.data.detail.doneAt).not.toBeNull();

    const reopened = await pm.post(`/tasks/${task.key}/reopen`, { reason: 'bug' }).expect(200);
    expect(reopened.body.data).toMatchObject({ status: 'ready', closedAt: null, assignee: null });

    const events = await eventsOf(task.id);
    expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1));
    expect(events.map((event) => event.kind)).toEqual([
      'created',
      'claimed',
      'status_changed',
      'status_changed',
      'status_changed',
      'status_changed',
      'status_changed',
      'status_changed',
    ]);
    expect(events[1]?.data).toMatchObject({
      from: 'ready',
      to: 'claimed',
      userId: backend.id,
      branch: 'feat/x',
    });
    await expect(db().auditLog.count({ where: { targetId: task.key } })).resolves.toBe(events.length);
  });

  describe('claim', () => {
    it('refuses outside the specialty, with its code', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const designer = await project.member(['designer']);
      const task = await created(pm, aTask());
      const { body } = await designer.post(`/tasks/${task.key}/claim`).expect(403);
      expect(body.error.code).toBe('hub.tasks.specialty_role_mismatch');
    });

    it('a role with no claim at all gets the same code, not a generic refusal', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const accountant = await project.member(['accountant']);
      const task = await created(pm, aTask());
      const { body } = await accountant.post(`/tasks/${task.key}/claim`).expect(403);
      expect(body.error.code).toBe('hub.tasks.specialty_role_mismatch');
    });

    it('another’s claim answers already_claimed, naming them; claiming again is a no-op', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await project.member(['backend']);
      const b = await project.member(['backend']);
      const task = await created(pm, aTask());
      await a.post(`/tasks/${task.key}/claim`).expect(200);

      const again = await a.post(`/tasks/${task.key}/claim`).expect(200);
      expect(again.body.data.status).toBe('claimed');
      await expect(eventsOf(task.id)).resolves.toHaveLength(2);

      const refused = await b.post(`/tasks/${task.key}/claim`).expect(409);
      expect(refused.body.error).toMatchObject({
        code: 'hub.tasks.already_claimed',
        details: { claimedBy: a.id },
      });
    });

    it('a blocked task cannot be claimed until its blocker closes, and then says so', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm', 'backend']);
      const decision = await created(pm, aDecision('pm'));
      const task = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: decision.key }] }));

      const refused = await pm.post(`/tasks/${task.key}/claim`).expect(409);
      expect(refused.body.error.code).toBe('hub.tasks.blocked');
      const card = (await pm.get(`/cards/${task.key}`).expect(200)).body.data;
      expect(card.actions[0]).toMatchObject({ action: 'claim', enabled: false });

      await pm.post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'r' }).expect(200);
      await pm.post(`/tasks/${task.key}/claim`).expect(200);
    });

    it('a task in backlog can be claimed, a done one cannot', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask({ detail: { specialty: 'qa' } }));
      await pm.post(`/tasks/${task.key}/claim`).expect(200);
      await pm.post(`/tasks/${task.key}/done`).expect(200);
      const { body } = await pm.post(`/tasks/${task.key}/claim`).expect(409);
      expect(body.error.code).toBe('hub.cards.invalid_transition');
    });
  });

  it('unclaim: the claimer or a manager, not a colleague of the same specialty', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const a = await project.member(['backend']);
    const b = await project.member(['backend']);
    const task = await created(pm, aTask());
    await a.post(`/tasks/${task.key}/claim`).expect(200);

    const refused = await b.post(`/tasks/${task.key}/unclaim`).expect(403);
    expect(refused.body.error.code).toBe('hub.tasks.not_claimer');
    const back = await a.post(`/tasks/${task.key}/unclaim`).expect(200);
    expect(back.body.data).toMatchObject({ status: 'ready', assignee: null, event: { kind: 'unclaimed' } });
    expect(back.body.data.detail.claimedBy).toBeNull();

    await b.post(`/tasks/${task.key}/claim`).expect(200);
    await pm.post(`/tasks/${task.key}/unclaim`).expect(200);
  });

  it('start, submit and done are the assignee’s or a manager’s', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const a = await project.member(['backend']);
    const b = await project.member(['backend']);
    const task = await created(pm, aTask());
    await a.post(`/tasks/${task.key}/claim`).expect(200);

    const refused = await b.post(`/tasks/${task.key}/start`).expect(403);
    expect(refused.body.error.code).toBe('hub.tasks.not_claimer');
    await b.post(`/tasks/${task.key}/done`).expect(403);
    await pm.post(`/tasks/${task.key}/start`).expect(200);
    await b.post(`/tasks/${task.key}/submit-review`).expect(403);
    await a.post(`/tasks/${task.key}/submit-review`).expect(200);
  });

  it('qa completes and resumes a task in review, not one in progress', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const backend = await project.member(['backend']);
    const qa = await project.member(['qa']);
    const task = await created(pm, aTask());
    await backend.post(`/tasks/${task.key}/claim`).expect(200);
    await qa.post(`/tasks/${task.key}/done`).expect(403);
    await backend.post(`/tasks/${task.key}/start`).expect(200);
    await backend.post(`/tasks/${task.key}/submit-review`).expect(200);

    const asQa = (await qa.get(`/cards/${task.key}`).expect(200)).body.data;
    expect(asQa.awaitedAction).toMatchObject({
      action: 'complete',
      permission: 'task.review',
      enabled: true,
    });
    await qa.post(`/tasks/${task.key}/resume`, { reason: 'fails' }).expect(200);
    await backend.post(`/tasks/${task.key}/submit-review`).expect(200);
    await qa.post(`/tasks/${task.key}/done`).expect(200);
  });

  it('submitting tells qa', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const task = await created(pm, aTask());
    await pm.post(`/tasks/${task.key}/claim`).expect(200);
    await pm.post(`/tasks/${task.key}/start`).expect(200);
    await pm.post(`/tasks/${task.key}/submit-review`).expect(200);
    const rows = await db().notification.findMany({
      where: { workspaceId: project.id, kind: 'review_requested' },
    });
    expect(rows).toMatchObject([{ userId: qa.id }]);
  });

  it('cancel needs a reason and the creator or a manager', async () => {
    const project = await aProject(app);
    const creator = await project.member(['backend']);
    const other = await project.member(['backend']);
    const task = await created(creator, aTask());
    await creator.post(`/tasks/${task.key}/cancel`).expect(400);
    await other.post(`/tasks/${task.key}/cancel`, { reason: 'no' }).expect(403);
    const { body } = await creator.post(`/tasks/${task.key}/cancel`, { reason: 'dup' }).expect(200);
    expect(body.data.status).toBe('cancelled');
    expect((await eventsOf(task.id)).at(-1)?.data).toMatchObject({ reason: 'dup' });
  });

  it('mark ready notifies the role, mark backlog does not', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const task = await created(pm, aTask({ detail: { specialty: 'qa' } }));
    expect((await pm.post(`/tasks/${task.key}/mark-ready`).expect(200)).body.data.status).toBe('ready');
    expect((await pm.post(`/tasks/${task.key}/mark-backlog`).expect(200)).body.data.status).toBe('backlog');
    const rows = await db().notification.findMany({ where: { workspaceId: project.id, kind: 'task_ready' } });
    expect(rows).toMatchObject([{ userId: qa.id }]);
  });

  it('edit detail: one event, secret filtered, specialty role only', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const designer = await project.member(['designer']);
    const task = await created(pm, aTask());
    await designer.patch(`/tasks/${task.key}`, { effort: 'L' }).expect(403);
    const { body } = await pm
      .patch(`/tasks/${task.key}`, { effort: 'L', branch: 'feat/y', prompt: 'New' })
      .expect(200);
    expect(body.data).toMatchObject({ branch: 'feat/y', detail: { effort: 'L', prompt: 'New' } });
    expect((await eventsOf(task.id)).at(-1)?.kind).toBe('field_changed');
    await pm.patch(`/tasks/${task.key}`, { prompt: `ghp_${'a1B2'.repeat(9)}` }).expect(422);
    await pm.patch(`/tasks/${task.key}`, { effort: 'L' }).expect(200);
    await expect(eventsOf(task.id)).resolves.toHaveLength(2);
  });

  it('an action of another type answers type_mismatch', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const decision = await created(pm, aDecision('pm'));
    const { body } = await pm.post(`/tasks/${decision.key}/claim`).expect(409);
    expect(body.error.code).toBe('hub.cards.type_mismatch');
  });

  describe('lists', () => {
    it('ready: unblocked, my specialties, urgent first, capped by the setting', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const backend = await project.member(['backend']);
      const low = await created(pm, aTask({ title: 'Low', priority: 'P3' }));
      const high = await created(pm, aTask({ title: 'High', priority: 'P0' }));
      await created(pm, aTask({ title: 'Design', detail: { specialty: 'design', prompt: 'x' } }));
      await created(pm, aTask({ title: 'Backlog', detail: { specialty: 'backend' } }));
      await created(pm, aTask({ title: 'Blocked', links: [{ kind: 'blocked_by', key: low.key }] }));

      const { body } = await backend.get('/tasks/ready').expect(200);
      expect(body.data.map((card: { key: string }) => card.key)).toEqual([high.key, low.key]);
      expect(body.data[0].detail.specialty).toBe('backend');

      await db().workspaceSetting.create({
        data: { workspaceId: project.id, key: 'tasks.ready_limit_per_role', value: 1 },
      });
      expect((await backend.get('/tasks/ready').expect(200)).body.data).toHaveLength(1);
      const asked = await backend.get('/tasks/ready', { specialty: 'design' }).expect(200);
      expect(asked.body.data).toMatchObject([{ title: 'Design' }]);
    });

    it('mine: claimed, in review and blocked', async () => {
      const project = await aProject(app);
      const me = await project.member(['pm']);
      const claimed = await created(me, aTask({ title: 'Claimed' }));
      const review = await created(me, aTask({ title: 'Review' }));
      const blockedTask = await created(me, aTask({ title: 'Blocked' }));
      for (const task of [claimed, review, blockedTask])
        await me.post(`/tasks/${task.key}/claim`).expect(200);
      await me.post(`/tasks/${review.key}/start`).expect(200);
      await me.post(`/tasks/${review.key}/submit-review`).expect(200);
      const blocker = await created(me, aDecision('owner'));
      await me.post(`/cards/${blockedTask.key}/links`, { kind: 'blocked_by', key: blocker.key }).expect(201);

      const { body } = await me.get('/tasks/mine').expect(200);
      expect(body.data.claimed).toMatchObject([{ key: claimed.key }]);
      expect(body.data.inReview).toMatchObject([{ key: review.key }]);
      expect(body.data.blocked).toMatchObject([{ key: blockedTask.key }]);
    });

    it('prompt: renders what the task knows, with its decisions', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const decision = await created(pm, aDecision('pm', { title: 'Way' }));
      await pm
        .post(`/decisions/${decision.key}/decide`, { optionId: 'left', rationale: 'short' })
        .expect(200);
      const task = await created(
        pm,
        aTask({
          title: 'Build',
          links: [{ kind: 'relates', key: decision.key }],
          detail: { specialty: 'backend', prompt: 'Do the build', acceptance: '- passes', effort: 'M' },
        }),
      );
      const { body } = await pm.get(`/tasks/${task.key}/prompt`).expect(200);
      expect(body.data.markdown).toContain(`# ${task.key} — Build  [P2 · backend · M]`);
      expect(body.data.markdown).toContain('## Instructions\nDo the build');
      expect(body.data.markdown).toContain(`- ${decision.key} · Way → **Left** — short`);
      await pm.get(`/tasks/${decision.key}/prompt`).expect(409);
    });
  });
});
