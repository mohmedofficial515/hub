/**
 * @file The lab's README front-matter (docs/10 §1, §6): the subset the lab itself reads, and an editor that touches
 * only the lines it changes. A line edit, not a re-serialise, so comments, order, quoting and the body stay byte for byte.
 */
export type FrontMatter = Record<string, string | string[]>;

interface Block {
  /** Index in the source where the lines start and end. */
  readonly start: number;
  readonly end: number;
  readonly newline: string;
  readonly lines: string[];
}

function blockOf(raw: string): Block | null {
  const bom = raw.startsWith('﻿') ? 1 : 0;
  const match = /^---(\r?\n)([\s\S]*?)\r?\n---(?=\r?\n|$)/.exec(raw.slice(bom));
  if (!match?.[1] || match[2] === undefined) return null;
  const start = bom + 3 + match[1].length;
  return { start, end: start + match[2].length, newline: match[1], lines: match[2].split(/\r?\n/) };
}

const stripComment = (line: string): string => line.replace(/\s+#.*$/, '').trimEnd();
const unquote = (value: string): string => value.replace(/^['"]|['"]$/g, '');

export function parseFrontMatter(raw: string): { data: FrontMatter; body: string } {
  const block = blockOf(raw);
  if (!block) return { data: {}, body: raw.replace(/^﻿/, '') };
  const data: FrontMatter = {};
  let list: string | null = null;
  for (const source of block.lines) {
    const line = stripComment(source);
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    const current = list ? data[list] : undefined;
    if (item?.[1] !== undefined && Array.isArray(current)) {
      current.push(unquote(item[1].trim()));
      continue;
    }
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!pair?.[1]) continue;
    const key = pair[1];
    const value = pair[2] ?? '';
    if (value === '') {
      data[key] = [];
      list = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((part) => unquote(part.trim()))
        .filter(Boolean);
      list = null;
    } else {
      data[key] = unquote(value);
      list = null;
    }
  }
  const after = raw.slice(block.end).replace(/^\r?\n---\r?\n?/, '');
  return { data, body: after };
}

export function textField(data: FrontMatter, key: string): string | null {
  const value = data[key];
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : null;
  return value ?? null;
}

const scalar = (value: string): string =>
  /^[\w./@:+-][\w ./@:+()-]*$/.test(value) && !/:\s/.test(value) ? value : JSON.stringify(value);

/**
 * Sets keys, keeping everything else exactly. A key already there keeps its place and its trailing comment; a new key
 * joins the end of the block. A key whose value was a block list (`ported:` empty, or a dash list) takes the new value.
 */
export function setFrontMatter(raw: string, patch: Readonly<Record<string, string>>): string {
  const block = blockOf(raw);
  if (!block) throw new Error('This README has no front-matter');
  const lines = [...block.lines];
  for (const [key, value] of Object.entries(patch)) {
    const at = lines.findIndex((line) => new RegExp(`^${key}:(\\s|$)`).test(line));
    if (at === -1) {
      lines.push(`${key}: ${scalar(value)}`);
      continue;
    }
    const comment = /\s+#.*$/.exec(lines[at] ?? '')?.[0] ?? '';
    lines[at] = `${key}: ${scalar(value)}${comment}`;
    let next = at + 1;
    while (next < lines.length && /^\s*-\s+/.test(lines[next] ?? '')) lines.splice(next, 1);
    next = at + 1;
  }
  return raw.slice(0, block.start) + lines.join(block.newline) + raw.slice(block.end);
}

/** Adds a dated line under `## Review notes`, creating the heading at the end of the file (docs/10 §6). */
export function appendReviewNote(raw: string, line: string): string {
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const heading = /^## Review notes[ \t]*\r?$/m.exec(raw);
  if (!heading) {
    const trimmed = raw.replace(/\s*$/, '');
    return `${trimmed}${newline}${newline}## Review notes${newline}${newline}- ${line}${newline}`;
  }
  const from = heading.index + heading[0].length;
  const nextHeading = /^#{1,2} /m.exec(raw.slice(from + 1));
  const end = nextHeading ? from + 1 + nextHeading.index : raw.length;
  const section = raw.slice(from, end).replace(/\s*$/, '');
  return `${raw.slice(0, from)}${section}${newline}- ${line}${newline}${nextHeading ? newline : ''}${raw.slice(end)}`;
}

/**
 * Score and summary of a `review.md` (docs/10 §1, docs/06 §5): a `score:` front-matter key wins, then the pillar table's
 * mean times ten, then a plain `n/100`. The summary is `## Summary`'s first paragraph, else the prose directly after the
 * table (past blank lines and rules), else the `**Overall: …**` line. A heading after the table means the findings have
 * begun, so nothing further down stands in for a verdict.
 */
export function reviewOf(markdown: string): { score: number | null; summary: string | null } {
  const { data, body } = parseFrontMatter(markdown);
  const declared = Number(textField(data, 'score'));
  const lines = body.split(/\r?\n/);
  const header = lines.findIndex((line) => /^\|\s*Pillar\s*\|\s*Score\s*\/\s*10\s*\|/i.test(line));
  let score: number | null = Number.isFinite(declared) && declared > 0 ? Math.round(declared) : null;
  let tableEnd = -1;
  if (header >= 0) {
    const scores: number[] = [];
    let at = header + 1;
    for (; at < lines.length && /^\s*\|/.test(lines[at] ?? ''); at += 1) {
      const cell = /^\s*\|[^|]*\|\s*([\d.]+)\s*\|/.exec(lines[at] ?? '')?.[1];
      if (cell) scores.push(Number(cell));
    }
    tableEnd = at;
    if (score === null && scores.length > 0) {
      score = Math.round((scores.reduce((sum, n) => sum + n, 0) / scores.length) * 10);
    }
  }
  if (score === null) {
    const plain = /\b(\d{1,3})\s*\/\s*100\b/.exec(body)?.[1];
    if (plain) score = Number(plain);
  }
  const paragraphAt = (start: number): string | null => {
    const out: string[] = [];
    for (let at = start; at < lines.length; at += 1) {
      const line = (lines[at] ?? '').trim();
      if (!line || NOT_PROSE.test(line)) break;
      out.push(line);
    }
    return out.length > 0 ? out.join(' ') : null;
  };
  /** The next line with anything on it, past blanks and horizontal rules. */
  const nextContent = (start: number): number => {
    let at = start;
    while (at < lines.length && (!(lines[at] ?? '').trim() || RULE.test((lines[at] ?? '').trim()))) at += 1;
    return at;
  };
  const named = lines.findIndex((line) => /^##\s+Summary\b/i.test(line));
  const overall = lines.findIndex((line) => /^\*\*Overall\b/i.test(line.trim()));
  const afterTable = tableEnd >= 0 ? paragraphAt(nextContent(tableEnd)) : null;
  const summary =
    (named >= 0 ? paragraphAt(nextContent(named + 1)) : null) ??
    (afterTable && !isLabel(afterTable) ? afterTable : null) ??
    (overall >= 0 ? paragraphAt(overall) : null);
  return { score, summary: summary ? plainReviewText(summary) : null };
}

const RULE = /^([-*_])(\s*\1){2,}$/;
/** Lines a summary paragraph cannot hold: a heading, a table, a list, a quote, a rule. */
const NOT_PROSE = /^(#|\||>|[-*+]\s|\d+\.\s|([-*_])(\s*\2){2,}$)/;
/** "Owner goals:" or "**Owner goals**" introduces what follows. It says nothing by itself. */
const isLabel = (text: string): boolean => text.endsWith(':') || /^\*\*[^*]+\*\*:?$/.test(text);
const plainReviewText = (text: string): string => text.replace(/\*\*|`/g, '').slice(0, 280);
