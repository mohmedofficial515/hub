/**
 * Data helpers of the policy book: documents (server groups + preference tabs as one shape), values, formatting of a value
 * into words (Arabic plural agreement through Intl.PluralRules), history replay and search.
 */
import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_HISTORY,
  SETTINGS_NOW_ISO,
  SETTINGS_SECTIONS,
  searchFields,
  type Field,
  type FieldValue,
  type Localized,
  type SectionId,
  type SettingsGroup,
  type SettingsHistoryEntry,
  type Subsection,
} from '@lab/mocks/settings';
import type { Locale } from '@lab/i18n';
import type { Messages } from '../i18n';

export type Values = Record<string, FieldValue>;
export type NounKey = keyof Messages['nouns'];

/** A document is anything with subsections of fields: a server group, a special page, or a preference tab. */
export interface Doc {
  key: string;
  scope: 'org' | 'prefs';
  title: Localized;
  subsections: Subsection[];
  group?: SettingsGroup;
}

export const PREF_DOCS: Doc[] = PREFERENCES.map((tab) => ({
  key: `prefs:${tab.id}`,
  scope: 'prefs',
  title: tab.title,
  subsections: [{ id: 'main', title: tab.title, description: tab.description, fields: tab.fields }],
}));

export const ORG_DOCS: Doc[] = SETTINGS_GROUPS.map((group) => ({
  key: group.key,
  scope: 'org',
  title: group.title,
  subsections: group.subsections,
  group,
}));

const DOCS = new Map<string, Doc>([...ORG_DOCS, ...PREF_DOCS].map((doc) => [doc.key, doc]));
export const docOf = (key: string) => DOCS.get(key);
export const fieldsOf = (doc: Doc): Field[] => doc.subsections.flatMap((s) => s.fields);

const FIELD_INDEX = new Map<string, Map<string, Field>>();
export function fieldOf(docKey: string, fieldKey: string): Field | undefined {
  let map = FIELD_INDEX.get(docKey);
  if (!map) {
    const doc = docOf(docKey);
    map = new Map((doc ? fieldsOf(doc) : []).map((f) => [f.key, f]));
    FIELD_INDEX.set(docKey, map);
  }
  return map.get(fieldKey);
}

export function subsectionOf(docKey: string, fieldKey: string): Subsection | undefined {
  return docOf(docKey)?.subsections.find((s) => s.fields.some((f) => f.key === fieldKey));
}

export function sectionOfGroup(groupKey: string) {
  return SETTINGS_SECTIONS.find((s) => s.groupKeys.includes(groupKey));
}
export const chapterIndex = (id: SectionId) => SETTINGS_SECTIONS.findIndex((s) => s.id === id);

export function initialValues(): Record<string, Values> {
  const out: Record<string, Values> = {};
  for (const doc of [...ORG_DOCS, ...PREF_DOCS]) {
    out[doc.key] = Object.fromEntries(fieldsOf(doc).map((f) => [f.key, f.value]));
  }
  return out;
}

export const same = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Values of a group at an older version: replay the history backwards from the saved values. */
export function valuesAtVersion(saved: Values, history: SettingsHistoryEntry[], version: number): Values {
  const out = { ...saved };
  for (const entry of history) {
    if (entry.version <= version) break;
    for (const change of entry.changes) out[change.field] = change.from;
  }
  return out;
}

export const historySeed = (): Record<string, SettingsHistoryEntry[]> =>
  Object.fromEntries(Object.entries(SETTINGS_HISTORY).map(([k, v]) => [k, [...v]]));

/* ─────────────────────────────── formatting ─────────────────────────────── */

const pluralAr = new Intl.PluralRules('ar');
const pluralEn = new Intl.PluralRules('en');

export function num(n: number, digits?: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits ?? 2,
    minimumFractionDigits: digits ?? 0,
  }).format(n);
}

export function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** "3 أيام" / "يومين" / "14 يوماً" / "100 يوم"; English "1 day" / "14 days". */
export function plural(n: number, noun: NounKey, locale: Locale, t: Messages, shown?: string): string {
  const forms = t.nouns[noun];
  const value = shown ?? num(n);
  if (locale === 'ar') {
    const cat = Number.isInteger(n) ? pluralAr.select(n) : 'other';
    if (cat === 'one') return forms.one;
    if (cat === 'two') return forms.two;
    if (cat === 'few') return `${value} ${forms.few}`;
    if (cat === 'many') return `${value} ${forms.many}`;
    return `${value} ${forms.other}`;
  }
  const cat = pluralEn.select(n);
  if (noun === 'time') return n === 1 ? forms.one : n === 2 ? forms.two : `${value} ${forms.other}`;
  if (cat === 'one' && Number.isInteger(n)) return forms.one.replace('1', value);
  return `${value} ${forms.other}`;
}

function money(n: number, locale: Locale, t: Messages) {
  const shown = num(n, Number.isInteger(n) ? 0 : 2);
  if (locale === 'en') return `$${shown}`;
  return plural(n, 'dollar', locale, t, shown);
}

