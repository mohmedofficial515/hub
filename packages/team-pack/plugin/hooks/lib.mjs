/**
 * @file What the hooks share. No dependencies, because a hook runs from the plugin folder with plain `node`.
 * @description A hook must never break a session: anything that goes wrong is one line on stderr and exit 0.
 * The token comes from `~/.hub/config.json` (written by `init`, user scope), else the `HUB_MCP_BEARER` env var. The
 * project comes from the folder's `.mcp.json`, the same place Claude Code reads it, so hooks and tools agree.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const TOKEN_ENV = 'HUB_MCP_BEARER';
export const PACK_VERSION = '0.1.0';
const GIT_TIMEOUT_MS = 500;

export function hubDir() {
  return join(homedir(), '.hub');
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
}

export function loadConfig() {
  const stored = readJson(join(hubDir(), 'config.json')) ?? {};
  return {
    url: stored.url ?? process.env.HUB_URL ?? 'http://localhost:7310',
    token: stored.token ?? process.env[TOKEN_ENV] ?? null,
  };
}

/** `X-Hub-Project` from the nearest `.mcp.json` at or above this folder. */
export function linkedProject(cwd) {
  let folder = cwd;
  for (;;) {
    const config = readJson(join(folder, '.mcp.json'));
    const slug = config?.mcpServers?.hub?.headers?.['X-Hub-Project'];
    if (typeof slug === 'string' && slug !== '') return slug;
    const parent = dirname(folder);
    if (parent === folder) return null;
    folder = parent;
  }
}

export function git(cwd, args, timeout = GIT_TIMEOUT_MS) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function headersFor(config, project) {
  return {
    authorization: `Bearer ${config.token}`,
    'content-type': 'application/json',
    ...(project ? { 'x-hub-project': project } : {}),
  };
}

export function sessionFile(sessionId) {
  return join(hubDir(), 'sessions', `${sessionId.replace(/[^\w.-]/g, '_')}.json`);
}

export function outboxDir() {
  return join(hubDir(), 'outbox');
}

export function fail(error) {
  process.stderr.write(`hub hook: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 0;
}

export { existsSync };
