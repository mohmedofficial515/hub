/**
 * @file The closed list of what Hub can ask (docs/16 §4). Nothing here takes a command, and the folder rule runs before any handler.
 * @description To add an action: a line in `BRIDGE_ACTIONS` in `@hub/contracts` and `protocol.mjs`, and a handler here. `FOLDER_ACTIONS` lists those with a `folder` argument. `dispatch` answers `{ ok, data }`
 * or `{ ok: false, error }`, so a failure is an answer rather than a dropped socket. An error's message goes to Hub, so a handler must never put a secret in one.
 */
import { existsSync, statSync } from 'node:fs';

import { allowedEntry } from './allowlist.mjs';
import { resolveClaude } from './claude.mjs';
import { backupConfig, inspectConfig, writeTrust } from './claude-config.mjs';
import { docHandlers } from './doc-files.mjs';
import { runChecks, runFix } from './health.mjs';
import { folderServerIsRight, installFolderServer } from './install.mjs';
import { recordLink } from './links.mjs';
import { claudeConfigFile } from './paths.mjs';
import { syncPlugin } from './plugin-sync.mjs';
import { BRIDGE_ACTIONS, HEALTH_FIXES, Refusal } from './protocol.mjs';
import { schemaHandlers } from './schema-files.mjs';
import { turnHandlers } from './turns.mjs';
import { openInVsCode } from './vscode.mjs';

const FOLDER_ACTIONS = new Set(['folder.link', 'turn.start', 'chat.diff', 'schema.read', 'vscode.open']);

async function linkFolder(args, context) {
  const { system, url } = context;
  const { folder, project } = args;
  if (typeof project !== 'string') throw new Refusal('bad_arguments');
  if (!allowedEntry(folder, context.folders(), system.platform, project)) {
    throw new Refusal('folder_not_allowed');
  }
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Refusal('folder_missing');

  const file = claudeConfigFile(system);
  const look = inspectConfig(file, folder, system.platform);
  if (!look.ok) return { outcome: 'shape_unexpected', backup: null };
  if (look.trusted && folderServerIsRight(system, url, project, look.keys)) {
    return { outcome: 'already_linked', backup: null };
  }
  const { best } = await resolveClaude(system);
  if (!best) return { outcome: 'mcp_failed', backup: null };

  const backup = backupConfig(file);
  const server = await installFolderServer(system, best.path, url, project, look.keys);
  if (!server.ok) return { outcome: 'mcp_failed', backup };
  const trust = writeTrust(file, folder, system.platform);
  if (trust.outcome === 'shape_unexpected') return { outcome: 'shape_unexpected', backup };
  recordLink(system, folder, look.keys);
  return { outcome: 'linked', backup };
}

const handlers = {
  'health.check': (_args, context) => runChecks(context.system, context.url),
  'health.fix': async (args, context) => {
    if (!HEALTH_FIXES.includes(args.fix)) throw new Refusal('not_fixable');
    await runFix(context.system, context.url, args.fix);
    return runChecks(context.system, context.url);
  },
  'folder.link': linkFolder,
  ...turnHandlers,
  ...docHandlers,
  ...schemaHandlers,
  'vscode.open': openInVsCode,
  'plugin.sync': syncPlugin,
};

/**
 * A run's extra folders (docs/16 D59): each must be registered on the same project as the main folder, by the same rule, so `--add-dir` can never reach past the allowlist.
 */
function checkAddDirs(addDirs, project, context) {
  if (addDirs === undefined) return;
  if (!Array.isArray(addDirs) || addDirs.length > 8) throw new Refusal('bad_arguments');
  for (const dir of addDirs) {
    if (!allowedEntry(dir, context.folders(), context.system.platform, project)) {
      throw new Refusal('folder_not_allowed');
    }
  }
}

/** Runs one action frame. `emit` sends an `event` frame for this action. */
export async function dispatch(frame, context, emit) {
  try {
    if (!BRIDGE_ACTIONS.includes(frame.action) || !Object.hasOwn(handlers, frame.action)) {
      throw new Refusal('unknown_action');
    }
    const args = frame.args ?? {};
    if (typeof args !== 'object' || Array.isArray(args)) throw new Refusal('bad_arguments');
    if (FOLDER_ACTIONS.has(frame.action)) {
      const main = allowedEntry(args.folder, context.folders(), context.system.platform);
      if (!main) throw new Refusal('folder_not_allowed');
      if (frame.action === 'turn.start') checkAddDirs(args.addDirs, main.project, context);
    }
    return { ok: true, data: await handlers[frame.action](args, context, emit) };
  } catch (error) {
    const known = error instanceof Refusal;
    return {
      ok: false,
      error: {
        code: known ? error.code : 'failed',
        message: String(error?.message ?? 'failed').slice(0, 500),
      },
    };
  }
}