const SECONDS: Record<string, number> = { ms: 0.001, seconds: 1, minutes: 60, hours: 3600, days: 86400 };

/** A duration in the largest unit that divides it exactly (1440 minutes → "يوم", 600 seconds → "10 دقائق"). */
export function duration(n: number, unit: string, locale: Locale, t: Messages): string {
  if (unit === 'months') {
    if (n > 0 && n % 12 === 0) return plural(n / 12, 'year', locale, t);
    return plural(n, 'month', locale, t);
  }
  const base = SECONDS[unit];
  if (base === undefined) return num(n);
  const total = n * base;
  const steps: [number, NounKey][] = [
    [86400 * 365, 'year'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];
  if (total > 0) {
    for (const [size, noun] of steps) {
      // Never break a value into a unit smaller than the one it is stored in (except ms, shown as seconds).
      if (size < base) break;
      const count = total / size;
      if (count >= 1 && Math.abs(count - Math.round(count)) < 1e-9) return plural(Math.round(count), noun, locale, t);
    }
  }
  const nounFor: Record<string, NounKey> = { ms: 'ms', seconds: 'second', minutes: 'minute', hours: 'hour', days: 'day' };
  return plural(n, nounFor[unit] ?? 'minute', locale, t);
}

function bytes(n: number, locale: Locale) {
  const mb = n / 1_000_000;
  return locale === 'ar' ? `${num(mb)} ميغابايت` : `${num(mb)} MB`;
}

export function joinList(items: string[], locale: Locale, t: Messages, max = 6): string {
  if (!items.length) return t.words.emptyList;
  let list = items;
  let tail = '';
  if (items.length > max) {
    list = items.slice(0, max - 1);
    tail = fill(t.words.more, { n: items.length - list.length });
  }
  if (list.length === 1) return list[0] + tail;
  if (tail) return list.join(t.words.listSep) + tail;
  const head = list.slice(0, -1).join(t.words.listSep);
  return locale === 'ar' ? `${head}${t.words.listAnd}${list[list.length - 1]}` : `${head}${t.words.listAnd}${list[list.length - 1]}`;
}

function dateTime(value: string, locale: Locale) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Istanbul',
  }).format(d);
}

const rtf = { ar: new Intl.RelativeTimeFormat('ar-u-nu-latn', { numeric: 'auto' }), en: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) };

/** "قبل 3 أيام" relative to the mock's fixed now. */
export function relative(iso: string, locale: Locale, now = SETTINGS_NOW_ISO): string {
  const diff = (new Date(iso).getTime() - new Date(now).getTime()) / 1000;
  const abs = Math.abs(diff);
  const f = rtf[locale];
  if (abs < 60) return f.format(Math.round(diff), 'second');
  if (abs < 3600) return f.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return f.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 45) return f.format(Math.round(diff / 86400), 'day');
  return f.format(Math.round(diff / (86400 * 30)), 'month');
}

export const loc = (text: Localized | undefined, locale: Locale) => (text ? text[locale] : '');

function optionLabel(field: Field, value: string, locale: Locale) {
  return field.options?.find((o) => o.value === value)?.label[locale] ?? value;
}

/** Phrase override for a value inside sentences (`phrases[doc][field][value]`, with `*.suffix` keys). */
export function phraseFor(t: Messages, docKey: string, fieldKey: string, value: FieldValue): string | undefined {
  const table = t.phrases[docKey];
  if (!table) return undefined;
  const suffix = fieldKey.includes('.') ? `*.${fieldKey.split('.').pop()}` : '';
  const entry = table[fieldKey] ?? (suffix ? table[suffix] : undefined);
  if (!entry) return undefined;
  if (value === null) return entry.__null;
  if (value === '') return entry.__empty;
  if (Array.isArray(value)) return value.length ? undefined : entry.__empty;
  if (typeof value === 'boolean') return entry[value ? '__true' : '__false'];
  return entry[String(value)];
}

export interface FormatOptions {
  noun?: NounKey;
  /** Phrases for sentences; the plain value (details rows, review lines) skips them. */
  docKey?: string;
  /** Long lists collapse after this many items. */
  max?: number;
}

