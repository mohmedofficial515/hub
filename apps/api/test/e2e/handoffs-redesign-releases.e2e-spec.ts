/**
 * @file H0-06: every handoff, redesign, doc and release action (docs/04 §3.13 to §3.15, §3.20, D25).
 */
import type { MemberActor, SystemActor } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';

import { CardService } from '@/modules/cards';

import { aDecision, aHandoff, aNeed, aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp, type TestApp } from '../setup/create-test-app';

describe('handoffs', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
  });

  it('creates routed to the receiver, and tells them', async () => {
    const project = await aProject(app);
    const backend = await project.member(['backend']);
    const frontend = await project.member(['frontend']);
    const source = await created(backend, aTask());
    const { body } = await backend
      .post('/cards', {
        ...aHandoff('frontend'),
        detail: { ...aHandoff('frontend').detail, sourceKey: source.key },
      })
      .expect(201);
    expect(body.data).toMatchObject({
      status: 'pending',
      ownerRole: 'frontend',
      detail: { toRole: 'frontend', severity: 'breaking', sourceCardId: source.id },
    });
    const rows = await db().notification.findMany({
      where: { workspaceId: project.id, kind: 'routed_handoff' },
    });
    expect(rows).toMatchObject([{ userId: frontend.id }]);
    await backend
      .post('/cards', { ...aHandoff('qa'), detail: { ...aHandoff('qa').detail, sourceKey: 'ZZ-1' } })
      .expect(404);
  });

  it('D25: owner and pm acknowledge any, under their name; apply stays with the receiver', async () => {
    const project = await aProject(app);
    const backend = await project.member(['backend']);
    const pm = await project.member(['pm']);
    const owner = await project.member(['owner']);
    const qa = await project.member(['qa']);
    const frontend = await project.member(['frontend']);
    const handoff = await created(backend, aHandoff('frontend'));

    const wrong = await qa.post(`/handoffs/${handoff.key}/acknowledge`).expect(403);
    expect(wrong.body.error.code).toBe('hub.handoffs.not_recipient');
    const { body } = await pm.post(`/handoffs/${handoff.key}/acknowledge`, { note: 'seen' }).expect(200);
    expect(body.data).toMatchObject({
      status: 'acknowledged',
      event: { kind: 'acknowledged' },
      detail: { acknowledgedBy: { id: pm.id } },
    });
    const twice = await frontend.post(`/handoffs/${handoff.key}/acknowledge`).expect(409);
    expect(twice.body.error.code).toBe('hub.handoffs.already_acknowledged');

    await owner.post(`/handoffs/${handoff.key}/apply`).expect(403);
    await pm.post(`/handoffs/${handoff.key}/apply`).expect(403);
    const applied = await frontend.post(`/handoffs/${handoff.key}/apply`, { note: 'done' }).expect(200);
    expect(applied.body.data).toMatchObject({
      status: 'applied',
      event: { kind: 'applied' },
      detail: { appliedBy: { id: frontend.id }, appliedTaskId: null },
    });
    expect(applied.body.data.closedAt).not.toBeNull();
  });

  it('apply with createTask: a ready task with the prompt, assigned to who applied, linked', async () => {
    const project = await aProject(app);
    const backend = await project.member(['backend']);
    const frontend = await project.member(['frontend']);
    const handoff = await created(backend, aHandoff('frontend'));

    const { body } = await frontend
      .post(`/handoffs/${handoff.key}/apply`, { createTask: { title: 'Sync the client' } })
      .expect(200);
    const taskId = body.data.detail.appliedTaskId as string;
    const task = await db().card.findUniqueOrThrow({ where: { id: taskId }, include: { task: true } });
    expect(task).toMatchObject({
      title: 'Sync the client',
      status: 'ready',
      assigneeId: frontend.id,
      ownerRole: 'frontend',
      task: { origin: 'handoff', specialty: 'frontend', prompt: 'Run api:sync' },
    });
    expect(body.data.links).toMatchObject([{ kind: 'relates', card: { key: task.key } }]);
    expect((await eventsOf(handoff.id)).at(-1)).toMatchObject({
      kind: 'applied',
      data: { taskCardKey: task.key },
    });
    expect((await eventsOf(taskId)).map((event) => event.kind)).toEqual(['created']);
    expect((await frontend.get(`/cards/${task.key}`).expect(200)).body.data.watchers).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: frontend.id })]),
    );
  });

  it('apply with an existing task links it; a key of another type is refused', async () => {
    const project = await aProject(app);
    const frontend = await project.member(['frontend']);
    const handoff = await created(frontend, aHandoff('frontend'));
    const decision = await created(frontend, aDecision('owner'));
    const task = await created(frontend, aTask());
    await frontend.post(`/handoffs/${handoff.key}/apply`, { taskKey: decision.key }).expect(409);
    await frontend.post(`/handoffs/${handoff.key}/apply`, { taskKey: 'ZZ-1' }).expect(404);
    const { body } = await frontend.post(`/handoffs/${handoff.key}/apply`, { taskKey: task.key }).expect(200);
    expect(body.data.detail.appliedTaskId).toBe(task.id);
  });

  it('dismiss needs a reason and closes the card', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const handoff = await created(pm, aHandoff('frontend'));
    await pm.post(`/handoffs/${handoff.key}/dismiss`).expect(400);
    const { body } = await pm.post(`/handoffs/${handoff.key}/dismiss`, { reason: 'moot' }).expect(200);
    expect(body.data).toMatchObject({ status: 'dismissed', event: { kind: 'dismissed' } });
    await pm.post(`/handoffs/${handoff.key}/dismiss`, { reason: 'moot' }).expect(409);
  });

  it('lists breaking first, with pending hours, and filters', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const frontend = await project.member(['frontend']);
    const info = await created(pm, aHandoff('qa', { title: 'Info' }));
    await db().handoffDetail.update({ where: { cardId: info.id }, data: { severity: 'info' } });
    const breaking = await created(pm, aHandoff('frontend', { title: 'Breaking' }));
    testApp.clock.advance(3 * 3_600_000);

    const { body } = await pm.get('/handoffs').expect(200);
    expect(body.data.map((c: { key: string }) => c.key)).toEqual([breaking.key, info.key]);
    expect(body.data[0].pendingHours).toBe(3);
    expect((await frontend.get('/handoffs', { mine: 'true' }).expect(200)).body.data).toHaveLength(1);
    expect((await pm.get('/handoffs', { severity: 'info' }).expect(200)).body.data).toMatchObject([
      { key: info.key },
    ]);
    expect((await pm.get('/handoffs', { fromRole: 'pm' }).expect(200)).body.data).toEqual([]);
    expect((await pm.get('/handoffs', { toRole: 'qa' }).expect(200)).body.data).toHaveLength(1);
    expect((await pm.get('/handoffs', { stale: 'true' }).expect(200)).body.data).toEqual([]);
    testApp.clock.advance(46 * 3_600_000);
    expect((await pm.get('/handoffs', { stale: 'true' }).expect(200)).body.data).toHaveLength(2);
    expect((await pm.get('/handoffs', { status: 'applied' }).expect(200)).body.data).toEqual([]);
  });
});

