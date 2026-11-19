/**
 * @file The owner's side of the queue (docs/16 §9): add a run, order, pause, resume, cancel, pause all, and the limits.
 * @description Every change here is the owner's own press (`queue.manage`, web only): no token and no agent reaches it, so an agent cannot start agents or lift its own limits. A run is checked as a chat is: the device must be the member's and the folder on the project's list, and the bridge checks again when it starts.
 * A run's time is local to the queue's timezone. A task runs `/hub:work`; a plan step that became a task runs as that task, so D52 decides its move the same way.
 */
import {
  type AgentRunDto,
  type ChatTurnStarted,
  type CreateRunInput,
  firstRunAt,
  isTimezone,
  type MemberActor,
  QUEUE_LIMITS,
  type QueueDto,
  type QueueSettingsInput,
  type QueueStateDto,
  type ReorderRunsInput,
  type Role,
  type RunMode,
  runPrompt,
  WEEKDAYS,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AuditService } from '@/modules/audit';
import { CardQueryService } from '@/modules/cards';
import { ChatsService } from '@/modules/chats';
import { BridgeHub, DevicesService } from '@/modules/devices';
import { ProjectsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { reorderPositions } from '../domain/queue-rules';
import { AgentQueueDispatcher } from './queue-dispatcher';
import { AgentQueueStore, type RunRow } from './queue-store';

const OPEN_STATES = ['queued', 'running'];
/** Removing a copy unlinks its packages and asks Git to remove the folder. */
const WORKTREE_REMOVE_TIMEOUT_MS = 120_000;
const CLOSED_TASK = new Set(['done', 'cancelled']);

const registered = (folder: string, repoPaths: readonly string[], platform: string): boolean => {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return false;
  const normal = (path: string) => {
    const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
    return platform === 'win32' ? plain.toLowerCase() : plain;
  };
  const inner = normal(folder);
  return repoPaths.some((path) => inner === normal(path) || inner.startsWith(`${normal(path)}/`));
};

const titleOf = (text: string): string => {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length <= 80 ? line : `${line.slice(0, 79)}…`;
};

@Injectable()
export class AgentQueueService {
  constructor(
    private readonly store: AgentQueueStore,
    private readonly dispatcher: AgentQueueDispatcher,
    private readonly chats: ChatsService,
    private readonly devices: DevicesService,
    private readonly hub: BridgeHub,
    private readonly projects: ProjectsService,
    private readonly cards: CardQueryService,
    private readonly audit: AuditService,
  ) {}

  // ── Reads ─────────────────────────────────────────────────────────────────────────────────────

  /** This project's runs: everything not finished, and the last finished ones. The limits are the member's, across projects. */
  async queue(actor: MemberActor, options: { card?: string } = {}): Promise<QueueDto> {
    const where = {
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      ...(options.card ? { cardKey: options.card } : {}),
    };
    const [open, recent] = await Promise.all([
      this.store.tx.agentRun.findMany({
        where: { ...where, state: { in: OPEN_STATES } },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      this.store.tx.agentRun.findMany({
        where: { ...where, state: { notIn: OPEN_STATES } },
        orderBy: [{ endedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
        take: QUEUE_LIMITS.recent,
      }),
    ]);
    const limits = await this.store.limits(actor.userId);
    const gate = await this.store.gate(actor.userId, limits);
    return {
      state: this.store.stateOf(limits, gate),
      runs: await this.store.toDtos([...open, ...recent], gate),
    };
  }

  async state(actor: MemberActor): Promise<QueueStateDto> {
    const limits = await this.store.limits(actor.userId);
    return this.store.stateOf(limits, await this.store.gate(actor.userId, limits));
  }

  // ── Adding a run ──────────────────────────────────────────────────────────────────────────────

  async create(actor: MemberActor, input: CreateRunInput): Promise<AgentRunDto> {
    assertNoSecrets({ prompt: input.prompt });
    const device = await this.devices.owned(actor.userId, input.device);
    const project = await this.projects.get(actor);
    // D59: the main folder and every extra one must be registered on this project; the bridge checks again.
    const extraFolders = input.extraFolders ?? [];
    for (const folder of [input.folder, ...extraFolders]) {
      if (!registered(folder, project.repoPaths, device.platform)) {
        throw new AppException('hub.chats.folder_not_allowed');
      }
    }
    const what = await this.whatToRun(actor, input);
    const limits = await this.store.limits(actor.userId);
    const now = this.store.now();
    const runAt = firstRunAt(input.when, limits.timezone, now);
    const row = await this.store.tx.agentRun.create({
      data: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        deviceId: input.device,
        folder: input.folder,
        source: what.source,
        cardKey: what.cardKey,
        planStep: what.planStep,
        prompt: what.prompt,
        title: what.title.slice(0, QUEUE_LIMITS.titleChars),
        mode: input.mode ?? 'approval',
        extraFolders,
        // D60: the roles chosen, else the one the card already names (a task's role, a step's role).
        roles: input.roles ?? what.roles,
        position: (runAt ?? now).getTime(),
        runAt,
        ...(input.when.kind === 'weekly'
          ? { repeatDay: WEEKDAYS.indexOf(input.when.day) + 1, repeatTime: input.when.time }
          : {}),
      },
    });
    await this.audit.record(actor, {
      action: 'queue.create',
      targetType: 'agent_run',
      targetId: row.id,
      summary:
        `Queued "${row.title}" in ${[row.folder, ...extraFolders].join(', ')} (${input.when.kind}, ${row.mode})`.slice(
          0,
          1_000,
        ),
    });
    await this.store.changed(actor.userId, row.id, actor.workspaceId);
    void this.dispatcher.kick(actor.userId);
    return this.one(actor, row.id);
  }

  private async whatToRun(
    actor: MemberActor,
    input: CreateRunInput,
  ): Promise<{
    source: CreateRunInput['source'];
    cardKey: string | null;
    planStep: number | null;
    prompt: string;
    title: string;
    roles: Role[];
  }> {
    if (input.source === 'prompt') {
      const prompt = input.prompt ?? '';
      return { source: 'prompt', cardKey: null, planStep: null, prompt, title: titleOf(prompt), roles: [] };
    }
    const card = await this.cards.full(actor, input.cardKey ?? '');
    if (input.source === 'task') {
      if (card.type !== 'task' || CLOSED_TASK.has(card.status) || card.archivedAt) {
        throw new AppException('hub.queue.card_not_runnable');
      }
      return {
        source: 'task',
        cardKey: card.key,
        planStep: null,
        prompt: runPrompt({ source: 'task', cardKey: card.key }),
        title: card.title,
        roles: card.ownerRole ? [card.ownerRole as Role] : [],
      };
    }
    if (card.type !== 'plan' || card.archivedAt) throw new AppException('hub.queue.card_not_runnable');
    const steps =
      (card.detail as { steps?: { title: string; taskKey?: string; role?: Role }[] } | null)?.steps ?? [];
    const step = steps[input.planStep ?? -1];
    if (!step) throw new AppException('hub.queue.plan_step_missing');
    if (step.taskKey) {
      // The step became a task: run that task, so its report and D52 apply.
      return this.whatToRun(actor, { ...input, source: 'task', cardKey: step.taskKey });
    }
    return {
      source: 'plan_step',
      cardKey: card.key,
      planStep: input.planStep ?? 0,
      prompt: runPrompt({
        source: 'plan_step',
        cardKey: card.key,
        planStep: input.planStep ?? 0,
        stepTitle: step.title,
      }),
      title: step.title,
      roles: step.role ? [step.role] : [],
    };
  }

  // ── Changing a run ────────────────────────────────────────────────────────────────────────────

  /** A run not started waits until resumed. A running one stops now and waits; Resume continues it in the same chat. */
  async pause(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (run.state === 'queued') {
      if (!run.pausedAt) await this.patch(actor, run, { pausedAt: this.store.now() });
    } else if (run.state === 'running') {
      await this.patch(actor, run, { state: 'queued', pausedAt: this.store.now() });
      await this.stopChat(actor, run);
    } else {
      throw new AppException('hub.queue.wrong_state');
    }
    await this.record(actor, run, 'queue.pause', `Paused "${run.title}"`);
    return this.one(actor, id);
  }

  async resume(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (run.state !== 'queued' || !run.pausedAt) throw new AppException('hub.queue.wrong_state');
    await this.patch(actor, run, { pausedAt: null });
    await this.record(actor, run, 'queue.resume', `Resumed "${run.title}"`);
    void this.dispatcher.kick(actor.userId);
    return this.one(actor, id);
  }

  /** The mode of a run that has not started (D58). The owner's press only: no agent tool reaches this. */
  async setMode(actor: MemberActor, id: string, mode: RunMode): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (run.state !== 'queued') throw new AppException('hub.queue.wrong_state');
    if (run.mode !== mode) {
      await this.patch(actor, run, { mode });
      await this.record(actor, run, 'queue.mode', `"${run.title}" runs ${mode}`);
    }
    return this.one(actor, id);
  }

  /**
   * Run it later (D58): a pending item of an automatic run starts a new chat on its folder, in Execute and in the panel's own mode, so D41 asks the owner as usual and the bridge's window applies. It never runs by itself.
   */
  async runPending(actor: MemberActor, id: string, decisionId: string): Promise<ChatTurnStarted> {
    const run = await this.owned(actor, id);
    if (OPEN_STATES.includes(run.state)) throw new AppException('hub.queue.wrong_state');
    const item = (await this.one(actor, id)).decisions.find(
      (decision) => decision.id === decisionId && decision.kind === 'skipped',
    );
    if (!item) throw new AppException('hub.queue.run_not_found');
    const why = item.why ? `\nWhy it was needed: ${item.why}` : '';
    const started = await this.chats.startForQueue(actor, {
      device: run.deviceId,
      folder: item.folder,
      title: `${run.title}: ${item.command}`.slice(0, 200),
      prompt: `An automatic Hub run ("${run.title}") skipped this command because it needs the owner's approval:\n\n${item.command}${why}\n\nRun exactly this command in this folder now. Hub will ask the owner to approve it first. Do nothing else.`,
      ...(run.cardKey ? { card: run.cardKey } : {}),
    });
    const followups = { ...((run.followups ?? {}) as Record<string, string>), [decisionId]: started.chatId };
    await this.store.tx.agentRun.update({
      where: { id: run.id, workspaceId: actor.workspaceId },
      data: { followups },
    });
    await this.record(
      actor,
      run,
      'queue.run_pending',
      `Ran a pending item of "${run.title}": ${item.command}`,
    );
    await this.store.changed(actor.userId, run.id, actor.workspaceId);
    return started;
  }

  /**
   * docs/16 §9.2: the owner lets a run start in a folder that holds changes not committed, which the run will mix with its own. The owner's press only.
   */
  async allowDirty(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (run.state !== 'queued') throw new AppException('hub.queue.wrong_state');
    if (!run.allowDirty) {
      await this.patch(actor, run, { allowDirty: true, dirtyFiles: null });
      await this.record(
        actor,
        run,
        'queue.allow_dirty',
        `Let "${run.title}" start in ${run.folder} with changes not committed`,
      );
    }
    void this.dispatcher.kick(actor.userId);
    return this.one(actor, id);
  }

  /**
   * docs/16 §9.2: removes a run's own copy once it has ended. Its branch stays, with every commit on it. Refused while the copy holds changes not committed,
   * and while another open run, such as a plan's next step, still works in it. Every run that shared the copy shows it removed.
   */
  async removeWorktree(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (!run.worktreeFolder || run.worktreeRemovedAt) throw new AppException('hub.queue.no_worktree');
    if (OPEN_STATES.includes(run.state)) throw new AppException('hub.queue.wrong_state');
    const sharing = await this.store.tx.agentRun.count({
      where: {
        userId: actor.userId,
        worktreeFolder: run.worktreeFolder,
        worktreeRemovedAt: null,
        state: { in: OPEN_STATES },
        id: { not: run.id },
      },
    });
    if (sharing > 0) throw new AppException('hub.queue.wrong_state');
    if (!this.hub.isOnline(run.deviceId)) throw new AppException('hub.devices.offline');
    if (!this.hub.supports(run.deviceId, 'worktree.remove')) {
      throw new AppException('hub.queue.worktree_failed', {
        params: { reason: 'this device runs an older bridge. Reconnect it from Settings › Devices.' },
      });
    }
    try {
      await this.hub.request(
        run.deviceId,
        'worktree.remove',
        { folder: run.worktreeFolder },
        { timeoutMs: WORKTREE_REMOVE_TIMEOUT_MS },
      );
    } catch (error) {
      const details = (error as { details?: { reason?: string; message?: string } }).details;
      if (details?.reason === 'worktree_dirty') {
        throw new AppException('hub.queue.worktree_dirty', { params: { folder: run.worktreeFolder } });
      }
      if (!details) throw error;
      throw new AppException('hub.queue.worktree_failed', {
        params: { reason: (details.message ?? details.reason ?? 'unknown').slice(0, 300) },
      });
    }
    await this.store.tx.agentRun.updateMany({
      where: { userId: actor.userId, worktreeFolder: run.worktreeFolder, worktreeRemovedAt: null },
      data: { worktreeRemovedAt: this.store.now() },
    });
    await this.record(
      actor,
      run,
      'queue.worktree_removed',
      `Removed the copy ${run.worktreeFolder} of "${run.title}"; its branch ${run.worktreeBranch ?? ''} stays`,
    );
    await this.store.changed(actor.userId, run.id, actor.workspaceId);
    return this.one(actor, id);
  }

  /** Cancel ends a weekly repeat with this run. A running one is stopped first, as Stop in the panel does. */
  async cancel(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const run = await this.owned(actor, id);
    if (!OPEN_STATES.includes(run.state)) throw new AppException('hub.queue.wrong_state');
    await this.patch(actor, run, { state: 'cancelled', endedAt: this.store.now() });
    if (run.state === 'running') await this.stopChat(actor, run);
    await this.record(actor, run, 'queue.cancel', `Cancelled "${run.title}"`);
    void this.dispatcher.kick(actor.userId);
    return this.one(actor, id);
  }

  /** The owner's order for the runs that have not started. */
  async reorder(actor: MemberActor, input: ReorderRunsInput): Promise<QueueDto> {
    const current = await this.store.tx.agentRun.findMany({
      where: { workspaceId: actor.workspaceId, userId: actor.userId, state: 'queued', id: { in: input.ids } },
      select: { id: true, position: true },
    });
    const positions = reorderPositions(input.ids, current);
    for (const [runId, position] of positions) {
      await this.store.tx.agentRun.update({
        where: { id: runId, workspaceId: actor.workspaceId },
        data: { position },
      });
    }
    await this.audit.record(actor, {
      action: 'queue.reorder',
      targetType: 'agent_queue',
      targetId: actor.userId,
      summary: `Reordered ${positions.size} queued runs`,
    });
    await this.store.changed(actor.userId, null, actor.workspaceId);
    void this.dispatcher.kick(actor.userId);
    return this.queue(actor);
  }

  // ── The queue as a whole ──────────────────────────────────────────────────────────────────────

  /** Pause all holds every run that has not started; running ones finish. Resume also lifts a usage-limit pause, which is the owner's call. */
  async pauseAll(actor: MemberActor, paused: boolean): Promise<QueueStateDto> {
    const now = this.store.now();
    const data = paused
      ? { pausedAt: now, pausedReason: 'owner', resumesAt: null }
      : { pausedAt: null, pausedReason: null, resumesAt: null };
    await this.store.tx.agentQueueSettings.upsert({
      where: { userId: actor.userId },
      create: { userId: actor.userId, ...data },
      update: data,
    });
    await this.audit.record(actor, {
      action: paused ? 'queue.pause_all' : 'queue.resume_all',
      targetType: 'agent_queue',
      targetId: actor.userId,
      summary: paused ? 'Paused the queue' : 'Resumed the queue',
    });
    await this.store.changed(actor.userId, null);
    if (!paused) void this.dispatcher.kick(actor.userId);
    return this.state(actor);
  }

  async updateSettings(actor: MemberActor, input: QueueSettingsInput): Promise<QueueStateDto> {
    if (input.timezone && !isTimezone(input.timezone)) throw new AppException('hub.queue.timezone_invalid');
    const data = {
      ...(input.maxConcurrent === undefined ? {} : { maxConcurrent: input.maxConcurrent }),
      ...(input.perDay === undefined ? {} : { perDay: input.perDay }),
      ...(input.quietHours === undefined
        ? {}
        : { quietFrom: input.quietHours?.from ?? null, quietTo: input.quietHours?.to ?? null }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.isolation === undefined ? {} : { isolation: input.isolation }),
    };
    await this.store.tx.agentQueueSettings.upsert({
      where: { userId: actor.userId },
      create: { userId: actor.userId, ...data },
      update: data,
    });
    await this.audit.record(actor, {
      action: 'queue.settings',
      targetType: 'agent_queue',
      targetId: actor.userId,
      summary: `Changed the queue limits: ${Object.keys(data).join(', ')}`.slice(0, 1_000),
    });
    await this.store.changed(actor.userId, null);
    void this.dispatcher.kick(actor.userId);
    return this.state(actor);
  }

  // ── Parts ─────────────────────────────────────────────────────────────────────────────────────

  private async one(actor: MemberActor, id: string): Promise<AgentRunDto> {
    const row = await this.owned(actor, id);
    const gate = await this.store.gate(actor.userId);
    return (await this.store.toDtos([row], gate))[0]!;
  }

  private async owned(actor: MemberActor, id: string): Promise<RunRow> {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.queue.run_not_found');
    const row = await this.store.tx.agentRun.findFirst({
      where: { id, workspaceId: actor.workspaceId, userId: actor.userId },
    });
    if (!row) throw new AppException('hub.queue.run_not_found');
    return row;
  }

  private async patch(actor: MemberActor, run: RunRow, data: Record<string, unknown>): Promise<void> {
    const moved = await this.store.tx.agentRun.updateMany({
      where: { id: run.id, workspaceId: actor.workspaceId, state: run.state },
      data,
    });
    if (moved.count === 0) throw new AppException('hub.queue.wrong_state');
    await this.store.changed(actor.userId, run.id, actor.workspaceId);
  }

  private async stopChat(actor: MemberActor, run: RunRow): Promise<void> {
    if (!run.chatId) return;
    await this.chats.stop(actor, run.chatId).catch(() => undefined);
  }

  private async record(actor: MemberActor, run: RunRow, action: string, summary: string): Promise<void> {
    await this.audit.record(actor, {
      action,
      targetType: 'agent_run',
      targetId: run.id,
      summary: summary.slice(0, 1_000),
    });
  }
}
