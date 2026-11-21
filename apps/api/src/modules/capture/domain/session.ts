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

export function summaryTitle(changed: string, locale: SessionLocale = 'en'): string {
  return locale === 'ar'
    ? `جلسة: ${firstLine(changed) || 'بلا وصف'}`
    : `Session: ${firstLine(changed) || 'no description'}`;
}

export function summaryBody(
  input: Pick<LogSessionInput, 'changed' | 'remaining'>,
  locale: SessionLocale = 'en',
): string {
  const remaining = input.remaining?.trim();
  const [changed, left] = locale === 'ar' ? ['ما تم', 'المتبقي'] : ['Changed', 'Remaining'];
  return `### ${changed}\n${input.changed.trim()}${remaining ? `\n\n### ${left}\n${remaining}` : ''}`;
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

export type SessionLocale = 'ar' | 'en';

/** A duration as a reader scans it: days, hours, minutes. */
export function formatDuration(totalMinutes: number, locale: SessionLocale): string {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (locale === 'ar') {
    if (days > 0) return `${days} يوم${hours > 0 ? ` و${hours} ساعة` : ''}`;
    if (hours > 0) return `${hours} ساعة${minutes > 0 ? ` و${minutes} دقيقة` : ''}`;
    return `${minutes} دقيقة`;
  }
  if (days > 0) return `${days} d${hours > 0 ? ` ${hours} h` : ''}`;
  if (hours > 0) return `${hours} h${minutes > 0 ? ` ${minutes} min` : ''}`;
  return `${minutes} min`;
}

/**
 * The fallback card's title. What the member asked names it best; then the work Git saw (the first commit and how many more);
 * the counts come last, because a session that only talked has none.
 */
export function factsTitle(payload: HookSessionPayload, locale: SessionLocale = 'en'): string {
  const ar = locale === 'ar';
  const topic = payload.topic ? firstLine(payload.topic) : '';
  if (topic) return `${ar ? 'جلسة' : 'Session'}: ${topic}`;
  const place = payload.branch ?? payload.cwd.split(/[\\/]/).pop() ?? (ar ? 'غير معروف' : 'unknown');
  const commits = payload.commits.length;
  const files = payload.filesChanged;
  const [newest] = payload.commits;
  const subject = newest ? firstLine(newest.message, 70) : '';
  if (subject) {
    const more = commits - 1;
    if (ar) return `جلسة على ${place}: ${subject}${more > 0 ? ` (+${more} commits أخرى)` : ''}`;
    return `Session on ${place}: ${subject}${more > 0 ? ` (+${more} more)` : ''}`;
  }
  if (ar) return `جلسة على ${place}: ${commits} commits، ${files} ملفات`;
  return `Session on ${place}: ${commits} commit${commits === 1 ? '' : 's'}, ${files} file${files === 1 ? '' : 's'}`;
}

/** The fallback card's text (docs/07 §6.4): what Git and the transcript know, and that the summary is still missing. */
export function factsBody(payload: HookSessionPayload, locale: SessionLocale = 'en'): string {
  const ar = locale === 'ar';
  const lines = payload.commits.map((commit) => `- \`${commit.sha.slice(0, 7)}\` ${commit.message}`);
  const minutes = payload.durationSec ? Math.round(payload.durationSec / 60) : null;
  const intro = ar
    ? 'لم يُكتب ملخص لهذه الجلسة؛ هذه حقائق مأخوذة من Git ومن سجل المحادثة.'
    : 'No summary was written for this session. These are the facts from Git.';
  const facts = ar
    ? [
        `- المجلد: \`${payload.cwd}\``,
        ...(payload.branch ? [`- الفرع: \`${payload.branch}\``] : []),
        ...(minutes === null ? [] : [`- المدة: ${formatDuration(minutes, locale)}`]),
        `- الملفات المعدّلة: ${payload.filesChanged} (+${payload.additions} −${payload.deletions})`,
        ...(payload.dirtyFiles > 0 ? [`- ملفات غير ملتزم بها في النهاية: ${payload.dirtyFiles}`] : []),
      ]
    : [
        `- Folder: \`${payload.cwd}\``,
        ...(payload.branch ? [`- Branch: \`${payload.branch}\``] : []),
        ...(minutes === null ? [] : [`- Duration: ${formatDuration(minutes, locale)}`]),
        `- Files changed: ${payload.filesChanged} (+${payload.additions} −${payload.deletions})`,
        ...(payload.dirtyFiles > 0 ? [`- Uncommitted files at the end: ${payload.dirtyFiles}`] : []),
      ];
  return [
    intro,
    '',
    ...facts,
    ...(lines.length > 0 ? ['', ar ? '### الـ commits' : '### Commits', ...lines] : []),
    ...(payload.topic ? ['', ar ? '### ما طُلب' : '### Asked', payload.topic.trim()] : []),
    ...(payload.outcome ? ['', ar ? '### آخر رد' : '### Last reply', payload.outcome.trim()] : []),
    '',
    ar
      ? 'لكتابة ملخص كامل لجلسة قادمة، شغّل `/hub:done` قبل إنهائها.'
      : 'To get a full summary next time, run `/hub:done` before the session ends.',
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
