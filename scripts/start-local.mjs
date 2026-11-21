/**
 * @file `pnpm start:local`: Hub on this machine, from one command (docs/15 §1, §9).
 * @description Brings up Postgres, Redis and Mailpit, applies migrations, makes sure the owner and the two projects exist, builds what changed,
 * then runs the API with its workers on 7310, the web on 7300 and the lab on 7320 until Ctrl+C. Safe to run again. Written for Windows first: no shell
 * syntax, and stopping takes the whole process tree. Logs go to `.tmp/logs`. `pnpm stop:local` stops a run whose terminal is gone. The lab is a helper:
 * Hub stays up without it, and the Redesign page says so (docs/16 §6). The `HUB_*` variables below let a test run beside a real Hub.
 * When HubServer, the logon task (`pnpm hub:service`), is already running Hub, this starts no second copy. Published over Tailscale (an https
 * HUB_PUBLIC_URL), the web listens on 127.0.0.1 only, as the API does (docs/16 §10).
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { connect } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { connectMainMachine } from './connect-main-machine.mjs';
import { checkVersions, describe } from './lab-check.mjs';
import { bindHostOf, devParts, hubModeOf, runningHubServer } from './lib/hub-local.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps/api');
const webDir = join(root, 'apps/web');
const labDir = join(root, 'apps/lab');
const logDir = process.env.HUB_LOG_DIR ?? join(root, '.tmp/logs');
const pidFile = process.env.HUB_PID_FILE ?? join(root, '.tmp/local-pids.json');
const envFile = process.env.HUB_ENV_FILE ?? join(root, '.env');
const WEB_DIST = process.env.NEXT_DIST_DIR ?? '.next-local';
const WEB_PORT = Number(process.env.HUB_WEB_PORT ?? 7300);
const isWindows = process.platform === 'win32';

const say = (text) => process.stdout.write(`${text}\n`);

function fail(text) {
  process.stderr.write(`\n${text}\n`);
  process.exit(1);
}

function run(label, command, args, options = {}) {
  say(`  ${label}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', shell: isWindows, ...options });
  if (result.status !== 0) {
    fail(`${label} failed.\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout ?? '';
}

function readEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (match?.[1]) values[match[1]] = (match[2] ?? '').replace(/^"(.*)"$/, '$1');
  }
  return values;
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/** The newest change under these folders, skipping what tools generate. */
function newestChange(paths) {
  let newest = 0;
  const walk = (path) => {
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat) return;
    if (stat.isFile()) {
      newest = Math.max(newest, stat.mtimeMs);
      return;
    }
    for (const name of readdirSync(path)) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.next')) continue;
      walk(join(path, name));
    }
  };
  paths.forEach(walk);
  return newest;
}

const builtAt = (file) => statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? 0;

function stopTree(pid) {
  if (isWindows) spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid);
    } catch {
      /* Already gone. */
    }
  }
}

function start(name, args, cwd, env) {
  const logFile = join(logDir, `${name}.log`);
  const log = openSync(logFile, 'w');
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', log, log] });
  closeSync(log);
  return { name, child, logFile };
}

async function waitFor(url, name, running, seconds = 120) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (running.child.exitCode !== null) break;
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* Not up yet. */
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  const tail = existsSync(running.logFile)
    ? readFileSync(running.logFile, 'utf8').split('\n').slice(-20).join('\n')
    : '';
  throw new Error(`${name} did not come up at ${url}. Last lines of ${running.logFile}:\n${tail}`);
}

