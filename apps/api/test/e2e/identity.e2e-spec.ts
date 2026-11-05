/**
 * @file H0-03 acceptance on real cookies and tokens: sign-in, lockout, refresh, sign-out, passwords, sessions,
 * TOTP and its enforcement, API tokens and how far each kind reaches.
 */
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { FakeClock } from '@/infra/clock/clock';

import { aWorkspace } from '../factories';
import { anAccount, aToken, Browser, join, PASSWORD, totpCode } from '../helpers/auth';
import { createTestApp, type RecordingMailer } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

const MINUTE = 60_000;

describe('identity', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let mailer: RecordingMailer;
  const browser = () => new Browser(app);
  const http = () => request(app.getHttpServer() as Server);
  const db = () => maintenanceClients().prisma;

  beforeAll(async () => {
    ({ app, clock, mailer } = await createTestApp({ realAuth: true }));
  });

  beforeEach(() => {
    clock.set(new Date('2026-11-05T09:00:00.000Z'));
    mailer.sent.length = 0;
  });

  /** Enrols the browser's member and returns the secret and recovery codes. */
  async function enrol(user: Browser) {
    const setup = await user.post('/auth/totp/setup').expect(201);
    const secret = setup.body.data.secret as string;
    const confirmed = await user.post('/auth/totp/confirm', { code: totpCode(secret, clock) }).expect(200);
    return { secret, recoveryCodes: confirmed.body.data.recoveryCodes as string[] };
  }

  describe('sign-in', () => {
    it('sets HttpOnly SameSite=Lax cookies, and the refresh cookie reaches only its route', async () => {
      const account = await anAccount(db());
      const response = await browser().signIn(account.email);
      expect(response.body.data.totpRequired).toBe(false);
      expect(response.body.data.user.email).toBe(account.email);
      const cookies = response.headers['set-cookie'] as unknown as string[];
      const access = cookies.find((line) => line.startsWith('hub_access=')) ?? '';
      const refresh = cookies.find((line) => line.startsWith('hub_refresh=')) ?? '';
      for (const line of [access, refresh]) {
        expect(line).toContain('HttpOnly');
        expect(line).toContain('SameSite=Lax');
      }
      expect(access).toContain('Path=/;');
      expect(refresh).toContain('Path=/api/v1/auth/refresh');
    });

    it('accepts the email in any case, records the attempt and the audit row', async () => {
      const account = await anAccount(db());
      await browser().signIn(account.email.toUpperCase());
      expect(await db().loginAttempt.count({ where: { email: account.email, succeeded: true } })).toBe(1);
      const audit = await db().auditLog.findMany({
        where: { actorId: account.id, action: 'identity.sign_in' },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.workspaceId).toBeNull();
    });

    it('a wrong password and an unknown email answer the same', async () => {
      const account = await anAccount(db());
      const wrong = await browser()
        .post('/auth/sign-in', { email: account.email, password: 'wrong wrong wrong' })
        .expect(401);
      const unknown = await browser()
        .post('/auth/sign-in', { email: 'nobody@example.test', password: 'wrong wrong wrong' })
        .expect(401);
      expect(wrong.body.error.code).toBe('hub.identity.invalid_credentials');
      expect(unknown.body.error.code).toBe(wrong.body.error.code);
      expect(unknown.body.error.message).toBe(wrong.body.error.message);
    });

    it('a disabled account answers 403 only after the right password', async () => {
      const account = await anAccount(db(), { status: 'disabled' });
      const response = await browser()
        .post('/auth/sign-in', { email: account.email, password: PASSWORD })
        .expect(403);
      expect(response.body.error.code).toBe('hub.identity.account_disabled');
      await browser()
        .post('/auth/sign-in', { email: account.email, password: 'wrong wrong wrong' })
        .expect(401);
    });

    it('a body failing the schema is a 400', async () => {
      const response = await browser().post('/auth/sign-in', { email: 'not-an-email' }).expect(400);
      expect(response.body.error.code).toBe('hub.common.validation');
    });
  });

  describe('lockout', () => {
    it('10 failures lock the email for 15 minutes, even for the right password', async () => {
      const account = await anAccount(db());
      const { redis } = maintenanceClients();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await browser()
          .post('/auth/sign-in', { email: account.email, password: 'wrong wrong wrong' })
          .expect(401);
      }
      await redis.flushdb(); // Past the rate limit, which would answer first.
      const locked = await browser()
        .post('/auth/sign-in', { email: account.email, password: PASSWORD })
        .expect(423);
      expect(locked.body.error.code).toBe('hub.identity.locked');
      expect(locked.body.error.details.retryAfterSec).toBe(900);
      expect(locked.headers['retry-after']).toBe('900');

      clock.advance(14 * MINUTE);
      await browser().post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(423);
      clock.advance(MINUTE);
      await browser().signIn(account.email);
    });

    it('10 failures from one IP lock it across different emails', async () => {
      const account = await anAccount(db());
      const { redis } = maintenanceClients();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await browser()
          .post('/auth/sign-in', { email: `other-${attempt}@example.test`, password: 'wrong wrong wrong' })
          .expect(401);
      }
      await redis.flushdb();
      await browser().post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(423);
    });

    it('wrong TOTP codes count too', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const { secret } = await enrol(user);
      const { redis } = maintenanceClients();
      const { body } = await browser().signIn(account.email);
      const wrong = totpCode(secret, clock) === '000000' ? '000001' : '000000';
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await browser()
          .post('/auth/totp/verify', { challenge: body.data.challenge, code: wrong })
          .expect(401);
      }
      await redis.flushdb();
      await browser()
        .post('/auth/totp/verify', { challenge: body.data.challenge, code: totpCode(secret, clock) })
        .expect(423);
    });
  });

  describe('session', () => {
    it('no credentials answer unauthorized, an expired access cookie session_expired', async () => {
      const none = await browser().get('/auth/me').expect(401);
      expect(none.body.error.code).toBe('hub.common.unauthorized');
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      await user.get('/auth/me').expect(200);
      clock.advance(16 * MINUTE);
      const expired = await user.get('/auth/me').expect(401);
      expect(expired.body.error.code).toBe('hub.identity.session_expired');
    });

    it('a garbage access cookie is session_expired', async () => {
      const user = browser();
      user.setCookie('hub_access', 'garbage');
      const response = await user.get('/auth/me').expect(401);
      expect(response.body.error.code).toBe('hub.identity.session_expired');
    });

    it('a TOTP challenge cannot stand in for an access token', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      await enrol(user);
      const { body } = await browser().signIn(account.email);
      const forged = browser();
      forged.setCookie('hub_access', body.data.challenge as string);
      await forged.get('/auth/me').expect(401);
    });

    it('a cookie mutation without the CSRF header is refused; a read is not', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const access = user.cookie('hub_access') as string;
      const refused = await http()
        .post('/api/v1/auth/sign-out')
        .set('Cookie', `hub_access=${access}`)
        .expect(403);
      expect(refused.body.error.code).toBe('hub.common.forbidden');
      await http().get('/api/v1/auth/me').set('Cookie', `hub_access=${access}`).expect(200);
    });

    it('refresh rotates both cookies, and the new access token works', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const before = user.cookie('hub_refresh');
      clock.advance(16 * MINUTE);
      const refreshed = await user.post('/auth/refresh').expect(200);
      expect(refreshed.body.data.expiresAt).toEqual(expect.any(String));
      expect(user.cookie('hub_refresh')).not.toBe(before);
      await user.get('/auth/me').expect(200);
      const rows = await db().session.findMany({
        where: { userId: account.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.replacedById).toBe(rows[1]?.id);
      expect(rows[0]?.familyId).toBe(rows[1]?.familyId);
    });

    it('reusing a rotated refresh token revokes the whole family', async () => {
      const account = await anAccount(db());
      const victim = browser();
      await victim.signIn(account.email);
      const stolen = victim.cookie('hub_refresh') as string;
      await victim.post('/auth/refresh').expect(200);

      const thief = browser();
      thief.setCookie('hub_refresh', stolen, '/api/v1/auth/refresh');
      const reuse = await thief.post('/auth/refresh').expect(401);
      expect(reuse.body.error.code).toBe('hub.identity.refresh_invalid');

      const after = await victim.post('/auth/refresh').expect(401);
      expect(after.body.error.code).toBe('hub.identity.refresh_invalid');
      await victim.get('/auth/me').expect(401);
      expect(await db().session.count({ where: { userId: account.id, revokedAt: null } })).toBe(0);
    });

    it('refresh refuses a missing, unknown or expired token and a request without the CSRF header', async () => {
      const missing = await browser().post('/auth/refresh').expect(401);
      expect(missing.body.error.code).toBe('hub.identity.refresh_invalid');
      const unknown = browser();
      unknown.setCookie('hub_refresh', 'nope', '/api/v1/auth/refresh');
      await unknown.post('/auth/refresh').expect(401);

      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const token = user.cookie('hub_refresh') as string;
      await http().post('/api/v1/auth/refresh').set('Cookie', `hub_refresh=${token}`).expect(403);
      clock.advance(31 * 24 * 60 * MINUTE);
      await user.post('/auth/refresh').expect(401);
    });

    it('sign-out clears cookies and ends the session at once', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const access = user.cookie('hub_access') as string;
      const refresh = user.cookie('hub_refresh') as string;
      await user.post('/auth/sign-out').expect(204);
      expect(user.cookie('hub_access')).toBeUndefined();

      const stale = browser();
      stale.setCookie('hub_access', access);
      stale.setCookie('hub_refresh', refresh, '/api/v1/auth/refresh');
      await stale.get('/auth/me').expect(401);
      await stale.post('/auth/refresh').expect(401);
    });

    it('a disabled member is cut off on the next request', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      await db().user.update({ where: { id: account.id }, data: { status: 'disabled' } });
      const response = await user.get('/auth/me').expect(403);
      expect(response.body.error.code).toBe('hub.identity.account_disabled');
    });

    it('lists sessions, ends one, and ends all but the current', async () => {
      const account = await anAccount(db());
      const one = browser();
      const two = browser();
      const three = browser();
      await one.signIn(account.email);
      await two.signIn(account.email);
      await three.signIn(account.email);
      const listed = await one.get('/auth/sessions').expect(200);
      expect(listed.body.data).toHaveLength(3);
      const rows = listed.body.data as { familyId: string; current: boolean }[];
      expect(rows.filter((row) => row.current)).toHaveLength(1);

      const otherFamily = rows.find((row) => !row.current)?.familyId as string;
      await one.delete(`/auth/sessions/${otherFamily}`).expect(204);
      await one.delete(`/auth/sessions/${otherFamily}`).expect(404);
      expect((await one.get('/auth/sessions').expect(200)).body.data).toHaveLength(2);

      await one.post('/auth/sessions/revoke-all').expect(204);
      await one.get('/auth/me').expect(200);
      expect((await one.get('/auth/sessions').expect(200)).body.data).toHaveLength(1);
    });

    it('one member cannot end the session of another', async () => {
      const first = await anAccount(db());
      const second = await anAccount(db());
      const a = browser();
      const b = browser();
      await a.signIn(first.email);
      await b.signIn(second.email);
      const family = (await b.get('/auth/sessions').expect(200)).body.data[0].familyId as string;
      await a.delete(`/auth/sessions/${family}`).expect(404);
      await b.get('/auth/me').expect(200);
    });
  });

  describe('passwords', () => {
    it('forgot answers 202 either way and mails only a real account', async () => {
      const account = await anAccount(db());
      await browser().post('/auth/password/forgot', { email: 'nobody@example.test' }).expect(202);
      expect(mailer.sent).toHaveLength(0);
      await browser().post('/auth/password/forgot', { email: account.email }).expect(202);
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]?.to).toBe(account.email);
    });

    it('reset works once, ends sessions, and the stored token is only a hash', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      await browser().post('/auth/password/forgot', { email: account.email }).expect(202);
      const token = /\/reset\/(\S+)/.exec(mailer.sent[0]?.text ?? '')?.[1] as string;
      expect(await db().passwordReset.count({ where: { tokenHash: token } })).toBe(0);

      const weak = await browser().post('/auth/password/reset', { token, password: 'short' }).expect(400);
      expect(weak.body.error.code).toBe('hub.identity.password_weak');

      const next = 'another long enough passphrase';
      await browser().post('/auth/password/reset', { token, password: next }).expect(204);
      await user.get('/auth/me').expect(401);
      await browser().signIn(account.email, next);
      await browser().post('/auth/sign-in', { email: account.email, password: PASSWORD }).expect(401);

      const again = await browser().post('/auth/password/reset', { token, password: next }).expect(404);
      expect(again.body.error.code).toBe('hub.identity.reset_invalid');
    });

    it('a reset token dies after an hour, and an unknown one is 404', async () => {
      const account = await anAccount(db());
      await browser().post('/auth/password/forgot', { email: account.email }).expect(202);
      const token = /\/reset\/(\S+)/.exec(mailer.sent[0]?.text ?? '')?.[1] as string;
      clock.advance(61 * MINUTE);
      await browser()
        .post('/auth/password/reset', { token, password: 'another long enough passphrase' })
        .expect(404);
      await browser()
        .post('/auth/password/reset', { token: 'nope', password: 'another long enough passphrase' })
        .expect(404);
    });

    it('change checks the current password, the rule, and ends the other sessions only', async () => {
      const account = await anAccount(db());
      const here = browser();
      const elsewhere = browser();
      await here.signIn(account.email);
      await elsewhere.signIn(account.email);
      const next = 'another long enough passphrase';
      const wrong = await here
        .post('/auth/password/change', { current: 'wrong wrong wrong', next })
        .expect(401);
      expect(wrong.body.error.code).toBe('hub.identity.invalid_credentials');
      const weak = await here
        .post('/auth/password/change', { current: PASSWORD, next: 'password1234' })
        .expect(400);
      expect(weak.body.error.code).toBe('hub.identity.password_weak');
      await here.post('/auth/password/change', { current: PASSWORD, next }).expect(204);
      await here.get('/auth/me').expect(200);
      await elsewhere.get('/auth/me').expect(401);
    });
  });

  describe('TOTP', () => {
    it('enrols, then a sign-in needs a code, sets no cookie before it, and a code works once', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const { secret, recoveryCodes } = await enrol(user);
      expect(recoveryCodes).toHaveLength(8);

      const stored = await db().user.findUniqueOrThrow({ where: { id: account.id } });
      expect(stored.totpSecretEnc).not.toContain(secret);
      expect(stored.totpRecoveryCodes).toHaveLength(8);
      expect(stored.totpRecoveryCodes).not.toContain(recoveryCodes[0]);

      const next = browser();
      const first = await next.signIn(account.email);
      expect(first.body.data.totpRequired).toBe(true);
      expect(first.body.data.user).toBeUndefined();
      expect(next.cookie('hub_access')).toBeUndefined();

      const challenge = first.body.data.challenge as string;
      clock.advance(MINUTE);
      const code = totpCode(secret, clock);
      const done = await next.post('/auth/totp/verify', { challenge, code }).expect(200);
      expect(done.body.data.user.totpEnabled).toBe(true);
      await next.get('/auth/me').expect(200);

      const replay = await browser().post('/auth/totp/verify', { challenge, code }).expect(401);
      expect(replay.body.error.code).toBe('hub.identity.totp_invalid');
    });

    it('refuses a wrong code and an expired challenge', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const { secret } = await enrol(user);
      const { body } = await browser().signIn(account.email);
      const challenge = body.data.challenge as string;
      const right = totpCode(secret, clock);
      const wrong = right === '000000' ? '000001' : '000000';
      const refused = await browser().post('/auth/totp/verify', { challenge, code: wrong }).expect(401);
      expect(refused.body.error.code).toBe('hub.identity.totp_invalid');
      clock.advance(6 * MINUTE);
      await browser()
        .post('/auth/totp/verify', { challenge, code: totpCode(secret, clock) })
        .expect(401);
    });

    it('a recovery code signs in once', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const { recoveryCodes } = await enrol(user);
      const code = recoveryCodes[0] as string;
      const { body } = await browser().signIn(account.email);
      const challenge = body.data.challenge as string;
      const next = browser();
      await next.post('/auth/totp/recover', { challenge, recoveryCode: code.toLowerCase() }).expect(200);
      await next.get('/auth/me').expect(200);
      const stored = await db().user.findUniqueOrThrow({ where: { id: account.id } });
      expect(stored.totpRecoveryCodes).toHaveLength(7);
      const again = await browser().post('/auth/totp/recover', { challenge, recoveryCode: code }).expect(401);
      expect(again.body.error.code).toBe('hub.identity.totp_invalid');
    });

    it('setup and confirm answer their state errors', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const early = await user.post('/auth/totp/confirm', { code: '123456' }).expect(409);
      expect(early.body.error.code).toBe('hub.identity.totp_not_enabled');
      const setup = await user.post('/auth/totp/setup').expect(201);
      expect(setup.body.data.otpauthUrl).toContain('otpauth://totp/');
      expect(setup.body.data.qrDataUrl).toContain('data:image/png;base64,');
      const secret = setup.body.data.secret as string;
      const right = totpCode(secret, clock);
      const wrong = await user
        .post('/auth/totp/confirm', { code: right === '000000' ? '000001' : '000000' })
        .expect(401);
      expect(wrong.body.error.code).toBe('hub.identity.totp_invalid');
      await user.post('/auth/totp/confirm', { code: right }).expect(200);
      const again = await user.post('/auth/totp/setup').expect(409);
      expect(again.body.error.code).toBe('hub.identity.totp_already_enabled');
    });

    it('turning it off needs a code, and is refused while a role requires it', async () => {
      const workspace = await aWorkspace(db());
      const account = await anAccount(db());
      await join(db(), workspace.id, account.id, ['backend']);
      const user = browser();
      await user.signIn(account.email);
      const off = await user.delete('/auth/totp', { code: '123456' }).expect(409);
      expect(off.body.error.code).toBe('hub.identity.totp_not_enabled');

      const { secret } = await enrol(user);
      await db().membership.updateMany({ where: { userId: account.id }, data: { roles: ['pm'] } });
      clock.advance(MINUTE);
      const required = await user.delete('/auth/totp', { code: totpCode(secret, clock) }).expect(403);
      expect(required.body.error.code).toBe('hub.identity.totp_setup_required');

      await db().membership.updateMany({ where: { userId: account.id }, data: { roles: ['backend'] } });
      await user.delete('/auth/totp', { code: totpCode(secret, clock) }).expect(204);
      const stored = await db().user.findUniqueOrThrow({ where: { id: account.id } });
      expect(stored.totpSecretEnc).toBeNull();
      expect(stored.totpEnabledAt).toBeNull();
    });

    it('a role in totp_required_roles cannot use project routes until enrolled, by session or token', async () => {
      const workspace = await aWorkspace(db());
      const account = await anAccount(db());
      await join(db(), workspace.id, account.id, ['owner']);
      const user = browser();
      await user.signIn(account.email);
      const me = await user.get('/auth/me').expect(200);
      expect(me.body.data.workspaces[0].totpRequired).toBe(true);

      const blocked = await user.get(`/workspaces/${workspace.slug}`).expect(403);
      expect(blocked.body.error.code).toBe('hub.identity.totp_setup_required');
      const { token } = await aToken(db(), account.id);
      const byToken = await http()
        .get(`/api/v1/workspaces/${workspace.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(byToken.body.error.code).toBe('hub.identity.totp_setup_required');

      await enrol(user);
      await user.get(`/workspaces/${workspace.slug}`).expect(200);
    });

    it('a role outside the list needs no enrolment, and the setting decides per project', async () => {
      const workspace = await aWorkspace(db());
      const account = await anAccount(db());
      await join(db(), workspace.id, account.id, ['backend']);
      const user = browser();
      await user.signIn(account.email);
      await user.get(`/workspaces/${workspace.slug}`).expect(200);
      await db().workspaceSetting.create({
        data: { workspaceId: workspace.id, key: 'security.totp_required_roles', value: ['backend'] },
      });
      await user.get(`/workspaces/${workspace.slug}`).expect(403);
    });
  });

  describe('API tokens', () => {
    it('are shown once, listed without their value, and belong to no project', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const created = await user.post('/me/tokens', { name: 'Laptop', kind: 'mcp' }).expect(201);
      const token = created.body.data.token as string;
      expect(token).toMatch(/^hub_[a-f0-9]{8}_[a-f0-9]{80}$/);
      const listed = await user.get('/me/tokens').expect(200);
      expect(JSON.stringify(listed.body)).not.toContain(token);
      expect(JSON.stringify(listed.body)).not.toContain('tokenHash');
      expect(listed.body.data[0].prefix).toBe(token.slice(0, 12));
      const row = await db().apiToken.findUniqueOrThrow({ where: { id: created.body.data.id } });
      expect(row.tokenHash).not.toContain(token);
      expect(row).not.toHaveProperty('workspaceId');
    });

    it('a bearer token signs in as the member; a revoked one stops at once', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const created = await user.post('/me/tokens', { name: 'Laptop' }).expect(201);
      const header = `Bearer ${created.body.data.token as string}`;
      const me = await http().get('/api/v1/auth/me').set('Authorization', header).expect(200);
      expect(me.body.data.id).toBe(account.id);
      await user.delete(`/me/tokens/${created.body.data.id as string}`).expect(204);
      const revoked = await http().get('/api/v1/auth/me').set('Authorization', header).expect(401);
      expect(revoked.body.error.code).toBe('hub.identity.token_revoked');
      await user.delete(`/me/tokens/${created.body.data.id as string}`).expect(404);
    });

    it('refuses a malformed or unknown token', async () => {
      for (const header of ['Bearer nope', 'Basic abc', `Bearer hub_abcdef12_${'0'.repeat(80)}`]) {
        const response = await http().get('/api/v1/auth/me').set('Authorization', header).expect(401);
        expect(response.body.error.code).toBe('hub.identity.token_invalid');
      }
    });

    it('a token of a disabled member is refused', async () => {
      const account = await anAccount(db(), { status: 'disabled' });
      const { token } = await aToken(db(), account.id);
      const response = await http()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(response.body.error.code).toBe('hub.identity.account_disabled');
    });

    it('a member cannot revoke a token of someone else', async () => {
      const other = await anAccount(db());
      const { id } = await aToken(db(), other.id);
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      await user.delete(`/me/tokens/${id}`).expect(404);
    });

    it('a hook token reaches only capture and /me', async () => {
      const workspace = await aWorkspace(db());
      const account = await anAccount(db());
      await join(db(), workspace.id, account.id, ['backend']);
      const { token } = await aToken(db(), account.id, 'hook');
      const header = `Bearer ${token}`;
      await http().get('/api/v1/auth/me').set('Authorization', header).expect(200);
      for (const path of [
        `/workspaces/${workspace.slug}/cards`,
        `/workspaces/${workspace.slug}`,
        '/workspaces',
      ]) {
        const response = await http().get(`/api/v1${path}`).set('Authorization', header).expect(403);
        expect(response.body.error.code).toBe('hub.identity.token_scope');
      }
    });

    it('an MCP token cannot manage tokens, passwords, TOTP or the profile (D27 limits)', async () => {
      const account = await anAccount(db());
      const { token } = await aToken(db(), account.id);
      const header = `Bearer ${token}`;
      const refused = [
        () => http().post('/api/v1/me/tokens').send({ name: 'x' }),
        () => http().get('/api/v1/me/tokens'),
        () => http().patch('/api/v1/me').send({ displayName: 'x' }),
        () => http().post('/api/v1/auth/totp/setup'),
        () => http().post('/api/v1/auth/password/change').send({ current: PASSWORD, next: PASSWORD }),
        () => http().post('/api/v1/auth/sign-out'),
      ];
      for (const test of refused) {
        const response = await test().set('Authorization', header).expect(403);
        expect(response.body.error.code).toBe('hub.identity.token_scope');
      }
    });

    it('roles resolve live: a role taken away affects the token on its next call', async () => {
      const workspace = await aWorkspace(db());
      const account = await anAccount(db());
      await join(db(), workspace.id, account.id, ['backend']);
      await db().workspaceSetting.create({
        data: { workspaceId: workspace.id, key: 'security.totp_required_roles', value: [] },
      });
      await db().membership.updateMany({ where: { userId: account.id }, data: { roles: ['pm'] } });
      const { token } = await aToken(db(), account.id);
      const path = `/api/v1/workspaces/${workspace.slug}/invites`;
      await http().get(path).set('Authorization', `Bearer ${token}`).expect(200);
      await db().membership.updateMany({ where: { userId: account.id }, data: { roles: ['backend'] } });
      await http().get(path).set('Authorization', `Bearer ${token}`).expect(403);
      await db().membership.updateMany({ where: { userId: account.id }, data: { status: 'removed' } });
      const gone = await http().get(path).set('Authorization', `Bearer ${token}`).expect(404);
      expect(gone.body.error.code).toBe('hub.workspaces.not_found');
    });

    it('lastUsedAt moves at most once a minute', async () => {
      const account = await anAccount(db());
      const { id, token } = await aToken(db(), account.id);
      const call = () => http().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      await call();
      const first = await db().apiToken.findUniqueOrThrow({ where: { id } });
      expect(first.lastUsedAt).toEqual(clock.now());
      clock.advance(30_000);
      await call();
      expect((await db().apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(first.lastUsedAt);
      clock.advance(31_000);
      await call();
      expect((await db().apiToken.findUniqueOrThrow({ where: { id } })).lastUsedAt).toEqual(clock.now());
    });

    it('a pasted token is refused as a name (secret filter)', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const token = `hub_abcdef12_${'a'.repeat(30)}`;
      const response = await user.post('/me/tokens', { name: token }).expect(422);
      expect(response.body.error.code).toBe('hub.security.secret_detected');
      expect(JSON.stringify(response.body)).not.toContain(token);
    });
  });

  describe('profile', () => {
    it('PATCH /me changes the profile and refuses an unknown colour', async () => {
      const account = await anAccount(db());
      const user = browser();
      await user.signIn(account.email);
      const updated = await user.patch('/me', { displayName: 'New name', locale: 'ar' }).expect(200);
      expect(updated.body.data.displayName).toBe('New name');
      expect(updated.body.data.locale).toBe('ar');
      await user.patch('/me', { avatarColor: 'plaid' }).expect(400);
    });

    it('no response carries a hash', async () => {
      const account = await anAccount(db());
      const user = browser();
      const signedIn = await user.signIn(account.email);
      const me = await user.get('/auth/me').expect(200);
      for (const body of [signedIn.body, me.body]) {
        expect(JSON.stringify(body)).not.toMatch(/passwordHash|totpSecret|tokenHash|RecoveryCodes/);
      }
    });
  });
});
