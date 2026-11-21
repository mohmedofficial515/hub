/**
 * @file Project settings (docs/04 §3.6) over the catalogue in `@hub/contracts/settings.ts`.
 * @description `value(workspaceId, key)` is the typed read for other modules, such as the deadline engine and
 * the digests. A stored value that no longer fits the schema falls back to the default.
 */
import {
  isSettingKey,
  type MemberActor,
  SETTING_KEYS,
  settingDefault,
  type SettingKey,
  type SettingRow,
  SETTINGS,
  type SettingValue,
} from '@hub/contracts';
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { Prisma } from '@/generated/prisma/client';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { PublishesProjectChange, RealtimePublisher } from '@/infra/redis/redis.module';
import { AuditService } from '@/modules/audit';
import { AppException } from '@/shared/errors';
import { assertNoSecrets } from '@/shared/security/secret-filter';

import { ProjectGate } from './project-gate';

function assertKey(key: string): asserts key is SettingKey {
  if (!isSettingKey(key)) throw new AppException('hub.workspaces.setting_unknown');
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly audit: AuditService,
    private readonly realtime: RealtimePublisher,
    private readonly gate: ProjectGate,
  ) {}

  async value<K extends SettingKey>(workspaceId: string, key: K): Promise<SettingValue<K>> {
    const row = await this.txHost.tx.workspaceSetting.findUnique({
      where: { workspaceId_key: { workspaceId, key } },
      select: { value: true },
    });
    if (!row) return settingDefault(key);
    const parsed = SETTINGS[key].schema.safeParse(row.value);
    return parsed.success ? (parsed.data as SettingValue<K>) : settingDefault(key);
  }

  async list(workspaceId: string): Promise<SettingRow[]> {
    const rows = await this.txHost.tx.workspaceSetting.findMany({ where: { workspaceId } });
    const stored = new Map(rows.map((row) => [row.key, row]));
    return SETTING_KEYS.map((key) => {
      const row = stored.get(key);
      return {
        key,
        value: row ? row.value : settingDefault(key),
        default: settingDefault(key),
        isDefault: !row,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedById ?? null,
      };
    });
  }

  @PublishesProjectChange('settings')
  async put(actor: MemberActor, key: string, value: unknown): Promise<SettingRow> {
    assertKey(key);
    await this.gate.assertOpen(actor.workspaceId);
    const parsed = SETTINGS[key].schema.safeParse(value);
    if (!parsed.success) {
      throw new AppException('hub.workspaces.setting_invalid', {
        details: {
          key,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        },
      });
    }
    assertNoSecrets({ value: parsed.data });
    const json = parsed.data as Prisma.InputJsonValue;
    return this.txHost.withTransaction(async () => {
      const row = await this.txHost.tx.workspaceSetting.upsert({
        where: { workspaceId_key: { workspaceId: actor.workspaceId, key } },
        create: { workspaceId: actor.workspaceId, key, value: json, updatedById: actor.userId },
        update: { value: json, updatedById: actor.userId },
      });
      await this.audit.record(actor, {
        action: 'settings.update',
        targetType: 'setting',
        targetId: key,
        summary: `Changed ${key}`,
      });
      return {
        key,
        value: row.value,
        default: settingDefault(key),
        isDefault: false,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedById,
      };
    });
  }

  /** Back to the catalogue's default. */
  @PublishesProjectChange('settings')
  async reset(actor: MemberActor, key: string): Promise<SettingRow> {
    assertKey(key);
    await this.gate.assertOpen(actor.workspaceId);
    return this.txHost.withTransaction(async () => {
      await this.txHost.tx.workspaceSetting.deleteMany({ where: { workspaceId: actor.workspaceId, key } });
      await this.audit.record(actor, {
        action: 'settings.reset',
        targetType: 'setting',
        targetId: key,
        summary: `Reset ${key} to its default`,
      });
      return {
        key,
        value: settingDefault(key),
        default: settingDefault(key),
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      };
    });
  }
}
