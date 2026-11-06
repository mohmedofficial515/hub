/**
 * @file The chat engine's small parts: the raw event mapper, the D41 lists against Hub's tool table, the log's bound, Git's facts and writing a doc on this device.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import {
  APPROVAL_EFFECTS as CONTRACT_EFFECTS,
  MCP_TOOLS,
  TURN_EVENT_KINDS,
  turnEventSchema,
} from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { createEventMapper, isStageTool, questionsFromInput } from '../lib/claude-events.mjs';
import { docHandlers } from '../lib/doc-files.mjs';
import { changedFiles, diffOf } from '../lib/git-facts.mjs';
import { createLog, LOG_LIMIT_BYTES, MAX_LINE_CHARS } from '../lib/log.mjs';
import {
  APPROVAL_EFFECTS,
  askRules,
  categoryOf,
  describeCall,
  executeSettings,
  HUB_ASK_TOOLS,
  HUB_READ_TOOLS,
  isReadOnlyMcpTool,
  readOnlySettings,
} from '../lib/permissions.mjs';
import { aFolder, fakeSystem } from './helpers.mjs';

describe('structured results in the mapper', () => {
  const assistant = (id, name, input) => ({
    type: 'assistant',
    message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name, input }] },
  });
  const failed = (id, content) => ({
    type: 'user',
    message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content }] },
  });
  const events = (mode, ...raws) => {
    const mapper = createEventMapper({ mode });
    return raws.flatMap((raw) => mapper.map(raw).events);
  };

  it('tool.input gives the shell command, for Bash and PowerShell only', () => {
    const out = events(
      'execute',
      assistant('a', 'Bash', { command: 'pnpm test', description: 'x' }),
      assistant('b', 'PowerShell', { command: 'Get-Date' }),
      assistant('c', 'Read', { command: 'not a shell', file_path: 'x' }),
    ).filter((event) => event.kind === 'tool.input');
    expect(out.map((event) => event.command)).toEqual(['pnpm test', 'Get-Date', undefined]);
  });

  it('Ask and Plan say what they refused, however it was refused', () => {
    for (const [mode, reason] of [
      ['ask', 'No such tool available: Bash'],
      ['plan', 'This chat is in plan mode, which is read only.'],
    ]) {
      const blocked = events(
        mode,
        assistant('a', 'Bash', { command: 'pnpm test' }),
        failed('a', reason),
      ).filter((event) => event.kind === 'tool.blocked');
      expect(blocked).toEqual([
        { kind: 'tool.blocked', toolUseId: 'a', name: 'Bash', command: 'pnpm test', mode },
      ]);
      expect(turnEventSchema.safeParse(blocked[0]).success).toBe(true);
    }
    const other = events('ask', assistant('b', 'mcp__other__change', {}), failed('b', 'read only'));
    expect(other.filter((event) => event.kind === 'tool.blocked')).toHaveLength(1);
  });

  it('a failed read is not a refusal, Execute has no refusals, and the plan file is on purpose', () => {
    const none = [
      ...events('ask', assistant('a', 'Read', { file_path: 'x' }), failed('a', 'not found')),
      ...events('ask', assistant('b', 'mcp__hub__get_card', {}), failed('b', 'not found')),
      ...events('execute', assistant('c', 'Bash', { command: 'false' }), failed('c', 'Exit code 1')),
      ...events(
        'plan',
        assistant('d', 'Write', { file_path: 'C:/u/.claude/plans/x.md', content: 'p' }),
        failed('d', 'denied'),
      ),
    ];
    expect(none.filter((event) => event.kind === 'tool.blocked')).toEqual([]);
  });

  it('reads a question, and answers null for a shape it does not know', () => {
    expect(questionsFromInput({ questions: [{ question: 'Q?', options: [{ label: 'A' }] }] })).toEqual([
      { text: 'Q?', multiSelect: false, options: [{ label: 'A' }] },
    ]);
    expect(questionsFromInput({})).toBeNull();
    expect(questionsFromInput({ questions: [{ nope: 1 }] })).toBeNull();
  });

  it('mapLine: known events with their shape pass, and the rest name what is wrong', () => {
    const mapper = createEventMapper();
    expect(mapper.mapLine('{"type":"brand_new"}').unreadable).toBeUndefined();
    expect(mapper.mapLine('{"type":"assistant","message":{"content":[]}}').unreadable).toBeUndefined();
    expect(mapper.mapLine('not json').unreadable).toBeTruthy();
    expect(mapper.mapLine('[1,2]').unreadable).toBeUndefined();
    expect(mapper.mapLine('3').unreadable).toBeTruthy();
    expect(mapper.mapLine('{"type":"assistant"}').unreadable).toBeTruthy();
    expect(mapper.mapLine('{"type":"user"}').unreadable).toBeTruthy();
    expect(mapper.mapLine('{"type":"stream_event"}').unreadable).toBeTruthy();
    expect(mapper.mapLine('{"type":"result"}').unreadable).toBeTruthy();
  });

  it("the bridge's effect lines are the contract's, for every category", () => {
    expect(APPROVAL_EFFECTS).toEqual(CONTRACT_EFFECTS);
  });
});

describe('the event mapper', () => {
  const run = (...raws) => {
    const mapper = createEventMapper();
    const out = raws.map((raw) => mapper.map(raw));
    return { events: out.flatMap((item) => item.events), result: out.at(-1)?.result, mapper };
  };

  it('only ever answers shapes the contract knows', () => {
    const { events } = run(
      { type: 'system', subtype: 'init', session_id: 's', model: 'm', claude_code_version: '2.1.318' },
      { type: 'system', subtype: 'status', status: 'requesting' },
      { type: 'system', subtype: 'api_retry', attempt: 2, retry_delay_ms: 500 },
      { type: 'system', subtype: 'hook_started' },
      { type: 'stream_event', event: { type: 'message_start', message: { id: 'a' } } },
      { type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'thinking' } } },
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
      },
      {
        type: 'stream_event',
        event: { type: 'content_block_start', content_block: { type: 'tool_use', id: 't', name: 'Read' } },
      },
      {
        type: 'assistant',
        message: { id: 'a', content: [{ type: 'tool_use', id: 't', name: 'Read', input: { x: 1 } }] },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 't',
              is_error: false,
              content: [{ type: 'text', text: 'ok' }],
            },
          ],
        },
        tool_result_meta: [{ tool_use_id: 't', permission_decision: 'config' }],
      },
      {
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'allowed',
          rateLimitType: 'seven_day',
          resetsAt: 5,
          unifiedWindows: { seven_day: { utilization: 0.4 } },
        },
      },
      { type: 'something_new_in_a_later_version', event: {} },
    );
    for (const event of events) expect(turnEventSchema.safeParse(event).success).toBe(true);
    expect(new Set(events.map((event) => event.kind))).toEqual(
      new Set([
        'turn.session',
        'turn.status',
        'text.delta',
        'tool.started',
        'tool.input',
        'tool.result',
        'limit',
      ]),
    );
    expect(events.find((event) => event.kind === 'tool.result').decision).toBe('config');
    expect(events.find((event) => event.kind === 'limit').limit.utilization).toBe(0.4);
    for (const kind of events.map((event) => event.kind)) expect(TURN_EVENT_KINDS).toContain(kind);
  });

  it('does not repeat text that already arrived as deltas', () => {
    const { events } = run(
      { type: 'stream_event', event: { type: 'message_start', message: { id: 'a' } } },
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } },
      },
      { type: 'assistant', message: { id: 'a', content: [{ type: 'text', text: 'hi' }] } },
    );
    expect(events.filter((event) => event.kind === 'text.delta')).toHaveLength(1);
  });

  it('keeps a subagent’s words out of the reply, and links its tools to the parent', () => {
    const { events } = run(
      {
        type: 'stream_event',
        parent_tool_use_id: 'p',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'inner' } },
      },
      {
        type: 'assistant',
        parent_tool_use_id: 'p',
        message: { id: 'b', content: [{ type: 'tool_use', id: 't2', name: 'Read', input: {} }] },
      },
    );
    expect(events.some((event) => event.kind === 'text.delta')).toBe(false);
    expect(events[0]).toMatchObject({ kind: 'tool.started', parentToolUseId: 'p' });
  });

  it('turns report_stage into a stage, whichever name the server has', () => {
    expect(isStageTool('mcp__hub__report_stage')).toBe(true);
    expect(isStageTool('mcp__plugin_hub_hub__report_stage')).toBe(true);
    expect(isStageTool('Bash')).toBe(false);
    const { events } = run({
      type: 'assistant',
      message: {
        id: 'c',
        content: [
          {
            type: 'tool_use',
            id: 't',
            name: 'mcp__hub__report_stage',
            input: { protocol: 'work', stage: 'verify', state: 'failed', note: 'tests red' },
          },
        ],
      },
    });
    expect(events.at(-1)).toEqual({
      kind: 'stage',
      protocol: 'work',
      stage: 'verify',
      state: 'failed',
      note: 'tests red',
    });
  });

  it('takes the plan from ExitPlanMode, or from the plan file Plan mode refuses to write', () => {
    const say = (name, input) => ({
      type: 'assistant',
      message: { id: 'p', content: [{ type: 'tool_use', id: name, name, input }] },
    });
    const plans = (...raws) => run(...raws).events.filter((event) => event.kind === 'plan.proposed');
    expect(plans(say('ExitPlanMode', { plan: 'A' }))[0].plan).toBe('A');
    const file = 'C:\\Users\\x\\.claude\\plans\\some-plan.md';
    expect(plans(say('Write', { file_path: file, content: 'B' }))[0].plan).toBe('B');
    expect(plans(say('Write', { file_path: 'C:\\repo\\a.md', content: 'C' }))).toEqual([]);
    expect(
      plans(say('Write', { file_path: file, content: 'B' }), say('ExitPlanMode', { plan: 'A' })),
    ).toHaveLength(1);
  });

  it('never reports cost or num_turns: they are not per-turn facts (S1)', () => {
    const { result } = run({
      type: 'result',
      is_error: false,
      total_cost_usd: 1,
      num_turns: 17,
      duration_ms: 9,
      usage: { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 5 },
      modelUsage: { 'claude-haiku': {} },
    });
    expect(JSON.stringify(result)).not.toMatch(/cost|num_turns/);
    expect(result).toMatchObject({
      ok: true,
      model: 'claude-haiku',
      usage: { inputTokens: 3, outputTokens: 4, cacheReadTokens: 5 },
    });
  });
});

describe('the D41 lists', () => {
  it('names every category the owner chose, for both shells', () => {
    const rules = askRules();
    for (const rule of [
      'Bash(rm *)',
      'Bash(rmdir *)',
      'Bash(mv *)',
      'Bash(git rm *)',
      'Bash(git clean *)',
      'Bash(git commit *)',
      'Bash(git push *)',
      'Bash(psync *)',
      'Bash(git branch *)',
      'Bash(git switch *)',
      'Bash(git checkout *)',
      'Bash(git worktree *)',
      'Bash(docker *)',
      'PowerShell(Remove-Item *)',
      'PowerShell(Move-Item *)',
      'PowerShell(git *)',
      'PowerShell(docker *)',
      'PowerShell(psync *)',
      'mcp__hub__update_project',
      'mcp__hub__save_doc',
    ]) {
      expect(rules).toContain(rule);
    }
  });

  it('every sensitive Hub tool pauses: the bridge’s list is the table’s', () => {
    const destructive = MCP_TOOLS.filter((tool) => tool.destructive).map((tool) => tool.name);
    expect([...HUB_ASK_TOOLS].sort()).toEqual([...destructive].sort());
  });

  it('the read list is the table’s read rows', () => {
    const reads = MCP_TOOLS.filter((tool) => tool.readOnly).map((tool) => tool.name);
    expect([...HUB_READ_TOOLS].sort()).toEqual([...reads].sort());
  });

  it('Execute loads no deny and no broad allow beyond Hub', () => {
    const { permissions } = executeSettings();
    expect(permissions.allow).toEqual(['mcp__hub']);
    expect(permissions.deny).toBeUndefined();
  });

  it('Ask and Plan deny every writing tool, and every Hub tool that writes', () => {
    const { permissions } = readOnlySettings();
    for (const tool of ['Write', 'Edit', 'NotebookEdit', 'Bash', 'PowerShell']) {
      expect(permissions.deny).toContain(tool);
    }
    for (const tool of MCP_TOOLS) {
      const rule = `mcp__hub__${tool.name}`;
      if (tool.readOnly) expect(permissions.deny).not.toContain(rule);
      else expect(permissions.deny).toContain(rule);
    }
  });

  it('names what a paused call is, and shows the exact command', () => {
    const cases = [
      ['git push origin main', 'push'],
      ['git -C . push origin main', 'push'],
      ['git commit -m x', 'commit'],
      ['git checkout -b x', 'branch'],
      ['git worktree add ../w', 'worktree'],
      ['docker ps', 'docker'],
      ['psync up', 'deploy'],
      ['rm x', 'delete'],
      ['ls && rm x', 'delete'],
      ['mv a b', 'move'],
      ['./unknown.sh', 'other'],
    ];
    for (const [command, category] of cases) {
      expect([command, categoryOf('Bash', { command })]).toEqual([command, category]);
    }
    expect(categoryOf('mcp__hub__update_project', {})).toBe('hub_project');
    expect(categoryOf('mcp__hub__save_doc', {})).toBe('hub_doc');
    expect(categoryOf('mcp__hub__delete_card', {})).toBe('hub_sensitive');
    expect(describeCall('Bash', { command: 'rm -rf "a b"' })).toBe('rm -rf "a b"');
  });
});

describe('the read-only guard', () => {
  it('lets only Hub read tools and the permission tool through', () => {
    expect(isReadOnlyMcpTool('mcp__hub__get_doc')).toBe(true);
    expect(isReadOnlyMcpTool('mcp__hubperm__approve')).toBe(true);
    expect(isReadOnlyMcpTool('mcp__hub__update_project')).toBe(false);
    expect(isReadOnlyMcpTool('mcp__hub__create_task')).toBe(false);
    expect(isReadOnlyMcpTool('mcp__other__change')).toBe(false);
    expect(isReadOnlyMcpTool('mcp__other__get_doc')).toBe(false);
  });

  it('is on the read-only settings when asked for', () => {
    const { hooks } = readOnlySettings('guard');
    expect(hooks.PreToolUse[0]).toEqual({
      matcher: 'mcp__.*',
      hooks: [{ type: 'command', command: 'guard' }],
    });
  });

  const run = (input) =>
    spawnSync(process.execPath, [join(import.meta.dirname, '..', 'bin', 'hub-read-only-guard.mjs')], {
      input,
      encoding: 'utf8',
    });

  it('refuses another server’s tool, allows a read, and refuses what it cannot read', () => {
    const refused = run(JSON.stringify({ tool_name: 'mcp__other__change' }));
    expect(JSON.parse(refused.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
    const allowed = run(JSON.stringify({ tool_name: 'mcp__hub__get_doc' }));
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toBe('');
    expect(run('not json').status).toBe(2);
  });
});

describe('no credential is ever read', () => {
  it('no file of the bridge names the credentials file in code', () => {
    const lib = join(import.meta.dirname, '..', 'lib');
    const bin = join(import.meta.dirname, '..', 'bin');
    for (const [folder, name] of [
      ...readdirSync(lib).map((entry) => [lib, entry]),
      ...readdirSync(bin).map((entry) => [bin, entry]),
    ]) {
      const code = readFileSync(join(folder, name), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n');
      expect([name, code.includes('.credentials.json')]).toEqual([name, false]);
    }
  });
});

describe('the bridge log', () => {
  it('rotates at the limit, keeps one old file, and never grows past twice the limit', () => {
    const system = fakeSystem();
    const file = join(system.home, 'logs', 'bridge.log');
    const log = createLog(file, { limitBytes: 1000 });
    for (let index = 0; index < 500; index += 1) log(`line ${index} ${'x'.repeat(50)}`);
    expect(statSync(file).size).toBeLessThanOrEqual(1100);
    expect(statSync(`${file}.1`).size).toBeLessThanOrEqual(1100);
    expect(readdirSync(join(system.home, 'logs')).sort()).toEqual(['bridge.log', 'bridge.log.1']);
    expect(readFileSync(file, 'utf8')).toContain('line 499');
  });

  it('cuts one enormous line, and the default limit is small', () => {
    const system = fakeSystem();
    const file = join(system.home, 'bridge.log');
    createLog(file)('y'.repeat(1_000_000));
    expect(statSync(file).size).toBeLessThan(MAX_LINE_CHARS + 100);
    expect(LOG_LIMIT_BYTES).toBeLessThanOrEqual(2_000_000);
  });

  it('a log that cannot write does not throw', () => {
    const system = fakeSystem();
    writeFileSync(join(system.home, 'blocked'), 'file, not a folder');
    expect(() => createLog(join(system.home, 'blocked', 'x', 'bridge.log'))('line')).not.toThrow();
  });
});

describe('Git facts', () => {
  const entry = (status, additions, deletions) => ({ status, additions, deletions });

  it('counts only what moved during the turn', () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    const before = new Map([['old.ts', entry('M', 1, 1)]]);
    const after = new Map([
      ['old.ts', entry('M', 1, 1)],
      ['new.ts', entry('M', 4, 2)],
    ]);
    expect(changedFiles(folder, before, after, new Set(), 10)).toEqual([
      { path: 'new.ts', source: 'git', status: 'M', additions: 4, deletions: 2 },
    ]);
  });

  it('marks what a step named, and counts an untracked file by its lines', () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    writeFileSync(join(folder, 'fresh.md'), 'a\nb\n');
    const after = new Map([['fresh.md', entry('??')]]);
    expect(changedFiles(folder, new Map(), after, new Set([join(folder, 'fresh.md')]), 10)).toEqual([
      { path: 'fresh.md', source: 'tool', status: '??', additions: 2, deletions: 0 },
    ]);
  });

  it('with no repository it names the files and invents no counts, and it is bounded', () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    expect(changedFiles(folder, null, null, new Set(['a.md']), 10)).toEqual([
      { path: 'a.md', source: 'tool' },
    ]);
    expect(changedFiles(folder, null, null, new Set(['a', 'b', 'c']), 2)).toHaveLength(2);
    expect(changedFiles(folder, null, null, new Set(['../outside']), 2)).toEqual([]);
  });

  it('a diff refuses a path that leaves the folder, with no program run', async () => {
    const system = fakeSystem();
    const folder = aFolder(system);
    for (const path of ['../x', 'a/../../x', 'C:\\x', '/etc/passwd', 'a\0b']) {
      expect((await diffOf(system, folder, path, 100)).available).toBe(false);
    }
    expect(system.calls).toEqual([]);
  });
});

describe('writing a doc on this device', () => {
  const sha = (text) => createHash('sha256').update(text).digest('hex');
  function world() {
    const system = fakeSystem();
    const root = aFolder(system, 'docs root');
    const context = { system, docRoots: () => [root] };
    return { system, root, context };
  }

  it('reads, writes on a matching base, and refuses a stale one', () => {
    const { root, context } = world();
    writeFileSync(join(root, 'a.md'), 'one');
    expect(docHandlers['doc.read']({ root, path: 'a.md' }, context)).toEqual({
      exists: true,
      text: 'one',
      hash: sha('one'),
    });
    const stale = docHandlers['doc.write']({ root, path: 'a.md', text: 'x', baseHash: sha('old') }, context);
    expect(stale).toEqual({ outcome: 'stale', hash: sha('one') });
    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('one');
    const written = docHandlers['doc.write'](
      { root, path: 'a.md', text: 'two', baseHash: sha('one') },
      context,
    );
    expect(written).toEqual({ outcome: 'written', hash: sha('two') });
    expect(readFileSync(join(root, 'a.md'), 'utf8')).toBe('two');
    expect(readdirSync(root)).toEqual(['a.md']);
  });

  it('a new file needs no base, and refuses when one appeared meanwhile', () => {
    const { root, context } = world();
    expect(docHandlers['doc.write']({ root, path: 'd/new.md', text: 'n' }, context).outcome).toBe('written');
    expect(docHandlers['doc.write']({ root, path: 'd/new.md', text: 'm' }, context).outcome).toBe('stale');
  });

  it('refuses a root not registered, a path that leaves, and anything not Markdown', () => {
    const { system, root, context } = world();
    const outside = aFolder(system, 'outside');
    const code = (args) => {
      try {
        docHandlers['doc.write']({ text: 'x', ...args }, context);
        return 'wrote';
      } catch (error) {
        return error.code;
      }
    };
    expect(code({ root: outside, path: 'a.md' })).toBe('folder_not_allowed');
    expect(code({ root, path: '../outside/a.md' })).toBe('folder_not_allowed');
    expect(code({ root, path: 'a/../../outside/a.md' })).toBe('folder_not_allowed');
    expect(code({ root, path: join(outside, 'a.md') })).toBe('bad_arguments');
    expect(code({ root, path: 'run.exe' })).toBe('bad_arguments');
    expect(existsSync(join(outside, 'a.md'))).toBe(false);
  });

  it('a link inside the root cannot lead out of it', () => {
    const { system, root, context } = world();
    const outside = aFolder(system, 'elsewhere');
    mkdirSync(join(root, 'in'));
    symlinkSync(outside, join(root, 'in', 'out'), 'junction');
    expect(() => docHandlers['doc.write']({ root, path: 'in/out/a.md', text: 'x' }, context)).toThrow();
    expect(existsSync(join(outside, 'a.md'))).toBe(false);
  });
});
