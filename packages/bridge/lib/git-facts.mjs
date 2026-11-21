/**
 * @file What Git says about a chat's folder: the branch, what moved during a turn, and a file's diff (docs/16 §7.1). Read only: nothing here writes.
 * @description A folder may have other work in it, so a turn's changes are what moved between its start and its end, plus what a Write or Edit step named. Counts come from `git diff --numstat`, and an untracked file's from its lines. A folder that is not
 * a repository still reports what the steps named, with no counts. External diff drivers and fsmonitor are switched off, because a repository's config must not get to run a program here.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const GIT_TIMEOUT_MS = 15_000;
const MAX_LISTED = 5_000;
const MAX_COUNTED_BYTES = 1_048_576;
const SAFE = ['-c', 'core.quotepath=off', '-c', 'core.fsmonitor=false', '-c', 'diff.external='];

const git = (system, folder, args, options = {}) =>
  system.run('git', [...SAFE, ...args], { cwd: folder, timeoutMs: GIT_TIMEOUT_MS, ...options });

export async function branchOf(system, folder) {
  const answer = await git(system, folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const name = answer.status === 0 ? answer.stdout.trim() : '';
  return name || null;
}

/** path → status and counts, or null when this is not a repository. */
export async function snapshot(system, folder) {
  const status = await git(system, folder, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.status !== 0) return null;
  const files = new Map();
  for (const line of status.stdout.split('\n').slice(0, MAX_LISTED)) {
    if (line.length < 4) continue;
    const name = line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g, '');
    files.set(name, { status: line.slice(0, 2).trim(), additions: undefined, deletions: undefined });
  }
  const counts = await git(system, folder, ['diff', '--numstat', '--no-ext-diff', 'HEAD']);
  if (counts.status === 0) {
    for (const line of counts.stdout.split('\n').slice(0, MAX_LISTED)) {
      const [added, removed, ...name] = line.split('\t');
      const entry = files.get(name.join('\t'));
      if (!entry || added === '-') continue;
      entry.additions = Number(added);
      entry.deletions = Number(removed);
    }
  }
  return files;
}

function linesOf(path) {
  try {
    if (statSync(path).size > MAX_COUNTED_BYTES) return undefined;
    const text = readFileSync(path, 'utf8');
    if (text === '') return 0;
    return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  } catch {
    return undefined;
  }
}

const same = (a, b) =>
  a?.status === b?.status && a?.additions === b?.additions && a?.deletions === b?.deletions;

function relativeTo(folder, path) {
  const inner = isAbsolute(path) ? relative(folder, path) : path;
  return inner.replaceAll('\\', '/');
}

/** What moved between `before` and `after`, with what the steps named first. Facts only: a count that is not known is left out. */
export function changedFiles(folder, before, after, toolPaths, limit) {
  const named = new Set([...toolPaths].map((path) => relativeTo(folder, path)));
  const moved = [];
  if (after) {
    for (const [path, entry] of after) if (!same(entry, before?.get(path))) moved.push(path);
    if (before) for (const path of before.keys()) if (!after.has(path)) moved.push(path);
  }
  const list = [...new Set([...named, ...moved])].filter((path) => !path.startsWith('../'));
  return list.slice(0, limit).map((path) => {
    const entry = after?.get(path);
    const untracked = entry?.status === '??';
    const lines = untracked ? linesOf(join(folder, path)) : undefined;
    const additions = lines ?? entry?.additions;
    return {
      path: path.slice(0, 1000),
      source: named.has(path) ? 'tool' : 'git',
      ...(entry?.status ? { status: entry.status.slice(0, 4) } : {}),
      ...(additions === undefined ? {} : { additions }),
      ...(untracked && additions !== undefined ? { deletions: 0 } : {}),
      ...(!untracked && entry?.deletions !== undefined ? { deletions: entry.deletions } : {}),
    };
  });
}

/** A file's diff against HEAD as it is now, or `available: false` when Git cannot say. The path stays inside the folder. */
export async function diffOf(system, folder, path, limitBytes) {
  const none = { path, diff: '', truncated: false, available: false };
  if (typeof path !== 'string' || path === '' || path.includes('\0') || isAbsolute(path)) return none;
  if (path.replaceAll('\\', '/').split('/').includes('..')) return none;
  const tracked = await git(
    system,
    folder,
    ['diff', '--no-ext-diff', '--no-color', '--no-textconv', 'HEAD', '--', path],
    { maxOutput: limitBytes + 1 },
  );
  let text = tracked.status === 0 ? tracked.stdout : '';
  if (text === '' && existsSync(join(folder, path))) {
    // Untracked: the whole file is new. `--no-index` exits 1 when files differ, which is the normal answer.
    const blank = process.platform === 'win32' ? 'NUL' : '/dev/null';
    const fresh = await git(
      system,
      folder,
      ['diff', '--no-index', '--no-ext-diff', '--no-color', '--', blank, path],
      { maxOutput: limitBytes + 1 },
    );
    if (fresh.status === 0 || fresh.status === 1) text = fresh.stdout;
  }
  if (text === '') return { ...none, available: tracked.status === 0 };
  return {
    path,
    diff: text.slice(0, limitBytes),
    truncated: text.length > limitBytes,
    available: true,
  };
}
