/**
 * @file studio-acts.ts
 * @description What a studio step did, in plain words: the tool Claude called, read as an act (searched the code, read a card, opened a page) and the thing it
 * acted on. The studio's conversation and its research board both read steps through here, so a step is named the same way in both, and never by its raw
 * tool name. Pure, so it is tested without a page.
 */

export type Where = 'hub' | 'code' | 'web' | 'report' | 'other';

/** The act's words live in the page's messages under these keys, as a [running, done] pair. */
export type ActKey =
  | 'brief'
  | 'ideas'
  | 'plans'
  | 'plan'
  | 'cards'
  | 'card'
  | 'docs'
  | 'doc'
  | 'report'
  | 'hubOther'
  | 'grep'
  | 'glob'
  | 'read'
  | 'search'
  | 'fetch'
  | 'tools'
  | 'ask'
  | 'agent'
  | 'other';

export interface Act {
  where: Where;
  key: ActKey;
  /** What it acted on: a search, a path, a card key, a host. Empty when there is nothing to name. */
  subject: string;
  /** A page Claude opened, to link to. */
  href?: string;
  /** A card key the step named, to show as a chip. */
  card?: string;
  /** The full file path a Read touched, for the board's list of files. */
  file?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** The input of a step, whether it came as an object (a stored step) or as JSON text (a thread item). */
export function inputOf(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object') return input as Record<string, unknown>;
  if (typeof input !== 'string' || !input) return {};
  try {
    const value = JSON.parse(input) as unknown;
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The last two parts of a path: enough to recognise a file, short enough for one line. */
export const shortPath = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean).slice(-2).join('/');

/** A path inside the project, without the drive and the folders above the repository. */
export function projectPath(p: string): string {
  const clean = p.replace(/\\/g, '/');
  const at = clean.search(/\/(src|apps|packages|prisma|docs|test|tests|lib|app|e2e|scripts)\//);
  if (/^[A-Za-z]:\//.test(clean) || clean.startsWith('/')) {
    if (at > 0) {
      // Keep the repository's own folder name before src/, so `web/src/…` and `backend/src/…` stay apart.
      const before = clean.slice(0, at).split('/').filter(Boolean);
      const repo = before.at(-1);
      return `${repo ? `${repo}/` : ''}${clean.slice(at + 1)}`;
    }
    return clean.split('/').filter(Boolean).slice(-3).join('/');
  }
  return clean;
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const CARD_KEY = /^[A-Z]{2,6}-\d{1,7}$/;

const HUB_ACT: Record<string, ActKey> = {
  get_project_brief: 'brief',
  whats_new: 'brief',
  get_project: 'brief',
  list_ideas: 'ideas',
  list_plans: 'plans',
  get_plan: 'plan',
  list_cards: 'cards',
  list_tasks: 'cards',
  list_decisions: 'cards',
  list_needs: 'cards',
  list_handoffs: 'cards',
  get_card: 'card',
  get_decision: 'card',
  search_docs: 'docs',
  get_doc: 'doc',
  propose_idea: 'report',
  propose_plan: 'report',
};

/** One step as an act. `name` is the tool's name as Claude Code calls it; `input` is its input, as an object or as JSON. */
export function actOf(name: string, rawInput: unknown): Act {
  const input = inputOf(rawInput);
  if (name.startsWith('mcp__hub__')) {
    const tool = name.slice('mcp__hub__'.length);
    const key = HUB_ACT[tool] ?? 'hubOther';
    if (key === 'report') return { where: 'report', key, subject: str(input.title) };
    const cardKey = str(input.key);
    const subject =
      str(input.query) ||
      str(input.q) ||
      cardKey ||
      str(input.path) ||
      (key === 'hubOther' ? tool.replace(/_/g, ' ') : '');
    return { where: 'hub', key, subject, ...(CARD_KEY.test(cardKey) ? { card: cardKey } : {}) };
  }
  switch (name) {
    case 'Grep':
      return { where: 'code', key: 'grep', subject: str(input.pattern) };
    case 'Glob':
      return { where: 'code', key: 'glob', subject: str(input.pattern) };
    case 'Read': {
      const file = str(input.file_path);
      return {
        where: 'code',
        key: 'read',
        subject: shortPath(file),
        ...(file ? { file: projectPath(file) } : {}),
      };
    }
    case 'LS':
      return { where: 'code', key: 'glob', subject: shortPath(str(input.path)) };
    case 'WebSearch':
      return { where: 'web', key: 'search', subject: str(input.query) };
    case 'WebFetch': {
      const url = str(input.url);
      return { where: 'web', key: 'fetch', subject: hostOf(url), ...(url ? { href: url } : {}) };
    }
    case 'ToolSearch':
      return { where: 'other', key: 'tools', subject: '' };
    case 'AskUserQuestion':
      return { where: 'other', key: 'ask', subject: '' };
    case 'Task':
    case 'Agent':
      return { where: 'other', key: 'agent', subject: str(input.description) };
    default:
      return { where: 'other', key: 'other', subject: name };
  }
}

/** Steps that are plumbing, not research: never counted, never listed. */
export const isPlumbing = (name: string) => name === 'ToolSearch' || name === 'mcp__hub__report_stage';

export interface Discovery {
  cards: string[];
  files: string[];
  searches: string[];
  pages: { host: string; href: string }[];
  webSearches: string[];
  counts: Record<'hub' | 'code' | 'web', number>;
}

/**
 * What a turn has found so far, for the research board: the cards it read, the files it opened, what it searched for and the pages it opened, each once and
 * in the order it met them.
 */
export function discoveryOf(steps: readonly { name: string; input?: unknown }[]): Discovery {
  const out: Discovery = {
    cards: [],
    files: [],
    searches: [],
    pages: [],
    webSearches: [],
    counts: { hub: 0, code: 0, web: 0 },
  };
  const add = (list: string[], value: string | undefined) => {
    if (value && !list.includes(value)) list.push(value);
  };
  for (const step of steps) {
    if (isPlumbing(step.name)) continue;
    const act = actOf(step.name, step.input);
    if (act.where === 'hub' || act.where === 'code' || act.where === 'web') out.counts[act.where] += 1;
    if (act.card) add(out.cards, act.card);
    if (act.file) add(out.files, act.file);
    if (act.key === 'grep' && act.subject) add(out.searches, act.subject);
    if (act.key === 'search' && act.subject) add(out.webSearches, act.subject);
    if (act.href && !out.pages.some((p) => p.href === act.href))
      out.pages.push({ host: act.subject, href: act.href });
  }
  return out;
}
