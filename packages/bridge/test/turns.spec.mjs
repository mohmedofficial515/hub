/**
 * @file The turn manager against a recorded child process and the real approval pipe: flags, one live process, resume, approvals, stop and failures. No Claude Code runs here; `apps/api/test/e2e/chats-real-binary.e2e-spec.ts` does that.
 */
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { dispatch } from '../lib/actions.mjs';
import { turnManager } from '../lib/turns.mjs';
import { aFolder, fakeSystem } from './helpers.mjs';

const CHAT = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

function fakeChild() {
  const child = new EventEmitter();
  child.pid = 4000;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.written = [];
  child.ended = false;
  child.stdin = {
    write: (line) => child.written.push(JSON.parse(line)),
    end: () => {
      child.ended = true;
    },
    on: () => {},
  };
  child.say = (raw) => child.stdout.emit('data', `${JSON.stringify(raw)}\n`);
  return child;
}

const INIT = {
  type: 'system',
  subtype: 'init',
  session_id: SESSION,
  model: 'claude-haiku',
  claude_code_version: '2.1.318',
};
const RESULT = { type: 'result', subtype: 'success', is_error: false, session_id: SESSION, duration_ms: 12 };
const toolStart = (id, name = 'Bash') => ({
  type: 'stream_event',
  event: { type: 'content_block_start', content_block: { type: 'tool_use', id, name } },
});

const tick = () => new Promise((done) => setTimeout(done, 5));
async function until(check, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await tick();
  }
  throw new Error('Timed out waiting');
}

function aTurnWorld(env = {}) {
  const system = fakeSystem();
  Object.assign(system.env, env);
  const children = [];
  const spawned = [];
  system.spawnStream = (command, args, options) => {
    const child = fakeChild();
    children.push(child);
    spawned.push({ command, args, options });
    return child;
  };
  system.killed = [];
  system.killTree = async (pid) => {
    system.killed.push(pid);
    children.at(-1)?.emit('exit', 1);
  };
  const folder = aFolder(system);
  const context = { system, url: 'http://hub.test', folders: () => [{ path: folder, project: 'demo' }] };
  const events = [];
  const begin = (extra = {}) =>
    dispatch(
      {
        action: 'turn.start',
        args: { chatId: CHAT, folder, prompt: 'hello', mode: 'execute', ...extra },
      },
      context,
      (kind, data) => events.push(data),
    );
  const kinds = () => events.map((event) => event.kind);
  const of = (kind) => events.filter((event) => event.kind === kind);
  return { system, children, spawned, folder, context, events, begin, kinds, of };
}

const open = [];
afterEach(async () => {
  for (const context of open.splice(0)) await turnManager(context).shutdown();
});

function aWorld(env) {
  const world = aTurnWorld(env);
  open.push(world.context);
  return world;
}

/** Calls the pipe the way the shim does, using what the process was really given. */
function askAsShim(world, toolName, input, toolUseId, key) {
  const { args } = world.spawned.at(-1);
  const config = JSON.parse(readFileSync(args[args.indexOf('--mcp-config') + 1], 'utf8'));
  const { HUB_APPROVAL_PIPE, HUB_APPROVAL_KEY } = config.mcpServers.hubperm.env;
  return new Promise((resolve, reject) => {
    let raw = '';
    const socket = connect(HUB_APPROVAL_PIPE);
    socket.setEncoding('utf8');
    socket.on('connect', () =>
      socket.write(`${JSON.stringify({ key: key ?? HUB_APPROVAL_KEY, toolName, input, toolUseId })}\n`),
    );
    socket.on('data', (chunk) => (raw += chunk));
    socket.on('end', () => resolve(JSON.parse(raw)));
    socket.on('error', reject);
  });
}

async function started(world, extra) {
  const answer = world.begin(extra);
  await until(() => world.children.length > 0 && world.children.at(-1).written.length > 0);
  const child = world.children.at(-1);
  child.say(INIT);
  await until(() => world.of('turn.session').length > 0);
  return { answer, child };
}

const answerApproval = (world, approvalId, decision) =>
  dispatch({ action: 'turn.answer', args: { chatId: CHAT, approvalId, decision } }, world.context, () => {});

