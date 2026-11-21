/**
 * @file Hub's own worktrees (docs/16 §9.2): a queued run works in a copy of its repository of its own, so runs on the same repository never touch each other's files.
 * @description The copy sits beside the registered repository, in the owner's own pattern: `F:/Goteav/backend` gets `F:/Goteav/wt-GTV-37/backend`, on the branch `hub/gtv-37`
 * made from the repository's current branch. A run of a card uses the card's key, so a plan's steps continue in one copy one after another; a prompt run uses `run-` and the end
 * of its id. Only a name of exactly that form counts, so the owner's own `wt-payments` is never taken for one of Hub's. The bridge is plain Node and restates these rules in
 * `packages/bridge/lib/worktrees.mjs`; `worktrees.spec.ts` runs both against the same cases.
 */

/** A card key (`GTV-37`) or `run-` and 8 hex digits. Case does not count, as Windows paths are compared in lower case. */
export const WORKTREE_KEY_PATTERN = /^(?:[a-z]{2,6}-\d{1,7}|run-[0-9a-f]{8})$/i;

/** How a queued run works (docs/16 §9.2). `worktree`, the default, isolates a run in a git repository; `folder` works in the registered folder itself, as before. */
export const QUEUE_ISOLATIONS = ['worktree', 'folder'] as const;
export type QueueIsolation = (typeof QUEUE_ISOLATIONS)[number];

/** The copy's name for a run: its card's key, or `run-` and the last 8 hex digits of its id. */
export function worktreeKeyOf(run: { readonly cardKey: string | null; readonly id: string }): string {
  if (run.cardKey) return run.cardKey.toUpperCase();
  return `run-${run.id.replaceAll('-', '').slice(-8).toLowerCase()}`;
}

/** The branch Hub makes for a copy. `hub/` marks it as Hub's own, so the owner can tell it from theirs. */
export const worktreeBranchOf = (key: string): string => `hub/${key.toLowerCase()}`;

/**
 * Where the copy of `folder` for `key` lives: `<parent>/wt-<key>/<name>`, with the folder's own separators. Null for a folder with no parent (a root), which cannot have one,
 * and for a key that is not one of Hub's.
 */
export function worktreeFolderFor(folder: string, key: string): string | null {
  if (!WORKTREE_KEY_PATTERN.test(key)) return null;
  const separator = folder.includes('\\') ? '\\' : '/';
  const trimmed = folder.replace(/[\\/]+$/, '');
  const cut = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (cut <= 0) return null;
  const parent = trimmed.slice(0, cut);
  const name = trimmed.slice(cut + 1);
  if (!name) return null;
  return `${parent}${separator}wt-${key}${separator}${name}`;
}

const normal = (path: string, platform: string): string => {
  const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? plain.toLowerCase() : plain;
};

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The registered folder whose Hub copy holds `folder`, or null. `folder` may be the copy itself or a folder inside it, as with the registered folder (docs/16 §4).
 * A folder with `..` in it is never one.
 */
export function worktreeBaseOf(
  folder: string,
  repoPaths: readonly string[],
  platform: string,
): string | null {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return null;
  const inner = normal(folder, platform);
  for (const path of repoPaths) {
    const outer = normal(path, platform);
    const cut = outer.lastIndexOf('/');
    if (cut <= 0) continue;
    const parent = outer.slice(0, cut);
    const name = outer.slice(cut + 1);
    const match = new RegExp(
      `^${escape(parent)}/wt-([^/]+)/${escape(name)}(?:/|$)`,
      platform === 'win32' ? 'i' : '',
    ).exec(inner);
    if (match?.[1] && WORKTREE_KEY_PATTERN.test(match[1])) return path;
  }
  return null;
}
