/**
 * @file A stand-in for the model, so the real `claude` binary can make a real MCP tool call in an isolated home, with no sign-in, no cost and no model call.
 * @description `ANTHROPIC_BASE_URL` points the binary here. The first request that offers the wanted tool is answered with a `tool_use` for it, in the streaming shape, and the next one ends the turn. Everything after that
 * is the binary's own work: connecting with `headersHelper`, sending `tools/call` to Hub, returning the result. It records what it was offered, so a test can say what the binary loaded.
 * `startScriptedModel` goes further: it follows a script through a whole turn, for `scripted-engine.ts`. `apps/api/test/helpers/scripted-model.ts` is its twin on the API's side.
 */
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeModel {
  readonly url: string;
  readonly offered: () => string[];
  readonly toolResults: () => string[];
  close(): Promise<void>;
}

interface ModelRequest {
  stream?: boolean;
  tools?: { name: string }[];
  messages?: {
    role: string;
    content: string | { type: string; content?: unknown; tool_use_id?: string }[];
  }[];
}

function send(response: ServerResponse, events: [string, object][]) {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const [event, data] of events) {
    response.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  }
  response.end();
}

const message = (id: string) => ({
  message: {
    id,
    type: 'message',
    role: 'assistant',
    model: 'fake-model',
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  },
});

function toolUse(response: ServerResponse, tool: string, input: object) {
  send(response, [
    ['message_start', message('msg_tool')],
    [
      'content_block_start',
      { index: 0, content_block: { type: 'tool_use', id: `toolu_${Date.now()}`, name: tool, input: {} } },
    ],
    [
      'content_block_delta',
      { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } },
    ],
    ['content_block_stop', { index: 0 }],
    [
      'message_delta',
      { delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 1 } },
    ],
    ['message_stop', {}],
  ]);
}

function plainText(response: ServerResponse, words: string) {
  send(response, [
    ['message_start', message('msg_text')],
    ['content_block_start', { index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { index: 0, delta: { type: 'text_delta', text: words } }],
    ['content_block_stop', { index: 0 }],
    [
      'message_delta',
      { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
    ],
    ['message_stop', {}],
  ]);
}

export async function startFakeModel(tool: string, input: object): Promise<FakeModel> {
  const offered = new Set<string>();
  const results: string[] = [];
  const server: Server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += String(chunk)));
    request.on('end', () => {
      if (!request.url?.includes('/v1/messages')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
        return;
      }
      if (request.url.includes('count_tokens')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":1}');
        return;
      }
      const body = JSON.parse(raw) as ModelRequest;
      for (const item of body.tools ?? []) offered.add(item.name);
      const last = body.messages?.at(-1)?.content;
      const answered = Array.isArray(last) ? last.filter((part) => part.type === 'tool_result') : [];
      for (const part of answered) results.push(JSON.stringify(part.content));
      if (answered.length === 0 && body.tools?.some((item) => item.name === tool)) {
        toolUse(response, tool, input);
        return;
      }
      plainText(response, 'Done.');
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    offered: () => [...offered],
    toolResults: () => results,
    close: () => new Promise((done) => server.close(() => done())),
  };
}

// ── The scripted model: a whole turn from a script ─────────────────────────────────────────────────

/** Words, in `chunks` pieces (by default a word each), with `delayMs` between them, so a test can catch a reply half way. */
export interface TextStep {
  readonly kind: 'text';
  readonly text: string;
  readonly chunks?: number;
  readonly delayMs?: number;
}
export interface ToolStep {
  readonly kind: 'tool';
  readonly name: string;
  readonly input: Record<string, unknown>;
}
/** Never finishes, so a test can press Stop. Whatever words came before it have already arrived. */
export interface HoldStep {
  readonly kind: 'hold';
}
/** The real API's answer to a bad key: HTTP 401 with an `authentication_error`. The binary reports it as signed out. */
export interface UnauthorizedStep {
  readonly kind: 'unauthorized';
}
/** The real API's "overloaded" (HTTP 529). The binary emits a retry, which the panel shows as `turn.status` `retrying`, and asks again, which takes the next step. */
export interface OverloadedStep {
  readonly kind: 'overloaded';
}
export type ScriptStep =
  | TextStep
  | ToolStep
  | HoldStep
  | UnauthorizedStep
  | OverloadedStep
  /** Decided when the model is asked, for a step that needs what an earlier one made, such as a draft's id. */
  | (() => Promise<ScriptStep>);

export const text = (words: string, options: { chunks?: number; delayMs?: number } = {}): TextStep => ({
  kind: 'text',
  text: words,
  ...options,
});
export const tool = (name: string, input: Record<string, unknown> = {}): ToolStep => ({
  kind: 'tool',
  name,
  input,
});
export const hold = (): HoldStep => ({ kind: 'hold' });
export const unauthorized = (): UnauthorizedStep => ({ kind: 'unauthorized' });
export const overloaded = (): OverloadedStep => ({ kind: 'overloaded' });

export interface ScriptedModel {
  readonly url: string;
  /** Sets what the next turn does, replacing anything left of the last script. */
  script(...steps: ScriptStep[]): void;
  /** Every request gets a 401 until this is turned off, as with a key that stopped working. */
  rejectAll(on: boolean): void;
  /** Every tool name the binary has offered. */
  readonly offered: () => string[];
  /** The conversation of the last request that used a step, as text, to prove what was resumed. */
  readonly lastConversation: () => string;
  readonly lastSystem: () => string;
  readonly requests: () => number;
  /** What each tool answered, in order. */
  readonly toolResults: () => string[];
  close(): Promise<void>;
}

interface ScriptedRequest {
  tools?: { name: string }[];
  system?: unknown;
  messages?: { role: string; content: string | { type: string; content?: unknown }[] }[];
}

const STREAM_PING_MS = 5_000;
let unique = 0;
const nextId = (prefix: string) => {
  unique += 1;
  return `${prefix}_${Date.now().toString(36)}${unique}`;
};
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

function piecesOf({ text: words, chunks }: TextStep): string[] {
  if (!chunks || chunks < 1) return words.split(/(?<= )/);
  const size = Math.max(1, Math.ceil(words.length / chunks));
  const pieces: string[] = [];
  for (let at = 0; at < words.length; at += size) pieces.push(words.slice(at, at + size));
  return pieces;
}

function refuse(response: ServerResponse) {
  response.writeHead(401, { 'content-type': 'application/json' }).end(
    JSON.stringify({
      type: 'error',
      error: { type: 'authentication_error', message: 'invalid x-api-key' },
    }),
  );
}

/** One response of the model: any words, then one tool or a hold. Written as it would stream, event by event. */
async function stream(response: ServerResponse, words: TextStep[], last: ToolStep | HoldStep | null) {
  const write = (event: string, data: object) => {
    if (!response.destroyed) {
      response.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
    }
  };
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  write('message_start', {
    message: {
      id: nextId('msg'),
      type: 'message',
      role: 'assistant',
      model: 'scripted-model',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 3, output_tokens: 1 },
    },
  });
  let index = 0;
  for (const step of words) {
    write('content_block_start', { index, content_block: { type: 'text', text: '' } });
    for (const piece of piecesOf(step)) {
      write('content_block_delta', { index, delta: { type: 'text_delta', text: piece } });
      if (step.delayMs) await pause(step.delayMs);
    }
    write('content_block_stop', { index });
    index += 1;
  }
  if (last?.kind === 'hold') {
    const keepAlive = setInterval(() => write('ping', {}), STREAM_PING_MS);
    keepAlive.unref();
    response.on('close', () => clearInterval(keepAlive));
    return;
  }
  if (last) {
    write('content_block_start', {
      index,
      content_block: { type: 'tool_use', id: nextId('toolu'), name: last.name, input: {} },
    });
    write('content_block_delta', {
      index,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(last.input) },
    });
    write('content_block_stop', { index });
  }
  write('message_delta', {
    delta: { stop_reason: last ? 'tool_use' : 'end_turn', stop_sequence: null },
    usage: { output_tokens: 2 },
  });
  write('message_stop', {});
  response.end();
}

