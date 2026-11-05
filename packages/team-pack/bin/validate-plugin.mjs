#!/usr/bin/env node
/**
 * @file `claude plugin validate` on the plugin and the marketplace, when the CLI is available.
 * @description CI has no Claude Code unless it installs it, so a missing CLI skips with a clear line rather than failing.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shell = process.platform === 'win32';
const run = (args) => spawnSync('claude', args, { encoding: 'utf8', shell, windowsHide: true });

if (run(['--version']).status !== 0) {
  process.stdout.write('claude is not on PATH: plugin validation skipped\n');
} else {
  for (const target of [join(root, 'plugin'), root]) {
    const result = run(['plugin', 'validate', shell ? `"${target}"` : target, '--strict']);
    process.stdout.write(`${result.stdout}${result.stderr}`);
    if (result.status !== 0) process.exitCode = 1;
  }
}
