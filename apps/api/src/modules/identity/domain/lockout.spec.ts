/**
 * @file The lockout rule.
 */
import { lockedUntil, LOCKOUT_FAILURES, LOCKOUT_WINDOW_MS } from './lockout';

const start = new Date('2026-11-05T09:00:00.000Z').getTime();
const failuresEvery = (count: number, gapMs: number): Date[] =>
  Array.from({ length: count }, (_, index) => new Date(start + index * gapMs));

describe('lockedUntil', () => {
  it('nine failures do not lock', () => {
    const failures = failuresEvery(LOCKOUT_FAILURES - 1, 1000);
    expect(lockedUntil(failures, new Date(start + 10_000))).toBeNull();
  });

  it('the tenth locks for 15 minutes from itself', () => {
    const failures = failuresEvery(LOCKOUT_FAILURES, 1000);
    const last = start + 9000;
    expect(lockedUntil(failures, new Date(last + 1))).toEqual(new Date(last + LOCKOUT_WINDOW_MS));
  });

  it('the lock ends after 15 minutes', () => {
    const failures = failuresEvery(LOCKOUT_FAILURES, 1000);
    expect(lockedUntil(failures, new Date(start + 9000 + LOCKOUT_WINDOW_MS))).toBeNull();
  });

  it('ten failures spread wider than the window do not lock', () => {
    const failures = failuresEvery(LOCKOUT_FAILURES, 2 * 60_000);
    expect(lockedUntil(failures, new Date(start + 18 * 60_000 + 1))).toBeNull();
  });

  it('order of the input does not matter', () => {
    const failures = failuresEvery(LOCKOUT_FAILURES, 1000).reverse();
    expect(lockedUntil(failures, new Date(start + 10_000))).not.toBeNull();
  });
});
