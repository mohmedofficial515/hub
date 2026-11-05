/**
 * @file Decision reminders with a moving clock (docs/07 §8).
 */
import { reminderDue } from './reminders';

const HOUR = 3_600_000;
const due = new Date('2026-11-10T12:00:00Z');
const at = (hoursBefore: number) => new Date(due.getTime() - hoursBefore * HOUR);

describe('reminderDue', () => {
  it('stays silent before the first offset', () => {
    expect(reminderDue(due, at(30), [24, 2], [])).toBeNull();
  });

  it('gives each offset once', () => {
    const first = reminderDue(due, at(24), [24, 2], []);
    expect(first).toEqual({ offsetHours: 24, sent: [24] });
    expect(reminderDue(due, at(10), [24, 2], first?.sent ?? [])).toBeNull();
    const second = reminderDue(due, at(2), [24, 2], first?.sent ?? []);
    expect(second).toEqual({ offsetHours: 2, sent: [24, 2] });
    expect(reminderDue(due, at(1), [24, 2], second?.sent ?? [])).toBeNull();
  });

  it('a late decision gets one reminder, the nearest, and spends the wider one', () => {
    expect(reminderDue(due, at(1), [24, 2], [])).toEqual({ offsetHours: 2, sent: [24, 2] });
  });

  it('says overdue once', () => {
    const late = reminderDue(due, at(-1), [24, 2], [24, 2]);
    expect(late).toEqual({ offsetHours: null, sent: [24, 2, 0] });
    expect(reminderDue(due, at(-5), [24, 2], late?.sent ?? [])).toBeNull();
  });
});
