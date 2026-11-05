/**
 * @file Fitness rules of H0-03 and H0-04: no response shape names a stored secret, and every web-only action
 * refuses API tokens at the route.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { type PermissionAction, surfaceOf } from '@hub/contracts';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '@/app.module';
import { SESSION_ONLY_KEY } from '@/modules/identity/presentation/session-only.decorator';
import { PERMISSIONS_KEY } from '@/shared/http';
import { buildOpenApiDocument } from '@/swagger';

const FORBIDDEN = /secretEnc|passwordHash|tokenHash|totpSecretEnc|totpRecoveryCodes/;
const SRC = join(__dirname, '../../src');
const CONTRACTS = join(__dirname, '../../../../packages/contracts/src');

function files(dir: string, keep: (path: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'generated') return [];
    if (statSync(path).isDirectory()) return files(path, keep);
    return keep(path) ? [path] : [];
  });
}

describe('secrets stay out of responses', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('no controller or DTO names a stored secret or hash', () => {
    const offenders = files(
      SRC,
      (path) => /presentation[\\/].*\.ts$/.test(path) && !path.endsWith('.spec.ts'),
    ).filter((path) => FORBIDDEN.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no schema in @hub/contracts names one', () => {
    const offenders = files(CONTRACTS, (path) => path.endsWith('.ts') && !path.endsWith('.spec.ts')).filter(
      (path) => FORBIDDEN.test(readFileSync(path, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the OpenAPI document names none', () => {
    const app = moduleRef.createNestApplication({ logger: false });
    const document = JSON.stringify(buildOpenApiDocument(app));
    expect(document).toContain('/api/v1/auth/sign-in'.replace('/api/v1', ''));
    expect(FORBIDDEN.test(document)).toBe(false);
  });

  it('a source response has `hasSecret` and no field called secret', () => {
    const app = moduleRef.createNestApplication({ logger: false });
    const schemas = buildOpenApiDocument(app).components?.schemas as Record<
      string,
      { properties?: Record<string, unknown> }
    >;
    const properties = Object.keys(schemas['SourceDtoHttp']?.properties ?? {});
    expect(properties).toContain('hasSecret');
    expect(properties).not.toContain('secret');
  });

  it('a route performing a web-only action is @SessionOnly (D27 limits)', () => {
    const missing: string[] = [];
    let found = 0;
    for (const module of moduleRef.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype as (new () => object) | undefined;
        if (!controller) continue;
        for (const name of Object.getOwnPropertyNames(controller.prototype)) {
          const handler = (controller.prototype as Record<string, unknown>)[name];
          if (typeof handler !== 'function' || Reflect.getMetadata(METHOD_METADATA, handler) === undefined) {
            continue;
          }
          const actions = (Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? []) as PermissionAction[];
          if (!actions.some((action) => surfaceOf(action) === 'web_only')) continue;
          found += 1;
          if (!Reflect.getMetadata(SESSION_ONLY_KEY, handler)) {
            missing.push(`${String(Reflect.getMetadata(PATH_METADATA, controller))} ${name}`);
          }
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
