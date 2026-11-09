/**
 * @file Chat turns on this device (docs/16 §7, S1 Q2 to Q8): one live `claude` per chat in use, `--resume` when there is none, and stop that leaves nothing behind.
 * @description `turn.start` spawns the binary directly (never a shell) with the prompt on stdin. Raw events go through `claude-events.mjs` and leave as `TurnEvent`s with `emit`, and the action answers when the turn ends. A live process stays for
 * `IDLE_MS`, then its stdin closes. After an interrupt the process is let go and the next message resumes, because a second message after an interrupt is unproven (S1 Q7). The bridge owns the approval window: when it ends the call is denied, never
 * allowed, and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` sits above it so the engine's own limit never fires first (S1 C10). A dropped socket stops every running turn, since nobody could answer an approval or see the reply.
 * The bridge never reads Claude's credentials: the binary signs itself in. Nothing a chat says is logged.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  aboveTested,
  inTestedRange,
  meetsMinimum,
  minimumVersion,
  resolveClaude,
  testedMax,
} from './claude.mjs';
import {
  createEventMapper,
  isQuestionTool,
  questionAnswerInput,
  questionsFromInput,
} from './claude-events.mjs';
import { branchOf, changedFiles, diffOf, snapshot } from './git-facts.mjs';
import { hubPaths } from './paths.mjs';
import {
  APPROVAL_EFFECTS,
  categoryOf,
  describeCall,
  executeSettings,
  MODE_FLAGS,
  readOnlySettings,
} from './permissions.mjs';
import { Refusal } from './protocol.mjs';
import { childEnv } from './system.mjs';

export const CHAT_MODES = ['ask', 'plan', 'execute', 'auto'];
export const CHAT_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const MODEL = /^[a-z0-9][a-z0-9.\-[\]]{0,63}$/i;
const APPROVAL_SHIM = fileURLToPath(new URL('../bin/hub-approval-shim.mjs', import.meta.url));
const READ_ONLY_GUARD = fileURLToPath(new URL('../bin/hub-read-only-guard.mjs', import.meta.url));
/** A hook's command may run in cmd or in bash, and forward slashes mean the same in both. */
const slashes = (path) => path.replaceAll('\\', '/');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IDLE_MS = 10 * 60_000;
const APPROVAL_WINDOW_MS = 30 * 60_000;
/** A queued run in With my approval waits with no time limit (docs/16 D58). A timer still exists, far ahead, so `expiresAt` stays a date; `@hub/contracts` (`APPROVAL_NO_TIME_LIMIT_MS`) holds the same number, and Node caps a timer near 24.8 days. */
const UNTIMED_WINDOW_MS = 20 * 24 * 60 * 60_000;
export const RUN_MODES = ['approval', 'automatic'];
const MAX_ADD_DIRS = 8;
/** How an option says it is the recommended one, in English or Arabic. */
const RECOMMENDED = /recommended|\u0645\u0648\u0635\u0649/i;
const ENGINE_LIMIT_MARGIN_MS = 10 * 60_000;
const STOP_GRACE_MS = 5_000;
const EXIT_GRACE_MS = 3_000;
const TOOL_MATCH_WAIT_MS = 3_000;
const MAX_LIVE = 3;
const ENGINE_CACHE_MS = 5 * 60_000;
const STDERR_TAIL = 2_000;
const CHANGED_FILES_LIMIT = 300;
const DIFF_LIMIT = 200_000;
const MAX_STDOUT_BUFFER = 64_000_000;
const OK_ENV_FOR_CLAUDE = new Set(['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_MAX_RETRIES']);
const UNREADABLE_MESSAGE =
  'Claude Code sent something Hub cannot read, so this turn was stopped. Nothing more will run in it. Open in VS Code to carry on there.';
/**
 * The panel's system prompt (docs/16 §7.2): the structured plan first, and the reply stays the fallback. Every mode gets the same words, because the engine records the first launch's prompt and reuses it on every resume, whatever a later launch passes, so a chat that began in Execute could never learn this on moving to Plan.
 */
const PANEL_PROMPT =
  "You are in a Hub panel chat. In Plan mode, when your plan is ready, call the hub server's propose_plan tool with its title, steps, checks and risks, and do not use ExitPlanMode for it. If that tool is not available, write the whole plan in your reply. Then stop and wait for the owner.";

