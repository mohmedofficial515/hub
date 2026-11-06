/**
 * @file The chat's cached copy under the live stream: order, gaps, approvals, the checklist, and that every suggestion has words in both languages.
 */
import {
  CHAT_SUGGESTION_IDS,
  type ChatFullDto,
  type ChatLiveEvent,
  type ChatMessageDto,
  TURN_FAILURES,
  type TurnEvent,
} from '@hub/contracts';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar/chat.json';
import en from '../../../messages/en/chat.json';
import { applyChatLive, chatKeys, checklistOf, pendingApprovals, reduceChat, runningMessage } from './live';

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
  changedFiles: [],
  steps: [],
  approvals: [],
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
        expiresAt: '2030-01-01T00:00:00Z',
      },
    );
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

describe('the words', () => {
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
