/**
 * @file Membership reads with Prisma.
 */
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';

import { type MembershipLookup, MembershipRepository } from '../application/ports/membership.repository';

@Injectable()
export class PrismaMembershipRepository extends MembershipRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {
    super();
  }

  async findBySlug(userId: string, slug: string): Promise<MembershipLookup | null> {
    return this.txHost.tx.membership.findFirst({
      where: { userId, status: 'active', workspace: { slug } },
      select: { workspaceId: true, roles: true },
    });
  }

  async findDefault(userId: string): Promise<MembershipLookup | null> {
    const user = await this.txHost.tx.user.findUnique({
      where: { id: userId },
      select: { defaultWorkspaceId: true },
    });
    if (!user?.defaultWorkspaceId) return null;
    return this.txHost.tx.membership.findFirst({
      where: { userId, status: 'active', workspaceId: user.defaultWorkspaceId },
      select: { workspaceId: true, roles: true },
    });
  }
}
