/**
 * @file HubServer's runner (docs/16 "Slice 6 as built", D63): Hub in production mode from what is already built, started by the logon task.
 * @description It never builds: a missing build is logged with the command that makes it (`pnpm hub:service build`), and it stops. It brings up
 * the containers (waiting for Docker Desktop, which starts late at logon), applies migrations, then runs the API, the web and the lab, and starts
 * again any of them that stops, with a growing wait. Task Scheduler's own restart only covers a task that could not launch, so this loop is
 * what keeps Hub up. If Hub's ports are already taken (a `pnpm start:local` is running), it leaves that Hub alone and exits.
 * Logs go to `.tmp/logs` (`hub-server.log`, and `api.log`, `web.log`, `lab.log`); `.tmp/hub-server.json` holds its pid for `stop:local`
 * and `hub:service`. Run it by hand with `node scripts/hub-server.mjs` to see what the task would do.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  apiDir,
  bindHostOf,
  hubServerFile,
  isPortBusy,
  labDir,
  logDir,
  missingBuild,
  readEnvFile,
  root,
  stopTree,
  WEB_DIST,
  webDir,
} from './lib/hub-local.mjs';

const DOCKER_WAIT_MS = 10 * 60_000;
const BACKOFF_MIN_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;
/** A part that ran this long is healthy again, and its wait starts over. */
const HEALTHY_AFTER_MS = 5 * 60_000;

mkdirSync(logDir, { recursive: true });
const serverLog = join(logDir, 'hub-server.log');
const log = (text) => appendFileSync(serverLog, `${new Date().toISOString()} ${text}\n`);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    ...options,
  });
}

async function composeUp() {
  const deadline = Date.now() + DOCKER_WAIT_MS;
  for (;;) {
    const result = run('docker', ['compose', '-f', 'infra/compose.dev.yaml', 'up', '-d', '--wait']);
    if (result.status === 0) return true;
    if (Date.now() > deadline) {
      log(
        `Docker did not bring up Postgres and Redis in ten minutes: ${(result.stderr ?? '').trim().slice(-300)}`,
      );
      return false;
    }
    await sleep(15_000);
  }
}

const parts = new Map();
let stopping = false;

function writeState() {
  writeFileSync(
    hubServerFile,
    JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      children: [...parts.values()].map((part) => part.child?.pid).filter(Boolean),
    }),
  );
}

function startPart(part) {
  const file = openSync(join(logDir, `${part.name}.log`), 'a');
  part.child = spawn(process.execPath, part.args, {
    cwd: part.cwd,
    env: part.env,
    stdio: ['ignore', file, file],
    windowsHide: true,
  });
  closeSync(file);
  part.startedAt = Date.now();
  log(`${part.name} started (process ${part.child.pid})`);
  writeState();
  part.child.once('exit', async (code) => {
    if (stopping) return;
    if (Date.now() - part.startedAt > HEALTHY_AFTER_MS) part.backoff = BACKOFF_MIN_MS;
    log(`${part.name} stopped (exit ${code}). Starting it again in ${Math.round(part.backoff / 1000)} s.`);
    await sleep(part.backoff);
    part.backoff = Math.min(part.backoff * 2, BACKOFF_MAX_MS);
    if (!stopping) startPart(part);
  });
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const part of parts.values()) if (part.child?.exitCode === null) stopTree(part.child.pid);
  rmSync(hubServerFile, { force: true });
  log('HubServer stopped.');
  process.exit(code);
}

async function main() {
  const env = readEnvFile(join(root, '.env'));
  const apiPort = Number(env.PORT || 7310);
  const webPort = Number(process.env.HUB_WEB_PORT ?? 7300);
  const labPort = Number(env.LAB_PORT || 7320);
  log('HubServer starting.');
  if (!env.HUB_OWNER_EMAIL) {
    log('The root .env is missing or has no HUB_OWNER_EMAIL. Run `pnpm start:local` once first.');
    process.exit(1);
  }
  if ((await isPortBusy(webPort)) || (await isPortBusy(apiPort))) {
    log(
      `Port ${webPort} or ${apiPort} is in use: another Hub (pnpm start:local?) is running. HubServer leaves it alone.`,
    );
    process.exit(0);
  }
  const missing = missingBuild();
  if (missing.length > 0) {
    log(
      `Nothing to run: the ${missing.join(', ')} build is missing. Run \`pnpm hub:service build\`, then \`pnpm hub:service start\`.`,
    );
    process.exit(1);
  }
  if (!(await composeUp())) process.exit(1);
  const prisma = join(apiDir, 'node_modules/prisma/build/index.js');
  const migrated = run(process.execPath, [prisma, 'migrate', 'deploy'], { cwd: apiDir });
  if (migrated.status !== 0) {
    log(`Migrations failed: ${(migrated.stderr || migrated.stdout || '').trim().slice(-500)}`);
    process.exit(1);
  }

  const host = bindHostOf(env);
  const webEnv = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
    NEXT_DIST_DIR: WEB_DIST,
    HUB_API_ORIGIN: `http://localhost:${apiPort}`,
    HUB_LAB_ORIGIN: `http://127.0.0.1:${labPort}`,
  };
  const add = (name, args, cwd, partEnv) =>
    parts.set(name, { name, args, cwd, env: partEnv, backoff: BACKOFF_MIN_MS, child: null, startedAt: 0 });
  add('api', ['dist/main'], apiDir, { ...process.env });
  add(
    'web',
    [
      join(webDir, 'node_modules/next/dist/bin/next'),
      'start',
      '-p',
      String(webPort),
      ...(host ? ['-H', host] : []),
    ],
    webDir,
    webEnv,
  );
  const vite = join(labDir, 'node_modules/vite/bin/vite.js');
  if (existsSync(vite)) {
    add('lab', [vite], labDir, {
      ...process.env,
      LAB_PORT: String(labPort),
      ...(env.LAB_WEB_SRC ? { LAB_WEB_SRC: env.LAB_WEB_SRC } : {}),
      ...(env.LAB_DASH_SRC ? { LAB_DASH_SRC: env.LAB_DASH_SRC } : {}),
    });
  } else {
    log('The lab has no packages (`pnpm install`), so Hub runs without it and Redesign says so.');
  }
  for (const part of parts.values()) startPart(part);
  log(`Hub is running: http://localhost:${webPort}${host ? ` (listening on ${host})` : ''}.`);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
process.on('SIGBREAK', () => stopAll(0));
const keepAlive = setInterval(() => {}, 60_000);
main().catch((error) => {
  log(`HubServer failed: ${error instanceof Error ? error.message : String(error)}`);
  clearInterval(keepAlive);
  stopAll(1);
});
