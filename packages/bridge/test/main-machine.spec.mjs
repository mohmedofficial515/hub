/**
 * @file `pnpm start:local`'s connect step, in isolation: it decides from the state, passes credentials on stdin only, and a failure never stops Hub. Nothing real runs.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { connectMainMachine } from '../../../scripts/connect-main-machine.mjs';
import { copyFromCheckout } from '../lib/connect.mjs';
import { hubPaths } from '../lib/paths.mjs';
import { CREDENTIAL, fakeSystem } from './helpers.mjs';

const root = resolve(import.meta.dirname, '..', '..', '..');

function recorder(state, { pairStatus = 0, connectStatus = 0 } = {}) {
  const calls = [];
  const run = async (args, options = {}) => {
    calls.push({ args, input: options.input, cwd: options.cwd, env: options.env });
    if (args.includes('state')) return { status: 0, stdout: JSON.stringify(state), stderr: '' };
    if (args.some((part) => String(part).includes('pair-main-machine'))) {
      return { status: pairStatus, stdout: JSON.stringify({ credential: CREDENTIAL }), stderr: '' };
    }
    return { status: connectStatus, stdout: '', stderr: '' };
  };
  return { calls, run };
}

async function go(state, options) {
  const lines = [];
  const system = fakeSystem();
  if (options?.installed) copyFromCheckout(system, resolve(root, 'packages'));
  if (options?.bridgePid) writeFileSync(hubPaths(system).pid, JSON.stringify({ pid: options.bridgePid }));
  const { calls, run } = recorder(state, options);
  const answer = await connectMainMachine({
    root,
    apiUrl: 'http://localhost:7310',
    env: { HUB_SECRET_KEY: 'from-dotenv', ...(options?.env ?? {}) },
    bridgeEnv: { PATH: 'plain' },
    say: (line) => lines.push(line),
    run,
    system,
  });
  return { answer, lines, calls, system };
}

describe('connectMainMachine', () => {
  it('first run: pairs with no browser, connects from the checkout, and passes credentials on stdin', async () => {
    const { answer, lines, calls } = await go({ paired: false, complete: false });
    expect(answer.status).toBe('changed');
    expect(lines.join('\n')).toContain('first run');
    const pair = calls.find((call) => call.args.some((part) => String(part).includes('pair-main-machine')));
    expect(pair).toBeDefined();
    const connect = calls.find((call) => call.args.includes('connect'));
    expect(connect.args).toContain('--credentials-stdin');
    expect(connect.args).toContain('--from-checkout');
    expect(connect.input).toContain(CREDENTIAL);
    expect(connect.args.join(' ')).not.toContain(CREDENTIAL);
    expect(lines.join('\n')).not.toContain(CREDENTIAL);
  });

  it('only the pairing script sees .env: the bridge, and all it will ever start, does not', async () => {
    const { calls } = await go({ paired: false, complete: false });
    const pair = calls.find((call) => call.args.some((part) => String(part).includes('pair-main-machine')));
    expect(pair.env.HUB_SECRET_KEY).toBe('from-dotenv');
    for (const call of calls.filter((item) => item !== pair)) {
      expect(call.env.HUB_SECRET_KEY).toBeUndefined();
    }
  });

  it('later runs: nothing changes and it says so, and it starts the bridge when that is down', async () => {
    const { answer, lines, calls, system } = await go({ paired: true, complete: true }, { installed: true });
    expect(answer.status).toBe('connected');
    expect(lines.join('\n')).toContain('nothing changed');
    expect(calls.map((call) => call.args).flat()).not.toContain('connect');
    expect(system.detached).toHaveLength(1);
  });

  it('a bridge that is alive but that Hub does not see is restarted, and it says so in one line', async () => {
    // A stand-in process, so the pid is alive. The fake system records the taskkill and kills nothing.
    const standIn = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    try {
      const { answer, lines, calls, system } = await go(
        { paired: true, online: false, complete: true },
        { installed: true, bridgePid: standIn.pid },
      );
      expect(answer.status).toBe('restarted');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('restarted');
      expect(lines[0]).not.toContain('nothing changed');
      expect(system.calls.find((call) => call.command === 'taskkill.exe')?.args).toContain(
        String(standIn.pid),
      );
      expect(system.detached).toHaveLength(1);
      expect(calls.filter((call) => call.args.includes('state'))).toHaveLength(1);
    } finally {
      standIn.kill();
    }
  });

  it('Hub does not see the bridge and none runs: it starts one and says so', async () => {
    const { answer, lines, system } = await go(
      { paired: true, online: false, complete: true },
      { installed: true },
    );
    expect(answer.status).toBe('restarted');
    expect(lines.join(' ')).toContain('was started');
    expect(system.calls.some((call) => call.command === 'taskkill.exe')).toBe(false);
    expect(system.detached).toHaveLength(1);
  });

  it('a bridge Hub sees is left alone', async () => {
    const standIn = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
    try {
      const { answer, lines, system } = await go(
        { paired: true, online: true, complete: true },
        { installed: true, bridgePid: standIn.pid },
      );
      expect(answer.status).toBe('connected');
      expect(lines.join(' ')).toContain('nothing changed');
      expect(system.calls.some((call) => call.command === 'taskkill.exe')).toBe(false);
      expect(system.detached).toHaveLength(0);
    } finally {
      standIn.kill();
    }
  });

  it('a pull changes the bridge: the next start updates it', async () => {
    const { answer, calls } = await go({ paired: true, complete: true });
    expect(answer.status).toBe('changed');
    expect(calls.find((call) => call.args.includes('connect'))).toBeDefined();
  });

  it('paired but incomplete: finishes the install with no second pairing', async () => {
    const { calls } = await go({ paired: true, complete: false });
    expect(calls.some((call) => call.args.some((part) => String(part).includes('pair-main-machine')))).toBe(
      false,
    );
    expect(calls.find((call) => call.args.includes('connect')).args).not.toContain('--credentials-stdin');
  });

  it('a pairing that fails is a warning, and connects nothing', async () => {
    const { answer, lines, calls } = await go({ paired: false, complete: false }, { pairStatus: 1 });
    expect(answer.status).toBe('failed');
    expect(lines.join('\n')).toContain('Settings › Devices');
    expect(calls.some((call) => call.args.includes('connect'))).toBe(false);
  });

  it('a connect that fails is a warning too', async () => {
    const { answer } = await go({ paired: true, complete: false }, { connectStatus: 1 });
    expect(answer.status).toBe('failed');
  });

  it('HUB_SKIP_CONNECT leaves this machine alone and says so', async () => {
    const { answer, lines, calls } = await go(
      { paired: false, complete: false },
      { env: { HUB_SKIP_CONNECT: '1' } },
    );
    expect(answer.status).toBe('skipped');
    expect(lines.join('\n')).toContain('HUB_SKIP_CONNECT');
    expect(calls).toEqual([]);
  });
});
