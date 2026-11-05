/**
 * @file A member's devices: list, revoke, the health panel, and the Link button (docs/16 §5, D44).
 * @description The API never touches a device's files. Health, fixes and linking are actions the bridge on that device performs. Revoking commits
 * first and then cuts the socket, so a device can never reconnect in between. Linking registers the folder on the project before asking, because the
 * bridge refuses a folder that is not on its allowlist, and takes it off again if the folder does not exist there.
 */
import {
  BRIDGE_CLOSE,
  type DeviceDto,
  type HealthCheck,
  healthCheckSchema,
  type HealthFix,
  LINK_OUTCOMES,
  type LinkResult,
  type MemberActor,
  type Principal,
} from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { z } from 'zod';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AuditService } from '@/modules/audit';
import { ApiTokenService } from '@/modules/identity';
import { ProjectsService } from '@/modules/workspaces';
import { AppException } from '@/shared/errors';

import { BridgeHub } from './bridge-hub';

const HEALTH_TIMEOUT_MS = 150_000;
const FIX_TIMEOUT_MS = 180_000;
const LINK_TIMEOUT_MS = 90_000;

const healthList = z.array(healthCheckSchema);
const bridgeLinkAnswer = z.object({ outcome: z.enum(LINK_OUTCOMES), backup: z.string().nullable() });

interface DeviceRow {
  id: string;
  name: string;
  platform: string;
  bridgeVersion: string | null;
  claudeVersion: string | null;
  vscodeFound: boolean | null;
  health: unknown;
  healthAt: Date | null;
  lastSeenAt: Date | null;
  pairedAt: Date;
}

const sameFolder = (a: string, b: string) => {
  const normal = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  return normal(a) === normal(b);
};

@Injectable()
export class DevicesService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hub: BridgeHub,
    private readonly tokens: ApiTokenService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async list(userId: string): Promise<DeviceDto[]> {
    const rows = await this.txHost.tx.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { pairedAt: 'desc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  /** Asks the device for its checks when it is online. Offline, the last report stands, with its time. */
  async health(principal: Principal, id: string): Promise<DeviceDto> {
    const device = await this.owned(principal.userId, id);
    if (!this.hub.isOnline(id)) return this.toDto(device);
    const checks = healthList.parse(
      await this.hub.request(id, 'health.check', {}, { timeoutMs: HEALTH_TIMEOUT_MS }),
    );
    return this.toDto(await this.storeHealth(id, checks));
  }

  async fix(principal: Principal, id: string, fix: HealthFix): Promise<DeviceDto> {
    const device = await this.owned(principal.userId, id);
    const checks = healthList.parse(
      await this.hub.request(id, 'health.fix', { fix }, { timeoutMs: FIX_TIMEOUT_MS }),
    );
    await this.audit.recordAccount(principal, {
      action: 'devices.fix',
      targetType: 'device',
      targetId: id,
      summary: `Fixed ${fix} on ${device.name}`,
    });
    return this.toDto(await this.storeHealth(id, checks));
  }

  async revoke(principal: Principal, id: string): Promise<void> {
    const device = await this.owned(principal.userId, id);
    await this.txHost.withTransaction(async () => {
      await this.txHost.tx.device.update({ where: { id }, data: { revokedAt: this.clock.now() } });
      await this.tokens.revokeForDevice(id);
      await this.audit.recordAccount(principal, {
        action: 'devices.revoke',
        targetType: 'device',
        targetId: id,
        summary: `Revoked ${device.name}`,
      });
    });
    this.hub.disconnect(id, BRIDGE_CLOSE.revoked, 'revoked');
  }

  /** The Link button. It is not on MCP: D44 allows the trust write only on the owner's own press. */
  async link(actor: MemberActor, id: string, folder: string): Promise<LinkResult> {
    const device = await this.owned(actor.userId, id);
    if (!this.hub.isOnline(id)) throw new AppException('hub.devices.offline');
    const project = await this.projects.get(actor);
    const registered = !project.repoPaths.some((path) => sameFolder(path, folder));
    if (registered) {
      await this.projects.update(actor, { repoPaths: [...project.repoPaths, folder] });
    }
    let answer: z.infer<typeof bridgeLinkAnswer>;
    try {
      answer = bridgeLinkAnswer.parse(
        await this.hub.request(
          id,
          'folder.link',
          { folder, project: project.slug },
          { timeoutMs: LINK_TIMEOUT_MS },
        ),
      );
    } catch (error) {
      // The folder is not there, or the device could not be asked: nothing stays registered from this press.
      if (registered) await this.projects.update(actor, { repoPaths: project.repoPaths });
      throw error;
    }
    await this.audit.record(actor, {
      action: 'devices.link',
      targetType: 'device',
      targetId: id,
      summary: `Linked a folder on ${device.name}: ${answer.outcome}`,
    });
    return { outcome: answer.outcome, folder, project: project.slug, backup: answer.backup, registered };
  }

  private async owned(userId: string, id: string): Promise<DeviceRow> {
    if (!z.uuid().safeParse(id).success) throw new AppException('hub.devices.not_found');
    const row = await this.txHost.tx.device.findFirst({ where: { id, userId, revokedAt: null } });
    if (!row) throw new AppException('hub.devices.not_found');
    return row;
  }

  private storeHealth(id: string, checks: HealthCheck[]): Promise<DeviceRow> {
    return this.txHost.tx.device.update({
      where: { id },
      data: { health: checks, healthAt: this.clock.now() },
    });
  }

  private toDto(row: DeviceRow): DeviceDto {
    const health = healthList.safeParse(row.health);
    return {
      id: row.id,
      name: row.name,
      platform: row.platform,
      online: this.hub.isOnline(row.id),
      bridgeVersion: row.bridgeVersion,
      claudeVersion: row.claudeVersion,
      vscodeFound: row.vscodeFound,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      pairedAt: row.pairedAt.toISOString(),
      health: health.success ? health.data : [],
      healthAt: row.healthAt?.toISOString() ?? null,
    };
  }
}
