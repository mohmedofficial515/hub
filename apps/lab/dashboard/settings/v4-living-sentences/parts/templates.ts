/**
 * The template engine of the policy book (no React, so the self-test runs in Node).
 *
 * Syntax inside a `book` string (i18n.ts):
 *   {key}  {key:noun}  {key?yes|no}  {=computed}  **bold**
 *   [[cond|text]]   text kept only when cond holds. cond = terms joined by `&`:
 *                   `key` (set / true / non-zero / non-empty), `!key`, `key=A,B`, `key!=A,B`.
 *   {@.suffix} / {#title}  in the shared gateway template: the subsection's key prefix / its title.
 * A sentence is true for every value because clauses that only hold for some values sit in conditions.
 */
import type { FieldValue } from '@lab/mocks/settings';
import type { Locale } from '@lab/i18n';
import type { Messages } from '../i18n';
import { docOf, fieldOf, formatValue, joinList, plural, type NounKey } from './model';

export type Get = (key: string) => FieldValue;
export type Template = { lines: string[]; list: boolean };

export function truthy(v: FieldValue | undefined): boolean {
  if (v === null || v === undefined || v === false || v === '' || v === 0) return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function holds(cond: string, get: Get): boolean {
  return cond.split('&').every((term) => {
    const t = term.trim();
    const ne = t.indexOf('!=');
    if (ne > 0) return !t.slice(ne + 2).split(',').includes(String(get(t.slice(0, ne))));
    const eq = t.indexOf('=');
    if (eq > 0) return t.slice(eq + 1).split(',').includes(String(get(t.slice(0, eq))));
    if (t.startsWith('!')) return !truthy(get(t.slice(1)));
    return truthy(get(t));
  });
}

const COND = /\[\[([^|\]]+)\|((?:(?!\]\]).)*)\]\]/g;

/** Resolve `[[cond|text]]` against the values. */
export function expand(line: string, get: Get): string {
  return line.replace(COND, (_, cond: string, text: string) => (holds(cond, get) ? text : '')).trim();
}

/** Every key a raw line can read (conditions + placeholders), for the self-test. */
export function keysOfRaw(line: string): string[] {
  const out = new Set<string>();
  for (const m of line.matchAll(COND)) for (const term of m[1].split('&')) out.add(term.trim().replace(/^!/, '').split(/!?=/)[0]);
  for (const k of keysIn(line.replace(COND, ' $2 '))) out.add(k);
  return [...out];
}

export type Part =
  | { k: 'text'; s: string; bold?: boolean }
  | { k: 'field'; key: string; noun?: NounKey; words?: [string, string] }
  | { k: 'calc'; name: string };

export function parse(line: string): Part[] {
  const out: Part[] = [];
  const pushText = (s: string) => {
    s.split('**').forEach((chunk, i) => {
      if (chunk) out.push({ k: 'text', s: chunk, bold: i % 2 === 1 });
    });
  };
  let last = 0;
  for (const m of line.matchAll(/\{([^}]+)\}/g)) {
    const at = m.index ?? 0;
    if (at > last) pushText(line.slice(last, at));
    const inner = m[1];
    if (inner.startsWith('=')) out.push({ k: 'calc', name: inner.slice(1) });
    else if (inner.includes('?')) {
      const q = inner.indexOf('?');
      const [yes, no = ''] = inner.slice(q + 1).split('|');
      out.push({ k: 'field', key: inner.slice(0, q), words: [yes, no] });
    } else if (inner.includes(':')) {
      const [key, noun] = inner.split(':');
      out.push({ k: 'field', key, noun: noun as NounKey });
    } else out.push({ k: 'field', key: inner });
    last = at + m[0].length;
  }
  if (last < line.length) pushText(line.slice(last));
  return out;
}

