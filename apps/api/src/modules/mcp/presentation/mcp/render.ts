/**
 * @file Markdown a model reads (docs/05 §2.3): a headline, then compact tables, with every card as `KEY — title`.
 * @description A write states what changed and the card's URL. Pure functions, so they are tested without a server.
 */
import type {
  CardFullDto,
  CardSummary,
  CardType,
  CardWithDetail,
  CardWrittenDto,
  CommentDto,
} from '@hub/contracts';

export const OUTPUT_LIMIT = 12_000;
export const LONG_OUTPUT_LIMIT = 60_000;

const VIEW_OF: Readonly<Record<CardType, string>> = {
  task: 'tasks',
  decision: 'decisions',
  need: 'needs',
  change: 'timeline',
  handoff: 'handoffs',
  redesign: 'redesign',
  doc: 'docs',
  release: 'releases',
  idea: 'planning',
  plan: 'planning',
};

export interface ProjectRef {
  readonly slug: string;
  readonly name: string;
  readonly locale: string;
  readonly publicUrl: string;
}

export function cardUrl(
  project: ProjectRef,
  card: { readonly type: CardType; readonly key: string },
): string {
  const base = project.publicUrl.replace(/\/+$/, '');
  return `${base}/${project.locale}/${project.slug}/${VIEW_OF[card.type]}?card=${encodeURIComponent(card.key)}`;
}

export function truncate(text: string, limit = OUTPUT_LIMIT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… (cut at ${limit} characters of ${text.length}; narrow the call or pass a cursor)`;
}

function cell(value: string | null | undefined): string {
  return (value ?? '–').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function cardRef(card: { readonly key: string; readonly title: string }): string {
  return `${card.key} — ${card.title}`;
}

export function moreLine(nextCursor: string | null | undefined): string[] {
  return nextCursor ? [`More: pass cursor="${nextCursor}"`] : [];
}

export function cardTable(
  headline: string,
  cards: readonly CardSummary[],
  nextCursor?: string | null,
): string {
  if (cards.length === 0) return `${headline}\nNone.`;
  return [
    headline,
    '| key | type | status | P | role | assignee | due | title |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...cards.map((card) =>
      [
        '',
        card.key,
        card.type,
        card.status,
        card.priority,
        cell(card.ownerRole),
        cell(card.assignee?.displayName),
        cell(card.dueAt),
        `${cell(card.title)}${card.flags.blocked ? ' ⛔ blocked' : ''}${card.flags.overdue ? ' ⚠ overdue' : ''}`,
        '',
      ]
        .join(' | ')
        .trim(),
    ),
    ...moreLine(nextCursor),
  ].join('\n');
}

function detailOf(card: CardWithDetail): Readonly<Record<string, unknown>> {
  return card.detail ?? {};
}

/** A detail value known to be a string or a number. */
export function plain(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function section(title: string, value: unknown): string[] {
  const content = text(value);
  return content ? [`## ${title}`, content] : [];
}

interface OptionRow {
  readonly id: string;
  readonly title: string;
  readonly pros?: readonly string[];
  readonly cons?: readonly string[];
  readonly cost?: string | null;
  readonly recommended?: boolean;
}

function decisionSections(detail: Readonly<Record<string, unknown>>): string[] {
  const options = (detail['options'] ?? []) as readonly OptionRow[];
  return [
    ...section('Question', detail['question']),
    '## Options',
    ...options.map(
      (option) =>
        `- \`${option.id}\`${option.recommended ? ' (recommended)' : ''}: ${option.title}` +
        `${option.pros?.length ? ` · pros: ${option.pros.join('; ')}` : ''}` +
        `${option.cons?.length ? ` · cons: ${option.cons.join('; ')}` : ''}` +
        `${option.cost ? ` · cost: ${option.cost}` : ''}`,
    ),
    `Decider: ${cell(text(detail['deciderRole']))} · kind: ${cell(text(detail['kind']))}`,
    ...(detail['chosenOptionId'] ? [`Chosen: \`${plain(detail['chosenOptionId'])}\``] : []),
    ...section('Rationale', detail['rationale']),
    ...section('ADR', detail['adrBody']),
  ];
}

interface StepRow {
  readonly id: string;
  readonly title: string;
  readonly role?: string;
  readonly taskKey?: string;
  readonly done: boolean;
  readonly why?: string;
  readonly size?: string;
  readonly after?: readonly string[];
  readonly acceptance?: string;
  readonly evidence?: readonly {
    readonly attachmentId: string;
    readonly kind: string;
    readonly caption?: string;
  }[];
}

/** A step's line, then its reason, size, the steps it waits for and when it is done, each indented (owner decision 9a). */
function stepLines(step: StepRow, index: number): string[] {
  const head =
    `${index + 1}. [${step.done ? 'x' : ' '}] ${step.title}` +
    `${step.role ? ` · ${step.role}` : ''}${step.taskKey ? ` · ${step.taskKey}` : ''}` +
    `${step.size ? ` · size ${step.size}` : ''} (id ${step.id})`;
  return [
    head,
    ...(step.why ? [`   Why: ${step.why}`] : []),
    ...(step.after?.length ? [`   After: ${step.after.join(', ')}`] : []),
    ...(step.acceptance ? [`   Done when: ${step.acceptance}`] : []),
    ...(step.evidence ?? []).map(
      (item) =>
        `   Evidence: ${item.kind}${item.caption ? ` · ${item.caption}` : ''} (attachment ${item.attachmentId})`,
    ),
  ];
}

interface PhaseRow {
  readonly id: string;
  readonly title: string;
  readonly note?: string;
}

/**
 * The steps, under their phases in order when the plan has phases (v5-live-plan), each keeping its number in the whole plan. Steps outside any
 * phase come last. A plan with no phases is one list, as before.
 */
