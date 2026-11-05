/**
 * @file Opaque credentials: refresh, invite and reset tokens, and API tokens (`hub_<prefix8>_<secret>`).
 * @description Only SHA-256 hashes are stored. The API token shape is the one the secret filter's
 * `hub_token` pattern recognises, so a pasted token is refused anywhere it could be stored.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

const API_TOKEN = /^(hub_[a-f0-9]{8})_[a-f0-9]{80}$/;
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RECOVERY_LENGTH = 10;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

/** 32 random bytes for a refresh, invite or reset token. */
export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface NewApiToken {
  /** Shown once. */
  readonly token: string;
  /** `hub_` plus 8 hex characters, stored for lookup and shown in lists. */
  readonly prefix: string;
  readonly tokenHash: string;
}

export function newApiToken(): NewApiToken {
  const prefix = `hub_${randomBytes(4).toString('hex')}`;
  const token = `${prefix}_${randomBytes(40).toString('hex')}`;
  return { token, prefix, tokenHash: sha256(token) };
}

/** The lookup prefix of a well-formed token, else null. */
export function apiTokenPrefix(raw: string): string | null {
  return API_TOKEN.exec(raw)?.[1] ?? null;
}

export function newRecoveryCode(): string {
  let code = '';
  for (let index = 0; index < RECOVERY_LENGTH; index += 1) {
    code += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
  }
  return code;
}

/** Case and separators do not matter when a member types a recovery code. */
export function hashRecoveryCode(code: string): string {
  return sha256(code.replace(/[\s-]/g, '').toUpperCase());
}

/** What a `hook` token may call (docs/04 §1.6): capture, and the member's own context. */
export function hookTokenMayCall(path: string): boolean {
  return /^\/api\/v1\/((workspaces\/[^/]+\/)?capture(\/|$)|me(\/context)?\/?$|auth\/me\/?$)/.test(path);
}
