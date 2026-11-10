/**
 * @file thread-items.spec.ts
 * @description The panel's thread, built from real message shapes: where steps, pauses and results fall, and what state a chat reads as.
 */
import type { ChatApprovalDto, ChatDocDraftDto, ChatMessageDto, ChatStepDto } from '@hub/contracts';
import { describe, expect, it } from 'vitest';

import {
  chatStatusOf,
  claimsWith,
  conflictLines,
  draftLines,
  draftPreview,
  engineBlocks,
  engineStateOf,
  followTargetOf,
  itemsOf,
  lastEditAt,
  parseUnifiedDiff,
  startingReasonOf,
  toolCallOf,
} from './thread-items';

const AT = '2026-11-06T10:00:00.000Z';

const message = (over: Partial<ChatMessageDto>): ChatMessageDto => ({
  id: 'm2',
  ordinal: 2,
  role: 'assistant',
  content: '',
  truncated: false,
  context: null,
  status: 'running',
  failure: null,
  failureMessage: null,
  model: null,
  claudeVersion: null,
  durationMs: null,
  usage: null,
  limit: null,
  stages: [],
  plan: null,
  structuredPlan: null,
  idea: null,
  suggestions: null,
  changedFiles: [],
  steps: [],
  approvals: [],
  questions: [],
  reports: [],
  docDrafts: [],
  notices: [],
  engineFacts: null,
  createdAt: AT,
  endedAt: null,
  ...over,
});

const step = (over: Partial<ChatStepDto>): ChatStepDto => ({
  id: 's1',
  toolUseId: 't1',
  parentToolUseId: null,
  name: 'Bash',
  status: 'done',
  input: { command: 'pnpm test' },
  command: 'pnpm test',
  output: 'ok',
  decision: null,
  textOffset: 0,
  startedAt: AT,
  endedAt: '2026-11-06T10:00:02.000Z',
  ...over,
});

const approval = (over: Partial<ChatApprovalDto>): ChatApprovalDto => ({
  id: 'a1',
  messageId: 'm2',
  toolUseId: 't1',
  toolName: 'Bash',
  command: 'git push',
  category: 'push',
  input: {},
  effect: 'Pushes to a remote',
  status: 'pending',
  draftId: null,
  expiresAt: AT,
  answeredAt: null,
  createdAt: AT,
  ...over,
});

const draft = (over: Partial<ChatDocDraftDto>): ChatDocDraftDto => ({
  id: 'd1',
  docKey: 'GTV-1',
  source: null,
  path: 'docs/a.md',
  title: 'A',
  reason: 'why',
  baseVersion: 'v1',
  baseText: 'one\ntwo',
  draft: 'one\nClaim here\ntwo',
  duplicates: [],
  claims: [{ id: 'c1', text: 'Claim here', status: 'unverified', source: null, answer: null }],
  status: 'open',
  refusedCode: null,
  savedVersion: null,
  revisionId: null,
  conflict: null,
  createdAt: AT,
  updatedAt: AT,
  ...over,
});

const kinds = (messages: ChatMessageDto[]) => itemsOf({ messages }).map((item) => item.kind);

