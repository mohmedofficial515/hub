/**
 * @file `pnpm start:local`'s connect step (docs/16 §5, D42): the main machine connects itself on first run, and every line says what changed.
 * @description On later runs it costs one request and one process check. It pairs through `apps/api/scripts/pair-main-machine.ts`, with no browser step, because whoever runs this already holds the database. Those
 * credentials pass from one child's stdout to the other's stdin and are never printed, logged or put in an argument. A failure here is a warning: Hub itself is running, and Settings › Devices has the one command.
 * `HUB_SKIP_CONNECT=1` leaves this machine's Claude Code alone. Everything from outside arrives as arguments, so tests run it in isolation.
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function runNode(args, { cwd, input, env, showOutput = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', showOutput ? 'inherit' : 'pipe', showOutput ? 'inherit' : 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += chunk));
    child.stderr?.on('data', (chunk) => (stderr += chunk));
    child.on('error', () => resolve({ status: 127, stdout, stderr }));
    child.on('close', (code) => resolve({ status: code ?? 1, stdout, stderr }));
    child.stdin.end(input ?? '');
  });
}

export async function connectMainMachine({ root, apiUrl, env = process.env, say, run = runNode, system }) {
  if (env.HUB_SKIP_CONNECT === '1') {
    say('Claude Code: skipped, because HUB_SKIP_CONNECT is set.');
    return { status: 'skipped' };
  }
  const packages = join(root, 'packages');
  const bridge = join(packages, 'bridge', 'bin', 'hub-bridge.mjs');
  const { appMatchesCheckout, ensureBridgeRunning } = await import(
    pathToFileURL(join(packages, 'bridge', 'lib', 'connect.mjs')).href
  );
  const { realSystem } = await import(pathToFileURL(join(packages, 'bridge', 'lib', 'system.mjs')).href);
  const machine = system ?? realSystem();

  const stateAnswer = await run([bridge, 'state', '--url', apiUrl], { env });
  if (stateAnswer.status !== 0) {
    say(`Claude Code: could not check this machine (${stateAnswer.stderr.trim()}).`);
    return { status: 'failed' };
  }
  const state = JSON.parse(stateAnswer.stdout);
  if (state.complete && appMatchesCheckout(machine, packages)) {
    const started = ensureBridgeRunning(machine);
    say(`Claude Code: already connected, nothing changed.${started ? ' Started the bridge.' : ''}`);
    return { status: 'connected' };
  }

  say(
    state.paired
      ? 'Claude Code: updating this machine’s connection.'
      : 'Claude Code: connecting this machine, first run.',
  );
  let credentials = null;
  if (!state.paired) {
    const paired = await run(['-r', './scripts/swc-register.cjs', 'scripts/pair-main-machine.ts'], {
      cwd: join(root, 'apps', 'api'),
      env,
    });
    if (paired.status !== 0) {
      say('Claude Code: could not pair this machine. Settings › Devices has the command to do it by hand.');
      return { status: 'failed' };
    }
    credentials = paired.stdout.trim();
  }
  const connected = await run(
    [
      bridge,
      'connect',
      '--url',
      apiUrl,
      '--from-checkout',
      packages,
      ...(credentials ? ['--credentials-stdin'] : []),
    ],
    { env, showOutput: true, ...(credentials ? { input: credentials } : {}) },
  );
  if (connected.status !== 0) {
    say('Claude Code: connecting did not finish. Settings › Devices shows what is missing.');
    return { status: 'failed' };
  }
  return { status: 'changed' };
}