describe('starting a turn', () => {
  it('spawns the binary itself, with the prompt on stdin and the recommended flags', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { model: 'haiku' });
    const { command, args, options } = world.spawned[0];
    expect(command).toBe(world.system.claudePath);
    expect(options.shell).toBeUndefined();
    expect(options.cwd).toBe(world.folder);
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--include-partial-messages',
        '--input-format',
        'stream-json',
        '--permission-prompt-tool',
        'mcp__hubperm__approve',
        '--model',
        'haiku',
      ]),
    );
    expect(args).not.toContain('--bare');
    expect(args).not.toContain('--strict-mcp-config');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args.join(' ')).not.toContain('hello');
    expect(child.written[0]).toEqual({ type: 'user', message: { role: 'user', content: 'hello' } });
    child.say(RESULT);
    expect(await answer).toMatchObject({ ok: true, data: { status: 'done' } });
  });

  it('gives each mode its permission mode and its rules', async () => {
    for (const [mode, permissionMode, rule] of [
      ['ask', 'default', 'deny'],
      ['plan', 'plan', 'deny'],
      ['execute', 'acceptEdits', 'ask'],
    ]) {
      const world = aWorld();
      const { answer, child } = await started(world, { mode });
      const { args } = world.spawned[0];
      expect(args[args.indexOf('--permission-mode') + 1]).toBe(permissionMode);
      const settings = JSON.parse(readFileSync(args[args.indexOf('--settings') + 1], 'utf8'));
      expect(settings.permissions[rule].length).toBeGreaterThan(0);
      child.say(RESULT);
      await answer;
    }
  });

  it('cleans the environment, and sets the engine limit above the approval window', async () => {
    const world = aWorld({
      ANTHROPIC_API_KEY: 'from-a-shell',
      CLAUDE_CODE_SOMETHING: 'x',
      HUB_BRIDGE_APPROVAL_TIMEOUT_MS: '60000',
    });
    const { answer, child } = await started(world);
    const { env } = world.spawned[0].options;
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_SOMETHING).toBeUndefined();
    expect(Number(env.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT)).toBeGreaterThan(60_000);
    child.say(RESULT);
    await answer;
  });

  it('passes only the two named variables through the §13 switch', async () => {
    const world = aWorld({
      HUB_BRIDGE_CLAUDE_ENV: JSON.stringify({ ANTHROPIC_BASE_URL: 'http://m', PATH: 'bad', OTHER: 'bad' }),
    });
    const { answer, child } = await started(world);
    const { env } = world.spawned[0].options;
    expect(env.ANTHROPIC_BASE_URL).toBe('http://m');
    expect(env.OTHER).toBeUndefined();
    expect(env.PATH).toBe('');
    child.say(RESULT);
    await answer;
  });

  it('refuses bad arguments and a missing folder with no process', async () => {
    const world = aWorld();
    expect(await world.begin({ prompt: '' })).toMatchObject({ error: { code: 'bad_arguments' } });
    expect(await world.begin({ mode: 'yolo' })).toMatchObject({ error: { code: 'bad_arguments' } });
    expect(await world.begin({ model: '--dangerously-skip-permissions' })).toMatchObject({
      error: { code: 'bad_arguments' },
    });
    expect(await world.begin({ sessionId: '--x' })).toMatchObject({ error: { code: 'bad_arguments' } });
    expect(world.spawned).toEqual([]);
  });

  it('allows one turn per chat', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    expect(await world.begin()).toMatchObject({ error: { code: 'turn_running' } });
    child.say(RESULT);
    await answer;
  });

  it('applies effort only when the installed version has the flag', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { effort: 'high' });
    expect(world.spawned[0].args).toEqual(expect.arrayContaining(['--effort', 'high']));
    expect(world.of('turn.session')[0].effortApplied).toBe('high');
    child.say(RESULT);
    await answer;
    const older = aWorld();
    older.system.noEffortFlag = true;
    const again = await started(older, { effort: 'high' });
    expect(older.spawned[0].args).not.toContain('--effort');
    again.child.say(RESULT);
    await again.answer;
  });
});

describe('the version range and the missing binary', () => {
  it('a version outside the range is a clear failure, and nothing runs', async () => {
    const world = aWorld();
    world.system.claudeVersion = '2.1.400';
    const answer = await world.begin();
    expect(answer).toMatchObject({ ok: true, data: { status: 'failed' } });
    const [ended] = world.of('turn.ended');
    expect(ended.failure).toBe('version_out_of_range');
    expect(ended.message).toContain('2.1.400');
    expect(ended.message).toContain('Open in VS Code');
    expect(world.spawned).toEqual([]);
  });

  it('the owner can knowingly try a newer one', async () => {
    const world = aWorld({ HUB_CLAUDE_MAX_VERSION: '2.1.400' });
    world.system.claudeVersion = '2.1.400';
    const { answer, child } = await started(world);
    child.say(RESULT);
    await answer;
    expect(world.spawned).toHaveLength(1);
  });

  it('no binary says so', async () => {
    const world = aWorld();
    const { rmSync } = await import('node:fs');
    rmSync(world.system.claudePath);
    await world.begin();
    expect(world.of('turn.ended')[0].failure).toBe('claude_missing');
  });

  it('engine.status reports sign-in from `claude auth status`, and the range', async () => {
    const world = aWorld();
    const answer = await dispatch({ action: 'engine.status', args: {} }, world.context, () => {});
    expect(answer.data).toMatchObject({
      found: true,
      version: '2.1.318',
      inRange: true,
      signedIn: true,
      effortSupported: true,
      testedRange: { min: '2.1.318' },
    });
    expect(JSON.stringify(world.system.calls)).not.toContain('.credentials');
  });
});

