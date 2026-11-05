/**
 * @file `pnpm seed:sources`: the local folders of docs/15 §3 as sources of the seeded projects. Safe to run again.
 * @description A folder that is not there is reported and skipped. The worker runs them on its next tick. Under compose
 * the folders are mounted, so `HUB_DOCS_BASE=/data/docs` and `LAB_ROOT=/data/lab` (infra/compose.yaml).
 */
import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { TransactionHost } from '@nestjs-cls/transactional';

import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import type { PrismaTransactionalAdapter } from '../src/infra/prisma/prisma.module';

interface Wanted {
  readonly project: string;
  readonly name: string;
  readonly path: string;
  readonly purpose: 'docs' | 'lab';
  readonly exclude?: readonly string[];
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get<AppConfig>(APP_CONFIG);
    const base = process.env['HUB_DOCS_BASE'] ?? 'F:/Goteav';
    const wanted: Wanted[] = [
      {
        project: 'goteav',
        name: 'backend-docs',
        path: join(base, 'backend/docs'),
        purpose: 'docs',
        exclude: ['map/**', 'handover/**'],
      },
      {
        project: 'goteav',
        name: 'dashboard-docs',
        path: join(base, 'Goteav-Dashboard/docs'),
        purpose: 'docs',
      },
      { project: 'hub', name: 'hub-docs', path: join(base, 'hub/docs'), purpose: 'docs' },
      ...(config.LAB_ROOT
        ? [{ project: 'goteav', name: 'lab', path: config.LAB_ROOT, purpose: 'lab' as const }]
        : []),
    ];
    const tx = app.get<TransactionHost<PrismaTransactionalAdapter>>(TransactionHost, { strict: false }).tx;
    for (const item of wanted) {
      const workspace = await tx.workspace.findUnique({
        where: { slug: item.project },
        select: { id: true },
      });
      const label = `${item.project}/${item.name}`;
      if (!workspace) {
        process.stdout.write(`${label}: no such project, skipped\n`);
        continue;
      }
      if (!existsSync(item.path)) {
        process.stdout.write(`${label}: ${item.path} is not there, skipped\n`);
        continue;
      }
      const found = await tx.source.findUnique({
        where: { workspaceId_name: { workspaceId: workspace.id, name: item.name } },
        select: { id: true },
      });
      if (found) {
        process.stdout.write(`${label}: already there\n`);
        continue;
      }
      await tx.source.create({
        data: {
          workspaceId: workspace.id,
          kind: 'local_path',
          name: item.name,
          config: {
            path: item.path.split('\\').join('/'),
            purpose: item.purpose,
            ...(item.exclude ? { exclude: [...item.exclude] } : {}),
          },
        },
      });
      process.stdout.write(`${label}: added ${item.path}\n`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
