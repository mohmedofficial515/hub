/**
 * @file Env schema: accepts `.env.example` once filled in, rejects a missing secret key (docs/12 H0-02).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'dotenv';

import { envSchema } from './env.schema';

const example = parse(readFileSync(join(__dirname, '../../../../.env.example')));
const secret = Buffer.alloc(32, 7).toString('base64');
const generated = { HUB_SECRET_KEY: secret, HUB_JWT_SECRET: 'x'.repeat(48) };

describe('envSchema', () => {
  it('accepts .env.example with the keys the first-run script generates', () => {
    expect(envSchema.safeParse({ ...example, ...generated }).success).toBe(true);
  });

  it('rejects a missing HUB_SECRET_KEY', () => {
    const { HUB_SECRET_KEY: _omitted, ...rest } = { ...example, ...generated };
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a key of the wrong length', () => {
    expect(envSchema.safeParse({ ...example, ...generated, HUB_SECRET_KEY: 'c2hvcnQ=' }).success).toBe(false);
  });

  it('rejects a missing or short HUB_JWT_SECRET', () => {
    expect(envSchema.safeParse({ ...example, HUB_SECRET_KEY: secret }).success).toBe(false);
    expect(envSchema.safeParse({ ...example, ...generated, HUB_JWT_SECRET: 'short' }).success).toBe(false);
  });
});
