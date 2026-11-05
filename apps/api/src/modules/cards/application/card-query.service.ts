/**
 * @file Every read of cards: `CardQuery`, `CardFull`, the Deleted view, events, comments and the timeline.
 * @description Web and MCP read here, as they write through `CardService`. `flags`, `awaiting` and the actions come
 * from the card's current state on every read, so a page and a tool call always agree (docs/15 §8, review B2).
 */
import {
  type ActionableCard,
  actionsFor,
  type Actor,
  type ActorRef,
  allowedActions,
  awaitedAction,
  type CardEventDto,
  type CardFlags,
  type CardFullDto,
  type CardQueryInput,
  type CardSummary,
  type CardType,
  type CardWithDetail,
  type CardWrittenDto,
  type CommentDto,
  isAllowed,
  type MemberActor,
  type PageQueryInput,
  parseSetting,
  permissionFactsFor,
  type Priority,
  type Role,
  settingDefault,
  type SettingKey,
  type Specialty,
  type TimelineQueryInput,
  type TimelineRow,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import type { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { AppException } from '@/shared/errors';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';

import type { ApplyResult, CardTarget, CardView, JsonObject } from '../domain/card-action';
import { collapseTimeline } from '../domain/timeline';
import {
  type CardFilter,
  type CardPage,
  CardReader,
  type EventRow,
  type UserCard,
} from './ports/card.reader';
import { CardRepository } from './ports/card.repository';

const DEFAULT_LIMIT = 25;
const DEFAULT_TIMELINE_LIMIT = 50;
const AWAITING_CANDIDATES = 500;

/** Statuses a card can be awaited in; `awaitedAction` judges each candidate. */
const AWAITABLE: Prisma.CardWhereInput = {
  OR: [
    { type: 'decision', status: 'open' },
    { type: 'need', status: { in: ['requested', 'in_progress', 'delivered'] } },
    { type: 'handoff', status: { in: ['pending', 'acknowledged'] } },
    { type: 'redesign', status: { in: ['review', 'approved'] } },
    { type: 'task', status: 'in_review' },
    { type: 'plan', status: 'in_review' },
  ],
};

/** Everything `toSummary` needs beyond the card, loaded once per page. */
interface ReadContext {
  readonly actor: Actor;
  readonly users: ReadonlyMap<string, UserCard>;
  readonly blocked: ReadonlySet<string>;
  readonly blocking: ReadonlyMap<string, number>;
  readonly portTasks: ReadonlyMap<string, CardView>;
  readonly now: Date;
  readonly staleHandoffBefore: Date;
  readonly staleNeedBefore: Date;
}

type Staleness = 'staleHandoffBefore' | 'staleNeedBefore';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function asRefKind(kind: string): ActorRef['kind'] {
  return kind === 'agent' || kind === 'system' ? kind : 'user';
}

/** Detail as docs/04 §1.8 shows it: `xById` becomes `xBy: { id, displayName }`. */
function detailDto(detail: JsonObject | null, users: ReadonlyMap<string, UserCard>): JsonObject | null {
  if (!detail) return null;
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'readmeHash') continue;
    if (key.endsWith('ById')) {
      const user = typeof value === 'string' ? users.get(value) : undefined;
      result[key.slice(0, -2)] = user ? { id: user.id, displayName: user.displayName } : null;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function withIncluded(detail: JsonObject | null, included: readonly CardSummary[] | undefined) {
  return detail && included ? { ...detail, included: included as unknown as JsonObject[] } : detail;
}

function detailUserIds(detail: JsonObject | null): string[] {
  return Object.entries(detail ?? {})
    .filter(([key, value]) => key.endsWith('ById') && typeof value === 'string')
    .map(([, value]) => value as string);
}

/** The body of a plan's old revision stays on its event; lists and the timeline do not carry it. */
function eventDataDto(data: JsonObject): JsonObject {
  const { previousBody: _dropped, ...rest } = data;
  return rest;
}

export function resolveMe(value: string | undefined, actor: Actor): string | undefined {
  if (value === 'me') return actor.userId ?? undefined;
  return value;
}

@Injectable()
export class CardQueryService {
  constructor(
    private readonly reader: CardReader,
    private readonly cards: CardRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async setting<K extends SettingKey>(workspaceId: string, key: K) {
    const value = await this.cards.readSetting(workspaceId, key);
    return value === undefined ? settingDefault(key) : parseSetting(key, value);
  }

  private async moments(workspaceId: string) {
    const [handoffHours, needDays] = await Promise.all([
      this.setting(workspaceId, 'handoffs.stale_hours'),
      this.setting(workspaceId, 'needs.stale_days'),
    ]);
    return this.momentsFrom(handoffHours, needDays);
  }

  private momentsFrom(handoffHours: unknown, needDays: unknown) {
    const now = this.clock.now();
    return {
      now,
      staleHandoffBefore: new Date(now.getTime() - Number(handoffHours) * 3_600_000),
      staleNeedBefore: new Date(now.getTime() - Number(needDays) * 86_400_000),
    };
  }

  private async context(actor: Actor, cards: readonly CardView[], extraUsers: readonly string[] = []) {
    const moments = await this.moments(actor.workspaceId);
    const portIds = cards.flatMap((card) => {
      const id = card.type === 'redesign' ? card.detail?.['portTaskId'] : null;
      return typeof id === 'string' ? [id] : [];
    });
    const ports = await this.reader.findByIds(actor.workspaceId, portIds);
    const ids = [...cards, ...ports].map((card) => card.id);
    const userIds = cards.flatMap((card) => [
      ...(card.assigneeId ? [card.assigneeId] : []),
      ...(card.createdById ? [card.createdById] : []),
      ...detailUserIds(card.detail),
    ]);
    const [users, blocked, blocking] = await Promise.all([
      this.reader.findUsers([...userIds, ...extraUsers]),
      this.reader.findBlocked(actor.workspaceId, ids),
      this.reader.countBlocking(
        actor.workspaceId,
        cards.map((card) => card.id),
      ),
    ]);
    const context: ReadContext = {
      actor,
      users,
      blocked,
      blocking,
      portTasks: new Map(ports.map((port) => [port.id, port])),
      ...moments,
    };
    return context;
  }

  private isStale(card: CardView, context: Pick<ReadContext, Staleness>): boolean {
    if (card.type === 'handoff')
      return card.status === 'pending' && card.createdAt < context.staleHandoffBefore;
    if (card.type === 'need') return card.status === 'requested' && card.createdAt < context.staleNeedBefore;
    return false;
  }

  private actionable(
    card: CardView,
    context: Pick<ReadContext, Staleness | 'blocked' | 'portTasks'>,
  ): ActionableCard {
    const portId = card.type === 'redesign' ? card.detail?.['portTaskId'] : null;
    const port = typeof portId === 'string' ? context.portTasks.get(portId) : undefined;
    return {
      type: card.type,
      status: card.status,
      ownerRole: card.ownerRole,
      assigneeId: card.assigneeId,
      createdById: card.createdById,
      archivedAt: card.archivedAt,
      detail: card.detail,
      blocked: context.blocked.has(card.id),
      stale: this.isStale(card, context),
      portTask: port
        ? {
            key: port.key,
            status: port.status,
            ownerRole: port.ownerRole,
            specialty: (port.detail?.['specialty'] ?? null) as Specialty | null,
            blocked: context.blocked.has(port.id),
          }
        : null,
    };
  }

  private flags(card: CardView, context: ReadContext): CardFlags {
    const open = card.closedAt === null;
    return {
      blocked: open && context.blocked.has(card.id),
      overdue: open && card.dueAt !== null && card.dueAt < context.now,
      escalated: open && Boolean(card.detail?.['escalatedAt']),
      stale: this.isStale(card, context),
      noSummary: Boolean((card.detail?.['session'] as { noSummary?: boolean } | null | undefined)?.noSummary),
    };
  }

  private actorRef(
    kind: string,
    userId: string | null,
    via: string,
    users: ReadonlyMap<string, UserCard>,
  ): ActorRef {
    return {
      kind: asRefKind(kind),
      userId,
      displayName: userId ? (users.get(userId)?.displayName ?? null) : null,
      via,
    };
  }

  private toSummary(card: CardView, context: ReadContext): CardSummary {
    const assignee = card.assigneeId ? context.users.get(card.assigneeId) : undefined;
    return {
      id: card.id,
      key: card.key,
      type: card.type,
      title: card.title,
      status: card.status,
      priority: card.priority as Priority,
      ownerRole: card.ownerRole,
      assignee: assignee
        ? { id: assignee.id, displayName: assignee.displayName, avatarColor: assignee.avatarColor }
        : null,
      module: card.module,
      repo: card.repo,
      branch: card.branch,
      tags: [...card.tags],
      dueAt: iso(card.dueAt),
      closedAt: iso(card.closedAt),
      archivedAt: iso(card.archivedAt),
      commentCount: card.commentCount,
      lastEventAt: card.lastEventAt.toISOString(),
      createdAt: card.createdAt.toISOString(),
      createdBy: this.actorRef(card.createdByKind, card.createdById, card.createdVia, context.users),
      source: card.source,
      flags: this.flags(card, context),
      blocksCount: context.blocking.get(card.id) ?? 0,
      awaiting:
        awaitedAction(this.actionable(card, context), context.actor.roles, context.actor.userId)?.action ??
        null,
    };
  }

  /** Summaries for other modules, loaded and judged for this member. */
  async summaries(actor: Actor, cards: readonly CardView[]): Promise<CardSummary[]> {
    const context = await this.context(actor, cards);
    return cards.map((card) => this.toSummary(card, context));
  }

  private async toFilter(actor: Actor, input: CardQueryInput): Promise<CardFilter> {
    const assigneeId = resolveMe(input.assignee, actor);
    const createdById = resolveMe(input.createdBy, actor);
    const dueBefore = input.dueBefore ? new Date(input.dueBefore) : undefined;
    return {
      ...(await this.moments(actor.workspaceId)),
      ...(input.type ? { types: input.type } : {}),
      ...(input.status ? { statuses: input.status } : {}),
      ...(input.role ? { roles: input.role } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(createdById ? { createdById } : {}),
      ...(input.repo ? { repos: input.repo } : {}),
      ...(input.module ? { modules: input.module } : {}),
      ...(input.tag ? { tags: input.tag } : {}),
      ...(input.q ? { q: input.q } : {}),
      ...(dueBefore ? { dueBefore } : {}),
      ...(input.flags ? { flags: input.flags } : {}),
    };
  }

  private sortKey(card: CardView, sort: CardPage['sort']): string {
    switch (sort) {
      case 'priority':
        return card.priority;
      case 'due':
        return card.dueAt?.toISOString() ?? '';
      case 'created':
      case 'createdAsc':
        return card.createdAt.toISOString();
      case 'lastEvent':
        return card.lastEventAt.toISOString();
    }
  }

  private async pageOf(
    actor: Actor,
    filter: CardFilter,
    page: CardPage,
  ): Promise<{ cards: CardView[]; nextCursor: string | null }> {
    const rows = await this.reader.findCards(actor.workspaceId, filter, page);
    const cards = rows.slice(0, page.limit);
    const last = cards[cards.length - 1];
    const nextCursor =
      rows.length > page.limit && last ? encodeCursor(this.sortKey(last, page.sort), last.id) : null;
    return { cards, nextCursor };
  }

  /** `GET /cards` (docs/04 §3.8). */
  async list(actor: Actor, input: CardQueryInput): Promise<Paginated<CardSummary>> {
    const filter = await this.toFilter(actor, input);
    if (input.awaiting === 'me') return this.listAwaiting(actor, filter, input.limit ?? 100);
    const limit = input.limit ?? DEFAULT_LIMIT;
    const { cards, nextCursor } = await this.pageOf(actor, filter, {
      cursor: input.cursor,
      limit,
      sort: input.sort ?? 'lastEvent',
    });
    return {
      items: await this.summaries(actor, cards),
      pagination: { nextCursor, limit },
    };
  }

  /**
   * What `GET /cards?awaiting=me` counts, for each of a member's projects, by the same rule and on the same candidates. A fixed number of
   * queries however many projects there are, since `GET /workspaces` asks for all of them on every load (review M8).
   */
  async awaitingCounts(
    userId: string,
    memberships: readonly { readonly workspaceId: string; readonly roles: readonly Role[] }[],
  ): Promise<Map<string, number>> {
    const workspaceIds = memberships.map((membership) => membership.workspaceId);
    const [candidates, settings] = await Promise.all([
      this.reader.findCandidatesAcross(workspaceIds, AWAITABLE),
      this.cards.readSettings(workspaceIds, ['handoffs.stale_hours', 'needs.stale_days']),
    ]);
    const cards = new Map<string, CardView[]>(workspaceIds.map((id) => [id, []]));
    for (const card of candidates) {
      const list = cards.get(card.workspaceId);
      if (list && list.length < AWAITING_CANDIDATES) list.push(card);
    }
    const kept = [...cards.values()].flat();
    const portIds = kept.flatMap((card) => {
      const id = card.type === 'redesign' ? card.detail?.['portTaskId'] : null;
      return typeof id === 'string' ? [id] : [];
    });
    const ports = await this.reader.findByIdsAcross(workspaceIds, portIds);
    const blocked = await this.reader.findBlockedAcross(
      workspaceIds,
      [...kept, ...ports].map((card) => card.id),
    );
    const portTasks = new Map(ports.map((port) => [port.id, port]));
    const counts = new Map<string, number>();
    for (const { workspaceId, roles } of memberships) {
      const stored = settings.get(workspaceId);
      const handoffHours = stored?.get('handoffs.stale_hours');
      const needDays = stored?.get('needs.stale_days');
      const context = {
        blocked,
        portTasks,
        ...this.momentsFrom(
          handoffHours === undefined
            ? settingDefault('handoffs.stale_hours')
            : parseSetting('handoffs.stale_hours', handoffHours),
          needDays === undefined
            ? settingDefault('needs.stale_days')
            : parseSetting('needs.stale_days', needDays),
        ),
      };
      counts.set(
        workspaceId,
        (cards.get(workspaceId) ?? []).filter(
          (card) => awaitedAction(this.actionable(card, context), roles, userId) !== null,
        ).length,
      );
    }
    return counts;
  }

  /** A card waits on the member by rule, not by column, so the small candidate set is judged in code. */
  private async listAwaiting(
    actor: Actor,
    filter: CardFilter,
    limit: number,
  ): Promise<Paginated<CardSummary>> {
    const cards = await this.reader.findCandidates(actor.workspaceId, filter, AWAITABLE, AWAITING_CANDIDATES);
    const summaries = await this.summaries(actor, cards);
    const waiting = summaries
      .filter((card) => card.awaiting !== null)
      .sort(
        (a, b) =>
          (a.dueAt ? Date.parse(a.dueAt) : Infinity) - (b.dueAt ? Date.parse(b.dueAt) : Infinity) ||
          a.priority.localeCompare(b.priority),
      );
    return {
      items: waiting.slice(0, limit),
      pagination: { nextCursor: null, limit, total: waiting.length },
    };
  }

  /**
   * A list with each card's detail, for the type pages. `where` carries the type's own conditions; `sort` falls
   * back to the newest activity.
   */
  async listWithDetail(
    actor: Actor,
    type: CardType,
    query: {
      readonly statuses?: readonly string[] | undefined;
      readonly roles?: readonly string[] | undefined;
      readonly flags?: CardFilter['flags'] | undefined;
      readonly where?: Prisma.CardWhereInput | undefined;
      readonly sort?: CardPage['sort'] | undefined;
      readonly cursor?: string | undefined;
      readonly limit?: number | undefined;
      readonly q?: string | undefined;
    },
  ): Promise<Paginated<CardWithDetail>> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filter: CardFilter = {
      ...(await this.moments(actor.workspaceId)),
      types: [type],
      ...(query.statuses ? { statuses: query.statuses } : {}),
      ...(query.roles ? { roles: query.roles } : {}),
      ...(query.flags ? { flags: query.flags } : {}),
      ...(query.where ? { where: query.where } : {}),
      ...(query.q ? { q: query.q } : {}),
    };
    const { cards, nextCursor } = await this.pageOf(actor, filter, {
      cursor: query.cursor,
      limit,
      sort: query.sort ?? 'lastEvent',
    });
    return { items: await this.withDetail(actor, cards), pagination: { nextCursor, limit } };
  }

  async withDetail(actor: Actor, cards: readonly CardView[]): Promise<CardWithDetail[]> {
    const context = await this.context(actor, cards);
    const included = await this.includedOf(actor, cards);
    return cards.map((card) => ({
      ...this.toSummary(card, context),
      detail: withIncluded(detailDto(card.detail, context.users), included.get(card.id)),
    }));
  }

  /** What each release includes, as summaries (docs/04 §3.20). A deleted card drops out. */
  private async includedOf(actor: Actor, cards: readonly CardView[]): Promise<Map<string, CardSummary[]>> {
    const byRelease = new Map<string, readonly string[]>();
    for (const card of cards) {
      if (card.type === 'release') byRelease.set(card.id, (card.detail?.['includedIds'] ?? []) as string[]);
    }
    if (byRelease.size === 0) return new Map();
    const rows = await this.reader.findByIds(actor.workspaceId, [...new Set([...byRelease.values()].flat())]);
    const summaries = await this.summaries(
      actor,
      rows.filter((row) => row.archivedAt === null),
    );
    const byId = new Map(summaries.map((summary) => [summary.id, summary]));
    return new Map(
      [...byRelease].map(([id, ids]) => [
        id,
        ids.flatMap((included) => {
          const summary = byId.get(included);
          return summary ? [summary] : [];
        }),
      ]),
    );
  }

  /** The cards each of these blocks, as summaries: the `blocks` column on Decisions and Needs. */
  async blocksOf(actor: Actor, ids: readonly string[]): Promise<Map<string, CardSummary[]>> {
    const byBlocker = await this.reader.findBlockedBy(actor.workspaceId, ids);
    const all = [...byBlocker.values()].flat();
    const context = await this.context(actor, all);
    return new Map(
      [...byBlocker].map(([id, cards]) => [id, cards.map((card) => this.toSummary(card, context))]),
    );
  }

  /** The keys of the open cards blocking each of these: the "Blocked by" pill on Tasks. */
  blockersOf(actor: Actor, ids: readonly string[]): Promise<Map<string, string[]>> {
    return this.reader.findBlockerKeys(actor.workspaceId, ids);
  }

  /** Owner and pm see every deleted card; another member sees the ones they created, which they may restore. */
  private canReadAllDeleted(actor: Actor): boolean {
    return actor.kind === 'system' || isAllowed('card.read_deleted', actor.roles);
  }

  /** The Deleted view (D28), newest first. */
  async deleted(actor: Actor, page: PageQueryInput): Promise<Paginated<CardSummary>> {
    const limit = page.limit ?? DEFAULT_LIMIT;
    const filter: CardFilter = {
      ...(await this.moments(actor.workspaceId)),
      deleted: true,
      ...(this.canReadAllDeleted(actor) || !actor.userId ? {} : { createdById: actor.userId }),
    };
    const { cards, nextCursor } = await this.pageOf(actor, filter, {
      cursor: page.cursor,
      limit,
      sort: 'lastEvent',
    });
    return { items: await this.summaries(actor, cards), pagination: { nextCursor, limit } };
  }

  /** Loads a card the member may read. A deleted one answers not found unless they may see it. */
  async readable(actor: Actor, target: CardTarget): Promise<CardView> {
    const card = await this.cards.findCard(actor.workspaceId, target);
    if (!card) throw new AppException('hub.cards.not_found');
    if (card.archivedAt && !this.canReadAllDeleted(actor) && card.createdById !== actor.userId) {
      throw new AppException('hub.cards.not_found');
    }
    return card;
  }

  /** `CardFull` (docs/04 §1.8). */
  async full(actor: Actor, key: string): Promise<CardFullDto> {
    return this.fullOf(actor, await this.readable(actor, { cardKey: key }));
  }

  private async fullOf(actor: Actor, card: CardView): Promise<CardFullDto> {
    const { workspaceId } = actor;
    const [links, watchers, attachments] = await Promise.all([
      this.reader.findLinks(workspaceId, card.id),
      this.reader.findWatchers(card.id),
      this.reader.findAttachments(card.id),
    ]);
    const context = await this.context(
      actor,
      [card, ...links.map((link) => link.card)],
      watchers.map((watcher) => watcher.userId),
    );
    const actionable = this.actionable(card, context);
    const facts = permissionFactsFor(card, actor.userId);
    const included = await this.includedOf(actor, [card]);
    return {
      ...this.toSummary(card, context),
      detail: withIncluded(detailDto(card.detail, context.users), included.get(card.id)),
      body: card.body,
      links: links.map((link) => ({ kind: link.kind, card: this.toSummary(link.card, context) })),
      watchers: watchers.map((watcher) => ({
        userId: watcher.userId,
        displayName: context.users.get(watcher.userId)?.displayName ?? '',
        reason: watcher.reason,
      })),
      attachments,
      watching: watchers.some((watcher) => watcher.userId === actor.userId),
      allowedActions: allowedActions(actor.roles, facts).filter(
        (action) => action.startsWith('card.') || action.startsWith(`${card.type}.`),
      ),
      actions: actionsFor(actionable, actor.roles, actor.userId),
      awaitedAction: awaitedAction(actionable, actor.roles, actor.userId),
    };
  }

  /** What a write answers: the card as it now stands, and the event it produced. */
  async written(actor: Actor, result: ApplyResult): Promise<CardWrittenDto> {
    const card = await this.cards.findCard(actor.workspaceId, { cardId: result.card.id });
    if (!card) throw new AppException('hub.cards.not_found');
    const full = await this.fullOf(actor, card);
    const { event } = result;
    return { ...full, event: { id: event.id, seq: event.seq, kind: event.kind } };
  }

  /** Reading a member's own actor, typed for the route. */
  private dtoOfEvent(row: EventRow, users: ReadonlyMap<string, UserCard>): CardEventDto {
    return {
      id: row.id,
      seq: row.seq,
      kind: row.kind,
      actor: this.actorRef(row.actorKind, row.actorId, row.via, users),
      via: row.via,
      data: eventDataDto(row.data),
      createdAt: row.createdAt.toISOString(),
    };
  }

  async events(actor: Actor, key: string, page: PageQueryInput): Promise<Paginated<CardEventDto>> {
    const card = await this.readable(actor, { cardKey: key });
    const limit = page.limit ?? DEFAULT_LIMIT;
    const cursor = page.cursor ? { seq: Number(decodeCursor(page.cursor).sortKey) } : null;
    const rows = await this.reader.findEvents(actor.workspaceId, card.id, cursor, limit);
    const shown = rows.slice(0, limit);
    const users = await this.reader.findUsers(shown.flatMap((row) => (row.actorId ? [row.actorId] : [])));
    const last = shown[shown.length - 1];
    return {
      items: shown.map((row) => this.dtoOfEvent(row, users)),
      pagination: {
        nextCursor: rows.length > limit && last ? encodeCursor(String(last.seq), last.id) : null,
        limit,
      },
    };
  }

  async comments(actor: Actor, key: string, page: PageQueryInput): Promise<Paginated<CommentDto>> {
    const card = await this.readable(actor, { cardKey: key });
    const limit = page.limit ?? DEFAULT_LIMIT;
    const decoded = page.cursor ? decodeCursor(page.cursor) : null;
    const rows = await this.reader.findComments(
      actor.workspaceId,
      card.id,
      decoded ? { createdAt: new Date(decoded.sortKey), id: decoded.id } : null,
      limit,
    );
    const shown = rows.slice(0, limit);
    const users = await this.reader.findUsers(shown.map((row) => row.authorId));
    const last = shown[shown.length - 1];
    return {
      items: shown.map((row) => this.commentDto(row, users)),
      pagination: {
        nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt.toISOString(), last.id) : null,
        limit,
      },
    };
  }

  private commentDto(
    row: Awaited<ReturnType<CardReader['findComments']>>[number],
    users: ReadonlyMap<string, UserCard>,
  ): CommentDto {
    return {
      id: row.id,
      author: this.actorRef(row.authorKind, row.authorId, row.via, users),
      via: row.via,
      body: row.bodyRedactedAt ? null : row.body,
      redacted: row.bodyRedactedAt !== null,
      createdAt: row.createdAt.toISOString(),
      editedAt: iso(row.editedAt),
    };
  }

  async comment(actor: Actor, commentId: string): Promise<CommentDto> {
    const row = await this.reader.findComment(actor.workspaceId, commentId);
    if (!row) throw new AppException('hub.cards.comment_not_found');
    const users = await this.reader.findUsers([row.authorId]);
    return this.commentDto(row, users);
  }

  async attachments(actor: Actor, key: string) {
    const card = await this.readable(actor, { cardKey: key });
    return this.reader.findAttachments(card.id);
  }

  /** Any cards by a condition, judged for this member, for pages that compose several lists (Today, briefs). */
  async matching(
    actor: Actor,
    where: Prisma.CardWhereInput,
    options: { readonly limit: number; readonly sort?: CardPage['sort'] },
  ): Promise<CardSummary[]> {
    const filter: CardFilter = { ...(await this.moments(actor.workspaceId)), where };
    const rows = await this.reader.findCards(actor.workspaceId, filter, {
      limit: options.limit,
      sort: options.sort ?? 'lastEvent',
    });
    return this.summaries(actor, rows.slice(0, options.limit));
  }

  /** "Since last visit": the one number the sidebar's Timeline count and Today both show (review M4). */
  countSince(actor: MemberActor, since: Date): Promise<number> {
    return this.reader.countTimeline(actor.workspaceId, { from: since, excludeActorId: actor.userId });
  }

  /** `GET /timeline` (docs/04 §3.9): events, newest first, with the collapse hint. */
  async timeline(
    actor: MemberActor,
    input: TimelineQueryInput,
    options: { readonly excludeOwn?: boolean } = {},
  ): Promise<Paginated<TimelineRow>> {
    const limit = input.limit ?? DEFAULT_TIMELINE_LIMIT;
    const from = input.from ? new Date(input.from) : undefined;
    const to = input.to ? new Date(input.to) : undefined;
    const filter = {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(input.types ? { types: input.types } : {}),
      ...(input.roles ? { roles: input.roles } : {}),
      ...(input.repos ? { repos: input.repos } : {}),
      ...(input.modules ? { modules: input.modules } : {}),
      ...(input.actors ? { actors: input.actors } : {}),
      ...(input.kinds ? { kinds: input.kinds } : {}),
      ...(input.q ? { q: input.q } : {}),
      ...(input.mine ? { mineUserId: actor.userId } : {}),
      ...(options.excludeOwn ? { excludeActorId: actor.userId } : {}),
    };

    // Fold across batches, so a row is whole before it is shown: read until one row more than asked is closed.
    const decoded = input.cursor ? decodeCursor(input.cursor) : null;
    let cursor = decoded ? { createdAt: new Date(decoded.sortKey), id: decoded.id } : null;
    const events: EventRow[] = [];
    const batch = limit * 2 + 1;
    let exhausted = false;
    while (!exhausted && collapseTimeline(events).length <= limit) {
      const rows = await this.reader.findTimeline(actor.workspaceId, filter, cursor, batch);
      events.push(...rows);
      const last = rows[rows.length - 1];
      exhausted = rows.length < batch || !last;
      if (last) cursor = { createdAt: last.createdAt, id: last.id };
    }

    const rows = collapseTimeline(events);
    const shown = rows.slice(0, limit);
    const lastShown = shown[shown.length - 1];
    const nextCursor =
      rows.length > limit && lastShown
        ? encodeCursor(lastShown.last.createdAt.toISOString(), lastShown.last.id)
        : null;

    const cards = await this.reader.findByIds(
      actor.workspaceId,
      shown.map((row) => row.event.cardId),
    );
    const context = await this.context(
      actor,
      cards,
      shown.flatMap((row) => (row.event.actorId ? [row.event.actorId] : [])),
    );
    const byId = new Map(cards.map((card) => [card.id, card]));
    const items = shown.flatMap((row): TimelineRow[] => {
      const card = byId.get(row.event.cardId);
      if (!card) return [];
      return [
        {
          event: this.dtoOfEvent(row.event, context.users),
          card: { ...this.toSummary(card, context), detail: detailDto(card.detail, context.users) },
          collapsed: row.collapsed,
          collapsedKinds: [...row.collapsedKinds],
        },
      ];
    });

    const dayCounts =
      from && to
        ? await this.reader.countTimelineByDay(
            actor.workspaceId,
            await this.reader.findWorkspaceTimezone(actor.workspaceId),
            from,
            to,
          )
        : undefined;
    return {
      items,
      pagination: { nextCursor, limit },
      ...(dayCounts ? { meta: { dayCounts } } : {}),
    };
  }
}
