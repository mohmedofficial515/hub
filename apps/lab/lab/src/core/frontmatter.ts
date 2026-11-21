export type FrontMatter = Record<string, string | string[]>;

/** Minimal YAML front-matter reader: `key: value`, `key: [a, b]`, `- item` lists, `# comments`. */
export function parseFrontMatter(raw: string): { data: FrontMatter; body: string } {
  const source = raw.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) return { data: {}, body: source };

  const data: FrontMatter = {};
  let listKey: string | null = null;

  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (!line.trim()) continue;

    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      (data[listKey] as string[]).push(item[1].trim());
      continue;
    }

    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const [, key, value] = pair;
    if (value === '') {
      data[key] = [];
      listKey = key;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      listKey = null;
    } else {
      data[key] = value.replace(/^['"]|['"]$/g, '');
      listKey = null;
    }
  }

  return { data, body: source.slice(match[0].length) };
}

export function field(data: FrontMatter, key: string): string {
  const value = data[key];
  return Array.isArray(value) ? value.join(', ') : (value ?? '');
}
