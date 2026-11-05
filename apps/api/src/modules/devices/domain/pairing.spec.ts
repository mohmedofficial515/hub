/**
 * @file The two codes, and the states a pairing request can be in.
 */
import { USER_CODE_PATTERN } from '@hub/contracts';

import { hashDeviceCode, newDeviceCode, newUserCode, pairingStatus } from './pairing';

const now = new Date('2026-11-06T10:00:00Z');
const later = new Date('2026-11-06T10:05:00Z');
const earlier = new Date('2026-11-06T09:55:00Z');

describe('pairing codes', () => {
  it('a short code matches the contract and leaves out characters that read alike', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = newUserCode();
      expect(code).toMatch(USER_CODE_PATTERN);
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('a device code is long and different each time, and its stored form is not itself', () => {
    const code = newDeviceCode();
    expect(code.length).toBeGreaterThanOrEqual(43);
    expect(newDeviceCode()).not.toBe(code);
    expect(hashDeviceCode(code)).not.toContain(code);
  });
});

describe('pairingStatus', () => {
  it('an open request ends at its deadline', () => {
    expect(pairingStatus({ status: 'pending', expiresAt: later }, now)).toBe('pending');
    expect(pairingStatus({ status: 'pending', expiresAt: earlier }, now)).toBe('expired');
    expect(pairingStatus({ status: 'approved', expiresAt: later }, now)).toBe('approved');
    expect(pairingStatus({ status: 'approved', expiresAt: earlier }, now)).toBe('expired');
  });

  it('an answer stays, whatever the time', () => {
    expect(pairingStatus({ status: 'denied', expiresAt: earlier }, now)).toBe('denied');
    expect(pairingStatus({ status: 'claimed', expiresAt: earlier }, now)).toBe('claimed');
  });
});
