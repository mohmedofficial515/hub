/**
 * @file Hub's plugin as a device installs it (docs/16 §11, D64): its files, a version that changes with any of them, and each skill's hash.
 * @description Claude Code updates an installed plugin only when its version changes (tested on 2.1.319: same version, `up_to_date`; any other string, `updated`).
 * So the version is the package's own, then `-sync.` and the start of the files' hash, written into both manifests. Pure, so the API and its tests agree on every hash.
 */
import { createHash } from 'node:crypto';

export interface BundleFile {
  readonly path: string;
  readonly text: string;
}

export interface PluginBundle {
  readonly version: string;
  /** Under the marketplace folder: `.claude-plugin/marketplace.json` and `plugin/...`. */
  readonly files: readonly BundleFile[];
  /** Each skill folder's hash, `skillHashOf` of its files. */
  readonly skills: Readonly<Record<string, string>>;
}

export const MARKETPLACE_FILE = '.claude-plugin/marketplace.json';
export const PLUGIN_FILE = 'plugin/.claude-plugin/plugin.json';
const SKILL_PREFIX = 'plugin/skills/';

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const byPath = (a: BundleFile, b: BundleFile): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** A skill folder's hash: its files, paths relative to the folder, in path order. The Skills page and the sync both use it. */
export function skillHashOf(files: readonly BundleFile[]): string {
  const hash = createHash('sha256');
  for (const file of [...files].sort(byPath)) hash.update(`${file.path}\0${file.text}\0`);
  return hash.digest('hex');
}

/** The skills in a set of plugin files, each with its hash. */
export function skillHashes(files: readonly BundleFile[]): Record<string, string> {
  const groups = new Map<string, BundleFile[]>();
  for (const file of files) {
    if (!file.path.startsWith(SKILL_PREFIX)) continue;
    const rest = file.path.slice(SKILL_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0) continue;
    const name = rest.slice(0, slash);
    const list = groups.get(name) ?? [];
    list.push({ path: rest.slice(slash + 1), text: file.text });
    groups.set(name, list);
  }
  return Object.fromEntries(
    [...groups.entries()]
      .filter(([, list]) => list.some((file) => file.path === 'SKILL.md'))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([name, list]) => [name, skillHashOf(list)]),
  );
}

function withVersion(text: string, path: string, version: string): string {
  const json = JSON.parse(text) as { version?: string; plugins?: { name?: string; version?: string }[] };
  if (path === PLUGIN_FILE) json.version = version;
  else json.plugins = (json.plugins ?? []).map((plugin) => ({ ...plugin, version }));
  return `${JSON.stringify(json, null, 2)}\n`;
}

/** The files as the checkout holds them become what a device installs. A manifest that cannot be read keeps its text, and the version still changes with the files. */
export function bundleOf(raw: readonly BundleFile[], packageVersion: string): PluginBundle {
  const files = [...raw].sort(byPath);
  const digest = sha256(files.map((file) => `${file.path}\0${file.text}`).join('\0'));
  const version = `${packageVersion}-sync.${digest.slice(0, 12)}`;
  return {
    version,
    files: files.map((file) => {
      if (file.path !== MARKETPLACE_FILE && file.path !== PLUGIN_FILE) return file;
      try {
        return { path: file.path, text: withVersion(file.text, file.path, version) };
      } catch {
        return file;
      }
    }),
    skills: skillHashes(files),
  };
}
