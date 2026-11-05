/**
 * @file The cipher round-trips, hides the value, and detects tampering.
 */
import { SecretCipher } from './secret-cipher';

const key = Buffer.alloc(32, 9).toString('base64');

describe('SecretCipher', () => {
  it('round-trips and never stores the plaintext', () => {
    const cipher = new SecretCipher(key);
    const stored = cipher.encrypt('ghp_value');
    expect(stored).not.toContain('ghp_value');
    expect(cipher.decrypt(stored)).toBe('ghp_value');
  });

  it('uses a fresh iv each time', () => {
    const cipher = new SecretCipher(key);
    expect(cipher.encrypt('same')).not.toBe(cipher.encrypt('same'));
  });

  it('refuses a tampered value and another key', () => {
    const cipher = new SecretCipher(key);
    const stored = cipher.encrypt('value');
    const parts = stored.split('.');
    parts[3] = Buffer.from('other').toString('base64');
    expect(() => cipher.decrypt(parts.join('.'))).toThrow();
    expect(() => new SecretCipher(Buffer.alloc(32, 1).toString('base64')).decrypt(stored)).toThrow();
    expect(() => cipher.decrypt('garbage')).toThrow();
  });

  it('refuses a key of the wrong length', () => {
    expect(() => new SecretCipher('c2hvcnQ=')).toThrow();
  });
});
