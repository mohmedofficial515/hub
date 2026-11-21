import type { Locale } from '@lab/i18n';
import { NOW } from '@lab/mocks/hub-today';

/** Workspace timezone (00-decisions D15 / O3). Every date on the page is shown in it. */
export const TZ = 'Europe/Istanbul';
const HOUR = 3_600_000;
const MIN = 60_000;

const tag = (l: Locale) => (l === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

export const nowMs = () => new Date(NOW).getTime();
export const hoursFromNow = (iso: string) => (new Date(iso).getTime() - nowMs()) / HOUR;

export function num(n: number, l: Locale) {
  return new Intl.NumberFormat(tag(l)).format(n);
}

/** `YYYY-MM-DD` of an instant in the workspace timezone. */
export function dayKey(iso: string | number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function time(iso: string, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(iso));
}

export function weekday(iso: string | number, l: Locale, style: 'long' | 'short' = 'short') {
  return new Intl.DateTimeFormat(tag(l), { weekday: style, timeZone: TZ }).format(new Date(iso));
}

/** "Wednesday 4 November" / "الأربعاء، 4 نوفمبر" */
export function longDate(iso: string, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(new Date(iso));
}

/** "4 Nov" / "4 نوفمبر" */
export function shortDate(iso: string | number, l: Locale) {
  return new Intl.DateTimeFormat(tag(l), { day: 'numeric', month: 'short', timeZone: TZ }).format(new Date(iso));
}

export function dayOfMonth(iso: string | number) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: TZ }).format(new Date(iso));
}

const WORDS = {
  ar: { today: 'اليوم', yesterday: 'أمس', tomorrow: 'غدًا' },
  en: { today: 'today', yesterday: 'yesterday', tomorrow: 'tomorrow' },
};

const daysAway = (iso: string) => Math.round((Date.parse(dayKey(iso)) - Date.parse(dayKey(NOW))) / (24 * HOUR));

/** "today 12:00", "yesterday 11:30", "tomorrow 17:00", otherwise "Fri 18:00". */
export function when(iso: string, l: Locale) {
  const days = daysAway(iso);
  const w = WORDS[l];
  const prefix = days === 0 ? w.today : days === -1 ? w.yesterday : days === 1 ? w.tomorrow : weekday(iso, l);
  return `${prefix} ${time(iso, l)}`;
}

/** The word for a due day on its own: "today", "tomorrow", otherwise "Fri". */
export function dayWord(iso: string, l: Locale) {
  const days = daysAway(iso);
  const w = WORDS[l];
  return days === 0 ? w.today : days === 1 ? w.tomorrow : weekday(iso, l);
}

/** A day heading in the story of what changed: "Today", "Yesterday", or the weekday and date. */
export function dayTitle(iso: string, l: Locale) {
  const days = daysAway(iso);
  const w = WORDS[l];
  const cap = (s: string) => (l === 'en' ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  if (days === 0) return cap(w.today);
  if (days === -1) return cap(w.yesterday);
  return `${weekday(iso, l, 'long')} ${shortDate(iso, l)}`;
}

/** A duration in words with correct Arabic plurals: "15 h" / "15 ساعة", "3 ساعات", "25 دقيقة". */
export function duration(ms: number, l: Locale) {
  const m = Math.max(1, Math.round(Math.abs(ms) / MIN));
  const h = Math.round(m / 60);
  const d = Math.round(h / 24);
  const [value, unit] = m < 60 ? [m, 'minute'] : h < 36 ? [h, 'hour'] : [d, 'day'];
  if (l === 'en') return `${value} ${unit === 'minute' ? 'min' : unit === 'hour' ? 'h' : 'd'}`;
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
