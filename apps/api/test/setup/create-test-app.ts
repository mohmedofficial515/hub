/**
 * @file Boots the real AppModule on the test containers.
 * @description By default the principal comes from the `x-test-user` header, and a test sends
 * `x-test-kind: agent` to act as a Claude Code token. `createTestApp({ realAuth: true })` uses real cookies and
 * tokens instead (`test/helpers/auth.ts`). The clock is a `FakeClock` the test can move, and mail is recorded.
 */
import type { Principal, Role } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';

import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { CLOCK, FakeClock } from '@/infra/clock/clock';
import {
  Mailer,
  type MailMessage,
  PRINCIPAL_RESOLVER,
  type PrincipalResolver,
  TotpPolicy,
} from '@/modules/identity';

class HeaderPrincipalResolver implements PrincipalResolver {
  async resolve(request: Request): Promise<Principal | null> {
    const userId = request.header('x-test-user');
    if (!userId) return null;
    return request.header('x-test-kind') === 'agent'
      ? { kind: 'agent', userId, via: 'mcp', tokenId: '00000000-0000-7000-8000-000000000001' }
      : { kind: 'user', userId, via: 'web' };
  }
}

/** Tests that are not about auth need no enrolment, whichever roles their members hold. */
class NoTotpPolicy {
  async assertSatisfied(): Promise<void> {}
  async requiredRoles(): Promise<readonly Role[]> {
    return [];
  }
  async requiredForUser(): Promise<boolean> {
    return false;
  }
}

export interface TestApp {
  readonly app: INestApplication;
  readonly clock: FakeClock;
  readonly mailer: RecordingMailer;
}

const open: INestApplication[] = [];

export interface TestAppOptions {
  /** Real cookies, tokens and TOTP enforcement, for tests of sign-in itself. */
  readonly realAuth?: boolean;
  /** The real SMTP mailer, for tests of mail itself. The test points SMTP_* at `test/helpers/smtp-server.ts`, never a real server. */
  readonly realMail?: boolean;
}

/** Keeps the messages a test sent, so it can follow a link out of them. */
export class RecordingMailer extends Mailer {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const clock = new FakeClock();
  const mailer = new RecordingMailer();
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock);
  if (!options.realMail) builder = builder.overrideProvider(Mailer).useValue(mailer);
  if (!options.realAuth) {
    builder = builder
      .overrideProvider(PRINCIPAL_RESOLVER)
      .useClass(HeaderPrincipalResolver)
      .overrideProvider(TotpPolicy)
      .useValue(new NoTotpPolicy());
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  open.push(app);
  return { app, clock, mailer };
}

export async function closeTestApps(): Promise<void> {
  await Promise.all(open.splice(0).map((app) => app.close()));
}
