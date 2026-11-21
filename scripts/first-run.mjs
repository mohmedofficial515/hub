/**
 * @file First-run script (docs/15 §9).
 * @description Creates the root `.env` from `.env.example` with a random HUB_SECRET_KEY, HUB_JWT_SECRET and
 * owner password, and prints the password once. On an existing `.env` it only fills what is missing or empty,
 * and changes no value that is already set.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');

const password = randomBytes(18).toString('base64url');
const generated = {
  HUB_SECRET_KEY: randomBytes(32).toString('base64'),
  HUB_JWT_SECRET: randomBytes(48).toString('base64url'),
  HUB_OWNER_PASSWORD: password,
};

const created = !existsSync(target);
let content = readFileSync(created ? join(root, '.env.example') : target, 'utf8');
const filled = [];

for (const [name, value] of Object.entries(generated)) {
  const line = new RegExp(`^${name}=(.*)$`, 'm');
  const match = line.exec(content);
  if (match?.[1]) continue;
  content = match
    ? content.replace(line, () => `${name}=${value}`)
    : `${content.replace(/\n?$/, '\n')}${name}=${value}\n`;
  filled.push(name);
}

const ownerEmail = process.env.HUB_OWNER_EMAIL;
if (ownerEmail && /^HUB_OWNER_EMAIL=$/m.test(content)) {
  content = content.replace(/^HUB_OWNER_EMAIL=$/m, () => `HUB_OWNER_EMAIL=${ownerEmail}`);
  filled.push('HUB_OWNER_EMAIL');
}

if (filled.length === 0) {
  console.log('.env is complete; nothing changed.');
  process.exit(0);
}

writeFileSync(target, content, { mode: 0o600 });
console.log(`${created ? 'Wrote' : 'Updated'} .env: ${filled.join(', ')}`);
if (filled.includes('HUB_OWNER_PASSWORD')) console.log(`Owner password (shown once): ${password}`);
if (/^HUB_OWNER_EMAIL=$/m.test(content))
  console.log('Set HUB_OWNER_EMAIL in .env, then run pnpm seed:owner.');
else console.log('Next: pnpm db:deploy, then pnpm seed:owner.');
