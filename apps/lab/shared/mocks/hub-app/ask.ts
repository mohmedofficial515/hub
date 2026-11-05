// Ask fixtures: a small stand-in for GET /workspaces/{ws}/search (04 §3.9). It searches the same doc text the viewer
// shows and the card catalogue, and returns excerpts with marked terms. No text is generated (D06).
//
// The real `excerpt` / `highlight` is `ts_headline` HTML with `<mark>` only. Here it is already split into segments, so
// the page never needs `dangerouslySetInnerHTML`.

import { docContent, docRefs } from './docs';
import type { CardType, HubCard, L } from './index';

export type AskScope = 'all' | 'docs' | 'cards';
export type Segment = { text: string; mark?: boolean };

export interface DocChunkHit {
  heading: string | null;
  anchor: string | null;
  excerpt: Segment[];
  rank: number;
}

export interface DocHit {
  key: string;
  path: string;
  source: string;
  lang: 'ar' | 'en';
  chunks: DocChunkHit[];
  rank: number;
}

export interface CardHit {
  key: string;
  type: CardType;
  title: L;
  status: string;
  excerpt: Segment[];
  rank: number;
}

export interface AskResults {
  docs: DocHit[];
  cards: CardHit[];
  exactKey: boolean;
}

export const ASK_SUGGESTIONS: { q: L }[] = [
  { q: { ar: 'الاسترداد', en: 'refund' } },
  { q: { ar: 'TOTP', en: 'TOTP' } },
  { q: { ar: 'Duffel balance', en: 'Duffel balance' } },
];

const STOP = new Set(['how', 'are', 'is', 'the', 'to', 'a', 'an', 'of', 'in', 'on', 'for', 'and', 'or', 'do', 'does', 'what', 'who', 'when', 'where', 'why', 'we', 'it', 'كيف', 'ما', 'ماذا', 'من', 'الى', 'في', 'على', 'هل', 'عن', 'لماذا', 'متى', 'اين']);

/** Enough of `unaccent` and the Arabic letter forms for the lab. The real search also has trigram matching. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

function termsOf(q: string) {
  return fold(q)
    .split(/[\s،,.؟?!:;()"'«»]+/)
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

/** `fold` keeps every character's length except the marks it drops, so match on a position map. */
function folded(text: string) {
  const map: number[] = [];
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (let n = 0; n < f.length; n++) {
      map.push(i);
      out += f[n];
    }
  }
  return { out, map };
}

function highlight(text: string, terms: string[], radius = 95): { segments: Segment[]; hits: number } {
  const { out, map } = folded(text);
  const ranges: [number, number][] = [];
  const matched = new Set<string>();
  for (const term of terms) {
    let at = out.indexOf(term);
    while (at >= 0) {
      matched.add(term);
      ranges.push([map[at], map[at + term.length - 1] + 1]);
      at = out.indexOf(term, at + term.length);
    }
  }
  if (!ranges.length) return { segments: [], hits: 0 };
  ranges.sort((a, b) => a[0] - b[0]);
  const from = Math.max(0, ranges[0][0] - radius);
  const to = Math.min(text.length, ranges[0][1] + radius * 1.5);
  const start = from === 0 ? 0 : text.indexOf(' ', from) + 1 || from;
  const end = to === text.length ? to : text.lastIndexOf(' ', to) > ranges[0][1] ? text.lastIndexOf(' ', to) : to;
  const segments: Segment[] = [];
  let at = start;
  if (start > 0) segments.push({ text: '…' });
  for (const [a, b] of ranges) {
    if (a < at || b > end) continue;
    if (a > at) segments.push({ text: text.slice(at, a) });
    segments.push({ text: text.slice(a, b), mark: true });
    at = b;
  }
  if (at < end) segments.push({ text: text.slice(at, end) });
  if (end < text.length) segments.push({ text: '…' });
  return { segments, hits: matched.size };
}

const plain = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\|?[\s:|-]+\|?$/gm, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_>|#]/g, ' ')
    .replace(/^-\s\[[ x]\]/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

interface Chunk {
  heading: string | null;
  anchor: string | null;
  text: string;
}

function chunksOf(md: string): Chunk[] {
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    const text = plain(body.join('\n'));
    if (text) chunks.push({ heading, anchor: heading ? slug(heading) : null, text });
    body = [];
  };
  for (const line of md.split('\n')) {
    const m = /^(#{1,4})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      heading = m[1].length === 1 ? null : m[2];
    } else body.push(line);
  }
  flush();
  return chunks;
}

/** The index: built once, because the docs do not change while the lab runs. */
const docIndex = docRefs.map((ref) => ({ ref, chunks: chunksOf(docContent(ref.key)) }));

export function searchProject(q: string, scope: AskScope, cards: HubCard[], locale: 'ar' | 'en'): AskResults {
  const query = q.trim();
  const exact = /^GTV-\d+$/i.test(query) ? query.toUpperCase() : null;
  const terms = termsOf(query);
  const results: AskResults = { docs: [], cards: [], exactKey: false };
  if (!terms.length && !exact) return results;

  if (scope !== 'cards' && !exact) {
    for (const { ref, chunks } of docIndex) {
      const hits: DocChunkHit[] = [];
      for (const chunk of chunks) {
        const inHeading = chunk.heading ? highlight(chunk.heading, terms).hits : 0;
        const { segments, hits: inBody } = highlight(chunk.text, terms);
        if (!inBody && !inHeading) continue;
        hits.push({ heading: chunk.heading, anchor: chunk.anchor, excerpt: segments.length ? segments : [{ text: chunk.text.slice(0, 180) }], rank: inBody + inHeading * 2 });
      }
      if (hits.length) {
        hits.sort((a, b) => b.rank - a.rank);
        results.docs.push({ key: ref.key, path: ref.path, source: ref.source, lang: ref.lang, chunks: hits.slice(0, 2), rank: hits[0].rank + Math.min(hits.length, 3) * 0.1 });
      }
    }
    results.docs.sort((a, b) => b.rank - a.rank);
    results.docs = results.docs.slice(0, 6);
  }

  if (scope !== 'docs') {
    for (const card of cards) {
      if (card.type === 'doc') continue;
      if (exact) {
        if (card.key === exact) {
          results.cards.push({ key: card.key, type: card.type, title: card.title, status: card.status, excerpt: card.body ? [{ text: card.body[locale].slice(0, 180) }] : [], rank: 100 });
          results.exactKey = true;
        }
        continue;
      }
      const title = highlight(`${card.title.en} ${card.title.ar}`, terms).hits;
      const bodyText = card.body?.[locale] ?? '';
      const body = highlight(bodyText, terms);
      const otherBody = card.body ? highlight(card.body[locale === 'ar' ? 'en' : 'ar'], terms) : { segments: [], hits: 0 };
      const rank = title * 2 + body.hits + otherBody.hits * 0.5;
      if (rank <= 0) continue;
      results.cards.push({ key: card.key, type: card.type, title: card.title, status: card.status, excerpt: body.segments.length ? body.segments : otherBody.segments, rank });
    }
    results.cards.sort((a, b) => b.rank - a.rank);
    results.cards = results.cards.slice(0, 8);
  }
  return results;
}
