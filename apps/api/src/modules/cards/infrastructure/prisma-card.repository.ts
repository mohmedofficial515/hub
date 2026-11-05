/**
 * @file Prisma implementation of the card core.
 * @description Card keys come from an atomic bump of `workspaces.card_seq`; event numbers from an atomic bump
 * of `cards.event_seq`. `cards.search_vector` is kept by the trigger from migration 0000_init.
 */
import { type Actor, type CardType, type EventKind, storedActorKind } from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type Prisma } from '@/generated/prisma/client';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import {
  CardRepository,
  type CommentRow,
  type LinkEdge,
  type Recipient,
  type WorkspaceHeader,
} from '../application/ports/card.repository';
import type {
  CardCreateFields,
  CardEventView,
  CardPatch,
  CardTarget,
  CardView,
  JsonObject,
} from '../domain/card-action';

const DETAIL_RELATION: Record<CardType, keyof Prisma.CardInclude> = {
  task: 'task',
  decision: 'decision',
  need: 'need',
  change: 'change',
  handoff: 'handoff',
  redesign: 'redesign',
  doc: 'doc',
  release: 'release',
  idea: 'idea',
  plan: 'plan',
};

export const INCLUDE_DETAILS = Object.fromEntries(
  Object.values(DETAIL_RELATION).map((relation) => [relation, true]),
) as Prisma.CardInclude;

/** Prisma delegate of a type's detail table, typed by what this file needs. */
interface DetailDelegate {
  create(args: { data: JsonObject }): Promise<unknown>;
  update(args: { where: { cardId: string }; data: JsonObject }): Promise<unknown>;
}

const DETAIL_DELEGATE: Record<CardType, string> = {
  task: 'taskDetail',
  decision: 'decisionDetail',
  need: 'needDetail',
  change: 'changeDetail',
  handoff: 'handoffDetail',
  redesign: 'redesignDetail',
  doc: 'docDetail',
  release: 'releaseDetail',
  idea: 'ideaDetail',
  plan: 'planDetail',
};

function toJson(value: JsonObject): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function targetWhere(workspaceId: string, target: CardTarget): Prisma.CardWhereInput {
  return 'cardId' in target ? { workspaceId, id: target.cardId } : { workspaceId, key: target.cardKey };
}

export function toView(row: Record<string, unknown> & { type: string }): CardView {
  const { searchVector: _ignored, ...rest } = row;
  const details = Object.values(DETAIL_RELATION).map((relation) => {
    const value = rest[relation];
    delete rest[relation];
    return { relation, value };
  });
  const relation = DETAIL_RELATION[row.type as CardType];
  const detail = details.find((entry) => entry.relation === relation)?.value ?? null;
  return { ...rest, detail } as unknown as CardView;
}

