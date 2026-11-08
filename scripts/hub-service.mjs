/**
 * @file `pnpm hub:service install|uninstall|status|start|stop|build` (docs/16 "Slice 6 as built", D63): Hub as the HubServer logon task.
 * @description `install` writes the task (no admin rights) and does not start it; `start` runs it now. `build` is the one step that builds,
 * because the task never does: run it after pulling changes, then `stop` and `start`. `status` says whether the task exists, whether its
 * runner is alive, and where the logs are. `stop` ends the running copy; it starts again at the next logon unless uninstalled.
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import {
  hubServerTaskState,
  installHubServer,
  runHubServerTask,
  uninstallHubServer,
} from '../packages/bridge/lib/hub-server-task.mjs';
import { realSystem } from '../packages/bridge/lib/system.mjs';
import {
  isWindows,
  logDir,
  missingBuild,
  readEnvFile,
  root,
  runningHubServer,
  stopTree,
  WEB_DIST,
  webDir,
} from './lib/hub-local.mjs';

const say = (text) => process.stdout.write(`${text}\n`);
const system = realSystem();
const script = join(root, 'scripts', 'hub-server.mjs');

function build() {
  const env = readEnvFile(join(root, '.env'));
  const apiPort = Number(env.PORT || 7310);
  const labPort = Number(env.LAB_PORT || 7320);
  const steps = [
    ['contracts', 'pnpm', ['--filter', '@hub/contracts', 'build'], root, process.env],
    ['API', 'pnpm', ['--filter', '@hub/api', 'build'], root, process.env],
    [
      'web (a minute or two)',
      'pnpm',
      ['exec', 'next', 'build'],
      webDir,
      {
        ...process.env,
        ...env,
        NODE_ENV: 'production',
        NEXT_DIST_DIR: WEB_DIST,
        HUB_API_ORIGIN: `http://localhost:${apiPort}`,
        HUB_LAB_ORIGIN: `http://127.0.0.1:${labPort}`,
      },
    ],
  ];
  for (const [label, command, args, cwd, stepEnv] of steps) {
    say(`  ${label}`);
    const result = spawnSync(command, args, { cwd, env: stepEnv, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) {
      say(`Building the ${label} failed.`);
      return 1;
    }
  }
  say(
    'Built. A running HubServer keeps the old build until `pnpm hub:service stop` and `pnpm hub:service start`.',
  );
  return 0;
}

async function status() {
  const task = await hubServerTaskState(system);
  const running = runningHubServer();
  say(`Task HubServer: ${task.registered ? `installed (${task.status ?? 'unknown'})` : 'not installed'}`);
  say(`Runner: ${running ? `running (process ${running.pid}, since ${running.startedAt})` : 'not running'}`);
  const missing = missingBuild();
  say(
    `Build: ${missing.length === 0 ? 'present' : `missing ${missing.join(', ')} (pnpm hub:service build)`}`,
  );
  say(`Logs: ${logDir} (hub-server.log, api.log, web.log, lab.log)`);
  return 0;
}

function stop() {
  const running = runningHubServer();
  if (!running) {
    say('HubServer is not running.');
    return 0;
  }
  stopTree(running.pid);
  for (const pid of running.children ?? []) stopTree(pid);
  say(
    'HubServer stopped. It starts again at your next logon; `pnpm hub:service uninstall` removes the task.',
  );
  return 0;
}

async function main(command) {
  if (command === 'build') return build();
  if (command === 'status') return status();
  if (command === 'stop') return stop();
  if (command === 'install') {
    const missing = missingBuild();
    if (missing.length > 0)
      say(
        `Note: the ${missing.join(', ')} build is missing. Run \`pnpm hub:service build\` before it starts.`,
      );
    const answer = await installHubServer(system, { node: process.execPath, script, root });
    say(
      answer.ok
        ? `Installed: ${answer.how}. Hub starts at your next logon, or now with \`pnpm hub:service start\`.`
        : `Not installed: ${answer.how}`,
    );
    if (answer.ok) say('While HubServer runs, `pnpm start:local` does not start a second copy.');
    return answer.ok ? 0 : 1;
  }
  if (command === 'uninstall') {
    stop();
    const answer = await uninstallHubServer(system);
    say(answer.ok ? 'The HubServer task is removed.' : 'There was no HubServer task to remove.');
    return 0;
  }
  if (command === 'start') {
    if (runningHubServer()) {
      say('HubServer is already running.');
      return 0;
    }
    const task = await hubServerTaskState(system);
    if (!task.registered) {
      say(
        'The HubServer task is not installed: `pnpm hub:service install` first, or `pnpm start:local` for a run in this terminal.',
      );
      return 1;
    }
    const answer = await runHubServerTask(system);
    say(answer.ok ? `Started. Logs: ${join(logDir, 'hub-server.log')}` : `Not started: ${answer.how}`);
    return answer.ok ? 0 : 1;
  }
  say('Usage: pnpm hub:service install | uninstall | status | start | stop | build');
  say(`The task runs ${script}, which never builds.`);
  return command ? 1 : 0;
}

process.exitCode = await main(process.argv[2]);
