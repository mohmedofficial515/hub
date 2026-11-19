/**
 * Locale formatting for the control centre: numbers with Latin digits in both languages (the dashboard's choice),
 * Arabic plural tables, humanised durations, money in USD, readable values for every field type, relative times
 * against the mock's fixed "now".
 */
import type { Locale } from '@lab/i18n';
import { SETTINGS_NOW_ISO, type DurationUnit, type Field, type FieldValue, type Localized } from '@lab/mocks/settings';
import type { Messages, Plural } from '../i18n';

export const NOW = new Date(SETTINGS_NOW_ISO).getTime();

const tag = (locale: Locale) => (locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB');

/** `fill('{n} of {total}', { n: 3, total: 7 })` */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function num(locale: Locale, value: number, digits = 2): string {
  return new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits }).format(value);
}

const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};

/** A counted noun from a plural table: `count('ar', 3, units.days)` → «3 أيام». */
export function count(locale: Locale, n: number, forms: Plural): string {
  pluralRules[locale] ??= new Intl.PluralRules(locale);
  const cat = Number.isInteger(n) ? (pluralRules[locale]!.select(n) as keyof Plural) : 'other';
  return fill(forms[cat] ?? forms.other, { n: num(locale, n) });
}

export function loc(locale: Locale, text: Localized | null | undefined): string {
  return text ? text[locale] : '';
}

export function money(locale: Locale, t: Messages, value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return fill(t.units.usd, { n: new Intl.NumberFormat(tag(locale), { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(value) });
}

export function pct(locale: Locale, t: Messages, value: number): string {
  return fill(t.units.pct, { n: num(locale, value) });
}

/** The largest whole unit: 1440 minutes → 1 day, 730 days → 2 years, 400 days stays 400 days. */
export function humanize(value: number, unit: DurationUnit): { n: number; unit: DurationUnit | 'years' } {
  let n = value;
  let u: DurationUnit | 'years' = unit;
  const step = (size: number, next: DurationUnit | 'years') => {
    if (n >= size && n % size === 0) {
      n /= size;
      u = next;
      return true;
    }
    return false;
  };
  if (u === 'ms' && step(1000, 'seconds')) {
    /* continue */
  }
  if (u === 'seconds' && step(60, 'minutes')) {
    /* continue */
  }
  if (u === 'minutes' && step(60, 'hours')) {
    /* continue */
  }
  if (u === 'hours' && step(24, 'days')) {
    /* continue */
  }
  if (u === 'days' && step(365, 'years')) {
    /* done */
  }
  if (u === 'months' && step(12, 'years')) {
    /* done */
  }
  return { n, unit: u };
}

export function duration(locale: Locale, t: Messages, value: number, unit: DurationUnit, human = true): string {
  const h = human ? humanize(value, unit) : { n: value, unit };
  return count(locale, h.n, t.units[h.unit]);
}

export function dateTime(locale: Locale, iso: string, withTime = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(tag(locale), {
    day: 'numeric',
    month: 'short',
    year: withTime ? undefined : 'numeric',
    hour: withTime ? '2-digit' : undefined,
    minute: withTime ? '2-digit' : undefined,
    timeZone: 'Europe/Istanbul',
  }).format(d);
}

/** "3 days ago" against the mock's fixed now. */
export function relative(locale: Locale, iso: string): string {
  const diff = (new Date(iso).getTime() - NOW) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return rtf.format(Math.round(diff / (86400 * 30)), 'month');
}

export function list(t: Messages, items: string[]): string {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(t.list.sep) + t.list.and + items[items.length - 1];
}

const isDuration = (unit: Field['unit']): unit is DurationUnit =>
  unit === 'ms' || unit === 'seconds' || unit === 'minutes' || unit === 'hours' || unit === 'days' || unit === 'months';

function optionLabel(locale: Locale, field: Pick<Field, 'options'>, value: string): string {
  const option = field.options?.find((o) => o.value === value);
  return option ? option.label[locale] : value;
}

/** A scalar number in the field's unit, as a person reads it. */
export function numberText(locale: Locale, t: Messages, field: Pick<Field, 'type' | 'unit'>, value: number, human = true): string {
  if (field.type === 'money' || field.unit === 'USD') return money(locale, t, value);
  if (isDuration(field.unit)) return duration(locale, t, value, field.unit, human);
  if (field.unit === 'percent') return pct(locale, t, value);
  if (field.unit === 'bytes') return fill(t.units.mb, { n: num(locale, value / 1_000_000, 1) });
  if (field.unit === 'points') return count(locale, value, t.units.points);
  if (field.unit === 'score') return fill(t.units.score, { n: num(locale, value) });
  return num(locale, value);
}

/** Any field value as short readable text (diffs, summaries, search results, history). */
export function valueText(locale: Locale, t: Messages, field: Field | undefined, value: FieldValue, max = 4): string {
  if (value === null || value === undefined || value === '') return t.ctl.notSet;
  if (!field) return Array.isArray(value) ? value.join(t.list.sep) : String(value);
  if (field.type === 'boolean') return value ? t.ctl.on : t.ctl.off;
  if (field.type === 'secret') return String(value);
  if (typeof value === 'number') return numberText(locale, t, field, value);
  if (Array.isArray(value)) {
    if (value.length === 0) return t.ctl.empty;
    const items = (value as Array<string | number>).map((item) => {
      if (typeof item === 'number' || (field.itemType === 'integer' && /^\d+$/.test(String(item)))) {
        const n = Number(item);
        return field.itemUnit ? duration(locale, t, n, field.itemUnit) : num(locale, n);
      }
      return field.options ? optionLabel(locale, field, String(item)) : String(item);
    });
    const shown = items.slice(0, max).join(t.list.sep);
    return items.length > max ? `${shown}${t.list.sep}+${num(locale, items.length - max)}` : shown;
  }
  if (field.type === 'enum') return optionLabel(locale, field, String(value));
  if (field.format === 'datetime') return dateTime(locale, String(value));
  return String(value);
}

/** True when a string value is written left to right (codes, urls, keys, numbers, Latin text). */
export function isLtrValue(field: Pick<Field, 'type' | 'format' | 'key'>): boolean {
  if (field.key.endsWith('.ar')) return false;
  if (field.key.endsWith('.en')) return true;
  return field.type === 'url' || field.type === 'secret' || !!field.format;
}
