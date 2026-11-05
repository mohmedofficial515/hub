/**
 * @file `GET /timeline/summary` (docs/04 §3.9) and the weekly summary's sections (docs/07 §6.2): counts over a period.
 */
import {
  type Actor,
  type ActorRef,
  type BriefCard,
  type CardSummary,
  type TimelineSummary,
  type TimelineSummaryQueryInput,
  type WeeklySections,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import type { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader } from '@/modules/cards';

import { addDays, isoWeekOf, localDate, type LocalWeek, startOfLocalDate } from '../domain/dates';
import { toBriefCard } from './brief.builder';

const LIST_LIMIT = 50;
const HOUR = 3_600_000;

interface Period {
  readonly from: Date;
  /** Exclusive. */
  readonly until: Date;
}

@Injectable()
export class TimelineSummaryService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async timezone(workspaceId: string): Promise<string> {
    return this.reader.findWorkspaceTimezone(workspaceId);
  }

  async summary(actor: Actor, input: TimelineSummaryQueryInput): Promise<TimelineSummary> {
    const timezone = await this.timezone(actor.workspaceId);
    const anchor = input.date ?? localDate(this.clock.now(), timezone);
    const week = isoWeekOf(anchor);
    const firstDay = input.period === 'week' ? week.from : anchor;
    const lastDay = input.period === 'week' ? week.to : anchor;
    const period: Period = {
      from: startOfLocalDate(firstDay, timezone),
      until: startOfLocalDate(addDays(lastDay, 1), timezone),
    };
    const created = (type: string): Prisma.CardWhereInput => ({
      type,
      createdAt: { gte: period.from, lt: period.until },
    });
    const [counts, decided, released, merged, newHandoffs, newNeeds, topActors] = await Promise.all([
      this.counts(actor.workspaceId, period),
      this.withEvent(actor, 'decided', period),
      this.released(actor, period),
      this.withEvent(actor, 'pr_merged', period),
      this.query.matching(actor, created('handoff'), { limit: LIST_LIMIT }),
      this.query.matching(actor, created('need'), { limit: LIST_LIMIT }),
      this.topActors(actor.workspaceId, period),
    ]);
    return {
      from: firstDay,
      to: lastDay,
      ...counts,
      decided,
      released,
      merged,
      newHandoffs,
      newNeeds,
      topActors,
    };
  }

  private async counts(workspaceId: string, period: Period) {
    const rows = await this.txHost.tx.$queryRaw<{ type: string; kind: string; count: bigint }[]>`
      SELECT c.type, e.kind, count(*)::bigint AS count
      FROM card_events e JOIN cards c ON c.id = e.card_id
      WHERE e.workspace_id = ${workspaceId}::uuid AND c.archived_at IS NULL AND c.type <> 'doc'
        AND e.kind NOT IN ('watch', 'unwatch')
        AND e.created_at >= ${period.from} AND e.created_at < ${period.until}
      GROUP BY c.type, e.kind`;
    const byType: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const row of rows) {
      byType[row.type] = (byType[row.type] ?? 0) + Number(row.count);
      byKind[row.kind] = (byKind[row.kind] ?? 0) + Number(row.count);
    }
    return { byType, byKind };
  }

  private withEvent(actor: Actor, kind: string, period: Period): Promise<CardSummary[]> {
    return this.query.matching(
      actor,
      { events: { some: { kind, createdAt: { gte: period.from, lt: period.until } } } },
      { limit: LIST_LIMIT },
    );
  }

  private released(actor: Actor, period: Period): Promise<CardSummary[]> {
    return this.query.matching(
      actor,
      { type: 'release', release: { releasedAt: { gte: period.from, lt: period.until } } },
      { limit: LIST_LIMIT },
    );
  }

  /** Members by events, with their agent merged in: both carry the member's id (docs/07 §6.2). */
  private async topActors(workspaceId: string, period: Period, limit = 5) {
    const rows = await this.txHost.tx.$queryRaw<{ actor_id: string; count: bigint }[]>`
      SELECT e.actor_id, count(*)::bigint AS count
      FROM card_events e JOIN cards c ON c.id = e.card_id
      WHERE e.workspace_id = ${workspaceId}::uuid AND e.actor_id IS NOT NULL AND c.archived_at IS NULL
        AND e.kind NOT IN ('watch', 'unwatch')
        AND e.created_at >= ${period.from} AND e.created_at < ${period.until}
      GROUP BY e.actor_id ORDER BY count DESC LIMIT ${limit}`;
    const users = await this.reader.findUsers(rows.map((row) => row.actor_id));
    return rows.map((row) => {
      const user: ActorRef = {
        kind: 'user',
        userId: row.actor_id,
        displayName: users.get(row.actor_id)?.displayName ?? null,
        via: 'web',
      };
      return { user, events: Number(row.count) };
    });
  }

  private async eventCount(
    workspaceId: string,
    kind: string,
    period: Period,
    type?: string,
  ): Promise<number> {
    return this.txHost.tx.cardEvent.count({
      where: {
        workspaceId,
        kind,
        createdAt: { gte: period.from, lt: period.until },
        card: { archivedAt: null, ...(type ? { type } : {}) },
      },
    });
  }

  /** A whole week for the whole project. Nothing here depends on who reads it. */
  async weekly(actor: Actor, week: LocalWeek): Promise<WeeklySections> {
    const { workspaceId } = actor;
    const now = this.clock.now();
    const timezone = await this.timezone(workspaceId);
    const period: Period = {
      from: startOfLocalDate(week.from, timezone),
      until: startOfLocalDate(addDays(week.to, 1), timezone),
    };
    const summary = await this.summary(actor, { period: 'week', date: week.from });
    const open = (where: Prisma.CardWhereInput, limit = LIST_LIMIT, sort?: 'due') =>
      this.query.matching(actor, { closedAt: null, ...where }, { limit, ...(sort ? { sort } : {}) });
    const count = (where: Prisma.CardWhereInput) =>
      this.txHost.tx.card.count({ where: { workspaceId, archivedAt: null, ...where } });
    const pending = await open({ type: 'handoff', status: 'pending' });
    const overdue = await open({ type: 'decision', status: 'open', dueAt: { lt: now } }, 20, 'due');
    const nextWeekEnd = new Date(now.getTime() + 7 * 24 * HOUR);
    const nextWeek = await open({ dueAt: { gte: now, lte: nextWeekEnd } }, 20, 'due');
    const repoRows = await this.txHost.tx.$queryRaw<{ repo: string; count: bigint }[]>`
      SELECT c.repo, count(*)::bigint AS count
      FROM card_events e JOIN cards c ON c.id = e.card_id
      WHERE e.workspace_id = ${workspaceId}::uuid AND e.kind = 'commit' AND c.repo IS NOT NULL
        AND e.created_at >= ${period.from} AND e.created_at < ${period.until}
      GROUP BY c.repo ORDER BY count DESC LIMIT 10`;
    const sessions = await this.txHost.tx.sessionLog.findMany({
      where: { workspaceId, createdAt: { gte: period.from, lt: period.until } },
      select: { summaryReceivedAt: true },
    });
    const cards = (rows: readonly CardSummary[]): BriefCard[] => rows.map(toBriefCard);
    return {
      from: week.from,
      to: week.to,
      counts: {
        byType: summary.byType,
        byKind: summary.byKind,
        commits: summary.byKind['commit'] ?? 0,
        prsMerged: summary.byKind['pr_merged'] ?? 0,
        sessions: sessions.length,
        sessionsNoSummary: sessions.filter((row) => row.summaryReceivedAt === null).length,
      },
      decided: cards(summary.decided),
      released: cards(summary.released),
      merged: cards(summary.merged),
      handoffs: {
        created: summary.newHandoffs.length,
        applied: await this.eventCount(workspaceId, 'applied', period, 'handoff'),
        pending: pending.map((card) => ({
          ...toBriefCard(card),
          ageHours: Math.floor((now.getTime() - Date.parse(card.createdAt)) / HOUR),
        })),
      },
      needs: {
        delivered: await this.eventCount(workspaceId, 'delivered', period, 'need'),
        verified: await this.eventCount(workspaceId, 'verified', period, 'need'),
        open: await count({ type: 'need', closedAt: null }),
      },
      redesign: {
        approved: await this.eventCount(workspaceId, 'approved', period, 'redesign'),
        ported: await this.eventCount(workspaceId, 'ported', period, 'redesign'),
        inReview: await count({ type: 'redesign', status: 'review' }),
      },
      overdue: cards(overdue),
      nextWeek: cards(nextWeek),
      topRepos: repoRows.map((row) => ({ name: row.repo, commits: Number(row.count) })),
      contributors: await this.topActors(workspaceId, period, 20),
    };
  }
}
