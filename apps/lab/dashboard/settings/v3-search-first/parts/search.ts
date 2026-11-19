// Field-level search: labels, help, keys, values and option names in Arabic and English, with Arabic letter folding,
// whole-word synonyms, one-typo tolerance (audit F-01, research pattern 2) and match ranges for highlighting.

import { SETTINGS_GROUPS, isChangedFromDefault, type FieldValue } from '@lab/mocks/settings';
import type { Locale } from '@lab/i18n';
import { allEntries, type Entry } from './model';

/** Arabic-aware folding of one character (diacritics out, alef / yaa / taa marbuta variants folded). */
function foldChar(c: string): string {
  if (/[ً-ٰٟـ]/.test(c)) return '';
  if (/[أإآٱ]/.test(c)) return 'ا';
  if (c === 'ى') return 'ي';
  if (c === 'ة') return 'ه';
  if (c === 'ؤ') return 'و';
  if (c === 'ئ') return 'ي';
  return c
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

export function fold(text: string): string {
  let out = '';
  for (const c of text) out += foldChar(c);
  return out;
}

/** Folded text plus, for every folded character, the index of the source character. */
function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = '';
  const map: number[] = [];
  let i = 0;
  for (const c of text) {
    const f = foldChar(c);
    for (let k = 0; k < f.length; k += 1) map.push(i);
    folded += f;
    i += c.length;
  }
  return { folded, map };
}

export type Range = [start: number, end: number];

/** Source ranges of every token found in `text`, merged. */
export function matchRanges(text: string, tokens: string[]): Range[] {
  if (!tokens.length || !text) return [];
  const { folded, map } = foldWithMap(text);
  const ranges: Range[] = [];
  for (const token of tokens) {
    if (!token) continue;
    let from = 0;
    for (;;) {
      const at = folded.indexOf(token, from);
      if (at < 0) break;
      const end = at + token.length - 1;
      ranges.push([map[at], (map[end] ?? text.length - 1) + 1]);
      from = at + token.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r] as Range);
  }
  return merged;
}

/**
 * Words that mean the same thing in the settings (both languages), folded at load. A synonym counts only as a whole
 * word (after stripping a leading Arabic article / conjunction) or as a word prefix when it has 4+ letters, so short
 * synonyms like "fx", "key" or "otp" never match inside longer words.
 */
const SYNONYM_SETS: string[][] = [
  ['قفل', 'lockout'],
  ['هامش', 'markup', 'margin', 'عمولة'],
  ['محفظة', 'wallet'],
  ['ضريبة', 'tax', 'vat', 'kdv'],
  ['صيانة', 'maintenance'],
  ['واتساب', 'whatsapp', 'كرتات', 'cartat'],
  ['استرداد', 'refund', 'ارجاع'],
  ['احتيال', 'fraud', '3ds'],
  ['رمز', 'otp', 'code'],
  ['مورد', 'supplier', 'provider', 'duffel'],
  ['اشعار', 'اشعارات', 'notification', 'notifications', 'تنبيه', 'alert'],
  ['دخول', 'login', 'signin'],
  ['مفتاح', 'key', 'secret'],
  ['عملة', 'currency', 'fx'],
  ['احتفاظ', 'retention'],
];
const SYNONYMS = new Map<string, string[]>();
for (const set of SYNONYM_SETS) {
  const folded = set.map(fold);
  for (const word of folded) SYNONYMS.set(word, folded);
}

const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ب', 'ل'].map(fold);

/** Light Arabic stem: drop one leading article / conjunction when 3+ letters remain. */
export function stem(word: string): string {
  for (const p of PREFIXES) if (word.startsWith(p) && word.length - p.length >= 3) return word.slice(p.length);
  return word;
}

/** Folded words of a text (split on non-letters and camelCase), plus their stems. */
function wordsOf(text: string): string[] {
  const split = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .map(fold)
    .filter(Boolean);
  return [...new Set(split.flatMap((w) => [w, stem(w)]))];
}

