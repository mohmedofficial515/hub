/**
 * @file markdown-text.ts
 * @description Markdown as plain text, for a clamped excerpt where `MarkdownView`'s blocks cannot go, and the rule for which links a body may carry.
 * Real card bodies are Markdown: imported decisions and version READMEs (review B2).
 */
import { marked, type Token, type Tokens } from 'marked';

const decode = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

function inlineText(tokens: readonly Token[] | undefined): string {
  return (tokens ?? [])
    .map((token) => {
      switch (token.type) {
        case 'html':
        case 'checkbox':
          return '';
        case 'br':
          return ' ';
        case 'image':
          return (token as Tokens.Image).text;
        case 'codespan':
          return decode((token as Tokens.Codespan).text);
        case 'text':
        case 'escape': {
          const text = token as Tokens.Text;
          return text.tokens ? inlineText(text.tokens) : decode(text.text);
        }
        default:
          return 'tokens' in token && Array.isArray(token.tokens)
            ? inlineText(token.tokens)
            : decode(token.raw);
      }
    })
    .join('');
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The first thing a reader would read as prose: the first paragraph, wherever its heading is, else the first list, else the first heading.
 * Rules, tables, code and raw HTML never stand in for it.
 */
export function markdownExcerpt(source: string): string {
  const tokens = marked.lexer(source);
  for (const token of tokens) {
    if (token.type !== 'paragraph') continue;
    const text = tidy(inlineText((token as Tokens.Paragraph).tokens));
    if (text) return text;
  }
  const list = tokens.find((token): token is Tokens.List => token.type === 'list');
  if (list) {
    return list.items
      .map((item) => tidy(item.tokens.map((t) => inlineText('tokens' in t ? t.tokens : undefined)).join(' ')))
      .filter(Boolean)
      .join(' · ');
  }
  const heading = tokens.find((token): token is Tokens.Heading => token.type === 'heading');
  return heading ? tidy(inlineText(heading.tokens)) : '';
}

/** One line of inline Markdown, such as a heading or a table cell, as the words a reader sees: `[x](y)` is `x`, and no `*`, `_` or backtick markers. */
export function inlineMarkdownText(source: string): string {
  return tidy(inlineText(marked.Lexer.lexInline(source)));
}

/**
 * A search excerpt is a window cut out of the raw file, so it can start or end inside a link or a fence. This takes the Markdown out of it
 * line by line, without parsing: list and task markers, heading and quote markers, a fence's language line, `[x](y)` as `x` (and the cut halves
 * of one), and emphasis and code markers. An underscore inside a word, as in `save_doc`, stays.
 */
export function excerptText(text: string): string {
  return (
    text
      .replace(/(^|\n)[ \t]*(```+|~~~+)[^\n]*/g, '$1')
      .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, '$1')
      .replace(/\]\([^)\s]*\)?/g, '')
      .replace(/(^|\n)[ \t]*>[ \t]?/g, '$1')
      .replace(/(^|\n)[ \t]*#{1,6}[ \t]+/g, '$1')
      .replace(/(^|\n)[ \t]*(?:[-*+]|\d+[.)])[ \t]+/g, '$1')
      .replace(/(^|\s)\[[ xX]\][ \t]+/g, '$1')
      .replace(/\*+|`+|~~/g, '')
      .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, '')
      // A truncated link leaves its opening bracket behind.
      .replace(/\[(?=[^\]]*$)/g, '')
      .replace(/[ \t]*\n[ \t]*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
  );
}

/** Web and mail links, and the app's own paths. A `javascript:` or `data:` link in an imported body stays as its words. */
export function isSafeHref(href: string): boolean {
  // Browsers ignore tabs and newlines inside a scheme, and leading spaces, so they must not hide one here.
  const clean = href.replace(/[\u0000- ]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(clean)?.[1]?.toLowerCase();
  return scheme === undefined || scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}