@Injectable()
export class PrismaCardRepository extends CardRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {
    super();
  }

  private get tx() {
    return this.txHost.tx;
  }

  private detailDelegate(type: CardType): DetailDelegate {
    return (this.tx as unknown as Record<string, DetailDelegate>)[DETAIL_DELEGATE[type]] as DetailDelegate;
  }

  async findWorkspace(workspaceId: string): Promise<WorkspaceHeader | null> {
    return this.tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, status: true, slug: true, defaultLocale: true },
    });
  }

  async lockCard(workspaceId: string, target: CardTarget): Promise<CardView | null> {
    const rows =
      'cardId' in target
        ? await this.tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM cards WHERE workspace_id = ${workspaceId}::uuid AND id = ${target.cardId}::uuid FOR UPDATE`
        : await this.tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM cards WHERE workspace_id = ${workspaceId}::uuid AND key = ${target.cardKey} FOR UPDATE`;
    const id = rows[0]?.id;
    return id ? this.findCard(workspaceId, { cardId: id }) : null;
  }

  async findCard(workspaceId: string, target: CardTarget): Promise<CardView | null> {
    const row = await this.tx.card.findFirst({
      where: targetWhere(workspaceId, target),
      include: INCLUDE_DETAILS,
    });
    return row ? toView(row) : null;
  }

  async insertCard(input: {
    actor: Actor;
    type: CardType;
    status: string;
    closedAt: Date | null;
    fields: CardCreateFields;
    detail: JsonObject;
    now: Date;
  }): Promise<CardView> {
    const { actor, fields, now, type } = input;
    const workspaceId = actor.workspaceId;
    const { cardSeq: seq, keyPrefix } = await this.tx.workspace.update({
      where: { id: workspaceId },
      data: { cardSeq: { increment: 1 } },
      select: { cardSeq: true, keyPrefix: true },
    });
    const { id } = await this.tx.card.create({
      data: {
        workspaceId,
        seq,
        key: `${keyPrefix}-${seq}`,
        type,
        title: fields.title,
        body: fields.body ?? null,
        status: input.status,
        priority: fields.priority ?? 'P2',
        ownerRole: fields.ownerRole ?? null,
        assigneeId: fields.assigneeId ?? null,
        createdByKind: storedActorKind(actor),
        createdById: actor.userId,
        createdVia: actor.via,
        source: fields.source ?? 'manual',
        externalKey: fields.externalKey ?? null,
        module: fields.module ?? null,
        repo: fields.repo ?? null,
        branch: fields.branch ?? null,
        commitSha: fields.commitSha ?? null,
        dueAt: fields.dueAt ?? null,
        closedAt: input.closedAt,
        tags: [...(fields.tags ?? [])],
        lastEventAt: now,
        createdAt: now,
      },
      select: { id: true },
    });
    await this.detailDelegate(type).create({ data: { cardId: id, ...input.detail } });
    return this.reload(workspaceId, id);
  }

  async updateCard(input: {
    card: CardView;
    status: string;
    closedAt: Date | null;
    patch: CardPatch;
    detail: JsonObject | undefined;
    now: Date;
  }): Promise<CardView> {
    const { card, patch } = input;
    const { tags, ...fields } = patch;
    await this.tx.card.update({
      where: { id: card.id, workspaceId: card.workspaceId },
      data: {
        ...fields,
        ...(tags === undefined ? {} : { tags: [...tags] }),
        status: input.status,
        closedAt: input.closedAt,
        lastEventAt: input.now,
      },
    });
    if (input.detail) {
      await this.detailDelegate(card.type).update({ where: { cardId: card.id }, data: input.detail });
    }
    return this.reload(card.workspaceId, card.id);
  }

  async insertEvent(input: {
    actor: Actor;
    card: CardView;
    kind: EventKind;
    data: JsonObject;
    now: Date;
  }): Promise<CardEventView> {
    const { actor, card, now } = input;
    const { eventSeq } = await this.tx.card.update({
      where: { id: card.id, workspaceId: card.workspaceId },
      data: { eventSeq: { increment: 1 } },
      select: { eventSeq: true },
    });
    const row = await this.tx.cardEvent.create({
      data: {
        workspaceId: card.workspaceId,
        cardId: card.id,
        seq: eventSeq,
        kind: input.kind,
        actorKind: storedActorKind(actor),
        actorId: actor.userId,
        via: actor.via,
        data: toJson(input.data),
        createdAt: now,
      },
    });
    return {
      id: row.id,
      cardId: row.cardId,
      seq: row.seq,
      kind: input.kind,
      data: input.data,
      createdAt: row.createdAt,
    };
  }

  async addWatchers(
    cardId: string,
    watchers: readonly { userId: string; reason: string }[],
    now: Date,
  ): Promise<void> {
    await this.tx.cardWatcher.createMany({
      data: watchers.map((watcher) => ({ cardId, ...watcher, createdAt: now })),
      skipDuplicates: true,
    });
  }

  async findRecipients(
    workspaceId: string,
    roles: readonly string[],
    userIds: readonly string[],
  ): Promise<Recipient[]> {
    const rows = await this.tx.membership.findMany({
      where: {
        workspaceId,
        status: 'active',
        user: { status: 'active' },
        OR: [{ roles: { hasSome: [...roles] } }, { userId: { in: [...userIds] } }],
      },
      select: { userId: true, user: { select: { locale: true } } },
    });
    return rows.map((row) => ({ userId: row.userId, locale: row.user.locale }));
  }

  async findCardsByKeys(workspaceId: string, keys: readonly string[]): Promise<CardView[]> {
    if (keys.length === 0) return [];
    const rows = await this.tx.card.findMany({
      where: { workspaceId, key: { in: [...keys] } },
      include: INCLUDE_DETAILS,
    });
    return rows.map((row) => toView(row));
  }

  async findLastEvent(card: CardView): Promise<CardEventView> {
    const row = await this.tx.cardEvent.findFirstOrThrow({
      where: { workspaceId: card.workspaceId, cardId: card.id },
      orderBy: { seq: 'desc' },
    });
    return {
      id: row.id,
      cardId: row.cardId,
      seq: row.seq,
      kind: row.kind as EventKind,
      data: row.data as JsonObject,
      createdAt: row.createdAt,
    };
  }

  async updateDetail(card: CardView, detail: JsonObject): Promise<void> {
    await this.detailDelegate(card.type).update({ where: { cardId: card.id }, data: detail });
  }

  async findDependants(card: CardView): Promise<CardView[]> {
    const rows = await this.tx.card.findMany({
      where: {
        workspaceId: card.workspaceId,
        closedAt: null,
        archivedAt: null,
        linksTo: { some: { kind: 'blocks', fromCardId: card.id } },
      },
      include: INCLUDE_DETAILS,
    });
    return rows.map((row) => toView(row));
  }

  async hasOpenBlockers(card: CardView): Promise<boolean> {
    const found = await this.tx.cardLink.findFirst({
      where: {
        workspaceId: card.workspaceId,
        toCardId: card.id,
        kind: 'blocks',
        from: { closedAt: null, archivedAt: null },
      },
      select: { id: true },
    });
    return found !== null;
  }

  async findWatcherIds(cardId: string): Promise<string[]> {
    const rows = await this.tx.cardWatcher.findMany({ where: { cardId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  async removeWatcher(cardId: string, userId: string): Promise<boolean> {
    const { count } = await this.tx.cardWatcher.deleteMany({ where: { cardId, userId } });
    return count > 0;
  }

  async isWatching(cardId: string, userId: string): Promise<boolean> {
    const found = await this.tx.cardWatcher.findUnique({
      where: { cardId_userId: { cardId, userId } },
      select: { userId: true },
    });
    return found !== null;
  }

  async findUserNames(ids: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.tx.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(rows.map((row) => [row.id, row.displayName]));
  }

  async readSetting(workspaceId: string, key: string): Promise<unknown> {
    const row = await this.tx.workspaceSetting.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
      select: { value: true },
    });
    return row?.value ?? undefined;
  }

  async readSettings(
    workspaceIds: readonly string[],
    keys: readonly string[],
  ): Promise<Map<string, Map<string, unknown>>> {
    const rows = await this.tx.workspaceSetting.findMany({
      where: { workspaceId: { in: [...workspaceIds] }, key: { in: [...keys] } },
      select: { workspaceId: true, key: true, value: true },
    });
    const byProject = new Map<string, Map<string, unknown>>();
    for (const row of rows) {
      const settings = byProject.get(row.workspaceId) ?? new Map<string, unknown>();
      settings.set(row.key, row.value);
      byProject.set(row.workspaceId, settings);
    }
    return byProject;
  }

  async insertComment(input: { actor: Actor; card: CardView; body: string; now: Date }): Promise<CommentRow> {
    const { actor, card, now } = input;
    if (!actor.userId) throw new Error('A comment needs a member behind it');
    const row = await this.tx.cardComment.create({
      data: {
        workspaceId: card.workspaceId,
        cardId: card.id,
        authorKind: storedActorKind(actor),
        authorId: actor.userId,
        via: actor.via,
        body: input.body,
        createdAt: now,
      },
    });
    await this.tx.card.update({
      where: { id: card.id, workspaceId: card.workspaceId },
      data: { commentCount: { increment: 1 } },
    });
    return row;
  }

  async findComment(card: CardView, commentId: string): Promise<CommentRow | null> {
    return this.tx.cardComment.findFirst({
      where: { id: commentId, workspaceId: card.workspaceId, cardId: card.id },
    });
  }

  async updateCommentBody(card: CardView, commentId: string, body: string, now: Date): Promise<void> {
    await this.tx.cardComment.updateMany({
      where: { id: commentId, workspaceId: card.workspaceId, cardId: card.id },
      data: { body, editedAt: now },
    });
  }

  async redactComment(card: CardView, commentId: string, now: Date): Promise<void> {
    await this.tx.cardComment.updateMany({
      where: { id: commentId, workspaceId: card.workspaceId, cardId: card.id },
      data: { body: '', bodyRedactedAt: now },
    });
    await this.tx.$executeRaw`
      UPDATE card_events SET data = data - 'excerpt'
      WHERE workspace_id = ${card.workspaceId}::uuid AND card_id = ${card.id}::uuid
        AND kind = 'commented' AND data->>'commentId' = ${commentId}`;
  }

  async findLink(card: CardView, edge: LinkEdge): Promise<boolean> {
    const found = await this.tx.cardLink.findFirst({
      where: { workspaceId: card.workspaceId, ...edge },
      select: { id: true },
    });
    return found !== null;
  }

  async insertLink(card: CardView, edge: LinkEdge, createdById: string | null): Promise<void> {
    await this.tx.cardLink.create({ data: { workspaceId: card.workspaceId, ...edge, createdById } });
  }

  async deleteLink(card: CardView, edge: LinkEdge): Promise<void> {
    await this.tx.cardLink.deleteMany({ where: { workspaceId: card.workspaceId, ...edge } });
  }

  async findLinkTargets(card: CardView, ids: readonly string[], kind: string): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.tx.cardLink.findMany({
      where: { workspaceId: card.workspaceId, fromCardId: { in: [...ids] }, kind },
      select: { toCardId: true },
    });
    return rows.map((row) => row.toCardId);
  }

  async findParents(card: CardView): Promise<CardView[]> {
    const rows = await this.tx.card.findMany({
      where: {
        workspaceId: card.workspaceId,
        archivedAt: null,
        linksTo: { some: { kind: 'parent', fromCardId: card.id } },
      },
      include: INCLUDE_DETAILS,
    });
    return rows.map((row) => toView(row));
  }

  async findRevisionEvent(card: CardView, revision: number): Promise<CardEventView | null> {
    const row = await this.tx.cardEvent.findFirst({
      where: {
        workspaceId: card.workspaceId,
        cardId: card.id,
        kind: 'plan_revised',
        data: { path: ['revision'], equals: revision + 1 },
      },
    });
    return row
      ? {
          id: row.id,
          cardId: row.cardId,
          seq: row.seq,
          kind: row.kind as EventKind,
          data: row.data as JsonObject,
          createdAt: row.createdAt,
        }
      : null;
  }

  private async reload(workspaceId: string, cardId: string): Promise<CardView> {
    const card = await this.findCard(workspaceId, { cardId });
    if (!card) throw new Error(`Card ${cardId} vanished inside its transaction`);
    return card;
  }
}
