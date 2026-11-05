/**
 * @file First owner and the two first-release projects (docs/15 §9).
 * @description Idempotent: running it again adds what is missing and never changes an existing password.
 * `goteav` is filled by the importer (H0-09); this only makes sure it exists and the owner is in it.
 */
import { type Role } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import { isWeakPassword } from '../domain/password-policy';
import { PasswordHasher } from './password-hasher';

export const OWNER_ROLES: readonly Role[] = ['owner', 'pm', 'accountant'];
const TIMEZONE = 'Europe/Istanbul';
const PROJECTS = [
  { slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV' },
  { slug: 'hub', name: 'Hub', keyPrefix: 'HUB' },
] as const;

export interface OwnerSeedInput {
  readonly email: string | undefined;
  readonly password: string | undefined;
  readonly name: string | undefined;
}

export interface OwnerSeedResult {
  readonly userId: string;
  readonly createdUser: boolean;
  readonly projects: readonly string[];
}

@Injectable()
export class OwnerSeed {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly hasher: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async run(input: OwnerSeedInput): Promise<OwnerSeedResult> {
    if (!input.email) throw new Error('HUB_OWNER_EMAIL is not set');
    const email = input.email.toLowerCase();
    const known = await this.txHost.tx.user.findUnique({ where: { email }, select: { id: true } });
    const passwordHash = known ? null : await this.hashFor(input.password);
    return this.txHost.withTransaction(async () => {
      const user =
        known ??
        (await this.txHost.tx.user.create({
          data: {
            email,
            passwordHash: passwordHash as string,
            displayName: input.name ?? 'Owner',
            avatarColor: 'teal',
            createdAt: this.clock.now(),
          },
          select: { id: true },
        }));
      const projects: string[] = [];
      for (const project of PROJECTS) {
        const workspace = await this.txHost.tx.workspace.upsert({
          where: { slug: project.slug },
          create: { ...project, timezone: TIMEZONE, createdAt: this.clock.now() },
          update: {},
          select: { id: true },
        });
        await this.txHost.tx.membership.upsert({
          where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
          create: { workspaceId: workspace.id, userId: user.id, roles: [...OWNER_ROLES] },
          update: { roles: [...OWNER_ROLES], status: 'active', removedAt: null },
        });
        projects.push(project.slug);
        await this.txHost.tx.user.updateMany({
          where: { id: user.id, defaultWorkspaceId: null },
          data: { defaultWorkspaceId: workspace.id },
        });
      }
      return { userId: user.id, createdUser: !known, projects };
    });
  }

  private async hashFor(password: string | undefined): Promise<string> {
    if (!password || isWeakPassword(password)) {
      throw new Error('HUB_OWNER_PASSWORD is missing or too weak; run pnpm setup:env');
    }
    return this.hasher.hash(password);
  }
}
