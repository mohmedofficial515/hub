/**
 * @file The inbox over HTTP (docs/04 §3.17, docs/07 §2, §8): routing, grouping, read state, review M1.
 */
import { aDecision, aHandoff, aNeed, aProject, aTask, created, db } from '../setup/card-harness';
import { closeTestApps, createTestApp, type TestApp } from '../setup/create-test-app';

describe('inbox', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApps();
  });

  const unreadOf = async (member: {
    get(path: string): { expect(status: number): Promise<{ body: { data: { unread: number } } }> };
  }) => (await member.get('/inbox/count').expect(200)).body.data.unread;

  it('a decision routed to accountant lands in every accountant inbox once, not the actor', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const first = await project.member(['accountant']);
    const second = await project.member(['accountant']);
    await project.member(['backend']);
    const decision = await created(pm, aDecision('accountant'));

    for (const member of [first, second]) {
      const { body } = await member.get('/inbox').expect(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        kind: 'routed_decision',
        data: { cardKey: decision.key, action: 'decide' },
        groupKey: `card:${decision.id}`,
        readAt: null,
        card: { key: decision.key, awaiting: 'decide' },
      });
      expect(body.meta.pagination.total).toBe(1);
    }
    expect((await pm.get('/inbox').expect(200)).body.data).toEqual([]);
  });

  it('a holder of the role who also watches gets the routed kind only', async () => {
    const project = await aProject(testApp.app);
    const owner = await project.member(['owner']);
    const accountant = await project.member(['accountant']);
    const pm = await project.member(['pm']);
    const decision = await created(pm, aDecision('accountant'));
    await accountant.post(`/cards/${decision.key}/watch`).expect(204);
    await pm.patch(`/cards/${decision.key}`, { title: 'Renamed' }).expect(200);
    const items = (await accountant.get('/inbox').expect(200)).body.data as { kind: string }[];
    expect(items.map((item) => item.kind).sort()).toEqual(['routed_decision', 'watch_update']);
    expect((await owner.get('/inbox').expect(200)).body.data[0].kind).toBe('routed_decision');
  });

  it('a mention notifies once even with two mentions', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const sara = await project.member(['frontend']);
    const task = await created(pm, aTask());
    await pm
      .post(`/cards/${task.key}/comments`, {
        body: `@user:${sara.id} and again @user:${sara.id}, @role:frontend`,
      })
      .expect(201);
    const items = (await sara.get('/inbox').expect(200)).body.data as { kind: string }[];
    expect(items.map((item) => item.kind)).toEqual(['mention']);
  });

  it('folds a second watch update within 30 minutes into the unread one', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const watcher = await project.member(['qa']);
    const task = await created(pm, aTask());
    await watcher.post(`/cards/${task.key}/watch`).expect(204);
    await pm.patch(`/cards/${task.key}`, { title: 'One' }).expect(200);
    await pm.patch(`/cards/${task.key}`, { title: 'Two' }).expect(200);
    let items = (await watcher.get('/inbox').expect(200)).body.data as { data: { count?: number } }[];
    expect(items).toHaveLength(1);
    expect(items[0]?.data.count).toBe(2);

    testApp.clock.advance(31 * 60 * 1000);
    await pm.patch(`/cards/${task.key}`, { title: 'Three' }).expect(200);
    items = (await watcher.get('/inbox').expect(200)).body.data;
    expect(items).toHaveLength(2);
  });

  it('read, unread, read-all, archive and unarchive are per member', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const other = await project.member(['accountant']);
    await created(pm, aDecision('accountant'));
    await created(pm, aNeed('accountant'));
    const items = (await accountant.get('/inbox').expect(200)).body.data as { id: string }[];
    expect(items).toHaveLength(2);
    const [first] = items;
    if (!first) throw new Error('no items');

    await other.post(`/inbox/${first.id}/read`).expect(404);
    await accountant.post(`/inbox/${first.id}/read`).expect(204);
    expect(await unreadOf(accountant)).toBe(1);
    expect(await unreadOf(other)).toBe(2);
    await accountant.post(`/inbox/${first.id}/unread`).expect(204);
    expect(await unreadOf(accountant)).toBe(2);

    await accountant.post('/inbox/read-all', {}).expect(204);
    expect(await unreadOf(accountant)).toBe(0);
    expect((await accountant.get('/inbox', { unread: true }).expect(200)).body.data).toEqual([]);

    await accountant.post(`/inbox/${first.id}/archive`).expect(204);
    expect((await accountant.get('/inbox').expect(200)).body.data).toHaveLength(1);
    expect((await accountant.get('/inbox', { archived: true }).expect(200)).body.data).toHaveLength(1);
    await accountant.post(`/inbox/${first.id}/unarchive`).expect(204);
    expect((await accountant.get('/inbox').expect(200)).body.data).toHaveLength(2);
  });

  it('count names the cards waiting on me by type', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const sara = await project.member(['frontend', 'accountant']);
    await created(pm, aDecision('accountant'));
    await created(pm, aNeed('accountant'));
    await created(pm, aHandoff('frontend'));
    const { body } = await sara.get('/inbox/count').expect(200);
    expect(body.data).toEqual({
      unread: 3,
      awaitingMe: { decisions: 1, needs: 1, handoffs: 1, reviews: 0 },
    });
  });

  describe('acting on a card (review M1)', () => {
    it('deciding marks that card read for the one who acted, and the item stays as history', async () => {
      const project = await aProject(testApp.app);
      const pm = await project.member(['pm']);
      const accountant = await project.member(['accountant']);
      const decision = await created(pm, aDecision('accountant'));
      await created(pm, aNeed('accountant'));
      expect(await unreadOf(accountant)).toBe(2);

      const full = (await accountant.get(`/cards/${decision.key}`).expect(200)).body.data;
      await accountant
        .post(`/decisions/${decision.key}/decide`, {
          optionId: full.detail.options[0].id,
          rationale: 'Cheaper by far',
        })
        .expect(200);
      expect(await unreadOf(accountant)).toBe(1);
      const items = (await accountant.get('/inbox').expect(200)).body.data as {
        readAt: string | null;
        card: { key: string; awaiting: string | null };
      }[];
      const item = items.find((row) => row.card.key === decision.key);
      expect(item?.readAt).not.toBeNull();
      expect(item?.card.awaiting).toBeNull();
    });

    it('commenting does not mark it read', async () => {
      const project = await aProject(testApp.app);
      const pm = await project.member(['pm']);
      const accountant = await project.member(['accountant']);
      const decision = await created(pm, aDecision('accountant'));
      await accountant.post(`/cards/${decision.key}/comments`, { body: 'Looking at it' }).expect(201);
      expect(await unreadOf(accountant)).toBe(1);
    });

    it('undo restores exactly what the act cleared', async () => {
      const project = await aProject(testApp.app);
      const pm = await project.member(['pm']);
      const backend = await project.member(['backend']);
      const task = await created(pm, aTask());
      expect(await unreadOf(backend)).toBe(1);
      await backend.post(`/tasks/${task.key}/claim`).expect(200);
      expect(await unreadOf(backend)).toBe(0);
      await backend.post(`/tasks/${task.key}/unclaim`).expect(200);
      // The item the claim cleared is back; `task_ready` from the unclaim folds nothing new for the actor.
      expect(await unreadOf(backend)).toBe(1);
    });

    it('an item the member read themselves stays read through undo', async () => {
      const project = await aProject(testApp.app);
      const pm = await project.member(['pm']);
      const backend = await project.member(['backend']);
      const task = await created(pm, aTask());
      const [item] = (await backend.get('/inbox').expect(200)).body.data as { id: string }[];
      await backend.post(`/inbox/${item?.id}/read`).expect(204);
      await backend.post(`/tasks/${task.key}/claim`).expect(200);
      await backend.post(`/tasks/${task.key}/unclaim`).expect(200);
      expect(await unreadOf(backend)).toBe(0);
    });

    it('acting through Claude Code clears it too', async () => {
      const project = await aProject(testApp.app);
      const pm = await project.member(['pm']);
      const human = await project.member(['backend']);
      const task = await created(pm, aTask());
      const row = await db().notification.findFirstOrThrow({ where: { userId: human.id } });
      expect(row.readAt).toBeNull();
      const agent = {
        ...human,
        post: (path: string) => human.post(path).set('x-test-kind', 'agent'),
      };
      await agent.post(`/tasks/${task.key}/claim`).expect(200);
      expect((await db().notification.findUniqueOrThrow({ where: { id: row.id } })).readAt).not.toBeNull();
    });
  });

  it('an item on a deleted card hides with it, and comes back with it', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const accountant = await project.member(['accountant']);
    const decision = await created(pm, aDecision('accountant'));
    await pm.post(`/cards/${decision.key}/delete`).expect(200);
    expect(await unreadOf(accountant)).toBe(0);
    expect((await accountant.get('/inbox').expect(200)).body.data).toEqual([]);
    await pm.post(`/cards/${decision.key}/restore`).expect(200);
    expect(await unreadOf(accountant)).toBe(1);
  });

  it('never tells a removed member', async () => {
    const project = await aProject(testApp.app);
    const pm = await project.member(['pm']);
    const gone = await project.member(['accountant']);
    await db().membership.updateMany({ where: { userId: gone.id }, data: { status: 'removed' } });
    await created(pm, aDecision('accountant'));
    expect(await db().notification.count({ where: { userId: gone.id } })).toBe(0);
  });
});
