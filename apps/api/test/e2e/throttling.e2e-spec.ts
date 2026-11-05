/**
 * @file Rate limits of docs/04 §1.7, on real credentials.
 */
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { RATE_LIMITS } from '@/infra/throttler/rate-limit.guard';

import { anAccount, aToken, Browser } from '../helpers/auth';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

describe('rate limits', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer() as Server);
  const db = () => maintenanceClients().prisma;

  beforeAll(async () => {
    ({ app } = await createTestApp({ realAuth: true }));
  });

  it('sign-in allows 10 a minute per IP, then answers 429 with Retry-After', async () => {
    const body = { email: 'nobody@example.test', password: 'wrong wrong wrong' };
    for (let attempt = 0; attempt < RATE_LIMITS.auth; attempt += 1) {
      await http().post('/api/v1/auth/sign-in').send(body).expect(401);
    }
    const limited = await http().post('/api/v1/auth/sign-in').send(body).expect(429);
    expect(limited.body.error.code).toBe('hub.common.rate_limited');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(Number(limited.headers['retry-after'])).toBeLessThanOrEqual(60);
  });

  it.each([
    ['/api/v1/auth/password/forgot', { email: 'nobody@example.test' }, 202],
    ['/api/v1/auth/password/reset', { token: 'nope', password: 'a long enough passphrase' }, 404],
    ['/api/v1/auth/totp/verify', { challenge: 'nope', code: '123456' }, 401],
    ['/api/v1/auth/totp/recover', { challenge: 'nope', recoveryCode: 'NOPE' }, 401],
  ])('%s has the same limit', async (path, body, status) => {
    for (let attempt = 0; attempt < RATE_LIMITS.auth; attempt += 1) {
      await http().post(path).send(body).expect(status);
    }
    await http().post(path).send(body).expect(429);
  });

  it('an MCP token gets 120 a minute and a hook token 60, each on its own bucket', async () => {
    const { redis } = maintenanceClients();
    await redis.connect().catch(() => undefined);
    const account = await anAccount(db());
    const mcp = await aToken(db(), account.id, 'mcp');
    const hook = await aToken(db(), account.id, 'hook');
    const call = (token: string) => http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);

    await redis.set(`rl:token:${mcp.id}`, RATE_LIMITS.agent - 1, 'EX', 60);
    await call(mcp.token).expect(200);
    await call(mcp.token).expect(429);

    await redis.set(`rl:token:${hook.id}`, RATE_LIMITS.hook - 1, 'EX', 60);
    await call(hook.token).expect(200);
    await call(hook.token).expect(429);
  });

  it('a signed-in member gets 600 a minute', async () => {
    const { redis } = maintenanceClients();
    await redis.connect().catch(() => undefined);
    const account = await anAccount(db());
    const user = new Browser(app);
    await user.signIn(account.email);
    await redis.set(`rl:user:${account.id}`, RATE_LIMITS.user - 1, 'EX', 60);
    await user.get('/auth/me').expect(200);
    const limited = await user.get('/auth/me').expect(429);
    expect(limited.body.error.code).toBe('hub.common.rate_limited');
  });

  it('health is not limited', async () => {
    for (let attempt = 0; attempt < RATE_LIMITS.auth + 2; attempt += 1) {
      await http().get('/api/v1/health/live').expect(200);
    }
  });
});