/** docs/16 §13's one switch: the owner, or a test, may hand the binary an API key or a stand-in model through the bridge's own environment. */
function extraEnv(env) {
  try {
    const parsed = JSON.parse(env.HUB_BRIDGE_CLAUDE_ENV ?? '{}');
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([key, value]) => OK_ENV_FOR_CLAUDE.has(key) && typeof value === 'string',
      ),
    );
  } catch {
    return {};
  }
}

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Why this turn needs a process. Only a live process that changed names what changed: a closed one is simply resumed. */
function startReason(previous, options) {
  if (!previous) return options.sessionId ? 'resume' : 'new';
  if (previous.mode !== options.mode) return 'mode';
  if (previous.model !== options.model) return 'model';
  if (previous.effort !== options.effort) return 'effort';
  if (previous.folder !== options.folder) return 'folder';
  return 'resume';
}

function pipePath(system) {
  const name = `hub-bridge-${randomUUID()}`;
  return process.platform === 'win32' ? `\\\\.\\pipe\\${name}` : join(hubPaths(system).chat, `${name}.sock`);
}

/** The per-context manager. One bridge has one context, and a test builds its own. */
function createManager(context) {
  const { system } = context;
  const chatDir = hubPaths(system).chat;
  const chats = new Map();
  const byKey = new Map();
  const starting = new Set();
  let server = null;
  let serverPath = null;
  let engineCache = null;

  const approvalWindow = () => number(system.env.HUB_BRIDGE_APPROVAL_TIMEOUT_MS, APPROVAL_WINDOW_MS);
  /** A process's own window: the panel's, or none for a queued run that waits on the owner (D58). */
  const windowOf = (proc) => (proc.options.untimed ? UNTIMED_WINDOW_MS : approvalWindow());
  const idleWindow = () => number(system.env.HUB_BRIDGE_IDLE_MS, IDLE_MS);

  function ensureChatDir() {
    mkdirSync(chatDir, { recursive: true });
  }

  /** Files from a process that died with the machine. Each is small, but nothing here may pile up. */
  function sweepChatDir() {
    if (!existsSync(chatDir)) return;
    const liveFiles = new Set([...chats.values()].map((proc) => proc.mcpFile));
    for (const name of readdirSync(chatDir)) {
      const file = join(chatDir, name);
      if (name.endsWith('.mcp.json') && !liveFiles.has(file)) rmSync(file, { force: true });
    }
  }

  function startServer() {
    if (server) return Promise.resolve();
    ensureChatDir();
    serverPath = pipePath(system);
    return new Promise((resolve, reject) => {
      const next = createServer((socket) => onShimSocket(socket));
      next.once('error', reject);
      next.listen(serverPath, () => {
        next.removeListener('error', reject);
        next.unref?.();
        server = next;
        resolve();
      });
    });
  }

  function onShimSocket(socket) {
    let raw = '';
    socket.setEncoding('utf8');
    socket.on('error', () => {});
    socket.on('data', (chunk) => {
      if (raw === null) return;
      raw += chunk;
      if (raw.length > 8_000_000) {
        raw = null;
        socket.destroy();
        return;
      }
      const end = raw.indexOf('\n');
      if (end === -1) return;
      let message;
      try {
        message = JSON.parse(raw.slice(0, end));
      } catch {
        socket.destroy();
        return;
      }
      raw = null;
      const proc = byKey.get(message.key);
      const reply = (answer) => {
        if (!socket.destroyed) socket.end(`${JSON.stringify(answer)}\n`);
      };
      if (!proc) {
        reply({ behavior: 'deny', message: 'This chat is no longer running.' });
        return;
      }
      void onApproval(proc, message, reply, socket);
    });
  }

  async function waitForToolUse(proc, toolUseId) {
    const deadline = Date.now() + TOOL_MATCH_WAIT_MS;
    while (Date.now() < deadline) {
      if (proc.mapper.state.tools.has(toolUseId)) return true;
      await new Promise((done) => setTimeout(done, 25));
    }
    return proc.mapper.state.tools.has(toolUseId);
  }

  async function onApproval(proc, message, reply, socket) {
    const { toolName, input, toolUseId } = message;
    const turn = proc.turn;
    const refuse = (text) => reply({ behavior: 'deny', message: text });
    if (!turn) return refuse('No turn is running in this chat.');
    if (typeof toolName !== 'string' || typeof toolUseId !== 'string') return refuse('Not a real tool call.');
    // A direct call by the model has no matching tool use for the tool it names, and grants nothing (S1 Q4).
    if (!(await waitForToolUse(proc, toolUseId)) || proc.mapper.state.tools.get(toolUseId) !== toolName) {
      return refuse('This does not match a tool call in the stream, so it is refused.');
    }
    if (proc.turn !== turn || turn.stopRequested) return refuse('The turn was stopped.');
    const autoApprove = MODE_FLAGS[proc.options.mode].autoApprove;
    if (isQuestionTool(toolName)) {
      if (proc.options.runMode === 'automatic' || autoApprove)
        return answerForOwner(turn, message, reply, refuse);
      return askOwner(proc, turn, message, reply, socket, refuse);
    }
    if (MODE_FLAGS[proc.options.mode].readOnly) {
      if (toolName === 'ExitPlanMode') {
        if (typeof input?.plan === 'string' && !proc.mapper.state.planSent) {
          proc.mapper.state.planSent = true;
          turn.emit('plan.proposed', { kind: 'plan.proposed', plan: input.plan });
        }
        // The engine may keep the plan in a file this mode cannot write, so the reply is where the owner must see it.
        return refuse(
          'The owner reviews plans in Hub. If you have not already, write the whole plan in your reply now, then stop and wait for them.',
        );
      }
      return refuse(`This chat is in ${proc.options.mode} mode, which is read only.`);
    }
    if (proc.options.runMode === 'automatic') return skipForOwner(turn, message, reply);
    if (autoApprove) return approveForOwner(turn, message, reply);
    const approvalId = randomUUID();
    const window = windowOf(proc);
    const pending = {
      approvalId,
      turn,
      settled: false,
      settle(status, answer) {
        if (pending.settled) return false;
        pending.settled = true;
        clearTimeout(pending.timer);
        turn.approvals.delete(approvalId);
        turn.emit('approval.resolved', { kind: 'approval.resolved', approvalId, status });
        reply(answer);
        return true;
      },
      timer: null,
      input,
    };
    const category = categoryOf(toolName, input);
    pending.timer = setTimeout(() => {
      pending.settle('timed_out', {
        behavior: 'deny',
        message: 'Nobody answered in time, so this was denied.',
      });
    }, window);
    pending.timer.unref?.();
    turn.approvals.set(approvalId, pending);
    // Claude Code exited, or the shim went: nothing is waiting any more.
    socket.on('close', () => pending.settle('stopped', { behavior: 'deny', message: 'The call ended.' }));
    turn.emit('approval.requested', {
      kind: 'approval.requested',
      approvalId,
      toolUseId,
      toolName,
      command: describeCall(toolName, input),
      category,
      input: input ?? {},
      effect: APPROVAL_EFFECTS[category],
      expiresAt: new Date(Date.now() + window).toISOString(),
    });
    return undefined;
  }

  /**
   * An automatic run (docs/16 D58): a call that needs the owner is refused at once and never runs. It is recorded as a pending item, which the owner may run later through a normal approval. Nothing waits, so the run never stalls.
   * This only narrows: the same call in With my approval would pause, and nothing is allowed here that would not be allowed there.
   */
  function skipForOwner(turn, message, reply) {
    const { toolName, input, toolUseId } = message;
    const category = categoryOf(toolName, input);
    const command = describeCall(toolName, input);
    turn.emit('auto.decision', {
      kind: 'auto.decision',
      decisionId: randomUUID(),
      toolUseId,
      decision: 'skipped',
      toolName,
      command,
      category,
      input: input ?? {},
      effect: APPROVAL_EFFECTS[category],
    });
    reply({
      behavior: 'deny',
      message: `This is an automatic Hub run, so this was not run and will not be: ${command}. Hub kept it for the owner to run later. Carry on without this step, and say in your report that it waits for the owner.`,
    });
    return undefined;
  }

  /** Auto mode: the owner chose to let the turn run to its end, so the call runs at once. It is recorded, so the chat still shows every call that was allowed for the owner. */
  function approveForOwner(turn, message, reply) {
    const { toolName, input, toolUseId } = message;
    const category = categoryOf(toolName, input);
    turn.emit('auto.decision', {
      kind: 'auto.decision',
      decisionId: randomUUID(),
      toolUseId,
      decision: 'approved',
      toolName,
      command: describeCall(toolName, input),
      category,
      input: input ?? {},
      effect: APPROVAL_EFFECTS[category],
    });
    reply({ behavior: 'allow', updatedInput: input ?? {} });
    return undefined;
  }

  /** An automatic run's question takes the recommended option of each: the one marked recommended, else the first (docs/16 D58). The choice is recorded for the run's decisions summary. */
  function answerForOwner(turn, message, reply, refuse) {
    const { input, toolUseId } = message;
    const questions = questionsFromInput(input);
    if (!questions) {
      return refuse(
        'Hub could not read this question. Nobody will answer in this automatic run: take the option you would recommend, and say which.',
      );
    }
    const answers = Object.fromEntries(
      questions.map((question) => [
        question.text,
        (question.options.find((option) => RECOMMENDED.test(option.label)) ?? question.options[0])?.label ??
          'Take the option you would recommend, and say which.',
      ]),
    );
    turn.emit('auto.decision', {
      kind: 'auto.decision',
      decisionId: randomUUID(),
      toolUseId,
      decision: 'answered',
      toolName: 'question',
      command: questions[0]?.text ?? '',
      category: 'other',
      input: {},
      effect: '',
      questions,
      answers,
    });
    reply({ behavior: 'allow', updatedInput: questionAnswerInput(input, answers) });
    return undefined;
  }

  /** `AskUserQuestion`: the same wait and the same route as an approval, and it never runs anything, so every mode has it (docs/16 §7.2). */
  function askOwner(proc, turn, message, reply, socket, refuse) {
    const { input, toolUseId } = message;
    const questions = questionsFromInput(input);
    if (!questions) return refuse('Hub could not read this question, so ask it in your reply.');
    const questionId = randomUUID();
    const window = windowOf(proc);
    const pending = {
      approvalId: questionId,
      kind: 'question',
      turn,
      settled: false,
      settle(status, answer, answers) {
        if (pending.settled) return false;
        pending.settled = true;
        clearTimeout(pending.timer);
        turn.approvals.delete(questionId);
        turn.emit('question.resolved', {
          kind: 'question.resolved',
          questionId,
          status,
          ...(answers ? { answers } : {}),
        });
        reply(answer);
        return true;
      },
      timer: null,
      input,
    };
    pending.timer = setTimeout(() => {
      pending.settle('timed_out', { behavior: 'deny', message: 'Nobody answered in time.' });
    }, window);
    pending.timer.unref?.();
    turn.approvals.set(questionId, pending);
    socket.on('close', () => pending.settle('stopped', { behavior: 'deny', message: 'The call ended.' }));
    turn.emit('question.asked', {
      kind: 'question.asked',
      questionId,
      toolUseId,
      questions,
      expiresAt: new Date(Date.now() + window).toISOString(),
    });
    return undefined;
  }

  /**
   * The newest copy inside the tested range, and otherwise the newest above the minimum, which runs with a warning (D53). Below the minimum is refused, with a clear message (docs/16 §13).
   */
  async function engine() {
    if (engineCache && Date.now() - engineCache.at < ENGINE_CACHE_MS) return engineCache.value;
    const { env } = system;
    const found = await resolveClaude(system);
    const best =
      found.copies.find((copy) => inTestedRange(copy.version, env)) ??
      found.copies.find((copy) => meetsMinimum(copy.version, env));
    let message = null;
    if (!best) {
      message =
        found.copies.length === 0
          ? 'Claude Code was not found on this device.'
          : `Claude Code ${found.copies.map((copy) => copy.version).join(', ')} is older than the minimum Hub needs (${minimumVersion(env)}). Update it, or use Open in VS Code.`;
    }
    const warning =
      best && aboveTested(best.version, env)
        ? { code: 'newer_than_tested', version: best.version, testedMax: testedMax(env) }
        : null;
    if (warning) {
      message = `Claude Code ${warning.version} is newer than the version Hub tested (${warning.testedMax}). It runs and the permission rules stay active, but a change in its behaviour may show up here first.`;
    }
    let effortSupported = false;
    let modelSupported = false;
    if (best) {
      const help = await system.run(best.path, ['--help'], { timeoutMs: 20_000 });
      effortSupported = help.stdout.includes('--effort');
      modelSupported = help.stdout.includes('--model');
    }
    const value = {
      best: best ?? null,
      copies: found.copies,
      message,
      warning,
      effortSupported,
      modelSupported,
    };
    engineCache = { at: Date.now(), value };
    return value;
  }

  function writeSettings(mode) {
    ensureChatDir();
    const file = join(
      chatDir,
      MODE_FLAGS[mode].readOnly ? 'settings-read-only.json' : 'settings-execute.json',
    );
    const settings = MODE_FLAGS[mode].readOnly
      ? readOnlySettings(`"${slashes(system.nodePath)}" "${slashes(READ_ONLY_GUARD)}"`)
      : executeSettings();
    writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`);
    return file;
  }

  function writeMcpConfig(key) {
    ensureChatDir();
    const file = join(chatDir, `${randomUUID()}.mcp.json`);
    const config = {
      mcpServers: {
        hubperm: {
          type: 'stdio',
          command: system.nodePath,
          args: [APPROVAL_SHIM],
          env: { HUB_APPROVAL_PIPE: serverPath, HUB_APPROVAL_KEY: key },
        },
      },
    };
    writeFileSync(file, JSON.stringify(config), { mode: 0o600 });
    return file;
  }

  function buildArgs(options, settingsFile, mcpFile, engineInfo) {
    const args = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--input-format',
      'stream-json',
      '--permission-mode',
      MODE_FLAGS[options.mode].permissionMode,
      '--settings',
      settingsFile,
      '--mcp-config',
      mcpFile,
      '--permission-prompt-tool',
      'mcp__hubperm__approve',
    ];
    if (options.model) args.push('--model', options.model);
    if (options.effort && engineInfo.effortSupported) args.push('--effort', options.effort);
    if (options.sessionId) args.push('--resume', options.sessionId);
    // `--add-dir` takes several values: each goes as its own pair, and a flag always follows, so nothing else is read as a folder (D59).
    for (const dir of options.addDirs ?? []) args.push('--add-dir', dir);
    args.push('--append-system-prompt', PANEL_PROMPT);
    // For a test on a real sign-in: this session's plugin in place of the installed one, whose hooks would reach the owner's own Hub.
    if (system.env.HUB_BRIDGE_PLUGIN_DIR) args.push('--plugin-dir', system.env.HUB_BRIDGE_PLUGIN_DIR);
    return args;
  }

  const processKey = (options) =>
    [
      options.folder,
      options.mode,
      options.model ?? '',
      options.effort ?? '',
      (options.addDirs ?? []).join('|'),
      options.runMode ?? '',
      options.untimed ? 'untimed' : '',
    ].join('\u0000');

  function closeIdle(proc) {
    clearTimeout(proc.idleTimer);
    try {
      proc.child.stdin.end();
    } catch {
      /* Already closed. */
    }
    // It should leave by itself; if not, its tree goes.
    proc.exitTimer = setTimeout(() => killTree(proc), EXIT_GRACE_MS);
    proc.exitTimer.unref?.();
  }

  function killTree(proc) {
    if (proc.exited) return Promise.resolve();
    return system.killTree(proc.child.pid);
  }

  function makeRoom() {
    const idle = [...chats.values()].filter((proc) => !proc.turn && !proc.exited);
    while (chats.size >= MAX_LIVE && idle.length > 0) {
      const oldest = idle.shift();
      chats.delete(oldest.chatId);
      closeIdle(oldest);
    }
  }

  function endTurn(proc, turn, ended) {
    if (turn.finished) return;
    turn.finished = true;
    if (proc.turn === turn) proc.turn = null;
    clearTimeout(turn.stopTimer);
    for (const pending of [...turn.approvals.values()]) {
      pending.settle('stopped', { behavior: 'deny', message: 'The turn ended.' });
    }
    turn.emit('turn.ended', { kind: 'turn.ended', ...ended });
    turn.done({ status: ended.status });
  }

  async function finishWithFacts(proc, turn, facts) {
    if (turn.finishing) return;
    turn.finishing = true;
    const after = await snapshot(system, proc.options.folder).catch(() => null);
    const files = changedFiles(
      proc.options.folder,
      turn.before,
      after,
      proc.mapper.state.toolPaths,
      CHANGED_FILES_LIMIT,
    );
    const { ok, failure, message, ...reported } = facts;
    const stopped = turn.stopRequested;
    const clean = Object.fromEntries(Object.entries(reported).filter(([, value]) => value !== undefined));
    const ended = stopped
      ? { status: 'stopped', ...clean }
      : ok
        ? { status: 'done', ...clean }
        : {
            status: 'failed',
            ...clean,
            ...(failure ? { failure } : {}),
            ...(message ? { message } : {}),
          };
    if (turn.startedAt) ended.durationMs = Date.now() - turn.startedAt;
    if (files.length > 0) ended.changedFiles = files;
    endTurn(proc, turn, ended);
    if (stopped || !ok) {
      chats.delete(proc.chatId);
      closeIdle(proc);
    } else {
      armIdle(proc);
    }
  }

  function armIdle(proc) {
    clearTimeout(proc.idleTimer);
    proc.idleTimer = setTimeout(() => {
      if (proc.turn) return;
      chats.delete(proc.chatId);
      closeIdle(proc);
    }, idleWindow());
    proc.idleTimer.unref?.();
  }

  /** D53: what the engine sent cannot be read, so going on would mean guessing. The turn stops and says so, and the process goes. */
  function stopUnreadable(proc, turn) {
    if (turn.finishing) return;
    turn.finishing = true;
    endTurn(proc, turn, {
      status: 'failed',
      failure: 'unreadable_event',
      message: UNREADABLE_MESSAGE,
      durationMs: Date.now() - turn.startedAt,
    });
    if (chats.get(proc.chatId) === proc) chats.delete(proc.chatId);
    void killTree(proc);
  }

  function onLine(proc, line) {
    const { events, result, unreadable } = proc.mapper.mapLine(line);
    const { turn } = proc;
    if (!turn) return;
    if (unreadable) {
      stopUnreadable(proc, turn);
      return;
    }
    for (const event of events) {
      if (event.kind === 'turn.session') {
        if (turn.sessionSent) continue;
        turn.sessionSent = true;
        proc.options.sessionId = event.sessionId;
        turn.emit(event.kind, {
          ...event,
          ...(turn.resumed ? { resumed: true } : {}),
          ...(turn.branch ? { branch: turn.branch.slice(0, 300) } : {}),
          ...(turn.effortApplied ? { effortApplied: turn.effortApplied } : {}),
        });
      } else {
        turn.emit(event.kind, event);
      }
    }
    if (result) void finishWithFacts(proc, turn, result);
  }

  function spawnProcess(chatId, options, engineInfo) {
    const key = randomUUID();
    const settingsFile = writeSettings(options.mode);
    const mcpFile = writeMcpConfig(key);
    const env = {
      ...childEnv(system.env),
      ...extraEnv(system.env),
      CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: String(
        (options.untimed ? UNTIMED_WINDOW_MS : approvalWindow()) + ENGINE_LIMIT_MARGIN_MS,
      ),
    };
    const child = system.spawnStream(
      engineInfo.best.path,
      buildArgs(options, settingsFile, mcpFile, engineInfo),
      {
        cwd: options.folder,
        env,
      },
    );
    const proc = {
      chatId,
      child,
      key,
      options: { ...options },
      processKey: processKey(options),
      mapper: createEventMapper({ mode: options.mode }),
      mcpFile,
      turn: null,
      exited: false,
      stderr: '',
      idleTimer: null,
      exitTimer: null,
      buffer: '',
    };
    byKey.set(key, proc);
    chats.set(chatId, proc);
    child.stdout.setEncoding?.('utf8');
    child.stderr.setEncoding?.('utf8');
    child.stdout.on('data', (chunk) => {
      proc.buffer += chunk;
      if (proc.buffer.length > MAX_STDOUT_BUFFER) proc.buffer = '';
      let end = proc.buffer.indexOf('\n');
      while (end !== -1) {
        const line = proc.buffer.slice(0, end);
        proc.buffer = proc.buffer.slice(end + 1);
        if (line.trim()) onLine(proc, line);
        end = proc.buffer.indexOf('\n');
      }
    });
    child.stderr.on('data', (chunk) => {
      proc.stderr = `${proc.stderr}${chunk}`.slice(-STDERR_TAIL);
    });
    child.stdin.on?.('error', () => {});
    const gone = () => {
      if (proc.exited) return;
      proc.exited = true;
      clearTimeout(proc.idleTimer);
      clearTimeout(proc.exitTimer);
      byKey.delete(key);
      if (chats.get(chatId) === proc) chats.delete(chatId);
      rmSync(mcpFile, { force: true });
      const { turn } = proc;
      if (!turn || turn.finishing) return;
      if (turn.stopRequested) {
        void finishWithFacts(proc, turn, { ok: true });
        return;
      }
      endTurn(proc, turn, {
        status: 'failed',
        failure: proc.mapper.state.failure ?? 'cut_off',
        message: (proc.stderr.trim() || 'Claude Code stopped before the turn ended.').slice(0, 300),
        ...(turn.startedAt ? { durationMs: Date.now() - turn.startedAt } : {}),
      });
    };
    child.on('exit', gone);
    child.on('error', gone);
    return proc;
  }

  function validateStart(args) {
    const { chatId, prompt, mode, model, effort, sessionId, folder, addDirs, runMode, untimed } = args;
    const fine =
      typeof chatId === 'string' &&
      UUID.test(chatId) &&
      typeof prompt === 'string' &&
      prompt !== '' &&
      CHAT_MODES.includes(mode) &&
      (model === undefined || (typeof model === 'string' && MODEL.test(model))) &&
      (effort === undefined || CHAT_EFFORTS.includes(effort)) &&
      (sessionId === undefined || (typeof sessionId === 'string' && UUID.test(sessionId))) &&
      (addDirs === undefined ||
        (Array.isArray(addDirs) &&
          addDirs.length <= MAX_ADD_DIRS &&
          addDirs.every((dir) => typeof dir === 'string' && dir !== ''))) &&
      (runMode === undefined || (RUN_MODES.includes(runMode) && mode === 'execute')) &&
      (untimed === undefined || typeof untimed === 'boolean');
    if (!fine) throw new Refusal('bad_arguments');
    for (const dir of [folder, ...(addDirs ?? [])]) {
      if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Refusal('folder_missing');
    }
  }

  async function start(args, emit) {
    validateStart(args);
    const options = {
      folder: args.folder,
      mode: args.mode,
      ...(args.model ? { model: args.model } : {}),
      ...(args.effort ? { effort: args.effort } : {}),
      ...(args.sessionId ? { sessionId: args.sessionId } : {}),
      ...(args.addDirs?.length ? { addDirs: [...args.addDirs] } : {}),
      ...(args.runMode ? { runMode: args.runMode } : {}),
      ...(args.untimed ? { untimed: true } : {}),
    };
    const chatId = args.chatId;
    if (chats.get(chatId)?.turn || starting.has(chatId)) throw new Refusal('turn_running');
    starting.add(chatId);
    try {
      return await begin(chatId, args, options, emit);
    } finally {
      starting.delete(chatId);
    }
  }

  async function begin(chatId, args, options, emit) {
    const send = (kind, data) => emit(kind, data);
    const info = await engine();
    if (!info.best) {
      const failure = info.copies.length === 0 ? 'claude_missing' : 'version_out_of_range';
      send('turn.ended', { kind: 'turn.ended', status: 'failed', failure, message: info.message });
      return { status: 'failed' };
    }
    if (info.warning) send('engine.warning', { kind: 'engine.warning', ...info.warning });
    await startServer();
    // Before the process exists, so nothing it says can arrive ahead of the turn.
    const before = await snapshot(system, options.folder).catch(() => null);
    const branch = await branchOf(system, options.folder).catch(() => null);

    let proc = chats.get(chatId);
    const reusable =
      proc &&
      !proc.exited &&
      proc.processKey === processKey(options) &&
      (!options.sessionId || proc.options.sessionId === options.sessionId);
    const previous = proc && !reusable ? proc.options : null;
    if (proc && !reusable) {
      chats.delete(chatId);
      closeIdle(proc);
      proc = null;
    }
    let resumed = false;
    if (!proc) {
      send('turn.starting', { kind: 'turn.starting', reason: startReason(previous, options) });
      makeRoom();
      sweepChatDir();
      resumed = Boolean(options.sessionId);
      proc = spawnProcess(chatId, options, info);
    } else {
      clearTimeout(proc.idleTimer);
      proc.mapper.nextTurn();
    }

    return new Promise((done) => {
      const turn = {
        emit: send,
        done,
        before,
        branch,
        resumed,
        effortApplied: options.effort && info.effortSupported ? options.effort : null,
        startedAt: Date.now(),
        approvals: new Map(),
        stopRequested: false,
        finished: false,
        finishing: false,
        sessionSent: false,
        stopTimer: null,
      };
      proc.turn = turn;
      if (proc.exited) {
        endTurn(proc, turn, {
          status: 'failed',
          failure: 'cut_off',
          message: (proc.stderr.trim() || 'Claude Code stopped at once.').slice(0, 300),
        });
        return;
      }
      proc.child.stdin.write(
        `${JSON.stringify({ type: 'user', message: { role: 'user', content: args.prompt } })}\n`,
      );
    });
  }

  function answer(args) {
    const { chatId, approvalId, decision, note, answers } = args;
    if (!['allow', 'deny'].includes(decision)) throw new Refusal('bad_arguments');
    if (note !== undefined && typeof note !== 'string') throw new Refusal('bad_arguments');
    const pending = chats.get(chatId)?.turn?.approvals.get(approvalId);
    if (!pending) return { accepted: false };
    if (pending.kind === 'question') return { accepted: answerQuestion(pending, decision, note, answers) };
    const accepted =
      decision === 'allow'
        ? pending.settle('allowed', { behavior: 'allow', updatedInput: pending.input ?? {} })
        : pending.settle('denied', {
            behavior: 'deny',
            message: note ? `The owner denied this, and said: ${note}` : 'The owner denied this.',
          });
    return { accepted };
  }

  function answerQuestion(pending, decision, note, answers) {
    if (decision === 'deny') {
      return pending.settle('declined', {
        behavior: 'deny',
        message: note ? `The owner did not answer, and said: ${note}` : 'The owner chose not to answer.',
      });
    }
    const fine =
      answers &&
      typeof answers === 'object' &&
      Object.values(answers).every((item) => typeof item === 'string');
    if (!fine) throw new Refusal('bad_arguments');
    return pending.settle(
      'answered',
      { behavior: 'allow', updatedInput: questionAnswerInput(pending.input, answers) },
      answers,
    );
  }

  /** What this turn has changed so far, from the device's own facts, for a report written before the turn ends. */
  async function files(chatId) {
    const proc = chats.get(chatId);
    const turn = proc?.turn;
    if (!turn) return { available: false, files: [] };
    const after = await snapshot(system, proc.options.folder).catch(() => null);
    return {
      available: true,
      files: changedFiles(
        proc.options.folder,
        turn.before,
        after,
        proc.mapper.state.toolPaths,
        CHANGED_FILES_LIMIT,
      ),
    };
  }

  /** Interrupt first, tree-kill last (S1 Q7). Answers once it has been asked; the turn's own end reports the rest. */
  function stop(chatId) {
    const proc = chats.get(chatId);
    const turn = proc?.turn;
    if (!turn) return { stopped: false };
    if (turn.stopRequested) return { stopped: true };
    turn.stopRequested = true;
    for (const pending of [...turn.approvals.values()]) {
      pending.settle('stopped', { behavior: 'deny', message: 'The owner stopped this turn.' });
    }
    try {
      proc.child.stdin.write(
        `${JSON.stringify({ type: 'control_request', request_id: randomUUID(), request: { subtype: 'interrupt' } })}\n`,
      );
    } catch {
      /* The tree-kill below is the answer. */
    }
    turn.stopTimer = setTimeout(
      () => void killTree(proc),
      number(system.env.HUB_BRIDGE_STOP_GRACE_MS, STOP_GRACE_MS),
    );
    turn.stopTimer.unref?.();
    return { stopped: true };
  }

  function stopAll() {
    for (const chatId of [...chats.keys()]) stop(chatId);
  }

  function close(chatId) {
    const proc = chats.get(chatId);
    if (!proc) return { closed: false };
    if (proc.turn) stop(chatId);
    else {
      chats.delete(chatId);
      closeIdle(proc);
    }
    return { closed: true };
  }

  async function shutdown() {
    stopAll();
    for (const proc of [...chats.values()]) await killTree(proc);
    server?.close();
    server = null;
  }

  async function engineStatus(args = {}) {
    if (args.fresh === true) engineCache = null;
    const info = await engine();
    let signedIn = null;
    if (info.best) {
      const answerNow = await system.run(info.best.path, ['auth', 'status'], { timeoutMs: 20_000 });
      try {
        signedIn = JSON.parse(answerNow.stdout).loggedIn === true;
      } catch {
        signedIn = null;
      }
    }
    return {
      found: info.copies.length > 0,
      version: info.best?.version ?? info.copies[0]?.version ?? null,
      inRange: Boolean(info.best) && !info.warning,
      canRun: Boolean(info.best),
      warning: info.warning,
      checkedAt: new Date().toISOString(),
      testedRange: { min: minimumVersion(system.env), max: testedMax(system.env) },
      message: info.message,
      signedIn,
      effortSupported: info.effortSupported,
      modelSupported: info.modelSupported,
      live: chats.size,
    };
  }

  return {
    start,
    answer,
    stop,
    stopAll,
    close,
    shutdown,
    engineStatus,
    files,
    liveChats: () => [...chats.keys()],
    forget: () => {
      engineCache = null;
    },
  };
}

const managers = new WeakMap();

export function turnManager(context) {
  let manager = managers.get(context);
  if (!manager) {
    manager = createManager(context);
    managers.set(context, manager);
  }
  return manager;
}

export const turnHandlers = {
  'turn.start': (args, context, emit) => turnManager(context).start(args, emit),
  'turn.answer': (args, context) => turnManager(context).answer(args),
  'turn.stop': (args, context) => turnManager(context).stop(args.chatId),
  'turn.files': (args, context) => turnManager(context).files(args.chatId),
  'chat.close': (args, context) => turnManager(context).close(args.chatId),
  'chat.diff': (args, context) => diffOf(context.system, args.folder, args.path, DIFF_LIMIT),
  'engine.status': (args, context) => turnManager(context).engineStatus(args),
};
