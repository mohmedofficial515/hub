/**
 * @file `GET /counters` (docs/04 §3.23): every sidebar badge, derived from state on each read, so there is nothing
 * to drift. Stored counters are the bug review M4 found.
 */
import { type Counters, isAllowed, type MemberActor } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { CardQueryService } from '@/modules/cards';
import { MemberWorkService } from '@/modules/digests';
import { InboxService } from '@/modules/notifications';
import { OnboardingService } from '@/modules/workspaces';

import { SeenStore } from './seen.store';
import { SourceHealthService } from './source-health.service';

@Injectable()
export class CountersService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly work: MemberWorkService,
    private readonly inbox: InboxService,
    private readonly query: CardQueryService,
    private readonly seen: SeenStore,
    private readonly onboarding: OnboardingService,
    private readonly sources: SourceHealthService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private cardCount(workspaceId: string, type: string, statuses: readonly string[]): Promise<number> {
    return this.txHost.tx.card.count({
      where: { workspaceId, type, status: { in: [...statuses] }, archivedAt: null },
    });
  }

  private async onboardingLeft(actor: MemberActor): Promise<number> {
    const groups = await this.onboarding.get(actor);
    return new Set(groups.flatMap((group) => group.items.filter((item) => !item.done).map((item) => item.id)))
      .size;
  }

  async get(actor: MemberActor): Promise<Counters> {
    const { workspaceId } = actor;
    const stack = await this.work.awaiting(actor);
    const mine = (type: string) => stack.filter((card) => card.type === type);
    const manager = isAllowed('member.invite', actor.roles);
    const [
      inboxUnread,
      ready,
      sessions,
      newEvents,
      onboardingLeft,
      decisionsOpen,
      needsOpen,
      handoffsPending,
      redesignInReview,
      ideas,
      plans,
    ] = await Promise.all([
      this.inbox.unreadCount(workspaceId, actor.userId),
      this.work.ready(actor, stack),
      this.work.noSummarySessions(actor),
      this.seen.since(workspaceId, actor.userId).then((since) => this.query.countSince(actor, since)),
      this.onboardingLeft(actor),
      this.cardCount(workspaceId, 'decision', ['open']),
      this.cardCount(workspaceId, 'need', ['requested', 'in_progress', 'delivered']),
      this.cardCount(workspaceId, 'handoff', ['pending', 'acknowledged']),
      this.cardCount(workspaceId, 'redesign', ['review']),
      this.cardCount(workspaceId, 'idea', ['open', 'exploring']),
      this.cardCount(workspaceId, 'plan', ['draft', 'in_review', 'approved', 'in_progress']),
    ]);
    return {
      inboxUnread,
      awaitingMe: stack.length,
      decisionsOpen,
      decisionsMine: mine('decision').length,
      decisionsOverdue: mine('decision').filter((card) => card.flags.overdue).length,
      needsOpen,
      needsMine: mine('need').length,
      handoffsPending,
      handoffsMine: mine('handoff').length,
      tasksReadyForMe: ready.length,
      redesignInReview,
      noSummarySessions: sessions.length,
      newEvents,
      onboardingLeft,
      invitesPending: manager
        ? await this.txHost.tx.invite.count({
            where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: this.clock.now() } },
          })
        : 0,
      sourceProblems: manager
        ? (await this.sources.list(workspaceId)).filter(
            (source) => source.status === 'failing' || source.status === 'lagging',
          ).length
        : 0,
      planningOpen: ideas + plans,
    };
  }
}
