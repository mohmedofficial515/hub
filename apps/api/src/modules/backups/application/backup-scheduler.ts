/**
 * @file The nightly backup (docs/16 D62). It runs in the API process, as the queue dispatcher does, and catches up a missed night at boot.
 * @description Each minute it asks one question: does the latest nightly time already have its run? If not, it starts one, `scheduled`
 * when on time and `catch_up` when late, so a machine that was off for three nights makes one backup when it is back, not three.
 * A failed night is not retried by itself: the history and the inbox say so, and "Back up now" is the owner's press.
 * The timer is off in a worker, in `QUEUE_MODE=inline` (tests call `tick()`), and with `HUB_BACKUP_SCHEDULE=off`.
 */
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { AppException } from '@/shared/errors';

import { nightlySlot, triggerFor } from '../domain/backup-rules';
import { BackupsService } from './backups.service';

const TICK_MS = 60_000;
/** The first look after boot waits a little, so a starting machine is not asked for a dump in its first seconds. */
const FIRST_TICK_MS = 20_000;

@Injectable()
export class BackupScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BackupScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private ticking: Promise<unknown> | null = null;

  constructor(
    private readonly backups: BackupsService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private get active(): boolean {
    return this.config.PROCESS_ROLE !== 'worker';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.active) return;
    const cut = await this.backups.markInterrupted();
    if (cut > 0) this.logger.warn(`${cut} backup was cut off by a restart`);
    if (this.config.QUEUE_MODE === 'inline' || this.config.HUB_BACKUP_SCHEDULE === 'off') return;
    this.first = setTimeout(() => void this.tick(), FIRST_TICK_MS);
    this.first.unref();
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
    this.first = null;
    this.timer = null;
  }

  /** Starts the due night's backup and waits for it. Answers what it started, or null. One tick at a time. */
  async tick(): Promise<{ id: string; trigger: string; status: string } | null> {
    if (this.ticking) return null;
    const work = this.due().finally(() => {
      this.ticking = null;
    });
    this.ticking = work;
    return work;
  }

  private async due(): Promise<{ id: string; trigger: string; status: string } | null> {
    try {
      const settings = await this.backups.settings();
      if (!settings.enabled) return null;
      const now = this.clock.now();
      const slot = nightlySlot(now, settings.time, settings.timezone);
      if (await this.backups.hasSlot(slot)) return null;
      const done = await this.backups.runScheduled(triggerFor(now, slot), slot);
      return { id: done.id, trigger: done.trigger, status: done.status };
    } catch (error) {
      // The owner's own backup is running: the night waits for the next tick.
      if (error instanceof AppException && error.code === 'hub.backups.running') return null;
      this.logger.warn(`The nightly backup tick failed: ${String(error)}`);
      return null;
    }
  }
}
