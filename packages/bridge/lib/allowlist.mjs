/**
 * @file The folder rule (docs/16 §4): the bridge works only in folders registered on a project (`repoPaths`).
 * @description Hub sends the list, and this is the check. A folder must be absolute, hold no `..`, and sit at or under a registered folder once links are resolved, so a
 * symbolic link inside a project cannot lead out of it. Case and slash direction do not count on Windows.
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

function canonical(path, platform) {
  let real = resolve(path);
  try {
    real = realpathSync.native(real);
  } catch {
    /* It does not exist here: compare it as written, and the action reports it missing. */
  }
  const unified = real.replaceAll('\\', '/').replace(/\/+$/, '');
  return platform === 'win32' ? unified.toLowerCase() : unified;
}

const isUnder = (inner, outer) => inner === outer || inner.startsWith(`${outer}/`);

/** The entry that allows this folder, or null. `project`, when given, must be that entry's project. */
export function allowedEntry(folder, entries, platform, project) {
  if (typeof folder !== 'string' || folder === '' || !isAbsolute(folder)) return null;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(folder)) return null;
  const inner = canonical(folder, platform);
  return (
    entries.find(
      (entry) =>
        (project === undefined || entry.project === project) &&
        isUnder(inner, canonical(entry.path, platform)),
    ) ?? null
  );
}
