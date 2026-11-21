/**
 * @file Briefs (docs/04 §3.19, docs/07 §6): read, save a narrative, and generate on schedule.
 * @description A morning brief is computed on demand until the job stores it (`generatedNow`), and the job keeps a
 * narrative already saved that day. Weekly rows have no user. A unique index cannot see two NULL users as equal, so
 * they are found first. The agent writes the narrative: Hub calls no model (D06).
 */
import {
  type Brief,
  type BriefKind,
  type BriefSections,
  type BriefsQueryInput,
  isAllowed,
  type MemberActor,
  type RealtimeEnvelope,
  type Role,
  type SaveNarrativeInput,
  type SystemActor,
  type WeeklySections,
} from '@hub/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import type { Prisma } from '@/generated/prisma/client';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { CardReader } from '@/modules/cards';
import { NotificationWriter } from '@/modules/notifications';
import { SettingsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { decodeCursor, encodeCursor, type Paginated } from '@/shared/http';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { renderBrief, renderWeekly } from '../domain/brief.template';
import {
  isoWeekday,
  isoWeekOf,
  localDate,
  localMinutes,
  type LocalWeek,
  minutesOf,
  weekFromIso,
  weeklyMoment,
} from '../domain/dates';
import { BriefBuilder } from './brief.builder';
import { TimelineSummaryService } from './timeline-summary.service';

const DAY = 86_400_000;

interface BriefRow {
  readonly id: string;
  readonly kind: string;
  readonly date: string;
  readonly sections: unknown;
  readonly narrative: string | null;
  readonly narrativeBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const asLocale = (value: string | undefined): 'ar' | 'en' => (value === 'en' ? 'en' : 'ar');

@Injectable()
export class BriefsService {
  private readonly logger = new Logger(BriefsService.name);

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly builder: BriefBuilder,
    private readonly summaries: TimelineSummaryService,
    private readonly reader: CardReader,
    private readonly settings: SettingsService,
    private readonly writer: NotificationWriter,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async localeOf(userId: string | null): Promise<'ar' | 'en'> {
    if (!userId) return 'ar';
    const user = await this.txHost.tx.user.findUnique({ where: { id: userId }, select: { locale: true } });
    return asLocale(user?.locale);
  }

  private async toDto(row: BriefRow, locale: 'ar' | 'en'): Promise<Brief> {
    const users = await this.reader.findUsers(row.narrativeBy ? [row.narrativeBy] : []);
    const by = row.narrativeBy ? users.get(row.narrativeBy) : undefined;
    return {
      id: row.id,
      kind: row.kind as BriefKind,
      date: row.date,
      sections: row.sections as Brief['sections'],
      markdown:
        row.kind === 'weekly'
          ? renderWeekly(row.sections as WeeklySections, row.date, locale)
          : renderBrief(row.sections as BriefSections, row.date, locale),
      narrative: row.narrative,
      narrativeBy: by ? { id: by.id, displayName: by.displayName } : null,
      narrativeAt: row.narrative ? row.updatedAt.toISOString() : null,
      generatedNow: false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async sinceFor(actor: MemberActor, date: string): Promise<Date> {
    const last = await this.txHost.tx.brief.findFirst({
      where: { workspaceId: actor.workspaceId, userId: actor.userId, kind: 'morning', date: { lt: date } },
      orderBy: { date: 'desc' },
      select: { createdAt: true },
    });
    return last?.createdAt ?? new Date(this.clock.now().getTime() - DAY);
  }

  /** `GET /briefs/today`. */
  async today(actor: MemberActor): Promise<Brief> {
    const timezone = await this.reader.findWorkspaceTimezone(actor.workspaceId);
    const date = localDate(this.clock.now(), timezone);
    const locale = await this.localeOf(actor.userId);
    const row = await this.findRow(actor.workspaceId, actor.userId, 'morning', date);
    if (row) return this.toDto(row, locale);
    const sections = await this.builder.build(actor, await this.sinceFor(actor, date), this.clock.now());
    return {
      id: null,
      kind: 'morning',
      date,
      sections,
      markdown: renderBrief(sections, date, locale),
      narrative: null,
      narrativeBy: null,
      narrativeAt: null,
      generatedNow: true,
      createdAt: null,
      updatedAt: null,
    };
  }

  /** `GET /briefs/weekly/{isoWeek}`, stored or computed for this read. */
  async weekly(actor: MemberActor, iso: string): Promise<Brief> {
    const week = weekFromIso(iso);
    if (!week) throw new AppException('hub.common.not_found');
    const locale = await this.localeOf(actor.userId);
    const row = await this.findRow(actor.workspaceId, null, 'weekly', iso);
    if (row) return this.toDto(row, locale);
    const sections = await this.summaries.weekly(actor, week);
    return {
      id: null,
      kind: 'weekly',
      date: iso,
      sections,
      markdown: renderWeekly(sections, iso, locale),
      narrative: null,
      narrativeBy: null,
      narrativeAt: null,
      generatedNow: true,
      createdAt: null,
      updatedAt: null,
    };
  }

  /** This week's stored summary, for Today (H4-03). */
  async storedWeekly(actor: MemberActor): Promise<Brief | null> {
    const timezone = await this.reader.findWorkspaceTimezone(actor.workspaceId);
    const { iso } = isoWeekOf(localDate(this.clock.now(), timezone));
    const row = await this.findRow(actor.workspaceId, null, 'weekly', iso);
    return row ? this.toDto(row, await this.localeOf(actor.userId)) : null;
  }

  /** Own morning briefs, and the project's weekly ones, newest first. */
  async list(actor: MemberActor, query: BriefsQueryInput): Promise<Paginated<Brief>> {
    const limit = query.limit ?? 25;
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;
    const where: Prisma.BriefWhereInput = {
      workspaceId: actor.workspaceId,
      OR: [{ userId: actor.userId }, { userId: null }],
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.date ? { date: query.date } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor.sortKey) } } : {}),
    };
    const rows = await this.txHost.tx.brief.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const shown = rows.slice(0, limit);
    const locale = await this.localeOf(actor.userId);
    const last = shown[shown.length - 1];
    return {
      items: await Promise.all(shown.map((row) => this.toDto(row, locale))),
      pagination: {
        nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt.toISOString(), last.id) : null,
        limit,
      },
    };
  }

  /** `PUT /briefs/{kind}/{date}/narrative`, the MCP `save_brief`. The brief is stored now if the job has not run. */
  async saveNarrative(
    actor: MemberActor,
    kind: BriefKind,
    date: string,
    input: SaveNarrativeInput,
  ): Promise<Brief> {
    assertNoSecrets(input);
    if (kind === 'weekly' && !isAllowed('brief.save_weekly', actor.roles)) {
      throw new AppException('hub.common.forbidden');
    }
    const userId = kind === 'weekly' ? null : actor.userId;
    const existing = await this.findRow(actor.workspaceId, userId, kind, date);
    const data = { narrative: input.narrative, narrativeBy: actor.userId, updatedAt: this.clock.now() };
    const row = existing
      ? await this.txHost.tx.brief.update({
          where: { id: existing.id, workspaceId: actor.workspaceId },
          data,
        })
      : await this.txHost.tx.brief.create({
          data: {
            workspaceId: actor.workspaceId,
            userId,
            kind,
            date,
            sections: await this.sectionsFor(actor, kind, date),
            createdAt: this.clock.now(),
            ...data,
          },
        });
    return this.toDto(row, await this.localeOf(actor.userId));
  }

  private async sectionsFor(
    actor: MemberActor,
    kind: BriefKind,
    date: string,
  ): Promise<Prisma.InputJsonValue> {
    if (kind === 'weekly') {
      const week = weekFromIso(date);
      if (!week) throw new AppException('hub.common.validation', { details: { issues: [{ path: 'date' }] } });
      return await this.summaries.weekly(actor, week);
    }
    const built = await this.builder.build(actor, await this.sinceFor(actor, date), this.clock.now());
    return built;
  }

  private findRow(workspaceId: string, userId: string | null, kind: BriefKind, date: string) {
    return this.txHost.tx.brief.findFirst({ where: { workspaceId, userId, kind, date } });
  }

  /** The job: anything now due for this project (docs/07 §5). Safe to call as often as the tick likes. */
  async runDue(workspaceId: string): Promise<{ morning: number; weekly: boolean }> {
    const now = this.clock.now();
    const timezone = await this.reader.findWorkspaceTimezone(workspaceId);
    const date = localDate(now, timezone);
    const minutes = localMinutes(now, timezone);
    const morningAt = await this.settings.value(workspaceId, 'digest.morning_time');
    const morning = minutes >= minutesOf(morningAt) ? await this.generateMornings(workspaceId, date) : 0;
    const moment = weeklyMoment(await this.settings.value(workspaceId, 'digest.weekly_day_time'));
    const weekly =
      isoWeekday(date) === moment.weekday && minutes >= moment.minutes
        ? await this.generateWeekly(workspaceId, isoWeekOf(date))
        : false;
    return { morning, weekly };
  }

  private async generateMornings(workspaceId: string, date: string): Promise<number> {
    const members = await this.txHost.tx.membership.findMany({
      where: { workspaceId, status: 'active', user: { status: 'active' } },
      select: { userId: true, roles: true },
    });
    let stored = 0;
    for (const member of members) {
      const existing = await this.findRow(workspaceId, member.userId, 'morning', date);
      if (existing) continue;
      const actor: MemberActor = {
        kind: 'user',
        userId: member.userId,
        via: 'web',
        workspaceId,
        roles: member.roles as Role[],
      };
      try {
        await this.storeMorning(actor, date);
        stored += 1;
      } catch (error) {
        this.logger.warn(`Brief for ${member.userId} failed: ${String(error)}`);
      }
    }
    return stored;
  }

  private async storeMorning(actor: MemberActor, date: string): Promise<void> {
    const sections = await this.builder.build(actor, await this.sinceFor(actor, date), this.clock.now());
    const envelopes: RealtimeEnvelope[] = await this.txHost.withTransaction(async () => {
      await this.txHost.tx.brief.create({
        data: {
          workspaceId: actor.workspaceId,
          userId: actor.userId,
          kind: 'morning',
          date,
          sections,
          createdAt: this.clock.now(),
          updatedAt: this.clock.now(),
        },
      });
      return this.writer.deliver({ workspaceId: actor.workspaceId, actorId: null, params: { date } }, [
        { kind: 'brief', i18nKey: 'brief_ready', userIds: [actor.userId] },
      ]);
    });
    await this.publish(actor.workspaceId, [
      ...envelopes,
      { event: 'brief.ready', data: { kind: 'morning', date }, audience: { userIds: [actor.userId] } },
    ]);
  }

  private async generateWeekly(workspaceId: string, week: LocalWeek): Promise<boolean> {
    if (await this.findRow(workspaceId, null, 'weekly', week.iso)) return false;
    const actor: SystemActor = { kind: 'system', userId: null, via: 'scheduler', workspaceId, roles: [] };
    const sections = await this.summaries.weekly(actor, week);
    await this.txHost.tx.brief.create({
      data: {
        workspaceId,
        userId: null,
        kind: 'weekly',
        date: week.iso,
        sections,
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      },
    });
    await this.realtime.publishEnvelope(workspaceId, {
      event: 'brief.ready',
      data: { kind: 'weekly', date: week.iso },
      audience: 'all',
    });
    return true;
  }

  private async publish(workspaceId: string, envelopes: readonly RealtimeEnvelope[]): Promise<void> {
    for (const envelope of envelopes) await this.realtime.publishEnvelope(workspaceId, envelope);
  }
}
