/**
 * @file H1-02: one card per session, whichever of the hook and `log_session` comes first (docs/05 §5), and the context
 * a new chat receives. The grace job is run by hand after moving the clock, because the delay is BullMQ's.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type HookSessionPayload, hookSessionPayloadSchema, type MemberActor } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { FakeClock } from '@/infra/clock/clock';
import { SessionsService } from '@/modules/capture';
import { DocsIndexerService } from '@/modules/docs';

import { agentActor, aMember, aWorkspace } from '../factories';
import { aToken } from '../helpers/auth';
import { db } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';

const FACTS = {
  commits: [{ sha: 'abcdef1234567', message: 'fix the refund' }],
  filesChanged: 3,
  additions: 10,
  deletions: 2,
};

describe('session capture', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let sessions: SessionsService;
  let counter = 0;

  beforeAll(async () => {
    ({ app, clock } = await createTestApp({ realAuth: true }));
    sessions = app.get(SessionsService, { strict: false });
  });

  async function setup() {
    const workspace = await aWorkspace(db());
    const user = await aMember(db(), workspace.id, ['backend']);
    await db().user.update({ where: { id: user.id }, data: { defaultWorkspaceId: workspace.id } });
    const actor: MemberActor = agentActor(user.id, workspace.id, ['backend']);
    counter += 1;
    return { workspace, user, actor, sessionId: `session-${counter}-${Date.now()}` };
  }

  const payload = (sessionId: string, over: object = {}): HookSessionPayload =>
    hookSessionPayloadSchema.parse({
      sessionId,
      cwd: 'F:/Goteav/backend',
      branch: 'feat/refund',
      endedAt: clock.now().toISOString(),
      ...FACTS,
      ...over,
    });

  const sessionCards = (workspaceId: string) =>
    db().card.findMany({ where: { workspaceId, type: 'change' }, include: { change: true } });

  const afterGrace = () => clock.advance(11 * 60_000);

  it('hook then summary: one card, upgraded, with the facts', async () => {
    const { workspace, actor, sessionId } = await setup();
    await sessions.ingestHook(actor, payload(sessionId));
    expect(await sessionCards(workspace.id)).toHaveLength(0);

    await sessions.logSummary(actor, { sessionId, changed: '- Fixed the refund', remaining: 'tests' });
    afterGrace();
    await sessions.reconcile({ workspaceId: workspace.id, sessionId });

    const cards = await sessionCards(workspace.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('جلسة: Fixed the refund');
    expect(cards[0]?.change).toMatchObject({ commitCount: 1, filesChanged: 3, kind: 'session' });
  });

  it('summary then hook: one card, facts merged', async () => {
    const { workspace, actor, sessionId } = await setup();
    await sessions.logSummary(actor, { sessionId, changed: 'Did it' });
    const hook = await sessions.ingestHook(actor, payload(sessionId));
    expect(hook.cardKey).not.toBeNull();
    const cards = await sessionCards(workspace.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.change).toMatchObject({ commitCount: 1, additions: 10 });
    expect(await sessions.withoutSummary(actor)).toEqual([]);
  });

  it('hook only: a facts-only card after the grace period, listed for the member, then upgraded', async () => {
    const { workspace, actor, sessionId } = await setup();
    await sessions.ingestHook(actor, payload(sessionId));
    await sessions.reconcile({ workspaceId: workspace.id, sessionId });
    expect(await sessionCards(workspace.id)).toHaveLength(0);

    afterGrace();
    await sessions.reconcile({ workspaceId: workspace.id, sessionId });
    const [card] = await sessionCards(workspace.id);
    expect(card?.title).toBe('جلسة على feat/refund: fix the refund');
    expect(card?.createdByKind).toBe('system');
    expect(card?.change?.session).toMatchObject({ noSummary: true });
    const listed = await sessions.withoutSummary(actor);
    expect(listed.map((session) => session.cardKey)).toEqual([card?.key]);

    await sessions.logSummary(actor, { sessionId, changed: 'Now with words' });
    const cards = await sessionCards(workspace.id);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.title).toBe('جلسة: Now with words');
    expect(cards[0]?.change?.session).toMatchObject({ noSummary: false });
    expect(await sessions.withoutSummary(actor)).toEqual([]);
    const events = await db().cardEvent.findMany({
      where: { workspaceId: workspace.id, cardId: cards[0]?.id ?? '' },
    });
    expect(events.find((event) => event.kind === 'session_logged')?.data).toMatchObject({ upgraded: true });
  });

  it('an idle session makes no card', async () => {
    const { workspace, actor, sessionId } = await setup();
    await sessions.ingestHook(
      actor,
      payload(sessionId, { commits: [], filesChanged: 0, additions: 0, deletions: 0 }),
    );
    afterGrace();
    await sessions.reconcile({ workspaceId: workspace.id, sessionId });
    expect(await sessionCards(workspace.id)).toHaveLength(0);
    expect(await sessions.withoutSummary(actor)).toEqual([]);
  });

  it('a repeat updates the card and creates each handoff and follow-up once', async () => {
    const { workspace, actor, sessionId } = await setup();
    const input = {
      sessionId,
      changed: 'Changed the contract',
      handoffs: [
        { toRole: 'frontend' as const, kind: 'contract' as const, title: 'New field', summary: 'Add it' },
      ],
      followUps: [{ title: 'Write the e2e', specialty: 'qa' as const }],
    };
    const first = await sessions.logSummary(actor, input);
    expect(first.followUpKeys).toHaveLength(2);
    const again = await sessions.logSummary(actor, { ...input, changed: 'Changed the contract, again' });
    expect(again.followUpKeys).toHaveLength(0);
    const types = await db().card.groupBy({
      by: ['type'],
      where: { workspaceId: workspace.id },
      _count: { _all: true },
    });
    expect(Object.fromEntries(types.map((row) => [row.type, row._count._all]))).toEqual({
      change: 1,
      handoff: 1,
      task: 1,
    });
    const task = await db().card.findFirst({
      where: { workspaceId: workspace.id, type: 'task' },
      include: { task: true },
    });
    expect(task?.task?.origin).toBe('session_followup');
    expect(task?.status).toBe('backlog');
  });

  it('links keys named in the text when they exist, and refuses a key given that does not', async () => {
    const { workspace, actor, sessionId } = await setup();
    await expect(
      sessions.logSummary(actor, { sessionId, changed: 'x', cardKeys: [`${workspace.keyPrefix}-999`] }),
    ).rejects.toMatchObject({ code: 'hub.cards.not_found' });
    await sessions.logSummary(actor, { sessionId, changed: `see ${workspace.keyPrefix}-999, gone` });
    expect(await db().cardLink.count({ where: { workspaceId: workspace.id } })).toBe(0);
  });

  it('refuses a secret in a summary and in a commit message, without storing it', async () => {
    const { workspace, actor, sessionId } = await setup();
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    await expect(sessions.logSummary(actor, { sessionId, changed: `used ${secret}` })).rejects.toMatchObject({
      code: 'hub.security.secret_detected',
    });
    await expect(
      sessions.ingestHook(
        actor,
        payload(sessionId, { commits: [{ sha: 'abcdef1234567', message: `add ${secret}` }] }),
      ),
    ).rejects.toMatchObject({ code: 'hub.security.secret_detected' });
    expect(await db().sessionLog.count({ where: { workspaceId: workspace.id, sessionId } })).toBe(0);
  });

  describe('over HTTP', () => {
    const server = () => app.getHttpServer() as Server;

    it('POST /capture/session takes a hook token and answers which project', async () => {
      const { workspace, user, sessionId } = await setup();
      const { token } = await aToken(db(), user.id, 'hook');
      const answer = await request(server())
        .post('/api/v1/capture/session')
        .set('authorization', `Bearer ${token}`)
        .send({ sessionId, cwd: 'F:/x', endedAt: clock.now().toISOString(), ...FACTS })
        .expect(202);
      expect(answer.body.data).toMatchObject({ cardKey: null, project: workspace.slug });

      await request(server())
        .post('/api/v1/capture/session')
        .set('authorization', `Bearer ${token}`)
        .send({ sessionId: 'x' })
        .expect(400);
      await request(server()).post('/api/v1/capture/session').send({}).expect(401);
    });

    it('GET /me/context states the active project, by header, by folder, then by default', async () => {
      const { workspace, user } = await setup();
      const other = await aWorkspace(db());
      await db().workspace.update({ where: { id: other.id }, data: { repoPaths: ['F:/Goteav/other'] } });
      await db().membership.create({ data: { workspaceId: other.id, userId: user.id, roles: ['qa'] } });
      const { token } = await aToken(db(), user.id, 'hook');
      const get = (query: object, header?: string) => {
        const test = request(server())
          .get('/api/v1/me/context')
          .query(query)
          .set('authorization', `Bearer ${token}`);
        if (header) void test.set('x-hub-project', header);
        return test.expect(200);
      };

      const plain = await get({});
      expect(plain.body.data.project).toBe(workspace.slug);
      expect(plain.body.data.text).toContain(`Active project: ${workspace.name} (slug \`${workspace.slug}\``);
      expect((await get({ cwd: 'F:\\Goteav\\other\\src' })).body.data.project).toBe(other.slug);
      expect((await get({ cwd: 'F:/Goteav/other' }, workspace.slug)).body.data.project).toBe(workspace.slug);
      expect(plain.body.data.text.length).toBeLessThanOrEqual(8500);
    });

    it('GET /me/context gives the project brief and the doc index, with the rule to search before writing (docs/16 §10)', async () => {
      const { workspace, user } = await setup();
      await db().workspace.update({
        where: { id: workspace.id },
        data: {
          description: 'Hub for the travel team.\n\nIt holds **every** decision.',
          goals: 'Ship the queue.',
        },
      });
      const folder = mkdtempSync(join(tmpdir(), 'hub-e2e-context-'));
      try {
        writeFileSync(join(folder, 'refunds.md'), '# Refund rules\n\nWallet first.\n');
        const source = await db().source.create({
          data: {
            workspaceId: workspace.id,
            kind: 'local_path',
            name: 'docs',
            config: { path: folder, purpose: 'docs' },
          },
        });
        await app.get(DocsIndexerService, { strict: false }).index({
          id: source.id,
          name: 'docs',
          workspaceId: workspace.id,
          config: { path: folder, purpose: 'docs' },
        });
        const { token } = await aToken(db(), user.id, 'hook');
        const answer = await request(server())
          .get('/api/v1/me/context')
          .set('authorization', `Bearer ${token}`)
          .expect(200);
        const text = answer.body.data.text as string;
        expect(text).toContain('## Project brief\nHub for the travel team. It holds **every** decision.');
        expect(text).toContain('Goals: Ship the queue.');
        expect(text).toMatch(/## Documents \(1\)/);
        expect(text).toMatch(new RegExp(`- ${workspace.keyPrefix}-\\d+ — Refund rules · refunds\\.md`));
        expect(text).toContain('search them (hub.search_docs)');
        // The lists still come first.
        expect(text.indexOf('## Ready tasks')).toBeLessThan(text.indexOf('## Project brief'));
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    });

    it('a hook token reaches no other project route', async () => {
      const { workspace, user } = await setup();
      const { token } = await aToken(db(), user.id, 'hook');
      await request(server())
        .get(`/api/v1/workspaces/${workspace.slug}/cards`)
        .set('authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