describe('redesign', () => {
  let app: INestApplication;
  let service: CardService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    service = app.get(CardService);
  });

  const scanner = (workspaceId: string): SystemActor => ({
    kind: 'system',
    userId: null,
    via: 'adapter',
    workspaceId,
    roles: [],
  });

  async function aVersion(workspaceId: string, status?: string) {
    const { card } = await service.apply(scanner(workspaceId), null, 'redesign.create', {
      title: 'Wallet v2',
      externalKey: `lab:web/wallet/${String(Math.random())}`,
      ...(status ? { status } : {}),
      detail: {
        app: 'web',
        page: 'wallet',
        version: 'v2-flight-path',
        labPath: 'web/wallet/v2-flight-path',
        labUrl: '/lab/#/web/wallet/v2-flight-path',
        touchesComponents: ['Button'],
        readmeHash: 'abc',
      },
    });
    return card;
  }

  it('a member cannot create one; the scanner can', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner']);
    const actor: MemberActor = {
      kind: 'user',
      userId: owner.id,
      via: 'web',
      workspaceId: project.id,
      roles: ['owner'],
    };
    await expect(service.apply(actor, null, 'redesign.create', { title: 'x', detail: {} })).rejects.toThrow();
    const card = await aVersion(project.id);
    expect(card).toMatchObject({ status: 'draft', source: 'lab', createdByKind: 'system' });
  });

  it('send to review: designer, frontend, owner or pm', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const designer = await project.member(['designer']);
    const owner = await project.member(['owner']);
    const card = await aVersion(project.id);
    await qa.post(`/redesign/${card.key}/submit-review`).expect(403);
    const { body } = await designer.post(`/redesign/${card.key}/submit-review`).expect(200);
    expect(body.data.status).toBe('review');
    const rows = await db().notification.findMany({
      where: { workspaceId: project.id, kind: 'routed_review' },
    });
    expect(rows.map((row) => row.userId).sort()).toEqual([owner.id, qa.id].sort());
    await designer.post(`/redesign/${card.key}/submit-review`).expect(409);
  });

  it('approve: owner only, creates the port task, and its Claim shows on the redesign', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const owner = await project.member(['owner']);
    const frontend = await project.member(['frontend']);
    const card = await aVersion(project.id, 'review');

    const refused = await pm.post(`/redesign/${card.key}/approve`, {}).expect(403);
    expect(refused.body.error.code).toBe('hub.redesign.owner_only');

    const { body } = await owner.post(`/redesign/${card.key}/approve`, { note: 'Nice' }).expect(200);
    expect(body.data).toMatchObject({
      status: 'approved',
      event: { kind: 'approved' },
      detail: { approvedBy: { id: owner.id }, decisionNote: 'Nice' },
    });
    const port = await db().card.findUniqueOrThrow({
      where: { id: body.data.detail.portTaskId as string },
      include: { task: true },
    });
    expect(port).toMatchObject({
      status: 'ready',
      ownerRole: 'frontend',
      task: { origin: 'redesign_port', specialty: 'frontend' },
    });
    expect(port.task?.prompt).toContain('# Port approved redesign web/wallet/v2-flight-path');
    expect(port.task?.prompt).toContain('Decision note: Nice.');

    const asFrontend = (await frontend.get(`/cards/${card.key}`).expect(200)).body.data;
    expect(asFrontend.actions[0]).toMatchObject({ action: 'claim', targetKey: port.key, enabled: true });
    expect(asFrontend.awaitedAction).toMatchObject({ action: 'claim', targetKey: port.key });

    await frontend.post(`/tasks/${port.key}/claim`).expect(200);
    const after = (await frontend.get(`/cards/${card.key}`).expect(200)).body.data;
    expect(after.actions[0].action).toBe('mark_ported');
    expect(after.awaitedAction).toBeNull();
  });

  it('approve with no port task, and not in review', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner']);
    const card = await aVersion(project.id, 'review');
    const { body } = await owner.post(`/redesign/${card.key}/approve`, { createPortTask: false }).expect(200);
    expect(body.data.detail.portTaskId).toBeNull();
    const draft = await aVersion(project.id);
    const refused = await owner.post(`/redesign/${draft.key}/approve`, {}).expect(409);
    expect(refused.body.error.code).toBe('hub.redesign.not_in_review');
  });

  it('reject: owner, a note, and closed', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner']);
    const card = await aVersion(project.id, 'review');
    await owner.post(`/redesign/${card.key}/reject`, {}).expect(400);
    const { body } = await owner.post(`/redesign/${card.key}/reject`, { note: 'No' }).expect(200);
    expect(body.data).toMatchObject({
      status: 'rejected',
      event: { kind: 'rejected' },
      detail: { rejectedBy: { id: owner.id }, decisionNote: 'No' },
    });
    const draft = await aVersion(project.id);
    await owner.post(`/redesign/${draft.key}/reject`, { note: 'No' }).expect(409);
  });

  it('request changes: status stays, and the note becomes a comment', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const backend = await project.member(['backend']);
    const card = await aVersion(project.id, 'review');
    await backend.post(`/redesign/${card.key}/request-changes`, { note: 'x' }).expect(403);
    const { body } = await qa
      .post(`/redesign/${card.key}/request-changes`, { note: 'Fix focus' })
      .expect(200);
    expect(body.data).toMatchObject({
      status: 'review',
      commentCount: 1,
      event: { kind: 'changes_requested' },
    });
    const comments = await qa.get(`/cards/${card.key}/comments`).expect(200);
    expect(comments.body.data).toMatchObject([{ body: 'Fix focus' }]);
  });

  it('mark ported closes the open port task, whatever its status', async () => {
    const project = await aProject(app);
    const owner = await project.member(['owner']);
    const frontend = await project.member(['frontend']);
    const qa = await project.member(['qa']);
    const card = await aVersion(project.id, 'review');
    const approved = await owner.post(`/redesign/${card.key}/approve`, {}).expect(200);
    const portId = approved.body.data.detail.portTaskId as string;

    await qa.post(`/redesign/${card.key}/mark-ported`, { ref: 'x' }).expect(403);
    const { body } = await frontend
      .post(`/redesign/${card.key}/mark-ported`, { ref: 'feat/x@abc (web)' })
      .expect(200);
    expect(body.data).toMatchObject({
      status: 'ported',
      event: { kind: 'ported' },
      detail: { portedRef: 'feat/x@abc (web)' },
    });
    const port = await db().card.findUniqueOrThrow({ where: { id: portId } });
    expect(port.status).toBe('done');
    expect((await eventsOf(portId)).at(-1)?.data).toMatchObject({
      reason: 'ported',
      from: 'ready',
      to: 'done',
    });
  });

  it('lists versions, filtered', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const card = await aVersion(project.id, 'review');
    await aVersion(project.id);
    expect((await qa.get('/redesign/versions').expect(200)).body.data).toHaveLength(2);
    const { body } = await qa
      .get('/redesign/versions', { status: 'review', app: 'web', page: 'wallet' })
      .expect(200);
    expect(body.data).toMatchObject([{ key: card.key, detail: { version: 'v2-flight-path' } }]);
    expect(body.data[0].detail.readmeHash).toBeUndefined();
    expect((await qa.get('/redesign/versions', { app: 'dashboard' }).expect(200)).body.data).toEqual([]);
  });
});

