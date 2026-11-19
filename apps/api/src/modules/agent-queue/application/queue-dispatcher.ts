/**
 * @file Starts due runs and records how they end (docs/16 §9). It runs where the bridge sockets are, because a run is a chat turn on a device.
 * @description Postgres is the truth: a tick reads the due runs, oldest position first, and starts what the limits allow. It ticks every `TICK_MS`, when a device becomes ready, when a turn ends, and after any change the owner makes, one tick per member at a time.
 * BullMQ is not used for this: its delayed jobs would be a second copy of the schedule, and a job could run in a worker that holds no socket. The repeating tick needs neither.
 * A run claims its slot in one statement (`queued` to `running`), so two ticks cannot start it twice. A restart marks what was running as interrupted, and nothing starts it again by itself.
 * A usage limit pauses the queue and says when it resets; it continues once at that time, and with no time it waits for the owner. There is no retry loop. Signed out puts the run back in line and the queue waits, checking the device's sign-in at most once a minute, which runs no model.
 * §9.2: before a run is claimed, worktree isolation makes its own copy of the repository (or finds it again for a plan's next step), and the run works there. A folder
 * that is no repository's top works in the folder itself, as does every run with folder isolation; there a run waits while the folder holds changes not committed, until the
 * owner lets it go. Both happen before the claim, so a run that waits or fails here never counts against the day.
 */
import {
  type EngineStatus,
  engineStatusSchema,
  folderStatusSchema,
  type MemberActor,
  nextWeekly,
  QUEUE_LIMITS,
  type Role,
  WEEKDAYS,
  type WorkReport,
  worktreeKeyOf,
  type WorktreePrepared,
  worktreePreparedSchema,
} from '@hub/contracts';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { runUnscoped } from '@/infra/prisma/workspace-scope';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import {
  ChatsService,
  ChatTurnEvents,
  type QueueTurn,
  type TurnEndedFact,
  type TurnWaitingFact,
} from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';
import { ActorService } from '@/modules/identity';
import { NotificationWriter } from '@/modules/notifications';
import { SettingsService } from '@/modules/workspaces';

import { folderKey, holdFor, isDue, type QueueGate } from '../domain/queue-rules';
import { promptRoles } from '../domain/run-context';
import { AgentQueueStore, type RunRow } from './queue-store';

const TICK_MS = 15_000;
const ENGINE_TIMEOUT_MS = 30_000;
const SIGN_IN_RECHECK_MS = 60_000;
/** Making a copy is a `git worktree add` and a few links; finding one again is quicker still. */
const WORKTREE_TIMEOUT_MS = 120_000;
const STATUS_TIMEOUT_MS = 30_000;
const SYSTEM_AUDIT = (workspaceId: string) =>
  ({ kind: 'system', userId: null, via: 'scheduler', workspaceId, roles: [] }) as const;

