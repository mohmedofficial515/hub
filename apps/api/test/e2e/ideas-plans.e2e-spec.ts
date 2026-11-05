/**
 * @file Idea and Plan (D29, docs/15 §4): statuses, revisions with restore, "turn into a plan", "create tasks from
 * steps", and a step following its task.
 */
import type { INestApplication } from '@nestjs/common';

import { aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

const anIdea = (overrides: object = {}) => ({
  type: 'idea',
  title: 'Faster refunds',
  detail: { problem: 'Refunds are slow', notes: 'Maybe a queue' },
  ...overrides,
});

const aPlan = (overrides: object = {}) => ({
  type: 'plan',
  title: 'Refund plan',
  body: 'First draft',
  detail: {
    steps: [
      { title: 'Backend queue', role: 'backend' },
      { title: 'Wallet page', role: 'frontend' },
    ],
  },
  ...overrides,
});

describe('ideas', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('runs open, exploring, parked, reopened, rejected, reopened, accepted', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const idea = await created(qa, anIdea());
    const move = async (verb: string, body?: object) =>
      (await qa.post(`/ideas/${idea.key}/${verb}`, body).expect(200)).body.data.status as string;

    expect(await move('explore')).toBe('exploring');
    expect(await move('park', { reason: 'later' })).toBe('parked');
    expect(await move('reopen')).toBe('open');
    expect(await move('reject', { reason: 'no' })).toBe('rejected');
    expect(await move('reopen')).toBe('open');
    expect(await move('accept')).toBe('accepted');
    await qa.post(`/ideas/${idea.key}/explore`).expect(409);
  });

  it('the creator or a manager moves it, and any member creates one', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const other = await project.member(['backend']);
    const pm = await project.member(['pm']);
    const idea = await created(creator, anIdea());
    for (const verb of ['explore', 'accept', 'park', 'reject', 'reopen', 'to-plan']) {
      await other.post(`/ideas/${idea.key}/${verb}`).expect(403);
    }
    await pm.post(`/ideas/${idea.key}/explore`).expect(200);
  });

  it('edits header and detail in one event; the role routes it; nothing changed is no event', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const idea = await created(qa, anIdea({ detail: { role: 'qa' } }));
    expect((await qa.get(`/cards/${idea.key}`).expect(200)).body.data.ownerRole).toBe('qa');

    const { body } = await qa
      .patch(`/ideas/${idea.key}`, { title: 'Better', notes: 'New note', role: 'backend' })
      .expect(200);
    expect(body.data).toMatchObject({
      title: 'Better',
      ownerRole: 'backend',
      detail: { notes: 'New note', role: 'backend' },
    });
    await qa.patch(`/ideas/${idea.key}`, { title: 'Better' }).expect(200);
    expect((await eventsOf(idea.id)).map((event) => event.kind)).toEqual(['created', 'field_changed']);
    await qa.patch(`/ideas/${idea.key}`, { notes: `ghp_${'a1B2'.repeat(9)}` }).expect(422);
  });

  it('turn into a plan: a linked plan carrying the idea’s text, and the idea accepted', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const idea = await created(qa, anIdea({ priority: 'P1', tags: ['wallet'] }));

    const { body } = await qa.post(`/ideas/${idea.key}/to-plan`).expect(200);
    expect(body.data).toMatchObject({ status: 'accepted', event: { kind: 'idea_to_plan' } });
    const planId = body.data.detail.planCardId as string;
    const plan = await db().card.findUniqueOrThrow({ where: { id: planId }, include: { plan: true } });
    expect(plan).toMatchObject({
      type: 'plan',
      status: 'draft',
      title: 'Faster refunds',
      priority: 'P1',
      tags: ['wallet'],
      body: 'Refunds are slow\n\nMaybe a queue',
      plan: { sourceIdeaId: idea.id },
    });
    expect(body.data.links).toMatchObject([{ kind: 'relates', card: { key: plan.key } }]);
    expect((await eventsOf(idea.id)).at(-1)).toMatchObject({
      kind: 'idea_to_plan',
      data: { planKey: plan.key, from: 'open', to: 'accepted' },
    });
    await expect(eventsOf(planId)).resolves.toHaveLength(1);

    await qa.post(`/ideas/${idea.key}/to-plan`).expect(409);
  });

  it('turn into a plan takes a title and body, and refuses a secret with nothing written', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const idea = await created(qa, anIdea());
    await qa.post(`/ideas/${idea.key}/to-plan`, { body: `ghp_${'a1B2'.repeat(9)}` }).expect(422);
    await expect(db().card.count({ where: { workspaceId: project.id } })).resolves.toBe(1);
    const { body } = await qa.post(`/ideas/${idea.key}/to-plan`, { title: 'T', body: 'B' }).expect(200);
    const plan = await db().card.findUniqueOrThrow({ where: { id: body.data.detail.planCardId as string } });
    expect(plan).toMatchObject({ title: 'T', body: 'B' });
  });

  it('lists by status', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const idea = await created(qa, anIdea());
    expect((await qa.get('/ideas').expect(200)).body.data).toMatchObject([
      { key: idea.key, detail: { problem: 'Refunds are slow' } },
    ]);
    expect((await qa.get('/ideas', { status: 'parked' }).expect(200)).body.data).toEqual([]);
    expect((await qa.get('/ideas', { q: 'faster' }).expect(200)).body.data).toHaveLength(1);
  });
});