/** Levenshtein distance; returns 2 early when lengths differ by more than one (we only need "≤ 1"). */
function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export function tokensOf(query: string): string[] {
  return fold(query)
    .split(/[\s،,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type FilterId = 'changed' | 'risk' | 'proposed' | 'attention';

export interface SearchOptions {
  query: string;
  filters: FilterId[];
  section: string | null;
  locale: Locale;
  valueOf: (entry: Entry) => FieldValue;
  visible: (entry: Entry) => boolean;
}

export interface Hit {
  entry: Entry;
  score: number;
  /** Where the query matched when it is not the label: shown as "matched in …". */
  matchedIn: 'label' | 'help' | 'key' | 'value' | 'path' | 'synonym' | 'typo' | null;
  /** The synonym or corrected word that made the match ("lockout"), shown in the row. */
  via?: string;
}

const ATTENTION = new Set(SETTINGS_GROUPS.filter((g) => g.attention).map((g) => g.key));

export function passesFilter(entry: Entry, filter: FilterId, value: FieldValue): boolean {
  const f = entry.field;
  switch (filter) {
    case 'changed':
      return isChangedFromDefault({ ...f, value });
    case 'risk':
      return f.risk === 'high';
    case 'proposed':
      return !!f.proposed || !!f.proposedOptions?.length;
    case 'attention':
      return ATTENTION.has(entry.groupKey) || !!f.deprecated;
  }
}

interface Texts {
  labelAr: string;
  labelEn: string;
  help: string;
  key: string;
  value: string;
  path: string;
  groupAr: string;
  groupEn: string;
  labelWords: string[];
  otherWords: string[];
}

const textCache = new Map<string, Texts>();

function texts(entry: Entry, value: FieldValue): Texts {
  const valueText = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  const cacheKey = `${entry.id}|${valueText}`;
  const cached = textCache.get(cacheKey);
  if (cached) return cached;
  const f = entry.field;
  const optionTexts = (f.options ?? []).flatMap((o) => [o.label.ar, o.label.en, o.value]).join(' ');
  const helpRaw = `${f.help.ar} ${f.help.en} ${f.note?.ar ?? ''} ${f.note?.en ?? ''}`;
  const pathRaw = `${entry.sectionTitle.ar} ${entry.sectionTitle.en} ${entry.groupTitle.ar} ${entry.groupTitle.en} ${entry.subsectionTitle.ar} ${entry.subsectionTitle.en}`;
  const keyRaw = `${entry.id} ${f.key} ${f.proposalId ?? ''}`;
  const out: Texts = {
    labelAr: fold(f.label.ar),
    labelEn: fold(f.label.en),
    help: fold(helpRaw),
    key: fold(keyRaw),
    value: fold(`${valueText} ${optionTexts}`),
    path: fold(pathRaw),
    groupAr: fold(entry.groupTitle.ar),
    groupEn: fold(entry.groupTitle.en),
    labelWords: wordsOf(`${f.label.ar} ${f.label.en} ${keyRaw}`),
    otherWords: wordsOf(`${helpRaw} ${pathRaw} ${valueText} ${optionTexts}`),
  };
  textCache.set(cacheKey, out);
  return out;
}

type Where = Exclude<Hit['matchedIn'], null>;
interface Scored {
  score: number;
  where: Where;
  via?: string;
}

/**
 * Direct (substring) match of what was typed. Exact label / key matches rank above help and value; a match on the
 * group's own title lifts the group's fields (typing "markup" ranks Markup rules above a loyalty field that mentions it).
 */
function scoreToken(tx: Texts, token: string, locale: Locale): Scored | null {
  const base = scoreDirect(tx, token, locale);
  const inGroup = (locale === 'ar' ? tx.groupAr : tx.groupEn).includes(token);
  if (!inGroup) return base;
  if (base?.where === 'label') return { score: base.score + 25, where: 'label' };
  return { score: Math.max(base?.score ?? 0, 75), where: 'path' };
}

function scoreDirect(tx: Texts, token: string, locale: Locale): Scored | null {
  const label = locale === 'ar' ? tx.labelAr : tx.labelEn;
  const other = locale === 'ar' ? tx.labelEn : tx.labelAr;
  if (label === token) return { score: 140, where: 'label' };
  if (label.startsWith(token)) return { score: 120, where: 'label' };
  if (label.includes(` ${token}`)) return { score: 100, where: 'label' };
  if (label.includes(token)) return { score: 85, where: 'label' };
  if (other.includes(token)) return { score: 70, where: 'label' };
  if (tx.key.includes(token)) return { score: 60, where: 'key' };
  if (tx.path.includes(token)) return { score: 30, where: 'path' };
  if (tx.help.includes(token)) return { score: 24, where: 'help' };
  if (tx.value.includes(token)) return { score: 18, where: 'value' };
  return null;
}

const wordMatches = (words: string[], w: string) => words.some((x) => x === w || (w.length >= 4 && x.startsWith(w)));

/** A synonym as a whole word (or 4+ letter stem); always ranked below direct label / key / help matches. */
function scoreSynonym(tx: Texts, token: string): Scored | null {
  const alts = SYNONYMS.get(token) ?? SYNONYMS.get(stem(token));
  if (!alts) return null;
  for (const alt of alts) if (alt !== token && wordMatches(tx.labelWords, alt)) return { score: 16, where: 'synonym', via: alt };
  for (const alt of alts) if (alt !== token && wordMatches(tx.otherWords, alt)) return { score: 8, where: 'synonym', via: alt };
  return null;
}

/** One typo (edit distance ≤ 1) for tokens of 4+ letters, against whole words or word starts. */
function scoreTypo(tx: Texts, token: string): Scored | null {
  if (token.length < 4) return null;
  const near = (w: string) => w.length >= 3 && (lev(token, w) <= 1 || (w.length > token.length && lev(token, w.slice(0, token.length)) <= 1));
  const inLabel = tx.labelWords.find(near);
  if (inLabel) return { score: 22, where: 'typo', via: inLabel };
  const inOther = tx.otherWords.find(near);
  if (inOther) return { score: 6, where: 'typo', via: inOther };
  return null;
}

/** Every entry matching all tokens (directly, through a whole-word synonym, or with one typo) and all active filters. */
export function search(opts: SearchOptions): Hit[] {
  const strict = searchPass(opts, false);
  // One-typo matching only when nothing matches as typed (or through a synonym): it never adds noise to good results.
  return strict.length || !tokensOf(opts.query).some((t) => t.length >= 4) ? strict : searchPass(opts, true);
}

function searchPass(opts: SearchOptions, fuzzy: boolean): Hit[] {
  const tokens = tokensOf(opts.query);
  const hits: Hit[] = [];
  for (const entry of allEntries()) {
    if (!opts.visible(entry)) continue;
    if (opts.section && entry.sectionId !== opts.section) continue;
    const value = opts.valueOf(entry);
    if (opts.filters.some((flt) => !passesFilter(entry, flt, value))) continue;
    if (!tokens.length) {
      hits.push({ entry, score: 0, matchedIn: null });
      continue;
    }
    const tx = texts(entry, value);
    let total = 0;
    let where: Where | null = null;
    let via: string | undefined;
    let ok = true;
    for (const token of tokens) {
      const best = scoreToken(tx, token, opts.locale) ?? scoreSynonym(tx, token) ?? (fuzzy ? scoreTypo(tx, token) : null);
      if (!best) {
        ok = false;
        break;
      }
      total += best.score;
      if (!where || best.where === 'label') where = best.where;
      if (best.via && !via) via = best.via;
    }
    if (!ok) continue;
    if (entry.scope === 'pref') total -= 5;
    hits.push({ entry, score: total, matchedIn: where, via: where === 'synonym' || where === 'typo' ? via : undefined });
  }
  return tokens.length ? hits.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order) : hits;
}

export interface HitGroup {
  groupKey: string;
  hits: Hit[];
  best: number;
}

/** Hits grouped by group, groups ordered by their best hit (or display order when there is no query). */
export function groupHits(hits: Hit[], hasQuery: boolean): HitGroup[] {
  const map = new Map<string, HitGroup>();
  for (const hit of hits) {
    const g = map.get(hit.entry.groupKey) ?? { groupKey: hit.entry.groupKey, hits: [], best: -Infinity };
    g.hits.push(hit);
    g.best = Math.max(g.best, hasQuery ? hit.score : -hit.entry.order);
    map.set(hit.entry.groupKey, g);
  }
  return [...map.values()].sort((a, b) => b.best - a.best);
}

/** Tokens to mark: what was typed, plus the synonym / corrected word of a hit. */
export function highlightTokens(query: string, via?: string): string[] {
  const tokens = tokensOf(query);
  return via ? [...tokens, via] : tokens;
}
