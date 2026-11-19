// Readable values for rows, the review sheet and history: units, money, enums, lists, null.

import { SETTINGS_NOW_ISO, type Field, type FieldValue, type Localized } from '@lab/mocks/settings';
import type { Locale } from '@lab/i18n';
import type { Messages } from '../i18n';

export const numberLocale = (locale: Locale) => (locale === 'ar' ? 'ar-u-nu-latn' : 'en');

export function fmtNumber(n: number, locale: Locale, digits?: number): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    maximumFractionDigits: digits ?? 2,
    minimumFractionDigits: digits ?? 0,
  }).format(n);
}

export const loc = (text: Localized | null | undefined, locale: Locale) => (text ? text[locale] : '');

/** "15 دقيقة" / "15 minutes", with the Arabic plural forms of each unit. */
export function withUnit(n: number, unit: Field['unit'], locale: Locale, t: Messages): string {
  if (!unit) return fmtNumber(n, locale);
  if (unit === 'percent') return `${fmtNumber(n, locale)}%`;
  if (unit === 'USD') {
    // "$1,250" kept as one left-to-right run, also inside Arabic text.
    const usd = new Intl.NumberFormat('en', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
    return locale === 'ar' ? `⁦${usd}⁩` : usd;
  }
  if (unit === 'bytes') {
    const steps = ['B', 'KB', 'MB', 'GB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < steps.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${fmtNumber(v, locale, i ? 1 : 0)} ${steps[i]}`;
  }
  const forms = t.unitForms[unit as keyof Messages['unitForms']];
  if (!forms) return fmtNumber(n, locale);
  return t.countWith(n, forms, fmtNumber(n, locale));
}

/** Suffix shown next to a number input. */
export function unitSuffix(field: Field, t: Messages): string {
  if (!field.unit) return '';
  return t.unitShort[field.unit as keyof Messages['unitShort']] ?? '';
}

export function optionLabel(field: Field, value: string, locale: Locale): string {
  return field.options?.find((o) => o.value === value)?.label[locale] ?? value;
}

/** One-line readable value. Lists show the first three items and "+N". */
export function formatValue(field: Field, value: FieldValue | undefined, locale: Locale, t: Messages, max = 3): string {
  if (value === null || value === undefined || value === '') return field.type === 'secret' ? t.value.noKey : t.value.notSet;
  switch (field.type) {
    case 'boolean':
      return value ? t.value.on : t.value.off;
    case 'enum':
      return optionLabel(field, String(value), locale);
    case 'multi-enum': {
      const list = Array.isArray(value) ? value.map((v) => optionLabel(field, String(v), locale)) : [String(value)];
      return list.length ? joinList(list, locale, max, t) : t.value.none;
    }
    case 'string-list': {
      const list = Array.isArray(value) ? value.map(String) : [String(value)];
      if (!list.length) return t.value.emptyList;
      if (field.itemType === 'integer') {
        const nums = (value as Array<number | string>).map((v) => fmtNumber(Number(v), locale));
        const unit = field.itemUnit ? ` ${t.unitShort[field.itemUnit]}` : '';
        return `${nums.join(` ${t.arrow} `)}${unit}`;
      }
      return joinList(list, locale, max, t);
    }
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return typeof value === 'number' ? withUnit(value, field.unit, locale, t) : String(value);
    case 'secret': {
      const s = String(value);
      return s.startsWith('••••') ? s : `••••${s.slice(-4)}`;
    }
    default:
      if (field.format === 'datetime' && typeof value === 'string') return fmtDateTime(value, locale);
      return String(value);
  }
}

function joinList(list: string[], locale: Locale, max: number, t: Messages): string {
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  const joined = new Intl.ListFormat(locale, { type: 'conjunction', style: 'narrow' }).format(shown);
  return rest > 0 ? `${joined} ${t.value.more(rest)}` : joined;
}

export function fmtDateTime(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function fmtDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: 'medium' }).format(new Date(iso));
}

/** "منذ 3 أيام" against the mock's fixed now. */
export function fmtRelative(iso: string, locale: Locale): string {
  const diff = (new Date(iso).getTime() - new Date(SETTINGS_NOW_ISO).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(numberLocale(locale), { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

/** Validation of a draft value against min / max / format. Returns a message or null. */
export function validate(field: Field, value: FieldValue | undefined, t: Messages, locale: Locale): string | null {
  if (value === null || value === undefined) {
    return field.nullable || field.type === 'secret' || field.type === 'string' || field.type === 'url' ? null : t.errors.required;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return t.errors.number;
    if (field.min !== undefined && value < field.min) return t.errors.min(withUnit(field.min, field.unit, locale, t));
    if (field.max !== undefined && value > field.max) return t.errors.max(withUnit(field.max, field.unit, locale, t));
    if (field.type === 'integer' && !Number.isInteger(value)) return t.errors.integer;
  }
  if (typeof value === 'string' && value) {
    if (field.type === 'url' && !/^https?:\/\/\S+$/i.test(value)) return t.errors.url;
    if (field.format === 'email' && !/^\S+@\S+\.\S+$/.test(value)) return t.errors.email;
    if (field.format === 'phone' && !/^\+\d{7,15}$/.test(value)) return t.errors.phone;
    if (field.type === 'string' && field.max !== undefined && value.length > field.max) return t.errors.tooLong(field.max);
  }
  if (Array.isArray(value) && field.type === 'multi-enum' && field.min && value.length < field.min) return t.errors.pickOne;
  return null;
}
