/**
 * @file Moves the project's lab to a new folder (docs/16 §6), for `pnpm lab:repoint`.
 * @description Only two things hold where the lab was: the source's `config.path`, and `redesign_details.lab_url` from when the lab had its own
 * address. A card's key, `externalKey`, attachments and cursor are relative to the lab root, so they stay as they are, and no card event is written.
 * Running it again changes nothing.
 */
import { resolve } from 'node:path';

import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { runUnscoped } from '@/infra/prisma/workspace-scope';

import { LAB_BASE } from './lab-root';

export interface RepointResult {
  /** The sources that pointed elsewhere, with the path each had. */
  readonly sources: readonly { readonly id: string; readonly name: string; readonly from: string }[];
  readonly labUrls: number;
}

@Injectable()
export class LabRepointService {
  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  async repoint(root: string): Promise<RepointResult> {
    const path = resolve(root).split('\\').join('/');
    return this.txHost.withTransaction(async () => {
      const rows = await runUnscoped('Every project may have a lab', async () =>
        this.txHost.tx.source.findMany({
          where: { kind: 'local_path' },
          select: { id: true, name: true, workspaceId: true, config: true },
        }),
      );
      const moved: { id: string; name: string; from: string }[] = [];
      for (const row of rows) {
        const config = row.config as { purpose?: string; path?: string };
        if (config.purpose !== 'lab' || config.path === path) continue;
        await this.txHost.tx.source.update({
          where: { id: row.id, workspaceId: row.workspaceId },
          data: { config: { ...config, path } },
        });
        moved.push({ id: row.id, name: row.name, from: config.path ?? '' });
      }
      const prefix = `${LAB_BASE}/#/`;
      const labUrls = await this.txHost.tx.$executeRaw`
        UPDATE redesign_details SET lab_url = ${prefix}::text || lab_path
        WHERE lab_url IS DISTINCT FROM ${prefix}::text || lab_path`;
      return { sources: moved, labUrls };
    });
  }
}
