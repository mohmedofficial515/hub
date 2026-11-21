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
  dirtyFingerprint,
  existsSync,
  fail,
  git,
  headersFor,
  hubDir,
  linkedProject,
  loadConfig,
  outboxDir,
  readStdin,
  sessionFile,
  writeJson,
} from './lib.mjs';

/**
 * How long the context may take. 2.5 s cut off a Hub that was up and only slow (3.8 s under load, 2026-11-16), and the session was told Hub could not
 * be reached. A Hub that is down still answers at once, as a refused connection, so the wait only grows when Hub is slow.
 * `HUB_CONTEXT_TIMEOUT_MS` is for tests.
 */
const TIMEOUT_MS = Number(process.env.HUB_CONTEXT_TIMEOUT_MS) || 6000;
const MAX_CONTEXT = 9500;
const here = dirname(fileURLToPath(import.meta.url));

/**
 * What to run to see why. A paired device has the bridge's own checks; `npx @hub/team-pack` is not published, so that hint failed on every device.
 * Settings › Devices in Hub shows the same checks.
 */
function checkHint() {
  const bridge = join(hubDir(), 'app', 'bridge', 'bin', 'hub-bridge.mjs');
  if (existsSync(bridge)) return `Run: node "${bridge}" health, or open Settings › Devices in Hub.`;
  return 'Run: npx @hub/team-pack doctor';
}

function remember(input, cwd) {
  const path = sessionFile(input.session_id);
  if (input.source !== 'startup' && input.source !== 'clear' && existsSync(path)) return;
  writeJson(path, {
    startedAt: new Date().toISOString(),
    cwd,
    branch: git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    headSha: git(cwd, ['rev-parse', 'HEAD']),
    remote: git(cwd, ['remote', 'get-url', 'origin']),
    dirtyAtStart: dirtyFingerprint(cwd),
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
      return `Hub at ${config.url} answered ${response.status}. ${checkHint()}`;
    }
    const { data } = await response.json();
    return data.text;
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      return `Hub at ${config.url} is up but did not send this session's context within ${Math.round(TIMEOUT_MS / 1000)} seconds. Its tools may still work: call hub.whats_new for what you need.`;
    }
    return `Hub at ${config.url} cannot be reached from this machine. Call hub.whats_new when it is back. ${checkHint()}`;
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