describe('plans', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('a plan body takes 100 000 characters and steps get ids', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const { body } = await pm.post('/cards', aPlan()).expect(201);
    expect(body.data).toMatchObject({
      status: 'draft',
      detail: {
        revision: 1,
        steps: [
          { id: 's1', title: 'Backend queue', role: 'backend', done: false },
          { id: 's2', title: 'Wallet page', role: 'frontend', done: false },
        ],
      },
    });
    const long = await pm
      .patch(`/plans/${body.data.key as string}`, { body: 'x'.repeat(100_000) })
      .expect(200);
    expect(long.body.data.detail.revision).toBe(2);
    await pm.patch(`/plans/${body.data.key as string}`, { body: 'x'.repeat(100_001) }).expect(400);
  });

  it('runs draft, review, approved, in progress, done; abandoned from any', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const pm = await project.member(['pm']);
    const plan = await created(creator, aPlan({ detail: {} }));

    expect((await creator.post(`/plans/${plan.key}/submit-review`).expect(200)).body.data.status).toBe(
      'in_review',
    );
    await creator.post(`/plans/${plan.key}/approve`).expect(403);
    const approved = await pm.post(`/plans/${plan.key}/approve`).expect(200);
    expect(approved.body.data).toMatchObject({ status: 'approved', detail: { approvedBy: { id: pm.id } } });
    expect((await creator.post(`/plans/${plan.key}/start`).expect(200)).body.data.status).toBe('in_progress');
    expect((await creator.post(`/plans/${plan.key}/finish`).expect(200)).body.data.status).toBe('done');
    const abandoned = await creator.post(`/plans/${plan.key}/abandon`, { reason: 'no' }).expect(200);
    expect(abandoned.body.data.status).toBe('abandoned');
    await creator.post(`/plans/${plan.key}/abandon`).expect(409);

    const draft = await created(creator, aPlan({ detail: {} }));
    await creator.post(`/plans/${draft.key}/start`).expect(409);
  });

  it('a stranger cannot edit or move it', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const other = await project.member(['backend']);
    const plan = await created(creator, aPlan());
    await other.patch(`/plans/${plan.key}`, { body: 'x' }).expect(403);
    for (const verb of ['submit-review', 'start', 'finish', 'abandon', 'to-tasks']) {
      await other.post(`/plans/${plan.key}/${verb}`).expect(403);
    }
    await other.post(`/plans/${plan.key}/restore`, { revision: 1 }).expect(403);
  });

  it('plan_revised keeps the previous text, and a revision comes back as a new one', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());

    await pm.patch(`/plans/${plan.key}`, { body: 'Second draft' }).expect(200);
    await pm.patch(`/plans/${plan.key}`, { body: 'Third draft' }).expect(200);
    await pm.patch(`/plans/${plan.key}`, { body: 'Third draft' }).expect(200);

    const events = await eventsOf(plan.id);
    expect(events.map((event) => event.kind)).toEqual(['created', 'plan_revised', 'plan_revised']);
    expect(events[1]?.data).toMatchObject({ revision: 2, previousBody: 'First draft' });
    expect(events[2]?.data).toMatchObject({ revision: 3, previousBody: 'Second draft' });

    const revisions = await pm.get(`/plans/${plan.key}/revisions`).expect(200);
    expect(revisions.body.data).toMatchObject([
      { revision: 3, body: 'Third draft', current: true },
      { revision: 2, body: 'Second draft', current: false, actor: { userId: pm.id } },
      { revision: 1, body: 'First draft', current: false },
    ]);

    const restored = await pm.post(`/plans/${plan.key}/restore`, { revision: 1 }).expect(200);
    expect(restored.body.data).toMatchObject({ body: 'First draft', detail: { revision: 4 } });
    expect((await eventsOf(plan.id)).at(-1)?.data).toMatchObject({
      revision: 4,
      previousBody: 'Third draft',
      restoredFrom: 1,
    });

    const missing = await pm.post(`/plans/${plan.key}/restore`, { revision: 99 }).expect(404);
    expect(missing.body.error.code).toBe('hub.plans.revision_not_found');
  });

  it('a body edited through the generic route still keeps its revision', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const { body } = await pm.patch(`/cards/${plan.key}`, { body: 'Via cards' }).expect(200);
    expect(body.data.detail.revision).toBe(2);
    expect((await eventsOf(plan.id)).at(-1)).toMatchObject({
      kind: 'plan_revised',
      data: { revision: 2, previousBody: 'First draft' },
    });
    expect(body.data.event.kind).toBe('plan_revised');
  });

  it('steps alone are plan_steps_changed; title alone is field_changed', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const { body } = await pm
      .patch(`/plans/${plan.key}`, { steps: [{ id: 's2', title: 'Wallet first' }, { title: 'New step' }] })
      .expect(200);
    expect(body.data.detail.steps).toMatchObject([
      { id: 's2', title: 'Wallet first' },
      { id: 's3', title: 'New step' },
    ]);
    expect(body.data.event.kind).toBe('plan_steps_changed');
    const titled = await pm.patch(`/plans/${plan.key}`, { title: 'Renamed' }).expect(200);
    expect(titled.body.data.event.kind).toBe('field_changed');
  });

  it('create tasks from steps: one per step, parented, keys written back, plan in progress', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const frontend = await project.member(['frontend']);
    const plan = await created(pm, aPlan({ priority: 'P1' }));

    const { body } = await pm.post(`/plans/${plan.key}/to-tasks`).expect(200);
    expect(body.data).toMatchObject({ status: 'in_progress', event: { kind: 'plan_to_tasks' } });
    const steps = body.data.detail.steps as { taskKey: string; done: boolean }[];
    expect(steps.every((step) => step.taskKey && step.done === false)).toBe(true);

    const [event] = (await eventsOf(plan.id)).slice(-1);
    expect(event).toMatchObject({
      kind: 'plan_to_tasks',
      data: { from: 'draft', to: 'in_progress', taskKeys: steps.map((step) => step.taskKey) },
    });

    const [backendStep, frontendStep] = steps;
    const task = (await frontend.get(`/cards/${frontendStep?.taskKey as string}`).expect(200)).body.data;
    expect(task).toMatchObject({
      type: 'task',
      title: 'Wallet page',
      status: 'ready',
      priority: 'P1',
      ownerRole: 'frontend',
      detail: { origin: 'plan', specialty: 'frontend' },
      links: [{ kind: 'parent', card: { key: plan.key } }],
    });
    expect(task.detail.prompt).toContain(plan.key);
    const inPlan = (await pm.get(`/cards/${plan.key}`).expect(200)).body.data;
    expect(inPlan.links.map((link: { kind: string }) => link.kind)).toEqual(['child', 'child']);
    expect(backendStep?.taskKey).not.toBe(frontendStep?.taskKey);
    const rows = await db().notification.findMany({ where: { workspaceId: project.id, kind: 'task_ready' } });
    expect(rows.map((row) => row.userId)).toContain(frontend.id);

    // Only steps without a task, and nothing when none is left.
    await pm.post(`/plans/${plan.key}/to-tasks`).expect(200);
    const after = await db().card.count({ where: { workspaceId: project.id, type: 'task' } });
    expect(after).toBe(2);
    const added = await pm.patch(`/plans/${plan.key}`, { steps: [...steps, { title: 'Third' }] }).expect(200);
    expect(added.body.data.actions.map((action: { action: string }) => action.action)).toContain('to_tasks');
    await pm.post(`/plans/${plan.key}/to-tasks`, { defaultSpecialty: 'docs' }).expect(200);
    await expect(db().card.count({ where: { workspaceId: project.id, type: 'task' } })).resolves.toBe(3);
  });

  it('a step is done when its task completes, undone when it reopens, and done is then offered', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const { body } = await pm.post(`/plans/${plan.key}/to-tasks`).expect(200);
    const [first, second] = body.data.detail.steps as { taskKey: string }[];
    const stepsNow = async () =>
      (await pm.get(`/cards/${plan.key}`).expect(200)).body.data as {
        detail: { steps: { done: boolean }[] };
        actions: { action: string }[];
      };

    await pm.post(`/tasks/${first?.taskKey as string}/claim`).expect(200);
    await pm.post(`/tasks/${first?.taskKey as string}/done`).expect(200);
    let plan1 = await stepsNow();
    expect(plan1.detail.steps.map((step) => step.done)).toEqual([true, false]);
    expect(plan1.actions.map((action) => action.action)).not.toContain('finish');
    expect((await eventsOf(plan.id)).at(-1)?.kind).toBe('plan_steps_changed');

    await pm.post(`/tasks/${first?.taskKey as string}/reopen`).expect(200);
    plan1 = await stepsNow();
    expect(plan1.detail.steps.map((step) => step.done)).toEqual([false, false]);

    for (const step of [first, second]) {
      await pm.post(`/tasks/${step?.taskKey as string}/claim`).expect(200);
      await pm.post(`/tasks/${step?.taskKey as string}/done`).expect(200);
    }
    plan1 = await stepsNow();
    expect(plan1.detail.steps.map((step) => step.done)).toEqual([true, true]);
    expect(plan1.actions[0]?.action).toBe('finish');
  });

  it('a client cannot mark a task’s step done by hand, but can a step with no task', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const manual = await pm
      .patch(`/plans/${plan.key}`, { steps: [{ id: 's1', title: 'Backend queue', done: true }] })
      .expect(200);
    expect(manual.body.data.detail.steps[0].done).toBe(true);

    const other = await created(pm, aPlan());
    const { body } = await pm.post(`/plans/${other.key}/to-tasks`).expect(200);
    const steps = body.data.detail.steps as { id: string; title: string; taskKey: string }[];
    const edited = await pm
      .patch(`/plans/${other.key}`, {
        steps: steps.map((step) => ({ id: step.id, title: step.title, done: true })),
      })
      .expect(200);
    expect(edited.body.data.detail.steps.map((s: { done: boolean; taskKey: string }) => s.done)).toEqual([
      false,
      false,
    ]);
    expect(edited.body.data.detail.steps[0].taskKey).toBe(steps[0]?.taskKey);
  });

  it('a task linked to a plan by hand with no step leaves the plan alone', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const task = await created(pm, aTask({ links: [{ kind: 'parent', key: plan.key }] }));
    const before = (await eventsOf(plan.id)).length;
    await pm.post(`/tasks/${task.key}/claim`).expect(200);
    await pm.post(`/tasks/${task.key}/done`).expect(200);
    await expect(eventsOf(plan.id)).resolves.toHaveLength(before);
  });

  it('a deleted plan does not stop its task completing', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const plan = await created(pm, aPlan());
    const { body } = await pm.post(`/plans/${plan.key}/to-tasks`).expect(200);
    await pm.post(`/cards/${plan.key}/delete`).expect(200);
    const key = (body.data.detail.steps as { taskKey: string }[])[0]?.taskKey as string;
    await pm.post(`/tasks/${key}/claim`).expect(200);
    await pm.post(`/tasks/${key}/done`).expect(200);
  });

  it('a plan in review waits on owner and pm', async () => {
    const project = await aProject(app);
    const creator = await project.member(['qa']);
    const pm = await project.member(['pm']);
    const plan = await created(creator, aPlan());
    await creator.post(`/plans/${plan.key}/submit-review`).expect(200);
    const { body } = await pm.get('/cards', { awaiting: 'me' }).expect(200);
    expect(body.data).toMatchObject([{ key: plan.key, awaiting: 'approve' }]);
  });

  it('lists with step counts in the detail', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const plan = await created(qa, aPlan());
    const { body } = await qa.get('/plans').expect(200);
    expect(body.data).toMatchObject([{ key: plan.key, detail: { revision: 1 } }]);
    expect(body.data[0].detail.steps).toHaveLength(2);
    expect((await qa.get('/plans', { status: 'done' }).expect(200)).body.data).toEqual([]);
    expect((await qa.get('/plans', { q: 'refund' }).expect(200)).body.data).toHaveLength(1);
    await qa.get(`/plans/${plan.key}/revisions`).expect(200);
    const task = await created(qa, aTask());
    await qa.get(`/plans/${task.key}/revisions`).expect(409);
  });
});
