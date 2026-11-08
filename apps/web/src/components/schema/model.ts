/**
 * @file model.ts
 * @description Schema Studio's pure parts (docs/17 §4): domain colours, the Arabic-name lookup and coverage, search, the draft's marks on the diagram, and the layout of tables in domain groups.
 * The layout is deterministic: domains packed in rows, biggest first, each a grid of its tables with the most connected first. A table the owner dragged keeps its place.
 */
import type {
  SchemaAnnotationDto,
  SchemaChange,
  SchemaChangeSummary,
  SchemaDoc,
  SchemaField,
  SchemaModel,
} from '@hub/contracts';

// ── Colours ─────────────────────────────────────────────────────────────────────────────────────

/** The type families of the app's tokens, reused as domain colours. Twenty-one domains share ten, in order. */
export const DOMAIN_TONES = [
  'task',
  'decision',
  'need',
  'handoff',
  'redesign',
  'release',
  'doc',
  'plan',
  'idea',
  'change',
] as const;
export type DomainTone = (typeof DOMAIN_TONES)[number];

export function domainTones(doc: SchemaDoc): Map<string, DomainTone> {
  return new Map(
    doc.domains.map((domain, index) => [domain.name, DOMAIN_TONES[index % DOMAIN_TONES.length]!]),
  );
}

/** CSS variables a domain's parts read: `--dom`, `--dom-soft`, `--dom-fg`. */
export const toneStyle = (tone: DomainTone | undefined) =>
  ({
    '--dom': `var(--type-${tone ?? 'doc'})`,
    '--dom-soft': `var(--type-${tone ?? 'doc'}-soft)`,
    '--dom-fg': `var(--type-${tone ?? 'doc'}-fg)`,
  }) as React.CSSProperties;

// ── Names ───────────────────────────────────────────────────────────────────────────────────────

export type Annotations = ReadonlyMap<string, SchemaAnnotationDto>;

export const annotationsOf = (list: readonly SchemaAnnotationDto[]): Annotations =>
  new Map(list.map((entry) => [entry.target, entry]));

export const modelTarget = (model: string) => `model:${model}`;
export const fieldTarget = (model: string, field: string) => `field:${model}.${field}`;
export const enumTarget = (name: string) => `enum:${name}`;
export const enumValueTarget = (name: string, value: string) => `enumValue:${name}.${value}`;

export type LabelMode = 'ar' | 'code';

/** What a table or column is called on screen: its Arabic name when there is one and Arabic is chosen. */
export function labelOf(
  annotations: Annotations,
  target: string,
  code: string,
  mode: LabelMode,
): { main: string; sub: string | null } {
  const nameAr = annotations.get(target)?.nameAr;
  if (mode === 'ar' && nameAr) return { main: nameAr, sub: code };
  return { main: code, sub: mode === 'code' && nameAr ? nameAr : null };
}

export interface Coverage {
  named: number;
  total: number;
  pct: number;
}

const pct = (named: number, total: number) => (total === 0 ? 100 : Math.round((named / total) * 100));

/** Tables and columns with an Arabic name, of all of them, for the whole design or one domain. */
export function coverageOf(models: readonly SchemaModel[], annotations: Annotations): Coverage {
  let named = 0;
  let total = 0;
  for (const model of models) {
    total += 1 + model.fields.length;
    if (annotations.get(modelTarget(model.name))?.nameAr) named += 1;
    for (const field of model.fields)
      if (annotations.get(fieldTarget(model.name, field.name))?.nameAr) named += 1;
  }
  return { named, total, pct: pct(named, total) };
}

export const unsyncedCount = (annotations: readonly SchemaAnnotationDto[]) =>
  annotations.filter((entry) => entry.nameAr && !entry.syncedAt).length;

/** A column worth showing when only keys are shown: keys, relations, and anything the draft touches. */
export const isKeyField = (field: SchemaField) =>
  field.isId || field.isForeignKey || field.isUnique || field.kind === 'relation';

// ── Search ──────────────────────────────────────────────────────────────────────────────────────

export interface SearchHit {
  kind: 'model' | 'field' | 'enum';
  model: string;
  field?: string;
  code: string;
  nameAr: string | null;
  domain: string;
  score: number;
}

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

function scoreOf(query: string, ...texts: (string | null | undefined)[]): number {
  let best = 0;
  for (const text of texts) {
    if (!text) continue;
    const folded = fold(text);
    if (folded === query) best = Math.max(best, 100);
    else if (folded.startsWith(query)) best = Math.max(best, 70);
    else if (folded.includes(query)) best = Math.max(best, 40);
  }
  return best;
}

