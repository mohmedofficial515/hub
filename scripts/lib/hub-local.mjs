/**
 * @file What `start:local`, `stop:local`, the HubServer runner and `hub:service` share: the paths, the root `.env`, a port check, stopping a
 * process tree, where Hub listens, and whether HubServer is running. Plain Node, no shell syntax, Windows first.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const apiDir = join(root, 'apps/api');
export const webDir = join(root, 'apps/web');
export const labDir = join(root, 'apps/lab');
export const isWindows = process.platform === 'win32';
/** The web's own build folder for a local run, apart from `next dev`'s. */
export const WEB_DIST = process.env.NEXT_DIST_DIR ?? '.next-local';
export const logDir = process.env.HUB_LOG_DIR ?? join(root, '.tmp/logs');
/** Written by `scripts/hub-server.mjs` while it runs: its pid and its children's. */
export const hubServerFile = process.env.HUB_SERVER_FILE ?? join(root, '.tmp/hub-server.json');

export function readEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1]) values[match[1]] = (match[2] ?? '').replace(/^"(.*)"$/, '$1');
  }
  return values;
}

export function isPortBusy(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

export function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function stopTree(pid) {
  if (isWindows) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid);
    } catch {
      /* Already gone. */
    }
  }
}

/** Same rule as the API's `bindHostOf`: `HUB_BIND_HOST`, else 127.0.0.1 once published at an https address, else every interface. */
export function bindHostOf(env) {
  if (env.HUB_BIND_HOST) return env.HUB_BIND_HOST;
  return String(env.HUB_PUBLIC_URL ?? '').startsWith('https://') ? '127.0.0.1' : undefined;
}

/** HubServer's state file, when its runner is alive. */
export function runningHubServer() {
  if (!existsSync(hubServerFile)) return null;
  try {
    const state = JSON.parse(readFileSync(hubServerFile, 'utf8'));
    return isAlive(state.pid) ? state : null;
  } catch {
    return null;
  }
}

/** What has to exist for Hub to run without building. */
export function missingBuild() {
  return [
    ['contracts', join(root, 'packages/contracts/dist/index.js')],
    ['API', join(apiDir, 'dist/main.js')],
    ['web', join(webDir, WEB_DIST, 'BUILD_ID')],
  ]
    .filter(([, file]) => !existsSync(file))
    .map(([name]) => name);
}
