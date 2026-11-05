/**
 * @file SessionStart: remembers where the session began, and injects what this member should know (docs/05 §3.5).
 * @description The injected text names the active project. It also retries any session report the last exit could not
 * send. If Hub cannot be reached it says so, and the session goes on.
 */
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  existsSync,
  fail,
  git,
  headersFor,
  linkedProject,
  loadConfig,
  outboxDir,
  readStdin,
  sessionFile,
  writeJson,
} from './lib.mjs';

const TIMEOUT_MS = 2500;
const MAX_CONTEXT = 9500;
const here = dirname(fileURLToPath(import.meta.url));

function remember(input, cwd) {
  const path = sessionFile(input.session_id);
  if (input.source !== 'startup' && input.source !== 'clear' && existsSync(path)) return;
  writeJson(path, {
    startedAt: new Date().toISOString(),
    cwd,
    branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    headSha: git(cwd, ['rev-parse', 'HEAD']),
    remote: git(cwd, ['remote', 'get-url', 'origin']),
  });
}

function retryOutbox() {
  const dir = outboxDir();
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    spawn(process.execPath, [join(here, 'session-end-send.mjs'), join(dir, name)], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  }
}

async function fetchContext(cwd) {
  const config = loadConfig();
  if (!config.token) return `Hub is not set up on this machine. Run: npx @hub/team-pack init`;
  try {
    const response = await fetch(`${config.url}/api/v1/me/context?cwd=${encodeURIComponent(cwd)}`, {
      headers: headersFor(config, linkedProject(cwd)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return `Hub at ${config.url} answered ${response.status}. Run: npx @hub/team-pack doctor`;
    }
    const { data } = await response.json();
    return data.text;
  } catch {
    return `Hub at ${config.url} cannot be reached from this machine. Call hub.whats_new when it is back. Run: npx @hub/team-pack doctor`;
  }
}

try {
  const input = await readStdin();
  const cwd = input.cwd ?? process.cwd();
  if (input.session_id) remember(input, cwd);
  retryOutbox();
  const context = await fetchContext(cwd);
  const additionalContext = `${context}\nHub session id: ${input.session_id ?? 'unknown'} (pass it as sessionId to hub.log_session)`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext.slice(0, MAX_CONTEXT),
      },
    }),
  );
} catch (error) {
  fail(error);
}
