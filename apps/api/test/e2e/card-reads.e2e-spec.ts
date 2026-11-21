/**
 * @file H0-05: CardQuery filters, CardFull, the Deleted view, and the timeline with its collapse hint.
 */
import type { INestApplication } from '@nestjs/common';

import { CardService } from '@/modules/cards';

import { userActor } from '../factories';
import { aDecision, aHandoff, aProject, aTask, created, db } from '../setup/card-harness';
import { createTestApp, type TestApp } from '../setup/create-test-app';

describe('card reads', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
  });

  describe('GET /cards', () => {
    it('filters by type, status, role, assignee, creator, repo, module and tag', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const backend = await project.member(['backend']);
      const task = await created(pm, aTask({ repo: 'web', module: 'wallet', tags: ['x'] }));
      const other = await created(backend, aTask({ title: 'Other', detail: { specialty: 'qa' } }));
      const decision = await created(pm, aDecision());
      await backend.post(`/tasks/${task.key}/claim`).expect(200);

      const keys = async (query: object) =>
        ((await pm.get('/cards', query).expect(200)).body.data as { key: string }[]).map((c) => c.key);

      expect(await keys({ type: 'decision' })).toEqual([decision.key]);
      expect((await keys({ type: 'task,decision' })).sort()).toEqual(
        [task.key, other.key, decision.key].sort(),
      );
      expect(await keys({ status: 'claimed' })).toEqual([task.key]);
      expect(await keys({ role: 'qa' })).toEqual([other.key]);
      expect(await keys({ repo: 'web' })).toEqual([task.key]);
      expect(await keys({ module: 'wallet' })).toEqual([task.key]);
      expect(await keys({ tag: 'x' })).toEqual([task.key]);
      expect(await keys({ createdBy: backend.id })).toEqual([other.key]);
      expect((await backend.get('/cards', { assignee: 'me' }).expect(200)).body.data).toHaveLength(1);
    });

    it('searches title and body, and answers no other project’s cards', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const elsewhere = await aProject(app);
      const stranger = await elsewhere.member(['pm']);
      await created(stranger, aTask({ title: 'Refund wallet elsewhere' }));
      const hit = await created(pm, aTask({ title: 'Refund wallet' }));
      const byBody = await created(pm, aTask({ title: 'Plain', body: 'mentions refund here' }));
      await created(pm, aTask({ title: 'Unrelated' }));

      const { body } = await pm.get('/cards', { q: 'refund' }).expect(200);
      expect((body.data as { key: string }[]).map((c) => c.key).sort()).toEqual([hit.key, byBody.key].sort());
    });

    it('flags: blocked, overdue and stale, on the row and as filters', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const blocker = await created(pm, aTask({ title: 'Blocker' }));
      const blocked = await created(
        pm,
        aTask({ title: 'Blocked', links: [{ kind: 'blocked_by', key: blocker.key }] }),
      );
      const late = await created(pm, aTask({ title: 'Late', dueAt: '2020-01-01T00:00:00.000Z' }));
      const handoff = await created(pm, aHandoff());

      const flagged = async (flags: string) =>
        ((await pm.get('/cards', { flags }).expect(200)).body.data as { key: string }[]).map((c) => c.key);
      expect(await flagged('blocked')).toEqual([blocked.key]);
      expect(await flagged('overdue')).toEqual([late.key]);
      expect(await flagged('stale')).toEqual([]);
      const row = (await pm.get(`/cards/${blocked.key}`).expect(200)).body.data;
      expect(row.flags).toMatchObject({ blocked: true, overdue: false });

      testApp.clock.advance(49 * 3_600_000);
      expect(await flagged('stale')).toEqual([handoff.key]);
    });

    it('pages with a stable cursor, for every sort', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      for (const [index, priority] of ['P3', 'P0', 'P2', 'P1'].entries()) {
        testApp.clock.advance(1000);
        await created(
          pm,
          aTask({
            title: `T${index}`,
            priority,
            ...(index % 2 === 0 ? { dueAt: `2030-01-0${index + 1}T00:00:00.000Z` } : {}),
          }),
        );
      }
      for (const sort of ['lastEvent', 'created', 'due', 'priority']) {
        const seen: string[] = [];
        let cursor: string | null | undefined;
        do {
          const { body } = await pm
            .get('/cards', { sort, limit: 3, ...(cursor ? { cursor } : {}) })
            .expect(200);
          seen.push(...(body.data as { title: string }[]).map((c) => c.title));
          cursor = body.meta.pagination.nextCursor as string | null;
        } while (cursor);
        expect([sort, seen.length, new Set(seen).size]).toEqual([sort, 4, 4]);
        if (sort === 'priority') expect(seen).toEqual(['T1', 'T3', 'T2', 'T0']);
        if (sort === 'due') expect(seen.slice(0, 2)).toEqual(['T0', 'T2']);
      }
    });

    it('awaiting=me answers only cards waiting on the member, and the verb follows the state (review B2)', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const frontend = await project.member(['frontend']);
      const handoff = await created(pm, aHandoff('frontend'));
      await created(pm, aDecision('owner'));
      await created(pm, aTask({ detail: { specialty: 'frontend', prompt: 'x' } }));

      const awaiting = async () =>
        (await frontend.get('/cards', { awaiting: 'me' }).expect(200)).body.data as {
          key: string;
          awaiting: string;
        }[];
      expect(await awaiting()).toMatchObject([{ key: handoff.key, awaiting: 'acknowledge' }]);

      await frontend.post(`/handoffs/${handoff.key}/acknowledge`).expect(200);
      expect(await awaiting()).toMatchObject([{ key: handoff.key, awaiting: 'apply' }]);

      await frontend.post(`/handoffs/${handoff.key}/apply`).expect(200);
      expect(await awaiting()).toEqual([]);
    });
  });

  describe('CardFull', () => {
    it('joins links, watchers and the actions this member has now', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const accountant = await project.member(['accountant']);
      const blocker = await created(pm, aDecision('accountant'));
      const task = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: blocker.key }] }));

      const asAccountant = (await accountant.get(`/cards/${blocker.key}`).expect(200)).body.data;
      expect(asAccountant).toMatchObject({
        key: blocker.key,
        status: 'open',
        watching: false,
        createdBy: { kind: 'user', userId: pm.id },
        links: [{ kind: 'blocks', card: { key: task.key } }],
        watchers: [{ userId: pm.id, reason: 'creator' }],
        awaitedAction: { action: 'decide', enabled: true },
      });
      expect(asAccountant.actions[0]).toMatchObject({ action: 'decide', permission: 'decision.decide' });
      expect(asAccountant.allowedActions).toContain('decision.decide');
      expect(asAccountant.allowedActions).not.toContain('task.claim');

      const asPm = (await pm.get(`/cards/${blocker.key}`).expect(200)).body.data;
      expect(asPm).toMatchObject({ watching: true, awaitedAction: null });
      expect(asPm.actions[0]).toMatchObject({ action: 'decide', enabled: false, needsRole: 'accountant' });
    });

    it('expands *ById in the detail, and hides nothing the type table has', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());
      const body = (await pm.post(`/tasks/${task.key}/claim`).expect(200)).body.data;
      expect(body.detail.claimedBy).toMatchObject({ id: pm.id });
      expect(body.detail.claimedById).toBeUndefined();
      expect(body.assignee).toMatchObject({ id: pm.id });
    });

    it('a card of another project is not found', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());
      const other = await (await aProject(app)).member(['owner']);
      await other.get(`/cards/${task.key}`).expect(404);
    });
  });

  describe('delete and restore (D28)', () => {
    it('hides the card from every list, count and search, and restores it', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask({ title: 'Findable refund' }));

      const deleted = await pm.post(`/cards/${task.key}/delete`, { reason: 'dup' }).expect(200);
      expect(deleted.body.data.event.kind).toBe('archived');
      expect(deleted.body.data.archivedAt).not.toBeNull();
      expect((await pm.get('/cards').expect(200)).body.data).toEqual([]);
      expect((await pm.get('/cards', { q: 'refund' }).expect(200)).body.data).toEqual([]);
      expect((await pm.get('/timeline').expect(200)).body.data).toEqual([]);
      await qa.get(`/cards/${task.key}`).expect(404);
      expect((await pm.get(`/cards/${task.key}`).expect(200)).body.data.archivedAt).not.toBeNull();

      // A deleted card accepts nothing but restore.
      const refused = await pm.post(`/tasks/${task.key}/claim`).expect(409);
      expect(refused.body.error.code).toBe('hub.cards.archived');

      const list = await pm.get('/cards/deleted').expect(200);
      expect(list.body.data).toMatchObject([{ key: task.key }]);
      expect((await qa.get('/cards/deleted').expect(200)).body.data).toEqual([]);

      const restored = await pm.post(`/cards/${task.key}/restore`).expect(200);
      expect(restored.body.data).toMatchObject({ archivedAt: null, event: { kind: 'restored' } });
      expect((await pm.get('/cards/deleted').expect(200)).body.data).toEqual([]);
      expect((await pm.get('/cards').expect(200)).body.data).toHaveLength(1);

      const kinds = await db().cardEvent.findMany({ where: { cardId: task.id }, orderBy: { seq: 'asc' } });
      expect(kinds.map((event) => event.kind)).toEqual(['created', 'archived', 'restored']);
      await expect(db().card.count({ where: { id: task.id } })).resolves.toBe(1);
    });

    it('the creator may delete and restore their own, nobody else’s, and sees it in their Deleted view', async () => {
      const project = await aProject(app);
      const creator = await project.member(['qa']);
      const other = await project.member(['backend']);
      const task = await created(creator, aTask());

      await other.post(`/cards/${task.key}/delete`).expect(403);
      await creator.post(`/cards/${task.key}/delete`).expect(200);
      expect((await creator.get('/cards/deleted').expect(200)).body.data).toMatchObject([{ key: task.key }]);
      await other.post(`/cards/${task.key}/restore`).expect(403);
      await creator.post(`/cards/${task.key}/restore`).expect(200);
    });

    it('restoring what is not deleted is refused', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());
      await pm.post(`/cards/${task.key}/restore`).expect(409);
    });

    it('a deleted blocker stops blocking, and its dependants get unblocked', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const blocker = await created(pm, aTask({ title: 'Blocker' }));
      const blocked = await created(pm, aTask({ links: [{ kind: 'blocked_by', key: blocker.key }] }));

      await pm.post(`/cards/${blocker.key}/delete`).expect(200);

      const body = (await pm.get(`/cards/${blocked.key}`).expect(200)).body.data;
      expect(body.flags.blocked).toBe(false);
      expect(body.links).toEqual([]);
      const events = await db().cardEvent.findMany({
        where: { cardId: blocked.id },
        orderBy: { seq: 'asc' },
      });
      expect(events[events.length - 1]).toMatchObject({
        kind: 'unblocked',
        data: { byCardKey: blocker.key },
      });
    });
  });

  describe('events', () => {
    it('lists a card’s history oldest first, paged, with the plan text left out', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const plan = await created(pm, { type: 'plan', title: 'P', body: 'v1', detail: {} });
      await pm.patch(`/plans/${plan.key}`, { body: 'v2' }).expect(200);
      await pm.patch(`/plans/${plan.key}`, { body: 'v3' }).expect(200);

      const first = await pm.get(`/cards/${plan.key}/events`, { limit: 2 }).expect(200);
      expect(first.body.data.map((event: { kind: string }) => event.kind)).toEqual([
        'created',
        'plan_revised',
      ]);
      expect(first.body.data[1].data.previousBody).toBeUndefined();
      const second = await pm
        .get(`/cards/${plan.key}/events`, { limit: 2, cursor: first.body.meta.pagination.nextCursor })
        .expect(200);
      expect(second.body.data).toHaveLength(1);
      expect(second.body.meta.pagination.nextCursor).toBeNull();
    });
  });

  describe('GET /timeline', () => {
    it('folds consecutive events of a card within 30 minutes, and keeps the row whole across pages', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await created(pm, aTask({ title: 'A' }));
      testApp.clock.advance(60_000);
      await pm.post(`/cards/${a.key}/comments`, { body: 'one' }).expect(201);
      testApp.clock.advance(60_000);
      await pm.post(`/cards/${a.key}/comments`, { body: 'two' }).expect(201);
      testApp.clock.advance(60_000);
      const b = await created(pm, aTask({ title: 'B' }));
      testApp.clock.advance(31 * 60_000);
      await pm.post(`/cards/${b.key}/comments`, { body: 'late' }).expect(201);

      const first = await pm.get('/timeline', { limit: 2 }).expect(200);
      expect(first.body.data).toMatchObject([
        { card: { key: b.key }, event: { kind: 'commented' }, collapsed: 0, collapsedKinds: [] },
        { card: { key: b.key }, event: { kind: 'created' }, collapsed: 0 },
      ]);
      const second = await pm
        .get('/timeline', { limit: 2, cursor: first.body.meta.pagination.nextCursor })
        .expect(200);
      expect(second.body.data).toMatchObject([
        {
          card: { key: a.key },
          event: { kind: 'commented' },
          collapsed: 2,
          collapsedKinds: ['commented', 'created'],
        },
      ]);
      expect(second.body.meta.pagination.nextCursor).toBeNull();
    });

    it('filters, leaves out watch events, and gives day counts for a range', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask({ repo: 'web' }));
      const decision = await created(pm, aDecision('qa'));
      await qa.post(`/cards/${task.key}/watch`).expect(204);

      const keys = async (query: object) =>
        ((await qa.get('/timeline', query).expect(200)).body.data as { card: { key: string } }[]).map(
          (row) => row.card.key,
        );
      expect(await keys({ types: 'decision' })).toEqual([decision.key]);
      expect(await keys({ repos: 'web' })).toEqual([task.key]);
      expect(await keys({ roles: 'qa' })).toEqual(expect.arrayContaining([decision.key]));
      expect(await keys({ kinds: 'watch' })).toEqual([task.key]);
      expect(await keys({ mine: 'true' })).toEqual([task.key]);
      expect(await keys({ actors: qa.id })).toEqual([]);

      const now = testApp.clock.now().toISOString();
      const ranged = await qa.get('/timeline', { from: '2000-01-01T00:00:00.000Z', to: now }).expect(200);
      expect(ranged.body.meta.dayCounts).toEqual([{ date: now.slice(0, 10), count: 2 }]);
    });

    it('answers 50 000 events inside the budget', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const service = app.get(CardService);
      const actor = userActor(pm.id, project.id, ['pm']);
      const cards: string[] = [];
      for (let index = 0; index < 50; index += 1) {
        cards.push(
          (
            await service.apply(actor, null, 'task.create', {
              title: `C${index}`,
              detail: { specialty: 'qa' },
            })
          ).card.id,
        );
      }
      await db().$executeRawUnsafe(`
        INSERT INTO card_events (workspace_id, card_id, seq, kind, actor_kind, actor_id, via, data, created_at)
        SELECT '${project.id}'::uuid, c.id, 1000 + n, 'commented', 'user', '${pm.id}'::uuid, 'web', '{}'::jsonb,
               now() - (n * interval '1 minute')
        FROM generate_series(1, 1000) n CROSS JOIN cards c WHERE c.workspace_id = '${project.id}'::uuid`);
      await db().$executeRawUnsafe('ANALYZE card_events');

      await pm.get('/timeline', { limit: 50 }).expect(200);
      const started = performance.now();
      const { body } = await pm.get('/timeline', { limit: 50 }).expect(200);
      const elapsed = performance.now() - started;
      expect(body.data).toHaveLength(50);
      // docs/12 sets 100 ms on the query; this measures the whole HTTP round trip on a loaded dev machine.
      expect(elapsed).toBeLessThan(400);
    });
  });
});