@Injectable()
export class AgentQueueDispatcher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AgentQueueDispatcher.name);
  private readonly chains = new Map<string, Promise<void>>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: AgentQueueStore,
    private readonly hub: BridgeHub,
    private readonly chats: ChatsService,
    private readonly turnEvents: ChatTurnEvents,
    private readonly actors: ActorService,
    private readonly notices: NotificationWriter,
    private readonly realtime: RealtimePublisher,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get active(): boolean {
    return this.config.PROCESS_ROLE !== 'worker';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.active) return;
    // The sockets went with the last process, and each bridge stopped its turns when its socket closed.
    const cut = await runUnscoped(
      'a restart cuts off every running run, in every project',
      async () =>
        await this.store.tx.agentRun.updateMany({
          where: { state: 'running' },
          data: { state: 'interrupted', failure: 'cut_off', endedAt: this.store.now() },
        }),
    );
    if (cut.count > 0) this.logger.warn(`${cut.count} queued runs were cut off by a restart`);
    this.turnEvents.onEnded((fact) => this.ended(fact));
    this.turnEvents.onWaiting((fact) => this.waiting(fact));
    this.turnEvents.onLimit((fact) => {
      if (fact.limit.status === 'rejected') {
        return this.pauseForLimit(fact.userId, fact.limit.resetsAt ?? null);
      }
    });
    this.hub.onReady((_deviceId, userId) => void this.kick(userId));
    // Tests drive the tick themselves, so a timer never races them.
    if (this.config.QUEUE_MODE === 'inline') return;
    this.timer = setInterval(() => void this.timedTick(), TICK_MS);
    this.timer.unref();
    void this.timedTick();
  }

  /**
   * The timer's tick. It runs with nobody awaiting it, so a failure is logged here: once a database that stalled for a moment failed this tick's
   * query, the rejection reached no handler and ended the whole API, with every device's bridge connection (2026-11-15, 2026-11-16).
   */
  private timedTick(): Promise<void> {
    return this.tickAll().catch((error: unknown) =>
      this.logger.warn(`The queue tick could not look for due runs: ${String(error)}`),
    );
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One tick for this member, after whatever tick is already going. */
  kick(userId: string): Promise<void> {
    if (!this.active) return Promise.resolve();
    const next = (this.chains.get(userId) ?? Promise.resolve())
      .then(() => this.tick(userId))
      .catch((error: unknown) => this.logger.warn(`A queue tick failed: ${String(error)}`));
    this.chains.set(userId, next);
    return next;
  }

  /** Every member with a run that could start. */
  async tickAll(): Promise<void> {
    const now = this.store.now();
    const users = await runUnscoped(
      'the tick looks for due runs of every member',
      async () =>
        await this.store.tx.agentRun.findMany({
          where: { state: 'queued', pausedAt: null, OR: [{ runAt: null }, { runAt: { lte: now } }] },
          distinct: ['userId'],
          select: { userId: true },
        }),
    );
    for (const { userId } of users) await this.kick(userId);
  }

  private async tick(userId: string): Promise<void> {
    let limits = await this.store.limits(userId);
    if (limits.pausedReason === 'usage_limit' && limits.resumesAt && limits.resumesAt <= this.store.now()) {
      // The limit said when it resets: the queue continues once, oldest first.
      await this.store.tx.agentQueueSettings.update({
        where: { userId },
        data: { pausedAt: null, pausedReason: null, resumesAt: null },
      });
      await this.store.changed(userId, null);
      limits = await this.store.limits(userId);
    }
    const now = this.store.now();
    const due = (
      await this.store.tx.agentRun.findMany({
        where: { userId, state: 'queued', pausedAt: null },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      })
    ).filter((run) => isDue(run, now));
    for (const run of due) {
      const gate = await this.store.gate(userId, limits);
      const hold = holdFor(run, gate);
      if (hold === 'paused_all' || hold === 'usage_limit' || hold === 'quiet_hours') return;
      if (hold === 'daily_limit' || hold === 'concurrency') return;
      if (hold === 'folder_busy' || hold === 'device_offline' || hold === 'engine_unavailable') continue;
      // `folder_dirty` is looked at again on each tick, so a folder the owner has since committed lets the run go by itself.
      if (!(await this.engineReady(run.deviceId))) continue;
      await this.start(run, gate);
    }
  }

  /** Asks the device before a start. Signed out is checked past the bridge's cache, at most once a minute. */
  private async engineReady(deviceId: string): Promise<boolean> {
    const lastCheck = this.store.signedOut.get(deviceId);
    if (lastCheck !== undefined && Date.now() - lastCheck < SIGN_IN_RECHECK_MS) return false;
    let engine: EngineStatus;
    try {
      engine = engineStatusSchema.parse(
        await this.hub.request(deviceId, 'engine.status', lastCheck === undefined ? {} : { fresh: true }, {
          timeoutMs: ENGINE_TIMEOUT_MS,
        }),
      );
    } catch {
      return false;
    }
    if (!engine.canRun) {
      this.store.engineUnavailable.add(deviceId);
      return false;
    }
    this.store.engineUnavailable.delete(deviceId);
    if (engine.signedIn === false) {
      this.store.signedOut.set(deviceId, Date.now());
      return false;
    }
    this.store.signedOut.delete(deviceId);
    return true;
  }

  private async start(run: RunRow, gate: QueueGate): Promise<void> {
    const place = await this.placeOf(run, gate);
    if (place === 'wait') return;
    const now = this.store.now();
    const claimed = await this.store.tx.agentRun.updateMany({
      where: { id: run.id, userId: run.userId, state: 'queued', pausedAt: null },
      data: { state: 'running', startedAt: now, failure: null, dirtyFiles: null },
    });
    if (claimed.count === 0) return;
    if (run.repeatDay && run.repeatTime) await this.nextOccurrence(run);
    try {
      const actor = await this.actorFor(run);
      const turn = { ...(await this.queueTurn(run)), ...(place.isolated ? { isolated: true } : {}) };
      const started = run.chatId
        ? await this.chats.sendForQueue(actor, run.chatId, {
            prompt: run.prompt,
            ...(run.cardKey ? { card: run.cardKey } : {}),
            run: turn,
          })
        : await this.chats.startForQueue(actor, {
            device: run.deviceId,
            folder: place.folder,
            title: run.title,
            prompt: run.prompt,
            ...(run.cardKey ? { card: run.cardKey } : {}),
            run: turn,
          });
      await this.store.tx.agentRun.update({
        where: { id: run.id, userId: run.userId },
        data: { chatId: started.chatId, messageId: started.messageId },
      });
      await this.audit.record(actor, {
        action: 'queue.start',
        targetType: 'agent_run',
        targetId: run.id,
        summary: `The queue started "${run.title}" in ${place.folder}`.slice(0, 1_000),
      });
    } catch (error) {
      const code = (error as { code?: string }).code ?? 'unknown';
      this.logger.warn(`A queued run did not start: ${code}`);
      // Nothing ran, so it waits in line again, except for a reason that will not pass by itself.
      const back = code === 'hub.devices.offline' || code === 'hub.chats.turn_running';
      await this.store.tx.agentRun.update({
        where: { id: run.id, userId: run.userId },
        data: back
          ? { state: 'queued', startedAt: null }
          : {
              state: 'failed',
              failure: code === 'hub.chats.folder_not_allowed' ? 'folder_not_allowed' : 'unknown',
              summary: code,
              endedAt: this.store.now(),
            },
      });
    }
    await this.store.changed(run.userId, run.id, run.workspaceId);
  }

  /**
   * Where the run will work (§9.2), decided before it is claimed. `wait` leaves it queued: its folder holds changes not committed, or its folder turned out to be
   * no repository's top, so the next tick holds and starts it on the folder itself. A copy that cannot be made fails the run, with Git's own words.
   */
  private async placeOf(
    run: RunRow,
    gate: QueueGate,
  ): Promise<{ folder: string; isolated: boolean } | 'wait'> {
    if (run.worktreeFolder && !run.worktreeRemovedAt) return { folder: run.worktreeFolder, isolated: true };
    if (gate.isolation === 'worktree' && this.store.canIsolate(run.deviceId, run.folder)) {
      const made = await this.prepareCopy(run);
      if (made === 'not_a_repository') {
        this.store.notRepository.add(folderKey(run.deviceId, run.folder));
        await this.store.changed(run.userId, run.id, run.workspaceId);
        return 'wait';
      }
      if (made instanceof Error) {
        await this.failQueued(run, `worktree: ${made.message}`.slice(0, QUEUE_LIMITS.summaryChars));
        return 'wait';
      }
      await this.store.tx.agentRun.update({
        where: { id: run.id, userId: run.userId },
        data: {
          worktreeFolder: made.folder,
          worktreeBranch: made.branch,
          worktreeBase: made.base,
          worktreeRemovedAt: null,
        },
      });
      return { folder: made.folder, isolated: true };
    }
    if (!run.allowDirty) {
      const changed = await this.changedFilesIn(run);
      if (changed !== (run.dirtyFiles ?? 0)) {
        await this.store.tx.agentRun.update({
          where: { id: run.id, userId: run.userId },
          data: { dirtyFiles: changed > 0 ? changed : null },
        });
        await this.store.changed(run.userId, run.id, run.workspaceId);
      }
      if (changed > 0) return 'wait';
    }
    return { folder: run.folder, isolated: false };
  }

  /** The run's copy, or why there is none: `not_a_repository` for a folder that is no repository's top, an Error for anything else. */
  private async prepareCopy(run: RunRow): Promise<WorktreePrepared | 'not_a_repository' | Error> {
    try {
      const answer = await this.hub.request(
        run.deviceId,
        'worktree.prepare',
        { folder: run.folder, key: worktreeKeyOf(run) },
        { timeoutMs: WORKTREE_TIMEOUT_MS },
      );
      return worktreePreparedSchema.parse(answer);
    } catch (error) {
      const details = (error as { details?: { reason?: string; message?: string } }).details;
      if (details?.reason === 'not_a_repository') return 'not_a_repository';
      return new Error(details?.message ?? details?.reason ?? (error as { code?: string }).code ?? 'unknown');
    }
  }

  /** Changed files in the run's folder, untracked ones counted. 0 when the bridge cannot say, as an older one cannot: the run then goes as it did before. */
  private async changedFilesIn(run: RunRow): Promise<number> {
    if (!this.hub.supports(run.deviceId, 'folder.status')) return 0;
    try {
      const status = folderStatusSchema.parse(
        await this.hub.request(
          run.deviceId,
          'folder.status',
          { folder: run.folder },
          { timeoutMs: STATUS_TIMEOUT_MS },
        ),
      );
      return status.changed;
    } catch {
      return 0;
    }
  }

  /** A run that cannot start for a reason that will not pass by itself fails while still queued, and never counts against the day. */
  private async failQueued(run: RunRow, summary: string): Promise<void> {
    await this.store.tx.agentRun.updateMany({
      where: { id: run.id, userId: run.userId, state: 'queued' },
      data: { state: 'failed', failure: 'unknown', summary, endedAt: this.store.now() },
    });
    await this.store.changed(run.userId, run.id, run.workspaceId);
  }

  /** The run's mode, extra folders and roles (D58 to D60), with each role's reading path as the project holds it now. */
  private async queueTurn(run: RunRow): Promise<QueueTurn> {
    const roles = run.roles as Role[];
    const paths = roles.length > 0 ? await this.settings.value(run.workspaceId, 'onboarding.paths') : {};
    return {
      mode: run.mode === 'automatic' ? 'automatic' : 'approval',
      extraFolders: run.extraFolders,
      roles: promptRoles(roles, paths),
    };
  }

  /** A weekly run leaves next week's copy as it starts. Weeks missed while the machine was off are one run, not several. */
  private async nextOccurrence(run: RunRow): Promise<void> {
    const limits = await this.store.limits(run.userId);
    const after = new Date(Math.max(this.store.now().getTime(), run.runAt?.getTime() ?? 0));
    const day = WEEKDAYS[(run.repeatDay ?? 1) - 1]!;
    const at = nextWeekly(day, run.repeatTime ?? '08:00', limits.timezone, after);
    await this.store.tx.agentRun.create({
      data: {
        workspaceId: run.workspaceId,
        userId: run.userId,
        deviceId: run.deviceId,
        folder: run.folder,
        extraFolders: run.extraFolders,
        mode: run.mode,
        roles: run.roles,
        source: run.source,
        cardKey: run.cardKey,
        planStep: run.planStep,
        prompt: run.prompt,
        title: run.title,
        position: at.getTime(),
        runAt: at,
        repeatDay: run.repeatDay,
        repeatTime: run.repeatTime,
      },
    });
  }

  private async actorFor(run: RunRow): Promise<MemberActor> {
    const workspace = await this.store.tx.workspace.findUniqueOrThrow({
      where: { id: run.workspaceId },
      select: { slug: true },
    });
    return this.actors.forSlug({ kind: 'user', userId: run.userId, via: 'web' }, workspace.slug);
  }

  private async runOf(fact: { workspaceId: string; userId: string; chatId: string }): Promise<RunRow | null> {
    return this.store.tx.agentRun.findFirst({
      where: { workspaceId: fact.workspaceId, userId: fact.userId, chatId: fact.chatId, state: 'running' },
    });
  }

  /** A run waiting on the owner reaches the inbox, and keeps its folder (§9). */
  private async waiting(fact: TurnWaitingFact): Promise<void> {
    const run = await this.runOf(fact);
    if (!run) return;
    const card = run.cardKey
      ? await this.store.tx.card.findFirst({
          where: { workspaceId: run.workspaceId, key: run.cardKey },
          select: { id: true, key: true, title: true },
        })
      : null;
    const envelopes = await this.deliver(run, card);
    for (const envelope of envelopes) await this.realtime.publishEnvelope(run.workspaceId, envelope);
    await this.store.changed(run.userId, run.id, run.workspaceId);
  }

  private async deliver(run: RunRow, card: { id: string; key: string; title: string } | null) {
    return this.notices.deliver(
      {
        workspaceId: run.workspaceId,
        actorId: null,
        ...(card ? { card } : {}),
        params: { title: run.title },
      },
      [
        {
          kind: 'system',
          i18nKey: 'run_waiting',
          userIds: [run.userId],
          link: { view: 'queue' },
          params: { title: run.title },
        },
      ],
    );
  }

  private async ended(fact: TurnEndedFact): Promise<void> {
    const run = await this.runOf(fact);
    if (run) await this.finish(run, fact);
    // A turn ending frees its folder, whoever ran it.
    await this.kick(fact.userId);
  }

  private async finish(run: RunRow, fact: TurnEndedFact): Promise<void> {
    const now = this.store.now();
    if (fact.failure === 'signed_out') {
      // Nothing ran: back in line, and the queue waits for a sign-in.
      this.store.signedOut.set(run.deviceId, Date.now());
      await this.store.tx.agentRun.update({
        where: { id: run.id, userId: run.userId },
        data: { state: 'queued', startedAt: null, chatId: null, messageId: null },
      });
      await this.store.changed(run.userId, run.id, run.workspaceId);
      return;
    }
    const message = await this.store.tx.chatMessage.findFirst({
      where: { id: fact.messageId, workspaceId: fact.workspaceId },
      select: { content: true, reports: true },
    });
    const reports = (message?.reports ?? []) as unknown as WorkReport[];
    const report = reports.at(-1);
    const summary = (report?.summary ?? message?.content ?? '').trim().slice(0, QUEUE_LIMITS.summaryChars);
    const state =
      fact.status === 'done'
        ? 'done'
        : fact.status === 'stopped'
          ? 'stopped'
          : fact.status === 'interrupted' || fact.failure === 'device_offline'
            ? 'interrupted'
            : 'failed';
    await this.store.tx.agentRun.update({
      where: { id: run.id, userId: run.userId },
      data: {
        state,
        failure: fact.failure,
        summary: summary || null,
        changedFiles: fact.changedFiles as object[],
        moved: report ? report.move.moved : null,
        endedAt: now,
      },
    });
    await this.audit.record(SYSTEM_AUDIT(run.workspaceId), {
      action: `queue.${state}`,
      targetType: 'agent_run',
      targetId: run.id,
      summary: `"${run.title}" ended ${state}${fact.failure ? ` (${fact.failure})` : ''}`.slice(0, 1_000),
    });
    if (fact.failure === 'rate_limited') await this.pauseForLimit(run.userId, fact.resetsAt);
    await this.store.changed(run.userId, run.id, run.workspaceId);
  }

  /** The subscription's limit pauses the whole queue. `resetsAt` is in seconds, as the engine reports it. */
  private async pauseForLimit(userId: string, resetsAt: number | null): Promise<void> {
    // The owner's own pause stays theirs: a reset time must not lift it.
    if ((await this.store.limits(userId)).pausedReason === 'owner') return;
    const now = this.store.now();
    const resumesAt = resetsAt ? new Date(resetsAt * 1000) : null;
    await this.store.tx.agentQueueSettings.upsert({
      where: { userId },
      create: { userId, pausedAt: now, pausedReason: 'usage_limit', resumesAt },
      update: { pausedAt: now, pausedReason: 'usage_limit', resumesAt },
    });
    await this.store.changed(userId, null);
  }
}
