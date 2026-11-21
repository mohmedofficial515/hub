/**
 * @file Fitness rules read from the compiled app (docs/11 §2): routes declare a permission, every card
 * action names a real permission row, and the scope table and error catalogue stay in step with the code.
 * AppModule is compiled but never initialised, so nothing connects.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ERROR_CODES, PERMISSION_ACTIONS } from '@hub/contracts';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { WORKSPACE_SCOPED_MODELS } from '@/infra/prisma/workspace-scope';
import { CardActionRegistry } from '@/modules/cards';
import { PERMISSIONS_KEY, PUBLIC_KEY } from '@/shared/http';

const SRC = join(__dirname, '../../src');
const SCHEMA = join(__dirname, '../../prisma/schema');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'generated') return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('architecture', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('every route declares @Public or @Permissions', () => {
    const missing: string[] = [];
    let routes = 0;
    for (const module of moduleRef.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype as (new () => object) | undefined;
        if (!controller) continue;
        for (const name of Object.getOwnPropertyNames(controller.prototype)) {
          const handler = (controller.prototype as Record<string, unknown>)[name];
          if (typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined)
            continue;
          routes += 1;
          const declared = [PUBLIC_KEY, PERMISSIONS_KEY].some(
            (key) => Reflect.getMetadata(key, handler) ?? Reflect.getMetadata(key, controller),
          );
          if (!declared) {
            missing.push(`${String(Reflect.getMetadata(PATH_METADATA, controller))} ${name}`);
          }
        }
      }
    }
    expect(routes).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('every card action has a handler with a real permission row, and task.create is one', () => {
    const actions = moduleRef
      .get(CardActionRegistry, { strict: false })
      .all()
      .map((definition) => definition.action);
    expect(actions).toContain('task.create');
    for (const action of actions) expect(PERMISSION_ACTIONS).toContain(action);
  });

  it('the scope table lists exactly the models that have a workspaceId', () => {
    const models = readdirSync(SCHEMA).flatMap((file) =>
      [...readFileSync(join(SCHEMA, file), 'utf8').matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
        .filter((match) => /^\s*workspaceId\s/m.test(match[2] ?? ''))
        .map((match) => match[1] as string),
    );
    expect(Object.keys(WORKSPACE_SCOPED_MODELS).sort()).toEqual(models.sort());
  });

  it('every catalogued code has en and ar messages', () => {
    for (const lang of ['en', 'ar']) {
      const catalog = JSON.parse(readFileSync(join(SRC, 'i18n', lang, 'errors.json'), 'utf8')) as object;
      for (const code of ERROR_CODES) {
        const message = code
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog);
        expect([lang, code, typeof message]).toEqual([lang, code, 'string']);
      }
    }
  });

  it('every hub.* code in the source exists in the catalogue', () => {
    const known = new Set<string>(ERROR_CODES);
    const unknown: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/AppException\(\s*'(hub\.[a-z_.]+)'/g)) {
        if (!known.has(match[1] as string)) unknown.push(`${file}: ${match[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('nothing in the source reintroduces the removed human-only concept (D27)', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /human_only|HUMAN_ONLY/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
    expect(existsSync(SRC)).toBe(true);
  });
});
