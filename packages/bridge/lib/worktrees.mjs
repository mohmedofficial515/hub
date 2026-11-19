/**
 * @file Hub's own worktrees on this device (docs/16 §9.2): `folder.status`, `worktree.prepare` and `worktree.remove`.
 * @description A queued run works in a copy of its repository of its own, beside it in the owner's pattern: `F:/Goteav/backend` gets `F:/Goteav/wt-GTV-37/backend` on the branch
 * `hub/gtv-37`, made from the repository's current commit. Its `node_modules` folders are links to the repository's own (the owner's choice), made only where Git ignores
 * them, so a link is never committed. Removing a copy unlinks those first and only then asks Git to remove the folder, so the repository's real `node_modules` is never
 * touched, and a copy with changes not committed is refused rather than lost. Its branch always stays. `@hub/contracts` (`worktrees.ts`) holds the naming rules too, and a
 * spec runs both against the same cases. Everything goes through `system.run` with no shell.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { Refusal } from './protocol.mjs';

export const WORKTREE_KEY_PATTERN = /^(?:[a-z]{2,6}-\d{1,7}|run-[0-9a-f]{8})$/i;
export const worktreeBranchOf = (key) => `hub/${key.toLowerCase()}`;

const GIT_TIMEOUT_MS = 60_000;
const SAFE = ['-c', 'core.quotepath=off', '-c', 'core.fsmonitor=false'];
/** The links a copy got, kept in its own Git folder so the working tree stays clean. */
const LINKS_FILE = 'hub-links.json';
/** How deep to look for `node_modules` beside a `package.json`: a monorepo's apps and packages, not further. */
const LINK_DEPTH = 3;
const SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.turbo',
  '.cache',
]);

const git = (system, cwd, args) => system.run('git', [...SAFE, ...args], { cwd, timeoutMs: GIT_TIMEOUT_MS });

