/**
 * @file `GET /today` (docs/04 §3.23): everything the approved Today page shows that has real data.
 * @description Reading it changes nothing. `POST /today/seen` moves "since last visit", so a refresh or a second tab
 * cannot clear a count the member has not looked at.
 */
import type { MemberActor, Today } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { CardQueryService, CardReader } from '@/modules/cards';
import { BriefsService, localDate, MemberWorkService } from '@/modules/digests';
import { InboxService } from '@/modules/notifications';

import { CountersService } from './counters.service';
import { SeenStore } from './seen.store';
import { SourceHealthService } from './source-health.service';
import { TeamService } from './team.service';

const SINCE_ROWS = 50;

@Injectable()
export class TodayService {
  constructor(
    private readonly work: MemberWorkService,
    private readonly briefs: BriefsService,
    private readonly counters: CountersService,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    private readonly seen: SeenStore,
    private readonly team: TeamService,
    private readonly sources: SourceHealthService,
    private readonly inbox: InboxService,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(actor: MemberActor): Promise<Today> {
    const timezone = await this.reader.findWorkspaceTimezone(actor.workspaceId);
    const now = this.clock.now();
    const stack = await this.work.awaiting(actor);
    const since = await this.seen.since(actor.workspaceId, actor.userId);
    const [brief, weekly, ready, deadlines, sessions, rows, total, counters, team, sources] =
      await Promise.all([
        this.briefs.today(actor),
        this.briefs.storedWeekly(actor),
        this.work.ready(actor, stack),
        this.work.deadlines(actor),
        this.work.noSummarySessions(actor),
        this.query.timeline(actor, { from: since.toISOString(), limit: SINCE_ROWS }, { excludeOwn: true }),
        this.query.countSince(actor, since),
        this.counters.get(actor),
        this.team.stats(actor.workspaceId, timezone),
        this.sources.list(actor.workspaceId),
      ]);
    return {
      date: localDate(now, timezone),
      timezone,
      now: now.toISOString(),
      brief,
      awaitingMe: stack,
      readyTasks: ready,
      deadlines,
      noSummarySessions: sessions,
      changesSince: { since: since.toISOString(), events: [...rows.items], total },
      counters,
      team,
      sources,
      weekly,
    };
  }

  /** The visit: clears the one count, for every open tab of this member. */
  async markSeen(actor: MemberActor): Promise<void> {
    await this.seen.mark(actor.workspaceId, actor.userId);
    await this.realtime.publishEnvelope(actor.workspaceId, {
      event: 'inbox.read',
      data: { ids: [], unread: await this.inbox.unreadCount(actor.workspaceId, actor.userId) },
      audience: { userIds: [actor.userId] },
    });
  }
}
