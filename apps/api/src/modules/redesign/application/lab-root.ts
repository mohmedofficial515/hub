/**
 * @file Where the lab is, and the addresses of its versions (docs/16 §6).
 * @description Hub's web proxy serves the lab at `/lab` on its own origin, so no separate address exists. The folder defaults to the
 * repository's `apps/lab`, found from where the API runs: the repository root or `apps/api`, for `src` and `dist` alike.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const LAB_BASE = '/lab';

/** The hash route of the lab's own gallery. This is what `RedesignDetail.labUrl` holds (docs/03). */
export const labVersionUrl = (labPath: string): string => `${LAB_BASE}/#/${labPath}`;

export const labFrameUrl = (app: string, page: string, version: string): string =>
  `${LAB_BASE}/frame-${app}.html#/${page}/${version}`;

/** A lab has its gallery folder and at least one app. Null when this checkout has none, as in a container. */
export function defaultLabRoot(cwd: string = process.cwd()): string | null {
  const found = [resolve(cwd, 'apps/lab'), resolve(cwd, '../../apps/lab')].find((path) =>
    existsSync(join(path, 'lab/index.html')),
  );
  return found ? found.split('\\').join('/') : null;
}