describe('docs', () => {
  let app: INestApplication;
  let service: CardService;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    service = app.get(CardService);
  });

  it('the indexer creates a doc, members only read it', async () => {
    const project = await aProject(app);
    const qa = await project.member(['qa']);
    const source = await db().source.create({
      data: { workspaceId: project.id, kind: 'docs_folder', name: 'docs', config: {} },
    });
    const { card } = await service.apply(
      { kind: 'system', userId: null, via: 'adapter', workspaceId: project.id, roles: [] },
      null,
      'doc.create',
      {
        title: 'Decisions',
        externalKey: 'doc:docs:00.md',
        detail: { sourceId: source.id, path: 'docs/00.md', kind: 'doc', wordCount: 10 },
      },
    );
    expect(card).toMatchObject({ type: 'doc', status: 'current', source: 'docs' });

    const { body } = await qa.get('/docs').expect(200);
    expect(body.data).toMatchObject([{ key: card.key, detail: { path: 'docs/00.md' } }]);
    expect((await qa.get('/docs', { kind: 'adr' }).expect(200)).body.data).toEqual([]);
    expect((await qa.get('/docs', { source: source.id }).expect(200)).body.data).toHaveLength(1);
    expect((await qa.get(`/docs/${card.key}`).expect(200)).body.data.key).toBe(card.key);

    const task = await created(qa, aTask());
    const missing = await qa.get(`/docs/${task.key}`).expect(404);
    expect(missing.body.error.code).toBe('hub.docs.not_found');
    expect((await qa.get('/docs/ZZ-1').expect(404)).body.error.code).toBe('hub.docs.not_found');
  });
});

