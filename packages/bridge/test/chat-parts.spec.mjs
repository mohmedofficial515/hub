/**
 * @file The chat engine's small parts: the raw event mapper, the D41 lists against Hub's tool table, the log's bound, Git's facts and writing a doc on this device.
 */
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

import { MCP_TOOLS, TURN_EVENT_KINDS, turnEventSchema } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import { createEventMapper, isStageTool } from '../lib/claude-events.mjs';
import { docHandlers } from '../lib/doc-files.mjs';
import { changedFiles, diffOf } from '../lib/git-facts.mjs';
import { createLog, LOG_LIMIT_BYTES, MAX_LINE_CHARS } from '../lib/log.mjs';
import {
  askRules,
  categoryOf,
  describeCall,
  executeSettings,
  HUB_ASK_TOOLS,
  HUB_READ_TOOLS,
  readOnlySettings,
} from '../lib/permissions.mjs';
import { aFolder, fakeSystem } from './helpers.mjs';

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
