/**
 * @file A stand-in for the model, so the real `claude` binary can make a real MCP tool call in an isolated home, with no sign-in, no cost and no model call.
 * @description `ANTHROPIC_BASE_URL` points the binary here. The first request that offers the wanted tool is answered with a `tool_use` for it, in the streaming shape, and the next one ends the turn. Everything after that
 * is the binary's own work: connecting with `headersHelper`, sending `tools/call` to Hub, returning the result. It records what it was offered, so a test can say what the binary loaded.
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

function text(response: ServerResponse, words: string) {
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
      text(response, 'Done.');
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
