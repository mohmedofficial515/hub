/**
 * @file `plugin.sync` (docs/16 §11, D64): Hub's plugin, with Hub's skills, reaches this device.
 * @description Hub sends the plugin's files and their version. The bridge writes them as its marketplace folder (`~/.hub/app/team-pack`), whole or not at all, then has Claude Code
 * take that version: `plugin update` for an installed plugin, the normal install when it has none. Claude Code updates only when the version changes, which is why Hub's version
 * carries the files' hash (tested on 2.1.319). A plugin the owner turned off stays off. Only paths of the plugin are written, and nothing outside that folder. One sync at a time.
 */
import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

import { resolveClaude } from './claude.mjs';
import { installPlugin } from './install.mjs';
import { hubPaths } from './paths.mjs';
import { Refusal } from './protocol.mjs';

const VERSION = /^\d+\.\d+\.\d+(?:-sync\.[0-9a-f]{8,64})?$/;
const MAX_FILES = 2_000;
const MAX_BYTES = 16 * 1024 * 1024;
/** What a plugin sync may write: the marketplace's manifest and the plugin's own folder. */
const ALLOWED = /^(?:\.claude-plugin\/marketplace\.json|plugin\/.+)$/;

let queue = Promise.resolve();

/** Every file must be text under the plugin, with a plain relative path. */
export function checkFiles(files) {
  if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES)
    throw new Refusal('bad_arguments');
  let bytes = 0;
  for (const file of files) {
    if (typeof file?.path !== 'string' || typeof file.text !== 'string') throw new Refusal('bad_arguments');
    const { path } = file;
    const parts = path.split('/');
    if (
      !ALLOWED.test(path) ||
      path.includes('\\') ||
      path.includes('\0') ||
      parts.some((part) => part === '..' || part === '.' || part === '')
    ) {
      throw new Refusal('bad_arguments', `Refused a path from Hub: ${path.slice(0, 200)}`);
    }
    bytes += Buffer.byteLength(file.text);
    if (bytes > MAX_BYTES) throw new Refusal('bad_arguments', 'The plugin is larger than a sync takes.');
  }
  if (!files.some((file) => file.path === '.claude-plugin/marketplace.json'))
    throw new Refusal('bad_arguments');
}

function writeTree(folder, files) {
  for (const file of files) {
    const target = resolve(folder, ...file.path.split('/'));
    if (!target.startsWith(folder + sep)) throw new Refusal('bad_arguments');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.text);
  }
}

/** The marketplace folder becomes exactly these files, beside the team pack's `package.json`. A swap that Windows refuses falls back to writing the plugin in place. */
export function writeMarketplace(root, files) {
  const next = `${root}.next`;
  const old = `${root}.old`;
  rmSync(next, { recursive: true, force: true });
  mkdirSync(next, { recursive: true });
  writeTree(next, files);
  if (existsSync(join(root, 'package.json'))) cpSync(join(root, 'package.json'), join(next, 'package.json'));
  try {
    rmSync(old, { recursive: true, force: true });
    if (existsSync(root)) renameSync(root, old);
    renameSync(next, root);
    rmSync(old, { recursive: true, force: true });
  } catch {
    if (!existsSync(root) && existsSync(old)) renameSync(old, root);
    rmSync(join(root, 'plugin'), { recursive: true, force: true });
    rmSync(join(root, '.claude-plugin'), { recursive: true, force: true });
    writeTree(root, files);
    rmSync(next, { recursive: true, force: true });
  }
}

/** Claude Code's own record of the plugin: its version and whether it is on. Null when it is not installed. */
export async function installedPlugin(system, claudePath) {
  const listed = await system.run(claudePath, ['plugin', 'list', '--json'], { timeoutMs: 30_000 });
  if (listed.status !== 0) return null;
  try {
    const entry = JSON.parse(listed.stdout).find((plugin) => plugin.id === 'hub@hub');
    return entry ? { version: entry.version ?? null, enabled: entry.enabled !== false } : null;
  } catch {
    return null;
  }
}

async function update(system, claudePath, marketplace) {
  const refreshed = await system.run(claudePath, ['plugin', 'marketplace', 'update', 'hub'], {
    timeoutMs: 60_000,
  });
  // A device whose marketplace entry went missing gets it back from the same folder.
  if (refreshed.status !== 0)
    await system.run(claudePath, ['plugin', 'marketplace', 'add', marketplace], { timeoutMs: 60_000 });
  const updated = await system.run(claudePath, ['plugin', 'update', 'hub@hub', '--scope', 'user', '--json'], {
    timeoutMs: 120_000,
  });
  if (updated.status !== 0) {
    throw new Refusal(
      'failed',
      `Claude Code could not update the plugin: ${updated.stderr.trim().slice(0, 300)}`,
    );
  }
}

async function syncOnce(args, { system }) {
  if (typeof args.version !== 'string' || !VERSION.test(args.version)) throw new Refusal('bad_arguments');
  checkFiles(args.files);
  const { best } = await resolveClaude(system);
  if (!best) throw new Refusal('failed', 'Claude Code was not found on this device.');
  const { marketplace } = hubPaths(system);
  writeMarketplace(marketplace, args.files);
  const before = await installedPlugin(system, best.path);
  if (before?.version === args.version) return { outcome: 'up_to_date', version: args.version };
  if (!before) {
    await installPlugin(system, best.path);
  } else {
    await update(system, best.path, marketplace);
  }
  const after = await installedPlugin(system, best.path);
  if (after?.version !== args.version) {
    throw new Refusal(
      'failed',
      `Claude Code still has the plugin at ${after?.version ?? 'no version'}, not ${args.version}.`,
    );
  }
  return { outcome: before ? 'updated' : 'installed', version: args.version };
}

/** One sync at a time on this device, in the order Hub asked. */
export function syncPlugin(args, context) {
  const run = queue.then(() => syncOnce(args, context));
  queue = run.catch(() => undefined);
  return run;
}