/**
 * Each request with tools takes steps from the script. Words run on into whatever follows them, so `text('Pushing.'), tool('Bash', …)` is one response, as a real model gives it, and the turn ends on words with nothing after them. An empty script ends the turn too. A request with no tools is the binary's own housekeeping, and uses no step.
 */
export async function startScriptedModel(): Promise<ScriptedModel> {
  let steps: ScriptStep[] = [];
  let rejecting = false;
  const offered = new Set<string>();
  const results: string[] = [];
  let conversation = '';
  let system = '';
  let requests = 0;

  /** The next step with a function resolved, still at the head of the script. */
  async function peek(): Promise<Exclude<ScriptStep, () => Promise<ScriptStep>> | undefined> {
    let head = steps[0];
    while (typeof head === 'function') {
      head = await head();
      steps[0] = head;
    }
    return head;
  }

  async function answer(body: ScriptedRequest, response: ServerResponse) {
    requests += 1;
    for (const item of body.tools ?? []) offered.add(item.name);
    conversation = JSON.stringify(body.messages ?? []);
    system = JSON.stringify(body.system ?? '');
    const last = body.messages?.at(-1)?.content;
    if (Array.isArray(last)) {
      for (const part of last) {
        if (part.type === 'tool_result') results.push(JSON.stringify(part.content ?? ''));
      }
    }
    const words: TextStep[] = [];
    let head = await peek();
    while (head?.kind === 'text') {
      words.push(head);
      steps.shift();
      head = await peek();
    }
    if (head?.kind === 'unauthorized' && words.length === 0) {
      steps.shift();
      refuse(response);
      return;
    }
    if (head?.kind === 'overloaded' && words.length === 0) {
      steps.shift();
      response
        .writeHead(529, { 'content-type': 'application/json' })
        .end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }));
      return;
    }
    if (head?.kind === 'tool' || head?.kind === 'hold') {
      steps.shift();
      await stream(response, words, head);
      return;
    }
    await stream(response, words.length > 0 ? words : [text('Done with that. ')], null);
  }

  const server: Server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += String(chunk)));
    request.on('end', () => {
      if (!request.url?.includes('/v1/messages')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
        return;
      }
      if (rejecting) {
        refuse(response);
        return;
      }
      if (request.url.includes('count_tokens')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":1}');
        return;
      }
      const body = JSON.parse(raw) as ScriptedRequest;
      if (!body.tools?.length) {
        void stream(response, [text('Done.')], null);
        return;
      }
      void answer(body, response);
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    script: (...next) => {
      steps = [...next];
    },
    rejectAll: (on) => {
      rejecting = on;
    },
    offered: () => [...offered],
    lastConversation: () => conversation,
    lastSystem: () => system,
    requests: () => requests,
    toolResults: () => results,
    close: () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
