/**
 * @file The outside world, as one object, so tests run with no Claude Code, no registry and no network (the team pack's pattern).
 * @description Nothing here uses a shell (S1 Q1: a shell cut an argument at `&` and ran what followed). A child gets this process's environment with `CLAUDE*`
 * and `ANTHROPIC*` removed, so a connect run from inside a Claude Code chat behaves as a login start does. `CLAUDE_CONFIG_DIR` stays, as it says which config this is.
 */
import { spawn } from 'node:child_process';
import { homedir, hostname, platform } from 'node:os';

const PIPE_GRACE_MS = 2_000;
const MAX_RUN_OUTPUT = 8_000_000;

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
        // Never wait on a pipe alone: a grandchild can hold it open long after the program has gone.
        const timer = setTimeout(() => {
          child.kill();
          finish(124);
        }, options.timeoutMs ?? 60_000);
        child.on('exit', (code) => {
          clearTimeout(timer);
          setTimeout(() => finish(code ?? 1), PIPE_GRACE_MS).unref();
        });
        const cap = options.maxOutput ?? MAX_RUN_OUTPUT;
        child.stdout.on('data', (chunk) => {
          if (stdout.length < cap) stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
          if (stderr.length < cap) stderr += chunk;
        });
        child.on('error', () => finish(127));
        child.on('close', (code) => finish(code ?? 1));
        child.stdin.end(options.input ?? '');
      });
    },
    /** A long-running program with its pipes open, for a chat. No shell. */
    spawnStream(command, args, options) {
      return spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },
    /** Ends a process and everything it started. `child.kill()` alone leaves children behind on Windows (S1 Q7). */
    killTree(pid) {
      if (platform() === 'win32') {
        return new Promise((done) => {
          const child = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
          child.on('exit', done);
          child.on('error', done);
        });
      }
      try {
        process.kill(pid);
      } catch {
        /* Already gone. */
      }
      return Promise.resolve();
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
