import type { Locale } from '@lab/i18n';
import {
  PREFERENCES,
  SETTINGS_GROUPS,
  SETTINGS_NOW_ISO,
  SETTINGS_SECTIONS,
  type Field,
  type FieldValue,
  type Localized,
  type SectionId,
  type SettingsGroup,
} from '@lab/mocks/settings';
import type { Messages } from '../i18n';

export const NOW = new Date(SETTINGS_NOW_ISO).getTime();

export const loc = (text: Localized, locale: Locale) => text[locale];

export const same = (a: FieldValue | undefined, b: FieldValue | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Every field of a group, in subsection order. */
export const fieldsOf = (group: SettingsGroup): Field[] => group.subsections.flatMap((s) => s.fields);

export const groupByKey = new Map(SETTINGS_GROUPS.map((g) => [g.key, g]));
export const sectionOfGroup = (key: string) => SETTINGS_SECTIONS.find((s) => s.groupKeys.includes(key));

export type PrefTabId = (typeof PREFERENCES)[number]['id'];

/** Numbers always in Latin digits (the dashboard prints Latin digits in both languages). */
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
export const num = (n: number) => nf.format(n);

export function bytes(n: number) {
  if (n >= 1e9) return `${num(n / 1e9)} GB`;
  if (n >= 1e6) return `${num(n / 1e6)} MB`;
  if (n >= 1e3) return `${num(n / 1e3)} KB`;
  return `${num(n)} B`;
}

export function unitText(t: Messages, unit: Field['unit'] | undefined) {
  if (!unit) return '';
  return t.units[unit] ?? '';
}

export function withUnit(t: Messages, n: number, unit: Field['unit'] | undefined) {
  if (unit === 'bytes') return bytes(n);
  if (unit === 'percent') return `${num(n)}%`;
  if (unit === 'USD') return `${num(n)} USD`;
  const u = unitText(t, unit);
  return u ? `${num(n)} ${u}` : num(n);
}

export function dateTime(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Riyadh',
  }).format(d);
}

export function relative(iso: string, locale: Locale) {
  const diff = (new Date(iso).getTime() - NOW) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), 'month');
  return rtf.format(Math.round(diff / (86400 * 365)), 'year');
}

/** A field value as words, for summaries, review sentences and history. */
export function readable(field: Field | undefined, value: FieldValue | undefined, t: Messages, locale: Locale): string {
  if (value === null || value === undefined || value === '') return t.field.notSet;
  if (!field) return Array.isArray(value) ? value.join(', ') : String(value);
  const option = (v: string) => field.options?.find((o) => o.value === v)?.label[locale] ?? v;
  switch (field.type) {
    case 'boolean':
      return value ? t.field.on : t.field.off;
    case 'enum':
      return option(String(value));
    case 'multi-enum':
      return Array.isArray(value) && value.length ? (value as string[]).map(option).join(locale === 'ar' ? '، ' : ', ') : t.field.notSet;
    case 'string-list': {
      if (!Array.isArray(value) || value.length === 0) return '—';
      const items = (value as (string | number)[]).map(String).join(locale === 'ar' ? '، ' : ', ');
      return field.itemUnit ? `${items} ${unitText(t, field.itemUnit)}` : items;
    }
    case 'secret':
      return String(value);
    case 'integer':
    case 'number':
    case 'money':
    case 'duration':
      return typeof value === 'number' ? withUnit(t, value, field.unit) : String(value);
    default:
      if (field.format === 'datetime' && typeof value === 'string') return dateTime(value, locale);
      return String(value);
  }
}

/** Fold Arabic and Latin text for search: lower case, no diacritics, alef / yaa / taa marbuta variants unified. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

export type FieldFlag = 'changed' | 'proposed' | 'risky';

export interface Hit {
  /** `group:<key>` / `<group>.<field>` / `pref:<tab>.<field>` */
  id: string;
  kind: 'group' | 'field' | 'pref';
  groupKey?: string;
  prefTab?: PrefTabId;
  sectionId?: SectionId;
  field?: Field;
  subsection?: Localized;
  group?: SettingsGroup;
  score: number;
}

interface SearchCtx {
  locale: Locale;
  values: (groupKey: string, field: Field) => FieldValue;
  prefValue: (tab: PrefTabId, field: Field) => FieldValue;
  hidden: (groupKey: string) => boolean;
}

/** Field-level search over labels, help, keys and values in both languages, plus filter tokens. */
export function search(query: string, flags: Set<FieldFlag>, ctx: SearchCtx): Hit[] {
  const q = fold(query);
  if (!q && flags.size === 0) return [];
  const hits: Hit[] = [];
  const matchField = (f: Field, value: FieldValue, path: string) => {
    if (flags.has('changed') && same(value, f.default)) return -1;
    if (flags.has('proposed') && !f.proposed && !f.proposedOptions) return -1;
    if (flags.has('risky') && f.risk !== 'high' && f.control !== 'security') return -1;
    if (!q) return 1;
    const label = fold(`${f.label.ar} ${f.label.en}`);
    if (label.includes(q)) return label.startsWith(q) ? 10 : 8;
    if (fold(path).includes(q)) return 6;
    if (fold(`${f.help.ar} ${f.help.en}`).includes(q)) return 4;
    const v = Array.isArray(value) ? value.join(' ') : String(value ?? '');
    const optionText = f.options?.map((o) => `${o.label.ar} ${o.label.en}`).join(' ') ?? '';
    if (fold(v).includes(q) || fold(optionText).includes(q)) return 3;
    return -1;
  };

  for (const group of SETTINGS_GROUPS) {
    if (ctx.hidden(group.key)) continue;
    if (q && flags.size === 0) {
      const gt = fold(`${group.title.ar} ${group.title.en} ${group.key} ${group.summary.ar} ${group.summary.en}`);
      if (gt.includes(q)) hits.push({ id: `group:${group.key}`, kind: 'group', groupKey: group.key, sectionId: group.section, group, score: 20 });
    }
    for (const sub of group.subsections) {
      for (const f of sub.fields) {
        const score = matchField(f, ctx.values(group.key, f), `${group.key}.${f.key}`);
        if (score > 0)
          hits.push({ id: `${group.key}.${f.key}`, kind: 'field', groupKey: group.key, sectionId: group.section, field: f, subsection: sub.title, group, score });
      }
    }
  }
  for (const tab of PREFERENCES) {
    for (const f of tab.fields) {
      const score = matchField(f, ctx.prefValue(tab.id, f), `${tab.id}.${f.key}`);
      if (score > 0) hits.push({ id: `pref:${tab.id}.${f.key}`, kind: 'pref', prefTab: tab.id, field: f, subsection: tab.title, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** The subsection a field lives in. */
export function subsectionOf(group: SettingsGroup, fieldKey: string) {
  return group.subsections.find((s) => s.fields.some((f) => f.key === fieldKey));
}

export function findField(group: SettingsGroup, fieldKey: string) {
  return fieldsOf(group).find((f) => f.key === fieldKey);
}

/** Read a hash query param from the frame URL. */
export function hashParam(name: string): string | null {
  const query = location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get(name);
}

/** Keep the deep-link params in the frame hash without re-rendering the lab (replaceState fires no hashchange). */
export function writeHash(params: Record<string, string | null>, push = false) {
  const [path, query = ''] = location.hash.split('?');
  const sp = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === '') sp.delete(k);
    else sp.set(k, v);
  }
  const next = `${path}?${sp.toString()}`;
  if (next === location.hash) return;
  if (push) history.pushState(null, '', next);
  else history.replaceState(null, '', next);
}

export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
