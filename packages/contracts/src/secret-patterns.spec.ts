/**
 * @file Secret filter table test (docs/11 §1.4). Values are assembled at runtime so that repository
 * secret scanners do not flag this fixture.
 */
import { describe, expect, it } from 'vitest';

import { findSecret } from './secret-patterns';

const repeat = (text: string, times: number): string => text.repeat(times);

const POSITIVES: [string, string][] = [
  ['aws_access_key', `AKIA${repeat('ABCD1234', 2)}`],
  ['github_token', `ghp_${repeat('a1B2', 9)}`],
  ['github_pat', `github_pat_${repeat('a1B2_', 6)}`],
  ['jwt', `eyJhbGciOiJI.eyJzdWIiOiIx.${repeat('sig', 5)}`],
  ['private_key', `-----BEGIN RSA ${'PRIVATE'} KEY-----`],
  ['private_key', `-----BEGIN ${'PRIVATE'} KEY-----`],
  ['stripe_live_key', `sk_live_${repeat('a1B2', 6)}`],
  ['generic_token_32+', `token=${repeat('abcdef0123', 4)}`],
  ['generic_token_32+', `API_KEY: "${repeat('QUJD', 9)}"`],
  ['generic_token_32+', `client_secret = ${repeat('abcdef0123', 4)}`],
];

const NEGATIVES = [
  '018f3a4e-7b1c-7d2e-9f00-112233445566',
  'GTV-123',
  'd41d8cd98f00b204e9800998ecf8427e12345678',
  'commit d41d8cd98f00b204e9800998ecf8427e12345678 fixed it',
  'https://github.com/mohmedofficial515/hub/pull/12',
  'F:/Goteav/backend/docs/21-confirmation-safety.md',
  'نحتاج إلى مفتاح الدفع من المحاسب قبل الإطلاق',
  'the token is in 1Password › Goteav › Moyasar',
  'backend .env on prod',
  'key: short-value',
];

describe('findSecret', () => {
  it.each(POSITIVES)('finds %s', (name, value) => {
    expect(findSecret(value)).toBe(name);
  });

  it.each(NEGATIVES)('passes %s', (value) => {
    expect(findSecret(value)).toBeNull();
  });
});
