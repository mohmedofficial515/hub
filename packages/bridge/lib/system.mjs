/**
 * @file The outside world, as one object, so tests run with no Claude Code, no registry and no network (the team pack's pattern).
 * @description Nothing here uses a shell (S1 Q1: a shell cut an argument at `&` and ran what followed). A child gets this process's environment with `CLAUDE*`
 * and `ANTHROPIC*` removed, so a connect run from inside a Claude Code chat behaves as a login start does. `CLAUDE_CONFIG_DIR` stays, as it says which config this is.
 */
import { spawn } from 'node:child_process';
import { homedir, hostname, platform } from 'node:os';

export function childEnv(env) {
  const clean = {};
  for (const [key, value] of Object.entries(env)) {
    if (key === 'CLAUDE_CONFIG_DIR' || !/^(CLAUDE|ANTHROPIC)/i.test(key)) clean[key] = value;
  }
  return clean;
}

export function realSystem() {
  return {
    platform: platform(),
    home: homedir(),
    hostname: hostname(),
    env: process.env,
    nodePath: process.execPath,
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket,
    out: (line) => process.stdout.write(`${line}\n`),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    /** Runs a program with no shell. Never throws: a missing program is status 127. */
    run(command, args, options = {}) {
      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = (status) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ status, stdout, stderr });
        };
        const child = spawn(command, args, {
          cwd: options.cwd,
          env: childEnv(process.env),
          shell: false,
          windowsHide: true,
          windowsVerbatimArguments: options.verbatim === true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 60_000);
        child.stdout.on('data', (chunk) => (stdout += chunk));
        child.stderr.on('data', (chunk) => (stderr += chunk));
        child.on('error', () => finish(127));
        child.on('close', (code) => finish(code ?? 1));
        child.stdin.end(options.input ?? '');
      });
    },
    /** Starts a program that outlives this one. */
    spawnDetached(command, args) {
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: false,
        windowsHide: true,
        env: childEnv(process.env),
      });
      child.unref();
      return child.pid;
    },
  };
}
