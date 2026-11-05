/**
 * @file What waits on one member, once, for Today, the brief and the counters (review M4: one list, one number).
 * @description Everything is read from cards on each call, through `CardQueryService`, so a row and a badge cannot
 * disagree. A port task whose redesign already sits in the stack is told once, by that row (approved design `session.ts`).
 */
import {
  type Actor,
  type CardSummary,
  type CardWithDetail,
  type MemberActor,
  type NoSummarySession,
  readySpecialties,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader } from '@/modules/cards';

const HOUR = 3_600_000;
const STACK_LIMIT = 100;
const READY_LIMIT = 100;
const DEADLINE_WINDOW_HOURS = 72;
const DEADLINE_LIMIT = 20;
const SESSION_DAYS = 7;
const SESSION_LIMIT = 20;

@Injectable()
export class MemberWorkService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The same list as `GET /cards?awaiting=me`, with each card's detail. */
  async awaiting(actor: Actor): Promise<CardWithDetail[]> {
    const page = await this.query.list(actor, { awaiting: 'me', limit: STACK_LIMIT });
    const rows = await this.reader.findByIds(
      actor.workspaceId,
      page.items.map((card) => card.id),
    );
    const detailed = await this.query.withDetail(actor, rows);
    const byId = new Map(detailed.map((card) => [card.id, card]));
    return page.items.flatMap((card) => {
      const found = byId.get(card.id);
      return found ? [found] : [];
    });
  }

  /** Ready, unblocked tasks for my specialties, urgent first. Owner and pm see every specialty. */
  async ready(actor: Actor, stack?: readonly CardWithDetail[]): Promise<CardWithDetail[]> {
    const specialties = readySpecialties(actor.roles);
    if (specialties.length === 0) return [];
    const page = await this.query.listWithDetail(actor, 'task', {
      statuses: ['ready'],
      where: {
        task: { specialty: { in: specialties } },
        NOT: { linksTo: { some: { kind: 'blocks', from: { closedAt: null, archivedAt: null } } } },
      },
      sort: 'priority',
      limit: READY_LIMIT,
    });
    const behind = new Set(
      (stack ?? [])
        .filter((card) => card.type === 'redesign' && card.awaiting === 'claim')
        .map((card) => card.detail?.['portTaskId']),
    );
    return page.items.filter((card) => !behind.has(card.id));
  }

  /** Due within 72 h or overdue, routed to my roles or assigned to me, overdue first (docs/09 §4). */
  async deadlines(actor: Actor): Promise<CardSummary[]> {
    const until = new Date(this.clock.now().getTime() + DEADLINE_WINDOW_HOURS * HOUR);
    const cards = await this.query.matching(
      actor,
      {
        type: { in: ['decision', 'need', 'task'] },
        closedAt: null,
        dueAt: { not: null, lte: until },
        OR: [
          { ownerRole: { in: [...actor.roles] } },
          ...(actor.userId ? [{ assigneeId: actor.userId }] : []),
        ],
      },
      { limit: DEADLINE_LIMIT, sort: 'due' },
    );
    return cards.sort((a, b) => Date.parse(a.dueAt ?? '') - Date.parse(b.dueAt ?? ''));
  }

  /** Mine in the last 7 days: the hook arrived and no summary did (docs/09 §4). */
  async noSummarySessions(actor: Pick<MemberActor, 'workspaceId' | 'userId'>): Promise<NoSummarySession[]> {
    const rows = await this.txHost.tx.sessionLog.findMany({
      where: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        hookReceivedAt: {
          not: null,
          gte: new Date(this.clock.now().getTime() - SESSION_DAYS * 24 * HOUR),
        },
        summaryReceivedAt: null,
      },
      orderBy: { hookReceivedAt: 'desc' },
      take: SESSION_LIMIT,
    });
    const ids = rows.flatMap((row) => (row.cardId ? [row.cardId] : []));
    const cards = await this.reader.findByIds(actor.workspaceId, ids);
    const keys = new Map(cards.map((card) => [card.id, card.key]));
    return rows.map((row) => {
      const hook = (row.hookPayload ?? {}) as {
        commits?: unknown[];
        files?: unknown[];
        durationSec?: number;
      };
      return {
        sessionLogId: row.id,
        sessionId: row.sessionId,
        repo: row.repo,
        branch: row.branch,
        at: (row.hookReceivedAt ?? row.createdAt).toISOString(),
        durationMin: typeof hook.durationSec === 'number' ? Math.round(hook.durationSec / 60) : null,
        commits: hook.commits?.length ?? 0,
        files: hook.files?.length ?? 0,
        cardKey: row.cardId ? (keys.get(row.cardId) ?? null) : null,
      };
    });
  }
}
