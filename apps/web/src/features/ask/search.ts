/**
 * @file search.ts
 * @description What the Ask page reads from `GET /search` (docs/04 §3.9). Marked excerpts become segments, so nothing needs
 * `dangerouslySetInnerHTML`: only `<mark>` carries meaning, every other tag is dropped, and entities are decoded to plain text.
 */
import type { CardSummaryDto } from '@/features/cards/map';
import { toListItem } from '@/features/cards/map';
import type { CardListItem } from '@/features/cards/types';
import { excerptText } from '@/lib/markdown-text';

export type AskScope = 'all' | 'docs' | 'cards';

export interface Segment {
  text: string;
  mark: boolean;
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#x27;': "'",
};

const decode = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (e) => ENTITIES[e] ?? e);

export function toSegments(excerpt: string | null | undefined): Segment[] {
  const segments: Segment[] = [];
  let mark = false;
  for (const piece of (excerpt ?? '').split(/(<\/?mark>)/i)) {
    if (/^<mark>$/i.test(piece)) mark = true;
    else if (/^<\/mark>$/i.test(piece)) mark = false;
    else {
      const text = decode(piece.replace(/<[^>]*>/g, ''));
      if (text) segments.push({ text, mark });
    }
  }
  return segments;
}

const OPEN = '';
const CLOSE = '';

/**
 * An excerpt is cut out of the raw Markdown, so it carries `[ ]`, `](path)`, a fence's language and `*` (live tour). They come out here, across the
 * segments, so a link whose words hold the marked term still reads as those words, with the term still marked.
 */
export function readableSegments(segments: readonly Segment[]): Segment[] {
  const joined = segments.map((s) => (s.mark ? `${OPEN}${s.text}${CLOSE}` : s.text)).join('');
  const out: Segment[] = [];
  let mark = false;
  let text = '';
  for (const ch of excerptText(joined).trim()) {
    if (ch !== OPEN && ch !== CLOSE) {
      text += ch;
      continue;
    }
    if (text) out.push({ text, mark });
    text = '';
    mark = ch === OPEN;
  }
  if (text) out.push({ text, mark });
  return out;
}

export interface DocChunk {
  heading: string | null;
  anchor: string | null;
  excerpt: Segment[];
}

export interface DocHit {
  key: string;
  path: string;
  lang: 'ar' | 'en';
  chunks: DocChunk[];
}

export type CardHit = CardListItem & { excerpt: Segment[] };

export interface AskResults {
  docs: DocHit[];
  cards: CardHit[];
  /** The query was a card's key, so that card comes first and alone at the top. */
  exactKey: boolean;
}

export interface SearchDto {
  cards?: (CardSummaryDto & { highlight?: string | null })[];
  docs?: {
    card: CardSummaryDto;
    path: string;
    chunks?: { heading: string | null; anchor: string | null; excerpt: string }[];
  }[];
}

export function toResults(dto: SearchDto, q: string, scope: AskScope): AskResults {
  const cards =
    scope === 'docs'
      ? []
      : (dto.cards ?? []).map((c) => ({
          ...toListItem(c),
          excerpt: readableSegments(toSegments(c.highlight)),
        }));
  const docs =
    scope === 'cards'
      ? []
      : (dto.docs ?? []).map((hit): DocHit => ({
          key: hit.card.key,
          path: hit.path,
          lang: hit.path.endsWith('.ar.md') ? 'ar' : 'en',
          chunks: (hit.chunks ?? []).map((c) => ({
            heading: c.heading,
            anchor: c.anchor,
            excerpt: readableSegments(toSegments(c.excerpt)),
          })),
        }));
  const exact = cards.find((c) => c.key.toLowerCase() === q.trim().toLowerCase());
  return {
    docs: exact ? [] : docs,
    cards: exact ? [exact] : cards,
    exactKey: !!exact,
  };
}

/** The API's lower limit (docs/04 §3.9): one letter is not a search. */
export const isSearchable = (q: string) => q.trim().length >= 2;

export const nextRecent = (recent: readonly string[], query: string) =>
  [query, ...recent.filter((r) => r !== query)].slice(0, 6);