async function main() {
  const server = process.env.HUB_PID_FILE ? null : runningHubServer();
  if (server) {
    say(
      `Hub is already running as HubServer, the logon task (process ${server.pid}). Open http://localhost:${WEB_PORT}`,
    );
    say('`pnpm hub:service stop` stops it, and `pnpm hub:service status` says more.');
    return;
  }
  say('Starting Hub.');
  mkdirSync(logDir, { recursive: true });

  if (!existsSync(envFile))
    run('First run: writing .env', process.execPath, ['scripts/first-run.mjs'], {
      shell: false,
      stdio: 'inherit',
    });
  const env = readEnvFile(envFile);
  if (!env.HUB_OWNER_EMAIL) {
    fail('Set HUB_OWNER_EMAIL in .env first: it is the address you sign in with. Then run this again.');
  }
  const apiPort = Number(env.PORT || 7310);
  for (const [name, port] of [
    ['Web', WEB_PORT],
    ['API', apiPort],
  ]) {
    if (await isPortBusy(port)) {
      fail(`${name} port ${port} is in use. Is Hub already running? If it is, \`pnpm stop:local\` stops it.`);
    }
  }

  const labPort = Number(env.LAB_PORT || 7320);
  const labBusy = await isPortBusy(labPort);
  if (labBusy) say(`Lab port ${labPort} is in use, so the lab that answers there is the one Hub shows.`);

  say('Services:');
  run('docker compose up', 'docker', ['compose', '-f', 'infra/compose.dev.yaml', 'up', '-d', '--wait'], {
    shell: false,
  });

  say('Database:');
  const prisma = join(apiDir, 'node_modules/prisma/build/index.js');
  run('migrations', process.execPath, [prisma, 'migrate', 'deploy'], { cwd: apiDir, shell: false });
  say(
    `    ${run('owner and projects', process.execPath, ['-r', './scripts/swc-register.cjs', 'scripts/seed-owner.ts'], { cwd: apiDir, shell: false }).trim()}`,
  );

  const mode = hubModeOf(env);
  say(mode === 'dev' ? 'Build: (dev mode: from source, live reload)' : 'Build:');
  const contractsSrc = join(root, 'packages/contracts/src');
  const contractsChanged =
    newestChange([contractsSrc]) > builtAt(join(root, 'packages/contracts/dist/index.js'));
  if (contractsChanged) run('contracts', 'pnpm', ['--filter', '@hub/contracts', 'build']);
  if (mode === 'dev') return runDev({ env, apiPort, labPort, labBusy });
  const apiChanged =
    contractsChanged || newestChange([join(apiDir, 'src')]) > builtAt(join(apiDir, 'dist/main.js'));
  if (apiChanged) run('API', 'pnpm', ['--filter', '@hub/api', 'build']);
  const webEnv = {
    ...process.env,
    ...env,
    NODE_ENV: 'production',
    NEXT_DIST_DIR: WEB_DIST,
    HUB_API_ORIGIN: `http://127.0.0.1:${apiPort}`,
    HUB_LAB_ORIGIN: `http://127.0.0.1:${labPort}`,
  };
  const webBuilt = builtAt(join(webDir, WEB_DIST, 'BUILD_ID'));
  const webChanged =
    contractsChanged ||
    newestChange([join(webDir, 'src'), join(webDir, 'messages'), join(webDir, 'next.config.ts')]) > webBuilt;
  if (webChanged)
    run('web (a minute or two the first time)', 'pnpm', ['exec', 'next', 'build'], {
      cwd: webDir,
      env: webEnv,
    });
  if (!apiChanged && !webChanged) say('  nothing changed');

  say('Running:');
  const api = start('api', ['dist/main'], apiDir, { ...process.env });
  const host = bindHostOf(env);
  const web = start(
    'web',
    [
      join(webDir, 'node_modules/next/dist/bin/next'),
      'start',
      '-p',
      String(WEB_PORT),
      ...(host ? ['-H', host] : []),
    ],
    webDir,
    webEnv,
  );
  const lab = labBusy ? null : startLab(labPort, env);
  await supervise({ api, web, extra: [], lab, env, apiPort, labPort, readySeconds: 120, dev: false });
}

/**
 * Dev mode (`HUB_MODE=dev`): the API, the web and the contracts from source, each watching its files, so a saved change shows without a build
 * or a restart. The first page takes longer, because `next dev` compiles it on the first visit.
 */
async function runDev({ env, apiPort, labPort, labBusy }) {
  say('Running (dev mode):');
  const parts = devParts({ env, webPort: WEB_PORT, apiPort, labPort, host: bindHostOf(env) });
  const byName = Object.fromEntries(
    parts.map((part) => [part.name, start(part.name, part.args, part.cwd, part.env)]),
  );
  const lab = labBusy ? null : startLab(labPort, env);
  await supervise({
    api: byName.api,
    web: byName.web,
    extra: [byName.contracts],
    lab,
    env,
    apiPort,
    labPort,
    readySeconds: 300,
    dev: true,
  });
}

