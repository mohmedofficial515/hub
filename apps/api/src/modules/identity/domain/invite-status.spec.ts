import { inviteStatusOf } from './invite-status';

describe('inviteStatusOf', () => {
  const now = new Date('2026-11-09T10:00:00.000Z');
  const later = new Date('2026-11-10T10:00:00.000Z');
  const earlier = new Date('2026-11-08T10:00:00.000Z');

  it('is pending until it expires, then expired', () => {
    expect(inviteStatusOf({ acceptedAt: null, revokedAt: null, expiresAt: later }, now)).toBe('pending');
    expect(inviteStatusOf({ acceptedAt: null, revokedAt: null, expiresAt: now }, now)).toBe('expired');
    expect(inviteStatusOf({ acceptedAt: null, revokedAt: null, expiresAt: earlier }, now)).toBe('expired');
  });

  it('accepted wins over every other fact, and revoked over the clock', () => {
    expect(inviteStatusOf({ acceptedAt: earlier, revokedAt: null, expiresAt: earlier }, now)).toBe(
      'accepted',
    );
    expect(inviteStatusOf({ acceptedAt: null, revokedAt: earlier, expiresAt: earlier }, now)).toBe('revoked');
    expect(inviteStatusOf({ acceptedAt: null, revokedAt: earlier, expiresAt: later }, now)).toBe('revoked');
  });
});
