/**
 * @file images.ts
 * @description The images a document draws from its own source folder (decision 13b, 09 §11). A relative address is asked of the API's
 * `GET /docs/{key}/image`, which resolves it against the document's folder and refuses any way out. Anything with a scheme, `//` or a
 * leading `/` is not local: a remote image stays its alt text with a link, so no request leaves Hub.
 */
import { marked, type Token, type Tokens } from 'marked';

import { API_PREFIX } from '@/lib/api/client';

export interface DocImageRef {
  /** The address as the document writes it. */
  src: string;
  alt: string;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function isLocalImage(src: string): boolean {
  const s = src.trim();
  return s !== '' && !SCHEME.test(s) && !s.startsWith('/') && !s.startsWith('#') && !s.includes('\\');
}

export const docImageUrl = (ws: string, key: string, src: string) =>
  `${API_PREFIX}/workspaces/${encodeURIComponent(ws)}/docs/${encodeURIComponent(key)}/image?src=${encodeURIComponent(src)}`;

/** The file's own name, for the Lightbox caption and a download. */
export function imageName(src: string): string {
  const last = src.split(/[?#]/)[0]?.split('/').pop() ?? src;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function collect(tokens: readonly Token[] | undefined, out: DocImageRef[]) {
  for (const token of tokens ?? []) {
    if (token.type === 'code' || token.type === 'codespan' || token.type === 'html') continue;
    if (token.type === 'image') {
      const image = token as Tokens.Image;
      if (isLocalImage(image.href)) out.push({ src: image.href, alt: image.text });
      continue;
    }
    if (token.type === 'table') {
      const table = token as Tokens.Table;
      for (const cell of [...table.header, ...table.rows.flat()]) collect(cell.tokens, out);
      continue;
    }
    if (token.type === 'list') {
      for (const item of (token as Tokens.List).items) collect(item.tokens, out);
      continue;
    }
    if ('tokens' in token && Array.isArray(token.tokens)) collect(token.tokens, out);
  }
}

/** Every local image of a document in reading order, each address once: what the Lightbox steps through. */
export function localImagesOf(source: string): DocImageRef[] {
  const all: DocImageRef[] = [];
  collect(marked.lexer(source), all);
  const seen = new Set<string>();
  return all.filter((image) => (seen.has(image.src) ? false : (seen.add(image.src), true)));
}