/** A value in words, the way it reads inside a sentence. */
export function formatValue(field: Field, value: FieldValue, locale: Locale, t: Messages, opts: FormatOptions = {}): string {
  if (opts.docKey) {
    const phrase = phraseFor(t, opts.docKey, field.key, value);
    if (phrase !== undefined) return phrase;
  }
  if (value === null || value === undefined) {
    return ['integer', 'number', 'money', 'duration'].includes(field.type) ? t.words.noLimit : t.words.notSet;
  }
  if (typeof value === 'boolean') return value ? t.words.on : t.words.off;

  if (opts.noun) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isNaN(n)) return plural(n, opts.noun, locale, t);
  }

  if (typeof value === 'number') {
    switch (field.type) {
      case 'money':
        return money(value, locale, t);
      case 'duration':
        return duration(value, field.unit ?? 'minutes', locale, t);
      default:
        if (field.unit === 'USD') return money(value, locale, t);
        if (field.unit === 'percent') return fill(t.words.percent, { n: num(value) });
        if (field.unit === 'points') return plural(value, 'point', locale, t);
        if (field.unit === 'bytes') return bytes(value, locale);
        if (field.unit && field.unit in SECONDS) return duration(value, field.unit, locale, t);
        if (field.unit === 'months') return duration(value, 'months', locale, t);
        return num(value);
    }
  }

  if (Array.isArray(value)) {
    const items = value as (string | number)[];
    if (!items.length) return t.words.emptyList;
    if (field.itemType === 'integer' || typeof items[0] === 'number') {
      const nums = items.map((v) => num(Number(v)));
      const unit = field.itemUnit ?? field.unit;
      const tail = unit ? ` ${t.units[unit as keyof Messages['units']] ?? ''}`.trimEnd() : '';
      if (locale === 'ar' && unit) {
        const last = Number(items[items.length - 1]);
        const nounFor: Record<string, NounKey> = { minutes: 'minute', hours: 'hour', days: 'day', seconds: 'second', months: 'month' };
        const noun = nounFor[unit];
        if (noun) {
          const lastWords = plural(last, noun, locale, t);
          return nums.length > 1 ? `${nums.slice(0, -1).join(t.words.ladderSep)}${t.words.ladderSep}${lastWords}` : lastWords;
        }
      }
      return `${nums.join(t.words.ladderSep)}${tail}`;
    }
    const words = items.map((v) => {
      const s = String(v);
      if (field.options) return optionLabel(field, s, locale);
      if (field.format === 'country') return t.countries[s] ?? s;
      return s;
    });
    if (field.ordered) return words.join(locale === 'ar' ? '، ثم ' : ', then ');
    return joinList(words, locale, t, opts.max ?? 6);
  }

  const s = String(value);
  if (field.type === 'enum') return optionLabel(field, s, locale);
  if (field.type === 'secret') return s || t.words.notSaved;
  if (s === '') return t.words.empty;
  if (field.type === 'url') {
    const short = s.replace(/^https?:\/\//, '');
    return short.length > 34 ? `${short.slice(0, 32)}…` : short;
  }
  switch (field.format) {
    case 'datetime':
      return dateTime(s, locale);
    case 'country':
      return t.countries[s] ?? s;
    default:
      break;
  }
  if (field.multiline || s.includes('\n')) {
    const first = s.split('\n')[0];
    return `${first}…`;
  }
  return s.length > 110 ? `${s.slice(0, 108)}…` : s;
}

/** Text direction of a raw value: emails, urls, codes and numbers read left to right inside Arabic. */
export function isLtrValue(field: Field) {
  return (
    field.type === 'url' ||
    field.type === 'secret' ||
    ['email', 'phone', 'cidr', 'hex', 'version', 'iata', 'currency', 'timezone'].includes(field.format ?? '')
  );
}

/* ─────────────────────────────── search ─────────────────────────────── */

export type SearchFilter = 'all' | 'changed' | 'unsaved' | 'proposed' | 'risky';

export interface Hit {
  docKey: string;
  field: Field;
  subsection: Subsection;
}

function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export function matches(text: string, query: string) {
  const q = foldText(query);
  return !!q && foldText(text).includes(q);
}

/** Field-level search: labels, help, keys and values in both languages (mock helper) plus the preference tabs. */
export function search(query: string): Hit[] {
  const q = query.trim();
  const org: Hit[] = q
    ? searchFields(q).map((f) => ({
        docKey: f.groupKey,
        field: fieldOf(f.groupKey, f.key)!,
        subsection: subsectionOf(f.groupKey, f.key)!,
      }))
    : ORG_DOCS.flatMap((doc) => doc.subsections.flatMap((s) => s.fields.map((field) => ({ docKey: doc.key, field, subsection: s }))));
  const prefs: Hit[] = PREF_DOCS.flatMap((doc) =>
    doc.subsections.flatMap((s) =>
      s.fields
        .filter((f) => !q || [f.key, f.label.ar, f.label.en, f.help.ar, f.help.en, doc.title.ar, doc.title.en].some((x) => matches(x, q)))
        .map((field) => ({ docKey: doc.key, field, subsection: s })),
    ),
  );
  return [...org, ...prefs].filter((h) => h.field && h.subsection);
}

export const docTitle = (docKey: string, locale: Locale) => loc(docOf(docKey)?.title, locale);

/** A label without its unit suffix ("أكبر شحن (USD)" → "أكبر شحن"): the value already carries the unit. */
export function cleanLabel(label: string): string {
  return label.replace(/\s*\((?:USD|%|٪|دولار|ساعات|أيام|دقائق|ثوانٍ|ثواني|أشهر|نقاط|hours|days|minutes|seconds|months|points|ms)\)\s*$/i, '').trim();
}