function planSections(detail: Readonly<Record<string, unknown>>): string[] {
  const steps = (detail['steps'] ?? []) as readonly (StepRow & { readonly phaseId?: string })[];
  const phases = (detail['phases'] ?? []) as readonly PhaseRow[];
  const head = [
    `Revision ${plain(detail['revision'] ?? 1)}`,
    `## Steps (${steps.filter((step) => step.done).length}/${steps.length} done)`,
  ];
  if (phases.length === 0) return [...head, ...steps.flatMap(stepLines)];
  const known = new Set(phases.map((phase) => phase.id));
  const numbered = steps.map((step, index) => ({ step, index }));
  const block = (title: string, rows: typeof numbered) => [
    `### ${title}`,
    ...rows.flatMap(({ step, index }) => stepLines(step, index)),
  ];
  return [
    ...head,
    ...phases.flatMap((phase, n) =>
      block(
        `Phase ${n}: ${phase.title}${phase.note ? ` (${phase.note})` : ''} · id ${phase.id}`,
        numbered.filter(({ step }) => step.phaseId === phase.id),
      ),
    ),
    ...(() => {
      const loose = numbered.filter(({ step }) => !step.phaseId || !known.has(step.phaseId));
      return loose.length > 0 ? block('No phase', loose) : [];
    })(),
  ];
}

function typeSections(card: CardWithDetail): string[] {
  const detail = detailOf(card);
  switch (card.type) {
    case 'decision':
      return decisionSections(detail);
    case 'plan':
      return planSections(detail);
    case 'task':
      return [
        `Specialty: ${cell(text(detail['specialty']))} · effort: ${cell(text(detail['effort']))} · origin: ${cell(text(detail['origin']))}`,
        ...(detail['prUrl'] ? [`PR: ${plain(detail['prUrl'])}`] : []),
        ...section('Acceptance', detail['acceptance']),
        ...section('Prompt', detail['prompt']),
      ];
    case 'need':
      return [
        `Kind: ${cell(text(detail['kind']))} · responsible: ${cell(text(detail['responsibleRole']))}`,
        ...(detail['location'] ? [`Location: ${plain(detail['location'])}`] : []),
        ...section('Verification note', detail['verificationNote']),
      ];
    case 'handoff':
      return [
        `${cell(text(detail['fromRole']))} → ${cell(text(detail['toRole']))} · ${cell(text(detail['kind']))} · ${cell(text(detail['severity']))}`,
        ...section('Summary', detail['summary']),
        ...section('Prompt', detail['prompt']),
      ];
    case 'idea':
      return [...section('Problem', detail['problem']), ...section('Notes', detail['notes'])];
    case 'release':
      return [
        `Version: ${cell(text(detail['version']))} · tag: ${cell(text(detail['tag']))} · released: ${cell(text(detail['releasedAt']))}`,
      ];
    case 'redesign':
      return [
        `${cell(text(detail['app']))} / ${cell(text(detail['page']))} / ${cell(text(detail['version']))}`,
        ...(detail['labUrl'] ? [`Lab: ${plain(detail['labUrl'])}`] : []),
        ...section('Review', detail['reviewSummary']),
      ];
    case 'change':
      return [
        `${plain(detail['commitCount'] ?? 0)} commits · ${plain(detail['filesChanged'] ?? 0)} files · +${plain(detail['additions'] ?? 0)} −${plain(detail['deletions'] ?? 0)}`,
      ];
    case 'doc':
      return [`Path: ${cell(text(detail['path']))} · kind: ${cell(text(detail['kind']))}`];
  }
}

/** The card's sheet, as text. */
export function cardSheet(card: CardFullDto, project: ProjectRef, comments?: readonly CommentDto[]): string {
  const creator = card.createdBy.displayName ?? card.createdBy.kind;
  const links = card.links.map((link) => `- ${link.kind} ${cardRef(link.card)} (${link.card.status})`);
  const actions = card.actions.filter((action) => action.enabled).map((action) => action.action);
  return [
    cardRef(card),
    `${card.type} · ${card.status} · ${card.priority}${card.ownerRole ? ` · role: ${card.ownerRole}` : ''}` +
      `${card.assignee ? ` · assignee: ${card.assignee.displayName}` : ''}` +
      `${card.dueAt ? ` · due ${card.dueAt}` : ''} · created by ${creator} via ${card.createdBy.via}`,
    ...(card.archivedAt ? [`DELETED at ${card.archivedAt}. restore_card brings it back.`] : []),
    ...(card.awaiting ? [`Awaiting you: ${card.awaiting}`] : []),
    `URL: ${cardUrl(project, card)}`,
    ...typeSections(card),
    ...section('Body', card.body),
    ...(links.length > 0 ? ['## Links', ...links] : []),
    ...(actions.length > 0 ? [`You may now: ${actions.join(', ')}`] : []),
    ...(comments && comments.length > 0
      ? [
          `## Comments (${comments.length})`,
          ...comments.map(
            (comment) =>
              `- ${comment.createdAt} ${comment.author.displayName ?? comment.author.kind} [${comment.id}]: ${comment.body ?? '(redacted)'}`,
          ),
        ]
      : []),
  ].join('\n');
}

/** What every write answers: what changed, the card as it stands, and where to see it. */
export function written(
  verb: string,
  card: CardWrittenDto,
  project: ProjectRef,
  extra: readonly string[] = [],
): string {
  return [
    `${verb} ${cardRef(card)}`,
    `${card.type} · status: ${card.status} · ${card.priority} · project: ${project.slug} · event: ${card.event.kind}`,
    ...extra,
    `URL: ${cardUrl(project, card)}`,
  ].join('\n');
}