describe('one live process, and --resume as the fallback', () => {
  it('a second turn goes to the same process', async () => {
    const world = aWorld();
    const first = await started(world);
    first.child.say(RESULT);
    await first.answer;
    const second = world.begin();
    await until(() => first.child.written.length === 2);
    first.child.say(INIT);
    first.child.say(RESULT);
    await second;
    expect(world.spawned).toHaveLength(1);
    expect(world.of('turn.session')).toHaveLength(2);
  });

  it('a change of mode resumes in a new process', async () => {
    const world = aWorld();
    const first = await started(world);
    first.child.say(RESULT);
    await first.answer;
    const second = world.begin({ mode: 'ask', sessionId: SESSION });
    await until(() => world.children.length === 2 && world.children[1].written.length > 0);
    expect(first.child.ended).toBe(true);
    expect(world.spawned[1].args).toEqual(expect.arrayContaining(['--resume', SESSION]));
    world.children[1].say(INIT);
    world.children[1].say(RESULT);
    await second;
    expect(world.of('turn.session')[1].resumed).toBe(true);
  });

  it('after the idle window stdin closes, and the next message resumes', async () => {
    const world = aWorld({ HUB_BRIDGE_IDLE_MS: '20' });
    const first = await started(world);
    first.child.say(RESULT);
    await first.answer;
    await until(() => first.child.ended);
    first.child.emit('exit', 0);
    const second = world.begin({ sessionId: SESSION });
    await until(() => world.children.length === 2 && world.children[1].written.length > 0);
    expect(world.spawned[1].args).toEqual(expect.arrayContaining(['--resume', SESSION]));
    world.children[1].say(INIT);
    world.children[1].say(RESULT);
    await second;
  });
});

describe('approvals', () => {
  it('a paused call reaches Hub with its exact command, and Allow passes the input through', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    const asked = askAsShim(world, 'Bash', { command: 'git push origin main' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    const [request] = world.of('approval.requested');
    expect(request).toMatchObject({
      toolUseId: 't1',
      toolName: 'Bash',
      command: 'git push origin main',
      category: 'push',
    });
    await answerApproval(world, request.approvalId, 'allow');
    expect(await asked).toEqual({
      behavior: 'allow',
      updatedInput: { command: 'git push origin main' },
    });
    expect(world.of('approval.resolved')[0].status).toBe('allowed');
    child.say(RESULT);
    await answer;
  });

  it('Deny denies, and the first answer wins', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    const asked = askAsShim(world, 'Bash', { command: 'rm x' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    const { approvalId } = world.of('approval.requested')[0];
    const firstAnswer = await answerApproval(world, approvalId, 'deny');
    const secondAnswer = await answerApproval(world, approvalId, 'allow');
    expect(firstAnswer.data.accepted).toBe(true);
    expect(secondAnswer.data.accepted).toBe(false);
    expect((await asked).behavior).toBe('deny');
    expect(world.of('approval.resolved')).toHaveLength(1);
    child.say(RESULT);
    await answer;
  });

  it('a timeout denies, and never allows', async () => {
    const world = aWorld({ HUB_BRIDGE_APPROVAL_TIMEOUT_MS: '40' });
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    const decided = await askAsShim(world, 'Bash', { command: 'rm x' }, 't1');
    expect(decided.behavior).toBe('deny');
    expect(world.of('approval.resolved')[0].status).toBe('timed_out');
    child.say(RESULT);
    await answer;
  });

  it('refuses a call that matches no tool use, and a wrong key, with no prompt', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    const wrongKey = await askAsShim(world, 'Bash', { command: 'x' }, 't1', 'not-the-key');
    expect(wrongKey.behavior).toBe('deny');
    const wrongName = await askAsShim(world, 'Write', { file_path: 'x' }, 't1');
    expect(wrongName.behavior).toBe('deny');
    expect(world.of('approval.requested')).toEqual([]);
    child.say(RESULT);
    await answer;
  }, 10_000);

  it('Ask and Plan refuse by themselves, and the owner is not asked', async () => {
    for (const mode of ['ask', 'plan']) {
      const world = aWorld();
      const { answer, child } = await started(world, { mode });
      child.say(toolStart('t1'));
      const decided = await askAsShim(world, 'Bash', { command: 'rm x' }, 't1');
      expect(decided.behavior).toBe('deny');
      expect(decided.message).toContain('read only');
      expect(world.of('approval.requested')).toEqual([]);
      child.say(RESULT);
      await answer;
    }
  });

  it('Plan records the proposed plan when it ends', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'plan' });
    child.say(toolStart('t1', 'ExitPlanMode'));
    const decided = await askAsShim(world, 'ExitPlanMode', { plan: '1. Do it' }, 't1');
    expect(decided.behavior).toBe('deny');
    expect(world.of('plan.proposed')[0].plan).toBe('1. Do it');
    child.say(RESULT);
    await answer;
  });
});