describe('itemsOf', () => {
  it('splits the words where a step ran, by its textOffset', () => {
    const items = itemsOf({
      messages: [message({ content: 'Before. After.', steps: [step({ textOffset: 8 })] })],
    });
    expect(items.map((item) => item.kind)).toEqual(['text', 'tools', 'text']);
    expect(items[0]).toMatchObject({ text: 'Before. ' });
    expect(items[2]).toMatchObject({ text: 'After.' });
  });

  it('keeps steps with no words between them in one fold', () => {
    const items = itemsOf({
      messages: [message({ steps: [step({}), step({ id: 's2', toolUseId: 't2' })] })],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'tools' });
  });

  it('puts an approval right after the step it holds', () => {
    expect(
      kinds([
        message({
          content: 'Pushing.',
          steps: [step({ status: 'waiting', textOffset: 8 })],
          approvals: [approval({})],
        }),
      ]),
    ).toEqual(['text', 'tools', 'approval']);
  });

  it('shows a save_doc pause as the draft, not as an approval of its own', () => {
    const items = itemsOf({
      messages: [
        message({
          steps: [step({ status: 'waiting', name: 'mcp__hub__save_doc' })],
          approvals: [approval({ draftId: 'd1', category: 'hub_doc' })],
          docDrafts: [draft({})],
        }),
      ],
    });
    expect(items.map((item) => item.kind)).toEqual(['tools', 'draft']);
    expect(items[1]).toMatchObject({ save: { id: 'a1' } });
  });

  it('a draft whose save has been answered has no Save left', () => {
    const items = itemsOf({
      messages: [
        message({ approvals: [approval({ draftId: 'd1', status: 'denied' })], docDrafts: [draft({})] }),
      ],
    });
    expect(items[0]).toMatchObject({ kind: 'draft', save: null });
  });

  it('adds the saved card only when the draft was saved on a real doc', () => {
    expect(kinds([message({ docDrafts: [draft({ status: 'saved' })] })])).toEqual(['draft', 'saved']);
    expect(kinds([message({ docDrafts: [draft({ status: 'saved', docKey: null })] })])).toEqual(['draft']);
  });

  it('a turn line appears only once a turn has ended', () => {
    expect(kinds([message({ content: 'x' })])).toEqual(['text']);
    expect(kinds([message({ content: 'x', status: 'done' })])).toEqual(['text', 'turn']);
  });

  it('leaves out of the turn line what the engine did not report', () => {
    const items = itemsOf({ messages: [message({ status: 'done' })] });
    const meta = (items[0] as { meta: object }).meta;
    expect(meta).not.toHaveProperty('usage');
    expect(meta).not.toHaveProperty('ms');
    expect(meta).not.toHaveProperty('model');
  });

  it('shows the card a create step made, from what Hub answered', () => {
    const items = itemsOf({
      messages: [
        message({
          steps: [
            step({ name: 'mcp__hub__create_task', output: '{"key":"GTV-42"}', command: null, input: {} }),
          ],
        }),
      ],
    });
    expect(items[1]).toMatchObject({ kind: 'card', cardKey: 'GTV-42' });
  });

  it('a failed create step shows no card', () => {
    expect(
      kinds([
        message({ steps: [step({ name: 'mcp__hub__create_task', status: 'error', output: 'GTV-42' })] }),
      ]),
    ).toEqual(['tools']);
  });

  it('a stage that started in a running turn runs, and goes back to pending when the turn ended without it', () => {
    const stages = [{ protocol: 'work' as const, stage: 'understand', state: 'started' as const, at: AT }];
    const running = itemsOf({ messages: [message({ stages })] })[0] as { stages: { state: string }[] };
    expect(running.stages[0]?.state).toBe('running');
    const ended = itemsOf({ messages: [message({ stages, status: 'done' })] })[0] as {
      stages: { state: string }[];
    };
    expect(ended.stages[0]?.state).toBe('pending');
  });

  it('names the card the protocol works on, from what the owner sent', () => {
    const items = itemsOf({
      messages: [
        message({ id: 'm1', role: 'user', status: null, content: '/hub:work GTV-7' }),
        message({ stages: [{ protocol: 'work', stage: 'plan', state: 'done', at: AT }] }),
      ],
    });
    expect(items[1]).toMatchObject({ kind: 'protocol', target: 'GTV-7' });
  });

  it('a blocked tool and a refused report are their own items', () => {
    expect(
      kinds([
        message({
          notices: [
            { kind: 'tool.blocked', toolUseId: 't', name: 'Bash', command: 'ls', mode: 'ask', at: AT },
            { kind: 'report.refused', cardKey: 'GTV-1', checks: [], at: AT },
            { kind: 'turn.starting', reason: 'new', at: AT },
          ],
        }),
      ]),
    ).toEqual(['blocked', 'refused']);
  });

  it('says who ended a pause', () => {
    const items = itemsOf({
      messages: [
        message({
          status: 'interrupted',
          failure: 'device_offline',
          steps: [step({ status: 'cut_off' })],
          approvals: [approval({ status: 'stopped' })],
        }),
      ],
    });
    expect(items.find((item) => item.kind === 'approval')).toMatchObject({ stoppedBy: 'bridge' });
  });
});

