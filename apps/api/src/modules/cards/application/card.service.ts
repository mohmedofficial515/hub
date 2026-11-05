/**
 * @file `CardService.apply`: the single mutation path of every card (docs/01 §5.1).
 * @description Web, MCP and adapters all arrive here, so they cannot behave differently (docs/15 §6). One
 * apply is one transaction with exactly one event and one audit row per card touched:
 *
 *   validate → secret filter → project open → lock card → deleted? type? → permission → status machine →
 *   action's plan → write card + detail → prepared actions → extra writes → event → audit → watchers → outbox →
 *   follow-ups → unblock dependants → commit → publish to Redis.
 *
 * The actor's kind is recorded, never used to refuse (D27). Publishing happens after commit, so a reader
 * notified by SSE always sees the change.
 */
import {
  type Actor,
  CARD_MACHINES,
  CARD_TYPES,
  type CardType,
  type EventKind,
  isAllowed,
  type PermissionAction,
  permissionFactsFor,
  type RealtimeCardEvent,
  storedActorKind,
  type Transition,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { NotificationOutbox } from '@/infra/outbox/outbox';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import type {
  ApplyResult,
  CardActionDefinition,
  CardActionPlan,
  CardEventView,
  CardTarget,
  CardView,
  JsonObject,
} from '../domain/card-action';
import { CardActionRegistry } from './card-action.registry';
import { CardRepository } from './ports/card.repository';

function typeOfAction(action: PermissionAction): { type: CardType | null; verb: string } {
  const [prefix = '', verb = ''] = action.split('.');
  return { type: (CARD_TYPES as readonly string[]).includes(prefix) ? (prefix as CardType) : null, verb };
}

@Injectable()
export class CardService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly registry: CardActionRegistry,
    private readonly cards: CardRepository,
    private readonly audit: AuditService,
    private readonly outbox: NotificationOutbox,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Runs one action. `target` is null when the action creates a card. The project is always the actor's,
   * so a card of another project answers not found. Must be the outermost transaction, because it publishes
   * after commit; to do several things atomically, return `followUps` from the plan.
   */
  async apply(
    actor: Actor,
    target: CardTarget | null,
    action: PermissionAction,
    payload: unknown,
  ): Promise<ApplyResult> {
    if (this.txHost.isTransactionActive()) {
      throw new Error('CardService.apply must not run inside a transaction; use followUps in the plan');
    }
    const published: RealtimeCardEvent[] = [];
    const result = await this.txHost.withTransaction(() =>
      this.run(actor, target, action, payload, published),
    );
    for (const event of published) await this.realtime.publishCardEvent(event);
    return result;
  }

  private async run(
    actor: Actor,
    target: CardTarget | null,
    action: PermissionAction,
    rawPayload: unknown,
    published: RealtimeCardEvent[],
    trusted = false,
  ): Promise<ApplyResult> {
    const definition = this.registry.get(action);
    if (!definition) throw new Error(`No handler is registered for card action ${action}`);

    const payload = definition.payload.parse(rawPayload);
    assertNoSecrets(payload);

    const workspace = await this.cards.findWorkspace(actor.workspaceId);
    if (!workspace) throw new AppException('hub.workspaces.not_found');
    if (workspace.status === 'closed') throw new AppException('hub.workspaces.closed');

    const card = target ? await this.cards.lockCard(actor.workspaceId, target) : null;
    if (target && !card) throw new AppException('hub.cards.not_found');

    const { type: actionType, verb } = typeOfAction(action);
    this.assertApplicable(card, action, actionType, definition);
    if (!trusted) this.assertPermitted(actor, definition, payload, card);

    const now = this.clock.now();
    const plan = await definition.plan({ actor, card, payload, now });

    if (plan.noop && card) {
      const event = await this.cards.findLastEvent(card);
      return { card, event, followUps: [] };
    }

    return card
      ? this.update(actor, card, action, verb, plan, now, published)
      : this.create(actor, action, actionType, plan, now, published);
  }

  private assertApplicable(
    card: CardView | null,
    action: PermissionAction,
    actionType: CardType | null,
    definition: CardActionDefinition,
  ): void {
    if (!card) {
      if (!actionType) throw new Error(`Action ${action} needs a target card`);
      return;
    }
    if (actionType && card.type !== actionType) {
      throw new AppException('hub.cards.type_mismatch', { details: { action, type: card.type } });
    }
    if (card.archivedAt && !definition.allowOnDeleted) throw new AppException('hub.cards.archived');
  }

  private assertPermitted(
    actor: Actor,
    definition: CardActionDefinition,
    payload: unknown,
    card: CardView | null,
  ): void {
    if (!this.isPermitted(actor, definition, payload, card)) {
      throw new AppException(definition.forbiddenCode ?? 'hub.common.forbidden', {
        details: { action: definition.action },
      });
    }
  }

  /** The one permission decision. Actor kind plays no part, except that a system actor has no roles to check. */
  isPermitted(
    actor: Actor,
    definition: CardActionDefinition,
    payload: unknown,
    card: CardView | null,
  ): boolean {
    if (actor.kind === 'system') return true;
    const facts = card
      ? permissionFactsFor(card, actor.userId)
      : { routedRoles: [], specialty: null, isAssignee: false, isCreator: false, isDeliverer: false };
    const rows = definition.permissions?.(payload, card) ?? [definition.action];
    return rows.every((row) => isAllowed(row, actor.roles, facts));
  }

  private async create(
    actor: Actor,
    action: PermissionAction,
    actionType: CardType | null,
    plan: CardActionPlan,
    now: Date,
    published: RealtimeCardEvent[],
  ): Promise<ApplyResult> {
    if (!actionType || !plan.create) throw new Error(`Action ${action} did not return create fields`);
    const machine = CARD_MACHINES[actionType];
    const status = plan.create.status ?? machine.initial;
    if (!machine.statuses.includes(status)) {
      throw new Error(`Action ${action} chose status ${status}, unknown to ${actionType}`);
    }
    const card = await this.cards.insertCard({
      actor,
      type: actionType,
      status,
      closedAt: machine.terminal.includes(status) ? now : null,
      fields: plan.create,
      detail: plan.detail ?? {},
      now,
    });
    const defaultEvent = {
      kind: 'created' as EventKind,
      data: {
        snapshot: {
          title: card.title,
          status: card.status,
          priority: card.priority,
          ownerRole: card.ownerRole,
        },
      },
    };
    return this.finish(actor, card, action, plan, plan.event ?? defaultEvent, now, published, false);
  }

  private async update(
    actor: Actor,
    card: CardView,
    action: PermissionAction,
    verb: string,
    plan: CardActionPlan,
    now: Date,
    published: RealtimeCardEvent[],
  ): Promise<ApplyResult> {
    const machine = CARD_MACHINES[card.type];
    const transition: Transition<string> | undefined = machine.transitions[verb];
    if (typeOfAction(action).type && transition && !transition.from.includes(card.status)) {
      throw new AppException('hub.cards.invalid_transition', {
        details: { from: card.status, to: transition.to },
      });
    }
    const status = transition?.to ?? card.status;
    const moved = status !== card.status;
    const written = await this.cards.updateCard({
      card,
      status,
      closedAt: moved ? (machine.terminal.includes(status) ? now : null) : card.closedAt,
      patch: plan.patch ?? {},
      detail: plan.detail,
      now,
    });
    const named = plan.event ?? (moved ? { kind: 'status_changed' as EventKind, data: {} } : undefined);
    if (!named) throw new Error(`Action ${action} changes no status and names no event`);
    const event = {
      kind: named.kind,
      data: { ...named.data, ...(moved ? { from: card.status, to: status } : {}) },
    };
    const closedNow = moved && machine.terminal.includes(status);
    return this.finish(
      actor,
      written,
      action,
      plan,
      event,
      now,
      published,
      closedNow || plan.releasesDependants === true,
    );
  }

  /** Everything after the card row: exactly one event and one audit row, then the rest. */
  private async finish(
    actor: Actor,
    card: CardView,
    action: PermissionAction,
    plan: CardActionPlan,
    event: { readonly kind: EventKind; readonly data?: JsonObject },
    now: Date,
    published: RealtimeCardEvent[],
    releasesDependants: boolean,
  ): Promise<ApplyResult> {
    const prepared: ApplyResult[] = [];
    for (const step of plan.prepare?.(card) ?? []) {
      prepared.push(await this.run(actor, step.target, step.action, step.payload, published, step.trusted));
    }
    const extra = (await plan.write?.(card, prepared)) ?? {};
    const written: CardEventView = await this.cards.insertEvent({
      actor,
      card,
      kind: event.kind,
      data: { ...event.data, ...extra },
      now,
    });
    await this.audit.record(actor, {
      action: `cards.${action}`,
      targetType: card.type,
      targetId: card.key,
      summary: plan.summary ?? `${action} ${card.key}`,
    });

    const watchers = [
      ...(event.kind === 'created' && actor.userId ? [{ userId: actor.userId, reason: 'creator' }] : []),
      ...(plan.watchers ?? []),
    ];
    if (watchers.length > 0) await this.cards.addWatchers(card.id, watchers, now);

    await this.notify(actor, card, plan);

    published.push({
      eventId: written.id,
      workspaceId: card.workspaceId,
      cardId: card.id,
      cardKey: card.key,
      cardType: card.type,
      seq: written.seq,
      kind: written.kind,
      status: card.status,
      actorKind: storedActorKind(actor),
      actorId: actor.userId,
      via: actor.via,
      at: written.createdAt.toISOString(),
    });

    const followUps: ApplyResult[] = [];
    for (const followUp of plan.followUps?.(card) ?? []) {
      followUps.push(
        await this.run(
          actor,
          followUp.target,
          followUp.action,
          followUp.payload,
          published,
          followUp.trusted,
        ),
      );
    }
    if (releasesDependants) {
      for (const dependant of await this.cards.findDependants(card)) {
        followUps.push(
          await this.run(
            actor,
            { cardId: dependant.id },
            'card.unblock',
            { byCardKey: card.key },
            published,
            true,
          ),
        );
      }
    }
    return {
      card: { ...card, eventSeq: written.seq },
      event: written,
      followUps: [...prepared, ...followUps],
    };
  }

  private async notify(actor: Actor, card: CardView, plan: CardActionPlan): Promise<void> {
    for (const intent of plan.notify ?? []) {
      const found = await this.cards.findRecipients(
        card.workspaceId,
        intent.roles ?? [],
        intent.userIds ?? [],
      );
      const recipients = found.filter((recipient) => recipient.userId !== actor.userId);
      if (recipients.length === 0) continue;
      await this.outbox.write({
        workspaceId: card.workspaceId,
        cardId: card.id,
        kind: intent.kind,
        recipients,
        i18nKey: intent.i18nKey,
        params: { cardKey: card.key, title: card.title, ...intent.params },
        data: { cardKey: card.key, ...intent.data },
      });
    }
  }
}
