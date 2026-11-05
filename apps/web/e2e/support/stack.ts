/**
 * @file The stack the browser tests run on: real Postgres and Redis in throwaway containers, the built API, the built web.
 * @description It never reads the local Hub database: every variable the API needs is set below, and real variables win over the root
 * `.env` (`apps/api/src/config/load-env.ts`). The lab is a temp fixture, so Approve writes there and never to a real lab.
 * `E2E_SKIP_BUILD=1` reuses the last builds while writing tests.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

import { API_PORT, API_URL, WEB_PORT, WEB_URL } from './ports';

const WEB_DIR = resolve(__dirname, '../..');
const API_DIR = resolve(WEB_DIR, '../api');
const ROOT = resolve(WEB_DIR, '../..');
const DIST_DIR = '.next-e2e';

export interface RunningStack {
  postgres: StartedPostgreSqlContainer;
  redis: StartedRedisContainer;
  processes: ChildProcess[];
  labRoot: string;
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const shell = command === 'pnpm' && process.platform === 'win32';
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', shell });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
}

function start(script: string[], cwd: string, env: NodeJS.ProcessEnv, logFile: string): ChildProcess {
  const log = openSync(logFile, 'w');
  const child = spawn(process.execPath, script, { cwd, env, stdio: ['ignore', log, log] });
  closeSync(log);
  return child;
}

/** One app with one version in review per project of the run, in the shape docs/10 §1 describes, and a baseline with no README. */
function aLab(): string {
  const root = mkdtempSync(join(tmpdir(), 'hub-e2e-lab-'));
  for (const locale of ['ar', 'en']) {
    const page = join(root, 'web', `wallet-${locale}`);
    const version = join(page, 'v2-flight-path');
    mkdirSync(version, { recursive: true });
    mkdirSync(join(page, 'v1-baseline'));
    writeFileSync(join(page, 'v1-baseline', 'components.md'), '# Components\n\nThe page as it is today.\n');
    writeFileSync(
      join(page, 'README.md'),
      '---\nstatus: active\nroute: /wallet\nlive-url: https://example.test/wallet\n---\n# Wallet\n',
    );
    writeFileSync(
      join(version, 'README.md'),
      '---\nstatus: review\nbase: v1-baseline\ntitle: Flight path\ntouches-components:\n  - WalletCard\n---\n# Flight path\n\nA new wallet.\n',
    );
  }
  return root;
}

async function waitFor(url: string, name: string, log: string) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      /* Not up yet. */
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`${name} did not come up at ${url}. Its log: ${log}`);
}

export const OWNER = { email: 'owner@e2e.test', password: 'Owner-pass-e2e-12345', name: 'Owner' };

export async function startStack(): Promise<RunningStack> {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('hub_e2e_web')
      .withUsername('hub')
      .withPassword('hub')
      .start(),
    new RedisContainer('redis:7-alpine').start(),
  ]);
  const labRoot = aLab();
  const logs = join(WEB_DIR, 'test-results');
  mkdirSync(logs, { recursive: true });

  const apiEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PROCESS_ROLE: 'all',
    PORT: String(API_PORT),
    LOG_LEVEL: 'warn',
    TZ: 'Europe/Istanbul',
    HUB_PUBLIC_URL: WEB_URL,
    HUB_ALLOWED_HOSTS: 'localhost,127.0.0.1',
    DATABASE_URL: `${postgres.getConnectionUri()}?schema=public`,
    REDIS_URL: redis.getConnectionUrl(),
    HUB_SECRET_KEY: randomBytes(32).toString('base64'),
    HUB_JWT_SECRET: randomBytes(48).toString('base64url'),
    HUB_OWNER_EMAIL: OWNER.email,
    HUB_OWNER_PASSWORD: OWNER.password,
    HUB_OWNER_NAME: OWNER.name,
    LAB_ROOT: labRoot,
    LAB_URL: 'http://localhost:6200',
    REPOS_ROOT: join(labRoot, '.repos'),
    MAIL_PROVIDER: 'none',
  };

  const prisma = join(API_DIR, 'node_modules/prisma/build/index.js');
  run(process.execPath, [prisma, 'migrate', 'deploy'], API_DIR, apiEnv);
  run(process.execPath, ['-r', './scripts/swc-register.cjs', 'scripts/seed-owner.ts'], API_DIR, apiEnv);

  const webEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    NEXT_DIST_DIR: DIST_DIR,
    HUB_API_ORIGIN: API_URL,
    NEXT_PUBLIC_LAB_URL: 'http://localhost:6200',
  };
  if (!process.env['E2E_SKIP_BUILD']) {
    run('pnpm', ['--filter', '@hub/contracts', 'build'], ROOT, process.env);
    run('pnpm', ['--filter', '@hub/api', 'build'], ROOT, process.env);
    run('pnpm', ['exec', 'next', 'build'], WEB_DIR, webEnv);
  }

  const apiLog = join(logs, 'e2e-api.log');
  const webLog = join(logs, 'e2e-web.log');
  const nextBin = join(WEB_DIR, 'node_modules/next/dist/bin/next');
  const processes = [
    start(['dist/main'], API_DIR, apiEnv, apiLog),
    start([nextBin, 'start', '-p', String(WEB_PORT)], WEB_DIR, webEnv, webLog),
  ];
  await waitFor(`${API_URL}/api/v1/health/ready`, 'API', apiLog);
  await waitFor(WEB_URL, 'web', webLog);
  return { postgres, redis, processes, labRoot };
}

export async function stopStack(stack: RunningStack) {
  for (const child of stack.processes) child.kill();
  await Promise.all([stack.postgres.stop(), stack.redis.stop()]);
  rmSync(stack.labRoot, { recursive: true, force: true });
}