export function searchSchema(doc: SchemaDoc, annotations: Annotations, raw: string, limit = 40): SearchHit[] {
  const query = fold(raw.trim());
  if (!query) return [];
  const hits: SearchHit[] = [];
  for (const model of doc.models) {
    const own = annotations.get(modelTarget(model.name));
    const score = scoreOf(query, model.name, model.dbName, own?.nameAr, own?.descriptionAr);
    if (score > 0)
      hits.push({
        kind: 'model',
        model: model.name,
        code: model.name,
        nameAr: own?.nameAr ?? null,
        domain: model.domain,
        score: score + 5,
      });
    for (const field of model.fields) {
      const entry = annotations.get(fieldTarget(model.name, field.name));
      const fieldScore = scoreOf(query, field.name, field.dbName, entry?.nameAr, entry?.descriptionAr);
      if (fieldScore > 0) {
        hits.push({
          kind: 'field',
          model: model.name,
          field: field.name,
          code: `${model.name}.${field.name}`,
          nameAr: entry?.nameAr ?? null,
          domain: model.domain,
          score: fieldScore,
        });
      }
    }
  }
  for (const value of doc.enums) {
    const entry = annotations.get(enumTarget(value.name));
    const score = scoreOf(
      query,
      value.name,
      value.dbName,
      entry?.nameAr,
      ...value.values.map((item) => item.name),
    );
    if (score > 0)
      hits.push({
        kind: 'enum',
        model: value.name,
        code: value.name,
        nameAr: entry?.nameAr ?? null,
        domain: value.domain,
        score,
      });
  }
  return hits.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)).slice(0, limit);
}

// ── The draft and the last version, as marks ────────────────────────────────────────────────────

export type Mark = 'added' | 'changed' | 'removed';

export interface Marks {
  /** From the open draft. */
  proposedModels: Map<string, Mark>;
  proposedFields: Map<string, Mark>;
  /** Tables the draft adds, which the files do not have yet. */
  newModels: { name: string; change: SchemaChange }[];
  /** New columns on existing tables. */
  newFields: Map<string, { name: string; change: SchemaChange }[]>;
  /** From the last version. */
  recentModels: Set<string>;
  recentFields: Set<string>;
}

const KIND_MARK: Partial<Record<SchemaChange['kind'], Mark>> = {
  add_model: 'added',
  add_field: 'added',
  add_enum: 'added',
  remove: 'removed',
  change_field: 'changed',
  rename: 'changed',
  split_model: 'changed',
  add_relation: 'changed',
  add_index: 'changed',
  change_enum: 'changed',
};

export function marksOf(
  doc: SchemaDoc,
  changes: readonly SchemaChange[],
  recent: SchemaChangeSummary | null,
): Marks {
  const models = new Set(doc.models.map((model) => model.name));
  const marks: Marks = {
    proposedModels: new Map(),
    proposedFields: new Map(),
    newModels: [],
    newFields: new Map(),
    recentModels: new Set([...(recent?.addedModels ?? []), ...(recent?.changedModels ?? [])]),
    recentFields: new Set([...(recent?.addedFields ?? []), ...(recent?.changedFields ?? [])]),
  };
  for (const change of changes) {
    const mark = KIND_MARK[change.kind];
    if (!mark) continue;
    const [owner, member] = change.target.split('.') as [string, string | undefined];
    if (!models.has(owner)) {
      if (change.kind === 'add_model') marks.newModels.push({ name: owner, change });
      continue;
    }
    if (member) {
      const exists = doc.models
        .find((model) => model.name === owner)
        ?.fields.some((field) => field.name === member);
      if (!exists && change.kind === 'add_field') {
        marks.newFields.set(owner, [...(marks.newFields.get(owner) ?? []), { name: member, change }]);
        marks.proposedModels.set(owner, marks.proposedModels.get(owner) ?? 'changed');
      } else {
        marks.proposedFields.set(`${owner}.${member}`, mark);
        marks.proposedModels.set(owner, marks.proposedModels.get(owner) ?? 'changed');
      }
    } else {
      marks.proposedModels.set(owner, mark);
    }
  }
  return marks;
}

// ── Layout ──────────────────────────────────────────────────────────────────────────────────────

export const NODE_WIDTH = 272;
export const HEADER_HEIGHT = 52;
export const ROW_HEIGHT = 26;
export const NODE_PAD = 10;
const NODE_GAP_X = 56;
const NODE_GAP_Y = 40;
const GROUP_PAD = 28;
const GROUP_TITLE = 44;
const GROUP_GAP = 96;
const ROW_TARGET = 4200;

export type Detail = 'keys' | 'all';

export function visibleFields(
  model: SchemaModel,
  detail: Detail,
  touched: (field: string) => boolean,
): SchemaField[] {
  if (detail === 'all') return model.fields;
  return model.fields.filter((field) => isKeyField(field) || touched(field.name));
}

export function nodeHeight(rows: number, hidden: number): number {
  return HEADER_HEIGHT + rows * ROW_HEIGHT + (hidden > 0 ? ROW_HEIGHT : 0) + NODE_PAD;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  nodes: Map<string, Box>;
  groups: Map<string, Box>;
}

/**
 * Domains packed in rows, biggest first. Inside a domain, a grid with the most connected table first, columns of similar height.
 * `heightOf` gives a table's height in the current detail, `pinned` the places the owner dragged tables to.
 */
