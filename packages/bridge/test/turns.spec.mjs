/**
 * @file The turn manager against a recorded child process and the real approval pipe: flags, one live process, resume, approvals, stop and failures. No Claude Code runs here; `apps/api/test/e2e/chats-real-binary.e2e-spec.ts` does that.
 */
import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';

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

/** `inCopy`: the turn works in Hub's own copy of the registered folder (docs/16 §9.2), `wt-GTV-7/project` beside it, with the `.git` file a worktree has. */
function aTurnWorld(env = {}, { inCopy = false } = {}) {
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
  const registered = aFolder(system);
  const folder = inCopy ? join(system.home, 'wt-GTV-7', 'project') : registered;
  if (inCopy) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, '.git'), 'gitdir: elsewhere');
  }
  const context = { system, url: 'http://hub.test', folders: () => [{ path: registered, project: 'demo' }] };
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

function aWorld(env, options) {
  const world = aTurnWorld(env, options);
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

/** A turn that needs a new process, so the old child's history does not satisfy the wait. */
async function restarted(world, extra) {
  const before = world.children.length;
  const answer = world.begin(extra);
  await until(() => world.children.length > before && world.children.at(-1).written.length > 0);
  const child = world.children.at(-1);
  child.say(INIT);
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
      if (mode !== 'execute') expect(settings.hooks.PreToolUse[0].matcher).toBe('mcp__.*');
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
  it('below the minimum is a clear failure, and nothing runs (D53)', async () => {
    const world = aWorld();
    world.system.claudeVersion = '2.1.300';
    const answer = await world.begin();
    expect(answer).toMatchObject({ ok: true, data: { status: 'failed' } });
    const [ended] = world.of('turn.ended');
    expect(ended.failure).toBe('version_out_of_range');
    expect(ended.message).toContain('2.1.300');
    expect(ended.message).toContain('Open in VS Code');
    expect(world.spawned).toEqual([]);
  });

  it('above the tested one runs, with a visible warning, and the rules stay on (D53)', async () => {
    const world = aWorld();
    world.system.claudeVersion = '2.1.400';
    const { answer, child } = await started(world);
    child.say(RESULT);
    await answer;
    expect(world.spawned).toHaveLength(1);
    const { args } = world.spawned[0];
    expect(args).toContain('--permission-prompt-tool');
    expect(args).toContain('--settings');
    expect(world.of('engine.warning')).toEqual([
      { kind: 'engine.warning', code: 'newer_than_tested', version: '2.1.400', testedMax: '2.1.318' },
    ]);
    const status = await dispatch({ action: 'engine.status', args: {} }, world.context, () => {});
    expect(status.data).toMatchObject({
      canRun: true,
      inRange: false,
      version: '2.1.400',
      warning: { code: 'newer_than_tested', version: '2.1.400', testedMax: '2.1.318' },
    });
    expect(status.data.message).toContain('newer than');
  });

  it('declaring a newer version tested takes the warning away', async () => {
    const world = aWorld({ HUB_CLAUDE_MAX_VERSION: '2.1.400' });
    world.system.claudeVersion = '2.1.400';
    const { answer, child } = await started(world);
    child.say(RESULT);
    await answer;
    expect(world.of('engine.warning')).toEqual([]);
  });

  it('a fresh engine status asks the device again, past the cache (the re-check action)', async () => {
    const world = aWorld();
    const ask = (args) => dispatch({ action: 'engine.status', args }, world.context, () => {});
    expect((await ask({})).data.version).toBe('2.1.318');
    world.system.claudeVersion = '2.1.400';
    expect((await ask({})).data.version).toBe('2.1.318');
    expect((await ask({ fresh: true })).data.version).toBe('2.1.400');
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

describe('an unreadable event (D53)', () => {
  it('a line that is not JSON stops the turn, says so, and the process goes', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.stdout.emit('data', 'this is not an event\n');
    const done = await answer;
    expect(done.data.status).toBe('failed');
    const [ended] = world.of('turn.ended');
    expect(ended).toMatchObject({ status: 'failed', failure: 'unreadable_event' });
    expect(ended.message).toContain('Open in VS Code');
    expect(world.system.killed).toEqual([child.pid]);
    expect(turnManager(world.context).liveChats()).toEqual([]);
  });

  it('a known event without what it must hold stops the turn, and a pending approval is denied', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(world, 'Bash', { command: 'rm x' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    child.say({ type: 'assistant', message: {} });
    await answer;
    expect(world.of('turn.ended')[0].failure).toBe('unreadable_event');
    expect((await asked).behavior).toBe('deny');
  });

  it('an event type the mapper does not know is ignored, since new ones appear with no harm', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say({ type: 'brand_new_thing', anything: 1 });
    child.say(RESULT);
    await answer;
    expect(world.of('turn.ended')[0].status).toBe('done');
  });
});

describe('the approval effect line', () => {
  it('is fixed by the category, whatever the model said', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(
      world,
      'Bash',
      { command: 'git push origin main', description: 'Totally safe' },
      't1',
    );
    await until(() => world.of('approval.requested').length === 1);
    const [request] = world.of('approval.requested');
    expect(request).toMatchObject({ category: 'push', effect: 'Pushes to a remote' });
    await answerApproval(world, request.approvalId, 'deny');
    expect((await asked).message).toBe('The owner denied this.');
    child.say(RESULT);
    await answer;
  });

  it("a deny with a note carries the owner's words back to Claude", async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('t1', 'mcp__hub__save_doc'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(world, 'mcp__hub__save_doc', { draft: 'x' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    const [request] = world.of('approval.requested');
    await dispatch(
      {
        action: 'turn.answer',
        args: { chatId: CHAT, approvalId: request.approvalId, decision: 'deny', note: 'Shorter' },
      },
      world.context,
      () => {},
    );
    expect((await asked).message).toContain('Shorter');
    child.say(RESULT);
    await answer;
  });
});

describe('questions', () => {
  const QUESTION = {
    questions: [
      {
        question: 'Which one?',
        header: 'Pick',
        multiSelect: false,
        options: [{ label: 'A', description: 'First' }, { label: 'B' }],
      },
    ],
  };

  it('become a question event, and the answer goes back the way the engine expects', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    await until(() => world.of('question.asked').length === 1);
    const [event] = world.of('question.asked');
    expect(event.questions).toEqual([
      {
        text: 'Which one?',
        header: 'Pick',
        multiSelect: false,
        options: [{ label: 'A', description: 'First' }, { label: 'B' }],
      },
    ]);
    expect(world.of('approval.requested')).toEqual([]);
    const answered = await dispatch(
      {
        action: 'turn.answer',
        args: {
          chatId: CHAT,
          approvalId: event.questionId,
          decision: 'allow',
          answers: { 'Which one?': 'B' },
        },
      },
      world.context,
      () => {},
    );
    expect(answered.data.accepted).toBe(true);
    expect(await asked).toEqual({
      behavior: 'allow',
      updatedInput: { ...QUESTION, answers: { 'Which one?': 'B' } },
    });
    expect(world.of('question.resolved')).toEqual([
      expect.objectContaining({ status: 'answered', answers: { 'Which one?': 'B' } }),
    ]);
    child.say(RESULT);
    await answer;
  });

  it('work in Ask and Plan too, since they run nothing', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'plan' });
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    await until(() => world.of('question.asked').length === 1);
    await dispatch(
      {
        action: 'turn.answer',
        args: { chatId: CHAT, approvalId: world.of('question.asked')[0].questionId, decision: 'deny' },
      },
      world.context,
      () => {},
    );
    expect((await asked).behavior).toBe('deny');
    expect(world.of('question.resolved')[0].status).toBe('declined');
    child.say(RESULT);
    await answer;
  });

  it('a question nobody answers ends on the same clock as an approval', async () => {
    const world = aWorld({ HUB_BRIDGE_APPROVAL_TIMEOUT_MS: '30' });
    const { answer, child } = await started(world);
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    const asked = await askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    expect(asked.behavior).toBe('deny');
    expect(world.of('question.resolved')[0].status).toBe('timed_out');
    child.say(RESULT);
    await answer;
  });

  it('a question whose shape is unknown is refused, and the model asks in words', async () => {
    const world = aWorld();
    const { answer, child } = await started(world);
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    expect((await askAsShim(world, 'AskUserQuestion', { nope: true }, 'q1')).behavior).toBe('deny');
    child.say(RESULT);
    await answer;
  });
});

