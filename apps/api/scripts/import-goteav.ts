/**
 * @file `pnpm import:goteav --workspace goteav --root F:/Goteav [--dry-run]`: reads Goteav's history into a project.
 * @description Reads the files here, so the API never reads a path itself (docs/06 §7), then calls the import service in
 * this process. Safe to run again: it creates nothing twice and leaves alone any card edited since. Exits non-zero when
 * the run report lists problems. Run `pnpm seed:owner` first, which creates the project.
 */
import 'reflect-metadata';

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { GoteavImportService } from '../src/modules/capture';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function firstCommitAt(folder: string, file: string): string | null {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%aI', '--', file], {
      cwd: folder,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().split('\n').pop() || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const root = option('root') ?? 'F:/Goteav';
  const workspace = option('workspace') ?? 'goteav';
  const backend = join(root, 'backend');
  const statusDir = join(backend, 'docs', 'status');
  const contractChanges = join(root, '.goteav-ops', 'contract-changes.md');
  const input = {
    decisionsYaml: readFileSync(join(backend, 'docs/map/data/_decisions.yaml'), 'utf8'),
    suggestionsYaml: readFileSync(join(backend, 'docs/map/data/_suggestions.yaml'), 'utf8'),
    statusFiles: readdirSync(statusDir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => ({
        name,
        content: readFileSync(join(statusDir, name), 'utf8'),
        firstCommitAt: /\d{4}-\d{2}-\d{2}/.test(name) ? null : firstCommitAt(statusDir, name),
      })),
    contractChangesMd: existsSync(contractChanges) ? readFileSync(contractChanges, 'utf8') : null,
    docsPath: join(backend, 'docs').replaceAll('\\', '/'),
    repoPaths: ['backend', 'web', 'Goteav-Dashboard'].map((name) => join(root, name).replaceAll('\\', '/')),
    dryRun: process.argv.includes('--dry-run'),
  };

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const report = await app.get(GoteavImportService, { strict: false }).run(workspace, input);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.problems.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
