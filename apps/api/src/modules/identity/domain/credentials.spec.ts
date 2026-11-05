/**
 * @file Token shapes, hashing, the password rule and the hook token's reach.
 */
import { findSecret } from '@hub/contracts';

import {
  apiTokenPrefix,
  hashesMatch,
  hashRecoveryCode,
  hookTokenMayCall,
  newApiToken,
  newOpaqueToken,
  newRecoveryCode,
  sha256,
} from './credentials';
import { isWeakPassword } from './password-policy';

describe('API tokens', () => {
  it('have the agreed format, and only the hash and prefix are kept', () => {
    const { token, prefix, tokenHash } = newApiToken();
    expect(token).toMatch(/^hub_[a-f0-9]{8}_[a-f0-9]{80}$/);
    expect(prefix).toBe(token.slice(0, 12));
    expect(tokenHash).toBe(sha256(token));
    expect(tokenHash).not.toContain(token);
    expect(apiTokenPrefix(token)).toBe(prefix);
  });

  it('are caught by the secret filter if pasted anywhere', () => {
    expect(findSecret(`my token is ${newApiToken().token}`)).toBe('hub_token');
  });

  it('a malformed token has no prefix', () => {
    for (const raw of ['', 'hub_', 'hub_zzzzzzzz_00', 'Bearer x', `hub_abcdef12_${'g'.repeat(80)}`]) {
      expect(apiTokenPrefix(raw)).toBeNull();
    }
  });

  it('are different every time', () => {
    expect(newApiToken().token).not.toBe(newApiToken().token);
    expect(newOpaqueToken()).not.toBe(newOpaqueToken());
  });
});

describe('hashesMatch', () => {
  it('compares hex hashes', () => {
    expect(hashesMatch(sha256('a'), sha256('a'))).toBe(true);
    expect(hashesMatch(sha256('a'), sha256('b'))).toBe(false);
    expect(hashesMatch(sha256('a'), 'abcd')).toBe(false);
  });
});

describe('recovery codes', () => {
  it('ignore case and separators', () => {
    const code = newRecoveryCode();
    expect(code).toHaveLength(10);
    expect(hashRecoveryCode(code.toLowerCase())).toBe(hashRecoveryCode(code));
    expect(hashRecoveryCode(`${code.slice(0, 5)}-${code.slice(5)}`)).toBe(hashRecoveryCode(code));
  });
});

describe('password rule', () => {
  it('refuses short and common passwords, whatever the case', () => {
    expect(isWeakPassword('short')).toBe(true);
    expect(isWeakPassword('elevenchars')).toBe(true);
    expect(isWeakPassword('MotherFucker')).toBe(true);
    expect(isWeakPassword('a long enough passphrase')).toBe(false);
  });
});

describe('hook token reach (docs/04 §1.6)', () => {
  it.each([
    '/api/v1/workspaces/goteav/capture/session',
    '/api/v1/capture/anything',
    '/api/v1/me',
    '/api/v1/me/context',
    '/api/v1/auth/me',
  ])('allows %s', (path) => {
    expect(hookTokenMayCall(path)).toBe(true);
  });

  it.each([
    '/api/v1/workspaces/goteav/cards',
    '/api/v1/workspaces/goteav',
    '/api/v1/me/tokens',
    '/api/v1/workspaces',
    '/api/v1/mcp',
    '/api/v1/captured',
  ])('refuses %s', (path) => {
    expect(hookTokenMayCall(path)).toBe(false);
  });
});
