/**
 * @file A TOTP code as an authenticator app makes it (RFC 6238: SHA-1, 30 seconds, 6 digits), for a test that enrols and signs in.
 */
import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/[\s=-]/g, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error(`Not base32: ${char}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8)
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function totpCode(secret: string, at: number = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

/** Waits for the next 30-second step, so a code is never the one just used: the API refuses a code twice. */
export async function nextStep(): Promise<void> {
  const left = 30_000 - (Date.now() % 30_000);
  await new Promise((done) => setTimeout(done, left + 200));
}