describe('stop', () => {
  it('sends the interrupt, denies a waiting approval, and lets the process go', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    const asked = askAsShim(world, 'Bash', { command: 'rm x' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    const stopped = await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    expect(stopped.data.stopped).toBe(true);
    expect((await asked).behavior).toBe('deny');
    expect(world.of('approval.resolved')[0].status).toBe('stopped');
    expect(child.written.at(-1)).toMatchObject({
      type: 'control_request',
      request: { subtype: 'interrupt' },
    });
    child.say({ type: 'result', subtype: 'error_during_execution', is_error: true, session_id: SESSION });
    expect(await answer).toMatchObject({ data: { status: 'stopped' } });
    expect(child.ended).toBe(true);
    expect(world.system.killed).toEqual([]);
    child.emit('exit', 1);
  });

  it('with no answer it ends the whole tree, and still reports stopped', async () => {
    const world = aWorld({ HUB_BRIDGE_STOP_GRACE_MS: '20' });
    const { answer } = await started(world);
    await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    expect(await answer).toMatchObject({ data: { status: 'stopped' } });
    expect(world.system.killed).toEqual([4000]);
  });

  it('a stopped chat resumes in a new process', async () => {
    const world = aWorld();
    const first = await started(world);
    await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    first.child.say({ type: 'result', is_error: true, session_id: SESSION });
    await first.answer;
    first.child.emit('exit', 1);
    const second = world.begin({ sessionId: SESSION });
    await until(() => world.children.length === 2 && world.children[1].written.length > 0);
    world.children[1].say(INIT);
    world.children[1].say(RESULT);
    await second;
    expect(world.spawned[1].args).toEqual(expect.arrayContaining(['--resume', SESSION]));
  });

  it('nothing to stop says so', async () => {
    const world = aWorld();
    const answer = await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    expect(answer.data.stopped).toBe(false);
  });
});

describe('how a turn ends', () => {
  it('signed out: `success` with is_error, read from the error field', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say({
      type: 'assistant',
      error: 'authentication_failed',
      message: { id: 'm1', content: [{ type: 'text', text: 'Not logged in · Please run /login' }] },
    });
    child.say({
      type: 'result',
      subtype: 'success',
      is_error: true,
      result: 'Not logged in · Please run /login',
    });
    expect(await answer).toMatchObject({ data: { status: 'failed' } });
    expect(world.of('turn.ended')[0]).toMatchObject({ failure: 'signed_out' });
    expect(world.of('text.delta')[0].text).toContain('Not logged in');
  });

  it('a usage limit carries when it resets', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say({
      type: 'rate_limit_event',
      rate_limit_info: { status: 'rejected', resetsAt: 1900000000, rateLimitType: 'five_hour' },
    });
    child.say({ type: 'result', is_error: true, result: 'limit' });
    await answer;
    expect(world.of('limit')[0].limit.status).toBe('rejected');
    expect(world.of('turn.ended')[0]).toMatchObject({ failure: 'rate_limited', resetsAt: 1900000000 });
  });

  it('a lost session is named, so the chat can start over', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { sessionId: SESSION });
    child.say({
      type: 'result',
      subtype: 'error_during_execution',
      is_error: true,
      errors: [`No conversation found with session ID: ${SESSION}`],
    });
    await answer;
    expect(world.of('turn.ended')[0].failure).toBe('session_missing');
  });

  it('exit with no result is cut off, with what it said', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.stderr.emit('data', 'it broke');
    child.emit('exit', 1);
    await answer;
    expect(world.of('turn.ended')[0]).toMatchObject({ failure: 'cut_off', message: 'it broke' });
  });

  it('reports only what the engine reported', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say({ type: 'result', is_error: false });
    await answer;
    const [ended] = world.of('turn.ended');
    expect(ended.status).toBe('done');
    expect(ended.usage).toBeUndefined();
    expect(ended.apiDurationMs).toBeUndefined();
    expect(typeof ended.durationMs).toBe('number');
  });

  it('names the files Write and Edit steps touched', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say({
      type: 'assistant',
      message: {
        id: 'm',
        content: [{ type: 'tool_use', id: 't', name: 'Write', input: { file_path: `${world.folder}/a.md` } }],
      },
    });
    child.say(RESULT);
    await answer;
    expect(world.of('turn.ended')[0].changedFiles).toEqual([{ path: 'a.md', source: 'tool' }]);
  });
});
