/**
 * @file Invites on real cookies, and the first owner seed (docs/15 §9).
 */
import type { INestApplication } from '@nestjs/common';

import type { FakeClock } from '@/infra/clock/clock';
import { OwnerSeed } from '@/modules/identity';

import { aWorkspace } from '../factories';
import { anAccount, Browser, join, PASSWORD } from '../helpers/auth';
import { createTestApp, type RecordingMailer } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

describe('invites and seed', () => {
  let app: INestApplication;
  let clock: FakeClock;
  let mailer: RecordingMailer;
  const browser = () => new Browser(app);
  const db = () => maintenanceClients().prisma;

  beforeAll(async () => {
    ({ app, clock, mailer } = await createTestApp({ realAuth: true }));
  });

  beforeEach(() => {
    clock.set(new Date('2026-11-05T09:00:00.000Z'));
    mailer.sent.length = 0;
  });

  /** A project with a signed-in pm who needs no TOTP, so the test stays on invites. */
  async function aProject(roles: ('pm' | 'owner' | 'backend')[] = ['pm']) {
    const workspace = await aWorkspace(db());
    await db().workspaceSetting.create({
      data: { workspaceId: workspace.id, key: 'security.totp_required_roles', value: [] },
    });
    const lead = await anAccount(db());
    await join(db(), workspace.id, lead.id, roles);
    const user = browser();
    await user.signIn(lead.email);
    return { workspace, lead, user };
  }

  const tokenOf = (url: string) => /\/invite\/(\S+)/.exec(url)?.[1] as string;

  it('create shows the link once, mails it, and stores only a hash', async () => {
    const { workspace, user } = await aProject();
    const created = await user
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'New@Example.test', roles: ['backend'] })
      .expect(201);
    const { url, email } = created.body.data as { url: string; email: string };
    expect(email).toBe('new@example.test');
    expect(url).toContain('/ar/invite/');
    expect(mailer.sent[0]?.to).toBe('new@example.test');
    expect(mailer.sent[0]?.text).toContain(url);

    const stored = await db().invite.findFirstOrThrow({ where: { workspaceId: workspace.id } });
    expect(stored.tokenHash).not.toBe(tokenOf(url));
    const listed = await user.get(`/workspaces/${workspace.slug}/invites`).expect(200);
    expect(JSON.stringify(listed.body)).not.toContain(tokenOf(url));
    expect(listed.body.data[0].email).toBe('new@example.test');

    const audit = await db().auditLog.count({
      where: { workspaceId: workspace.id, action: 'identity.invite.create' },
    });
    expect(audit).toBe(1);
  });

  it('create answers its documented errors', async () => {
    const { workspace, user } = await aProject();
    const path = `/workspaces/${workspace.slug}/invites`;
    const role = await user.post(path, { email: 'a@example.test', roles: ['wizard'] }).expect(400);
    expect(role.body.error.code).toBe('hub.workspaces.role_invalid');
    const owner = await user.post(path, { email: 'a@example.test', roles: ['owner'] }).expect(403);
    expect(owner.body.error.code).toBe('hub.common.forbidden');

    await user.post(path, { email: 'a@example.test', roles: ['qa'] }).expect(201);
    const twice = await user.post(path, { email: 'a@example.test', roles: ['qa'] }).expect(409);
    expect(twice.body.error.code).toBe('hub.common.conflict');

    await db().workspace.update({ where: { id: workspace.id }, data: { status: 'closed' } });
    const closed = await user.post(path, { email: 'b@example.test', roles: ['qa'] }).expect(409);
    expect(closed.body.error.code).toBe('hub.workspaces.closed');
  });

  it('a member without the right is refused; a stranger sees not found', async () => {
    const { workspace } = await aProject();
    const qa = await anAccount(db());
    await join(db(), workspace.id, qa.id, ['qa']);
    const member = browser();
    await member.signIn(qa.email);
    await member.get(`/workspaces/${workspace.slug}/invites`).expect(403);
    const stranger = await anAccount(db());
    const other = browser();
    await other.signIn(stranger.email);
    const response = await other.get(`/workspaces/${workspace.slug}/invites`).expect(404);
    expect(response.body.error.code).toBe('hub.workspaces.not_found');
  });

  it('a new person previews, accepts, is signed in and in the project, and leads are told', async () => {
    const { workspace, lead, user } = await aProject();
    const created = await user
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'new@example.test', roles: ['backend'] })
      .expect(201);
    const token = tokenOf(created.body.data.url as string);

    const preview = await browser().get(`/auth/invites/${token}`).expect(200);
    expect(preview.body.data.workspace.slug).toBe(workspace.slug);
    expect(preview.body.data.roles).toEqual(['backend']);
    expect(preview.body.data.invitedBy).toBe(lead.displayName);

    const invited = browser();
    const missing = await invited.post(`/auth/invites/${token}/accept`, {}).expect(400);
    expect(missing.body.error.code).toBe('hub.common.validation');
    const weak = await invited
      .post(`/auth/invites/${token}/accept`, { displayName: 'New', password: 'short' })
      .expect(400);
    expect(weak.body.error.code).toBe('hub.identity.password_weak');

    const accepted = await invited
      .post(`/auth/invites/${token}/accept`, { displayName: 'New', password: PASSWORD, locale: 'en' })
      .expect(201);
    expect(accepted.body.data.workspace.slug).toBe(workspace.slug);
    expect(accepted.body.data.user.defaultProject).toBe(workspace.slug);
    const me = await invited.get('/auth/me').expect(200);
    expect(me.body.data.workspaces[0].roles).toEqual(['backend']);

    const inbox = await db().notification.findMany({ where: { workspaceId: workspace.id, userId: lead.id } });
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.kind).toBe('system');
    expect(inbox[0]?.title).toContain('New');

    const used = await browser().get(`/auth/invites/${token}`).expect(409);
    expect(used.body.error.code).toBe('hub.identity.invite_accepted');
  });

  it('an unknown or expired link answers its code', async () => {
    const unknown = await browser().get('/auth/invites/nope').expect(404);
    expect(unknown.body.error.code).toBe('hub.identity.invite_invalid');
    const { workspace, user } = await aProject();
    const created = await user
      .post(`/workspaces/${workspace.slug}/invites`, { email: 'new@example.test', roles: ['qa'] })
      .expect(201);
    clock.advance(8 * 86_400_000);
    const expired = await browser()
      .get(`/auth/invites/${tokenOf(created.body.data.url as string)}`)
      .expect(410);
    expect(expired.body.error.code).toBe('hub.identity.invite_expired');
  });

  it('an existing person must sign in first, then joins with the session', async () => {
    const { workspace, user } = await aProject();
    const existing = await anAccount(db());
    const created = await user
      .post(`/workspaces/${workspace.slug}/invites`, { email: existing.email, roles: ['qa'] })
      .expect(201);
    const token = tokenOf(created.body.data.url as string);

    const anonymous = await browser()
      .post(`/auth/invites/${token}/accept`, { displayName: 'X', password: PASSWORD })
      .expect(409);
    expect(anonymous.body.error.code).toBe('hub.identity.email_taken');

    const someoneElse = await anAccount(db());
    const wrong = browser();
    await wrong.signIn(someoneElse.email);
    const other = await wrong.post(`/auth/invites/${token}/accept`, {}).expect(409);
    expect(other.body.error.code).toBe('hub.identity.invite_other_account');

    const right = browser();
    await right.signIn(existing.email);
    const accepted = await right.post(`/auth/invites/${token}/accept`, {}).expect(201);
    expect(accepted.body.data.user.workspaces.map((row: { slug: string }) => row.slug)).toEqual([
      workspace.slug,
    ]);
  });

  it('a removed member can come back through an invite', async () => {
    const { workspace, user } = await aProject();
    const former = await anAccount(db());
    await db().membership.create({
      data: { workspaceId: workspace.id, userId: former.id, roles: ['qa'], status: 'removed' },
    });
    const created = await user
      .post(`/workspaces/${workspace.slug}/invites`, { email: former.email, roles: ['backend'] })
      .expect(201);
    const back = browser();
    await back.signIn(former.email);
    await back.post(`/auth/invites/${tokenOf(created.body.data.url as string)}/accept`, {}).expect(201);
    const row = await db().membership.findFirstOrThrow({ where: { userId: former.id } });
    expect(row.status).toBe('active');
    expect(row.roles).toEqual(['backend']);
  });

  it('resend replaces the link; revoke stops it and keeps the row', async () => {
    const { workspace, user } = await aProject();
    const path = `/workspaces/${workspace.slug}/invites`;
    const created = await user.post(path, { email: 'new@example.test', roles: ['qa'] }).expect(201);
    const id = created.body.data.id as string;
    const resent = await user.post(`${path}/${id}/resend`).expect(200);
    await browser()
      .get(`/auth/invites/${tokenOf(created.body.data.url as string)}`)
      .expect(404);
    const fresh = tokenOf(resent.body.data.url as string);
    await browser().get(`/auth/invites/${fresh}`).expect(200);
    expect(mailer.sent).toHaveLength(2);

    await user.delete(`${path}/${id}`).expect(204);
    const revoked = await browser().get(`/auth/invites/${fresh}`).expect(410);
    expect(revoked.body.error.code).toBe('hub.identity.invite_revoked');
    await user.delete(`${path}/${id}`).expect(404);
    await user.post(`${path}/${id}/resend`).expect(410);
    expect(await db().invite.count({ where: { id } })).toBe(1);
  });

  describe('owner seed', () => {
    const seed = () => app.get(OwnerSeed, { strict: false });
    const input = { email: 'Owner@Example.test', password: 'a generated long password', name: 'The Owner' };

    it('creates the owner in both projects with the three roles, who can work with no TOTP step (D34)', async () => {
      const result = await seed().run(input);
      expect(result.createdUser).toBe(true);
      expect(result.projects).toEqual(['goteav', 'hub']);
      const memberships = await db().membership.findMany({
        where: { userId: result.userId },
        include: { workspace: true },
      });
      expect(memberships.map((row) => row.workspace.keyPrefix).sort()).toEqual(['GTV', 'HUB']);
      for (const row of memberships) {
        expect(row.roles).toEqual(['owner', 'pm', 'accountant']);
        expect(row.workspace.timezone).toBe('Europe/Istanbul');
      }

      const owner = browser();
      const signedIn = await owner.signIn('owner@example.test', input.password);
      expect(signedIn.body.data.user.defaultProject).toBe('goteav');
      await owner.get('/workspaces/goteav').expect(200);
    });

    it('running again adds nothing and keeps the password', async () => {
      const first = await seed().run(input);
      const second = await seed().run({ ...input, password: 'a different long password' });
      expect(second.userId).toBe(first.userId);
      expect(second.createdUser).toBe(false);
      expect(await db().workspace.count()).toBe(2);
      await browser().signIn(input.email, input.password);
    });

    it('refuses a missing email or a weak password', async () => {
      await expect(seed().run({ email: undefined, password: 'x', name: undefined })).rejects.toThrow(
        'HUB_OWNER_EMAIL',
      );
      await expect(seed().run({ ...input, password: 'short' })).rejects.toThrow('HUB_OWNER_PASSWORD');
    });
  });
});
