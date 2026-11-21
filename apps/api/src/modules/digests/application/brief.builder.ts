/**
 * @file Fills the morning brief's sections for one member (docs/07 §6.1). Data only; the template renders it.
 */
import {
  type BriefCard,
  type BriefSections,
  type CardSummary,
  type CardWithDetail,
  type MemberActor,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService, CardReader } from '@/modules/cards';

import { MemberWorkService } from './member-work.service';

const LIMITS = {
  stack: 10,
  deadlines: 10,
  changes: 15,
  decided: 10,
  ready: 5,
  sessions: 5,
  blocked: 5,
  releases: 5,
};
const HOUR = 3_600_000;
const BRIEF_DEADLINE_HOURS = 48;

export function toBriefCard(card: CardSummary): BriefCard {
  return {
    key: card.key,
    type: card.type,
    title: card.title,
    status: card.status,
    priority: card.priority,
    dueAt: card.dueAt,
    overdue: card.flags.overdue,
    escalated: card.flags.escalated,
    action: card.awaiting,
  };
}

@Injectable()
export class BriefBuilder {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly query: CardQueryService,
    private readonly reader: CardReader,
    private readonly work: MemberWorkService,
  ) {}

  async build(actor: MemberActor, since: Date, now: Date): Promise<BriefSections> {
    const stack = await this.work.awaiting(actor);
    const of = (...types: readonly string[]): BriefCard[] =>
      stack
        .filter((card) => types.includes(card.type))
        .slice(0, LIMITS.stack)
        .map(toBriefCard);
    const horizon = now.getTime() + BRIEF_DEADLINE_HOURS * HOUR;
    const deadlines = (await this.work.deadlines(actor)).filter(
      (card) => card.dueAt && (Date.parse(card.dueAt) <= horizon || card.flags.escalated),
    );
    return {
      awaitingMe: {
        decisions: of('decision'),
        needs: of('need'),
        handoffs: of('handoff'),
        reviews: of('redesign', 'task', 'plan'),
      },
      deadlines: deadlines.slice(0, LIMITS.deadlines).map(toBriefCard),
      changes: await this.changes(actor, since),
      decided: await this.decided(actor, since),
      readyTasks: (await this.work.ready(actor, stack)).slice(0, LIMITS.ready).map(toBriefCard),
      mySessions: (await this.work.noSummarySessions(actor)).slice(0, LIMITS.sessions).map((session) => ({
        sessionId: session.sessionId,
        repo: session.repo,
        branch: session.branch,
      })),
      blocked: await this.blocked(actor),
      releases: await this.releases(actor, since),
    };
  }

  private async changes(actor: MemberActor, since: Date): Promise<BriefSections['changes']> {
    const events = await this.reader.findTimeline(
      actor.workspaceId,
      {
        from: since,
        excludeActorId: actor.userId,
        kinds: ['commit', 'pr_opened', 'pr_merged', 'pr_closed', 'session_logged', 'created'],
      },
      null,
      500,
    );
    const cards = await this.reader.findByIds(actor.workspaceId, [
      ...new Set(events.map((row) => row.cardId)),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    const users = await this.reader.findUsers(events.flatMap((row) => (row.actorId ? [row.actorId] : [])));
    const repos = new Map<string, BriefSections['changes']['repos'][number]>();
    const sessions: BriefSections['changes']['sessions'] = [];
    const handoffs: BriefSections['changes']['handoffs'] = [];
    for (const event of events) {
      const card = byId.get(event.cardId);
      if (!card) continue;
      const author = event.actorId ? (users.get(event.actorId)?.displayName ?? null) : null;
      if (event.kind === 'session_logged') {
        sessions.push({ key: card.key, title: card.title, author });
      } else if (event.kind === 'created') {
        if (card.type === 'handoff') handoffs.push({ key: card.key, title: card.title });
      } else {
        const name = card.repo ?? 'cards';
        const repo = repos.get(name) ?? { name, commitCount: 0, authors: [], prs: [] };
        if (event.kind === 'commit') {
          repo.commitCount += 1;
          if (author && !repo.authors.includes(author)) repo.authors.push(author);
        } else {
          repo.prs.push({ key: card.key, kind: event.kind });
        }
        repos.set(name, repo);
      }
    }
    return {
      since: since.toISOString(),
      repos: [...repos.values()].slice(0, LIMITS.changes),
      sessions: sessions.slice(0, LIMITS.changes),
      handoffs: handoffs.slice(0, LIMITS.changes),
    };
  }

  private async decided(actor: MemberActor, since: Date): Promise<BriefSections['decided']> {
    const events = await this.reader.findTimeline(
      actor.workspaceId,
      { from: since, kinds: ['decided'] },
      null,
      LIMITS.decided,
    );
    const cards = await this.reader.findByIds(
      actor.workspaceId,
      events.map((row) => row.cardId),
    );
    return cards.map((card) => {
      const detail = card.detail ?? {};
      const options = (detail['options'] ?? []) as { id: string; title: string }[];
      return {
        key: card.key,
        title: card.title,
        option: options.find((option) => option.id === detail['chosenOptionId'])?.title ?? null,
        rationale: (detail['rationale'] as string | null | undefined) ?? null,
      };
    });
  }

  private async blocked(actor: MemberActor): Promise<BriefSections['blocked']> {
    const mine = await this.query.matching(
      actor,
      { type: 'task', assigneeId: actor.userId, status: { in: ['claimed', 'in_progress'] } },
      { limit: 100 },
    );
    const rows: BriefSections['blocked'] = [];
    for (const card of mine.filter((row) => row.flags.blocked).slice(0, LIMITS.blocked)) {
      const links = await this.reader.findLinks(actor.workspaceId, card.id);
      const blocker = links.find((link) => link.kind === 'blocked_by' && link.card.closedAt === null)?.card;
      rows.push({
        key: card.key,
        title: card.title,
        blockerKey: blocker?.key ?? null,
        blockerRole: blocker?.ownerRole ?? null,
      });
    }
    return rows;
  }

  private async releases(actor: MemberActor, since: Date): Promise<BriefSections['releases']> {
    const rows = await this.txHost.tx.card.findMany({
      where: {
        workspaceId: actor.workspaceId,
        type: 'release',
        archivedAt: null,
        release: { releasedAt: { gte: since } },
      },
      select: { key: true, title: true, release: { select: { version: true } } },
      take: LIMITS.releases,
    });
    return rows.map((row) => ({
      key: row.key,
      version: row.release?.version ?? null,
      title: row.title,
    }));
  }
}

export type { CardWithDetail };
