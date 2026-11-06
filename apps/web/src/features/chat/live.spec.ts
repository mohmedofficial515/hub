/**
 * @file The chat's cached copy under the live stream: order, gaps, approvals, the checklist, and that every suggestion has words in both languages.
 */
import {
  CHAT_SUGGESTION_IDS,
  type ChatFullDto,
  type ChatLiveEvent,
  type ChatMessageDto,
  CHECK_BASES,
  REPORT_MOVE_REASONS,
  START_REASONS,
  TURN_FAILURES,
  type TurnEvent,
} from '@hub/contracts';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar/chat.json';
import en from '../../../messages/en/chat.json';
import {
  applyChatLive,
  chatKeys,
  checklistOf,
  draftOfApproval,
  honestStateOf,
  pendingApprovals,
  pendingQuestions,
  reduceChat,
  runningMessage,
} from './live';

const message: ChatMessageDto = {
  id: 'm1',
  ordinal: 1,
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
  engineFacts: null,
  changedFiles: [],
  steps: [],
  approvals: [],
  questions: [],
  reports: [],
  docDrafts: [],
  notices: [],
  createdAt: '2026-11-06T00:00:00Z',
  endedAt: null,
};

const chat: ChatFullDto = {
  id: 'c1',
  deviceId: 'd',
  deviceName: 'PC',
  deviceOnline: true,
  deviceRevoked: false,
  folder: 'C:/x',
  branch: null,
  mode: 'execute',
  model: null,
  effort: null,
  sessionId: null,
  title: 'T',
  pinned: false,
  parentChatId: null,
  parentMessageId: null,
  running: true,
  lastSeq: 5,
  createdAt: '2026-11-06T00:00:00Z',
  updatedAt: '2026-11-06T00:00:00Z',
  deletedAt: null,
  messages: [message],
};

const live = (seq: number, event: TurnEvent): ChatLiveEvent => ({
  chatId: 'c1',
  messageId: 'm1',
  seq,
  event,
});

function play(...events: TurnEvent[]): ChatFullDto {
  let copy = chat;
  events.forEach((event, index) => {
    const next = reduceChat(copy, live(chat.lastSeq + index + 1, event));
    if (!next) throw new Error('gap');
    copy = next;
  });
  return copy;
}

describe('reduceChat', () => {
  it('appends text in order, and takes the session from the engine', () => {
    const copy = play(
      { kind: 'turn.session', sessionId: 's1', model: 'haiku', branch: 'main' },
      { kind: 'text.delta', text: 'one ' },
      { kind: 'text.delta', text: 'two' },
    );
    expect(copy.messages[0]?.content).toBe('one two');
    expect(copy).toMatchObject({ sessionId: 's1', branch: 'main', lastSeq: 8 });
    expect(copy.messages[0]?.model).toBe('haiku');
  });

  it('takes the engine’s skills and servers from the session, and says nothing when it did not', () => {
    const copy = play({ kind: 'turn.session', sessionId: 's1', skills: ['hub:work'], mcpServers: ['hub'] });
    expect(copy.messages[0]?.engineFacts).toEqual({ skills: ['hub:work'], mcpServers: ['hub'] });
    const onlyServers = play({ kind: 'turn.session', sessionId: 's1', mcpServers: ['hub'] });
    expect(onlyServers.messages[0]?.engineFacts).toEqual({ skills: [], mcpServers: ['hub'] });
    expect(play({ kind: 'turn.session', sessionId: 's1' }).messages[0]?.engineFacts).toBeNull();
  });

  it('an old event changes nothing: it is already in what was read', () => {
    expect(reduceChat(chat, live(5, { kind: 'text.delta', text: 'old' }))).toBe(chat);
    expect(reduceChat(chat, live(2, { kind: 'text.delta', text: 'old' }))).toBe(chat);
  });

  it('a gap, or an unknown message, answers null so the chat is read again', () => {
    expect(reduceChat(chat, live(7, { kind: 'text.delta', text: 'x' }))).toBeNull();
    expect(reduceChat(chat, { ...live(6, { kind: 'text.delta', text: 'x' }), messageId: 'nope' })).toBeNull();
  });

  it('follows a tool step and a paused call', () => {
    const paused = play(
      { kind: 'text.delta', text: 'before ' },
      { kind: 'tool.started', toolUseId: 't', name: 'Bash' },
      { kind: 'tool.input', toolUseId: 't', name: 'Bash', input: { command: 'rm x' } },
      {
        kind: 'approval.requested',
        approvalId: 'a',
        toolUseId: 't',
        toolName: 'Bash',
        command: 'rm x',
        category: 'delete',
        input: { command: 'rm x' },
        effect: 'Deletes files',
        expiresAt: '2030-01-01T00:00:00Z',
      },
    );
    expect(paused.messages[0]?.approvals[0]?.effect).toBe('Deletes files');
    expect(paused.messages[0]?.steps[0]).toMatchObject({
      status: 'waiting',
      textOffset: 7,
      input: { command: 'rm x' },
    });
    expect(pendingApprovals(paused).map((item) => item.command)).toEqual(['rm x']);
    const answered = reduceChat(paused, {
      ...live(paused.lastSeq + 1, { kind: 'approval.resolved', approvalId: 'a', status: 'denied' }),
    });
    expect(answered && pendingApprovals(answered)).toEqual([]);
    expect(answered?.messages[0]?.steps[0]?.status).toBe('running');
  });

  it('an ended turn stops running, and closes what was left open', () => {
    const copy = play(
      { kind: 'tool.started', toolUseId: 't', name: 'Bash' },
      {
        kind: 'turn.ended',
        status: 'failed',
        failure: 'signed_out',
        message: 'Not logged in',
        durationMs: 9,
      },
    );
    expect(copy.running).toBe(false);
    expect(runningMessage(copy)).toBeNull();
    expect(copy.messages[0]).toMatchObject({
      status: 'failed',
      failure: 'signed_out',
      durationMs: 9,
    });
    expect(copy.messages[0]?.steps[0]?.status).toBe('cut_off');
  });
});

