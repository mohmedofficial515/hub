/**
 * @file Lockout rule (docs/03 §2): 10 failures per email or per IP within 15 minutes lock for 15 minutes.
 * @description The lock starts at the failure that completed the tenth inside the window, so it lasts the
 * full 15 minutes however the failures were spread.
 */
export const LOCKOUT_FAILURES = 10;
export const LOCKOUT_WINDOW_MS = 15 * 60_000;
/** How far back a query must look: one window of failures plus one lock. */
export const LOCKOUT_LOOKBACK_MS = LOCKOUT_WINDOW_MS * 2;

/** When the lock ends, or null when `failures` do not lock at `now`. */
export function lockedUntil(failures: readonly Date[], now: Date): Date | null {
  const times = failures.map((failure) => failure.getTime()).sort((a, b) => a - b);
  let until: number | null = null;
  for (let index = LOCKOUT_FAILURES - 1; index < times.length; index += 1) {
    const last = times[index] as number;
    const first = times[index - LOCKOUT_FAILURES + 1] as number;
    if (last - first <= LOCKOUT_WINDOW_MS) until = last + LOCKOUT_WINDOW_MS;
  }
  return until !== null && until > now.getTime() ? new Date(until) : null;
}
