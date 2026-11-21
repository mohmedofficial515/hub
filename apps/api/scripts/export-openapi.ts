/**
 * @file `pnpm openapi:export`: writes openapi/openapi.json without a database or Redis.
 * @description Providers are built but `init()` never runs, so nothing connects: the Prisma pool and
 * ioredis are lazy and queues open on first use. Pattern from F:/Goteav/backend/scripts/export-openapi.ts.
 */
import 'reflect-metadata';

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

process.env['NODE_ENV'] ??= 'development';
process.env['DATABASE_URL'] ??= 'postgresql://export:export@localhost:1/export';
process.env['REDIS_URL'] ??= 'redis://localhost:1/0';
process.env['HUB_SECRET_KEY'] ??= Buffer.alloc(32, 1).toString('base64');
process.env['LOG_LEVEL'] = 'silent';

async function main(): Promise<void> {
  // Imported here so the placeholder env above is in place when the config module loads.
  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/app.setup');
  const { buildOpenApiDocument } = await import('../src/swagger');

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  const document = buildOpenApiDocument(app);
  const output = resolve(process.cwd(), 'openapi/openapi.json');
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
  process.stdout.write(`OpenAPI written: ${output} (${Object.keys(document.paths).length} paths)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    process.stderr.write(`export-openapi failed: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
