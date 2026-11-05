/**
 * @file Calendar arithmetic, including a DST change.
 */
import {
  addDays,
  isoWeekOf,
  localDate,
  localMinutes,
  startOfLocalDate,
  weekFromIso,
  weeklyMoment,
} from './dates';

describe('dates', () => {
  it('reads the local date in the project timezone', () => {
    expect(localDate(new Date('2026-11-04T22:30:00Z'), 'Europe/Istanbul')).toBe('2026-11-05');
    expect(localDate(new Date('2026-11-04T22:30:00Z'), 'UTC')).toBe('2026-11-04');
    expect(localMinutes(new Date('2026-11-05T04:30:00Z'), 'Europe/Istanbul')).toBe(7 * 60 + 30);
  });

  it('finds the instant a local day begins, across a DST change', () => {
    expect(startOfLocalDate('2026-11-05', 'Europe/Istanbul').toISOString()).toBe('2026-11-04T21:00:00.000Z');
    expect(startOfLocalDate('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfLocalDate('2026-03-09', 'America/New_York').toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });

  it('names ISO weeks at the edges of a year', () => {
    expect(isoWeekOf('2026-11-05')).toEqual({ iso: '2026-W45', from: '2026-11-02', to: '2026-11-08' });
    expect(isoWeekOf('2027-01-01').iso).toBe('2026-W53');
    expect(isoWeekOf('2024-12-30').iso).toBe('2025-W01');
    expect(weekFromIso('2026-W45')?.from).toBe('2026-11-02');
    expect(weekFromIso('2026-W99')).toBeNull();
    expect(weekFromIso('nope')).toBeNull();
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('reads the weekly setting', () => {
    expect(weeklyMoment('SUN 08:00')).toEqual({ weekday: 7, minutes: 480 });
    expect(weeklyMoment('mon 09:30')).toEqual({ weekday: 1, minutes: 570 });
  });
});
