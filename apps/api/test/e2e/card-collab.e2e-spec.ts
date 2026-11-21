/**
 * @file H0-05: editing, links with the cycle check, comments with secret filter, mentions and redaction, watchers,
 * the audit list, and the generic transition route.
 */
import type { INestApplication } from '@nestjs/common';

import { IdempotencyService } from '@/modules/cards';

import { aDecision, aProject, aTask, created, db, eventsOf } from '../setup/card-harness';
import { createTestApp, type TestApp } from '../setup/create-test-app';

const SECRET = `ghp_${'a1B2'.repeat(9)}`;

describe('card collaboration', () => {
  let testApp: TestApp;
  let app: INestApplication;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
  });

  describe('PATCH /cards/{key}', () => {
    it('writes one field_changed event listing every field, and hashes the body', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());

      const { body } = await pm
        .patch(`/cards/${task.key}`, { title: 'New', body: 'text', priority: 'P0', tags: ['a'] })
        .expect(200);
      expect(body.data).toMatchObject({ title: 'New', body: 'text', priority: 'P0', tags: ['a'] });

      const [, event] = await eventsOf(task.id);
      expect(event?.kind).toBe('field_changed');
      const changes = (event?.data as { changes: { field: string; to: unknown }[] }).changes;
      expect(changes.map((change) => change.field).sort()).toEqual(['body', 'priority', 'tags', 'title']);
      expect(changes.find((change) => change.field === 'body')?.to).not.toBe('text');
      await expect(db().auditLog.count({ where: { targetId: task.key } })).resolves.toBe(2);
    });

    it('nothing changed is no event', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask({ title: 'Same' }));
      await pm.patch(`/cards/${task.key}`, { title: 'Same' }).expect(200);
      await expect(eventsOf(task.id)).resolves.toHaveLength(1);
    });

    it('a creator edits content but not routing; another member neither', async () => {
      const project = await aProject(app);
      const creator = await project.member(['qa']);
      const other = await project.member(['backend']);
      const task = await created(creator, aTask());

      await creator.patch(`/cards/${task.key}`, { title: 'Mine' }).expect(200);
      await creator.patch(`/cards/${task.key}`, { priority: 'P0' }).expect(403);
      await other.patch(`/cards/${task.key}`, { title: 'Theirs' }).expect(403);
    });

    it('a new role follows into the detail’s copy', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const decision = await created(pm, aDecision('owner'));
      const { body } = await pm.patch(`/cards/${decision.key}`, { ownerRole: 'accountant' }).expect(200);
      expect(body.data.detail.deciderRole).toBe('accountant');
    });

    it('an assignee must be a member, and starts watching', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask());
      await pm.patch(`/cards/${task.key}`, { assignee: '00000000-0000-7000-8000-00000000abcd' }).expect(404);
      const { body } = await pm.patch(`/cards/${task.key}`, { assignee: qa.id }).expect(200);
      expect(body.data.assignee.id).toBe(qa.id);
      expect(body.data.watchers).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: qa.id })]),
      );
    });

    it('a body over the limit is refused on a type that is not a plan', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());
      await pm.patch(`/cards/${task.key}`, { body: 'x'.repeat(20_001) }).expect(400);
    });
  });

  describe('POST /cards', () => {
    it('refuses the types only adapters create, with type_mismatch', async () => {
      const project = await aProject(app);
      const owner = await project.member(['owner']);
      for (const type of ['change', 'redesign', 'doc']) {
        const { body } = await owner.post('/cards', { type }).expect(409);
        expect(body.error.code).toBe('hub.cards.type_mismatch');
      }
    });

    it('Idempotency-Key replays the first answer, and refuses another body', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const first = await pm.post('/cards', aTask()).set('Idempotency-Key', 'k1').expect(201);
      const again = await pm.post('/cards', aTask()).set('Idempotency-Key', 'k1').expect(201);
      expect(again.body.data.key).toBe(first.body.data.key);
      expect(again.headers['idempotent-replay']).toBe('true');
      await expect(db().card.count({ where: { workspaceId: project.id } })).resolves.toBe(1);

      const other = await pm
        .post('/cards', aTask({ title: 'Else' }))
        .set('Idempotency-Key', 'k1')
        .expect(422);
      expect(other.body.error.code).toBe('hub.common.idempotency_key_reused');
    });

    it('the same rule covers what an MCP tool calls: one key, one card, per member and tool', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const idempotency = app.get(IdempotencyService, { strict: false });
      let runs = 0;
      const work = async () => ({ run: (runs += 1) });

      const first = await idempotency.run(pm.id, 'create_task', 'call-1', { title: 'A' }, work);
      const again = await idempotency.run(pm.id, 'create_task', 'call-1', { title: 'A' }, work);
      expect(first).toEqual({ result: { run: 1 }, replayed: false });
      expect(again).toEqual({ result: { run: 1 }, replayed: true });
      await expect(
        idempotency.run(pm.id, 'create_task', 'call-1', { title: 'B' }, work),
      ).rejects.toMatchObject({
        code: 'hub.common.idempotency_key_reused',
      });

      await idempotency.run(pm.id, 'create_need', 'call-1', { title: 'B' }, work);
      await idempotency.run('another-member', 'create_task', 'call-1', { title: 'B' }, work);
      await idempotency.run(pm.id, 'create_task', undefined, { title: 'A' }, work);
      expect(runs).toBe(4);
    });

    it('a failed call stores nothing, so a retry runs', async () => {
      const idempotency = app.get(IdempotencyService, { strict: false });
      await expect(
        idempotency.run('member', 'create_task', 'call-2', {}, () => Promise.reject(new Error('no'))),
      ).rejects.toThrow('no');
      const retried = await idempotency.run('member', 'create_task', 'call-2', {}, () => Promise.resolve(7));
      expect(retried).toEqual({ result: 7, replayed: false });
    });

    it('a bad link on create undoes the card', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      await pm.post('/cards', aTask({ links: [{ kind: 'relates', key: 'ZZ-999' }] })).expect(404);
      await expect(db().card.count({ where: { workspaceId: project.id } })).resolves.toBe(0);
    });
  });

  describe('links', () => {
    it('writes one row, one event on each card, and shows both ends', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await created(pm, aTask({ title: 'A' }));
      const b = await created(pm, aTask({ title: 'B' }));

      const { body } = await pm.post(`/cards/${a.key}/links`, { kind: 'blocks', key: b.key }).expect(201);
      expect(body.data.links).toMatchObject([{ kind: 'blocks', card: { key: b.key } }]);
      const other = (await pm.get(`/cards/${b.key}`).expect(200)).body.data;
      expect(other.links).toMatchObject([{ kind: 'blocked_by', card: { key: a.key } }]);
      expect(other.flags.blocked).toBe(true);

      const lastOf = async (id: string) => (await eventsOf(id)).at(-1);
      expect(await lastOf(a.id)).toMatchObject({
        kind: 'linked',
        data: { kind: 'blocks', otherCardKey: b.key },
      });
      expect(await lastOf(b.id)).toMatchObject({
        kind: 'linked',
        data: { kind: 'blocked_by', otherCardKey: a.key },
      });

      await pm.del(`/cards/${a.key}/links`, { kind: 'blocks', key: b.key }).expect(200);
      expect((await pm.get(`/cards/${b.key}`).expect(200)).body.data.flags.blocked).toBe(false);
      expect(await lastOf(b.id)).toMatchObject({ kind: 'unlinked' });
    });

    it('stores blocked_by and child as the inverse row', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await created(pm, aTask({ title: 'A' }));
      const b = await created(pm, aTask({ title: 'B' }));
      await pm.post(`/cards/${a.key}/links`, { kind: 'blocked_by', key: b.key }).expect(201);
      await pm.post(`/cards/${a.key}/links`, { kind: 'child', key: b.key }).expect(201);
      const rows = await db().cardLink.findMany({
        where: { workspaceId: project.id },
        orderBy: { kind: 'asc' },
      });
      expect(rows).toMatchObject([
        { kind: 'blocks', fromCardId: b.id, toCardId: a.id },
        { kind: 'parent', fromCardId: b.id, toCardId: a.id },
      ]);
    });

    it('refuses self, a duplicate, an unknown card and a cycle, for blocks and for parent', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await created(pm, aTask({ title: 'A' }));
      const b = await created(pm, aTask({ title: 'B' }));
      const c = await created(pm, aTask({ title: 'C' }));
      const code = async (key: string, kind: string, target: string) =>
        (await pm.post(`/cards/${key}/links`, { kind, key: target })).body.error?.code as string | undefined;

      expect(await code(a.key, 'blocks', a.key)).toBe('hub.cards.link_self');
      await pm.post(`/cards/${a.key}/links`, { kind: 'blocks', key: b.key }).expect(201);
      expect(await code(a.key, 'blocks', b.key)).toBe('hub.cards.link_exists');
      expect(await code(a.key, 'blocks', 'ZZ-1')).toBe('hub.cards.not_found');
      await pm.post(`/cards/${b.key}/links`, { kind: 'blocks', key: c.key }).expect(201);
      expect(await code(c.key, 'blocks', a.key)).toBe('hub.cards.link_cycle');

      await pm.post(`/cards/${a.key}/links`, { kind: 'parent', key: b.key }).expect(201);
      expect(await code(b.key, 'parent', a.key)).toBe('hub.cards.link_cycle');

      // A refused link writes nothing.
      await expect(db().cardLink.count({ where: { workspaceId: project.id } })).resolves.toBe(3);
    });

    it('relates is one row whichever end asks, so the reverse is a duplicate', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const a = await created(pm, aTask({ title: 'A' }));
      const b = await created(pm, aTask({ title: 'B' }));
      await pm.post(`/cards/${a.key}/links`, { kind: 'relates', key: b.key }).expect(201);
      await pm.post(`/cards/${b.key}/links`, { kind: 'relates', key: a.key }).expect(409);
    });
  });

  describe('comments', () => {
    it('adds a comment: count, event with excerpt, the author watches', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa'], 'agent');
      const task = await created(pm, aTask());

      const { body } = await qa.post(`/cards/${task.key}/comments`, { body: 'Looks good' }).expect(201);
      expect(body.data).toMatchObject({
        body: 'Looks good',
        redacted: false,
        via: 'mcp',
        author: { kind: 'agent', userId: qa.id },
      });
      const card = (await pm.get(`/cards/${task.key}`).expect(200)).body.data;
      expect(card.commentCount).toBe(1);
      expect(card.watchers).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: qa.id, reason: 'commenter' })]),
      );
      expect((await eventsOf(task.id)).at(-1)).toMatchObject({
        kind: 'commented',
        data: { commentId: body.data.id, excerpt: 'Looks good' },
      });
      const listed = await pm.get(`/cards/${task.key}/comments`).expect(200);
      expect(listed.body.data).toHaveLength(1);
    });

    it('refuses a secret, saying which pattern, and writes nothing', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask());
      const { body } = await pm.post(`/cards/${task.key}/comments`, { body: `token ${SECRET}` }).expect(422);
      expect(body.error).toMatchObject({
        code: 'hub.security.secret_detected',
        details: { pattern: 'github_token', field: 'body' },
      });
      expect(JSON.stringify(body)).not.toContain(SECRET);
      await expect(db().cardComment.count({ where: { cardId: task.id } })).resolves.toBe(0);
    });

    it('mentions: a user and a role are notified once, a stranger is not, the actor never', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const mentioned = await project.member(['backend']);
      const roleHolder = await project.member(['qa']);
      const stranger = await (await aProject(app)).member(['qa']);
      const task = await created(pm, aTask({ detail: { specialty: 'design' } }));

      await pm
        .post(`/cards/${task.key}/comments`, {
          body: `@user:${mentioned.id} @user:${mentioned.id} @user:${stranger.id} @user:${pm.id} @role:qa`,
        })
        .expect(201);

      const rows = await db().notification.findMany({ where: { workspaceId: project.id, kind: 'mention' } });
      expect(rows.map((row) => row.userId).sort()).toEqual([mentioned.id, roleHolder.id].sort());
      const card = (await pm.get(`/cards/${task.key}`).expect(200)).body.data;
      expect(card.watchers).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: mentioned.id, reason: 'mention' })]),
      );
    });

    it('the author edits within 15 minutes, and nobody else', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask());
      const { body } = await qa.post(`/cards/${task.key}/comments`, { body: 'one' }).expect(201);
      const path = `/cards/${task.key}/comments/${body.data.id as string}`;

      const edited = await qa.patch(path, { body: 'two' }).expect(200);
      expect(edited.body.data).toMatchObject({ body: 'two' });
      expect(edited.body.data.editedAt).not.toBeNull();

      const other = await pm.patch(path, { body: 'three' }).expect(403);
      expect(other.body.error.code).toBe('hub.cards.comment_not_author');

      testApp.clock.advance(16 * 60_000);
      await qa.patch(path, { body: 'late' }).expect(403);
      await qa
        .patch(`/cards/${task.key}/comments/00000000-0000-7000-8000-00000000abcd`, { body: 'x' })
        .expect(404);
    });

    it('redaction removes the text everywhere and keeps the fact', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask());
      const { body } = await qa.post(`/cards/${task.key}/comments`, { body: 'oops private' }).expect(201);
      const path = `/cards/${task.key}/comments/${body.data.id as string}/redact`;

      await qa.post(path).expect(403);
      const redacted = await pm.post(path).expect(200);
      expect(redacted.body.data).toMatchObject({ body: null, redacted: true });

      const events = await eventsOf(task.id);
      expect(JSON.stringify(events)).not.toContain('oops private');
      expect(events.at(-1)).toMatchObject({ kind: 'redacted', data: { commentId: body.data.id } });
      const listed = await pm.get(`/cards/${task.key}/comments`).expect(200);
      expect(listed.body.data[0]).toMatchObject({ body: null, redacted: true });
    });
  });

  describe('watchers', () => {
    it('watch and unwatch, each once', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask());

      await qa.post(`/cards/${task.key}/watch`).expect(204);
      await qa.post(`/cards/${task.key}/watch`).expect(204);
      expect((await qa.get(`/cards/${task.key}`).expect(200)).body.data.watching).toBe(true);
      await qa.del(`/cards/${task.key}/watch`).expect(204);
      await qa.del(`/cards/${task.key}/watch`).expect(204);
      expect((await qa.get(`/cards/${task.key}`).expect(200)).body.data.watching).toBe(false);

      expect((await eventsOf(task.id)).map((event) => event.kind)).toEqual(['created', 'watch', 'unwatch']);
    });
  });

  describe('POST /cards/{key}/transition', () => {
    it('moves what has no route, and refuses what has one', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const task = await created(pm, aTask({ detail: { specialty: 'backend' } }));
      const moved = await pm.post(`/cards/${task.key}/transition`, { to: 'ready' }).expect(200);
      expect(moved.body.data.status).toBe('ready');
      await pm.post(`/cards/${task.key}/transition`, { to: 'backlog' }).expect(200);
      await pm.post(`/cards/${task.key}/transition`, { to: 'cancelled', reason: 'no' }).expect(200);

      const decision = await created(pm, aDecision());
      const refused = await pm.post(`/cards/${decision.key}/transition`, { to: 'decided' }).expect(409);
      expect(refused.body.error.code).toBe('hub.cards.type_mismatch');
    });
  });

  describe('GET /audit', () => {
    it('lists rows for owner and pm only, filtered and paged', async () => {
      const project = await aProject(app);
      const pm = await project.member(['pm']);
      const qa = await project.member(['qa']);
      const task = await created(pm, aTask());
      await qa.post(`/cards/${task.key}/comments`, { body: 'hi' }).expect(201);

      await qa.get('/audit').expect(403);
      const { body } = await pm.get('/audit', { limit: 1 }).expect(200);
      expect(body.data).toMatchObject([
        {
          action: 'cards.card.comment',
          targetId: task.key,
          actor: { kind: 'user', userId: qa.id },
          via: 'web',
        },
      ]);
      expect(typeof body.data[0].id).toBe('string');
      const next = await pm.get('/audit', { limit: 1, cursor: body.meta.pagination.nextCursor }).expect(200);
      expect(next.body.data[0].action).toBe('cards.task.create');
      expect(next.body.meta.pagination.nextCursor).toBeNull();

      const filtered = await pm.get('/audit', { action: 'cards.task', actor: pm.id }).expect(200);
      expect(filtered.body.data).toHaveLength(1);
      expect((await pm.get('/audit', { targetType: 'decision' }).expect(200)).body.data).toEqual([]);
    });
  });
});
