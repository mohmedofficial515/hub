/**
 * @file Settings › System › Mail and the real mailer (docs/16 D68, D69), against `test/helpers/smtp-server.ts` on 127.0.0.1: authenticated
 * SMTP as Gmail takes it, a wrong app password, a server that is not there, the owner-only rule, and the invite email with the way to
 * reach Hub on a tailnet. Never a real server, and the password never comes back.
 */
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { aWorkspace } from '../factories';
import { anAccount, aToken, Browser, join } from '../helpers/auth';
import { startTestSmtp, type TestSmtp } from '../helpers/smtp-server';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const USER = 'hub.owner@gmail.test';
const PASS = 'abcd efgh ijkl mnop';
const KEYS = [
  'HUB_PUBLIC_URL',
  'MAIL_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_SECURE',
  'MAIL_FROM',
] as const;

describe('mail', () => {
  let smtp: TestSmtp;
  const saved = new Map<string, string | undefined>();
  const db = () => maintenanceClients().prisma;

  /** An app whose mail goes where `env` says, with real cookies and the real mailer. */
  async function anApp(env: Partial<Record<(typeof KEYS)[number], string>>): Promise<INestApplication> {
    for (const key of KEYS) delete process.env[key];
    Object.assign(process.env, env);
    return (await createTestApp({ realAuth: true, realMail: true })).app;
  }

  const login = (port: number, pass = PASS) => ({
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_SECURE: 'false',
    SMTP_USER: USER,
    SMTP_PASS: pass,
    MAIL_FROM: `Hub <${USER}>`,
  });

  async function anOwner(app: INestApplication, roles: ('owner' | 'pm')[] = ['owner', 'pm']) {
    const workspace = await aWorkspace(db());
    await db().workspaceSetting.create({
      data: { workspaceId: workspace.id, key: 'security.totp_required_roles', value: [] },
    });
    const account = await anAccount(db(), { locale: 'ar' });
    await join(db(), workspace.id, account.id, roles);
    const browser = new Browser(app);
    await browser.signIn(account.email);
    return { workspace, account, browser };
  }

  beforeAll(async () => {
    for (const key of KEYS) saved.set(key, process.env[key]);
    smtp = await startTestSmtp({ user: USER, pass: PASS });
  });

  afterAll(async () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await smtp.close();
  });

  beforeEach(() => {
    smtp.mails.length = 0;
  });

  it('shows where mail goes, never the password, and sends a test through an authenticated login', async () => {
    const app = await anApp(login(smtp.port));
    const { workspace, account, browser } = await anOwner(app);
    const status = await browser.get(`/workspaces/${workspace.slug}/mail`).expect(200);
    expect(status.body.data).toEqual({
      mode: 'local',
      host: '127.0.0.1',
      port: smtp.port,
      secure: false,
      authenticated: true,
      from: `Hub <${USER}>`,
    });
    expect(JSON.stringify(status.body)).not.toContain(PASS);

    const test = await browser.post(`/workspaces/${workspace.slug}/mail/test`).expect(200);
    expect(test.body.data).toEqual({
      sent: true,
      to: account.email,
      mode: 'local',
      failure: null,
      responseCode: null,
    });
    expect(smtp.mails).toHaveLength(1);
    expect(smtp.mails[0]).toMatchObject({
      from: USER,
      to: [account.email],
      user: USER,
      subject: 'رسالة تجربة من Hub',
    });
    expect(smtp.mails[0]?.text).toContain('127.0.0.1');

    const audit = await db().auditLog.findMany({ where: { action: 'identity.mail.test' } });
    expect(audit).toHaveLength(1);
    expect(audit.map((entry) => entry.summary).join(' ')).not.toContain(PASS);
  });

  it('a refused app password and a server that is not there are answers the page can explain', async () => {
    const wrong = await anApp(login(smtp.port, 'not the app password'));
    const first = await anOwner(wrong);
    const refused = await first.browser.post(`/workspaces/${first.workspace.slug}/mail/test`).expect(200);
    expect(refused.body.data).toMatchObject({ sent: false, failure: 'auth', responseCode: 535 });
    expect(smtp.mails).toHaveLength(0);

    // A port nothing listens on: the test server's, after it moved away from it.
    const gone = await startTestSmtp();
    const port = gone.port;
    await gone.close();
    const absent = await anApp(login(port));
    const second = await anOwner(absent);
    const unreachable = await second.browser
      .post(`/workspaces/${second.workspace.slug}/mail/test`)
      .expect(200);
    expect(unreachable.body.data).toMatchObject({ sent: false, failure: 'connection' });
  });

  it('with no mail server it says so and sends nothing', async () => {
    const app = await anApp({ MAIL_PROVIDER: 'none' });
    const { workspace, browser } = await anOwner(app);
    const status = await browser.get(`/workspaces/${workspace.slug}/mail`).expect(200);
    expect(status.body.data).toMatchObject({ mode: 'off', host: null, authenticated: false });
    const test = await browser.post(`/workspaces/${workspace.slug}/mail/test`).expect(200);
    expect(test.body.data).toMatchObject({ sent: false, failure: 'not_configured' });
  });

  it('is the owner’s alone, and only from the web', async () => {
    const app = await anApp(login(smtp.port));
    const { workspace, account } = await anOwner(app);
    const pm = await anOwner(app, ['pm']);
    await join(db(), workspace.id, pm.account.id, ['pm']);
    const refused = await pm.browser.get(`/workspaces/${workspace.slug}/mail`).expect(403);
    expect(refused.body.error.code).toBe('hub.common.forbidden');
    await pm.browser.post(`/workspaces/${workspace.slug}/mail/test`).expect(403);

    const { token } = await aToken(db(), account.id);
    const byToken = await request(app.getHttpServer() as Server)
      .post(`/api/v1/workspaces/${workspace.slug}/mail/test`)
      .set('Authorization', `Bearer ${token}`);
    expect(byToken.status).toBe(403);
    expect(smtp.mails).toHaveLength(0);
  });

  it('the invite email goes through the login, in the project’s language, with the way to reach Hub on a tailnet', async () => {
    const app = await anApp({ ...login(smtp.port), HUB_PUBLIC_URL: 'https://hub-main.tail0000.ts.net' });
    const { workspace, account, browser } = await anOwner(app);
    const created = await browser
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'friend@example.test', roles: ['qa'] })
      .expect(201);
    expect(created.body.data.mail).toBe('local');
    for (let wait = 0; wait < 50 && smtp.mails.length === 0; wait += 1) {
      await new Promise((done) => setTimeout(done, 100));
    }
    expect(smtp.mails).toHaveLength(1);
    const mail = smtp.mails[0];
    expect(mail).toMatchObject({
      to: ['friend@example.test'],
      user: USER,
      subject: `دعوة للانضمام إلى ${workspace.name} في Hub`,
    });
    expect(mail?.text).toContain(created.body.data.url as string);
    expect(mail?.text).toContain(account.displayName);
    expect(mail?.text).toContain('https://tailscale.com/download');
    expect(mail?.text).toContain('«hub-main»');
  });
});
