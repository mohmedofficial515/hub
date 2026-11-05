/**
 * @file Pure rules of session capture: card text from a summary or from Git facts, keys named in text (docs/06 §4).
 */
import type { HookSessionPayload, LogSessionInput } from '@hub/contracts';

const TITLE_LENGTH = 100;

export interface SessionFacts {
  readonly commits: readonly unknown[];
  readonly filesChanged: number;
  readonly additions: number;
  readonly deletions: number;
}

export function firstLine(text: string, length = TITLE_LENGTH): string {
  const line = (text.split('\n').find((part) => part.trim() !== '') ?? '').replace(/^[\s*#>-]+/, '').trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}

export function summaryTitle(changed: string): string {
  return `Session: ${firstLine(changed) || 'no description'}`;
}

export function summaryBody(input: Pick<LogSessionInput, 'changed' | 'remaining'>): string {
  const remaining = input.remaining?.trim();
  return `### Changed\n${input.changed.trim()}${remaining ? `\n\n### Remaining\n${remaining}` : ''}`;
}

export function factsOf(payload: HookSessionPayload): SessionFacts {
  return {
    commits: payload.commits,
    filesChanged: payload.filesChanged,
    additions: payload.additions,
    deletions: payload.deletions,
  };
}

export function isIdleSession(payload: HookSessionPayload): boolean {
  return payload.commits.length === 0 && payload.filesChanged === 0 && payload.dirtyFiles === 0;
}

export function factsTitle(payload: HookSessionPayload): string {
  const commits = payload.commits.length;
  const files = payload.filesChanged;
  const place = payload.branch ?? payload.cwd.split(/[\\/]/).pop() ?? 'unknown';
  return `Session on ${place}: ${commits} commit${commits === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}`;
}

/** The fallback card's text (docs/07 §6.4): what Git knows, and that the summary is still missing. */
export function factsBody(payload: HookSessionPayload): string {
  const lines = payload.commits.map((commit) => `- \`${commit.sha.slice(0, 7)}\` ${commit.message}`);
  const minutes = payload.durationSec ? Math.round(payload.durationSec / 60) : null;
  return [
    'No summary was written for this session. These are the facts from Git.',
    '',
    `- Folder: \`${payload.cwd}\``,
    ...(payload.branch ? [`- Branch: \`${payload.branch}\``] : []),
    ...(minutes === null ? [] : [`- Duration: ${minutes} min`]),
    `- Files changed: ${payload.filesChanged} (+${payload.additions} −${payload.deletions})`,
    ...(payload.dirtyFiles > 0 ? [`- Uncommitted files at the end: ${payload.dirtyFiles}`] : []),
    ...(lines.length > 0 ? ['', '### Commits', ...lines] : []),
  ].join('\n');
}

/** Every card key of this project named in the text, once each. */
export function keysInText(text: string, keyPrefix: string): string[] {
  const found = text.match(new RegExp(`\\b${keyPrefix}-\\d{1,7}\\b`, 'g')) ?? [];
  return [...new Set(found)];
}

/** `owner/repo` from `git@github.com:owner/repo.git` or `https://github.com/owner/repo.git`, lower-cased. */
export function repoSlugOfRemote(remote: string | null | undefined): string | null {
  if (!remote) return null;
  const match = /[:/]([^/:]+\/[^/]+?)(?:\.git)?\/?$/.exec(remote.trim());
  return match?.[1]?.toLowerCase() ?? null;
}

/** A folder inside one of a project's local folders. Case and slash direction do not count, as on Windows. */
export function isInsideFolder(cwd: string, folder: string): boolean {
  const normal = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  const inner = normal(cwd);
  const outer = normal(folder);
  return outer !== '' && (inner === outer || inner.startsWith(`${outer}/`));
}
