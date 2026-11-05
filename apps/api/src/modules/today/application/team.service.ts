/**
 * @file The team block of Today: totals, flow and per-member activity, all from events (docs/15 §8, approved design
 * `parts/team.tsx`). A total with no source behind it says so instead of showing a zero that reads as a fact.
 */
import { type CardType, type TeamStats } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { addDays, isoWeekOf, localDate, startOfLocalDate } from '@/modules/digests';

const ACTIVITY_DAYS = 14;

interface Range {
  readonly from: Date;
  readonly until: Date;
}

const TOTAL_KINDS = {
  sessions: 'session_logged',
  commits: 'commit',
  prsMerged: 'pr_merged',
  decided: 'decided',
  handoffs: 'applied',
} as const;

@Injectable()
export class TeamService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private kindCount(workspaceId: string, kind: string, range: Range): Promise<number> {
    return this.txHost.tx.cardEvent.count({
      where: {
        workspaceId,
        kind,
        createdAt: { gte: range.from, lt: range.until },
        card: { archivedAt: null },
      },
    });
  }

  private closedCount(workspaceId: string, range: Range): Promise<number> {
    return this.txHost.tx.card.count({
      where: { workspaceId, archivedAt: null, closedAt: { gte: range.from, lt: range.until } },
    });
  }

  private async totals(workspaceId: string, now: Range, prev: Range): Promise<TeamStats['totals']> {
    const hasRepo = await this.txHost.tx.source.count({
      where: { workspaceId, kind: 'github_repo', enabled: true },
    });
    const kinds = Object.keys(TOTAL_KINDS) as (keyof typeof TOTAL_KINDS)[];
    const rows = await Promise.all(
      kinds.map(async (key) => ({
        key,
        value: await this.kindCount(workspaceId, TOTAL_KINDS[key], now),
        prev: await this.kindCount(workspaceId, TOTAL_KINDS[key], prev),
        available: (key !== 'commits' && key !== 'prsMerged') || hasRepo > 0,
      })),
    );
    return [
      ...rows,
      {
        key: 'closed',
        value: await this.closedCount(workspaceId, now),
        prev: await this.closedCount(workspaceId, prev),
        available: true,
      },
    ];
  }

  private async flow(workspaceId: string, range: Range): Promise<TeamStats['flow']> {
    const created = await this.txHost.tx.card.groupBy({
      by: ['type'],
      where: { workspaceId, archivedAt: null, createdAt: { gte: range.from, lt: range.until } },
      _count: { _all: true },
    });
    const closed = await this.txHost.tx.card.groupBy({
      by: ['type'],
      where: { workspaceId, archivedAt: null, closedAt: { gte: range.from, lt: range.until } },
      _count: { _all: true },
    });
    const types = [...new Set([...created, ...closed].map((row) => row.type))].sort();
    const of = (rows: typeof created, type: string) =>
      rows.find((row) => row.type === type)?._count._all ?? 0;
    return types.map((type) => ({
      type: type as CardType,
      created: of(created, type),
      closed: of(closed, type),
    }));
  }

  private async members(
    workspaceId: string,
    timezone: string,
    days: readonly string[],
    week: Range,
  ): Promise<TeamStats['members']> {
    const memberships = await this.txHost.tx.membership.findMany({
      where: { workspaceId, status: 'active', user: { status: 'active' } },
      select: {
        roles: true,
        user: { select: { id: true, displayName: true, avatarColor: true } },
      },
    });
    const first = days[0] ?? '';
    const activity = await this.txHost.tx.$queryRaw<{ actor_id: string; day: string; count: bigint }[]>`
      SELECT actor_id, to_char(created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day, count(*)::bigint AS count
      FROM card_events
      WHERE workspace_id = ${workspaceId}::uuid AND actor_id IS NOT NULL AND kind NOT IN ('watch', 'unwatch')
        AND created_at >= ${startOfLocalDate(first, timezone)}
      GROUP BY actor_id, day`;
    const weekly = await this.txHost.tx.$queryRaw<{ actor_id: string; kind: string; count: bigint }[]>`
      SELECT actor_id, kind, count(*)::bigint AS count FROM card_events
      WHERE workspace_id = ${workspaceId}::uuid AND actor_id IS NOT NULL AND kind IN ('session_logged', 'commit')
        AND created_at >= ${week.from} AND created_at < ${week.until}
      GROUP BY actor_id, kind`;
    // The event that closed a card carries the same instant as `closed_at`, so it names who closed it.
    const closers = await this.txHost.tx.$queryRaw<{ actor_id: string; count: bigint }[]>`
      SELECT e.actor_id, count(DISTINCT c.id)::bigint AS count
      FROM cards c JOIN card_events e ON e.card_id = c.id AND e.created_at = c.closed_at
      WHERE c.workspace_id = ${workspaceId}::uuid AND e.actor_id IS NOT NULL AND c.archived_at IS NULL
        AND c.closed_at >= ${week.from} AND c.closed_at < ${week.until}
      GROUP BY e.actor_id`;
    const latest = await this.txHost.tx.$queryRaw<{ actor_id: string; at: Date }[]>`
      SELECT actor_id, max(created_at) AS at FROM card_events
      WHERE workspace_id = ${workspaceId}::uuid AND actor_id IS NOT NULL AND kind NOT IN ('watch', 'unwatch')
      GROUP BY actor_id`;
    const handoffs = await this.txHost.tx.card.groupBy({
      by: ['createdById'],
      where: {
        workspaceId,
        type: 'handoff',
        archivedAt: null,
        createdAt: { gte: week.from, lt: week.until },
      },
      _count: { _all: true },
    });
    const focuses = await this.txHost.tx.card.findMany({
      where: {
        workspaceId,
        type: 'task',
        archivedAt: null,
        status: { in: ['in_progress', 'claimed'] },
        assigneeId: { in: memberships.map((row) => row.user.id) },
      },
      orderBy: [{ status: 'desc' }, { lastEventAt: 'desc' }],
      select: { key: true, title: true, type: true, assigneeId: true },
    });
    return memberships
      .map(({ roles, user }) => {
        const focus = focuses.find((card) => card.assigneeId === user.id);
        const of = (kind: string) =>
          Number(weekly.find((row) => row.actor_id === user.id && row.kind === kind)?.count ?? 0);
        return {
          userId: user.id,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          roles,
          lastActiveAt: latest.find((row) => row.actor_id === user.id)?.at.toISOString() ?? null,
          sessions: of('session_logged'),
          commits: of('commit'),
          cardsClosed: Number(closers.find((row) => row.actor_id === user.id)?.count ?? 0),
          handoffsSent: handoffs.find((row) => row.createdById === user.id)?._count._all ?? 0,
          activity: days.map((day) =>
            Number(activity.find((row) => row.actor_id === user.id && row.day === day)?.count ?? 0),
          ),
          focus: focus ? { key: focus.key, title: focus.title, type: focus.type as CardType } : null,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async stats(workspaceId: string, timezone: string): Promise<TeamStats> {
    const today = localDate(this.clock.now(), timezone);
    const week = isoWeekOf(today);
    const previous = isoWeekOf(addDays(week.from, -7));
    const range = (from: string, to: string): Range => ({
      from: startOfLocalDate(from, timezone),
      until: startOfLocalDate(addDays(to, 1), timezone),
    });
    const thisWeek = range(week.from, week.to);
    const days = Array.from({ length: ACTIVITY_DAYS }, (_, index) =>
      addDays(today, index - (ACTIVITY_DAYS - 1)),
    );
    return {
      week,
      totals: await this.totals(workspaceId, thisWeek, range(previous.from, previous.to)),
      flow: await this.flow(workspaceId, thisWeek),
      days,
      members: await this.members(workspaceId, timezone, days, thisWeek),
    };
  }
}
