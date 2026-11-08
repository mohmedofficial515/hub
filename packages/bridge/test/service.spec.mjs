/**
 * @file The running bridge against a fake socket: hello, the folder list, actions, staying up, and stopping for good when revoked.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { BRIDGE_CLOSE, BRIDGE_PROTOCOL_VERSION } from '../lib/protocol.mjs';
import { createBridge, socketUrl } from '../lib/service.mjs';
import { aFolder, CREDENTIAL, fakeSystem, URL } from './helpers.mjs';

class FakeSocket {
  static opened = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.readyState = 1;
    this.sent = [];
    this.listeners = {};
    FakeSocket.opened.push(this);
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  fire(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) void listener(event);
  }

  send(text) {
    this.sent.push(JSON.parse(text));
  }

  close() {
    this.fire('close', { code: 1000 });
  }
}

const flush = () => new Promise((done) => setTimeout(done, 20));

async function aBridge() {
  FakeSocket.opened = [];
  const system = fakeSystem({ WebSocket: FakeSocket });
  const bridge = createBridge(system, { url: URL, credential: CREDENTIAL });
  const done = bridge.start();
  const socket = FakeSocket.opened[0];
  socket.fire('open');
  await flush();
  return { system, bridge, done, socket };
}

describe('socketUrl', () => {
  it('goes to /bridge on the same host, secure when Hub is', () => {
    expect(socketUrl('http://localhost:7310')).toBe('ws://localhost:7310/bridge');
    expect(socketUrl('https://hub.ts.net')).toBe('wss://hub.ts.net/bridge');
  });
});

describe('the bridge', () => {
  it('connects out with its credential in the header, never the URL, and says hello', async () => {
    const { socket, bridge } = await aBridge();
    expect(socket.url).not.toContain(CREDENTIAL);
    expect(socket.options.headers.authorization).toBe(`Bearer ${CREDENTIAL}`);
    expect(socket.sent[0]).toMatchObject({ type: 'hello', protocol: BRIDGE_PROTOCOL_VERSION });
    expect(socket.sent[0].status.claudeVersion).toBe('2.1.318');
    expect(socket.sent[0].actions).toContain('turn.start');
    bridge.stop();
  });

  it('takes the folder list from Hub, and answers actions by it', async () => {
    const { socket, system, bridge } = await aBridge();
    const allowed = aFolder(system, 'allowed');
    const outside = aFolder(system, 'outside');
    socket.fire('message', {
      data: JSON.stringify({ type: 'welcome', deviceId: 'd', folders: [{ path: allowed, project: 'p' }] }),
    });
    expect(bridge.folders()).toEqual([{ path: allowed, project: 'p' }]);
    socket.fire('message', {
      data: JSON.stringify({ type: 'action', id: 'a1', action: 'turn.start', args: { folder: outside } }),
    });
    await flush();
    expect(socket.sent.at(-1)).toMatchObject({
      type: 'result',
      id: 'a1',
      ok: false,
      error: { code: 'folder_not_allowed' },
    });
    socket.fire('message', { data: JSON.stringify({ type: 'allowlist', folders: [] }) });
    expect(bridge.folders()).toEqual([]);
    bridge.stop();
  });

  it('drops a frame that is not JSON and stays up', async () => {
    const { socket, bridge } = await aBridge();
    socket.fire('message', { data: 'not json' });
    expect(socket.readyState).toBe(1);
    bridge.stop();
  });

  it('stops for good when revoked', async () => {
    const { socket, done } = await aBridge();
    socket.fire('close', { code: BRIDGE_CLOSE.revoked });
    await expect(done).resolves.toBe(0);
    await flush();
    expect(FakeSocket.opened).toHaveLength(1);
  });

  it('stops when another bridge takes over for this device', async () => {
    const { socket, done } = await aBridge();
    socket.fire('close', { code: BRIDGE_CLOSE.replaced });
    await expect(done).resolves.toBe(0);
  });

  it('tries again when Hub is simply away', async () => {
    vi.useFakeTimers();
    try {
      FakeSocket.opened = [];
      const system = fakeSystem({ WebSocket: FakeSocket });
      const bridge = createBridge(system, { url: URL, credential: CREDENTIAL });
      void bridge.start();
      FakeSocket.opened[0].fire('close', { code: 1006 });
      expect(FakeSocket.opened).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2_000);
      expect(FakeSocket.opened).toHaveLength(2);
      bridge.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the reconnect loop', () => {
  it('tries again after an error with no close, as the WebSocket built into Node does when nothing listens', async () => {
    vi.useFakeTimers();
    try {
      FakeSocket.opened = [];
      const system = fakeSystem({ WebSocket: FakeSocket });
      const bridge = createBridge(system, { url: URL, credential: CREDENTIAL });
      void bridge.start();
      const first = FakeSocket.opened[0];
      first.readyState = 0;
      first.fire('error');
      await vi.advanceTimersByTimeAsync(2_000);
      expect(FakeSocket.opened).toHaveLength(2);
      // A late close from the first socket must not start a second loop.
      first.fire('close', { code: 1006 });
      FakeSocket.opened[1].readyState = 0;
      FakeSocket.opened[1].fire('error');
      await vi.advanceTimersByTimeAsync(5_000);
      expect(FakeSocket.opened).toHaveLength(3);
      bridge.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up on a connection that never opens and tries again', async () => {
    vi.useFakeTimers();
    try {
      FakeSocket.opened = [];
      const system = fakeSystem({ WebSocket: FakeSocket });
      const bridge = createBridge(system, { url: URL, credential: CREDENTIAL });
      void bridge.start();
      FakeSocket.opened[0].readyState = 0;
      await vi.advanceTimersByTimeAsync(19_000);
      expect(FakeSocket.opened).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(3_000);
      expect(FakeSocket.opened).toHaveLength(2);
      bridge.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still stops for good when a socket that errored is then closed as revoked', async () => {
    const { socket, done } = await aBridge();
    socket.fire('error');
    socket.fire('close', { code: BRIDGE_CLOSE.revoked });
    await expect(done).resolves.toBe(0);
  });

  it('with a real socket, reaches Hub once it starts listening after the bridge', async () => {
    const probe = createServer();
    await new Promise((ready) => probe.listen(0, '127.0.0.1', ready));
    const { port } = probe.address();
    await new Promise((closed) => probe.close(closed));

    const system = fakeSystem({ WebSocket: globalThis.WebSocket });
    const bridge = createBridge(system, { url: `http://127.0.0.1:${port}`, credential: CREDENTIAL });
    const done = bridge.start();
    await new Promise((wait) => setTimeout(wait, 300));

    const hub = createServer();
    const upgraded = new Promise((reached) => {
      hub.on('upgrade', (request, socket) => {
        const accept = createHash('sha1')
          .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC11B85`)
          .digest('base64');
        socket.write(
          `HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: ${accept}

`,
        );
        reached(request.headers.authorization);
        socket.destroy();
      });
    });
    await new Promise((ready) => hub.listen(port, '127.0.0.1', ready));
    try {
      await expect(upgraded).resolves.toBe(`Bearer ${CREDENTIAL}`);
      const log = readFileSync(join(system.home, '.hub', 'bridge.log'), 'utf8');
      expect(log).toContain('Hub cannot be reached');
      expect(log).not.toContain('revoked');
    } finally {
      bridge.stop();
      await done;
      await new Promise((closed) => hub.close(closed));
    }
  }, 15_000);
});

describe('hub-mcp-headers', () => {
  function helperAt(deviceJson) {
    const home = mkdtempSync(join(tmpdir(), 'hub-helper-'));
    const bin = join(home, '.hub', 'app', 'bridge', 'bin');
    mkdirSync(bin, { recursive: true });
    cpSync(join(import.meta.dirname, '..', 'bin', 'hub-mcp-headers.mjs'), join(bin, 'hub-mcp-headers.mjs'));
    if (deviceJson !== undefined) writeFileSync(join(home, '.hub', 'device.json'), deviceJson);
    return join(bin, 'hub-mcp-headers.mjs');
  }

  const run = (helper) =>
    spawnSync(process.execPath, [helper], { encoding: 'utf8', env: { PATH: process.env.PATH } });

  it('prints the header as clean JSON, from a file and with no variable', () => {
    const answer = run(helperAt(JSON.stringify({ credential: 'hub_x_y' })));
    expect(answer.status).toBe(0);
    expect(JSON.parse(answer.stdout)).toEqual({ Authorization: 'Bearer hub_x_y' });
  });

  it.each([
    ['no file', undefined],
    ['a broken file', '{ nope'],
    ['no credential in it', '{}'],
  ])('always prints clean JSON: %s', (_name, content) => {
    const answer = run(helperAt(content));
    expect(answer.status).toBe(0);
    expect(JSON.parse(answer.stdout)).toEqual({});
  });
});
