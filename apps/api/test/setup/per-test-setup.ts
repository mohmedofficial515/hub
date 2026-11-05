/**
 * @file Jest `setupFilesAfterEnv`: every test starts on an empty database and Redis, and every app closes.
 */
import 'reflect-metadata';

import { PrismaPg } from '@prisma/adapter-pg';
import Redis from 'ioredis';

import { PrismaClient } from '@/generated/prisma/client';
import { truncateAll } from '@/infra/prisma/truncate-all';

import { closeTestApps } from './create-test-app';
import { readE2eState } from './e2e-state';

let prisma: PrismaClient | undefined;
let redis: Redis | undefined;

/** Direct clients, independent of the app under test and of the scope assertion. */
export function maintenanceClients(): { prisma: PrismaClient; redis: Redis } {
  const state = readE2eState();
  prisma ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: state.databaseUrl }) });
  redis ??= new Redis(state.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  return { prisma, redis };
}

afterEach(async () => {
  const clients = maintenanceClients();
  await clients.redis.flushdb();
  await truncateAll(clients.prisma);
});

afterAll(async () => {
  await closeTestApps();
  await prisma?.$disconnect();
  redis?.disconnect();
  prisma = undefined;
  redis = undefined;
});
