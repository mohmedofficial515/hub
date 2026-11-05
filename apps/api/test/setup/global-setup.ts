/**
 * @file Jest `globalSetup`: starts Postgres (with pgvector) and Redis, applies every migration once.
 * @description Adapted from F:/Goteav/backend/test/setup/global-setup.ts. Runs in the parent process, so
 * imports stay relative. Set E2E_REUSE_CONTAINERS=true to keep the containers between runs.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

import { writeE2eState } from './e2e-state';

const ROOT_DIR = resolve(__dirname, '../..');

declare global {
  var __HUB_E2E__: { postgres: StartedPostgreSqlContainer; redis: StartedRedisContainer } | undefined;
}

export default async function globalSetup(): Promise<void> {
  const reuse = process.env['E2E_REUSE_CONTAINERS'] === 'true';
  const postgresContainer = new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('hub_test')
    .withUsername('hub')
    .withPassword('hub');
  const redisContainer = new RedisContainer('redis:7-alpine');
  if (reuse) {
    postgresContainer.withReuse();
    redisContainer.withReuse();
  }
  const [postgres, redis] = await Promise.all([postgresContainer.start(), redisContainer.start()]);
  const databaseUrl = `${postgres.getConnectionUri()}?schema=public`;
  writeE2eState({ databaseUrl, redisUrl: redis.getConnectionUrl() });

  const prismaCli = resolve(ROOT_DIR, 'node_modules/prisma/build/index.js');
  const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: ROOT_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed\n${result.stdout}\n${result.stderr}`);
  }
  globalThis.__HUB_E2E__ = { postgres, redis };
}
