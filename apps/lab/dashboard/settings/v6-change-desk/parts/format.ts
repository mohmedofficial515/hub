// Value, unit, number and date formatting for the change desk. Latin digits in both languages (dashboard rule).
import type { Locale } from '@lab/i18n';
import { SETTINGS_NOW_ISO, type DurationUnit, type Field, type FieldValue, type Localized } from '@lab/mocks/settings';
import type { Messages } from '../i18n';

export const NOW = new Date(SETTINGS_NOW_ISO);

const intlLocale = (l: Locale) => (l === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

export function num(n: number, l: Locale, digits = 2): string {
  return new Intl.NumberFormat(intlLocale(l), { maximumFractionDigits: digits }).format(n);
}

export function loc(text: Localized | null | undefined, l: Locale): string {
  return text ? text[l] : '';
}

const DURATION_UNITS: DurationUnit[] = ['ms', 'seconds', 'minutes', 'hours', 'days', 'months'];
export const isDurationUnit = (u: string | undefined): u is DurationUnit => !!u && (DURATION_UNITS as string[]).includes(u);

/** "15 دقيقة", "5 دقائق", "يومان"; "15 minutes", "1 hour". */
export function duration(n: number, unit: DurationUnit, l: Locale, t: Messages): string {
  const forms = t.units[unit];
  if (l === 'ar') {
    if (unit === 'ms') return `${num(n, l)} ${forms[0]}`;
    if (n === 2) return forms[1];
    if (n >= 3 && n <= 10) return `${num(n, l)} ${forms[2]}`;
    return `${num(n, l)} ${forms[0]}`;
  }
  return `${num(n, l)} ${n === 1 ? forms[0] : forms[1]}`;
}

export function money(n: number, l: Locale, t: Messages, digits = 2): string {
  return l === 'ar' ? `${num(n, l, digits)} ${t.units.usd}` : `${num(n, l, digits)} USD`;
}

export function percent(n: number, l: Locale, t: Messages): string {
  return `${num(n, l)}${t.units.percent}`;
}

/** Unit suffix shown next to a stepper (short form). */
export function unitSuffix(field: Pick<Field, 'unit' | 'type'>, t: Messages): string {
  const u = field.unit;
  if (!u) return '';
  if (isDurationUnit(u)) return t.units.short[u];
  if (u === 'percent') return t.units.percent;
  if (u === 'USD') return t.units.usd;
  if (u === 'points') return t.units.points;
  if (u === 'score') return t.units.score;
  if (u === 'bytes') return t.units.bytes;
  return '';
}

function scalar(field: Field, v: number, l: Locale, t: Messages): string {
  const u = field.unit;
  if (isDurationUnit(u)) return duration(v, u, l, t);
  if (u === 'percent') return percent(v, l, t);
  if (u === 'USD' || field.type === 'money') return money(v, l, t);
  if (u === 'points') return `${num(v, l)} ${t.units.points}`;
  if (u === 'score') return `${num(v, l)} ${t.units.score}`;
  if (u === 'bytes') return `${num(v / 1_000_000, l)} ${t.units.bytes}`;
  return num(v, l, 3);
}

function optionLabel(field: Field, v: string, l: Locale): string {
  return field.options?.find((o) => o.value === v)?.label[l] ?? v;
}

export function formatDateTime(iso: string, l: Locale, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(intlLocale(l), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    timeZone: 'Europe/Istanbul',
  }).format(d);
}

export function formatDay(iso: string, l: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(l), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(new Date(iso));
}

export function formatDateLong(d: Date, l: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(l), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' }).format(d);
}

export function timeOfDay(iso: string, l: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(l), { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Istanbul' }).format(new Date(iso));
}

export function relative(iso: string, l: Locale): string {
  const diff = (new Date(iso).getTime() - NOW.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(intlLocale(l), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

/** A field value as readable text ("15 دقيقة", "مفعّل", "Customer's choice", "1، 5، 15، 60 دقيقة"). */
export function formatValue(field: Field, value: FieldValue, l: Locale, t: Messages): string {
  if (value === null || value === undefined) return t.field.notSet;
  if (field.type === 'secret') return typeof value === 'string' ? value : t.values.secret;
  if (typeof value === 'boolean') return value ? t.field.on : t.field.off;
  if (Array.isArray(value)) {
    if (value.length === 0) return t.values.empty;
    if (field.itemUnit) {
      const nums = (value as (string | number)[]).map((v) => num(Number(v), l));
      return `${nums.join(` ${t.arrow} `)} ${t.units.short[field.itemUnit]}`;
    }
    const items = (value as (string | number)[]).map((v) => (field.options ? optionLabel(field, String(v), l) : String(v)));
    return items.join(field.ordered ? ` ${t.arrow} ` : t.listSep);
  }
  if (typeof value === 'number') return scalar(field, value, l, t);
  if (field.type === 'enum') return optionLabel(field, value, l);
  if (field.format === 'datetime') return formatDateTime(value, l);
  return value === '' ? t.values.empty : value;
}

export const sameValue = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Text needs LTR isolation (keys, URLs, e-mails, codes). */
export function looksLtr(text: string): boolean {
  return /^[\x00-\x7F•…·→←\s]+$/.test(text) && /[A-Za-z0-9]/.test(text);
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Relative time against the real clock (restored drafts are saved now, not at the mock's fixed date). */
export function relativeTime(iso: string, l: Locale): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(l === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
