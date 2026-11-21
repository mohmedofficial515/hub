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
/** The web's own build folder for a local run in production mode, apart from `next dev`'s. */
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

/**
 * How Hub runs on this machine: `HUB_MODE=dev` in the root `.env` (or the environment) runs it from source, where a saved file shows at once;
 * anything else runs what is built. The environment wins, so `HUB_MODE=production pnpm start:local` runs the build once.
 */
export function hubModeOf(env) {
  return (process.env.HUB_MODE ?? env.HUB_MODE ?? 'production') === 'dev' ? 'dev' : 'production';
}

/** Dev mode's own web folder: apart from the build's (`WEB_DIST`) and from a plain `next dev`'s `.next`, so neither is disturbed. */
export const WEB_DEV_DIST = '.next-hub-dev';

/**
 * Dev mode's processes, each a plain `node <cli>`, so stopping the tree stops it: contracts rebuilt on save (`tsup --watch`, without clearing
 * `dist` first, so the API and the web never read an empty folder), the API restarted on save (`nest start --watch`, swc), and `next dev` with
 * hot reload. The lab is Vite, the same in both modes.
 */
export function devParts({ env, webPort, apiPort, labPort, host }) {
  return [
    {
      name: 'contracts',
      args: [join(root, 'packages/contracts/node_modules/tsup/dist/cli-default.js'), '--watch', '--no-clean'],
      cwd: join(root, 'packages/contracts'),
      env: { ...process.env },
    },
    {
      name: 'api',
      args: [join(apiDir, 'node_modules/@nestjs/cli/bin/nest.js'), 'start', '--watch'],
      cwd: apiDir,
      env: { ...process.env },
    },
    {
      name: 'web',
      args: [
        join(webDir, 'node_modules/next/dist/bin/next'),
        'dev',
        '-p',
        String(webPort),
        ...(host ? ['-H', host] : []),
      ],
      cwd: webDir,
      env: {
        ...process.env,
        ...env,
        NODE_ENV: 'development',
        NEXT_DIST_DIR: WEB_DEV_DIST,
        HUB_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
        HUB_LAB_ORIGIN: `http://127.0.0.1:${labPort}`,
      },
    },
  ];
}

/** What has to exist for Hub to run without building. In dev mode only the contracts do: the API and the web compile as they start. */
export function missingDevBuild() {
  return existsSync(join(root, 'packages/contracts/dist/index.js')) ? [] : ['contracts'];
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