/** The same rule as `worktreeFolderFor` in `@hub/contracts`: `<parent>/wt-<key>/<name>`, with the folder's own separators. */
export function worktreeFolderFor(folder, key) {
  if (typeof folder !== 'string' || !WORKTREE_KEY_PATTERN.test(key ?? '')) return null;
  const separator = folder.includes('\\') ? '\\' : '/';
  const trimmed = folder.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (cut <= 0) return null;
  const name = trimmed.slice(cut + 1);
  if (!name) return null;
  return `${trimmed.slice(0, cut)}${separator}wt-${key}${separator}${name}`;
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether `inner` is in Hub's copy of `outer`. Both are already canonical (slashes forward, no trailing one, lower case on Windows), as `allowlist.mjs` makes them.
 * The same rule as `worktreeBaseOf` in `@hub/contracts`.
 */
export function isWorktreeOf(inner, outer, platform) {
  const cut = outer.lastIndexOf('/');
  if (cut <= 0) return false;
  const pattern = new RegExp(
    `^${escape(outer.slice(0, cut))}/wt-([^/]+)/${escape(outer.slice(cut + 1))}(?:/|$)`,
    platform === 'win32' ? 'i' : '',
  );
  const key = pattern.exec(inner)?.[1];
  return Boolean(key && WORKTREE_KEY_PATTERN.test(key));
}

/** A folder that is one of Hub's copies: named `wt-<key>/<name>`, and a linked worktree, whose `.git` is a file rather than a folder. */
export function isHubWorktree(folder) {
  if (typeof folder !== 'string' || !isAbsolute(folder)) return false;
  const parent = basename(dirname(resolve(folder)));
  if (!/^wt-/.test(parent) || !WORKTREE_KEY_PATTERN.test(parent.slice(3))) return false;
  try {
    return statSync(join(folder, '.git')).isFile();
  } catch {
    return false;
  }
}

const canonical = (path, platform) => {
  let real = resolve(path);
  try {
    real = realpathSync.native(real);
  } catch {
    /* Compared as written. */
  }
  const unified = real.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? unified.toLowerCase() : unified;
};

async function topOf(system, folder) {
  const top = await git(system, folder, ['rev-parse', '--show-toplevel']);
  return top.status === 0 ? top.stdout.trim() : null;
}

/** `folder.status`: read only. Untracked files count, as a run would mix them with its own just the same. */
export async function folderStatus(system, folder) {
  const inside = await git(system, folder, ['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
    return { repository: false, changed: 0, branch: null };
  }
  const status = await git(system, folder, ['status', '--porcelain=v1', '--untracked-files=all']);
  const changed =
    status.status === 0 ? status.stdout.split('\n').filter((line) => line.length > 3).length : 0;
  const head = await git(system, folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = head.status === 0 && head.stdout.trim() !== 'HEAD' ? head.stdout.trim() : null;
  return { repository: true, changed, branch };
}

/** Each `node_modules` beside a `package.json`, relative to the repository, at most `LINK_DEPTH` folders down. */
export function findPackageFolders(top, depth = LINK_DEPTH) {
  const found = [];
  const walk = (folder, level) => {
    let entries;
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    const names = new Set(entries.map((entry) => entry.name));
    if (names.has('package.json') && names.has('node_modules')) {
      found.push(relative(top, join(folder, 'node_modules')) || 'node_modules');
    }
    if (level >= depth) return;
    for (const entry of entries) {
      if (!entry.isDirectory() || SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(join(folder, entry.name), level + 1);
    }
  };
  walk(top, 0);
  return found;
}

async function adminDirOf(system, folder) {
  const dir = await git(system, folder, ['rev-parse', '--absolute-git-dir']);
  return dir.status === 0 ? dir.stdout.trim() : null;
}

/** Links the repository's `node_modules` into the copy, only where Git ignores the name there, so a link can never be committed. */
async function linkPackages(system, top, copy) {
  const linked = [];
  for (const rel of findPackageFolders(top)) {
    const link = join(copy, rel);
    if (existsSync(link) || !existsSync(dirname(link))) continue;
    const ignored = await git(system, copy, ['check-ignore', '-q', '--no-index', rel.replaceAll('\\', '/')]);
    if (ignored.status !== 0) continue;
    try {
      symlinkSync(join(top, rel), link, system.platform === 'win32' ? 'junction' : 'dir');
      linked.push(rel);
    } catch {
      /* Without the link the run can still edit; it may not build. Nothing else depends on it. */
    }
  }
  const admin = await adminDirOf(system, copy);
  if (admin) {
    const earlier = readLinks(admin);
    writeFileSync(join(admin, LINKS_FILE), JSON.stringify([...new Set([...earlier, ...linked])]));
  }
  return linked.length;
}

function readLinks(admin) {
  try {
    const list = JSON.parse(readFileSync(join(admin, LINKS_FILE), 'utf8'));
    return Array.isArray(list) ? list.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * `worktree.prepare`: the run's copy of the repository at `folder`, made or found again. Only a repository's top folder is copied, since a copy holds a whole
 * repository. A copy already there, as for a plan's next step, is used as it is.
 */
export async function prepareWorktree(system, folder, key) {
  if (!WORKTREE_KEY_PATTERN.test(key ?? '')) throw new Refusal('bad_arguments');
  const top = await topOf(system, folder);
  if (!top) throw new Refusal('not_a_repository', 'This folder is not in a Git repository.');
  if (canonical(top, system.platform) !== canonical(folder, system.platform)) {
    throw new Refusal('not_a_repository', 'This folder is inside a repository, not its top folder.');
  }
  const target = worktreeFolderFor(folder, key);
  if (!target) throw new Refusal('bad_arguments');
  const branch = worktreeBranchOf(key);
  const common = await git(system, folder, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (existsSync(target)) {
    const theirs = await git(system, target, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
    if (
      theirs.status !== 0 ||
      common.status !== 0 ||
      canonical(theirs.stdout.trim(), system.platform) !== canonical(common.stdout.trim(), system.platform)
    ) {
      throw new Refusal('failed', `${target} already exists and is not a copy of this repository.`);
    }
    const head = await git(system, target, ['rev-parse', 'HEAD']);
    const at = await git(system, target, ['rev-parse', '--abbrev-ref', 'HEAD']);
    const linked = await linkPackages(system, top, target);
    return {
      folder: target,
      branch: at.stdout.trim() || branch,
      base: head.stdout.trim(),
      baseBranch: null,
      reused: true,
      linked,
    };
  }
  const head = await git(system, folder, ['rev-parse', 'HEAD']);
  if (head.status !== 0) throw new Refusal('failed', 'The repository has no commit to start from.');
  const at = await git(system, folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const baseBranch = at.status === 0 && at.stdout.trim() !== 'HEAD' ? at.stdout.trim() : null;
  const exists = await git(system, folder, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  mkdirSync(dirname(target), { recursive: true });
  const added = await git(
    system,
    folder,
    exists.status === 0
      ? ['worktree', 'add', target, branch]
      : ['worktree', 'add', '-b', branch, target, head.stdout.trim()],
  );
  if (added.status !== 0) {
    try {
      rmdirSync(dirname(target));
    } catch {
      /* Not empty, or already gone: left as it is. */
    }
    throw new Refusal(
      'failed',
      (added.stderr || added.stdout).trim().slice(0, 400) || 'git worktree add failed',
    );
  }
  const linked = await linkPackages(system, top, target);
  return { folder: target, branch, base: head.stdout.trim(), baseBranch, reused: false, linked };
}

/** Every link to unmake before Git removes the folder: the recorded ones, and any other link named `node_modules` near the top. */
function linksIn(copy, recorded) {
  const found = new Set(recorded.map((rel) => join(copy, rel)));
  for (const rel of findPackageFolders(copy)) found.add(join(copy, rel));
  found.add(join(copy, 'node_modules'));
  return [...found].filter((path) => {
    try {
      return lstatSync(path).isSymbolicLink();
    } catch {
      return false;
    }
  });
}

/**
 * `worktree.remove`: the copy at `folder` goes, and its branch stays with every commit on it. Refused while it holds changes not committed, which would be lost.
 * The links go first and one by one, never recursively, so the repository's own `node_modules` is never reached.
 */
export async function removeWorktree(system, folder) {
  if (!isHubWorktree(folder)) throw new Refusal('bad_arguments', 'This is not one of Hub’s copies.');
  const status = await git(system, folder, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status.status !== 0)
    throw new Refusal('failed', (status.stderr || 'git status failed').trim().slice(0, 400));
  if (status.stdout.split('\n').some((line) => line.length > 3)) {
    throw new Refusal('worktree_dirty', 'The copy has changes not committed.');
  }
  const at = await git(system, folder, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = at.status === 0 && at.stdout.trim() !== 'HEAD' ? at.stdout.trim() : null;
  const common = await git(system, folder, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const admin = await adminDirOf(system, folder);
  if (common.status !== 0 || !admin)
    throw new Refusal('failed', 'Git could not say which repository this copy belongs to.');
  for (const link of linksIn(folder, readLinks(admin))) unlinkSync(link);
  // The main repository's folder: the common Git folder's parent for a normal repository.
  const main = dirname(common.stdout.trim());
  const removed = await git(system, main, ['worktree', 'remove', folder]);
  if (removed.status !== 0) {
    throw new Refusal(
      'failed',
      (removed.stderr || removed.stdout).trim().slice(0, 400) || 'git worktree remove failed',
    );
  }
  await git(system, main, ['worktree', 'prune']);
  try {
    rmdirSync(dirname(folder));
  } catch {
    /* The `wt-` folder holds something else of the owner's, or is gone: left as it is. */
  }
  return { branch };
}
