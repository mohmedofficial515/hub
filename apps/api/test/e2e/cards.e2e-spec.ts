/**
 * @file Acceptance of `CardService.apply` with the one working action, `task.create`.
 */
import type { Server } from 'node:http';

import { workspaceEventsChannel } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { OutboxProcessor } from '@/infra/outbox/outbox';
import { RedisClients } from '@/infra/redis/redis.module';
import { CardService } from '@/modules/cards';

import { agentActor, aMember, aWorkspace, userActor } from '../factories';
import { createTestApp, type TestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const taskPayload = (overrides: object = {}) => ({
  title: 'Add a refund button',
  detail: { specialty: 'backend' },
  ...overrides,
});

describe('CardService.apply', () => {
  let testApp: TestApp;
  let app: INestApplication;
  let service: CardService;
  const db = () => maintenanceClients().prisma;

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    service = app.get(CardService);
  });

  it('task create produces the card, its detail, one event and one audit row', async () => {
    const workspace = await aWorkspace(db(), { keyPrefix: 'GTV' });
    const member = await aMember(db(), workspace.id, ['backend']);
    const actor = userActor(member.id, workspace.id, ['backend']);

    const { card, event } = await service.apply(actor, null, 'task.create', taskPayload());

    expect(card).toMatchObject({
      key: 'GTV-1',
      type: 'task',
      status: 'backlog',
      priority: 'P2',
      ownerRole: 'backend',
      createdByKind: 'user',
      createdById: member.id,
      createdVia: 'web',
      eventSeq: 1,
    });
    expect(card.detail).toMatchObject({ specialty: 'backend', origin: 'manual' });
    expect(event).toMatchObject({ seq: 1, kind: 'created' });

    const events = await db().cardEvent.findMany({ where: { cardId: card.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ seq: 1, kind: 'created', actorKind: 'user', via: 'web' });

    const audit = await db().auditLog.findMany({ where: { targetId: card.key } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'cards.task.create',
      workspaceId: workspace.id,
      actorId: member.id,
      via: 'web',
    });

    const watchers = await db().cardWatcher.findMany({ where: { cardId: card.id } });
    expect(watchers).toMatchObject([{ userId: member.id, reason: 'creator' }]);
  });

  it('numbers keys per project', async () => {
    const one = await aWorkspace(db(), { keyPrefix: 'ONE' });
    const two = await aWorkspace(db(), { keyPrefix: 'TWO' });
    const a = await aMember(db(), one.id, ['pm']);
    const b = await aMember(db(), two.id, ['pm']);
    const actorA = userActor(a.id, one.id, ['pm']);
    const actorB = userActor(b.id, two.id, ['pm']);

    expect((await service.apply(actorA, null, 'task.create', taskPayload())).card.key).toBe('ONE-1');
    expect((await service.apply(actorA, null, 'task.create', taskPayload())).card.key).toBe('ONE-2');
    expect((await service.apply(actorB, null, 'task.create', taskPayload())).card.key).toBe('TWO-1');
  });

  it('D27: an agent with the same roles may do it, and the event records the agent', async () => {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, ['qa']);
    const actor = agentActor(member.id, workspace.id, ['qa']);

    const { card } = await service.apply(actor, null, 'task.create', taskPayload());

    expect(card).toMatchObject({ createdByKind: 'agent', createdById: member.id, createdVia: 'mcp' });
    const [event] = await db().cardEvent.findMany({ where: { cardId: card.id } });
    expect(event).toMatchObject({ actorKind: 'agent', actorId: member.id, via: 'mcp' });
    const [audit] = await db().auditLog.findMany({ where: { targetId: card.key } });
    expect(audit?.tokenId).toBe(actor.kind === 'agent' ? actor.tokenId : null);
  });

  it('a ready task writes the inbox row in the outbox, in each member locale, and not to the actor', async () => {
    const workspace = await aWorkspace(db(), { keyPrefix: 'OBX' });
    const creator = await aMember(db(), workspace.id, ['backend']);
    const colleague = await aMember(db(), workspace.id, ['backend'], { locale: 'ar' });
    await aMember(db(), workspace.id, ['frontend']);
    await db().channelPreference.create({
      data: { userId: colleague.id, workspaceId: workspace.id, channel: 'email' },
    });
    const actor = userActor(creator.id, workspace.id, ['backend']);

    const { card } = await service.apply(
      actor,
      null,
      'task.create',
      taskPayload({ detail: { specialty: 'backend', prompt: 'Do the thing' } }),
    );

    expect(card.status).toBe('ready');
    const inbox = await db().notification.findMany({
      where: { workspaceId: workspace.id },
      include: { jobs: true },
    });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ userId: colleague.id, kind: 'task_ready', cardId: card.id });
    expect(inbox[0]?.title).toBe('OBX-1 جاهزة: Add a refund button');
    expect(inbox[0]?.jobs).toMatchObject([{ channel: 'email', status: 'pending' }]);

    // Channels are deferred (docs/15 §3): with no sender a job ends skipped, not sent.
    await expect(app.get(OutboxProcessor).drainOnce()).resolves.toBe(1);
    const [job] = await db().notificationJob.findMany();
    expect(job).toMatchObject({ status: 'skipped', error: 'channel not connected' });
  });

  it('publishes to the workspace channel, once, after commit', async () => {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, ['pm']);
    const subscriber = app.get(RedisClients).createSubscriber();
    await subscriber.connect();
    await subscriber.subscribe(workspaceEventsChannel(workspace.id));
    const received: unknown[] = [];
    subscriber.on('message', (_channel, message) => received.push(JSON.parse(message)));

    const { card, event } = await service.apply(
      userActor(member.id, workspace.id, ['pm']),
      null,
      'task.create',
      taskPayload(),
    );

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(received).toEqual([
      expect.objectContaining({
        eventId: event.id,
        cardId: card.id,
        cardKey: card.key,
        kind: 'created',
        seq: 1,
        status: 'backlog',
        via: 'web',
      }),
    ]);
  });

  it('a secret in the payload is refused with the pattern, and nothing is written', async () => {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, ['pm']);
    const secret = `ghp_${'a1B2'.repeat(9)}`;

    await expect(
      service.apply(
        userActor(member.id, workspace.id, ['pm']),
        null,
        'task.create',
        taskPayload({ body: `token is ${secret}` }),
      ),
    ).rejects.toMatchObject({
      code: 'hub.security.secret_detected',
      details: { pattern: 'github_token', field: 'body' },
    });
    await expect(db().card.count({ where: { workspaceId: workspace.id } })).resolves.toBe(0);
    await expect(db().auditLog.count({ where: { workspaceId: workspace.id } })).resolves.toBe(0);
  });

  it('a closed project refuses the mutation', async () => {
    const workspace = await aWorkspace(db(), { status: 'closed' });
    const member = await aMember(db(), workspace.id, ['owner']);
    await expect(
      service.apply(userActor(member.id, workspace.id, ['owner']), null, 'task.create', taskPayload()),
    ).rejects.toMatchObject({ code: 'hub.workspaces.closed' });
  });

  it('a failure in the transaction rolls back card, sequence, event and audit', async () => {
    const workspace = await aWorkspace(db(), { keyPrefix: 'RBK' });
    const member = await aMember(db(), workspace.id, ['pm']);
    // Moving card_seq back by hand makes the next insert hit a duplicate key after the sequence bump.
    const actor = userActor(member.id, workspace.id, ['pm']);
    await service.apply(actor, null, 'task.create', taskPayload());
    await db().workspace.update({ where: { id: workspace.id }, data: { cardSeq: 0 } });

    await expect(service.apply(actor, null, 'task.create', taskPayload())).rejects.toMatchObject({
      code: 'P2002',
    });

    await expect(db().card.count({ where: { workspaceId: workspace.id } })).resolves.toBe(1);
    await expect(db().cardEvent.count({ where: { workspaceId: workspace.id } })).resolves.toBe(1);
    await expect(db().auditLog.count({ where: { workspaceId: workspace.id } })).resolves.toBe(1);
    const after = await db().workspace.findUniqueOrThrow({ where: { id: workspace.id } });
    expect(after.cardSeq).toBe(0);
  });

  it('refuses to run inside an outer transaction, because it publishes after commit', async () => {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, ['pm']);
    const { TransactionHost } = await import('@nestjs-cls/transactional');
    const txHost = app.get(TransactionHost);
    await expect(
      txHost.withTransaction(() =>
        service.apply(userActor(member.id, workspace.id, ['pm']), null, 'task.create', taskPayload()),
      ),
    ).rejects.toThrow('must not run inside a transaction');
  });

  it('POST /workspaces/:ws/cards goes through the same path over HTTP', async () => {
    const workspace = await aWorkspace(db(), { keyPrefix: 'WEB' });
    const member = await aMember(db(), workspace.id, ['frontend']);

    const response = await request(app.getHttpServer() as Server)
      .post(`/api/v1/workspaces/${workspace.slug}/cards`)
      .set('x-test-user', member.id)
      .send({ type: 'task', title: 'From HTTP', priority: 'P1', detail: { specialty: 'frontend' } })
      .expect(201);

    expect(response.body.data).toMatchObject({
      key: 'WEB-1',
      type: 'task',
      priority: 'P1',
      ownerRole: 'frontend',
      event: { seq: 1, kind: 'created' },
    });
    const [audit] = await db().auditLog.findMany({ where: { targetId: 'WEB-1' } });
    expect(audit?.summary).toBe('task.create WEB-1');
  });
});
