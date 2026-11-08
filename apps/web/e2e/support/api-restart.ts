/**
 * @file Restarts the throwaway API on the same database, as a restart of the owner's machine would: the gate of docs/16 §12 step 5, a scheduled run that survives a restart.
 * @description Only the stack's own API, by the pid global setup wrote, never anything on the owner's ports. The new one is recorded so the run's teardown stops it. Tests run one at a time (`workers: 1`), so nothing else is using the API while it is down.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { API_URL } from './ports';
import { API_FILE, API_PIDS_FILE } from './state';

/** Starts `dist/main` detached with the recorded folder, variables and log, prints its pid, and exits. */
const LAUNCHER = `
const { spawn } = require('node:child_process');
const { openSync } = require('node:fs');
const record = JSON.parse(process.argv[1]);
const log = openSync(record.log, 'a');
const child = spawn(process.execPath, ['dist/main'], { cwd: record.cwd, env: record.env, stdio: ['ignore', log, log], detached: true, windowsHide: true });
child.unref();
process.stdout.write(String(child.pid));
`;

interface ApiRecord {
  pid: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
  log: string;
}

function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(pid);
  } catch {
    /* Already gone. */
  }
}

async function ready(): Promise<boolean> {
  try {
    return (await fetch(`${API_URL}/api/v1/health/ready`)).ok;
  } catch {
    return false;
  }
}

async function until(check: () => Promise<boolean>, what: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 300));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

/** Stops the API, waits `downMs` with it gone, and starts it again on the same database and port. */
export async function restartApi(downMs: number): Promise<void> {
  const record = JSON.parse(readFileSync(API_FILE, 'utf8')) as ApiRecord;
  killTree(record.pid);
  await until(async () => !(await ready()), 'the API to stop', 30_000);
  await new Promise((done) => setTimeout(done, downMs));
  // A launcher that exits at once leaves the API with no living parent, so Playwright's tree kill of this worker, between projects, cannot reach it.
  const launched = spawnSync(process.execPath, ['-e', LAUNCHER, JSON.stringify(record)], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const pid = Number(launched.stdout.trim());
  if (!(pid > 0)) throw new Error(`The API did not start again: ${launched.stderr}`);
  appendFileSync(API_PIDS_FILE, `${pid}\n`);
  writeFileSync(API_FILE, JSON.stringify({ ...record, pid }));
  await until(ready, 'the API to come back');
}

/** For the run's teardown. */
export function stopRestartedApis(): void {
  if (!existsSync(API_PIDS_FILE)) return;
  for (const pid of readFileSync(API_PIDS_FILE, 'utf8').split('\n').map(Number)) {
    if (pid > 0) killTree(pid);
  }
  rmSync(API_PIDS_FILE, { force: true });
}
