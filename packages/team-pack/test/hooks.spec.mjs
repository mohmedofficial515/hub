/**
 * @file The hooks with fixture stdin against a local mock Hub, in a temp home. Each runs as the real script does.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugin', 'hooks');
const TOKEN = 'hub_abcd1234_secret';

let server;
let url;
let requests = [];
let status = 202;

beforeAll(async () => {
  server = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => {
      requests.push({ url: request.url, headers: request.headers, body: body ? JSON.parse(body) : null });
      response.statusCode = request.method === 'GET' ? 200 : status;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ data: { project: 'goteav', text: '# Hub — Active project: Goteav' } }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

function homeWith(config) {
  const home = mkdtempSync(join(tmpdir(), 'hub-hook-'));
  if (config) {
    mkdirSync(join(home, '.hub'), { recursive: true });
    writeFileSync(join(home, '.hub', 'config.json'), JSON.stringify(config));
  }
  return home;
}

/** A real run of the script. Async, so the mock Hub in this process can answer it. */
function runHook(name, input, home, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(HOOKS, name)], {
      env: { ...process.env, HOME: home, USERPROFILE: home, HUB_MCP_BEARER: '', ...extraEnv },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ status: code, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

async function until(check) {
  for (let i = 0; i < 100; i += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('condition not met in time');
}

function gitRepo() {
  const cwd = mkdtempSync(join(tmpdir(), 'hub-repo-'));
  const git = (...args) =>
    spawnSync('git', ['-c', 'user.email=a@b.c', '-c', 'user.name=a', ...args], { cwd, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(cwd, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-qm', 'first');
  return { cwd, git };
}

beforeEach(() => {
  requests = [];
  status = 202;
});

describe('session-start', () => {
  it('injects the context with the session id, sending the folder and its project', async () => {
    const home = homeWith({ url, token: TOKEN });
    const cwd = mkdtempSync(join(tmpdir(), 'hub-linked-'));
    writeFileSync(
      join(cwd, '.mcp.json'),
      JSON.stringify({ mcpServers: { hub: { headers: { 'X-Hub-Project': 'goteav' } } } }),
    );
    const { status: exit, stdout } = await runHook(
      'session-start.mjs',
      { session_id: 'session-1', cwd, source: 'startup' },
      home,
    );
    expect(exit).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('Active project: Goteav');
    expect(output.hookSpecificOutput.additionalContext).toContain('Hub session id: session-1');
    expect(requests[0].headers['x-hub-project']).toBe('goteav');
    expect(requests[0].headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(existsSync(join(home, '.hub', 'sessions', 'session-1.json'))).toBe(true);
  });

  it('says so when Hub cannot be reached, and exits 0', async () => {
    const home = homeWith({ url: 'http://127.0.0.1:9', token: TOKEN });
    const { status: exit, stdout } = await runHook(
      'session-start.mjs',
      { session_id: 'session-2', cwd: tmpdir(), source: 'startup' },
      home,
    );
    expect(exit).toBe(0);
    const text = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    expect(text).toContain('cannot be reached');
    expect(text).toContain('Hub session id: session-2');
  });

  it('tells a slow Hub from one that is down, so the session is not told Hub is unreachable', async () => {
    const slow = createServer(() => {
      /* Never answers, as a Hub busy for longer than the wait. */
    });
    await new Promise((resolve) => slow.listen(0, resolve));
    try {
      const home = homeWith({ url: `http://127.0.0.1:${slow.address().port}`, token: TOKEN });
      const { status: exit, stdout } = await runHook(
        'session-start.mjs',
        { session_id: 'session-slow', cwd: tmpdir(), source: 'startup' },
        home,
        { HUB_CONTEXT_TIMEOUT_MS: '300' },
      );
      expect(exit).toBe(0);
      const text = JSON.parse(stdout).hookSpecificOutput.additionalContext;
      expect(text).toContain('is up but did not send');
      expect(text).not.toContain('cannot be reached');
      expect(text).toContain('Hub session id: session-slow');
    } finally {
      slow.closeAllConnections();
      await new Promise((resolve) => slow.close(resolve));
    }
  });

  it("points a paired device at the bridge's own checks, not at a package that is not published", async () => {
    const home = homeWith({ url: 'http://127.0.0.1:9', token: TOKEN });
    const bin = join(home, '.hub', 'app', 'bridge', 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'hub-bridge.mjs'), '');
    const { stdout } = await runHook(
      'session-start.mjs',
      { session_id: 'session-device', cwd: tmpdir(), source: 'startup' },
      home,
    );
    const text = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    expect(text).toContain('cannot be reached');
    expect(text).toContain(`"${join(bin, 'hub-bridge.mjs')}" health`);
    expect(text).not.toContain('npx @hub/team-pack doctor');
  });

  it('says how to set up when there is no token', async () => {
    const { stdout } = await runHook(
      'session-start.mjs',
      { session_id: 'session-3', cwd: tmpdir(), source: 'startup' },
      homeWith(null),
    );
    expect(JSON.parse(stdout).hookSpecificOutput.additionalContext).toContain('team-pack init');
  });

  it('does not reset the start of a resumed session', async () => {
    const home = homeWith({ url, token: TOKEN });
    const { cwd, git } = gitRepo();
    await runHook('session-start.mjs', { session_id: 'resumed', cwd, source: 'startup' }, home);
    const first = git('rev-parse', 'HEAD').stdout.trim();
    writeFileSync(join(cwd, 'b.txt'), 'two\n');
    git('add', '.');
    git('commit', '-qm', 'second');
    await runHook('session-start.mjs', { session_id: 'resumed', cwd, source: 'resume' }, home);
    await runHook('session-end.mjs', { session_id: 'resumed', cwd, reason: 'other' }, home);
    await until(() => requests.some((request) => request.url === '/api/v1/capture/session'));
    const report = requests.find((request) => request.url === '/api/v1/capture/session').body;
    expect(report.startSha).toBe(first);
    expect(report.commits.map((commit) => commit.message)).toEqual(['second']);
  });
});

describe('session-end', () => {
  it('reports the Git facts in the shape the API takes, quickly, and clears the outbox', async () => {
    const home = homeWith({ url, token: TOKEN });
    const { cwd, git } = gitRepo();
    await runHook('session-start.mjs', { session_id: 'facts-1', cwd, source: 'startup' }, home);
    writeFileSync(join(cwd, 'b.txt'), 'two\nthree\n');
    git('add', '.');
    git('commit', '-qm', 'add b');
    writeFileSync(join(cwd, 'dirty.txt'), 'x');

    const started = performance.now();
    const { status: exit } = await runHook(
      'session-end.mjs',
      { session_id: 'facts-1', cwd, reason: 'logout' },
      home,
    );
    expect(exit).toBe(0);
    expect(performance.now() - started).toBeLessThan(1500);

    await until(() => requests.some((request) => request.url === '/api/v1/capture/session'));
    const { body } = requests.find((request) => request.url === '/api/v1/capture/session');
    expect(body).toMatchObject({
      sessionId: 'facts-1',
      reason: 'logout',
      filesChanged: 1,
      additions: 2,
      dirtyFiles: 1,
      hasSummary: false,
    });
    expect(body.commits[0].message).toBe('add b');
    await until(() => readdirSync(join(home, '.hub', 'outbox')).length === 0);
  });

  it('does not count files that were already uncommitted when the session began', async () => {
    const home = homeWith({ url, token: TOKEN });
    const { cwd } = gitRepo();
    writeFileSync(join(cwd, 'old-dirty.txt'), 'before');
    await runHook('session-start.mjs', { session_id: 'baseline-1', cwd, source: 'startup' }, home);
    await runHook('session-end.mjs', { session_id: 'baseline-1', cwd, reason: 'other' }, home);
    await until(() => requests.some((request) => request.body?.sessionId === 'baseline-1'));
    expect(requests.find((request) => request.body?.sessionId === 'baseline-1').body.dirtyFiles).toBe(0);
  });

  it('counts a file that was already uncommitted and was edited during the session', async () => {
    const home = homeWith({ url, token: TOKEN });
    const { cwd } = gitRepo();
    writeFileSync(join(cwd, 'old-dirty.txt'), 'before');
    await runHook('session-start.mjs', { session_id: 'baseline-2', cwd, source: 'startup' }, home);
    writeFileSync(join(cwd, 'old-dirty.txt'), 'before and a longer edit');
    await runHook('session-end.mjs', { session_id: 'baseline-2', cwd, reason: 'other' }, home);
    await until(() => requests.some((request) => request.body?.sessionId === 'baseline-2'));
    expect(requests.find((request) => request.body?.sessionId === 'baseline-2').body.dirtyFiles).toBe(1);
  });

  it('sends what the member asked and the last reply, read from the transcript', async () => {
    const home = homeWith({ url, token: TOKEN });
    const cwd = tmpdir();
    const transcript = join(home, 'transcript.jsonl');
    const line = (entry) => `${JSON.stringify(entry)}\n`;
    writeFileSync(
      transcript,
      line({
        type: 'user',
        message: { role: 'user', content: '<command-message>hub:start</command-message>' },
      }) +
        line({ type: 'user', message: { role: 'user', content: 'Why do sessions have no summary?' } }) +
        line({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'First answer' }] },
        }) +
        line({
          type: 'assistant',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Because none was logged.' }] },
        }),
    );
    await runHook('session-start.mjs', { session_id: 'digest-1', cwd, source: 'startup' }, home);
    await runHook(
      'session-end.mjs',
      { session_id: 'digest-1', cwd, reason: 'other', transcript_path: transcript },
      home,
    );
    await until(() => requests.some((request) => request.body?.sessionId === 'digest-1'));
    expect(requests.find((request) => request.body?.sessionId === 'digest-1').body).toMatchObject({
      topic: 'Why do sessions have no summary?',
      outcome: 'Because none was logged.',
    });
  });

  it('says a summary was written once log_session ran', async () => {
    const home = homeWith({ url, token: TOKEN });
    const cwd = tmpdir();
    await runHook('session-start.mjs', { session_id: 'marked-1', cwd, source: 'startup' }, home);
    await runHook('mark-summary.mjs', { session_id: 'marked-1' }, home);
    await runHook('session-end.mjs', { session_id: 'marked-1', cwd, reason: 'other' }, home);
    await until(() => requests.some((request) => request.url === '/api/v1/capture/session'));
    expect(requests.find((request) => request.url === '/api/v1/capture/session').body.hasSummary).toBe(true);
  });

  it('keeps the report in the outbox when Hub is down', async () => {
    const home = homeWith({ url: 'http://127.0.0.1:9', token: TOKEN });
    const cwd = tmpdir();
    await runHook('session-start.mjs', { session_id: 'down-1', cwd, source: 'startup' }, home);
    const { status: exit } = await runHook('session-end.mjs', { session_id: 'down-1', cwd }, home);
    expect(exit).toBe(0);
    expect(readdirSync(join(home, '.hub', 'outbox'))).toEqual(['down-1.json']);
  });

  it('does nothing for a session it never saw', async () => {
    const home = homeWith({ url, token: TOKEN });
    const { status: exit } = await runHook('session-end.mjs', { session_id: 'unknown', cwd: tmpdir() }, home);
    expect(exit).toBe(0);
    expect(existsSync(join(home, '.hub', 'outbox'))).toBe(false);
  });

  it('survives bad stdin', async () => {
    const child = spawnSync(process.execPath, [join(HOOKS, 'session-end.mjs')], {
      input: 'not json',
      encoding: 'utf8',
    });
    expect(child.status).toBe(0);
    expect(child.stderr).toContain('hub hook');
  });
});
