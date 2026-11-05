/**
 * @file Calendar arithmetic in a project's timezone, DST-safe (docs/07 §8). Local dates are `YYYY-MM-DD` strings.
 */
const parts = (at: Date, timezone: string): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );

export function localDate(at: Date, timezone: string): string {
  const { year, month, day } = parts(at, timezone);
  return `${year}-${month}-${day}`;
}

/** Minutes since local midnight. */
export function localMinutes(at: Date, timezone: string): number {
  const { hour, minute } = parts(at, timezone);
  return Number(hour) * 60 + Number(minute);
}

export function addDays(date: string, days: number): string {
  const utc = new Date(`${date}T00:00:00Z`);
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/** 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The instant a local date begins. Asks the timezone twice, so a DST change that day is right. */
export function startOfLocalDate(date: string, timezone: string): Date {
  const wanted = Date.parse(`${date}T00:00:00Z`);
  const offsetAt = (instant: number): number => {
    const p = parts(new Date(instant), timezone);
    const shown = Date.UTC(
      Number(p['year']),
      Number(p['month']) - 1,
      Number(p['day']),
      Number(p['hour']),
      Number(p['minute']),
      Number(p['second']),
    );
    return shown - instant;
  };
  const first = wanted - offsetAt(wanted);
  return new Date(wanted - offsetAt(first));
}

export interface LocalWeek {
  readonly iso: string;
  /** Monday. */
  readonly from: string;
  /** Sunday. */
  readonly to: string;
}

/** The ISO week holding a local date: `2026-W45`. */
export function isoWeekOf(date: string): LocalWeek {
  const from = addDays(date, 1 - isoWeekday(date));
  const thursday = addDays(from, 3);
  const year = Number(thursday.slice(0, 4));
  const firstThursdayWeek = addDays(`${year}-01-04`, 1 - isoWeekday(`${year}-01-04`));
  const week = 1 + Math.round((Date.parse(from) - Date.parse(firstThursdayWeek)) / (7 * 86_400_000));
  return { iso: `${year}-W${String(week).padStart(2, '0')}`, from, to: addDays(from, 6) };
}

/** The Monday of `2026-W45`, or null if it is not one. */
export function weekFromIso(iso: string): LocalWeek | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = `${match[1]}-01-04`;
  const from = addDays(addDays(year, 1 - isoWeekday(year)), (Number(match[2]) - 1) * 7);
  const week = isoWeekOf(from);
  return week.iso === iso ? week : null;
}

const WEEKDAYS: Readonly<Record<string, number>> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

/** Parses `HH:MM`. */
export const minutesOf = (time: string): number => {
  const [hour = '0', minute = '0'] = time.split(':');
  return Number(hour) * 60 + Number(minute);
};

/** Parses `SUN 08:00`. Falls back to Sunday when the day is unreadable. */
export function weeklyMoment(value: string): { weekday: number; minutes: number } {
  const [day = 'SUN', time = '08:00'] = value.trim().split(/\s+/);
  return { weekday: WEEKDAYS[day.toUpperCase()] ?? 7, minutes: minutesOf(time) };
}