describe('the Starting line', () => {
  it('a new chat and a mode change each say a process is starting, and why. The same mode says nothing', async () => {
    const world = aWorld();
    const first = await started(world);
    first.child.say(RESULT);
    await first.answer;
    expect(world.of('turn.starting').map((event) => event.reason)).toEqual(['new']);

    const same = world.begin();
    await until(() => first.child.written.length === 2);
    first.child.say(RESULT);
    await same;
    expect(world.of('turn.starting')).toHaveLength(1);

    const second = await restarted(world, { mode: 'plan', sessionId: SESSION });
    expect(world.of('turn.starting').map((event) => event.reason)).toEqual(['new', 'mode']);
    second.child.say(RESULT);
    await second.answer;
  });

  it('a model change is named, and a closed process is a resume', async () => {
    const world = aWorld();
    const first = await started(world, { model: 'haiku' });
    first.child.say(RESULT);
    await first.answer;
    const second = await restarted(world, { model: 'sonnet', sessionId: SESSION });
    expect(world.of('turn.starting').at(-1).reason).toBe('model');
    second.child.say(RESULT);
    await second.answer;
    await turnManager(world.context).close(CHAT);
    const third = await restarted(world, { model: 'sonnet', sessionId: SESSION });
    expect(world.of('turn.starting').at(-1).reason).toBe('resume');
    third.child.say(RESULT);
    await third.answer;
  });

  it("every mode gets the same system prompt, since the engine keeps the first launch's for good", async () => {
    const prompts = [];
    for (const mode of ['plan', 'execute', 'ask']) {
      const world = aWorld();
      const turn = await started(world, { mode });
      const { args } = world.spawned[0];
      prompts.push(args[args.indexOf('--append-system-prompt') + 1]);
      turn.child.say(RESULT);
      await turn.answer;
    }
    expect(prompts[0]).toContain('propose_plan');
    expect(new Set(prompts).size).toBe(1);
  });
});

