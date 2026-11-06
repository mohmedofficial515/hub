/**
 * @file A stand-in for the model, so the real `claude` binary runs real tools and real permission rules with no sign-in, no cost and no model call. `apps/web/e2e/support/fake-model.ts` does this for one tool; this one follows a script.
 * @description `ANTHROPIC_BASE_URL` points the binary here. Each request that offers tools takes the next step of the script: a tool use in the streaming shape, or words. An empty script ends the turn. A request with no tools is the binary's own housekeeping, and gets a short answer without using a step.
 */
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type ModelStep =
  | { readonly tool: string; readonly input: Record<string, unknown> }
  | { readonly text: string }
  /** Decided when the model is asked, for a step that needs what an earlier one made. */
  | (() => Promise<ModelStep>);

interface ModelRequest {
  tools?: { name: string }[];
  system?: unknown;
  messages?: { role: string; content: string | { type: string; content?: unknown; text?: string }[] }[];
}

export interface ScriptedModel {
  readonly url: string;
  /** Adds steps to the end of the script. */
  script(...steps: ModelStep[]): void;
  /** Every tool name the binary has offered. */
  readonly offered: () => string[];
  /** The conversation of the last request that used a step, as text, to prove what was resumed. */
  readonly lastConversation: () => string;
  /** The system prompt of the last request that used a step. */
  readonly lastSystem: () => string;
  readonly requests: () => number;
  /** What each tool answered, in order. */
  readonly toolResults: () => string[];
  close(): Promise<void>;
}

function send(response: ServerResponse, events: [string, object][]) {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const [event, data] of events) {
    response.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  }
  response.end();
}

let unique = 0;
const nextId = (prefix: string) => {
  unique += 1;
  return `${prefix}_${Date.now().toString(36)}${unique}`;
};

const start = () => ({
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

function toolUse(response: ServerResponse, tool: string, input: object) {
  send(response, [
    ['message_start', start()],
    [
      'content_block_start',
      { index: 0, content_block: { type: 'tool_use', id: nextId('toolu'), name: tool, input: {} } },
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

function words(response: ServerResponse, text: string) {
  const pieces = text.split(/(?<= )/);
  send(response, [
    ['message_start', start()],
    ['content_block_start', { index: 0, content_block: { type: 'text', text: '' } }],
    ...pieces.map((piece): [string, object] => [
      'content_block_delta',
      { index: 0, delta: { type: 'text_delta', text: piece } },
    ]),
    ['content_block_stop', { index: 0 }],
    [
      'message_delta',
      { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } },
    ],
    ['message_stop', {}],
  ]);
}

export async function startScriptedModel(...initial: ModelStep[]): Promise<ScriptedModel> {
  const steps = [...initial];
  const offered = new Set<string>();
  const results: string[] = [];
  let conversation = '';
  let system = '';
  let requests = 0;
  const server: Server = createServer((request, response) => {
    let raw = '';
    request.on('data', (chunk) => (raw += String(chunk)));
    request.on('end', () => {
      void answer();
    });
    const answer = async () => {
      if (!request.url?.includes('/v1/messages')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{}');
        return;
      }
      if (request.url.includes('count_tokens')) {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"input_tokens":1}');
        return;
      }
      const body = JSON.parse(raw) as ModelRequest;
      if (!body.tools?.length) {
        words(response, 'Done.');
        return;
      }
      requests += 1;
      for (const item of body.tools) offered.add(item.name);
      conversation = JSON.stringify(body.messages ?? []);
      system = JSON.stringify(body.system ?? '');
      const last = body.messages?.at(-1)?.content;
      if (Array.isArray(last)) {
        for (const part of last) {
          if (part.type === 'tool_result') results.push(JSON.stringify(part.content ?? ''));
        }
      }
      let step = steps.shift();
      while (typeof step === 'function') step = await step();
      if (!step) words(response, 'Done with that. ');
      else if ('tool' in step) toolUse(response, step.tool, step.input);
      else words(response, step.text);
    };
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    script: (...more) => steps.push(...more),
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
