/**
 * @file AES-256-GCM with HUB_SECRET_KEY, for `users.totp_secret_enc` and `sources.secret_enc`.
 * @description Stored as `v1.<iv>.<tag>.<ciphertext>` in base64, so a later key rotation can tell versions
 * apart. The plaintext never leaves through a response or a log.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

export class SecretCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) throw new Error('HUB_SECRET_KEY must be base64 of 32 bytes');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
      .join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, ciphertext] = stored.split('.');
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
      throw new Error('Unreadable secret');
    }
    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString(
      'utf8',
    );
  }
}
