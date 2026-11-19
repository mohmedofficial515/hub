/**
 * @file Whether a folder is on a project's list (docs/16 §4). The bridge checks again with links resolved; this refuses early with a clear word.
 * Hub's own copy of a registered repository (`wt-<key>`, docs/16 §9.2) counts as that repository's, by the same rule the bridge keeps.
 */
import { worktreeBaseOf } from '@hub/contracts';

const normal = (path: string, platform: string): string => {
  const plain = path.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? plain.toLowerCase() : plain;
};

export function folderIsRegistered(folder: string, repoPaths: readonly string[], platform: string): boolean {
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return false;
  const inner = normal(folder, platform);
  const registered = repoPaths.some((path) => {
    const outer = normal(path, platform);
    return inner === outer || inner.startsWith(`${outer}/`);
  });
  return registered || worktreeBaseOf(folder, repoPaths, platform) !== null;
}

/** One checkout, whatever the spelling: slashes, a trailing one and, on Windows, case do not make two folders. */
export const sameFolder = (a: string, b: string): boolean => {
  const plain = (path: string) => path.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
  return plain(a) === plain(b);
};

/** A chat's first words become its title, cut at a word. */
export function titleFrom(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(' ');
  return `${space > 20 ? cut.slice(0, space) : cut}…`;
}

/** JSON that is too large is kept as the start of its text, marked, rather than cut anywhere that would break it. */
export function capJson(value: unknown, limit: number): unknown {
  const text = JSON.stringify(value ?? null);
  if (text.length <= limit) return value ?? null;
  return { truncatedByHub: true, start: text.slice(0, limit) };
}
