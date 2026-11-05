/**
 * @file format.ts
 * @description Ported from F:/Goteav/redesign/hub/today/v5-peacock-app/kit/format.ts. Contract: apps/web/README.md.
 */
import type { Locale } from '@/lib/i18n';

/** Workspace timezone (00-decisions D15 / O3). Every date in the app is shown in it. */
export const TZ = 'Europe/Istanbul';
const HOUR = 3_600_000;
const MIN = 60_000;
export const DAY = 24 * HOUR;

/** Latin digits in both locales (08 P5). */
const tag = (l: Locale) => (l === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

export const nowMs = () => Date.now();
export const hoursFromNow = (iso: string) => (new Date(iso).getTime() - nowMs()) / HOUR;

export function num(n: number, l: Locale) {
  return new Intl.NumberFormat(tag(l)).format(n);
}

/** `YYYY-MM-DD` of an instant in the workspace timezone. */
export function dayKey(iso: string | number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function time(iso: string, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(new Date(iso));
}

export function weekday(iso: string | number, l: Locale, style: 'long' | 'short' = 'short') {
  return new Intl.DateTimeFormat(tag(l), { weekday: style, timeZone: TZ }).format(new Date(iso));
}

/** "Wednesday 4 November" / "الأربعاء، 4 نوفمبر" */
export function longDate(iso: string, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date(iso));
}

/** "4 Nov" / "4 نوفمبر" */
export function shortDate(iso: string | number, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), { day: 'numeric', month: 'short', timeZone: TZ }).format(
    new Date(iso),
  );
}

export function dayOfMonth(iso: string | number) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: TZ }).format(new Date(iso));
}

/** "4 Nov 2026, 08:45" for tooltips and history rows. */
export function absolute(iso: string, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: TZ,
  }).format(new Date(iso));
}

const WORDS = {
  ar: { today: 'اليوم', yesterday: 'أمس', tomorrow: 'غدًا' },
  en: { today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow' },
};

/** A bare weekday names one day only this close: at 7 days it would read as today. */
const WEEKDAY_REACH = 6;

/** "today 12:00", "yesterday 11:30", "tomorrow 17:00", "Fri 18:00" within 6 days either way, otherwise "19 Nov 18:00". */
export function when(iso: string, l: Locale) {
  const days = Math.round((Date.parse(dayKey(iso)) - Date.parse(dayKey(nowMs()))) / DAY);
  const w = WORDS[l];
  const prefix =
    days === 0
      ? w.today
      : days === -1
        ? w.yesterday
        : days === 1
          ? w.tomorrow
          : Math.abs(days) <= WEEKDAY_REACH
            ? weekday(iso, l)
            : shortDate(iso, l);
  return `${prefix} ${time(iso, l)}`;
}

/**
 * Arabic's dual changes with its place in the sentence, and `Intl` only knows the nominative. Nearly every use here follows a
 * preposition or an adverbial slot ("قبل يومين", "خلال ساعتين", "متأخر يومين", "منذ يومين"), so the oblique form is the default.
 */
const DUAL_OBLIQUE = { minute: 'دقيقتين', hour: 'ساعتين', day: 'يومين' } as const;

/**
 * A duration in words with correct Arabic plurals: "15 h" / "15 ساعة", "3 ساعات", "25 دقيقة". Pass `{ nominative: true }` only
 * when the duration is the subject of its sentence ("تبقّى يومان").
 */
export function duration(ms: number, l: Locale, { nominative = false }: { nominative?: boolean } = {}) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  const [value, unit] = (m < 60 ? [m, 'minute'] : h < 36 ? [h, 'hour'] : [d, 'day']) as [
    number,
    keyof typeof DUAL_OBLIQUE,
  ];
  if (l === 'en') return `${value} ${unit === 'minute' ? 'min' : unit === 'hour' ? 'h' : 'd'}`;
  if (value === 2 && !nominative) return DUAL_OBLIQUE[unit];
  return new Intl.NumberFormat(tag(l), { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

/** "in 3 h" / "خلال 3 ساعات", "25 min ago" / "قبل 25 دقيقة" (relative to the mock's NOW). */
export function rel(iso: string, l: Locale) {
  const diff = new Date(iso).getTime() - nowMs();
  const d = duration(diff, l);
  if (l === 'en') return diff > 0 ? `in ${d}` : `${d} ago`;
  return diff > 0 ? `خلال ${d}` : `قبل ${d}`;
}

/** Arabic needs all six plural categories; English needs two. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(n: number, l: Locale, forms: PluralForms) {
  // English has no `zero` category; a provided zero form still wins for 0 ("none overdue").
  const cat = n === 0 && forms.zero ? 'zero' : new Intl.PluralRules(l).select(n);
  const form = forms[cat] ?? forms.other;
  return form.replace('#', num(n, l));
}

export const firstName = (full: string) => full.split(' ')[0];

export const initials = (full: string) =>
  full
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
