/**
 * @file What the hooks share. No dependencies, because a hook runs from the plugin folder with plain `node`.
 * @description A hook must never break a session: anything that goes wrong is one line on stderr and exit 0.
 * The token comes from `~/.hub/config.json` (written by `init`, user scope), else the `HUB_MCP_BEARER` env var. The
 * project comes from the folder's `.mcp.json`, the same place Claude Code reads it, so hooks and tools agree.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const TOKEN_ENV = 'HUB_MCP_BEARER';
export const PACK_VERSION = '0.2.0';
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

const MAX_FINGERPRINT = 500;
const TRANSCRIPT_CHUNK = 256 * 1024;
const TOPIC_LENGTH = 200;
const OUTCOME_LENGTH = 600;

function oneLine(text, length) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

/**
 * Every uncommitted file now, as `path -> status:mtime:size`. A repo that is dirty before the session starts is the
 * normal case, so "files left uncommitted" has to mean files this session touched, not the ones already there.
 * Returns null when Git cannot tell (not a repo, or too slow).
 */
export function dirtyFingerprint(cwd) {
  let out;
  try {
    out = execFileSync('git', ['status', '--porcelain', '-z'], {
      cwd,
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS * 2,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const parts = out.split('\0').filter(Boolean);
  const entries = {};
  let count = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const status = part.slice(0, 2);
    // A rename or copy is followed by its old path, which has no status of its own.
    if (status.includes('R') || status.includes('C')) index += 1;
    if (count >= MAX_FINGERPRINT) return { entries, truncated: true };
    const path = part.slice(3);
    let stamp = 'gone';
    try {
      const stat = statSync(join(cwd, path));
      stamp = `${stat.mtimeMs}:${stat.size}`;
    } catch {
      // Deleted files keep the stamp `gone`.
    }
    entries[path] = `${status}:${stamp}`;
    count += 1;
  }
  return { entries, truncated: false };
}

/** How many uncommitted files are new or changed since `start`. Without a start fingerprint, all of them count. */
export function dirtySince(start, now) {
  if (!now) return 0;
  const paths = Object.keys(now.entries);
  if (!start) return paths.length;
  return paths.filter((path) => {
    if (path in start.entries) return start.entries[path] !== now.entries[path];
    // A start list cut at the cap cannot say the file was clean, so an unknown file is not counted.
    return !start.truncated;
  }).length;
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
}

function readChunk(path, from, length) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytes = readSync(fd, buffer, 0, length, from);
    return buffer.toString('utf8', 0, bytes);
  } finally {
    closeSync(fd);
  }
}

function entriesOf(chunk, dropFirst) {
  const lines = chunk.split('\n');
  if (dropFirst) lines.shift();
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // A line cut by the chunk edge, or not JSON.
    }
  }
  return entries;
}

/**
 * What the session was about, read from Claude Code's own transcript file: the first prompt the member typed, and the
 * last thing Claude said. No model call and no network. Hub still refuses secrets in it. Null when nothing is readable.
 */
export function digestTranscript(path) {
  if (typeof path !== 'string' || path === '') return null;
  try {
    const size = statSync(path).size;
    const head = entriesOf(readChunk(path, 0, Math.min(size, TRANSCRIPT_CHUNK)), false);
    const tailStart = Math.max(0, size - TRANSCRIPT_CHUNK);
    const tail = entriesOf(readChunk(path, tailStart, size - tailStart), tailStart > 0);

    const prompt = head.find((entry) => {
      if (entry?.type !== 'user' || entry.isMeta) return false;
      const text = textOf(entry.message?.content).trim();
      // Slash-command wrappers and injected reminders start with a tag; they are not what the member asked.
      return text !== '' && !text.startsWith('<');
    });
    const reply = [...tail].reverse().find((entry) => {
      return entry?.type === 'assistant' && textOf(entry.message?.content).trim() !== '';
    });
    const topic = prompt ? oneLine(textOf(prompt.message.content), TOPIC_LENGTH) : null;
    const outcome = reply ? oneLine(textOf(reply.message.content), OUTCOME_LENGTH) : null;
    return topic || outcome ? { topic, outcome } : null;
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
