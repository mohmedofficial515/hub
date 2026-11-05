/**
 * @file The Goteav importer's pure part (docs/06 §7): files in, the cards they become out.
 * @description Nothing here writes. The YAML has grown beyond what docs/06 first observed: decisions now carry their real
 * `options`, and suggestions `proposalAr`, `benefitsAr`, `acceptanceAr` and `statusNoteAr`. They are used when present,
 * and two options are synthesised only when a decision has none.
 */
import { createHash } from 'node:crypto';

import type { CardType, Specialty } from '@hub/contracts';
import { SPECIALTY_DEFAULT_ROLE } from '@hub/contracts';
import { parse } from 'yaml';

const FINANCIAL_MODULES = new Set(['payments', 'wallet', 'invoicing', 'pricing', 'loyalty']);
const TITLE_LENGTH = 200;
const DAY_MS = 86_400_000;
const DECISION_DUE_DAYS = 14;

/** A card to exist after the import, and the backdated events it has. */
export interface ImportCard {
  readonly externalKey: string;
  readonly type: CardType;
  readonly title: string;
  readonly body: string | null;
  readonly status: string;
  readonly priority?: 'P0' | 'P1' | 'P2' | 'P3' | undefined;
  readonly ownerRole?: string | null;
  readonly module?: string | null;
  readonly repo?: string | null;
  readonly branch?: string | null;
  readonly commitSha?: string | null;
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly closedAt?: Date | null;
  readonly dueAt?: Date | null;
  readonly detail: Readonly<Record<string, unknown>>;
  /** After `created`. */
  readonly events: readonly {
    readonly kind: 'decided' | 'status_changed' | 'applied';
    readonly at: Date;
    readonly data?: Readonly<Record<string, unknown>>;
  }[];
  /** External keys of other cards in this import, linked `relates`. */
  readonly relates?: readonly string[];
}

export interface Parsed {
  readonly cards: readonly ImportCard[];
  readonly problems: readonly string[];
}

export type Raw = Readonly<Record<string, unknown>>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => str(item)).filter((item) => item !== '');
  const single = str(value);
  return single ? [single] : [];
}

function title(value: string): string {
  return value.length > TITLE_LENGTH ? `${value.slice(0, TITLE_LENGTH - 1)}…` : value;
}

function tag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tagsOf(...values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.flatMap((value) => (value ? [tag(value)] : [])))].filter((value) => value !== '');
}

