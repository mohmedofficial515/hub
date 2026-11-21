/**
 * @file Shared by the card e2e specs: a project with members, and HTTP calls as a member.
 * @description Goes through the real routes with the harness's `x-test-user` header until sign-in lands.
 */
import type { Server } from 'node:http';

import type { Role } from '@hub/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { aMember, aWorkspace } from '../factories';
import { maintenanceClients } from './per-test-setup';

export interface Member {
  readonly id: string;
  /** Requests as this member, on the project's routes. `kind: 'agent'` acts as their Claude Code. */
  get(path: string, query?: object): request.Test;
  post(path: string, body?: object): request.Test;
  patch(path: string, body?: object): request.Test;
  put(path: string, body?: object): request.Test;
  del(path: string, body?: object): request.Test;
}

export interface Project {
  readonly id: string;
  readonly slug: string;
  member(roles: readonly Role[], kind?: 'agent'): Promise<Member>;
}

export const db = () => maintenanceClients().prisma;

export async function aProject(app: INestApplication, keyPrefix?: string): Promise<Project> {
  const workspace = await aWorkspace(db(), keyPrefix ? { keyPrefix } : {});
  const server = () => app.getHttpServer() as Server;
  const base = `/api/v1/workspaces/${workspace.slug}`;
  return {
    id: workspace.id,
    slug: workspace.slug,
    async member(roles, kind) {
      const user = await aMember(db(), workspace.id, roles);
      const as = (test: request.Test): request.Test => {
        test.set('x-test-user', user.id);
        if (kind) test.set('x-test-kind', kind);
        return test;
      };
      return {
        id: user.id,
        get: (path, query) =>
          as(
            request(server())
              .get(`${base}${path}`)
              .query(query ?? {}),
          ),
        post: (path, body) =>
          as(
            request(server())
              .post(`${base}${path}`)
              .send(body ?? {}),
          ),
        patch: (path, body) =>
          as(
            request(server())
              .patch(`${base}${path}`)
              .send(body ?? {}),
          ),
        put: (path, body) =>
          as(
            request(server())
              .put(`${base}${path}`)
              .send(body ?? {}),
          ),
        del: (path, body) =>
          as(
            request(server())
              .delete(`${base}${path}`)
              .send(body ?? {}),
          ),
      };
    },
  };
}

export const aTask = (overrides: object = {}) => ({
  type: 'task',
  title: 'A task',
  detail: { specialty: 'backend', prompt: 'Do it' },
  ...overrides,
});

export const aDecision = (deciderRole: Role = 'owner', overrides: object = {}) => ({
  type: 'decision',
  title: 'Which way',
  detail: {
    kind: 'product',
    question: 'Which way?',
    deciderRole,
    options: [
      { title: 'Left', pros: ['short'], recommended: true },
      { title: 'Right', cons: ['long'] },
    ],
  },
  ...overrides,
});

export const aNeed = (responsibleRole: Role = 'accountant') => ({
  type: 'need',
  title: 'The tax number',
  detail: { kind: 'value_check', responsibleRole },
});

export const aHandoff = (toRole: Role = 'frontend', overrides: object = {}) => ({
  type: 'handoff',
  title: 'Contract changed',
  detail: {
    kind: 'contract',
    fromRole: 'backend',
    toRole,
    severity: 'breaking',
    summary: 'The wallet route changed',
    prompt: 'Run api:sync',
  },
  ...overrides,
});

/** Create through the real route and answer the card. */
export async function created(member: Member, body: object): Promise<{ key: string; id: string }> {
  const response = await member.post('/cards', body).expect(201);
  return response.body.data as { key: string; id: string };
}

/** The event rows of a card, oldest first. */
export async function eventsOf(cardId: string) {
  return db().cardEvent.findMany({ where: { cardId }, orderBy: { seq: 'asc' } });
}
