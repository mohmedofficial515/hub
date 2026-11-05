/**
 * @file Which reminder a decision is owed now (docs/07 §5.1). Pure, so every offset can be tested with a clock.
 * @description An offset is spent once. A decision created inside two windows gets one reminder, not two: the
 * nearest offset speaks and the wider ones are spent with it. `0` in `remindersSent` is the overdue notice.
 */
export const OVERDUE_OFFSET = 0;

export interface ReminderDue {
  /** Null for the overdue notice. */
  readonly offsetHours: number | null;
  /** What `remindersSent` becomes. */
  readonly sent: readonly number[];
}

const HOUR = 3_600_000;

export function reminderDue(
  dueAt: Date,
  now: Date,
  offsets: readonly number[],
  sent: readonly number[],
): ReminderDue | null {
  const spent = new Set(sent);
  if (now.getTime() >= dueAt.getTime()) {
    if (spent.has(OVERDUE_OFFSET)) return null;
    return { offsetHours: null, sent: [...new Set([...sent, ...offsets, OVERDUE_OFFSET])] };
  }
  const passed = offsets.filter((hours) => dueAt.getTime() - hours * HOUR <= now.getTime());
  const fresh = passed.filter((hours) => !spent.has(hours));
  if (fresh.length === 0) return null;
  return { offsetHours: Math.min(...fresh), sent: [...new Set([...sent, ...passed])] };
}