describe('toolCallOf', () => {
  it('puts a failed step in error, and a denied one as denied', () => {
    expect(toolCallOf(step({ status: 'error', output: 'boom' }))).toMatchObject({
      state: 'failed',
      error: 'boom',
    });
    expect(toolCallOf(step({ status: 'error', decision: 'user_reject' })).state).toBe('denied');
  });

  it('counts the duration only with an end', () => {
    expect(toolCallOf(step({})).ms).toBe(2000);
    expect(toolCallOf(step({ endedAt: null, status: 'running' }))).not.toHaveProperty('ms');
  });
});

describe('chatStatusOf', () => {
  const run = (over: Partial<ChatMessageDto>, now: Parameters<typeof chatStatusOf>[1] = null) =>
    chatStatusOf({ messages: [message(over)] }, now);

  it('reads an idle and a stopped chat', () => {
    expect(chatStatusOf({ messages: [] }, null)).toBe('idle');
    expect(run({ status: 'done' })).toBe('idle');
    expect(run({ status: 'stopped' })).toBe('stopped');
  });

  it('a pause wins over everything', () => {
    expect(run({ approvals: [approval({})], content: 'x' }, { state: 'retrying', at: AT })).toBe('waiting');
  });

  it('starting until the engine has said anything', () => {
    expect(run({})).toBe('starting');
    expect(run({ claudeVersion: '2.1.318' })).toBe('thinking');
    expect(run({ content: 'hello' })).toBe('streaming');
    expect(run({ steps: [step({ status: 'running' })] })).toBe('tool');
    expect(run({ claudeVersion: '2', content: 'x' }, { state: 'retrying', at: AT })).toBe('retrying');
  });
});

describe('startingReasonOf', () => {
  it('reads the last notice', () => {
    expect(
      startingReasonOf({
        messages: [message({ notices: [{ kind: 'turn.starting', reason: 'mode', at: AT }] })],
      }),
    ).toBe('mode');
    expect(startingReasonOf({ messages: [] })).toBeNull();
  });
});

describe('engineStateOf', () => {
  const honest = (
    kind: Parameters<typeof engineStateOf>[0]['kind'],
    composer = false,
    warning: Parameters<typeof engineStateOf>[0]['warning'] = null,
  ) => ({ kind, composer, warning });

  it.each([
    ['offline', 'offline'],
    ['revoked', 'revoked'],
    ['claude_missing', 'claude_missing'],
    ['signed_out', 'signed_out'],
    ['too_old', 'version_old'],
  ] as const)('%s reads as %s', (kind, state) => {
    expect(engineStateOf(honest(kind), null)).toBe(state);
  });

  it('a limit with no reset time lets a send try', () => {
    expect(engineStateOf(honest('limit'), 'rate_limited')).toBe('limit');
    expect(engineStateOf(honest('limit', true), 'rate_limited')).toBe('limit_open');
  });

  it('a last-turn failure shows and leaves the composer open', () => {
    expect(engineStateOf(honest('ok', true), 'billing')).toBe('billing');
    expect(engineBlocks('billing')).toBe(false);
    expect(engineBlocks('offline')).toBe(true);
    expect(engineBlocks('no_folder')).toBe(true);
  });

  it('a newer version warns, and a cut-off turn is only its own line', () => {
    expect(
      engineStateOf(honest('ok', true, { code: 'newer_than_tested', version: '2', testedMax: '1' }), null),
    ).toBe('version_new');
    expect(engineStateOf(honest('ok', true), 'cut_off')).toBe('ok');
  });
});