/** Field keys an (expanded) line reads. */
export function keysIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/\{([^}]+)\}/g)) {
    const inner = m[1];
    if (inner.startsWith('=') || inner.startsWith('#')) continue;
    out.push(inner.split('?')[0].split(':')[0]);
  }
  return out;
}

/** The words a token shows. */
export function tokenText(
  docKey: string,
  key: string,
  value: FieldValue,
  opts: { noun?: NounKey; words?: [string, string] },
  locale: Locale,
  t: Messages,
): string {
  const field = fieldOf(docKey, key);
  if (!field) return key;
  if (opts.words) return truthy(value) || value === 0 ? opts.words[0] : opts.words[1];
  return formatValue(field, value, locale, t, { docKey, noun: opts.noun });
}

/** A line as plain text (self-test, copy). */
export function plainLine(t: Messages, locale: Locale, docKey: string, line: string, get: Get): string {
  return parse(line)
    .map((p) => (p.k === 'text' ? p.s : p.k === 'calc' ? computed(p.name, docKey, get, locale, t) : tokenText(docKey, p.key, get(p.key), p, locale, t)))
    .join('');
}

function rawEntry(t: Messages, docKey: string, id: string): string[] | null {
  const entry = t.book[docKey]?.[id];
  if (entry === undefined) return null;
  return typeof entry === 'string' ? [entry] : entry;
}

const SHARED: Record<string, string> = { payment_gateways: 'gateway' };

/** Raw (unexpanded) lines of a subsection, with the shared gateway template filled in. */
export function rawSubsection(t: Messages, locale: Locale, docKey: string, subId: string): Template | null {
  const direct = t.book[docKey]?.[subId];
  if (direct !== undefined) return { lines: rawEntry(t, docKey, subId)!, list: Array.isArray(direct) };
  const shared = SHARED[docKey];
  if (!shared || subId === 'summary') return null;
  const lines = rawEntry(t, docKey, shared);
  if (!lines) return null;
  const sub = docOf(docKey)?.subsections.find((s) => s.id === subId);
  const prefix = sub?.fields[0]?.key.split('.')[0] ?? '';
  const title = sub?.title[locale] ?? subId;
  return { lines: lines.map((l) => l.replaceAll('@.', `${prefix}.`).replaceAll('{#title}', title)), list: false };
}

function expanded(tpl: Template | null, get: Get): Template | null {
  if (!tpl) return null;
  const lines = tpl.lines.map((l) => expand(l, get)).filter(Boolean);
  return lines.length ? { ...tpl, lines } : null;
}

export function subsectionTemplate(t: Messages, locale: Locale, docKey: string, subId: string, get: Get): Template | null {
  return expanded(rawSubsection(t, locale, docKey, subId), get);
}

export function summaryTemplate(t: Messages, docKey: string, get: Get): Template | null {
  const lines = rawEntry(t, docKey, 'summary');
  return expanded(lines ? { lines, list: false } : null, get);
}

/** Read-only phrases computed from several values (`{=name}`). */
export function computed(name: string, docKey: string, get: Get, locale: Locale, t: Messages): string {
  switch (name) {
    case 'enabledGateways': {
      const names = ['Stripe', 'MyFatoorah', 'Paymob', 'Moyasar', 'Tap', 'PayTR', 'iyzico'].filter((_, i) => get(`gateways.${i}.enabled`));
      return joinList(names, locale, t);
    }
    case 'ruleCount': {
      const rules = get('rules');
      return plural(Array.isArray(rules) ? rules.length : 0, 'specialRule', locale, t);
    }
    case 'configuredGateways':
    case 'liveGateways': {
      const names = (docOf(docKey)?.subsections ?? [])
        .filter((s) => {
          const prefix = s.fields[0]?.key.split('.')[0];
          return name === 'liveGateways' ? get(`${prefix}.mode`) === 'live' : get(`${prefix}.source`) !== 'none';
        })
        .map((s) => s.title[locale]);
      return joinList(names, locale, t);
    }
    default:
      return name;
  }
}
