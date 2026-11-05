/**
 * @file `pnpm migrations:check`: lint of migration SQL for DDL that blocks writes on a big table.
 * @description Reduced from F:/Goteav/backend/scripts/check-migrations.ts, same two rules:
 * CREATE INDEX must be CONCURRENTLY and ALTER TABLE needs `SET lock_timeout` first, unless the table
 * was created in the same migration. 0000_init creates everything, so it passes by that rule.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LARGE_TABLES = new Set([
  'cards',
  'card_events',
  'card_comments',
  'audit_log',
  'doc_chunks',
  'notifications',
]);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'migrations');
const findings = [];

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const sql = readFileSync(join(root, entry.name, 'migration.sql'), 'utf8');
  const created = new Set(
    [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?(\w+)"?/g)].map((match) => match[1]),
  );
  const big = (table) => LARGE_TABLES.has(table) && !created.has(table);
  for (const match of sql.matchAll(/CREATE (?:UNIQUE )?INDEX (CONCURRENTLY )?.*? ON "?(\w+)"?/g)) {
    if (!match[1] && big(match[2])) {
      findings.push(`${entry.name}: CREATE INDEX on ${match[2]} must be CONCURRENTLY`);
    }
  }
  for (const match of sql.matchAll(/ALTER TABLE "?(\w+)"?/g)) {
    if (big(match[1]) && !/SET lock_timeout/i.test(sql.slice(0, match.index))) {
      findings.push(`${entry.name}: ALTER TABLE ${match[1]} needs SET lock_timeout first`);
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('Migrations are clean.');