/** Runs until Ctrl+C. The API and the web are Hub, and either stopping stops it; the lab and the contracts watcher are helpers, and are only reported. */
async function supervise({ api, web, extra, lab, env, apiPort, labPort, readySeconds, dev }) {
  const helpers = [...extra, ...(lab ? [lab] : [])];
  const running = [api, web, ...helpers];
  writeFileSync(pidFile, JSON.stringify(running.map((item) => item.child.pid)));

  let stopping = false;
  const stopAll = (code) => {
    if (stopping) return;
    stopping = true;
    for (const item of running) if (item.child.exitCode === null) stopTree(item.child.pid);
    rmSync(pidFile, { force: true });
    process.exit(code);
  };
  process.on('SIGINT', () => stopAll(0));
  process.on('SIGTERM', () => stopAll(0));
  process.on('SIGBREAK', () => stopAll(0));
  for (const item of running) {
    item.child.once('exit', (code) => {
      if (stopping) return;
      if (item === lab) {
        say(
          `\nThe lab stopped (exit ${code}). Hub keeps running, and Redesign says so. Its log: ${item.logFile}`,
        );
        return;
      }
      if (helpers.includes(item)) {
        say(`\n${item.name} stopped watching (exit ${code}). Hub keeps running. Its log: ${item.logFile}`);
        return;
      }
      process.stderr.write(`\n${item.name} stopped (exit ${code}). Its log: ${item.logFile}\n`);
      stopAll(1);
    });
  }

  try {
    await waitFor(`http://localhost:${apiPort}/api/v1/health/ready`, 'The API', api, readySeconds);
    await waitFor(`http://localhost:${WEB_PORT}/ar/sign-in`, 'The web', web, readySeconds);
  } catch (error) {
    process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
    stopAll(1);
  }

  say('');
  // Hub is up, so a problem connecting Claude Code is a warning and never stops it (docs/16 §5).
  if (!process.env.HUB_SKIP_CONNECT)
    await connectMainMachine({
      root,
      apiUrl: `http://localhost:${apiPort}`,
      env: { ...process.env, ...env },
      say,
    }).catch((error) =>
      say(
        `Claude Code: connecting did not finish: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  say('');
  say(
    `Hub is running${dev ? ' in dev mode: saved changes show at once' : ''}.   Open http://localhost:${WEB_PORT}`,
  );
  say(`Sign in with HUB_OWNER_EMAIL and HUB_OWNER_PASSWORD from .env.`);
  say(`Logs: ${logDir}. Ctrl+C stops it.`);
  if (lab) void reportLab(labPort);
}

/** Its packages are the only thing a fresh checkout may lack. Without them Hub still starts. */
function startLab(port, env) {
  const vite = join(labDir, 'node_modules/vite/bin/vite.js');
  if (!existsSync(vite)) {
    spawnSync('pnpm', ['install', '--filter', '@hub/lab', '--ignore-scripts'], {
      cwd: root,
      shell: isWindows,
      stdio: 'ignore',
    });
  }
  if (!existsSync(vite)) {
    say('The lab has no packages, and installing them failed. Hub starts without it: run `pnpm install`.');
    return null;
  }
  return start('lab', [vite], labDir, {
    ...process.env,
    LAB_PORT: String(port),
    ...(env.LAB_WEB_SRC ? { LAB_WEB_SRC: env.LAB_WEB_SRC } : {}),
    ...(env.LAB_DASH_SRC ? { LAB_DASH_SRC: env.LAB_DASH_SRC } : {}),
  });
}

/** After Hub is up, and only telling: a broken version fails in its own frame, and this names it. */
async function reportLab(port) {
  const origin = `http://127.0.0.1:${port}`;
  try {
    for (let tries = 0; tries < 60 && !(await isPortBusy(port)); tries += 1) {
      await new Promise((done) => setTimeout(done, 500));
    }
    say(describe(await checkVersions({ origin, labDir }), join(logDir, 'lab-check.log')));
  } catch (error) {
    say(`Lab: not checked: ${error instanceof Error ? error.message : String(error)}`);
  }
}

void main();