describe('releases', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('create and edit are for owner and pm; keys become ids', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const task = await created(pm, aTask());
    const body = { type: 'release', title: 'Autumn', detail: { version: '1.4.0', includedKeys: [task.key] } };

    await qa.post('/cards', body).expect(403);
    await pm.post('/cards', { ...body, detail: { version: '1', includedKeys: ['ZZ-1'] } }).expect(404);
    const release = await pm.post('/cards', body).expect(201);
    expect(release.body.data).toMatchObject({ status: 'planned', detail: { includedIds: [task.id] } });
    const key = release.body.data.key as string;

    await qa.patch(`/releases/${key}`, { tag: 'v1' }).expect(403);
    const edited = await pm
      .patch(`/releases/${key}`, { tag: 'v1', includedKeys: [], notes: { owner: 'Hello' } })
      .expect(200);
    expect(edited.body.data.detail).toMatchObject({ tag: 'v1', includedIds: [], notes: { owner: 'Hello' } });
    await pm.patch(`/releases/${key}`, { notes: { team: 'Team' } }).expect(200);
    const both = (await pm.get(`/cards/${key}`).expect(200)).body.data;
    expect(both.detail.notes).toEqual({ owner: 'Hello', team: 'Team' });
    await pm.patch(`/releases/${key}`, {}).expect(200);
  });

  it('generate notes fills only what is empty, from the included cards', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm', 'backend']);
    const task = await created(pm, aTask({ title: 'Refund', priority: 'P1', module: 'wallet' }));
    await pm.post(`/tasks/${task.key}/claim`).expect(200);
    await pm.post(`/tasks/${task.key}/done`).expect(200);
    const release = await created(pm, {
      type: 'release',
      title: 'Autumn',
      detail: { version: '1.4.0', includedKeys: [task.key] },
    });
    await pm.patch(`/releases/${release.key}`, { notes: { accountant: 'Written by hand' } }).expect(200);

    const { body } = await pm.post(`/releases/${release.key}/generate-notes`).expect(200);
    const { notes } = body.data.detail;
    expect(notes.team).toContain(`${task.key} · Refund`);
    expect(notes.owner).toContain('Refund');
    expect(notes.owner).not.toContain(task.key);
    expect(notes.accountant).toBe('Written by hand');
  });

  it('release: planned to released, tells everyone, and refuses twice', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const qa = await project.member(['qa']);
    const release = await created(pm, { type: 'release', title: 'R', detail: { version: '1' } });
    await qa.post(`/releases/${release.key}/release`).expect(403);
    const { body } = await pm.post(`/releases/${release.key}/release`).expect(200);
    expect(body.data.status).toBe('released');
    expect(body.data.detail.releasedAt).not.toBeNull();
    const rows = (
      await db().notification.findMany({ where: { workspaceId: project.id, kind: 'system' } })
    ).filter((row) => (row.data as { i18n: { key: string } }).i18n.key === 'release_released');
    expect(rows).toMatchObject([{ userId: qa.id }]);
    await pm.post(`/releases/${release.key}/release`).expect(409);
  });

  it('lists, and a need or decision is not a release', async () => {
    const project = await aProject(app);
    const pm = await project.member(['pm']);
    const release = await created(pm, { type: 'release', title: 'R', detail: { version: '1' } });
    const need = await created(pm, aNeed('pm'));
    expect((await pm.get('/releases').expect(200)).body.data).toMatchObject([{ key: release.key }]);
    expect((await pm.get('/releases', { status: 'released' }).expect(200)).body.data).toEqual([]);
    await pm.post(`/releases/${need.key}/generate-notes`).expect(409);
    await pm.post(`/releases/ZZ-1/generate-notes`).expect(404);
  });
});
