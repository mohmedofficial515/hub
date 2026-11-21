/**
 * @file `pnpm lab:repoint [--rescan]`: points the project's lab source at `LAB_ROOT`, or at `apps/lab` when that is unset (docs/16 §6).
 * @description Part of the cut-over from the old lab folder. Card keys do not change. `--rescan` then runs each lab source once and prints what the
 * scan did, so a move that went wrong shows as cards created. Safe to run again.
 */
import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';
import { TransactionHost } from '@nestjs-cls/transactional';

import { AppModule } from '../src/app.module';
import { APP_CONFIG, type AppConfig } from '../src/config/config.module';
import type { PrismaTransactionalAdapter } from '../src/infra/prisma/prisma.module';
import { runUnscoped } from '../src/infra/prisma/workspace-scope';
import { LabRepointService } from '../src/modules/redesign/application/lab-repoint.service';
import { defaultLabRoot } from '../src/modules/redesign/application/lab-root';
import { SourceRunnerService } from '../src/modules/system/application/source-runner.service';

const say = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const config = app.get<AppConfig>(APP_CONFIG);
    const root = config.LAB_ROOT ?? defaultLabRoot();
    if (!root || !existsSync(join(root, 'lab/index.html'))) {
      throw new Error(`No lab at ${root ?? 'apps/lab'}. Nothing changed.`);
    }
    const result = await app.get(LabRepointService, { strict: false }).repoint(root);
    say(`Lab root: ${root}`);
    for (const source of result.sources) say(`Source ${source.name}: moved from ${source.from}`);
    if (result.sources.length === 0) say('Sources: already there');
    say(`Version addresses rewritten: ${result.labUrls}`);

    if (!process.argv.includes('--rescan')) return;
    const tx = app.get<TransactionHost<PrismaTransactionalAdapter>>(TransactionHost, { strict: false }).tx;
    const runner = app.get(SourceRunnerService, { strict: false });
    const sources = await runUnscoped('Every project may have a lab', async () =>
      tx.source.findMany({ where: { kind: 'local_path' } }),
    );
    for (const source of sources) {
      if ((source.config as { purpose?: string }).purpose !== 'lab') continue;
      const runId = await runner.open(source.workspaceId, source.id);
      await runner.finish(source.workspaceId, runId);
      const run = await tx.captureRun.findUniqueOrThrow({ where: { id: runId } });
      say(
        `Rescan of ${source.name}: ${run.status}, created ${run.created}, updated ${run.updated}${run.error ? `, ${run.error}` : ''}`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
