#!/usr/bin/env node
/**
 * @file The permission tool Claude Code calls when a tool needs the owner (docs/16 S1 Q4). A small stdio MCP server, because a stdio tool may wait far longer than an HTTP one.
 * @description It decides nothing. It passes the call to the running bridge over a local pipe, holds it until the bridge answers, and returns that answer as one text block. Anything going wrong, including the bridge
 * having gone, denies. When Claude Code exits, stdin closes and this exits, which also closes the pipe, so the bridge can clear the approval. It holds no credential and writes no file.
 */
import { connect } from 'node:net';
import { createInterface } from 'node:readline';

const PIPE = process.env.HUB_APPROVAL_PIPE;
const KEY = process.env.HUB_APPROVAL_KEY;

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const deny = (message) => ({ behavior: 'deny', message });

function askBridge(args) {
  return new Promise((resolve) => {
    if (!PIPE || !KEY) {
      resolve(deny('Hub cannot be asked, so this is refused.'));
      return;
    }
    let raw = '';
    const socket = connect(PIPE);
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      socket.write(
        `${JSON.stringify({ key: KEY, toolName: args.tool_name, input: args.input, toolUseId: args.tool_use_id })}\n`,
      );
    });
    socket.on('data', (chunk) => {
      raw += chunk;
      const end = raw.indexOf('\n');
      if (end === -1) return;
      socket.destroy();
      try {
        resolve(JSON.parse(raw.slice(0, end)));
      } catch {
        resolve(deny('Hub sent an answer that could not be read, so this is refused.'));
      }
    });
    socket.on('error', () => resolve(deny('Hub could not be reached, so this is refused.')));
    socket.on('close', () => resolve(deny('The connection to Hub closed, so this is refused.')));
  });
}

const TOOL = {
  name: 'approve',
  description: "Hub's permission prompt. Claude Code calls it; calling it directly does nothing.",
  inputSchema: {
    type: 'object',
    properties: {
      tool_name: { type: 'string' },
      input: { type: 'object' },
      tool_use_id: { type: 'string' },
    },
    required: ['tool_name', 'input'],
    additionalProperties: true,
  },
};

async function handle(message) {
  const { id, method, params } = message;
  if (method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'hub-approval', version: '1.0.0' },
      },
    });
  } else if (method === 'tools/list') {
    send({ jsonrpc: '2.0', id, result: { tools: [TOOL] } });
  } else if (method === 'tools/call') {
    const answer = await askBridge(params?.arguments ?? {});
    send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(answer) }] } });
  } else if (method === 'ping') {
    send({ jsonrpc: '2.0', id, result: {} });
  } else if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
}

const lines = createInterface({ input: process.stdin });
lines.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  void handle(message);
});
lines.on('close', () => process.exit(0));
