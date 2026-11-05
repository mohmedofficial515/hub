/**
 * @file H0-02 acceptance: health, envelope, error codes, i18n, the scope assertion on a real client.
 */
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { SCOPED_PRISMA, type ScopedPrisma, WorkspaceScopeError } from '@/infra/prisma';

import { aMember, aWorkspace } from '../factories';
import { createTestApp } from '../setup/create-test-app';
import { maintenanceClients } from '../setup/per-test-setup';

describe('foundation', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  it('GET /health/live and /health/ready answer in the envelope', async () => {
    const live = await http().get('/api/v1/health/live').expect(200);
    expect(live.body.data.status).toBe('ok');
    const ready = await http().get('/api/v1/health/ready').expect(200);
    expect(ready.body.data).toEqual({
      status: 'ok',
      checks: { postgres: 'ok', redis: 'ok', reposVolume: 'ok' },
    });
    expect(ready.body.meta.requestId).toEqual(expect.any(String));
  });

  it('an unknown route is the not_found envelope', async () => {
    const response = await http().get('/api/v1/nope').expect(404);
    expect(response.body.error.code).toBe('hub.common.not_found');
    expect(response.body.error.message).toBe('Not found.');
  });

  it('Accept-Language: ar answers in Arabic', async () => {
    const response = await http().get('/api/v1/nope').set('Accept-Language', 'ar').expect(404);
    expect(response.body.error.message).toBe('غير موجود.');
  });

  it('a route without credentials answers 401', async () => {
    const response = await http().post('/api/v1/workspaces/any/cards').send({}).expect(401);
    expect(response.body.error.code).toBe('hub.common.unauthorized');
  });

  it('a project the member does not belong to answers not found', async () => {
    const { prisma } = maintenanceClients();
    const mine = await aWorkspace(prisma);
    const other = await aWorkspace(prisma);
    const member = await aMember(prisma, mine.id, ['backend']);
    const response = await http()
      .post(`/api/v1/workspaces/${other.slug}/cards`)
      .set('x-test-user', member.id)
      .send({})
      .expect(404);
    expect(response.body.error.code).toBe('hub.workspaces.not_found');
  });

  it('a body failing the schema is a 400 with issue paths', async () => {
    const { prisma } = maintenanceClients();
    const workspace = await aWorkspace(prisma);
    const member = await aMember(prisma, workspace.id, ['backend']);
    const response = await http()
      .post(`/api/v1/workspaces/${workspace.slug}/cards`)
      .set('x-test-user', member.id)
      .send({ type: 'task', title: '' })
      .expect(400);
    expect(response.body.error.code).toBe('hub.common.validation');
    expect(response.body.error.details.issues.map((issue: { path: string }) => issue.path)).toContain(
      'title',
    );
  });

  it('the scoped client refuses a deliberately unscoped query', async () => {
    const scoped = app.get<ScopedPrisma>(SCOPED_PRISMA);
    await expect(scoped.card.findMany({ where: { type: 'task' } })).rejects.toBeInstanceOf(
      WorkspaceScopeError,
    );
    await expect(
      scoped.card.findMany({ where: { workspaceId: '00000000-0000-7000-8000-000000000000' } }),
    ).resolves.toEqual([]);
  });
});
