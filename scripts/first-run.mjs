/**
 * @file First-run script (docs/15 §9).
 * @description Creates the root `.env` from `.env.example` with a random HUB_SECRET_KEY and owner
 * password, and prints the password once. Refuses to touch an existing `.env`.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');

if (existsSync(target)) {
  console.log('.env already exists; nothing changed.');
  process.exit(0);
}

const password = randomBytes(18).toString('base64url');
const content = readFileSync(join(root, '.env.example'), 'utf8')
  .replace(/^HUB_SECRET_KEY=.*$/m, `HUB_SECRET_KEY=${randomBytes(32).toString('base64')}`)
  .replace(/^HUB_OWNER_PASSWORD=.*$/m, `HUB_OWNER_PASSWORD=${password}`)
  .replace(/^HUB_OWNER_EMAIL=.*$/m, `HUB_OWNER_EMAIL=${process.env.HUB_OWNER_EMAIL ?? ''}`);
writeFileSync(target, content, { mode: 0o600 });

console.log('Wrote .env');
console.log(`Owner password (shown once): ${password}`);
if (!process.env.HUB_OWNER_EMAIL) console.log('Set HUB_OWNER_EMAIL in .env before seeding.');
