/**
 * @file Reading a Markdown file for the index (docs/06 §6): title, kind, language, headings, chunks. Pure.
 */
export interface Heading {
  readonly level: number;
  readonly text: string;
  readonly anchor: string;
}

export interface Chunk {
  readonly heading: string | null;
  readonly anchor: string | null;
  readonly content: string;
}

const MAX_CHUNK = 1500;
const MIN_CHUNK = 100;

/** Leaves the body; front-matter is lab or tool metadata, not text anyone searches for. */
export function stripFrontMatter(raw: string): string {
  const source = raw.replace(/^﻿/, '');
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(source);
  return match ? source.slice(match[0].length) : source;
}

/** GitHub-style anchors, keeping Arabic letters, and unique within the file. */
export function slugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const base = text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

interface Line {
  readonly text: string;
  readonly fenced: boolean;
}

function linesOf(body: string): Line[] {
  let fence: string | null = null;
  return body.split(/\r?\n/).map((text) => {
    const marker = /^\s*(```+|~~~+)/.exec(text)?.[1];
    const wasFenced = fence !== null;
    if (marker && fence === null) fence = marker[0] ?? null;
    else if (marker && marker[0] === fence) fence = null;
    return { text, fenced: wasFenced || marker !== undefined };
  });
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function headingsOf(body: string): Heading[] {
  const slug = slugger();
  return linesOf(body).flatMap(({ text, fenced }) => {
    const match = fenced ? null : HEADING.exec(text);
    if (!match?.[1] || !match[2] || match[1].length > 4) return [];
    return [{ level: match[1].length, text: match[2], anchor: slug(match[2]) }];
  });
}

export function titleOf(body: string, fileName: string): string {
  const first = headingsOf(body).find((heading) => heading.level === 1);
  const title = first?.text ?? fileName.replace(/\.(ar\.)?md$/i, '');
  return title.slice(0, 200);
}

/** `.ar.md`, or at least 30% Arabic letters (docs/06 §6). */
export function langOf(path: string, body: string): 'ar' | 'en' {
  if (/\.ar\.md$/i.test(path)) return 'ar';
  const letters = body.match(/\p{L}/gu)?.length ?? 0;
  const arabic = body.match(/\p{Script=Arabic}/gu)?.length ?? 0;
  return letters > 0 && arabic / letters >= 0.3 ? 'ar' : 'en';
}

/** `**` any depth, `*` within a folder, `?` one character. Paths use `/`. */
export function matchesGlob(path: string, glob: string): boolean {
  let pattern = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index] ?? '';
    if (char === '*' && glob[index + 1] === '*') {
      index += 1;
      if (glob[index + 1] === '/') {
        index += 1;
        pattern += '(?:.*/)?';
      } else {
        pattern += '.*';
      }
    } else if (char === '*') pattern += '[^/]*';
    else if (char === '?') pattern += '[^/]';
    else pattern += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${pattern}$`).test(path);
}

const DEFAULT_KINDS: Readonly<Record<string, string>> = {
  '**/adr/*': 'adr',
  'adr/*': 'adr',
  '**/status/*': 'status',
  'status/*': 'status',
};

export function kindOf(path: string, kinds: Readonly<Record<string, string>> = {}): string {
  for (const [glob, kind] of Object.entries({ ...kinds, ...DEFAULT_KINDS })) {
    if (matchesGlob(path, glob)) return kind;
  }
  return /(^|\/)README\.md$/i.test(path) ? 'readme' : 'doc';
}

/** Blocks of a section: a fenced block and a table are never split, a paragraph may be if it alone is too long. */
function blocksOf(lines: readonly Line[]): string[] {
  const blocks: string[] = [];
  let current: string[] = [];
  let inTable = false;
  const flush = (): void => {
    if (current.some((line) => line.trim())) blocks.push(current.join('\n').trim());
    current = [];
    inTable = false;
  };
  for (const { text, fenced } of lines) {
    const tableRow = !fenced && /^\s*\|/.test(text);
    if (!fenced && !text.trim()) {
      flush();
      continue;
    }
    if (tableRow !== inTable && current.length > 0 && !fenced) flush();
    inTable = tableRow;
    current.push(text);
  }
  flush();
  return blocks;
}

function pack(blocks: readonly string[]): string[] {
  const out: string[] = [];
  let current = '';
  for (const block of blocks) {
    if (current && current.length + block.length + 2 > MAX_CHUNK) {
      out.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${block}` : block;
  }
  if (current) out.push(current);
  return out;
}

/**
 * Split at `#` to `###`, then on blank lines up to 1 500 characters. A chunk under 100 characters joins the one before
 * it. Fenced code and tables stay whole, and may be longer than the limit by themselves (docs/06 §6).
 */
export function chunksOf(body: string): Chunk[] {
  const slug = slugger();
  const sections: { heading: string | null; anchor: string | null; lines: Line[] }[] = [
    { heading: null, anchor: null, lines: [] },
  ];
  const path: (string | undefined)[] = [];
  for (const line of linesOf(body)) {
    const match = line.fenced ? null : HEADING.exec(line.text);
    const hashes = match?.[1];
    const text = match?.[2];
    if (hashes && text) {
      const anchor = slug(text);
      if (hashes.length <= 3) {
        path.length = hashes.length - 1;
        path[hashes.length - 1] = text;
        sections.push({ heading: path.filter(Boolean).join(' › '), anchor, lines: [] });
        continue;
      }
    }
    sections.at(-1)?.lines.push(line);
  }
  const chunks: Chunk[] = [];
  for (const section of sections) {
    for (const content of pack(blocksOf(section.lines))) {
      const last = chunks.at(-1);
      if (content.length < MIN_CHUNK && last) {
        chunks[chunks.length - 1] = { ...last, content: `${last.content}\n\n${content}` };
      } else {
        chunks.push({ heading: section.heading, anchor: section.anchor, content });
      }
    }
  }
  return chunks;
}

export const wordCountOf = (body: string): number => body.split(/\s+/).filter(Boolean).length;

/** Paths of Markdown documents a card's text mentions (H5-03). */
export function docMentionsIn(text: string): string[] {
  const found = text.match(/(?:[\w.-]+\/)*[\w.-]+\.md\b/g) ?? [];
  return [...new Set(found)];
}
