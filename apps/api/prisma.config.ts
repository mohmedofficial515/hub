/**
 * @file Prisma 7 CLI configuration: schema folder, migrations, datasource URL.
 * @description Copied from F:/Goteav/backend/prisma.config.ts. Reads the monorepo root `.env`, for the
 * CLI only; the application reads env through src/config.
 */
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

loadDotenv({ path: resolve(__dirname, '../../.env'), quiet: true });

/** CLI commands that open a database connection and therefore need a real DATABASE_URL. */
const DATABASE_COMMANDS = new Set(['migrate', 'db', 'studio', 'introspect']);

/** Placeholder so `prisma generate`, `validate` and `format` work without a database (CI). */
const PLACEHOLDER_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

function databaseUrl(): string {
  if (process.env['DATABASE_URL']) return env('DATABASE_URL');
  const needsDatabase = process.argv.some((arg) => DATABASE_COMMANDS.has(arg));
  return needsDatabase ? env('DATABASE_URL') : PLACEHOLDER_URL;
}

export default defineConfig({
  schema: 'prisma/schema',
  datasource: { url: databaseUrl() },
  migrations: { path: 'prisma/migrations' },
});
