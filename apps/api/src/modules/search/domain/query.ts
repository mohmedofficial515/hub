/**
 * @file The wider search when an exact one finds little (docs/03 §12): any word instead of all, with the common Arabic
 * spellings of each. `hub_simple` has no stemmer, so `الاسترداد` and `استرداد` are different words to it. Pure.
 */
const ARABIC = /\p{Script=Arabic}/u;

function arabicVariants(word: string): string[] {
  const out = new Set<string>([word]);
  const bare = word.startsWith('ال') && word.length > 3 ? word.slice(2) : word;
  out.add(bare);
  out.add(`ال${bare}`);
  for (const form of [...out]) {
    if (/^[اأإآ]/u.test(form)) for (const alef of ['ا', 'أ', 'إ']) out.add(alef + form.slice(1));
    if (form.endsWith('ة')) out.add(`${form.slice(0, -1)}ه`);
    if (form.endsWith('ه')) out.add(`${form.slice(0, -1)}ة`);
    if (form.endsWith('ى')) out.add(`${form.slice(0, -1)}ي`);
    if (form.endsWith('ي')) out.add(`${form.slice(0, -1)}ى`);
  }
  return [...out];
}

export function wordsOf(query: string): string[] {
  return query.match(/[\p{L}\p{N}_-]{2,}/gu) ?? [];
}

/** A `to_tsquery` string. Words are quoted, so nothing in them is an operator. */
export function widenedQuery(query: string): string | null {
  const terms = new Set<string>();
  for (const word of wordsOf(query)) {
    for (const form of ARABIC.test(word) ? arabicVariants(word) : [word.toLowerCase()]) {
      terms.add(`'${form.replace(/'/g, "''")}'`);
    }
  }
  return terms.size > 0 ? [...terms].join(' | ') : null;
}

const START = '\u0001';
const STOP = '\u0002';

export const HEADLINE_OPTIONS = `StartSel=${START},StopSel=${STOP},MaxFragments=2,MaxWords=30,MinWords=8,FragmentDelimiter=" … "`;

/**
 * The marks a person reads as noise in a line of prose: emphasis, inline code, heading and list marks, a link's address. Text inside them stays, and an
 * underscore or star inside a word (`snake_case`, `2*3`) is left alone. It runs before the highlight markers are turned into tags.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|[\s(])#{1,6}\s+/g, '$1')
    .replace(/(^|\n)\s*(?:[-*+]|\d+\.)\s+/g, '$1')
    .replace(/(^|\n)\s*>\s?/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/`+/g, '')
    .replace(/(\*\*|__)(?=\S)|(?<=\S)(\*\*|__)/g, '')
    .replace(/(^|[\s(\u0001])[*_](?=\S)/g, '$1')
    .replace(/(?<=\S)[*_](?=$|[\s).,:;!?\u0002])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Clears the Markdown, escapes everything, then lets the one tag through: a document's own HTML must not run on the page. */
export function safeExcerpt(headline: string): string {
  return stripMarkdown(headline)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .split(START)
    .join('<mark>')
    .split(STOP)
    .join('</mark>');
}
