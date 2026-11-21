/**
 * @file A skill's `SKILL.md`: its front matter and its Markdown (docs/16 §11, D64). Pure.
 * @description Hub reads `name`, `description` and `user-invocable`, and keeps every other line of the front matter as it was, in its place, so a skill moved from the owner's
 * folder keeps its `argument-hint`, `allowed-tools` and the rest. A description is written as a YAML double-quoted string when plain YAML could misread it, which JSON's quoting is.
 */

export interface FrontField {
  readonly key: string;
  /** The field's lines as written, the first holding `key:`. */
  readonly lines: readonly string[];
}

export interface SkillFile {
  readonly fields: readonly FrontField[];
  readonly body: string;
  /** The file had front matter at all. */
  readonly hasFrontMatter: boolean;
}

const FIELD = /^([A-Za-z][\w-]*):(?:\s(.*)|)$/;

export function parseSkillFile(text: string): SkillFile {
  const normal = text.replace(/^﻿/, '').replaceAll('\r\n', '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normal);
  if (!match) return { fields: [], body: normal, hasFrontMatter: false };
  const fields: { key: string; lines: string[] }[] = [];
  for (const line of (match[1] ?? '').split('\n')) {
    const head = FIELD.exec(line);
    const last = fields.at(-1);
    if (head && !/^\s/.test(line)) fields.push({ key: head[1] ?? '', lines: [line] });
    else if (last) last.lines.push(line);
    else fields.push({ key: '', lines: [line] });
  }
  return { fields, body: normal.slice(match[0].length).replace(/^\n/, ''), hasFrontMatter: true };
}

/** A field's value as text: plain, quoted, or a folded or literal block. */
export function fieldValue(file: SkillFile, key: string): string | null {
  const field = file.fields.find((item) => item.key === key);
  if (!field) return null;
  const first = (field.lines[0] ?? '').slice(key.length + 1).trim();
  const rest = field.lines.slice(1).map((line) => line.trim());
  if (/^[>|][+-]?$/.test(first)) {
    return first.startsWith('>') ? rest.filter(Boolean).join(' ') : rest.join('\n').trim();
  }
  const whole = [first, ...rest].filter(Boolean).join(' ');
  if (whole.startsWith('"')) {
    try {
      return JSON.parse(whole) as string;
    } catch {
      return whole.replace(/^"|"$/g, '');
    }
  }
  if (whole.startsWith("'")) return whole.replace(/^'|'$/g, '').replaceAll("''", "'");
  return whole;
}

const PLAIN_SAFE = /^[^\s"'`#&*!|>%@{}[\],:?-][^"#:\n]*$/u;

/** A YAML scalar for one line of front matter. */
export function yamlText(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return PLAIN_SAFE.test(flat) && !flat.endsWith(' ') ? flat : JSON.stringify(flat);
}

export interface SkillHead {
  readonly name: string;
  readonly description: string;
  readonly userInvocable: boolean;
}

/**
 * The file with these three fields set and the body replaced. Other fields keep their lines and their order; the three Hub writes come first when they are new.
 */
export function writeSkillFile(head: SkillHead, body: string, base: SkillFile | null = null): string {
  const wanted = new Map<string, string>([
    ['name', `name: ${head.name}`],
    ['description', `description: ${yamlText(head.description)}`],
  ]);
  const fields = base?.fields ?? [];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    const replaced = wanted.get(field.key);
    if (field.key === 'user-invocable') {
      seen.add(field.key);
      if (head.userInvocable) lines.push('user-invocable: true');
      continue;
    }
    if (replaced) {
      seen.add(field.key);
      lines.push(replaced);
    } else {
      lines.push(...field.lines);
    }
  }
  const missing = [...wanted.entries()].filter(([key]) => !seen.has(key)).map(([, line]) => line);
  if (!seen.has('user-invocable') && head.userInvocable) missing.push('user-invocable: true');
  const text = body.replaceAll('\r\n', '\n').replace(/^\n+/, '');
  return `---\n${[...missing, ...lines].join('\n')}\n---\n\n${text.endsWith('\n') || text === '' ? text : `${text}\n`}`;
}

/** What the page shows of a file: its head and its body. A file with no description says so with an empty one. */
export function readHead(
  text: string,
  folder: string,
): SkillHead & { declaredName: string | null; body: string } {
  const file = parseSkillFile(text);
  const declared = fieldValue(file, 'name');
  return {
    name: folder,
    declaredName: declared && declared !== folder ? declared : null,
    description: fieldValue(file, 'description') ?? '',
    userInvocable: /^true$/i.test(fieldValue(file, 'user-invocable') ?? ''),
    body: file.body,
  };
}

/** The same file under another name: only the `name` line changes. Move to Hub uses it on the copy, never on the original. */
export function renameSkillFile(text: string, name: string): string {
  const file = parseSkillFile(text);
  if (!file.hasFrontMatter) return writeSkillFile({ name, description: '', userInvocable: false }, file.body);
  const fields = file.fields.some((field) => field.key === 'name')
    ? file.fields.map((field) => (field.key === 'name' ? { key: 'name', lines: [`name: ${name}`] } : field))
    : [{ key: 'name', lines: [`name: ${name}`] }, ...file.fields];
  return `---\n${fields.flatMap((field) => field.lines).join('\n')}\n---\n\n${file.body}`;
}
