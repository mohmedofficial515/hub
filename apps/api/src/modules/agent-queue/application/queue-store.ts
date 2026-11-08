/**
 * @file What the queue reads and shares (docs/16 §9): the owner's limits, the gate a due run passes, and a run as the page sees it.
 * @description The limits are the member's, across projects, because every run spends one subscription. Runs per day count starts in the queue's timezone. A folder is busy while any turn runs in it, from a run or from the panel.
 * The device facts (`signedOut`, `engineUnavailable`) live in this process: they come from the last start and the last engine check, and a restart forgets them, which only means one more check.
 */
import {
  type AgentRunDto,
  type ChangedFile,
  inQuietHours,
  isTimezone,
  QUEUE_DEFAULTS,
  type QueueStateDto,
  type QuietHours,
  type Role,
  type RunDecision,
  type RunSource,
  type RunState,
  startOfLocalDay,
  type TurnFailure,
  type Weekday,
  WEEKDAYS,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { RealtimePublisher } from '@/infra/redis/redis.module';
import { BridgeHub } from '@/modules/devices';

import { folderKey, holdFor, isDue, type QueueGate, runFolders, viewStateOf } from '../domain/queue-rules';
import { decisionFolder, whyOf } from '../domain/run-context';

export interface RunRow {
  id: string;
  workspaceId: string;
  userId: string;
  deviceId: string;
  folder: string;
  extraFolders: string[];
  mode: string;
  roles: string[];
  followups: unknown;
  source: string;
  cardKey: string | null;
  planStep: number | null;
  prompt: string;
  title: string;
  state: string;
  position: number;
  runAt: Date | null;
  repeatDay: number | null;
  repeatTime: string | null;
  pausedAt: Date | null;
  chatId: string | null;
  messageId: string | null;
  failure: string | null;
  summary: string | null;
  changedFiles: unknown;
  moved: boolean | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface QueueLimits {
  readonly maxConcurrent: number;
  readonly perDay: number;
  readonly quietHours: QuietHours | null;
  readonly timezone: string;
  readonly timezoneSource: 'setting' | 'machine';
  readonly pausedReason: 'owner' | 'usage_limit' | null;
  readonly resumesAt: Date | null;
}

export const machineTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const iso = (date: Date | null | undefined): string | null => date?.toISOString() ?? null;

@Injectable()
export class AgentQueueStore {
  /** Devices whose last turn ended signed out, with when that was last checked. */
  readonly signedOut = new Map<string, number>();
  /** Devices whose engine cannot run: missing, or older than the minimum. */
  readonly engineUnavailable = new Set<string>();

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hub: BridgeHub,
    private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get tx() {
    return this.txHost.tx;
  }

  now(): Date {
    return this.clock.now();
  }

  async limits(userId: string): Promise<QueueLimits> {
    const row = await this.tx.agentQueueSettings.findUnique({ where: { userId } });
    const setting = row?.timezone && isTimezone(row.timezone) ? row.timezone : null;
    return {
      maxConcurrent: row?.maxConcurrent ?? QUEUE_DEFAULTS.maxConcurrent,
      perDay: row?.perDay ?? QUEUE_DEFAULTS.perDay,
      quietHours: row?.quietFrom && row.quietTo ? { from: row.quietFrom, to: row.quietTo } : null,
      timezone: setting ?? machineTimezone(),
      timezoneSource: setting ? 'setting' : 'machine',
      pausedReason: row?.pausedAt ? (row.pausedReason === 'usage_limit' ? 'usage_limit' : 'owner') : null,
      resumesAt: row?.pausedAt ? (row.resumesAt ?? null) : null,
    };
  }

  /** Folders with a turn running, for one member, across projects: runs that are starting, and every running chat turn. */
  async busyFolders(userId: string): Promise<Set<string>> {
    const turns = await this.tx.$queryRaw<{ device_id: string; folder: string }[]>`
      SELECT c.device_id::text AS device_id, c.folder
      FROM chat_messages m JOIN chats c ON c.id = m.chat_id
      WHERE m.status = 'running' AND c.user_id = ${userId}::uuid`;
    const runs = await this.tx.agentRun.findMany({
      where: { userId, state: 'running' },
      select: { deviceId: true, folder: true, extraFolders: true },
    });
    // D59: a running run holds every one of its folders.
    return new Set([
      ...turns.map((turn) => folderKey(turn.device_id, turn.folder)),
      ...runs.flatMap((run) => runFolders(run).map((folder) => folderKey(run.deviceId, folder))),
    ]);
  }

  async gate(userId: string, limits?: QueueLimits): Promise<QueueGate> {
    const known = limits ?? (await this.limits(userId));
    const now = this.now();
    const [usedToday, running, busyFolders] = await Promise.all([
      this.tx.agentRun.count({
        where: { userId, startedAt: { gte: startOfLocalDay(now, known.timezone) } },
      }),
      this.tx.agentRun.count({ where: { userId, state: 'running' } }),
      this.busyFolders(userId),
    ]);
    return {
      now,
      timezone: known.timezone,
      pausedReason: known.pausedReason,
      quietHours: known.quietHours,
      usedToday,
      perDay: known.perDay,
      running,
      maxConcurrent: known.maxConcurrent,
      busyFolders,
      online: (deviceId) => this.hub.isOnline(deviceId),
      signedOut: (deviceId) => this.signedOut.has(deviceId),
      engineUnavailable: (deviceId) => this.engineUnavailable.has(deviceId),
    };
  }

  stateOf(limits: QueueLimits, gate: QueueGate): QueueStateDto {
    return {
      paused: limits.pausedReason !== null,
      pausedReason: limits.pausedReason,
      resumesAt: iso(limits.resumesAt),
      maxConcurrent: limits.maxConcurrent,
      perDay: limits.perDay,
      usedToday: gate.usedToday,
      running: gate.running,
      quietHours: limits.quietHours,
      inQuietHours: inQuietHours(gate.now, limits.quietHours, limits.timezone),
      timezone: limits.timezone,
      timezoneSource: limits.timezoneSource,
      machineTimezone: machineTimezone(),
    };
  }

  /** Runs as the page sees them, with their device's name, what each waits on, and why a due one is held. */
  async toDtos(rows: readonly RunRow[], gate: QueueGate): Promise<AgentRunDto[]> {
    const deviceIds = [...new Set(rows.map((row) => row.deviceId))];
    const chatIds = rows.filter((row) => row.state === 'running' && row.chatId).map((row) => row.chatId!);
    const autoChats = rows.filter((row) => row.mode === 'automatic' && row.chatId).map((row) => row.chatId!);
    const [devices, waits, autos] = await Promise.all([
      deviceIds.length === 0
        ? []
        : this.tx.device.findMany({ where: { id: { in: deviceIds } }, select: { id: true, name: true } }),
      chatIds.length === 0
        ? []
        : this.tx.$queryRaw<
            { id: string; chat_id: string; kind: string; command: string; category: string }[]
          >`
            SELECT id::text, chat_id::text, kind, command, category FROM chat_approvals
            WHERE status = 'pending' AND chat_id = ANY(${chatIds}::uuid[])
            ORDER BY created_at ASC`,
      autoChats.length === 0
        ? []
        : this.tx.chatApproval.findMany({
            where: {
              workspaceId: { in: [...new Set(rows.map((row) => row.workspaceId))] },
              chatId: { in: autoChats },
              status: { in: ['skipped', 'auto_answered'] },
            },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              chatId: true,
              kind: true,
              command: true,
              category: true,
              input: true,
              questions: true,
              answers: true,
              createdAt: true,
            },
          }),
    ]);
    const decided = new Map<string, (typeof autos)[number][]>();
    for (const row of autos) decided.set(row.chatId, [...(decided.get(row.chatId) ?? []), row]);
    const names = new Map(devices.map((device) => [device.id, device.name]));
    const waiting = new Map<string, (typeof waits)[number]>();
    for (const wait of waits) if (!waiting.has(wait.chat_id)) waiting.set(wait.chat_id, wait);
    return rows.map((row) => {
      const wait = row.chatId ? waiting.get(row.chatId) : undefined;
      const followups = (row.followups ?? {}) as Record<string, string>;
      const decisions: RunDecision[] = (row.chatId ? (decided.get(row.chatId) ?? []) : []).map((item) => {
        const questions = (item.questions ?? []) as { text: string }[];
        const answers = (item.answers ?? {}) as Record<string, string>;
        return {
          id: item.id,
          kind: item.kind === 'question' ? 'answered' : 'skipped',
          command: item.command,
          category: item.category as RunDecision['category'],
          folder: decisionFolder(item.command, row.folder, row.extraFolders),
          why: whyOf(item.input),
          answers: questions.map((question) => ({
            question: question.text,
            answer: answers[question.text] ?? '',
          })),
          at: item.createdAt.toISOString(),
          followChatId: followups[item.id] ?? null,
        };
      });
      return {
        id: row.id,
        source: row.source as RunSource,
        title: row.title,
        cardKey: row.cardKey,
        planStep: row.planStep,
        prompt: row.prompt,
        deviceId: row.deviceId,
        deviceName: names.get(row.deviceId) ?? '',
        folder: row.folder,
        extraFolders: row.extraFolders,
        mode: row.mode === 'automatic' ? 'automatic' : 'approval',
        roles: row.roles as Role[],
        decisions,
        state: viewStateOf(row, gate.now, Boolean(wait)),
        stored: row.state as RunState,
        hold: isDue(row, gate.now) ? holdFor(row, gate) : null,
        runAt: iso(row.runAt),
        repeat:
          row.repeatDay && row.repeatTime
            ? { day: WEEKDAYS[row.repeatDay - 1] as Weekday, time: row.repeatTime }
            : null,
        paused: row.pausedAt !== null,
        position: row.position,
        chatId: row.chatId,
        messageId: row.messageId,
        waitingOn: wait
          ? {
              id: wait.id,
              kind: wait.kind === 'question' ? 'question' : 'approval',
              command: wait.command,
              category: wait.category,
            }
          : null,
        failure: (row.failure as TurnFailure | null) ?? null,
        summary: row.summary,
        changedFiles: (row.changedFiles as ChangedFile[]) ?? [],
        moved: row.moved,
        createdAt: row.createdAt.toISOString(),
        startedAt: iso(row.startedAt),
        endedAt: iso(row.endedAt),
      };
    });
  }

  /** Every project the member is in hears a queue-wide change; a run's own change goes to its project. */
  async changed(userId: string, runId: string | null, workspaceId?: string): Promise<void> {
    const workspaces = workspaceId
      ? [workspaceId]
      : (
          await this.tx.membership.findMany({
            where: { userId, status: 'active' },
            select: { workspaceId: true },
          })
        ).map((row) => row.workspaceId);
    for (const id of workspaces) {
      await this.realtime.publishEnvelope(id, {
        event: 'queue.changed',
        data: { runId },
        audience: { userIds: [userId] },
      });
    }
  }
}
