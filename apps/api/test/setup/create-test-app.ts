/**
 * @file Boots the real AppModule on the test containers.
 * @description The principal comes from the `x-test-user` header until H0-03 lands sign-in; a test sends
 * `x-test-kind: agent` to act as a Claude Code token. The clock is a `FakeClock` the test can move.
 */
import type { Principal } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';

import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { CLOCK, FakeClock } from '@/infra/clock/clock';
import { PRINCIPAL_RESOLVER, type PrincipalResolver } from '@/modules/identity';

class HeaderPrincipalResolver implements PrincipalResolver {
  async resolve(request: Request): Promise<Principal | null> {
    const userId = request.header('x-test-user');
    if (!userId) return null;
    return request.header('x-test-kind') === 'agent'
      ? { kind: 'agent', userId, via: 'mcp', tokenId: '00000000-0000-7000-8000-000000000001' }
      : { kind: 'user', userId, via: 'web' };
  }
}

export interface TestApp {
  readonly app: INestApplication;
  readonly clock: FakeClock;
}

const open: INestApplication[] = [];

export async function createTestApp(): Promise<TestApp> {
  const clock = new FakeClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(PRINCIPAL_RESOLVER)
    .useClass(HeaderPrincipalResolver)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  open.push(app);
  return { app, clock };
}

export async function closeTestApps(): Promise<void> {
  await Promise.all(open.splice(0).map((app) => app.close()));
}