describe('a report asks what the turn changed', () => {
  it('answers the facts so far, and nothing once no turn runs', async () => {
    const world = aWorld();
    const ask = () => dispatch({ action: 'turn.files', args: { chatId: CHAT } }, world.context, () => {});
    expect((await ask()).data).toEqual({ available: false, files: [] });
    const { answer, child } = await started(world);
    child.say({
      type: 'assistant',
      message: {
        id: 'm',
        content: [{ type: 'tool_use', id: 't', name: 'Write', input: { file_path: `${world.folder}/a.md` } }],
      },
    });
    await until(() => world.of('tool.input').length === 1);
    expect((await ask()).data).toEqual({ available: true, files: [{ path: 'a.md', source: 'tool' }] });
    child.say(RESULT);
    await answer;
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

describe('queued runs: run mode and extra folders (docs/16 D58, D59)', () => {
  const QUESTION = {
    questions: [
      {
        question: 'Which store?',
        multiSelect: false,
        options: [{ label: 'Redis' }, { label: 'Postgres (Recommended)' }],
      },
    ],
  };

  it('passes each extra folder as its own --add-dir, and a missing one starts nothing', async () => {
    const world = aWorld();
    const web = aFolder(world.system, 'web');
    world.context.folders = () => [
      { path: world.folder, project: 'demo' },
      { path: web, project: 'demo' },
    ];
    const { answer, child } = await started(world, { addDirs: [web] });
    const { args } = world.spawned.at(-1);
    const at = args.indexOf('--add-dir');
    expect(args[at + 1]).toBe(web);
    expect(args[at + 2]?.startsWith('--')).toBe(true);
    child.say(RESULT);
    await answer;
    const missing = await world.begin({ addDirs: [`${web}-gone`] });
    expect(missing).toMatchObject({ ok: false });
  });

  it('automatic refuses a push at once, with a message to carry on, and records it as skipped', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { runMode: 'automatic' });
    child.say(toolStart('t1'));
    const decided = await askAsShim(
      world,
      'Bash',
      { command: 'git push origin main', description: 'Push' },
      't1',
    );
    expect(decided.behavior).toBe('deny');
    expect(decided.message).toContain('automatic Hub run');
    expect(decided.message).toContain('Carry on without this step');
    expect(world.of('approval.requested')).toEqual([]);
    expect(world.of('auto.decision')).toEqual([
      expect.objectContaining({
        decision: 'skipped',
        command: 'git push origin main',
        category: 'push',
        toolUseId: 't1',
      }),
    ]);
    child.say(RESULT);
    await answer;
  });

  it("automatic in Hub's own copy commits to its own branch at once, and records it as allowed", async () => {
    const world = aWorld({}, { inCopy: true });
    const { answer, child } = await started(world, { runMode: 'automatic', isolated: true });
    child.say(toolStart('c1'));
    const decided = await askAsShim(world, 'Bash', { command: 'git add -A && git commit -m "step 1"' }, 'c1');
    expect(decided.behavior).toBe('allow');
    expect(world.of('auto.decision')).toEqual([
      expect.objectContaining({ decision: 'approved', category: 'commit', toolUseId: 'c1' }),
    ]);
    child.say(RESULT);
    await answer;
  });

  it("automatic in Hub's own copy still skips a push, and a commit with anything after it", async () => {
    const world = aWorld({}, { inCopy: true });
    const { answer, child } = await started(world, { runMode: 'automatic', isolated: true });
    for (const [id, command] of [
      ['p1', 'git push origin hub/gtv-7'],
      ['p2', 'git commit -m x && git push'],
      ['p3', 'git merge main'],
    ]) {
      child.say(toolStart(id));
      expect((await askAsShim(world, 'Bash', { command }, id)).behavior).toBe('deny');
    }
    expect(world.of('auto.decision').map((decision) => decision.decision)).toEqual([
      'skipped',
      'skipped',
      'skipped',
    ]);
    child.say(RESULT);
    await answer;
  });

  it('does not believe "isolated" for a folder that is not one of its copies: the commit is skipped', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { runMode: 'automatic', isolated: true });
    child.say(toolStart('c2'));
    const decided = await askAsShim(world, 'Bash', { command: 'git commit -m x' }, 'c2');
    expect(decided.behavior).toBe('deny');
    expect(world.of('auto.decision')).toEqual([
      expect.objectContaining({ decision: 'skipped', category: 'commit' }),
    ]);
    child.say(RESULT);
    await answer;
  });

  it('automatic answers a question with its recommended option, else the first, and nobody is asked', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { runMode: 'automatic' });
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    const asked = await askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    expect(asked).toEqual({
      behavior: 'allow',
      updatedInput: { ...QUESTION, answers: { 'Which store?': 'Postgres (Recommended)' } },
    });
    expect(world.of('question.asked')).toEqual([]);
    expect(world.of('auto.decision')[0]).toMatchObject({
      decision: 'answered',
      answers: { 'Which store?': 'Postgres (Recommended)' },
    });
    child.say(RESULT);
    await answer;
  });

  it('Auto mode allows a push at once with Execute settings, nobody is asked, and records it as approved', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'auto' });
    const { args } = world.spawned.at(-1);
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
    child.say(toolStart('t1'));
    const input = { command: 'git push origin main', description: 'Push' };
    const decided = await askAsShim(world, 'Bash', input, 't1');
    expect(decided).toEqual({ behavior: 'allow', updatedInput: input });
    expect(world.of('approval.requested')).toEqual([]);
    expect(world.of('auto.decision')).toEqual([
      expect.objectContaining({ decision: 'approved', command: 'git push origin main', category: 'push' }),
    ]);
    child.say(RESULT);
    await answer;
  });

  it('Auto mode still asks the owner a question: it never answers one for them', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'auto' });
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 1);
    const asked = askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    await until(() => world.of('question.asked').length === 1);
    expect(world.of('auto.decision')).toEqual([]);
    await dispatch(
      {
        action: 'turn.answer',
        args: {
          chatId: CHAT,
          approvalId: world.of('question.asked')[0].questionId,
          decision: 'allow',
          answers: { 'Which store?': 'SQLite' },
        },
      },
      world.context,
      () => {},
    );
    expect((await asked).updatedInput.answers).toEqual({ 'Which store?': 'SQLite' });
    child.say(RESULT);
    await answer;
  });

  it('switching a running Execute turn to Auto allows the paused call, leaves a question to the owner, and the next call runs at once', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'execute' });
    child.say(toolStart('t0'));
    const paused = askAsShim(world, 'Bash', { command: 'git push origin main' }, 't0');
    await until(() => world.of('approval.requested').length === 1);
    const switched = await dispatch(
      { action: 'turn.mode', args: { chatId: CHAT, mode: 'auto' } },
      world.context,
      () => {},
    );
    expect(switched.data.changed).toBe(true);
    expect((await paused).behavior).toBe('allow');
    child.say(toolStart('q1', 'AskUserQuestion'));
    await until(() => world.of('tool.started').length === 2);
    askAsShim(world, 'AskUserQuestion', QUESTION, 'q1');
    await until(() => world.of('question.asked').length === 1);
    child.say(toolStart('t1'));
    const pushed = await askAsShim(world, 'Bash', { command: 'git push origin dev' }, 't1');
    expect(pushed.behavior).toBe('allow');
    expect(world.of('approval.requested')).toHaveLength(1);
    await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    child.say(RESULT);
    await answer;
  });

  it('Execute runs a command that is not sensitive at once, and asks for a sensitive one', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'execute' });
    child.say(toolStart('t1'));
    const tests = await askAsShim(world, 'Bash', { command: 'pnpm test' }, 't1');
    expect(tests).toEqual({ behavior: 'allow', updatedInput: { command: 'pnpm test' } });
    child.say(toolStart('t2'));
    const sudo = askAsShim(world, 'Bash', { command: 'sudo apt install x' }, 't2');
    await until(() => world.of('approval.requested').length === 1);
    expect(world.of('approval.requested')[0].command).toBe('sudo apt install x');
    await dispatch({ action: 'turn.stop', args: { chatId: CHAT } }, world.context, () => {});
    expect((await sudo).behavior).toBe('deny');
    child.say(RESULT);
    await answer;
  });

  it('a read-only turn does not take Auto mid-turn', async () => {
    const world = aWorld();
    const { answer, child } = await started(world, { mode: 'plan' });
    const switched = await dispatch(
      { action: 'turn.mode', args: { chatId: CHAT, mode: 'auto' } },
      world.context,
      () => {},
    );
    expect(switched.data.changed).toBe(false);
    child.say(RESULT);
    await answer;
  });

  it('untimed waits past the panel window, and sets the engine limit above it', async () => {
    const world = aWorld({ HUB_BRIDGE_APPROVAL_TIMEOUT_MS: '30' });
    const { answer, child } = await started(world, { runMode: 'approval', untimed: true });
    expect(Number(world.spawned.at(-1).options.env.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT)).toBeGreaterThan(
      19 * 24 * 60 * 60_000,
    );
    child.say(toolStart('t1'));
    const asked = askAsShim(world, 'Bash', { command: 'git push origin main' }, 't1');
    await until(() => world.of('approval.requested').length === 1);
    const [request] = world.of('approval.requested');
    expect(Date.parse(request.expiresAt) - Date.now()).toBeGreaterThan(19 * 24 * 60 * 60_000);
    await new Promise((done) => setTimeout(done, 80));
    expect(world.of('approval.resolved')).toEqual([]);
    await answerApproval(world, request.approvalId, 'allow');
    expect((await asked).behavior).toBe('allow');
    child.say(RESULT);
    await answer;
  });

  it('a run mode outside Execute, or an unknown one, is refused', async () => {
    const world = aWorld();
    expect(await world.begin({ mode: 'plan', runMode: 'automatic' })).toMatchObject({
      ok: false,
      error: { code: 'bad_arguments' },
    });
    expect(await world.begin({ runMode: 'yolo' })).toMatchObject({
      ok: false,
      error: { code: 'bad_arguments' },
    });
    expect(world.spawned).toEqual([]);
  });
});
