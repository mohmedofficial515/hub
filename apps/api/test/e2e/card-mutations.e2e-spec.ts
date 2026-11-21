/**
 * @file The path every later action takes: mutating an existing card.
 * @description Real actions arrive with H0-06, so these specs hand the registry stand-ins under real action
 * names through a spy, which cannot clash with the handlers those modules will add.
 */
import type { INestApplication } from '@nestjs/common';
import { z } from 'zod';

import {
  type CardActionDefinition,
  type CardActionPlan,
  CardActionRegistry,
  CardService,
} from '@/modules/cards';
import { AppException } from '@/shared/errors';

import { aMember, aWorkspace, userActor } from '../factories';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const task = { title: 'A task', detail: { specialty: 'backend', prompt: 'Do it' } };

function standIn(
  action: CardActionDefinition['action'],
  plan: () => CardActionPlan,
  extra: Partial<CardActionDefinition> = {},
): CardActionDefinition {
  return { action, payload: z.unknown(), plan, ...extra };
}

describe('CardService.apply on an existing card', () => {
  let app: INestApplication;
  let service: CardService;
  let registry: CardActionRegistry;
  const db = () => maintenanceClients().prisma;

  /** Serves `definition` by its action name and leaves every other action to the real registry. */
  function serve(...definitions: CardActionDefinition[]): void {
    const real = registry.get.bind(registry);
    jest
      .spyOn(registry, 'get')
      .mockImplementation((action) => definitions.find((d) => d.action === action) ?? real(action));
  }

  async function aReadyTask(roles: Parameters<typeof aMember>[2] = ['pm']) {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, roles);
    const actor = userActor(member.id, workspace.id, roles);
    const { card } = await service.apply(actor, null, 'task.create', task);
    return { workspace, member, actor, card };
  }

  beforeAll(async () => {
    ({ app } = await createTestApp());
    service = app.get(CardService);
    registry = app.get(CardActionRegistry, { strict: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves the status through the machine: one more event with seq n+1, from and to, one more audit row', async () => {
    const { actor, card } = await aReadyTask();
    serve(
      standIn('task.claim', () => ({
        patch: { assigneeId: actor.userId },
        detail: { claimedById: actor.userId },
        event: { kind: 'claimed', data: { userId: actor.userId } },
      })),
    );

    const result = await service.apply(actor, { cardKey: card.key }, 'task.claim', {});

    expect(result.card).toMatchObject({ status: 'claimed', assigneeId: actor.userId, eventSeq: 2 });
    expect(result.card.detail).toMatchObject({ claimedById: actor.userId, specialty: 'backend' });
    expect(result.event).toMatchObject({ seq: 2, kind: 'claimed' });
    expect(result.event.data).toEqual({ userId: actor.userId, from: 'ready', to: 'claimed' });
    const events = await db().cardEvent.findMany({ where: { cardId: card.id }, orderBy: { seq: 'asc' } });
    expect(events.map((event) => [event.seq, event.kind])).toEqual([
      [1, 'created'],
      [2, 'claimed'],
    ]);
    await expect(db().auditLog.count({ where: { targetId: card.key } })).resolves.toBe(2);
  });

  it('defaults to status_changed, and sets closed_at on a terminal status and clears it on leaving', async () => {
    const { actor, card } = await aReadyTask();
    serve(
      standIn('task.cancel', () => ({})),
      standIn('task.reopen', () => ({})),
    );

    const cancelled = await service.apply(actor, { cardId: card.id }, 'task.cancel', {});
    expect(cancelled.event.kind).toBe('status_changed');
    expect(cancelled.card.status).toBe('cancelled');
    expect(cancelled.card.closedAt).toBeInstanceOf(Date);

    const reopened = await service.apply(actor, { cardId: card.id }, 'task.reopen', {});
    expect(reopened.card.status).toBe('ready');
    expect(reopened.card.closedAt).toBeNull();
  });

  it('an invalid transition is a 409 with from and to, and writes nothing', async () => {
    const { actor, card } = await aReadyTask();
    serve(standIn('task.start', () => ({})));

    await expect(service.apply(actor, { cardKey: card.key }, 'task.start', {})).rejects.toMatchObject({
      code: 'hub.cards.invalid_transition',
      details: { from: 'ready', to: 'in_progress' },
    });
    await expect(db().cardEvent.count({ where: { cardId: card.id } })).resolves.toBe(1);
  });

  it('checks the grants against the card: specialty, assignee, routed, creator', async () => {
    const { workspace, card } = await aReadyTask();
    serve(
      standIn('task.claim', () => ({ event: { kind: 'claimed' } }), {
        forbiddenCode: 'hub.tasks.specialty_role_mismatch',
      }),
      standIn('card.edit_content', () => ({ event: { kind: 'field_changed' } })),
    );

    const designer = await aMember(db(), workspace.id, ['designer']);
    await expect(
      service.apply(
        userActor(designer.id, workspace.id, ['designer']),
        { cardKey: card.key },
        'task.claim',
        {},
      ),
    ).rejects.toMatchObject({ code: 'hub.tasks.specialty_role_mismatch' });
    await expect(
      service.apply(
        userActor(designer.id, workspace.id, ['designer']),
        { cardKey: card.key },
        'card.edit_content',
        {},
      ),
    ).rejects.toMatchObject({ code: 'hub.common.forbidden' });

    const backend = await aMember(db(), workspace.id, ['backend']);
    const claimed = await service.apply(
      userActor(backend.id, workspace.id, ['backend']),
      { cardKey: card.key },
      'task.claim',
      {},
    );
    expect(claimed.card.status).toBe('claimed');
  });

  it('a card of another project answers not found', async () => {
    const { card } = await aReadyTask();
    const other = await aWorkspace(db());
    const stranger = await aMember(db(), other.id, ['owner']);
    serve(standIn('task.claim', () => ({ event: { kind: 'claimed' } })));

    await expect(
      service.apply(userActor(stranger.id, other.id, ['owner']), { cardId: card.id }, 'task.claim', {}),
    ).rejects.toMatchObject({ code: 'hub.cards.not_found' });
  });

  it('an action of another type is a type mismatch', async () => {
    const { actor, card } = await aReadyTask();
    serve(standIn('decision.decide', () => ({ event: { kind: 'decided' } })));

    await expect(service.apply(actor, { cardKey: card.key }, 'decision.decide', {})).rejects.toMatchObject({
      code: 'hub.cards.type_mismatch',
    });
  });

  it('D28: delete hides, other actions refuse a deleted card, and restore brings it back', async () => {
    const { actor, card, workspace } = await aReadyTask();
    serve(
      standIn('card.delete', () => ({ patch: { archivedAt: new Date() }, event: { kind: 'archived' } })),
      standIn('card.restore', () => ({ patch: { archivedAt: null }, event: { kind: 'restored' } }), {
        allowOnDeleted: true,
      }),
      standIn('task.claim', () => ({ event: { kind: 'claimed' } })),
    );

    const deleted = await service.apply(actor, { cardKey: card.key }, 'card.delete', {});
    expect(deleted.card.archivedAt).toBeInstanceOf(Date);
    await expect(service.apply(actor, { cardKey: card.key }, 'task.claim', {})).rejects.toMatchObject({
      code: 'hub.cards.archived',
    });

    const restored = await service.apply(actor, { cardKey: card.key }, 'card.restore', {});
    expect(restored.card.archivedAt).toBeNull();
    // No hard delete: the row and its whole history stay (D17).
    await expect(db().cardEvent.count({ where: { workspaceId: workspace.id } })).resolves.toBe(3);
  });

  it('followUps run in the same transaction, each with its own event and audit row', async () => {
    const { actor, card, workspace } = await aReadyTask();
    serve(
      standIn('card.link', () => ({
        event: { kind: 'linked' },
        followUps: () => [{ action: 'task.create', target: null, payload: task }],
      })),
    );

    const result = await service.apply(actor, { cardKey: card.key }, 'card.link', {});

    expect(result.followUps).toHaveLength(1);
    expect(result.followUps[0]?.card.title).toBe('A task');
    await expect(db().card.count({ where: { workspaceId: workspace.id } })).resolves.toBe(2);
    await expect(db().cardEvent.count({ where: { workspaceId: workspace.id } })).resolves.toBe(3);
  });

  it('a follow-up that fails rolls back the whole apply', async () => {
    const { actor, card, workspace } = await aReadyTask();
    serve(
      standIn('card.link', () => ({
        event: { kind: 'linked' },
        followUps: () => [{ action: 'card.watch', target: { cardKey: card.key }, payload: {} }],
      })),
      standIn('card.watch', () => {
        throw new AppException('hub.common.conflict');
      }),
    );

    await expect(service.apply(actor, { cardKey: card.key }, 'card.link', {})).rejects.toMatchObject({
      code: 'hub.common.conflict',
    });
    await expect(db().cardEvent.count({ where: { workspaceId: workspace.id } })).resolves.toBe(1);
  });

  it('write joins the transaction, and what it returns joins the event data', async () => {
    const { actor, card } = await aReadyTask();
    serve(
      standIn('card.comment', () => ({
        event: { kind: 'commented' },
        write: async () => ({ commentId: 'c-1' }),
      })),
    );

    const result = await service.apply(actor, { cardKey: card.key }, 'card.comment', {});
    expect(result.event.data).toEqual({ commentId: 'c-1' });
  });

  it('an action that moves nothing and names no event is a programming error', async () => {
    const { actor, card } = await aReadyTask();
    serve(standIn('card.watch', () => ({})));

    await expect(service.apply(actor, { cardKey: card.key }, 'card.watch', {})).rejects.toThrow(
      'names no event',
    );
  });

  it('a concurrent mutation of one card keeps seq gapless', async () => {
    const { actor, card } = await aReadyTask();
    serve(standIn('card.comment', () => ({ event: { kind: 'commented' } })));

    await Promise.all(
      Array.from({ length: 5 }, () => service.apply(actor, { cardKey: card.key }, 'card.comment', {})),
    );

    const events = await db().cardEvent.findMany({ where: { cardId: card.id }, orderBy: { seq: 'asc' } });
    expect(events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