function dateOf(value: unknown): Date | null {
  // YAML may read a bare date as a string or a Date.
  const parsed = value instanceof Date ? value : new Date(str(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstSentence(text: string, length: number): string {
  const sentence = /^.*?[.!?؟](?=\s|$)/su.exec(text)?.[0] ?? text;
  const line = sentence.split('\n')[0]?.trim() ?? '';
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}

function bullets(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function parsedArray(text: string, key: string): Raw[] {
  const root = parse(text) as Raw | Raw[] | null;
  const rows = Array.isArray(root) ? root : root?.[key];
  return Array.isArray(rows) ? (rows as Raw[]) : [];
}

/** `_decisions.yaml` → decisions (docs/06 §7.1). */
export function parseDecisions(text: string, importedAt: Date): Parsed {
  const problems: string[] = [];
  const cards = parsedArray(text, 'decisions').flatMap((row): ImportCard[] => {
    const id = str(row['id']);
    const name = str(row['titleAr']);
    const question = str(row['questionAr']);
    if (!id || !name || !question) {
      problems.push(`decision ${id || '(no id)'} has no title or question`);
      return [];
    }
    const modules = list(row['modules']);
    const recommendation = str(row['recommendationAr']);
    const summary = str(row['summaryAr']);
    const reviewBy = dateOf(row['reviewBy']);
    const verified = dateOf(row['lastVerifiedAt']);
    const options = optionsOf(row, recommendation, reviewBy);
    const chosen = options.find((option) => option.recommended) ?? options[0];
    const status = str(row['status']);
    const decided = status === 'approved' || status === 'done';
    if (!['proposed', 'approved', 'done', 'deferred', 'rejected'].includes(status)) {
      problems.push(`decision ${id} has the unknown status "${status}"; imported as open`);
    }
    const decidedAt = verified ?? importedAt;
    const closed = decided ? decidedAt : status === 'rejected' ? importedAt : null;
    const defaultDue = new Date(importedAt.getTime() + DECISION_DUE_DAYS * DAY_MS);
    const body = [
      summary && `## الملخص\n${summary}`,
      list(row['contextAr']).length > 0 && `## السياق\n${bullets(list(row['contextAr']))}`,
      recommendation && `## التوصية\n${recommendation}`,
      list(row['planAr']).length > 0 &&
        `## الخطة\n${list(row['planAr'])
          .map((step, index) => `${index + 1}. ${step}`)
          .join('\n')}`,
      rulesSection(row['rules']),
      list(row['openQuestions']).length > 0 && `## أسئلة مفتوحة\n${bullets(list(row['openQuestions']))}`,
      `المصدر: \`docs/map/data/_decisions.yaml\`، \`${id}\``,
    ]
      .filter(Boolean)
      .join('\n\n');
    return [
      {
        externalKey: `import:decision:${id}`,
        type: 'decision',
        title: title(name),
        body,
        status: decided ? 'decided' : status === 'rejected' ? 'withdrawn' : 'open',
        priority: 'P1',
        ownerRole: 'owner',
        module: modules[0]?.slice(0, 40) ?? null,
        tags: tagsOf(...modules, 'imported', 'research'),
        createdAt: verified ?? importedAt,
        closedAt: closed,
        dueAt: decided ? null : status === 'deferred' ? (reviewBy ?? defaultDue) : defaultDue,
        detail: {
          kind: modules.some((module) => FINANCIAL_MODULES.has(module)) ? 'financial' : 'product',
          question,
          options,
          deciderRole: 'owner',
          ...(decided && chosen
            ? { chosenOptionId: chosen.id, rationale: (summary || chosen.title).slice(0, 2000), decidedAt }
            : {}),
        },
        events: decided ? [{ kind: 'decided', at: decidedAt, data: { optionId: chosen?.id ?? null } }] : [],
      },
    ];
  });
  return { cards, problems };
}

interface OptionRow {
  readonly id: string;
  readonly title: string;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
  readonly cost: string | null;
  readonly recommended: boolean;
}

function optionsOf(row: Raw, recommendation: string, reviewBy: Date | null): OptionRow[] {
  const given = Array.isArray(row['options']) ? (row['options'] as Raw[]) : [];
  if (given.length > 0) {
    return given.map((option, index) => ({
      id: tag(str(option['id'])) || `option-${index + 1}`,
      title: title(str(option['name']) || str(option['titleAr']) || `Option ${index + 1}`),
      pros: list(option['prosAr']),
      cons: list(option['consAr']),
      cost: str(option['pricingAr']).slice(0, 200) || null,
      recommended: str(option['verdict']) === 'recommended',
    }));
  }
  const by = reviewBy ? reviewBy.toISOString().slice(0, 10) : 'later';
  return [
    {
      id: 'recommended',
      title: firstSentence(recommendation, 120) || 'As recommended',
      pros: [],
      cons: [],
      cost: null,
      recommended: true,
    },
    { id: 'defer', title: `Defer: revisit before ${by}`, pros: [], cons: [], cost: null, recommended: false },
  ];
}

function rulesSection(value: unknown): string | false {
  if (!Array.isArray(value) || value.length === 0) return false;
  const rules = (value as Raw[]).map((rule) =>
    [
      `### ${str(rule['titleAr'])}`,
      str(rule['bodyAr']),
      str(rule['impactAr']) && `**الأثر:** ${str(rule['impactAr'])}`,
      str(rule['confidence']) && `الثقة: \`${str(rule['confidence'])}\``,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return `## القواعد\n${rules.join('\n\n')}`;
}

const TASK_STATUS: Readonly<Record<string, string>> = {
  proposed: 'backlog',
  approved: 'ready',
  in_progress: 'ready',
  done: 'done',
  deferred: 'backlog',
  rejected: 'cancelled',
};

function specialtyOf(target: string): Specialty {
  return target === 'dashboard' || target === 'web' ? 'frontend' : 'backend';
}

/** `_suggestions.yaml` → tasks (docs/06 §7.2). */
export function parseSuggestions(text: string, importedAt: Date): Parsed {
  const problems: string[] = [];
  const cards = parsedArray(text, 'suggestions').flatMap((row): ImportCard[] => {
    const id = str(row['id']);
    const name = str(row['titleAr']);
    if (!id || !name) {
      problems.push(`suggestion ${id || '(no id)'} has no title`);
      return [];
    }
    const source = str(row['status']);
    const status = TASK_STATUS[source];
    if (!status) problems.push(`suggestion ${id} has the unknown status "${source}"; imported as backlog`);
    const target = str(row['target']);
    const specialty = specialtyOf(target);
    const modules = list(row['modules']);
    const priorityGiven = str(row['priority']);
    const priority = /^P[0-3]$/.test(priorityGiven) ? (priorityGiven as ImportCard['priority']) : 'P2';
    const effort = str(row['effort']);
    const done = status === 'done';
    const cancelled = status === 'cancelled';
    const evidence = list(row['evidence']);
    const body = [
      str(row['summaryAr']),
      str(row['problemAr']) && `## المشكلة\n${str(row['problemAr'])}`,
      str(row['proposalAr']) && `## المقترح\n${str(row['proposalAr'])}`,
      list(row['benefitsAr']).length > 0 && `## الفوائد\n${bullets(list(row['benefitsAr']))}`,
      str(row['statusNoteAr']) && `## الحالة\n${str(row['statusNoteAr'])}`,
      evidence.length > 0 && `## الأدلة\n${evidence.map((path) => `- \`${path}\``).join('\n')}`,
      `المصدر: \`docs/map/data/_suggestions.yaml\`، \`${id}\``,
    ]
      .filter(Boolean)
      .join('\n\n');
    return [
      {
        externalKey: `import:suggestion:${id}`,
        type: 'task',
        title: title(name),
        body,
        status: status ?? 'backlog',
        priority: source === 'deferred' ? 'P3' : priority,
        ownerRole: SPECIALTY_DEFAULT_ROLE[specialty],
        module: modules[0]?.slice(0, 40) ?? null,
        tags: tagsOf(
          ...modules,
          str(row['category']),
          'imported',
          target === 'both' ? 'needs-frontend' : undefined,
          target === 'mobile' ? 'mobile' : undefined,
          source === 'in_progress' ? 'was-in-progress' : undefined,
          source === 'deferred' ? 'deferred' : undefined,
        ),
        createdAt: importedAt,
        closedAt: done || cancelled ? importedAt : null,
        detail: {
          specialty,
          effort: /^(S|M|L|XL)$/.test(effort) ? effort : null,
          acceptance: list(row['acceptanceAr']).length > 0 ? bullets(list(row['acceptanceAr'])) : null,
          prompt: str(row['prompt']) || null,
          origin: 'import_suggestion',
          ...(done ? { doneAt: importedAt } : {}),
        },
        events: done || cancelled ? [{ kind: 'status_changed', at: importedAt, data: { to: status } }] : [],
      },
    ];
  });
  return { cards, problems };
}

const LINE = /^- (\d{4}-\d{2}-\d{2}) `([^`]+)` ((?:`[0-9a-f]{6,40}`(?:, *)?)+)(?: \(([^)]*)\))?: (.+)$/u;

export function severityOf(text: string): 'breaking' | 'notable' | 'info' {
  if (/\*\*breaking\*\*/i.test(text)) return 'breaking';
  if (/not breaking/i.test(text)) return 'info';
  return 'notable';
}

/** `contract-changes.md` → handoffs already applied (docs/06 §7.4). */
export function parseContractChanges(text: string): Parsed {
  const problems: string[] = [];
  const cards = text.split('\n').flatMap((line): ImportCard[] => {
    if (!line.startsWith('- ')) return [];
    const match = LINE.exec(line.trimEnd());
    if (!match) {
      problems.push(`contract change line not understood: ${line.slice(0, 80)}`);
      return [];
    }
    const [, date = '', branch = '', shaList = '', actorLabel = '', change = ''] = match;
    const at = new Date(`${date}T12:00:00.000Z`);
    const shas = [...shaList.matchAll(/`([0-9a-f]+)`/g)].map((sha) => sha[1] ?? '');
    const hash = createHash('sha256').update(line.trimEnd()).digest('hex').slice(0, 16);
    return [
      {
        externalKey: `import:contract:${hash}`,
        type: 'handoff',
        title: title(`Contract change ${date}: ${firstSentence(change, 160)}`),
        body: null,
        status: 'applied',
        ownerRole: 'frontend',
        repo: 'backend',
        branch,
        commitSha: shas[0] ?? null,
        tags: ['imported', 'contract'],
        createdAt: at,
        closedAt: at,
        detail: {
          fromRole: 'backend',
          toRole: 'frontend',
          kind: 'contract',
          severity: severityOf(change),
          summary: change.slice(0, 2000),
          payload: { shas, actorLabel, issueRefs: change.match(/\bIR-\d+\b/g) ?? [] },
          acknowledgedAt: at,
          appliedAt: at,
        },
        events: [{ kind: 'applied', at, data: { from: 'pending', to: 'applied' } }],
      },
    ];
  });
  return { cards, problems };
}

export interface StatusFile {
  readonly name: string;
  readonly content: string;
  /** The file's first commit date, for files with no date in their name. */
  readonly firstCommitAt?: string | null;
}

export function statusFileDate(file: StatusFile, importedAt: Date): Date {
  const named = /(\d{4}-\d{2}-\d{2})/.exec(file.name)?.[1];
  return dateOf(named) ?? dateOf(file.firstCommitAt) ?? importedAt;
}

function isArabic(name: string): boolean {
  return /[.-]ar\.md$/.test(name);
}

/** `docs/status/*.md` → status docs, and the one release (docs/06 §7.3). */
export function parseStatusFiles(
  files: readonly StatusFile[],
  sourceName: string,
  sourceId: string,
  importedAt: Date,
): Parsed {
  const cards = files.flatMap((file): ImportCard[] => {
    const path = `docs/status/${file.name}`;
    const at = statusFileDate(file, importedAt);
    const heading = /^#\s+(.+)$/mu.exec(file.content)?.[1]?.trim();
    const externalKey = `doc:${sourceName}:${path}`;
    const doc: ImportCard = {
      externalKey,
      type: 'doc',
      title: title(heading ?? file.name),
      body: file.content,
      status: 'current',
      repo: 'backend',
      tags: ['imported', 'status'],
      createdAt: at,
      detail: {
        sourceId,
        path,
        kind: 'status',
        lang: isArabic(file.name) ? 'ar' : 'en',
        wordCount: file.content.split(/\s+/).filter(Boolean).length,
        lastIndexedAt: importedAt,
      },
      events: [],
    };
    const release = /^release-(\d{4}-\d{2}-\d{2})/.exec(file.name)?.[1];
    if (!release) return [doc];
    return [
      doc,
      {
        externalKey: `import:release:${release}`,
        type: 'release',
        title: `Release ${release}`,
        body: null,
        status: 'released',
        repo: 'backend',
        tags: ['imported'],
        createdAt: at,
        closedAt: at,
        detail: {
          version: release,
          repo: 'backend',
          releasedAt: at,
          notes: { team: file.content },
        },
        events: [{ kind: 'status_changed', at, data: { to: 'released' } }],
        relates: [externalKey],
      },
    ];
  });
  return { cards, problems: [] };
}

/** The 18 backend modules (docs/03 §4.2), plus any module the data names. */
export function moduleCatalogue(cards: readonly ImportCard[]): string[] {
  return [...new Set(cards.flatMap((card) => (card.module ? [card.module] : [])))].sort();
}

/** The reading path per role (docs/03 §4.2): the docs that explain Goteav, as files in the backend docs source. */
export const GOTEAV_ONBOARDING = (() => {
  const doc = (id: string, name: string, ref: string) => ({ id, title: name, kind: 'doc' as const, ref });
  const architecture = doc('architecture', 'Architecture', 'docs/01-architecture.md');
  const data = doc('data-model', 'Data model', 'docs/03-data-model.md');
  const quality = doc('testing', 'Testing and quality', 'docs/11-testing-and-quality.md');
  const map = doc('map', 'Project map', 'docs/map/README.md');
  return {
    owner: [map, architecture],
    pm: [map, architecture],
    accountant: [map],
    backend: [architecture, data, quality, map],
    frontend: [architecture, map],
    designer: [map],
    qa: [quality, map],
  };
})();
