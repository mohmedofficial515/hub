/**
 * @file The steps that wire Claude Code to Hub on one device: the MCP server and the plugin. `connect`, the Fix button and `folder.link` all use these, so they cannot differ.
 * @description The server is `hub` at user scope with `headersHelper` (docs/16 S1 Q9): no env var, so no new terminal. The helper's command is the Windows form the spike proved, absolute
 * node and absolute script, each quoted, because a bash-style command gave no header and connected with no error. A linked folder gets `hub` at local scope, kept in the user's own config,
 * so nothing is written to the repository and each device holds its own paths. Its `X-Hub-Project` is what chooses the project, as `hub link`'s `.mcp.json` did.
 */
import { claudeConfigFile, hubPaths, readJson } from './paths.mjs';

export function helperCommand(system) {
  return `"${system.nodePath}" "${hubPaths(system).helperBin}"`;
}

export function userServerEntry(system, url) {
  return { type: 'http', url: `${url}/mcp`, headersHelper: helperCommand(system) };
}

export function folderServerEntry(system, url, project) {
  return { ...userServerEntry(system, url), headers: { 'X-Hub-Project': project } };
}

/** Field by field, because Claude Code stores them in its own order. */
const sameEntry = (a, b) =>
  Boolean(a && b) &&
  a.type === b.type &&
  a.url === b.url &&
  a.headersHelper === b.headersHelper &&
  a.headers?.['X-Hub-Project'] === b.headers?.['X-Hub-Project'];

/** Whether the user-scope `hub` entry is already the one this device needs. */
export function userServerIsRight(system, url) {
  return sameEntry(readJson(claudeConfigFile(system))?.mcpServers?.hub, userServerEntry(system, url));
}

/** Adds or replaces the user-scope server. An older `hub` from the token flow is replaced. */
export async function installMcpServer(system, claudePath, url) {
  if (userServerIsRight(system, url)) return { changed: false };
  await system.run(claudePath, ['mcp', 'remove', 'hub', '--scope', 'user']);
  const added = await system.run(claudePath, [
    'mcp',
    'add-json',
    'hub',
    JSON.stringify(userServerEntry(system, url)),
    '--scope',
    'user',
  ]);
  if (added.status !== 0) throw new Error(`Adding the MCP server failed: ${added.stderr.trim()}`);
  return { changed: true };
}

export async function pluginIsInstalled(system, claudePath) {
  const listed = await system.run(claudePath, ['plugin', 'list', '--json'], { timeoutMs: 30_000 });
  if (listed.status !== 0) return false;
  try {
    return JSON.parse(listed.stdout).some((plugin) => plugin.id === 'hub@hub' && plugin.enabled !== false);
  } catch {
    return false;
  }
}

export async function installPlugin(system, claudePath) {
  if (await pluginIsInstalled(system, claudePath)) return { changed: false };
  // An existing marketplace of this name answers an error, and installing from it is still right.
  await system.run(claudePath, ['plugin', 'marketplace', 'add', hubPaths(system).marketplace]);
  const installed = await system.run(claudePath, ['plugin', 'install', 'hub@hub', '--scope', 'user']);
  if (installed.status !== 0) throw new Error(`Installing the plugin failed: ${installed.stderr.trim()}`);
  return { changed: true };
}

/** One folder's `hub` at local scope, for each spelling of the folder that exists as a working directory. */
export async function installFolderServer(system, claudePath, url, project, keys) {
  const entry = folderServerEntry(system, url, project);
  const config = readJson(claudeConfigFile(system));
  for (const key of keys) {
    if (sameEntry(config?.projects?.[key]?.mcpServers?.hub, entry)) continue;
    const cwd = key;
    await system.run(claudePath, ['mcp', 'remove', 'hub', '--scope', 'local'], { cwd });
    const added = await system.run(
      claudePath,
      ['mcp', 'add-json', 'hub', JSON.stringify(entry), '--scope', 'local'],
      { cwd },
    );
    if (added.status !== 0) return { ok: false, error: added.stderr.trim() };
  }
  return { ok: true };
}

export function folderServerIsRight(system, url, project, keys) {
  const config = readJson(claudeConfigFile(system));
  const entry = folderServerEntry(system, url, project);
  return keys.every((key) => sameEntry(config?.projects?.[key]?.mcpServers?.hub, entry));
}