describe('followTargetOf', () => {
  it('takes the last Hub step that named a card', () => {
    expect(
      followTargetOf(
        message({
          steps: [
            step({ name: 'mcp__hub__get_card', input: { key: 'GTV-1' } }),
            step({ name: 'mcp__hub__get_card', input: { card: 'GTV-2' } }),
            step({ name: 'Bash', input: { key: 'GTV-3' } }),
          ],
        }),
      ),
    ).toBe('GTV-2');
  });

  it('takes the card a create step just made, so a plan opens while it is written', () => {
    expect(
      followTargetOf(
        message({
          steps: [
            step({ name: 'mcp__hub__get_card', input: { key: 'GTV-1' } }),
            step({
              name: 'mcp__hub__create_plan',
              input: { title: 'X' },
              status: 'done',
              output: 'Saved GTV-9',
            }),
          ],
        }),
      ),
    ).toBe('GTV-9');
  });

  it('has nothing with no card named', () => {
    expect(followTargetOf(null)).toBeNull();
    expect(
      followTargetOf(message({ steps: [step({ name: 'mcp__hub__list_cards', input: {} })] })),
    ).toBeNull();
  });
});

describe('parseUnifiedDiff', () => {
  it('drops the file header and keeps hunks and signs', () => {
    const text = [
      'diff --git a/a b/a',
      '--- a/a',
      '+++ b/a',
      '@@ -1,2 +1,2 @@',
      ' same',
      '-old',
      '+new',
    ].join('\n');
    expect(parseUnifiedDiff(text)).toEqual([
      { t: 'hunk', text: '@@ -1,2 +1,2 @@' },
      { t: 'ctx', text: 'same' },
      { t: 'del', text: 'old' },
      { t: 'add', text: 'new' },
    ]);
  });
});

describe('drafts', () => {
  it('marks the line that holds an unverified claim', () => {
    const lines = draftLines(draft({}));
    expect(lines.find((line) => line.flag === 'c1')).toEqual({ t: 'add', text: 'Claim here', flag: 'c1' });
  });

  it('a new document is all added', () => {
    expect(draftLines(draft({ baseText: null, draft: 'a', claims: [] }))).toEqual([{ t: 'add', text: 'a' }]);
  });

  it('previews what Save writes with the local answers', () => {
    expect(draftPreview(draft({}), { c1: 'remove' })).toBe('one\ntwo');
    expect(draftPreview(draft({}), { c1: 'keep_flagged' })).toContain('> Unverified: Claim here');
  });

  it('a local answer goes over the server’s, which stands otherwise', () => {
    const withServer = draft({
      claims: [{ id: 'c1', text: 'Claim', status: 'unverified', source: null, answer: 'confirm' }],
    });
    expect(claimsWith(withServer, {})[0]?.answer).toBe('confirm');
    expect(claimsWith(withServer, { c1: 'remove' })[0]?.answer).toBe('remove');
  });

  it('shows what moved under a stale draft', () => {
    const lines = conflictLines(draft({ conflict: { version: 'v2', text: 'one\nthree' } }));
    expect(lines).toContainEqual({ t: 'add', text: 'three' });
    expect(lines).toContainEqual({ t: 'del', text: 'two' });
    expect(conflictLines(draft({}))).toEqual([]);
  });
});

describe('lastEditAt', () => {
  it('finds the last Edit or Write across the chat', () => {
    expect(
      lastEditAt({
        messages: [
          message({
            steps: [
              step({ name: 'Edit', startedAt: '2026-11-06T10:00:01.000Z' }),
              step({ name: 'Write', startedAt: '2026-11-06T10:00:05.000Z' }),
              step({ name: 'Bash', startedAt: '2026-11-06T10:00:09.000Z' }),
            ],
          }),
        ],
      }),
    ).toBe('2026-11-06T10:00:05.000Z');
  });
});