describe('applyChatLive', () => {
  it('patches the cached chat, and rereads on a gap', async () => {
    const client = new QueryClient();
    const key = chatKeys.one('ws', 'c1');
    client.setQueryData(key, chat);
    applyChatLive(client, 'ws', live(6, { kind: 'text.delta', text: 'hi' }));
    expect(client.getQueryData<ChatFullDto>(key)?.messages[0]?.content).toBe('hi');
    applyChatLive(client, 'ws', live(9, { kind: 'text.delta', text: 'x' }));
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it('a chat nobody has open is left alone', () => {
    const client = new QueryClient();
    applyChatLive(client, 'ws', live(6, { kind: 'text.delta', text: 'hi' }));
    expect(client.getQueryData(chatKeys.one('ws', 'c1'))).toBeUndefined();
  });
});

describe('checklistOf', () => {
  it('shows every stage in order, each in its latest state', () => {
    const copy = play(
      { kind: 'stage', protocol: 'work', stage: 'understand', state: 'started' },
      { kind: 'stage', protocol: 'work', stage: 'understand', state: 'done' },
      { kind: 'stage', protocol: 'work', stage: 'verify', state: 'failed', note: 'tests red' },
    );
    expect(checklistOf(copy.messages[0]!)).toEqual({
      protocol: 'work',
      rows: [
        { stage: 'understand', state: 'done' },
        { stage: 'plan', state: 'waiting' },
        { stage: 'execute', state: 'waiting' },
        { stage: 'verify', state: 'failed', note: 'tests red' },
        { stage: 'report', state: 'waiting' },
      ],
    });
  });

  it('a turn with no protocol has no checklist', () => {
    expect(checklistOf(message)).toBeNull();
  });
});

describe('structured results in the cache', () => {
  const DRAFT = {
    id: 'draft-1',
    docKey: 'D-1',
    source: 'docs',
    path: 'a.md',
    title: 'A',
    reason: 'Why',
    baseVersion: 'v1',
    baseText: 'old',
    draft: 'new',
    duplicates: [],
    claims: [],
    status: 'open' as const,
    refusedCode: null,
    conflict: null,
    savedVersion: null,
    revisionId: null,
    createdAt: 'x',
    updatedAt: 'x',
  };

  it('a question pauses its step, and its end frees it', () => {
    const paused = play(
      { kind: 'tool.started', toolUseId: 'q', name: 'AskUserQuestion' },
      {
        kind: 'question.asked',
        questionId: 'q1',
        toolUseId: 'q',
        questions: [{ text: 'Which?', multiSelect: false, options: [{ label: 'A' }] }],
        expiresAt: 'x',
      },
    );
    expect(paused.messages[0]?.steps[0]?.status).toBe('waiting');
    expect(pendingQuestions(paused).map((item) => item.id)).toEqual(['q1']);
    expect(pendingApprovals(paused)).toEqual([]);
    const answered = reduceChat(
      paused,
      live(paused.lastSeq + 1, { kind: 'question.resolved', questionId: 'q1', status: 'answered' }),
    );
    expect(answered?.messages[0]?.questions[0]?.status).toBe('answered');
    expect(answered?.messages[0]?.steps[0]?.status).toBe('running');
    expect(pendingQuestions(answered!)).toEqual([]);
  });

  it('a question nobody answered ends with the turn', () => {
    const copy = play(
      { kind: 'question.asked', questionId: 'q1', toolUseId: 'q', questions: [], expiresAt: 'x' },
      { kind: 'turn.ended', status: 'stopped' },
    );
    expect(copy.messages[0]?.questions[0]?.status).toBe('stopped');
  });

  it('notices line up on the turn, in order', () => {
    const copy = play(
      { kind: 'turn.starting', reason: 'mode' },
      { kind: 'engine.warning', code: 'newer_than_tested', version: '2.1.400', testedMax: '2.1.318' },
      { kind: 'tool.blocked', toolUseId: 't', name: 'Bash', command: 'pnpm test', mode: 'ask' },
      { kind: 'report.refused', cardKey: 'T-1', checks: [{ name: 'Tests', stepId: 's' }] },
    );
    expect(copy.messages[0]?.notices.map((item) => item.kind)).toEqual([
      'turn.starting',
      'engine.warning',
      'tool.blocked',
      'report.refused',
    ]);
  });

  it('a structured plan lands with its words, and words alone keep what was there', () => {
    const structured = { title: 'T', steps: [{ title: 'S' }] };
    const copy = play({ kind: 'plan.proposed', plan: 'words', structured });
    expect(copy.messages[0]).toMatchObject({ plan: 'words', structuredPlan: structured });
    const later = reduceChat(copy, live(copy.lastSeq + 1, { kind: 'plan.proposed', plan: 'more words' }));
    expect(later?.messages[0]).toMatchObject({ plan: 'more words', structuredPlan: structured });
  });

  it('a report lands on the turn, and an earlier one stays', () => {
    const report = {
      id: 'r1',
      cardKey: 'T-1',
      origin: 'panel' as const,
      chatId: 'c1',
      messageId: 'm1',
      summary: 'Did it',
      checks: [],
      changedFiles: [],
      filesFrom: 'none' as const,
      notChecked: [],
      droppedChecks: [],
      counts: { total: 0, passed: 0, failed: 0, skipped: 0, verified: 0, failedRuns: 0 },
      move: { moved: false, reason: 'no_checks' as const, from: null, to: null },
      reportedAt: 'x',
    };
    const copy = play(
      { kind: 'work.reported', report },
      { kind: 'work.reported', report: { ...report, id: 'r2' } },
    );
    expect(copy.messages[0]?.reports.map((item) => item.id)).toEqual(['r1', 'r2']);
  });

  it('a draft arrives, and its update replaces it: a refusal never reads as sent', () => {
    const copy = play(
      { kind: 'doc.draft', draft: DRAFT },
      {
        kind: 'doc.draft.updated',
        draft: { ...DRAFT, status: 'refused', refusedCode: 'hub.docs.stale_base' },
      },
    );
    expect(copy.messages[0]?.docDrafts).toEqual([
      expect.objectContaining({ id: 'draft-1', status: 'refused', refusedCode: 'hub.docs.stale_base' }),
    ]);
  });

  it('an approval on save_doc knows its draft', () => {
    const copy = play(
      { kind: 'doc.draft', draft: DRAFT },
      {
        kind: 'approval.requested',
        approvalId: 'a',
        toolUseId: 't',
        toolName: 'mcp__hub__save_doc',
        command: 'save',
        category: 'hub_doc',
        input: { draft: 'draft-1' },
        effect: 'Writes a document',
        expiresAt: 'x',
      },
    );
    const turn = copy.messages[0]!;
    expect(draftOfApproval(turn, turn.approvals[0]!)?.id).toBe('draft-1');
  });

  it('a step gets its command', () => {
    const copy = play(
      { kind: 'tool.started', toolUseId: 't', name: 'Bash' },
      { kind: 'tool.input', toolUseId: 't', name: 'Bash', input: {}, command: 'pnpm test' },
    );
    expect(copy.messages[0]?.steps[0]?.command).toBe('pnpm test');
  });
});

describe('the honest state', () => {
  const NOW = Date.parse('2026-11-06T12:00:00Z');
  const online = { deviceOnline: true, deviceRevoked: false };
  const engine = {
    found: true,
    version: '2.1.318',
    inRange: true,
    canRun: true,
    warning: null,
    checkedAt: '2026-11-06T12:00:00Z',
    testedRange: { min: '2.1.318', max: '2.1.318' },
    message: null,
    signedIn: true,
    effortSupported: true,
    modelSupported: true,
    live: 0,
  };
  const failed = (failure: ChatMessageDto['failure'], limit: ChatMessageDto['limit'] = null) => ({
    failure,
    limit,
    endedAt: '2026-11-06T11:00:00Z',
  });

  it('all fine', () => {
    expect(honestStateOf(online, null, engine, NOW)).toMatchObject({
      kind: 'ok',
      composer: true,
      recheck: false,
      approvalsAnswerable: true,
    });
  });

  it('offline: nothing can be answered, or sent', () => {
    expect(honestStateOf({ ...online, deviceOnline: false }, null, engine, NOW)).toMatchObject({
      kind: 'offline',
      composer: false,
      approvalsAnswerable: false,
    });
  });

  it('signed out has a re-check, and only a re-check after the failure clears it', () => {
    const last = failed('signed_out');
    expect(honestStateOf(online, last, { ...engine, signedIn: false }, NOW)).toMatchObject({
      kind: 'signed_out',
      recheck: true,
      composer: false,
    });
    const stale = { ...engine, checkedAt: '2026-11-06T10:00:00Z' };
    expect(honestStateOf(online, last, stale, NOW).kind).toBe('signed_out');
    expect(honestStateOf(online, last, engine, NOW).kind).toBe('ok');
  });

  it('a limit has a re-check, and clears by itself at its time', () => {
    const resetsAt = NOW / 1000 + 60;
    const last = failed('rate_limited', { status: 'rejected', resetsAt });
    expect(honestStateOf(online, last, engine, NOW)).toMatchObject({
      kind: 'limit',
      recheck: true,
      composer: false,
      resetsAt: resetsAt * 1000,
    });
    expect(honestStateOf(online, last, engine, NOW + 61_000).kind).toBe('ok');
  });

  it('a limit with no time cannot say when, so a send may try', () => {
    expect(honestStateOf(online, failed('rate_limited'), engine, NOW)).toMatchObject({
      kind: 'limit',
      composer: true,
      resetsAt: null,
    });
  });

  it('D53: too old is refused with the fallback, newer only warns, unreadable offers the fallback', () => {
    expect(honestStateOf(online, null, { ...engine, canRun: false }, NOW)).toMatchObject({
      kind: 'too_old',
      openInVsCode: true,
      composer: false,
    });
    const warning = { code: 'newer_than_tested' as const, version: '2.1.400', testedMax: '2.1.318' };
    expect(honestStateOf(online, null, { ...engine, warning }, NOW)).toMatchObject({
      kind: 'ok',
      composer: true,
      warning,
    });
    expect(honestStateOf(online, failed('unreadable_event'), engine, NOW)).toMatchObject({
      kind: 'unreadable',
      openInVsCode: true,
      composer: true,
    });
  });
});

describe('the words', () => {
  it('a suggestion that runs in Execute says so, and every failure, start reason and report reason has words', () => {
    for (const catalog of [ar, en]) {
      const suggestions = catalog.suggestions as Record<string, { runs?: string }>;
      for (const id of ['work_card', 'improve_doc', 'document_card']) {
        expect([id, Boolean(suggestions[id]?.runs)]).toEqual([id, true]);
      }
      for (const reason of START_REASONS) {
        expect([reason, Boolean((catalog.starting as Record<string, string>)[reason])]).toEqual([
          reason,
          true,
        ]);
      }
      for (const reason of REPORT_MOVE_REASONS) {
        expect([reason, Boolean((catalog.report.move as Record<string, string>)[reason])]).toEqual([
          reason,
          true,
        ]);
      }
      for (const basis of CHECK_BASES) {
        expect([basis, Boolean((catalog.report.basis as Record<string, string>)[basis])]).toEqual([
          basis,
          true,
        ]);
      }
    }
    for (const part of ['honest', 'starting', 'blocked', 'plan', 'question', 'draft'] as const) {
      expect(Object.keys(ar[part]).sort()).toEqual(Object.keys(en[part]).sort());
    }
  });

  it('every suggestion and failure has words in both languages', () => {
    for (const catalog of [ar, en]) {
      for (const id of CHAT_SUGGESTION_IDS) {
        const words = (catalog.suggestions as Record<string, { label: string; prompt: string }>)[id];
        expect([id, Boolean(words?.label && words.prompt)]).toEqual([id, true]);
      }
      for (const failure of TURN_FAILURES) {
        expect([failure, Boolean((catalog.failures as Record<string, string>)[failure])]).toEqual([
          failure,
          true,
        ]);
      }
    }
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(ar.categories).sort()).toEqual(Object.keys(en.categories).sort());
    expect(Object.keys(ar.stages).sort()).toEqual(Object.keys(en.stages).sort());
  });
});
