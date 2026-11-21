/**
 * @file direction.ts
 * @description Which way a piece of text reads, by the majority of its letters. `dir="auto"` takes the first strong letter, so an Arabic body that opens with
 * a product name would flip entirely (review R2). Code and addresses say nothing about the language around them, so they do not count.
 */
export type TextDirection = 'rtl' | 'ltr';

const NOT_PROSE = /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|\]\([^)]*\)/g;

/**
 * A number with its unit or suffix, written left to right: `5xx`, `100 MB`, `16px`, `2%`. In an Arabic sentence the bidi rules take these apart
 * (`100 MB` shows as `MB 100`), so they read as one unit only inside an isolate.
 */
export const LATIN_NUMBER_RUN = /(?<![\p{L}\p{N}])(\d[\d.,:]*\s?(?:%|[A-Za-z][A-Za-z0-9/-]*))/gu;

/** How many letters of each kind the prose has. A number's suffix, the `xx` of `5xx`, is not language. */
function letters(text: string) {
  const prose = text.replace(NOT_PROSE, ' ').replace(LATIN_NUMBER_RUN, ' ');
  const all = prose.match(/\p{L}/gu)?.length ?? 0;
  const rtl =
    prose.match(/[\p{Script=Arabic}\p{Script=Hebrew}]/gu)?.filter((c) => /\p{L}/u.test(c)).length ?? 0;
  return { rtl, ltr: all - rtl };
}

/** `undefined` when the text has no letters, or as many of each: then the browser's own rule, or the document's direction, decides. */
export function textDirection(text: string): TextDirection | undefined {
  const { rtl, ltr } = letters(text);
  if (rtl === ltr) return undefined;
  return rtl > ltr ? 'rtl' : 'ltr';
}

/** A short line of mixed words stays with the document. A block turns only when it has next to nothing of the document's script (review R10). */
const STAYS_AT = 0.1;

export function blockDirection(text: string, around: TextDirection | undefined): TextDirection | undefined {
  if (!around) return textDirection(text);
  const { rtl, ltr } = letters(text);
  const total = rtl + ltr;
  if (total === 0) return around;
  return (around === 'rtl' ? rtl : ltr) / total >= STAYS_AT ? around : around === 'rtl' ? 'ltr' : 'rtl';
}