export function layoutSchema(
  doc: SchemaDoc,
  shown: ReadonlySet<string>,
  heightOf: (model: string) => number,
  extraByDomain: ReadonlyMap<string, string[]> = new Map(),
): Layout {
  const degree = new Map<string, number>();
  for (const relation of doc.relations) {
    degree.set(relation.from, (degree.get(relation.from) ?? 0) + 1);
    degree.set(relation.to, (degree.get(relation.to) ?? 0) + 1);
  }
  const domains = doc.domains
    .map((domain) => ({
      name: domain.name,
      models: [
        ...domain.models.filter((name) => shown.has(name)),
        ...(extraByDomain.get(domain.name) ?? []),
      ].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0) || a.localeCompare(b)),
    }))
    .filter((domain) => domain.models.length > 0)
    .sort((a, b) => b.models.length - a.models.length || a.name.localeCompare(b.name));

  const nodes = new Map<string, Box>();
  const groups = new Map<string, Box>();
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const domain of domains) {
    const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(domain.models.length * 0.8))));
    const heights = new Array<number>(columns).fill(0);
    const placed: { name: string; column: number; y: number; height: number }[] = [];
    for (const name of domain.models) {
      const column = heights.indexOf(Math.min(...heights));
      const height = heightOf(name);
      placed.push({ name, column, y: heights[column]!, height });
      heights[column] = heights[column]! + height + NODE_GAP_Y;
    }
    const width = columns * NODE_WIDTH + (columns - 1) * NODE_GAP_X + GROUP_PAD * 2;
    const height = Math.max(...heights) - NODE_GAP_Y + GROUP_PAD * 2 + GROUP_TITLE;
    if (cursorX > 0 && cursorX + width > ROW_TARGET) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GAP;
      rowHeight = 0;
    }
    groups.set(domain.name, { x: cursorX, y: cursorY, width, height });
    for (const entry of placed) {
      nodes.set(entry.name, {
        x: cursorX + GROUP_PAD + entry.column * (NODE_WIDTH + NODE_GAP_X),
        y: cursorY + GROUP_PAD + GROUP_TITLE + entry.y,
        width: NODE_WIDTH,
        height: entry.height,
      });
    }
    cursorX += width + GROUP_GAP;
    rowHeight = Math.max(rowHeight, height);
  }
  return { nodes, groups };
}

/** A domain's box around its tables where they are now, so a dragged table takes its domain with it. */
export function groupAround(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null;
  const minX = Math.min(...boxes.map((box) => box.x)) - GROUP_PAD;
  const minY = Math.min(...boxes.map((box) => box.y)) - GROUP_PAD - GROUP_TITLE;
  const maxX = Math.max(...boxes.map((box) => box.x + box.width)) + GROUP_PAD;
  const maxY = Math.max(...boxes.map((box) => box.y + box.height)) + GROUP_PAD;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** The tables within `depth` relations of `model`, itself included. */
export function neighbourhood(
  doc: SchemaDoc,
  model: string,
  depth: number,
  withImplied: boolean,
): Set<string> {
  const links = new Map<string, Set<string>>();
  for (const relation of doc.relations) {
    if (relation.implied && !withImplied) continue;
    if (!links.has(relation.from)) links.set(relation.from, new Set());
    if (!links.has(relation.to)) links.set(relation.to, new Set());
    links.get(relation.from)!.add(relation.to);
    links.get(relation.to)!.add(relation.from);
  }
  const seen = new Set([model]);
  let frontier = [model];
  for (let step = 0; step < depth; step += 1) {
    const next: string[] = [];
    for (const name of frontier) {
      for (const other of links.get(name) ?? []) {
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return seen;
}

// ── Export ──────────────────────────────────────────────────────────────────────────────────────

export function dictionaryMarkdown(doc: SchemaDoc, annotations: Annotations, title: string): string {
  const lines = [`# ${title}`, ''];
  for (const domain of doc.domains) {
    lines.push(`## ${domain.name}`, '');
    if (domain.header) lines.push(domain.header, '');
    for (const name of domain.models) {
      const model = doc.models.find((entry) => entry.name === name);
      if (!model) continue;
      const own = annotations.get(modelTarget(name));
      lines.push(
        `### ${name}${own?.nameAr ? ` — ${own.nameAr}` : ''}${model.dbName ? ` (\`${model.dbName}\`)` : ''}`,
        '',
      );
      if (own?.descriptionAr) lines.push(own.descriptionAr, '');
      else if (model.doc) lines.push(model.doc, '');
      lines.push('| Column | Type | Arabic name | Description |', '| --- | --- | --- | --- |');
      for (const field of model.fields) {
        const entry = annotations.get(fieldTarget(name, field.name));
        const cell = (text: string | null | undefined) =>
          (text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
        lines.push(
          `| \`${field.name}\` | \`${cell(field.type)}\` | ${cell(entry?.nameAr)} | ${cell(entry?.descriptionAr ?? field.doc)} |`,
        );
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

export const newChangeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c${Date.now()}${Math.random().toString(16).slice(2)}`;
