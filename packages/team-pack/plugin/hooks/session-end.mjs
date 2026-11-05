/**
 * @file SessionEnd: collects Git facts, writes them to the outbox and hands off to a detached sender (docs/05 §3.5).
 * @description Claude Code gives SessionEnd hooks 1.5 seconds, and a plugin's own `timeout` does not raise that, so
 * this parent never touches the network. A report that cannot be sent stays in the outbox for the next session.
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fail,
  git,
  linkedProject,
  outboxDir,
  PACK_VERSION,
  readJson,
  readStdin,
  sessionFile,
  writeJson,
} from './lib.mjs';

const REASONS = ['clear', 'resume', 'logout', 'prompt_input_exit', 'other', 'sigterm'];
const SEPARATOR = '\u001f';
const MAX_COMMITS = 200;
const here = dirname(fileURLToPath(import.meta.url));

function commitsSince(cwd, startSha) {
  if (!startSha) return [];
  const log = git(cwd, ['log', `--format=%H${SEPARATOR}%s${SEPARATOR}%aI`, `${startSha}..HEAD`]);
  if (!log) return [];
  return log
    .split('\n')
    .slice(0, MAX_COMMITS)
    .map((line) => {
      const [sha, message, at] = line.split(SEPARATOR);
      return { sha, message: (message ?? '').slice(0, 500), at };
    });
}

function shortstat(cwd, startSha) {
  const text = startSha ? (git(cwd, ['diff', '--shortstat', `${startSha}..HEAD`]) ?? '') : '';
  const number = (pattern) => Number(pattern.exec(text)?.[1] ?? 0);
  return {
    filesChanged: number(/(\d+) files? changed/),
    additions: number(/(\d+) insertions?/),
    deletions: number(/(\d+) deletions?/),
  };
}

export function buildPayload(input, session) {
  const cwd = input.cwd ?? session.cwd ?? process.cwd();
  const dirty = git(cwd, ['status', '--porcelain']);
  const ended = new Date();
  const started = session.startedAt ? new Date(session.startedAt) : null;
  return {
    sessionId: input.session_id,
    reason: REASONS.includes(input.reason) ? input.reason : 'other',
    cwd,
    remote: session.remote ?? null,
    branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? session.branch ?? null,
    startSha: session.headSha ?? null,
    headSha: git(cwd, ['rev-parse', 'HEAD']),
    commits: commitsSince(cwd, session.headSha),
    ...shortstat(cwd, session.headSha),
    dirtyFiles: dirty ? dirty.split('\n').length : 0,
    startedAt: session.startedAt ?? null,
    endedAt: ended.toISOString(),
    durationSec: started ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : null,
    hasSummary: session.summaryLogged === true,
    client: { os: platform(), packVersion: PACK_VERSION },
  };
}

try {
  const input = await readStdin();
  const path = input.session_id ? sessionFile(input.session_id) : null;
  const session = path ? readJson(path) : null;
  if (session) {
    const cwd = input.cwd ?? session.cwd ?? process.cwd();
    const file = join(outboxDir(), `${input.session_id.replace(/[^\w.-]/g, '_')}.json`);
    writeJson(file, { project: linkedProject(cwd), payload: buildPayload(input, session) });
    rmSync(path, { force: true });
    spawn(process.execPath, [join(here, 'session-end-send.mjs'), file], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }
} catch (error) {
  fail(error);
}
