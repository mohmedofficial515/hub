/**
 * @file MCP parity from the compiled app (docs/15 §6): every web mutation has a tool, every tool has a handler, and
 * sensitive tools tell Claude to confirm first. AppModule is compiled but never initialised, so nothing connects.
 */
import {
  MCP_EXCLUDED_ROUTES,
  MCP_PROMPTS,
  MCP_TOOLS,
  type PermissionAction,
  surfaceOf,
} from '@hub/contracts';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common/enums/request-method.enum';
import { ModulesContainer } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { MCP_HANDLER_NAMES } from '@/modules/mcp';
import { PERMISSIONS_KEY, PUBLIC_KEY } from '@/shared/http';

const SESSION_ONLY_KEY = 'hub:session-only';

interface Route {
  readonly id: string;
  readonly mutates: boolean;
  readonly open: boolean;
  readonly actions: readonly PermissionAction[];
}

function routesOf(moduleRef: TestingModule): Route[] {
  const routes: Route[] = [];
  for (const module of moduleRef.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | undefined;
      if (!controller) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, object>)[name] as object;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (method === undefined) continue;
        const path = String(Reflect.getMetadata(PATH_METADATA, handler) ?? '');
        const full = `/${[base, path].filter((part) => part !== '' && part !== '/').join('/')}`;
        const sessionOnly =
          Reflect.getMetadata(SESSION_ONLY_KEY, handler) ?? Reflect.getMetadata(SESSION_ONLY_KEY, controller);
        const isPublic =
          Reflect.getMetadata(PUBLIC_KEY, handler) ?? Reflect.getMetadata(PUBLIC_KEY, controller);
        routes.push({
          id: `${RequestMethod[method]} ${full}`,
          mutates: method !== RequestMethod.GET && method !== RequestMethod.ALL,
          open: Boolean(sessionOnly) || Boolean(isPublic) || full.startsWith('/auth'),
          actions: (Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? []) as PermissionAction[],
        });
      }
    }
  }
  return routes;
}

describe('MCP parity', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('every web mutation has a tool, unless it is named as excluded', () => {
    const covered = new Set(MCP_TOOLS.flatMap((tool) => tool.routes ?? []));
    const missing = routesOf(moduleRef)
      .filter((route) => route.mutates && !route.open)
      .filter((route) => route.actions.every((action) => surfaceOf(action) !== 'web_only'))
      .filter((route) => !covered.has(route.id) && !MCP_EXCLUDED_ROUTES[route.id])
      .map((route) => route.id);
    expect(missing).toEqual([]);
  });

  it('every route a tool names exists', () => {
    const known = new Set(routesOf(moduleRef).map((route) => route.id));
    const unknown = MCP_TOOLS.flatMap((tool) => tool.routes ?? []).filter((route) => !known.has(route));
    expect(unknown).toEqual([]);
  });

  it('every tool has a handler and a project argument', () => {
    expect(MCP_TOOLS.map((tool) => tool.name).sort()).toEqual([...MCP_HANDLER_NAMES].sort());
    for (const tool of MCP_TOOLS) expect(Object.keys(tool.input.shape)).toContain('project');
  });

  it('a sensitive tool says to confirm first', () => {
    const silent = MCP_TOOLS.filter(
      (tool) => tool.destructive && !/confirm with the user/i.test(tool.description),
    );
    expect(silent.map((tool) => tool.name)).toEqual([]);
    for (const name of ['decide', 'delete_card', 'verify_need', 'approve_redesign', 'reject_redesign']) {
      expect(MCP_TOOLS.find((tool) => tool.name === name)?.destructive).toBe(true);
    }
  });

  it('no tool takes a secret, or touches API tokens', () => {
    for (const tool of MCP_TOOLS) {
      expect(Object.keys(tool.input.shape)).not.toContain('secret');
      expect(Object.keys(tool.input.shape)).not.toContain('password');
      expect(tool.name).not.toMatch(/token/);
    }
  });

  it('every prompt keeps the no-secrets rule, and no prompt takes free text', () => {
    for (const prompt of MCP_PROMPTS) {
      const text = prompt.render({ displayName: 'A', roles: ['owner'], project: 'p' }, { key: 'GTV-1' });
      expect(text).toContain('Never send a secret');
      expect(text).not.toMatch(/human-only/i);
    }
    expect(MCP_PROMPTS.map((prompt) => prompt.name)).not.toEqual(expect.arrayContaining(['ask']));
    expect(MCP_PROMPTS.map((prompt) => prompt.name)).not.toEqual(expect.arrayContaining(['plan']));
  });
});
