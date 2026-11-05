/**
 * @file Pairing's pure rules (docs/16 §5): the two codes, and what state a request is in right now.
 * @description The device holds a long secret code, of which only the hash is stored. The owner compares the short one by eye. It leaves out
 * characters that read alike, because a person copies it across screens.
 */
import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { PairingStatus } from '@hub/contracts';

const USER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newUserCode(): string {
  const pick = () => USER_ALPHABET[randomInt(USER_ALPHABET.length)] ?? 'A';
  const part = () => Array.from({ length: 4 }, pick).join('');
  return `${part()}-${part()}`;
}

export function newDeviceCode(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDeviceCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** An answer already given stays that answer; anything still open ends at the deadline. */
export function pairingStatus(row: { status: string; expiresAt: Date }, now: Date): PairingStatus {
  if (row.status === 'denied' || row.status === 'claimed') return row.status;
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  return row.status === 'approved' ? 'approved' : 'pending';
}
