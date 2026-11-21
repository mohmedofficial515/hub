/**
 * @file The friend's invite journey as `tailscale serve` delivers it (docs/16 D43, D68, D69): an https HUB_PUBLIC_URL, and every request
 * as the web's proxy passes it on, with the bind address in `x-forwarded-host`. Invite, accept, Secure cookies, the project, sign in again,
 * with and without TOTP; a new link, expired, used and revoked; the owner's own browser; and one sign-in limit per device.
 */
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import type { FakeClock } from '@/infra/clock/clock';

import { aWorkspace } from '../factories';
import { anAccount, Browser, join, PASSWORD, totpCode } from '../helpers/auth';
import { createTestApp, type RecordingMailer } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const PUBLIC = 'https://hub-main.tail0000.ts.net';
const FRIEND_PASSWORD = 'friend passphrase 2026';

describe('invite journey behind tailscale serve', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let mailer: RecordingMailer;
  let saved: string | undefined;
  const db = () => maintenanceClients().prisma;

  /** A device on the tailnet. The web's proxy sends tailscale's Host, the bind address, as `x-forwarded-host`. */
  const device = (ip: string) =>
    new Browser(app, {
      'x-forwarded-host': '127.0.0.1:7300',
      'x-forwarded-proto': 'https',
      'x-forwarded-for': ip,
      origin: PUBLIC,
    });

  beforeAll(async () => {
    saved = process.env['HUB_PUBLIC_URL'];
    process.env['HUB_PUBLIC_URL'] = PUBLIC;
    ({ app, clock, mailer } = await createTestApp({ realAuth: true }));
  });

  afterAll(() => {
    if (saved === undefined) delete process.env['HUB_PUBLIC_URL'];
    else process.env['HUB_PUBLIC_URL'] = saved;
  });

  beforeEach(() => {
    clock.set(new Date('2026-11-09T09:00:00.000Z'));
    mailer.sent.length = 0;
  });

  async function aProject(required: string[] = []) {
    const workspace = await aWorkspace(db());
    await db().workspaceSetting.create({
      data: { workspaceId: workspace.id, key: 'security.totp_required_roles', value: required },
    });
    const lead = await anAccount(db());
    await join(db(), workspace.id, lead.id, ['owner', 'pm']);
    const owner = device('100.64.0.1');
    await owner.signIn(lead.email);
    return { workspace, lead, owner };
  }

  const tokenOf = (url: string) => /\/invite\/([\w-]+)$/.exec(url)?.[1] as string;
  const setCookies = (response: Response) => (response.headers['set-cookie'] as unknown as string[]) ?? [];

  it('the link is the tailnet address; the friend joins with Secure cookies, lands in the project, and signs in again', async () => {
    const { workspace, lead, owner } = await aProject();
    const created = await owner
      .post(`/workspaces/${workspace.slug}/invites`, {
        email: 'friend@example.test',
        roles: ['backend', 'qa'],
      })
      .expect(201);
    const { url, mail } = created.body.data as { url: string; mail: string };
    expect(url).toMatch(new RegExp(`^${PUBLIC.replaceAll('.', '\\.')}/ar/invite/[\\w-]{43}$`));
    expect(mail).toBe('off');
    // The email carries the link and, on a tailnet, how to reach Hub.
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.text).toContain(url);
    expect(mailer.sent[0]?.text).toContain('https://tailscale.com/download');
    expect(mailer.sent[0]?.text).toContain('«hub-main»');
    expect(mailer.sent[0]?.text).toContain(lead.displayName);

    const friend = device('100.64.0.2');
    await friend.get(`/auth/invites/${tokenOf(url)}`).expect(200);
    const accepted = await friend
      .post(`/auth/invites/${tokenOf(url)}/accept`, {
        displayName: 'Friend',
        password: FRIEND_PASSWORD,
        locale: 'en',
      })
      .expect(201);
    const cookies = setCookies(accepted);
    expect(cookies.map((line) => line.split('=')[0]).sort()).toEqual([
      'hub_access',
      'hub_refresh',
      'hub_session',
    ]);
    for (const line of cookies) expect(line).toMatch(/; Secure/);
    for (const line of cookies) expect(line).toMatch(/; HttpOnly/);
    for (const line of cookies) expect(line).toMatch(/; SameSite=Lax/);
    expect(cookies.find((line) => line.startsWith('hub_refresh='))).toContain('Path=/api/v1/auth/refresh');
    // Nothing the API answers points at the bind address.
    expect(JSON.stringify(accepted.body)).not.toMatch(/127\.0\.0\.1|localhost/);

    const me = await friend.get('/auth/me').expect(200);
    expect(me.body.data.workspaces).toHaveLength(1);
    expect(me.body.data.workspaces[0].roles).toEqual(['backend', 'qa']);
    await friend.get(`/workspaces/${workspace.slug}`).expect(200);
    await friend.post('/auth/refresh').expect(200);

    await friend.post('/auth/sign-out').expect(204);
    await friend.get('/auth/me').expect(401);
    const again = await friend
      .post('/auth/sign-in', { email: 'friend@example.test', password: FRIEND_PASSWORD })
      .expect(200);
    expect(again.body.data.totpRequired).toBe(false);
    for (const line of setCookies(again)) expect(line).toMatch(/; Secure/);
    await friend.get(`/workspaces/${workspace.slug}`).expect(200);

    const used = await device('100.64.0.3')
      .get(`/auth/invites/${tokenOf(url)}`)
      .expect(409);
    expect(used.body.error.code).toBe('hub.identity.invite_accepted');
    const attempts = await db().loginAttempt.findMany({ where: { email: 'friend@example.test' } });
    expect(attempts.map((row) => row.ip)).toEqual(['100.64.0.2']);
  });

  it('the page’s rule is the API’s: under 12 characters is refused, and nothing is created', async () => {
    const { workspace, owner } = await aProject();
    const created = await owner
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'short@example.test', roles: ['qa'] })
      .expect(201);
    const token = tokenOf(created.body.data.url as string);
    const weak = await device('100.64.0.2')
      .post(`/auth/invites/${token}/accept`, { displayName: 'Short', password: 'elevenchars' })
      .expect(400);
    expect(weak.body.error.code).toBe('hub.identity.password_weak');
    expect(await db().user.count({ where: { email: 'short@example.test' } })).toBe(0);
    await device('100.64.0.2').get(`/auth/invites/${token}`).expect(200);
  });

  it('with TOTP required, the friend enrols after joining, then signs in later through the code step', async () => {
    const { workspace, owner } = await aProject(['backend']);
    const created = await owner
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'careful@example.test', roles: ['backend'] })
      .expect(201);
    const friend = device('100.64.0.4');
    await friend
      .post(`/auth/invites/${tokenOf(created.body.data.url as string)}/accept`, {
        displayName: 'Careful',
        password: FRIEND_PASSWORD,
      })
      .expect(201);
    const gate = await friend.get(`/workspaces/${workspace.slug}`).expect(403);
    expect(gate.body.error.code).toBe('hub.identity.totp_setup_required');

    const setup = await friend.post('/auth/totp/setup').expect(201);
    const secret = setup.body.data.secret as string;
    await friend.post('/auth/totp/confirm', { code: totpCode(secret, clock) }).expect(200);
    await friend.get(`/workspaces/${workspace.slug}`).expect(200);

    await friend.post('/auth/sign-out').expect(204);
    clock.advance(60_000);
    const first = await friend
      .post('/auth/sign-in', { email: 'careful@example.test', password: FRIEND_PASSWORD })
      .expect(200);
    expect(first.body.data.totpRequired).toBe(true);
    expect(setCookies(first)).toEqual([]);
    const verified = await friend
      .post('/auth/totp/verify', { challenge: first.body.data.challenge, code: totpCode(secret, clock) })
      .expect(200);
    for (const line of setCookies(verified)) expect(line).toMatch(/; Secure/);
    await friend.get(`/workspaces/${workspace.slug}`).expect(200);
  });

  it('the owner’s own browser cannot take the friend’s invite: it says so and creates nothing', async () => {
    const { workspace, owner } = await aProject();
    const created = await owner
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'friend@example.test', roles: ['qa'] })
      .expect(201);
    const token = tokenOf(created.body.data.url as string);
    const refused = await owner
      .post(`/auth/invites/${token}/accept`, { displayName: 'Friend', password: FRIEND_PASSWORD })
      .expect(409);
    expect(refused.body.error.code).toBe('hub.identity.invite_other_account');
    expect(await db().user.count({ where: { email: 'friend@example.test' } })).toBe(0);
    // The link still works for the friend.
    await device('100.64.0.2').get(`/auth/invites/${token}`).expect(200);
  });

  it('a new link replaces the old; expired renews; revoked and used refuse; every status shows in the list', async () => {
    const { workspace, owner } = await aProject();
    const path = `/workspaces/${workspace.slug}/invites`;
    const status = async (id: string) =>
      ((await owner.get(path).expect(200)).body.data as { id: string; status: string }[]).find(
        (row) => row.id === id,
      )?.status;
    const pending = async () =>
      (await owner.get(`/workspaces/${workspace.slug}/counters`).expect(200)).body.data
        .invitesPending as number;

    const first = await owner.post(path, { email: 'a@example.test', roles: ['qa'] }).expect(201);
    const id = first.body.data.id as string;
    const renewed = await owner.post(`${path}/${id}/resend`).expect(200);
    expect(renewed.body.data).toEqual({
      url: expect.any(String),
      expiresAt: expect.any(String),
      mail: 'off',
    });
    expect(tokenOf(renewed.body.data.url as string)).not.toBe(tokenOf(first.body.data.url as string));
    const stale = await device('100.64.0.2')
      .get(`/auth/invites/${tokenOf(first.body.data.url as string)}`)
      .expect(404);
    expect(stale.body.error.code).toBe('hub.identity.invite_invalid');
    expect(await status(id)).toBe('pending');
    expect(await pending()).toBe(1);

    clock.advance(8 * 86_400_000);
    // A week later the owner's 15-minute access cookie is long gone; the page refreshes it, as here.
    await owner.post('/auth/refresh').expect(200);
    const expired = await device('100.64.0.2')
      .get(`/auth/invites/${tokenOf(renewed.body.data.url as string)}`)
      .expect(410);
    expect(expired.body.error.code).toBe('hub.identity.invite_expired');
    expect(await status(id)).toBe('expired');
    expect(await pending()).toBe(0);
    const fresh = await owner.post(`${path}/${id}/resend`).expect(200);
    await device('100.64.0.2')
      .get(`/auth/invites/${tokenOf(fresh.body.data.url as string)}`)
      .expect(200);
    expect(await status(id)).toBe('pending');

    await owner.delete(`${path}/${id}`).expect(204);
    const revoked = await device('100.64.0.2')
      .get(`/auth/invites/${tokenOf(fresh.body.data.url as string)}`)
      .expect(410);
    expect(revoked.body.error.code).toBe('hub.identity.invite_revoked');
    expect(await status(id)).toBe('revoked');
    expect(await pending()).toBe(0);
    expect((await owner.post(`${path}/${id}/resend`).expect(410)).body.error.code).toBe(
      'hub.identity.invite_revoked',
    );
    await owner.delete(`${path}/${id}`).expect(404);
    // Hub never deletes: the row stays, marked.
    const row = await db().invite.findUniqueOrThrow({ where: { id } });
    expect(row.revokedAt).not.toBeNull();

    // The same address may be invited again, and that one is used.
    const second = await owner.post(path, { email: 'a@example.test', roles: ['qa'] }).expect(201);
    await device('100.64.0.5')
      .post(`/auth/invites/${tokenOf(second.body.data.url as string)}/accept`, {
        displayName: 'A',
        password: FRIEND_PASSWORD,
      })
      .expect(201);
    expect(await status(second.body.data.id as string)).toBe('accepted');
    expect(
      (await owner.post(`${path}/${second.body.data.id as string}/resend`).expect(409)).body.error.code,
    ).toBe('hub.identity.invite_accepted');
    const audit = await db().auditLog.findMany({
      where: { workspaceId: workspace.id, action: { startsWith: 'identity.invite.' } },
      orderBy: { id: 'asc' },
      select: { action: true },
    });
    expect(audit.map((entry) => entry.action)).toEqual([
      'identity.invite.create',
      'identity.invite.resend',
      'identity.invite.resend',
      'identity.invite.revoke',
      'identity.invite.create',
      'identity.invite.accept',
    ]);
  });

  it('each device keeps its own sign-in limit and lockout behind the proxy', async () => {
    const { lead } = await aProject();
    const noisy = device('100.64.0.66');
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await noisy
        .post('/auth/sign-in', { email: `nobody-${attempt}@example.test`, password: 'wrong password!' })
        .expect(401);
    }
    const blocked = await noisy.post('/auth/sign-in', { email: lead.email, password: PASSWORD });
    expect([423, 429]).toContain(blocked.status);
    // Another device on the tailnet is not held back by the first one's mistakes.
    await device('100.64.0.67').signIn(lead.email);
    const rows = await db().loginAttempt.findMany({ where: { email: lead.email, succeeded: true } });
    expect(rows.map((row) => row.ip)).toContain('100.64.0.67');
  });
});
