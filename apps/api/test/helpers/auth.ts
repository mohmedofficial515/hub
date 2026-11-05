/**
 * @file Real sign-in for e2e tests on `createTestApp({ realAuth: true })`.
 * @description `Browser` keeps cookies the way a browser would, by path, and sends the CSRF header.
 * `anAccount` writes a user with a real password hash. `aToken` writes an API token directly.
 */
import type { Server } from 'node:http';

import type { ApiTokenKind, Role } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { authenticator } from 'otplib';
import request, { type Response, type Test } from 'supertest';

import type { PrismaClient } from '@/generated/prisma/client';
import type { FakeClock } from '@/infra/clock/clock';
import { newApiToken } from '@/modules/identity/domain/credentials';

export const PASSWORD = 'a long enough passphrase';
let counter = 0;

export async function anAccount(
  prisma: PrismaClient,
  overrides: { email?: string; password?: string; status?: string; locale?: string } = {},
) {
  counter += 1;
  return prisma.user.create({
    data: {
      email: overrides.email ?? `account-${counter}@example.test`,
      passwordHash: await hash(overrides.password ?? PASSWORD, { type: argon2id }),
      displayName: `Account ${counter}`,
      avatarColor: 'teal',
      locale: overrides.locale ?? 'en',
      ...(overrides.status ? { status: overrides.status } : {}),
    },
  });
}

export async function join(
  prisma: PrismaClient,
  workspaceId: string,
  userId: string,
  roles: readonly Role[],
): Promise<void> {
  await prisma.membership.create({ data: { workspaceId, userId, roles: [...roles] } });
}

export async function aToken(
  prisma: PrismaClient,
  userId: string,
  kind: ApiTokenKind = 'mcp',
): Promise<{ id: string; token: string; prefix: string }> {
  const { token, prefix, tokenHash } = newApiToken();
  const row = await prisma.apiToken.create({ data: { userId, name: 'test', kind, prefix, tokenHash } });
  return { id: row.id, token, prefix };
}

export function totpCode(secret: string, clock: FakeClock): string {
  return authenticator.clone({ epoch: clock.now().getTime() }).generate(secret);
}

interface Jar {
  value: string;
  path: string;
}

export class Browser {
  private readonly cookies = new Map<string, Jar>();

  constructor(private readonly app: INestApplication) {}

  get(path: string): Test {
    return this.send(request(this.server()).get(`/api/v1${path}`), path);
  }

  post(path: string, body?: object): Test {
    const test = this.send(request(this.server()).post(`/api/v1${path}`), path);
    return body ? test.send(body) : test;
  }

  put(path: string, body: object): Test {
    return this.send(request(this.server()).put(`/api/v1${path}`), path).send(body);
  }

  patch(path: string, body: object): Test {
    return this.send(request(this.server()).patch(`/api/v1${path}`), path).send(body);
  }

  delete(path: string, body?: object): Test {
    const test = this.send(request(this.server()).delete(`/api/v1${path}`), path);
    return body ? test.send(body) : test;
  }

  /** Signs in and keeps the cookies. Fails the test on anything but success. */
  async signIn(email: string, password: string = PASSWORD): Promise<Response> {
    return this.post('/auth/sign-in', { email, password }).expect(200);
  }

  cookie(name: string): string | undefined {
    return this.cookies.get(name)?.value;
  }

  setCookie(name: string, value: string, path = '/'): void {
    this.cookies.set(name, { value, path });
  }

  private server(): Server {
    return this.app.getHttpServer() as Server;
  }

  private send(test: Test, path: string): Test {
    const full = `/api/v1${path}`;
    const header = [...this.cookies.entries()]
      .filter(([, jar]) => full.startsWith(jar.path))
      .map(([name, jar]) => `${name}=${jar.value}`)
      .join('; ');
    if (header) void test.set('Cookie', header);
    void test.set('X-Requested-With', 'hub');
    return test.on('response', (response: Response) => this.absorb(response));
  }

  private absorb(response: Response): void {
    const raw = response.headers['set-cookie'] as unknown as string[] | undefined;
    for (const line of raw ?? []) {
      const [pair = '', ...attributes] = line.split('; ');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const path = attributes.find((part) => part.startsWith('Path='))?.slice(5) ?? '/';
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, { value, path });
    }
  }
}
