/**
 * @file Notification outbox: written inside the mutation's transaction, drained by the worker.
 * @description `NotificationOutbox.write` creates the in-app inbox row per recipient and one job per channel
 * the member turned on. `OutboxProcessor` drains pending jobs through a registered `ChannelSender`. Web push,
 * Telegram and email are deferred (docs/15 §3), so with no sender a job ends `skipped`, honestly. H3-01 owns
 * routing rules and templates on top of this; H3-02 to H3-04 only call `registerSender`.
 */
import type { NotificationKind } from '@hub/contracts';
import { Inject, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { I18nService } from 'nestjs-i18n';

import { CLOCK, type Clock } from '../clock/clock';
import { type PrismaTransactionalAdapter } from '../prisma/prisma.module';
import { BaseProcessor, QUEUES, QueueService, type SimpleJob } from '../queue/queue.service';

export interface OutboxEntry {
  readonly workspaceId: string;
  readonly cardId?: string;
  readonly kind: NotificationKind;
  readonly recipients: readonly { readonly userId: string; readonly locale: string }[];
  /** A key under `notifications` in src/i18n. */
  readonly i18nKey: string;
  readonly params: Readonly<Record<string, string | number>>;
  readonly data?: Readonly<Record<string, unknown>>;
}

@Injectable()
export class NotificationOutbox {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly i18n: I18nService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Call inside the mutation's transaction. Returns the number of notifications written. */
  async write(entry: OutboxEntry): Promise<number> {
    return (await this.writeEach(entry)).length;
  }

  /** As `write`, answering each row, so the caller can tell its recipient after commit. */
  async writeEach(entry: OutboxEntry): Promise<{ id: string; userId: string }[]> {
    const written: { id: string; userId: string }[] = [];
    const tx = this.txHost.tx;
    const now = this.clock.now();
    const data = JSON.parse(
      JSON.stringify({ ...entry.data, i18n: { key: entry.i18nKey, params: entry.params } }),
    ) as object;
    for (const recipient of entry.recipients) {
      const channels = await tx.channelPreference.findMany({
        where: { userId: recipient.userId, workspaceId: entry.workspaceId, mode: { not: 'off' } },
        select: { channel: true, kinds: true },
      });
      const row = await tx.notification.create({
        data: {
          workspaceId: entry.workspaceId,
          userId: recipient.userId,
          kind: entry.kind,
          cardId: entry.cardId ?? null,
          groupKey: entry.cardId ? `card:${entry.cardId}` : null,
          title: this.i18n.t(`notifications.${entry.i18nKey}`, {
            lang: recipient.locale,
            args: entry.params,
          }),
          data,
          createdAt: now,
          jobs: {
            create: channels
              .filter((channel) => channel.kinds.length === 0 || channel.kinds.includes(entry.kind))
              .map((channel) => ({ channel: channel.channel, nextAttemptAt: now })),
          },
        },
        select: { id: true },
      });
      written.push({ id: row.id, userId: recipient.userId });
    }
    return written;
  }
}

/** One delivery channel. Throw to retry with back-off. */
export interface ChannelSender {
  send(notification: {
    id: string;
    userId: string;
    title: string;
    body: string | null;
    data: unknown;
  }): Promise<void>;
}

const MAX_ATTEMPTS = 5;
const BATCH = 50;

@Injectable()
export class OutboxProcessor extends BaseProcessor implements OnModuleInit {
  protected readonly queueName = QUEUES.outbox;
  private readonly logger = new Logger(OutboxProcessor.name);
  private readonly senders = new Map<string, ChannelSender>();

  constructor(
    queues: QueueService,
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    super(queues);
  }

  override onModuleInit(): void {
    super.onModuleInit();
    this.queues.schedule(this.queueName, 'outbox-drain', 'drain', 5_000);
  }

  registerSender(channel: string, sender: ChannelSender): void {
    this.senders.set(channel, sender);
  }

  async process(_job: SimpleJob): Promise<void> {
    await this.drainOnce();
  }

  /** Takes due jobs with SKIP LOCKED, so several workers never send one twice. Returns how many it handled. */
  async drainOnce(): Promise<number> {
    return this.txHost.withTransaction(async () => {
      const tx = this.txHost.tx;
      const now = this.clock.now();
      const due = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM notification_jobs
        WHERE status = 'pending' AND next_attempt_at <= ${now}
        ORDER BY next_attempt_at
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED`;
      for (const { id } of due) await this.handle(id, now);
      return due.length;
    });
  }

  private async handle(id: string, now: Date): Promise<void> {
    const tx = this.txHost.tx;
    const job = await tx.notificationJob.findUniqueOrThrow({
      where: { id },
      include: { notification: true },
    });
    const sender = this.senders.get(job.channel);
    if (!sender) {
      await tx.notificationJob.update({
        where: { id },
        data: { status: 'skipped', error: 'channel not connected' },
      });
      return;
    }
    try {
      await sender.send(job.notification);
      await tx.notificationJob.update({ where: { id }, data: { status: 'sent', sentAt: now } });
    } catch (error) {
      const attempts = job.attempts + 1;
      this.logger.warn(`Outbox ${job.channel} attempt ${attempts} failed: ${String(error)}`);
      await tx.notificationJob.update({
        where: { id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          nextAttemptAt: new Date(now.getTime() + 30_000 * 2 ** attempts),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

@Module({
  providers: [NotificationOutbox, OutboxProcessor],
  exports: [NotificationOutbox, OutboxProcessor],
})
export class OutboxModule {}
