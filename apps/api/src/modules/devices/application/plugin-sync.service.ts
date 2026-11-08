/**
 * @file The plugin sync (docs/16 §11, D64): each paired device takes Hub's plugin, with Hub's skills, from the bridge.
 * @description Hub sends `plugin.sync` with the files and their version; the bridge writes them into its marketplace folder and has Claude Code update the plugin, which only
 * a new version does. In `auto` it runs when a device becomes ready with an older version, and on every online device after a skill changes; in `manual` only on the owner's
 * Sync now. One sync per device at a time: a change arriving during one runs once more after it. What each device took is kept on its row, so the Skills page can say which
 * device has which skill's current text. A failure is kept as its message, filtered, and never stops anything else.
 */
import {
  type PluginDevice,
  pluginSyncAnswerSchema,
  type PluginSyncMode,
  redactSecrets,
} from '@hub/contracts';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

import { BridgeHub } from './bridge-hub';
import { PluginBundleService } from './plugin-bundle.service';

/** Claude Code installs or updates the plugin, which can take a while on a slow disk. */
const SYNC_TIMEOUT_MS = 180_000;
const ERROR_CHARS = 300;

interface DeviceSyncRow {
  id: string;
  name: string;
  pluginVersion: string | null;
  pluginSkills: unknown;
  pluginSyncedAt: Date | null;
  pluginSyncError: string | null;
}

const SELECT = {
  id: true,
  name: true,
  pluginVersion: true,
  pluginSkills: true,
  pluginSyncedAt: true,
  pluginSyncError: true,
} as const;

@Injectable()
export class PluginSyncService implements OnModuleInit {
  private readonly logger = new Logger(PluginSyncService.name);
  /** The sync running on each device, and whether another was asked for meanwhile. */
  private readonly running = new Map<string, { promise: Promise<void>; again: boolean }>();

  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hub: BridgeHub,
    private readonly bundle: PluginBundleService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.hub.onReady((deviceId) => {
      if (this.mode !== 'auto') return;
      void this.syncIfBehind(deviceId);
    });
  }

  get mode(): PluginSyncMode {
    return this.config.HUB_PLUGIN_SYNC;
  }

  /** A device that connects with an older plugin than Hub's takes the current one. */
  async syncIfBehind(deviceId: string): Promise<void> {
    try {
      const row = await this.txHost.tx.device.findUnique({ where: { id: deviceId }, select: SELECT });
      if (!row || row.pluginVersion === this.bundle.current().version) return;
      await this.sync(deviceId);
    } catch (error) {
      this.logger.warn(`The plugin sync on connect did not run: ${describe(error)}`);
    }
  }

  /** After a change: every online device, without waiting. Answers how many were asked. In `manual` none are. */
  afterChange(): number {
    if (this.mode !== 'auto') return 0;
    const online = this.hub.onlineDeviceIds();
    for (const id of online) void this.sync(id);
    return online.length;
  }

  /** The owner's Sync now: every online device, waited for. Answers each device's state after it. */
  async syncNow(): Promise<PluginDevice[]> {
    await Promise.all(this.hub.onlineDeviceIds().map((id) => this.sync(id)));
    return this.devices();
  }

  /** One device, one at a time. Never throws: the outcome is on the device's row. */
  sync(deviceId: string): Promise<void> {
    const current = this.running.get(deviceId);
    if (current) {
      current.again = true;
      return current.promise;
    }
    const entry = { promise: Promise.resolve(), again: false };
    entry.promise = (async () => {
      try {
        do {
          entry.again = false;
          await this.syncOnce(deviceId);
        } while (entry.again);
      } finally {
        this.running.delete(deviceId);
      }
    })();
    this.running.set(deviceId, entry);
    return entry.promise;
  }

  /** Every paired device, with the plugin it last took. Revoked ones are gone. */
  async devices(): Promise<PluginDevice[]> {
    const version = this.bundle.current().version;
    const rows = await this.txHost.tx.device.findMany({
      where: { revokedAt: null },
      select: SELECT,
      orderBy: { pairedAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row, version));
  }

  /** Each paired device's skills as it last took them: `{ skill: hash }`, for "devices synced". */
  async deviceSkills(): Promise<
    { id: string; name: string; online: boolean; skills: Record<string, string> }[]
  > {
    const rows = await this.txHost.tx.device.findMany({
      where: { revokedAt: null },
      select: SELECT,
      orderBy: { pairedAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      online: this.hub.isOnline(row.id),
      skills: skillsOf(row.pluginSkills),
    }));
  }

  private async syncOnce(deviceId: string): Promise<void> {
    const bundle = this.bundle.current();
    try {
      const answer = pluginSyncAnswerSchema.parse(
        await this.hub.request(
          deviceId,
          'plugin.sync',
          { version: bundle.version, files: bundle.files },
          { timeoutMs: SYNC_TIMEOUT_MS },
        ),
      );
      await this.txHost.tx.device.update({
        where: { id: deviceId },
        data: {
          pluginVersion: answer.version,
          pluginSkills: bundle.skills,
          pluginSyncedAt: this.clock.now(),
          pluginSyncError: null,
        },
      });
    } catch (error) {
      const message = redactSecrets(describe(error)).slice(0, ERROR_CHARS);
      this.logger.warn(`The plugin sync failed on device ${deviceId}: ${message}`);
      await this.txHost.tx.device
        .update({ where: { id: deviceId }, data: { pluginSyncError: message } })
        .catch(() => undefined);
    }
  }

  private toDto(row: DeviceSyncRow, version: string): PluginDevice {
    return {
      id: row.id,
      name: row.name,
      online: this.hub.isOnline(row.id),
      version: row.pluginVersion,
      syncedAt: row.pluginSyncedAt?.toISOString() ?? null,
      error: row.pluginSyncError,
      current: row.pluginVersion === version,
    };
  }
}

function skillsOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/** The bridge's own words when it refused, else the error's code: what the owner reads on the Skills page. */
function describe(error: unknown): string {
  if (error instanceof AppException) {
    const message = error.details?.['message'];
    return typeof message === 'string' && message ? `${error.code}: ${message}` : error.code;
  }
  return error instanceof Error ? error.message : String(error);
}
