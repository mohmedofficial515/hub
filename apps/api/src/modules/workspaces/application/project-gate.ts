/**
 * @file The check every project mutation shares: a closed project refuses changes (docs/04 §3).
 */
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

@Injectable()
export class ProjectGate {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  async assertOpen(workspaceId: string): Promise<void> {
    const workspace = await this.txHost.tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { status: true },
    });
    if (!workspace) throw new AppException('hub.workspaces.not_found');
    if (workspace.status === 'closed') throw new AppException('hub.workspaces.closed');
  }
}
