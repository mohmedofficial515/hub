/**
 * @file Starts due runs and records how they end (docs/16 §9). It runs where the bridge sockets are, because a run is a chat turn on a device.
 * @description Postgres is the truth: a tick reads the due runs, oldest position first, and starts what the limits allow. It ticks every `TICK_MS`, when a device becomes ready, when a turn ends, and after any change the owner makes, one tick per member at a time.
 * BullMQ is not used for this: its delayed jobs would be a second copy of the schedule, and a job could run in a worker that holds no socket. The repeating tick needs neither.
 * A run claims its slot in one statement (`queued` to `running`), so two ticks cannot start it twice. A restart marks what was running as interrupted, and nothing starts it again by itself.
 * A usage limit pauses the queue and says when it resets; it continues once at that time, and with no time it waits for the owner. There is no retry loop. Signed out puts the run back in line and the queue waits, checking the device's sign-in at most once a minute, which runs no model.
 */
import {
  type EngineStatus,
  engineStatusSchema,
  type MemberActor,
  nextWeekly,
  QUEUE_LIMITS,
  WEEKDAYS,
  type WorkReport,
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
import { ChatsService, ChatTurnEvents, type TurnEndedFact, type TurnWaitingFact } from '@/modules/chats';
import { BridgeHub } from '@/modules/devices';
import { ActorService } from '@/modules/identity';
import { NotificationWriter } from '@/modules/notifications';

import { holdFor, isDue } from '../domain/queue-rules';
import { AgentQueueStore, type RunRow } from './queue-store';

const TICK_MS = 15_000;
const ENGINE_TIMEOUT_MS = 30_000;
const SIGN_IN_RECHECK_MS = 60_000;
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
    this.timer = setInterval(() => void this.tickAll(), TICK_MS);
    this.timer.unref();
    void this.tickAll();
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
      if (!(await this.engineReady(run.deviceId))) continue;
      await this.start(run);
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

  private async start(run: RunRow): Promise<void> {
    const now = this.store.now();
    const claimed = await this.store.tx.agentRun.updateMany({
      where: { id: run.id, userId: run.userId, state: 'queued', pausedAt: null },
      data: { state: 'running', startedAt: now, failure: null },
    });
    if (claimed.count === 0) return;
    if (run.repeatDay && run.repeatTime) await this.nextOccurrence(run);
    try {
      const actor = await this.actorFor(run);
      const started = run.chatId
        ? await this.chats.send(actor, run.chatId, {
            text: run.prompt,
            context: { page: 'queue', ...(run.cardKey ? { card: run.cardKey } : {}) },
            mode: 'execute',
          })
        : await this.chats.startForQueue(actor, {
            device: run.deviceId,
            folder: run.folder,
            title: run.title,
            prompt: run.prompt,
            ...(run.cardKey ? { card: run.cardKey } : {}),
          });
      await this.store.tx.agentRun.update({
        where: { id: run.id, userId: run.userId },
        data: { chatId: started.chatId, messageId: started.messageId },
      });
      await this.audit.record(actor, {
        action: 'queue.start',
        targetType: 'agent_run',
        targetId: run.id,
        summary: `The queue started "${run.title}" in ${run.folder}`.slice(0, 1_000),
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
