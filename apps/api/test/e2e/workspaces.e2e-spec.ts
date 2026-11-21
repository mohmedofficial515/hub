/**
 * @file H0-04 acceptance: projects, members and the last-owner rule, settings, sources and their secrets,
 * GitHub identities, onboarding, and which project a chat lands on (docs/15 §5).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';

import type { Principal, Role } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { CardReader } from '@/modules/cards';
import { ActorService } from '@/modules/identity';
import { SettingsService, SourcesService } from '@/modules/workspaces';

import { aMember, aWorkspace } from '../factories';
import { aDecision } from '../setup/card-harness';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

describe('workspaces', () => {
  let app: INestApplication;
  const db = () => maintenanceClients().prisma;
  const http = () => request(app.getHttpServer() as Server);
  const as = (userId: string, kind?: 'agent') => {
    const add = (test: request.Test) => {
      void test.set('x-test-user', userId);
      if (kind) void test.set('x-test-kind', kind);
      return test;
    };
    return {
      get: (path: string) => add(http().get(`/api/v1${path}`)),
      post: (path: string, body?: object) => add(http().post(`/api/v1${path}`)).send(body),
      put: (path: string, body?: object) => add(http().put(`/api/v1${path}`)).send(body),
      patch: (path: string, body?: object) => add(http().patch(`/api/v1${path}`)).send(body),
      delete: (path: string) => add(http().delete(`/api/v1${path}`)),
    };
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  async function aProjectWith(roles: readonly Role[]) {
    const workspace = await aWorkspace(db());
    const member = await aMember(db(), workspace.id, roles);
    return { workspace, member, ws: `/workspaces/${workspace.slug}` };
  }

  describe('projects', () => {
    const input = {
      slug: 'test-project',
      name: 'Test',
      keyPrefix: 'TST',
      description: '# About',
      goals: 'Ship',
      links: [{ label: 'Docs', url: 'https://example.test/docs' }],
      repoPaths: ['F:/Goteav/hub'],
    };

    it('any member creates one and becomes its owner, with default settings and an audit row', async () => {
      const { member } = await aProjectWith(['qa']);
      const created = await as(member.id).post('/workspaces', input).expect(201);
      expect(created.body.data).toMatchObject({
        slug: 'test-project',
        keyPrefix: 'TST',
        description: '# About',
        goals: 'Ship',
        links: input.links,
        repoPaths: input.repoPaths,
        status: 'active',
        timezone: 'Europe/Istanbul',
      });
      const id = created.body.data.id as string;
      const membership = await db().membership.findUniqueOrThrow({
        where: { workspaceId_userId: { workspaceId: id, userId: member.id } },
      });
      expect(membership.roles).toEqual(['owner']);
      expect(await db().auditLog.count({ where: { workspaceId: id, action: 'workspaces.create' } })).toBe(1);
      const settings = await as(member.id).get('/workspaces/test-project/settings').expect(200);
      expect(settings.body.data.every((row: { isDefault: boolean }) => row.isDefault)).toBe(true);
    });

    it('a member with no project yet gets it as their default; one with a default keeps it', async () => {
      const user = await db().user.create({
        data: { email: 'solo@example.test', passwordHash: 'x', displayName: 'Solo', avatarColor: 'teal' },
      });
      const first = await as(user.id).post('/workspaces', input).expect(201);
      await as(user.id)
        .post('/workspaces', { ...input, slug: 'second', keyPrefix: 'SEC' })
        .expect(201);
      const stored = await db().user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stored.defaultWorkspaceId).toBe(first.body.data.id);
    });

    it('a docs path adds a local_path source', async () => {
      const { member } = await aProjectWith(['qa']);
      await as(member.id)
        .post('/workspaces', { ...input, docsPath: 'F:/Goteav/backend/docs' })
        .expect(201);
      const sources = await as(member.id).get('/workspaces/test-project/sources').expect(200);
      expect(sources.body.data[0]).toMatchObject({
        kind: 'local_path',
        name: 'docs',
        config: { path: 'F:/Goteav/backend/docs', purpose: 'docs' },
      });
    });

    it('answers slug_taken, key_prefix_taken and validation', async () => {
      const { member } = await aProjectWith(['qa']);
      await as(member.id).post('/workspaces', input).expect(201);
      const slug = await as(member.id)
        .post('/workspaces', { ...input, keyPrefix: 'OTH' })
        .expect(409);
      expect(slug.body.error.code).toBe('hub.workspaces.slug_taken');
      const prefix = await as(member.id)
        .post('/workspaces', { ...input, slug: 'other' })
        .expect(409);
      expect(prefix.body.error.code).toBe('hub.workspaces.key_prefix_taken');
      await as(member.id)
        .post('/workspaces', { ...input, slug: 'Bad Slug' })
        .expect(400);
      await as(member.id)
        .post('/workspaces', { ...input, slug: 'tz', keyPrefix: 'TZZ', timezone: 'Mars/Base' })
        .expect(400);
      await as(member.id)
        .post('/workspaces', { ...input, slug: 'rel', keyPrefix: 'REL', repoPaths: ['../up'] })
        .expect(400);
    });

    it('free text passes the secret filter', async () => {
      const { member } = await aProjectWith(['qa']);
      const response = await as(member.id)
        .post('/workspaces', { ...input, goals: `token=${'a'.repeat(40)}` })
        .expect(422);
      expect(response.body.error.code).toBe('hub.security.secret_detected');
      expect(response.body.error.details.field).toBe('goals');
    });

    it('GET lists what waits on me in each project, as the awaiting list counts it, in one read', async () => {
      const first = await aProjectWith(['accountant']);
      const decide = (role: Role, title: string) => ({ ...aDecision(role), title });
      const creator = await aMember(db(), first.workspace.id, ['pm']);
      await as(creator.id).post(`${first.ws}/cards`, decide('accountant', 'Mine')).expect(201);
      await as(creator.id).post(`${first.ws}/cards`, decide('accountant', 'Mine too')).expect(201);
      await as(creator.id).post(`${first.ws}/cards`, decide('backend', 'Not mine')).expect(201);
      const deleted = await as(creator.id)
        .post(`${first.ws}/cards`, decide('accountant', 'Deleted'))
        .expect(201);
      await db().card.update({
        where: { id: deleted.body.data.id as string },
        data: { archivedAt: new Date() },
      });

      const second = await aWorkspace(db());
      await db().membership.create({
        data: {
          workspaceId: second.id,
          userId: first.member.id,
          roles: ['accountant'],
          joinedAt: new Date(),
        },
      });

      const reader = app.get(CardReader);
      const across = jest.spyOn(reader, 'findCandidatesAcross');
      const perProject = jest.spyOn(reader, 'findCandidates');
      const list = await as(first.member.id).get('/workspaces').expect(200);
      expect(across).toHaveBeenCalledTimes(1);
      expect(perProject).not.toHaveBeenCalled();
      across.mockRestore();
      perProject.mockRestore();

      const count = (slug: string) =>
        (list.body.data as { slug: string; awaitingCount: number }[]).find((row) => row.slug === slug)
          ?.awaitingCount;
      expect(count(first.workspace.slug)).toBe(2);
      expect(count(second.slug)).toBe(0);
      const stack = await as(first.member.id).get(`${first.ws}/cards?awaiting=me`).expect(200);
      expect(stack.body.meta.pagination.total).toBe(2);
    });

    it('GET lists my projects with counts, and one project with my roles', async () => {
      const { member, workspace, ws } = await aProjectWith(['backend']);
      await db().card.create({
        data: {
          workspaceId: workspace.id,
          key: `${workspace.keyPrefix}-1`,
          seq: 1,
          type: 'task',
          title: 'T',
          status: 'ready',
          createdByKind: 'system',
          createdVia: 'adapter',
          source: 'test',
        },
      });
      await db().card.create({
        data: {
          workspaceId: workspace.id,
          key: `${workspace.keyPrefix}-2`,
          seq: 2,
          type: 'task',
          title: 'Deleted',
          status: 'ready',
          archivedAt: new Date(),
          createdByKind: 'system',
          createdVia: 'adapter',
          source: 'test',
        },
      });
      const list = await as(member.id).get('/workspaces').expect(200);
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0].counts.readyTasks).toBe(1);
      expect(list.body.data[0].roles).toEqual(['backend']);
      const one = await as(member.id).get(ws).expect(200);
      expect(one.body.data.myRoles).toEqual(['backend']);
      expect(one.body.data.counts).toEqual({
        openDecisions: 0,
        pendingHandoffs: 0,
        openNeeds: 0,
        readyTasks: 1,
      });
    });

    it('PATCH edits details for owner or pm only, and pauses', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const updated = await as(member.id)
        .patch(ws, { name: 'New', description: null, status: 'paused' })
        .expect(200);
      expect(updated.body.data).toMatchObject({ name: 'New', description: null, status: 'paused' });
      const qa = await aMember(db(), workspace.id, ['qa']);
      await as(qa.id).patch(ws, { name: 'No' }).expect(403);
      await as(member.id).patch(ws, { status: 'closed' }).expect(400);
    });

    it('only an owner closes and reopens; closed refuses changes but stays readable; nothing deletes', async () => {
      const { member: owner, workspace, ws } = await aProjectWith(['owner']);
      const pm = await aMember(db(), workspace.id, ['pm']);
      await as(pm.id).post(`${ws}/close`).expect(403);
      const conflict = await as(owner.id).post(`${ws}/reopen`).expect(409);
      expect(conflict.body.error.code).toBe('hub.common.conflict');

      const closed = await as(owner.id).post(`${ws}/close`).expect(200);
      expect(closed.body.data.status).toBe('closed');
      expect(closed.body.data.closedAt).toEqual(expect.any(String));

      await as(owner.id).get(ws).expect(200);
      for (const refused of [
        () => as(owner.id).patch(ws, { name: 'No' }),
        () => as(owner.id).post(`${ws}/close`),
        () => as(owner.id).put(`${ws}/settings/needs.stale_days`, { value: 9 }),
        () =>
          as(owner.id).post(`${ws}/sources`, {
            kind: 'local_path',
            name: 'docs',
            config: { path: 'F:/x', purpose: 'docs' },
          }),
        () => as(owner.id).patch(`${ws}/members/${pm.id}`, { roles: ['qa'] }),
      ]) {
        const response = await refused().expect(409);
        expect(response.body.error.code).toBe('hub.workspaces.closed');
      }

      const reopened = await as(owner.id).post(`${ws}/reopen`).expect(200);
      expect(reopened.body.data).toMatchObject({ status: 'active', closedAt: null });
      await as(owner.id).delete(ws).expect(404);
    });

    it('a project I am not in answers not found on every route', async () => {
      const { ws } = await aProjectWith(['owner']);
      const { member: stranger } = await aProjectWith(['owner']);
      for (const path of [ws, `${ws}/members`, `${ws}/settings`, `${ws}/sources`, `${ws}/onboarding`]) {
        const response = await as(stranger.id).get(path).expect(404);
        expect(response.body.error.code).toBe('hub.workspaces.not_found');
      }
    });
  });

  describe('members', () => {
    it('lists with cursor pagination and a total', async () => {
      const { member, workspace, ws } = await aProjectWith(['qa']);
      for (let index = 0; index < 2; index += 1) await aMember(db(), workspace.id, ['backend']);
      const first = await as(member.id).get(`${ws}/members?limit=2`).expect(200);
      expect(first.body.data).toHaveLength(2);
      expect(first.body.meta.pagination.total).toBe(3);
      const next = first.body.meta.pagination.nextCursor as string;
      const second = await as(member.id).get(`${ws}/members?limit=2&cursor=${next}`).expect(200);
      expect(second.body.data).toHaveLength(1);
      expect(second.body.meta.pagination.nextCursor).toBeNull();
      const seen = [...first.body.data, ...second.body.data].map((row: { userId: string }) => row.userId);
      expect(new Set(seen).size).toBe(3);
      await as(member.id).get(`${ws}/members?cursor=%%%`).expect(400);
    });

    it('never shows a hash', async () => {
      const { member, ws } = await aProjectWith(['qa']);
      const response = await as(member.id).get(`${ws}/members`).expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|totpSecret|not-a-real-hash/);
    });

    it('changes roles, audited; refuses unknown roles and those without the right', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      const updated = await as(pm.id)
        .patch(`${ws}/members/${qa.id}`, { roles: ['qa', 'backend'] })
        .expect(200);
      expect(updated.body.data.roles).toEqual(['qa', 'backend']);
      expect(
        await db().auditLog.count({ where: { workspaceId: workspace.id, action: 'members.change_roles' } }),
      ).toBe(1);
      const invalid = await as(pm.id)
        .patch(`${ws}/members/${qa.id}`, { roles: ['wizard'] })
        .expect(400);
      expect(invalid.body.error.code).toBe('hub.workspaces.role_invalid');
      await as(pm.id).patch(`${ws}/members/${qa.id}`, { roles: [] }).expect(400);
      await as(qa.id)
        .patch(`${ws}/members/${pm.id}`, { roles: ['qa'] })
        .expect(403);
      await as(pm.id)
        .patch(`${ws}/members/00000000-0000-7000-8000-000000000009`, { roles: ['qa'] })
        .expect(404);
    });

    it('removing or demoting the last owner answers 409; with a second owner it works', async () => {
      const { member: owner, workspace, ws } = await aProjectWith(['owner']);
      const demote = await as(owner.id)
        .patch(`${ws}/members/${owner.id}`, { roles: ['pm'] })
        .expect(409);
      expect(demote.body.error.code).toBe('hub.workspaces.last_owner');
      const remove = await as(owner.id).post(`${ws}/members/${owner.id}/remove`).expect(409);
      expect(remove.body.error.code).toBe('hub.workspaces.last_owner');
      const disable = await as(owner.id).post(`${ws}/members/${owner.id}/disable`).expect(409);
      expect(disable.body.error.code).toBe('hub.workspaces.last_owner');

      const second = await aMember(db(), workspace.id, ['qa']);
      await as(owner.id)
        .patch(`${ws}/members/${second.id}`, { roles: ['owner'] })
        .expect(200);
      await as(owner.id)
        .patch(`${ws}/members/${owner.id}`, { roles: ['pm'] })
        .expect(200);
    });

    it('two owners demoting each other at once leave one owner', async () => {
      const { member: first, workspace, ws } = await aProjectWith(['owner']);
      const second = await aMember(db(), workspace.id, ['owner']);
      const results = await Promise.all([
        as(first.id).patch(`${ws}/members/${second.id}`, { roles: ['qa'] }),
        as(second.id).patch(`${ws}/members/${first.id}`, { roles: ['qa'] }),
      ]);
      // The second may answer 409 (last owner) or 404/403 once its own role is gone; never two successes.
      expect(results.filter((response) => response.status === 200)).toHaveLength(1);
      const owners = await db().membership.count({
        where: { workspaceId: workspace.id, status: 'active', roles: { has: 'owner' } },
      });
      expect(owners).toBe(1);
    });

    it('a pm cannot grant, take or remove the owner role, nor get an owner reset link', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const owner = await aMember(db(), workspace.id, ['owner']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      for (const refused of [
        () => as(pm.id).patch(`${ws}/members/${pm.id}`, { roles: ['owner'] }),
        () => as(pm.id).patch(`${ws}/members/${qa.id}`, { roles: ['owner'] }),
        () => as(pm.id).patch(`${ws}/members/${owner.id}`, { roles: ['qa'] }),
        () => as(pm.id).post(`${ws}/members/${owner.id}/remove`),
        () => as(pm.id).post(`${ws}/members/${owner.id}/password-reset-link`),
      ]) {
        const response = await refused().expect(403);
        expect(response.body.error.code).toBe('hub.common.forbidden');
      }
    });

    it('remove ends access to the project at once and clears it as default', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      await db().user.update({ where: { id: qa.id }, data: { defaultWorkspaceId: workspace.id } });
      await as(qa.id).get(ws).expect(200);
      await as(pm.id).post(`${ws}/members/${qa.id}/remove`).expect(204);
      await as(qa.id).get(ws).expect(404);
      const stored = await db().user.findUniqueOrThrow({ where: { id: qa.id } });
      expect(stored.defaultWorkspaceId).toBeNull();
      expect(stored.status).toBe('active');
      const again = await as(pm.id).post(`${ws}/members/${qa.id}/remove`).expect(409);
      expect(again.body.error.code).toBe('hub.workspaces.member_removed');
      const roles = await as(pm.id)
        .patch(`${ws}/members/${qa.id}`, { roles: ['qa'] })
        .expect(409);
      expect(roles.body.error.code).toBe('hub.workspaces.member_removed');
    });

    it('remove gives back the tasks the member had claimed, with an event', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const dev = await aMember(db(), workspace.id, ['backend']);
      const card = await db().card.create({
        data: {
          workspaceId: workspace.id,
          key: `${workspace.keyPrefix}-1`,
          seq: 1,
          type: 'task',
          title: 'Claimed',
          status: 'claimed',
          assigneeId: dev.id,
          createdByKind: 'system',
          createdVia: 'adapter',
          source: 'test',
          task: { create: { specialty: 'backend' } },
        },
      });
      await as(pm.id).post(`${ws}/members/${dev.id}/remove`).expect(204);
      const after = await db().card.findFirstOrThrow({ where: { id: card.id, workspaceId: workspace.id } });
      expect(after.status).toBe('ready');
      expect(after.assigneeId).toBeNull();
      const events = await db().cardEvent.findMany({ where: { workspaceId: workspace.id, cardId: card.id } });
      expect(events.map((event) => event.kind)).toContain('unclaimed');
    });

    it('disable turns the account off when this was the only project, and revokes everything', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      const token = await db().apiToken.create({
        data: { userId: qa.id, name: 't', kind: 'mcp', prefix: 'hub_00000001', tokenHash: 'x' },
      });
      await db().session.create({
        data: {
          userId: qa.id,
          familyId: '00000000-0000-7000-8000-000000000001',
          tokenHash: 'y',
          expiresAt: new Date('2030-01-01'),
        },
      });
      await as(pm.id).post(`${ws}/members/${qa.id}/disable`).expect(204);
      const stored = await db().user.findUniqueOrThrow({ where: { id: qa.id } });
      expect(stored.status).toBe('disabled');
      expect((await db().apiToken.findUniqueOrThrow({ where: { id: token.id } })).revokedAt).not.toBeNull();
      expect(await db().session.count({ where: { userId: qa.id, revokedAt: null } })).toBe(0);

      await as(pm.id).post(`${ws}/members/${qa.id}/enable`).expect(204);
      expect((await db().user.findUniqueOrThrow({ where: { id: qa.id } })).status).toBe('active');
      await as(qa.id).get(ws).expect(200);
      void workspace;
    });

    it('disable keeps the account when the member has another project', async () => {
      const { member: pm, ws } = await aProjectWith(['pm']);
      const { member: other, workspace: home } = await aProjectWith(['qa']);
      await db().membership.create({
        data: {
          workspaceId: (
            await db().workspace.findUniqueOrThrow({ where: { slug: ws.split('/')[2] as string } })
          ).id,
          userId: other.id,
          roles: ['qa'],
        },
      });
      await as(pm.id).post(`${ws}/members/${other.id}/disable`).expect(204);
      expect((await db().user.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('active');
      await as(other.id).get(ws).expect(404);
      await as(other.id).get(`/workspaces/${home.slug}`).expect(200);
    });

    it('password-reset-link is shown once, logged without the url, and refuses a token', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      const link = await as(pm.id).post(`${ws}/members/${qa.id}/password-reset-link`).expect(201);
      const url = link.body.data.url as string;
      expect(url).toContain('/reset/');
      const audit = await db().auditLog.findFirstOrThrow({
        where: { workspaceId: workspace.id, action: 'members.password_reset_link' },
      });
      expect(audit.summary).not.toContain(url.split('/').pop());
      const stored = await db().passwordReset.findFirstOrThrow({ where: { userId: qa.id } });
      expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(24 * 3_600_000);
      await as(pm.id, 'agent').post(`${ws}/members/${qa.id}/password-reset-link`).expect(403);
    });
  });

  describe('GitHub identities', () => {
    it('replaces logins, lower-cased, shown on the member, per project', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      const set = await as(pm.id)
        .put(`${ws}/members/${qa.id}/github-logins`, { logins: ['Mohmed', 'mohmed', 'other-1'] })
        .expect(200);
      expect(set.body.data.logins).toEqual(['mohmed', 'other-1']);
      await as(pm.id)
        .put(`${ws}/members/${qa.id}/github-logins`, { logins: ['only'] })
        .expect(200);
      const members = await as(pm.id).get(`${ws}/members`).expect(200);
      const row = members.body.data.find((item: { userId: string }) => item.userId === qa.id);
      expect(row.githubLogins).toEqual(['only']);
    });

    it('one login cannot map to two members; bad input and rights are refused', async () => {
      const { member: pm, workspace, ws } = await aProjectWith(['pm']);
      const qa = await aMember(db(), workspace.id, ['qa']);
      await as(pm.id)
        .put(`${ws}/members/${pm.id}/github-logins`, { logins: ['same'] })
        .expect(200);
      const taken = await as(pm.id)
        .put(`${ws}/members/${qa.id}/github-logins`, { logins: ['same'] })
        .expect(409);
      expect(taken.body.error.code).toBe('hub.common.conflict');
      await as(pm.id)
        .put(`${ws}/members/${qa.id}/github-logins`, { logins: ['not valid!'] })
        .expect(400);
      await as(qa.id)
        .put(`${ws}/members/${qa.id}/github-logins`, { logins: ['mine'] })
        .expect(403);
      await as(pm.id)
        .put(`${ws}/members/00000000-0000-7000-8000-000000000009/github-logins`, { logins: [] })
        .expect(404);
    });
  });

  describe('settings', () => {
    it('lists all keys with defaults, and the catalogue', async () => {
      const { member, ws } = await aProjectWith(['qa']);
      const list = await as(member.id).get(`${ws}/settings`).expect(200);
      const row = list.body.data.find((item: { key: string }) => item.key === 'needs.stale_days');
      expect(row).toEqual({
        key: 'needs.stale_days',
        value: 5,
        default: 5,
        isDefault: true,
        updatedAt: null,
        updatedBy: null,
      });
      const catalogue = await as(member.id).get(`${ws}/settings/catalogue`).expect(200);
      expect(catalogue.body.data).toHaveLength(list.body.data.length);
      expect(catalogue.body.data[0].description.ar).toEqual(expect.any(String));
    });

    it('changes a key, audited, and DELETE puts the default back', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const put = await as(member.id).put(`${ws}/settings/needs.stale_days`, { value: 9 }).expect(200);
      expect(put.body.data).toMatchObject({ value: 9, default: 5, isDefault: false, updatedBy: member.id });
      const service = app.get(SettingsService, { strict: false });
      expect(await service.value(workspace.id, 'needs.stale_days')).toBe(9);
      expect(
        await db().auditLog.count({ where: { workspaceId: workspace.id, action: 'settings.update' } }),
      ).toBe(1);
      const reset = await as(member.id).delete(`${ws}/settings/needs.stale_days`).expect(200);
      expect(reset.body.data).toMatchObject({ value: 5, isDefault: true });
      expect(await service.value(workspace.id, 'needs.stale_days')).toBe(5);
    });

    it('an unknown key is 404, a wrong type 400 with the path, and rights are checked', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const unknown = await as(member.id).put(`${ws}/settings/nope`, { value: 1 }).expect(404);
      expect(unknown.body.error.code).toBe('hub.workspaces.setting_unknown');
      await as(member.id).delete(`${ws}/settings/nope`).expect(404);
      const wrong = await as(member.id)
        .put(`${ws}/settings/notifications.quiet_hours`, { value: { from: '22:00', to: 'late' } })
        .expect(400);
      expect(wrong.body.error.code).toBe('hub.workspaces.setting_invalid');
      expect(wrong.body.error.details.issues[0].path).toBe('to');
      const qa = await aMember(db(), workspace.id, ['qa']);
      await as(qa.id).put(`${ws}/settings/needs.stale_days`, { value: 9 }).expect(403);
    });

    it('a stored value that no longer fits falls back to the default', async () => {
      const { workspace } = await aProjectWith(['pm']);
      await db().workspaceSetting.create({
        data: { workspaceId: workspace.id, key: 'needs.stale_days', value: 'old' },
      });
      expect(await app.get(SettingsService, { strict: false }).value(workspace.id, 'needs.stale_days')).toBe(
        5,
      );
    });
  });

  describe('sources', () => {
    const local = {
      kind: 'local_path',
      name: 'docs',
      config: { path: 'F:/Goteav/backend/docs', purpose: 'docs' },
    };
    const repo = {
      kind: 'github_repo',
      name: 'backend',
      config: { owner: 'Alremaal-Co', repo: 'backend', app: 'backend' },
    };
    const SECRET = 'plain-source-value-123';

    it('creates a local_path source and lists it, audited', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const created = await as(member.id).post(`${ws}/sources`, local).expect(201);
      expect(created.body.data).toMatchObject({
        kind: 'local_path',
        name: 'docs',
        hasSecret: false,
        enabled: true,
        lastRunAt: null,
        lagSec: null,
      });
      const list = await as(member.id).get(`${ws}/sources`).expect(200);
      expect(list.body.data).toHaveLength(1);
      await as(member.id)
        .get(`${ws}/sources/${created.body.data.id as string}`)
        .expect(200);
      expect(
        await db().auditLog.count({ where: { workspaceId: workspace.id, action: 'sources.create' } }),
      ).toBe(1);
    });

    it('a secret is encrypted, never in a response or the audit log, and only the adapter reads it', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const created = await as(member.id)
        .post(`${ws}/sources`, { ...repo, secret: SECRET })
        .expect(201);
      const id = created.body.data.id as string;
      expect(created.body.data.hasSecret).toBe(true);

      const stored = await db().source.findUniqueOrThrow({ where: { id } });
      expect(stored.secretEnc).toEqual(expect.any(String));
      expect(stored.secretEnc).not.toContain(SECRET);

      const responses = [
        created,
        await as(member.id).get(`${ws}/sources`).expect(200),
        await as(member.id).get(`${ws}/sources/${id}`).expect(200),
        await as(member.id).patch(`${ws}/sources/${id}`, { enabled: false }).expect(200),
      ];
      for (const response of responses) {
        const text = JSON.stringify(response.body);
        expect(text).not.toContain(SECRET);
        expect(text).not.toContain('secretEnc');
        expect(text).not.toContain(stored.secretEnc);
      }
      const audit = await db().auditLog.findMany({ where: { workspaceId: workspace.id } });
      expect(
        JSON.stringify(audit, (_key, value: unknown) => (typeof value === 'bigint' ? 0 : value)),
      ).not.toContain(SECRET);

      const service = app.get(SourcesService, { strict: false });
      expect(await service.readSecret(workspace.id, id)).toEqual({ read: SECRET });
    });

    it('PATCH replaces and clears a secret, and changes config, name and enabled', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const created = await as(member.id).post(`${ws}/sources`, repo).expect(201);
      const path = `${ws}/sources/${created.body.data.id as string}`;
      const set = await as(member.id).patch(path, { secret: SECRET }).expect(200);
      expect(set.body.data.hasSecret).toBe(true);
      const cleared = await as(member.id).patch(path, { secret: null }).expect(200);
      expect(cleared.body.data.hasSecret).toBe(false);
      const service = app.get(SourcesService, { strict: false });
      expect(await service.readSecret(workspace.id, created.body.data.id as string)).toBeNull();
      const other = await as(member.id)
        .patch(path, { name: 'renamed', enabled: false, config: { ...repo.config, repo: 'other' } })
        .expect(200);
      expect(other.body.data).toMatchObject({ name: 'renamed', enabled: false });
      await as(member.id)
        .patch(path, { config: { owner: 'x' } })
        .expect(400);
    });

    it('an API token may manage sources but never set a secret (docs/15 §2)', async () => {
      const { member, ws } = await aProjectWith(['pm']);
      const agent = as(member.id, 'agent');
      const created = await agent.post(`${ws}/sources`, repo).expect(201);
      const refused = await agent.post(`${ws}/sources`, { ...local, secret: SECRET }).expect(403);
      expect(refused.body.error.code).toBe('hub.identity.token_scope');
      await agent.patch(`${ws}/sources/${created.body.data.id as string}`, { secret: SECRET }).expect(403);
      await agent.patch(`${ws}/sources/${created.body.data.id as string}`, { secret: null }).expect(403);
      await agent.patch(`${ws}/sources/${created.body.data.id as string}`, { enabled: false }).expect(200);
    });

    it('answers kind, config, dependency, name and permission errors', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const kind = await as(member.id)
        .post(`${ws}/sources`, { ...local, kind: 'ftp' })
        .expect(400);
      expect(kind.body.error.code).toBe('hub.workspaces.source_kind_invalid');
      const config = await as(member.id)
        .post(`${ws}/sources`, { ...local, config: { path: '../up', purpose: 'docs' } })
        .expect(400);
      expect(config.body.error.details.issues[0].path).toBe('config.path');
      const dependency = await as(member.id)
        .post(`${ws}/sources`, {
          kind: 'openapi',
          name: 'api',
          config: {
            repoSourceId: '00000000-0000-7000-8000-000000000009',
            path: 'openapi.json',
            toRole: 'frontend',
            fromRole: 'backend',
          },
        })
        .expect(422);
      expect(dependency.body.error.code).toBe('hub.workspaces.source_dependency_missing');
      await as(member.id).post(`${ws}/sources`, local).expect(201);
      const name = await as(member.id).post(`${ws}/sources`, local).expect(409);
      expect(name.body.error.code).toBe('hub.common.conflict');
      const leaked = await as(member.id)
        .post(`${ws}/sources`, { ...repo, config: { ...repo.config, clonePath: `token=${'a'.repeat(40)}` } })
        .expect(422);
      expect(leaked.body.error.code).toBe('hub.security.secret_detected');
      const qa = await aMember(db(), workspace.id, ['qa']);
      await as(qa.id)
        .post(`${ws}/sources`, { ...local, name: 'other' })
        .expect(403);
      await as(qa.id).get(`${ws}/sources`).expect(200);
    });

    it('openapi depends on a github_repo source of the same project', async () => {
      const { member, ws } = await aProjectWith(['pm']);
      const parent = await as(member.id).post(`${ws}/sources`, repo).expect(201);
      const dependent = {
        kind: 'openapi',
        name: 'api',
        config: {
          repoSourceId: parent.body.data.id as string,
          path: 'openapi.json',
          toRole: 'frontend',
          fromRole: 'backend',
        },
      };
      await as(member.id).post(`${ws}/sources`, dependent).expect(201);
      const { member: other, ws: otherWs } = await aProjectWith(['pm']);
      await as(other.id).post(`${otherWs}/sources`, dependent).expect(422);
    });

    it('delete is soft: hidden, secret gone, row kept, and the name is free again', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      const created = await as(member.id)
        .post(`${ws}/sources`, { ...local, secret: SECRET })
        .expect(201);
      const id = created.body.data.id as string;
      await as(member.id).delete(`${ws}/sources/${id}`).expect(204);
      expect((await as(member.id).get(`${ws}/sources`).expect(200)).body.data).toEqual([]);
      await as(member.id).get(`${ws}/sources/${id}`).expect(404);
      const row = await db().source.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
      expect(row.enabled).toBe(false);
      expect(row.secretEnc).toBeNull();
      await as(member.id).post(`${ws}/sources`, local).expect(201);
      await as(member.id).delete(`${ws}/sources/${id}`).expect(404);
    });

    it('test lists a local folder, and says so honestly otherwise', async () => {
      const { member, ws } = await aProjectWith(['pm']);
      const folder = mkdtempSync(joinPath(tmpdir(), 'hub-source-'));
      try {
        writeFileSync(joinPath(folder, 'a.md'), '# a');
        const ok = await as(member.id)
          .post(`${ws}/sources`, { ...local, config: { path: folder.replace(/\\/g, '/'), purpose: 'docs' } })
          .expect(201);
        const tested = await as(member.id)
          .post(`${ws}/sources/${ok.body.data.id as string}/test`)
          .expect(200);
        expect(tested.body.data).toEqual({ ok: true, details: { filesFound: 1 } });
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
      const missing = await as(member.id)
        .post(`${ws}/sources`, {
          ...local,
          name: 'gone',
          config: { path: 'F:/no/such/folder', purpose: 'docs' },
        })
        .expect(201);
      const failed = await as(member.id)
        .post(`${ws}/sources/${missing.body.data.id as string}/test`)
        .expect(422);
      expect(failed.body.error.code).toBe('hub.workspaces.source_connection_failed');
      expect(failed.body.error.details.reason).toBe('folder_unreadable');
      const github = await as(member.id).post(`${ws}/sources`, repo).expect(201);
      const later = await as(member.id)
        .post(`${ws}/sources/${github.body.data.id as string}/test`)
        .expect(422);
      expect(later.body.error.details.reason).toBe('not_available_in_this_release');
    });
  });

  describe('onboarding', () => {
    const paths = {
      backend: [
        { id: 'read-docs', title: 'Read', kind: 'doc', ref: 'docs/01.md' },
        { id: 'install', title: 'Install the pack', kind: 'action', ref: 'install_team_pack' },
      ],
      qa: [{ id: 'qa-only', title: 'QA', kind: 'url', ref: 'https://example.test' }],
    };

    it('shows the path of the roles I hold, ticks and unticks per member', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      await as(member.id).put(`${ws}/settings/onboarding.paths`, { value: paths }).expect(200);
      const dev = await aMember(db(), workspace.id, ['backend']);
      const peer = await aMember(db(), workspace.id, ['backend']);

      const before = await as(dev.id).get(`${ws}/onboarding`).expect(200);
      expect(before.body.data).toHaveLength(1);
      expect(before.body.data[0].role).toBe('backend');
      expect(before.body.data[0].items[0]).toMatchObject({ id: 'read-docs', done: false, doneAt: null });

      await as(dev.id).post(`${ws}/onboarding/read-docs/done`).expect(204);
      await as(dev.id).post(`${ws}/onboarding/read-docs/done`).expect(204);
      const after = await as(dev.id).get(`${ws}/onboarding`).expect(200);
      expect(after.body.data[0].items[0].done).toBe(true);
      const other = await as(peer.id).get(`${ws}/onboarding`).expect(200);
      expect(other.body.data[0].items[0].done).toBe(false);

      await as(dev.id).delete(`${ws}/onboarding/read-docs/done`).expect(204);
      const undone = await as(dev.id).get(`${ws}/onboarding`).expect(200);
      expect(undone.body.data[0].items[0].done).toBe(false);
    });

    it('an unknown item is 404, and an item of another role too', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      await as(member.id).put(`${ws}/settings/onboarding.paths`, { value: paths }).expect(200);
      const dev = await aMember(db(), workspace.id, ['backend']);
      await as(dev.id).post(`${ws}/onboarding/nope/done`).expect(404);
      await as(dev.id).post(`${ws}/onboarding/qa-only/done`).expect(404);
    });

    it('an action item finishes itself once a token has been used', async () => {
      const { member, workspace, ws } = await aProjectWith(['pm']);
      await as(member.id).put(`${ws}/settings/onboarding.paths`, { value: paths }).expect(200);
      const dev = await aMember(db(), workspace.id, ['backend']);
      await db().apiToken.create({
        data: { userId: dev.id, name: 't', prefix: 'hub_00000002', tokenHash: 'x', lastUsedAt: new Date() },
      });
      const after = await as(dev.id).get(`${ws}/onboarding`).expect(200);
      const install = after.body.data[0].items.find((item: { id: string }) => item.id === 'install');
      expect(install.done).toBe(true);
    });
  });

  describe('which project a chat lands on (docs/15 §5)', () => {
    const actors = () => app.get(ActorService, { strict: false });
    const principal = (userId: string): Principal => ({
      kind: 'agent',
      userId,
      via: 'mcp',
      tokenId: '00000000-0000-7000-8000-000000000001',
    });

    async function aMemberOfTwo() {
      const { member, workspace: first } = await aProjectWith(['backend']);
      const second = await aWorkspace(db());
      await db().membership.create({ data: { workspaceId: second.id, userId: member.id, roles: ['qa'] } });
      await db().user.update({ where: { id: member.id }, data: { defaultWorkspaceId: first.id } });
      return { member, first, second };
    }

    it('the argument wins over the header and the default', async () => {
      const { member, first, second } = await aMemberOfTwo();
      const third = await aWorkspace(db());
      await db().membership.create({ data: { workspaceId: third.id, userId: member.id, roles: ['pm'] } });
      const actor = await actors().forProject(principal(member.id), {
        argument: second.slug,
        header: third.slug,
      });
      expect(actor.workspaceId).toBe(second.id);
      expect(actor.roles).toEqual(['qa']);
      expect(first.id).not.toBe(second.id);
    });

    it('the header wins over the default', async () => {
      const { member, second } = await aMemberOfTwo();
      const actor = await actors().forProject(principal(member.id), { header: second.slug });
      expect(actor.workspaceId).toBe(second.id);
    });

    it('otherwise the default; a blank argument or header counts as absent', async () => {
      const { member, first } = await aMemberOfTwo();
      expect((await actors().forProject(principal(member.id))).workspaceId).toBe(first.id);
      const blank = await actors().forProject(principal(member.id), { argument: '  ', header: '' });
      expect(blank.workspaceId).toBe(first.id);
    });

    it('a project I am not in is not found, even when it exists and I have a default', async () => {
      const { member } = await aMemberOfTwo();
      const other = await aWorkspace(db());
      for (const choice of [{ argument: other.slug }, { header: other.slug }, { argument: 'no-such' }]) {
        await expect(actors().forProject(principal(member.id), choice)).rejects.toMatchObject({
          code: 'hub.workspaces.not_found',
        });
      }
    });

    it('no default answers no_project, also after being removed from it', async () => {
      const { member, first } = await aMemberOfTwo();
      await db().membership.updateMany({
        where: { userId: member.id, workspaceId: first.id },
        data: { status: 'removed' },
      });
      await expect(actors().forProject(principal(member.id))).rejects.toMatchObject({
        code: 'hub.workspaces.no_project',
      });
      await db().user.update({ where: { id: member.id }, data: { defaultWorkspaceId: null } });
      await expect(actors().forProject(principal(member.id))).rejects.toMatchObject({
        code: 'hub.workspaces.no_project',
      });
    });

    it('PUT /me/default-project is switch_project, for a project I am in, by session or token', async () => {
      const { member, second } = await aMemberOfTwo();
      const switched = await as(member.id, 'agent')
        .put('/me/default-project', { slug: second.slug })
        .expect(200);
      expect(switched.body.data.defaultProject).toBe(second.slug);
      expect((await actors().forProject(principal(member.id))).workspaceId).toBe(second.id);
      const other = await aWorkspace(db());
      const refused = await as(member.id).put('/me/default-project', { slug: other.slug }).expect(404);
      expect(refused.body.error.code).toBe('hub.workspaces.not_found');
    });

    it('roles are read live on each call', async () => {
      const { member, first } = await aMemberOfTwo();
      expect((await actors().forProject(principal(member.id))).roles).toEqual(['backend']);
      await db().membership.updateMany({
        where: { userId: member.id, workspaceId: first.id },
        data: { roles: ['pm'] },
      });
      expect((await actors().forProject(principal(member.id))).roles).toEqual(['pm']);
    });
  });
});
