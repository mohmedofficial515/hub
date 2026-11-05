/**
 * @file Onboarding progress (docs/04 §3.23): the reading path of each role the member holds.
 * @description `action` items finish themselves when the thing has happened: the team pack counts as
 * installed once one of the member's API tokens has been used.
 */
import type { MemberActor, OnboardingGroup, OnboardingItem, Role } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

import { ProjectGate } from './project-gate';
import { SettingsService } from './settings.service';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly settings: SettingsService,
    private readonly gate: ProjectGate,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(actor: MemberActor): Promise<OnboardingGroup[]> {
    const paths = await this.settings.value(actor.workspaceId, 'onboarding.paths');
    const ticks = await this.txHost.tx.onboardingProgress.findMany({
      where: { workspaceId: actor.workspaceId, userId: actor.userId },
    });
    const done = new Map(ticks.map((tick) => [tick.itemId, tick.doneAt.toISOString()]));
    const usedToken = await this.firstTokenUse(actor.userId);
    return actor.roles.map((role: Role) => ({
      role,
      items: (paths[role] ?? []).map((item: OnboardingItem) => {
        const doneAt = done.get(item.id) ?? (item.kind === 'action' ? usedToken : null);
        return { ...item, done: doneAt !== null, doneAt };
      }),
    }));
  }

  async tick(actor: MemberActor, itemId: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    await this.assertItemExists(actor, itemId);
    const key = { workspaceId: actor.workspaceId, userId: actor.userId, itemId };
    await this.txHost.tx.onboardingProgress.upsert({
      where: { workspaceId_userId_itemId: key },
      create: { ...key, doneAt: this.clock.now() },
      update: {},
    });
  }

  async untick(actor: MemberActor, itemId: string): Promise<void> {
    await this.gate.assertOpen(actor.workspaceId);
    await this.txHost.tx.onboardingProgress.deleteMany({
      where: { workspaceId: actor.workspaceId, userId: actor.userId, itemId },
    });
  }

  private async assertItemExists(actor: MemberActor, itemId: string): Promise<void> {
    const paths = await this.settings.value(actor.workspaceId, 'onboarding.paths');
    const known = actor.roles.some((role) => (paths[role] ?? []).some((item) => item.id === itemId));
    if (!known) throw new AppException('hub.common.not_found');
  }

  private async firstTokenUse(userId: string): Promise<string | null> {
    const token = await this.txHost.tx.apiToken.findFirst({
      where: { userId, lastUsedAt: { not: null } },
      orderBy: { lastUsedAt: 'asc' },
      select: { lastUsedAt: true },
    });
    return token?.lastUsedAt?.toISOString() ?? null;
  }
}
