/**
 * @file A session's one card, whichever of the summary and the hook arrives first (docs/05 §5, docs/06 §4).
 * @description `SessionLog` is the row both sides meet on. A summary creates or upgrades the card at once. A hook only
 * records facts and schedules the grace job, which makes a facts-only card if no summary came. Everything repeats
 * safely: one card per session id, and each handoff or follow-up is created once, matched by title.
 */
import {
  type CardWrittenDto,
  type HookSessionPayload,
  hookSessionPayloadSchema,
  type LogSessionInput,
  type MemberActor,
  type Principal,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { QUEUES, QueueService } from '@/infra/queue/queue.service';
import { CardQueryService, CardRepository, CardService } from '@/modules/cards';
import { ActorService } from '@/modules/identity';
import { SettingsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import {
  factsBody,
  factsOf,
  factsTitle,
  isIdleSession,
  isInsideFolder,
  keysInText,
  repoSlugOfRemote,
  summaryBody,
  summaryTitle,
} from '../domain/session';

export const SESSION_RECONCILE_JOB = 'session.reconcile';
const MINUTE_MS = 60_000;

export interface SessionReconcileData {
  readonly workspaceId: string;
  readonly sessionId: string;
}

interface StoredSummary {
  readonly createdTitles?: readonly string[];
  readonly idle?: boolean;
}

export interface LoggedSession {
  readonly card: CardWrittenDto;
  readonly followUpKeys: readonly string[];
}

export interface SessionWithoutSummary {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly cardKey: string;
  readonly commits: number;
  readonly files: number;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly cards: CardService,
    private readonly query: CardQueryService,
    private readonly repository: CardRepository,
    private readonly actors: ActorService,
    private readonly settings: SettingsService,
    private readonly queues: QueueService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Which project a hook or a session start belongs to: the folder's `X-Hub-Project`, else the project whose
   * local folders hold `cwd`, else the member's default (docs/15 §5).
   */
  async actorFor(
    principal: Principal,
    header: string | undefined,
    cwd: string | undefined,
  ): Promise<MemberActor> {
    if (header?.trim() || !cwd) return this.actors.forProject(principal, { header });
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId: principal.userId, status: 'active' },
      select: { workspace: { select: { slug: true, repoPaths: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    const match = memberships.find(({ workspace }) =>
      workspace.repoPaths.some((folder) => isInsideFolder(cwd, folder)),
    );
    return this.actors.forProject(principal, match ? { header: match.workspace.slug } : {});
  }

  /** `log_session`. Repeating it updates the same card and creates nothing twice. */
  async logSummary(actor: MemberActor, input: LogSessionInput): Promise<LoggedSession> {
    assertNoSecrets(input);
    const key = { workspaceId: actor.workspaceId, sessionId: input.sessionId };
    const log = await this.txHost.tx.sessionLog.upsert({
      where: { workspaceId_sessionId: key },
      create: {
        ...key,
        userId: actor.userId,
        repo: input.repo ?? null,
        branch: input.branch ?? null,
        createdAt: this.clock.now(),
      },
      update: {},
    });
    if (log.userId !== actor.userId) throw new AppException('hub.cards.not_found');

    const cardId = log.cardId ?? (await this.ensureCard(actor, input, log.hookPayload));
    const stored = (log.summaryPayload ?? {}) as StoredSummary;
    const known = new Set(stored.createdTitles ?? []);
    const handoffs = (input.handoffs ?? []).filter((handoff) => !known.has(handoff.title));
    const followUps = (input.followUps ?? []).filter((task) => !known.has(task.title));

    const result = await this.cards.apply(actor, { cardId }, 'session.log', {
      ...input,
      mode: 'summary',
      handoffs,
      followUps,
      fromRole: actor.roles[0] ?? 'owner',
      linkKeys: await this.existingKeys(actor, input, cardId),
    });

    await this.txHost.tx.sessionLog.update({
      where: { workspaceId_sessionId: key },
      data: {
        cardId,
        summaryReceivedAt: this.clock.now(),
        summaryPayload: {
          ...input,
          createdTitles: [
            ...known,
            ...handoffs.map((handoff) => handoff.title),
            ...followUps.map((task) => task.title),
          ],
        },
      },
    });
    const followUpKeys = result.followUps
      .map((followUp) => followUp.card)
      .filter((card) => card.type === 'task' || card.type === 'handoff')
      .map((card) => card.key);
    return { card: await this.query.written(actor, result), followUpKeys: [...new Set(followUpKeys)] };
  }

  /** `POST /capture/session`. Never makes a card by itself: a summary may still come. */
  async ingestHook(
    actor: MemberActor,
    payload: HookSessionPayload,
  ): Promise<{ sessionLogId: string; cardKey: string | null }> {
    assertNoSecrets(payload);
    const now = this.clock.now();
    const repo = await this.repoName(actor.workspaceId, payload.remote);
    const key = { workspaceId: actor.workspaceId, sessionId: payload.sessionId };
    const fields = {
      hookReceivedAt: now,
      hookPayload: JSON.parse(JSON.stringify(payload)) as object,
      cwd: payload.cwd,
      branch: payload.branch ?? null,
      repo,
    };
    const log = await this.txHost.tx.sessionLog.upsert({
      where: { workspaceId_sessionId: key },
      create: { ...key, userId: actor.userId, createdAt: now, ...fields },
      update: fields,
    });
    if (log.userId !== actor.userId) throw new AppException('hub.cards.not_found');

    if (log.cardId) {
      const { card } = await this.cards.apply(actor, { cardId: log.cardId }, 'session.log', {
        mode: 'facts',
        ...factsOf(payload),
      });
      return { sessionLogId: log.id, cardKey: card.key };
    }

    const grace = await this.settings.value(actor.workspaceId, 'capture.session.hook_grace_minutes');
    const data: SessionReconcileData = key;
    await this.queues.add(QUEUES.sessions, SESSION_RECONCILE_JOB, data, {
      delay: Number(grace) * MINUTE_MS,
      // A later hook of the same session waits for its own grace period, so each gets a job.
      jobId: `reconcile-${log.id}-${now.getTime()}`,
      removeOnComplete: true,
      attempts: 3,
    });
    return { sessionLogId: log.id, cardKey: null };
  }

  /** The grace job (docs/06 §4.3). A summary, or a hook newer than the grace period, ends it with nothing done. */
  async reconcile({ workspaceId, sessionId }: SessionReconcileData): Promise<void> {
    const where = { workspaceId_sessionId: { workspaceId, sessionId } };
    const log = await this.txHost.tx.sessionLog.findUnique({ where });
    if (!log?.hookPayload || log.summaryReceivedAt || log.cardId || !log.hookReceivedAt) return;
    const grace = await this.settings.value(workspaceId, 'capture.session.hook_grace_minutes');
    const dueAt = log.hookReceivedAt.getTime() + Number(grace) * MINUTE_MS;
    if (this.clock.now().getTime() < dueAt) return;

    const payload = hookSessionPayloadSchema.parse(log.hookPayload);
    if (isIdleSession(payload)) {
      await this.txHost.tx.sessionLog.update({ where, data: { summaryPayload: { idle: true } } });
      return;
    }
    const { card } = await this.cards.apply(
      { kind: 'system', userId: null, via: 'adapter', workspaceId, roles: [] },
      null,
      'change.create',
      {
        title: factsTitle(payload),
        body: factsBody(payload),
        repo: log.repo,
        branch: payload.branch ?? null,
        sessionId,
        noSummary: true,
        durationSec: payload.durationSec ?? null,
        facts: factsOf(payload),
        notifyUserId: log.userId,
      },
    );
    await this.txHost.tx.sessionLog.update({ where, data: { cardId: card.id } });
  }

  /** Facts-only sessions of this member, newest first. Idle sessions have no card, so they never count. */
  async withoutSummary(actor: MemberActor, limit = 10): Promise<SessionWithoutSummary[]> {
    const logs = await this.txHost.tx.sessionLog.findMany({
      where: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        summaryReceivedAt: null,
        cardId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return Promise.all(
      logs.map(async (log) => {
        const card = await this.repository.findCard(actor.workspaceId, { cardId: log.cardId as string });
        return {
          sessionId: log.sessionId,
          startedAt: log.createdAt.toISOString(),
          repo: log.repo,
          branch: log.branch,
          cardKey: card?.key ?? '',
          commits: Number(card?.detail?.['commitCount'] ?? 0),
          files: Number(card?.detail?.['filesChanged'] ?? 0),
        };
      }),
    );
  }

  private async ensureCard(actor: MemberActor, input: LogSessionInput, hook: unknown): Promise<string> {
    const key = { workspaceId: actor.workspaceId, sessionId: input.sessionId };
    const existing = await this.txHost.tx.card.findFirst({
      where: { workspaceId: actor.workspaceId, externalKey: `session:${input.sessionId}` },
      select: { id: true },
    });
    const parsed = hook ? hookSessionPayloadSchema.safeParse(hook) : null;
    const facts = parsed?.success ? parsed.data : null;
    const cardId =
      existing?.id ??
      (
        await this.cards.apply(actor, null, 'change.create', {
          title: summaryTitle(input.changed),
          body: summaryBody(input),
          repo: input.repo ?? null,
          branch: input.branch ?? null,
          sessionId: input.sessionId,
          changed: input.changed,
          remaining: input.remaining ?? null,
          noSummary: false,
          durationSec: input.durationSec ?? facts?.durationSec ?? null,
          ...(facts ? { facts: factsOf(facts) } : {}),
        })
      ).card.id;
    await this.txHost.tx.sessionLog.update({ where: { workspaceId_sessionId: key }, data: { cardId } });
    return cardId;
  }

  /** `cardKeys` must exist. Keys that are merely named in the text are linked only when they do. */
  private async existingKeys(actor: MemberActor, input: LogSessionInput, cardId: string): Promise<string[]> {
    const workspace = await this.txHost.tx.workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: { keyPrefix: true },
    });
    const named = keysInText(`${input.changed}\n${input.remaining ?? ''}`, workspace.keyPrefix);
    const given = input.cardKeys ?? [];
    const keys: string[] = [];
    for (const key of new Set([...given, ...named])) {
      const card = await this.repository.findCard(actor.workspaceId, { cardKey: key });
      if (!card || card.archivedAt) {
        if (given.includes(key)) throw new AppException('hub.cards.not_found', { details: { key } });
        continue;
      }
      if (card.id !== cardId) keys.push(key);
    }
    return keys;
  }

  /** The source name of a remote URL, or the plain `owner/repo` when no GitHub source matches. */
  private async repoName(workspaceId: string, remote: string | null | undefined): Promise<string | null> {
    const slug = repoSlugOfRemote(remote);
    if (!slug) return null;
    const sources = await this.txHost.tx.source.findMany({
      where: { workspaceId, kind: 'github_repo' },
      select: { name: true, config: true },
    });
    const match = sources.find(({ config }) => {
      const { owner, repo } = config as { owner?: string; repo?: string };
      return `${owner}/${repo}`.toLowerCase() === slug;
    });
    return match?.name ?? slug;
  }
}
