/**
 * @file The bridge door tells a refused credential from a check that could not run. Only the first may close with `revoked`, which stops a bridge for good.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { BRIDGE_CLOSE } from '@hub/contracts';
import type { HttpAdapterHost } from '@nestjs/core';
import type { ClsService } from 'nestjs-cls';
import { WebSocket } from 'ws';

import type { ApiTokenService } from '@/modules/identity';
import { AppException } from '@/shared/errors';

import type { BridgeHub } from '../application/bridge-hub';
import { BridgeGateway } from './bridge.gateway';

const DEVICE = { kind: 'agent', userId: 'u1', via: 'mcp', tokenId: 't1', deviceId: 'd1' };

describe('BridgeGateway', () => {
  let server: Server;
  let port: number;
  let gateway: BridgeGateway;
  const authenticate = jest.fn();
  const hub = {
    attach: jest.fn(),
    detach: jest.fn(),
    disconnect: jest.fn(),
    receive: jest.fn(),
    closeAll: jest.fn(),
  };

  beforeEach(async () => {
    server = createServer();
    await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
    port = (server.address() as AddressInfo).port;
    const adapter = { httpAdapter: { getHttpServer: () => server } } as unknown as HttpAdapterHost;
    const cls = { run: (fn: () => unknown) => fn() } as unknown as ClsService;
    gateway = new BridgeGateway(
      adapter,
      hub as unknown as BridgeHub,
      { authenticate } as unknown as ApiTokenService,
      cls,
    );
    gateway.onApplicationBootstrap();
  });

  afterEach(async () => {
    gateway.onApplicationShutdown();
    await new Promise((closed) => server.close(closed));
  });

  function connect(): { socket: WebSocket; closed: Promise<number> } {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/bridge`, {
      headers: { authorization: 'Bearer hub_x' },
    });
    const closed = new Promise<number>((done) => socket.on('close', (code) => done(code)));
    return { socket, closed };
  }

  it.each([
    'hub.identity.token_invalid',
    'hub.identity.token_revoked',
    'hub.identity.account_disabled',
  ] as const)('closes as revoked when the credential is refused: %s', async (code) => {
    authenticate.mockRejectedValueOnce(new AppException(code));
    await expect(connect().closed).resolves.toBe(BRIDGE_CLOSE.revoked);
  });

  it('closes as revoked for a credential that is not a device', async () => {
    authenticate.mockResolvedValueOnce({ kind: 'hook', userId: 'u1', via: 'hook', tokenId: 't1' });
    await expect(connect().closed).resolves.toBe(BRIDGE_CLOSE.revoked);
  });

  it('asks the bridge to try again when the check itself fails, as with the database down', async () => {
    authenticate.mockRejectedValueOnce(new Error("Can't reach database server"));
    await expect(connect().closed).resolves.toBe(BRIDGE_CLOSE.unavailable);
    expect(BRIDGE_CLOSE.unavailable).not.toBe(BRIDGE_CLOSE.revoked);
  });

  it('keeps a live socket through a failed recheck, and closes it once the credential is really refused', async () => {
    authenticate.mockResolvedValue(DEVICE);
    const { socket, closed } = connect();
    await new Promise((open) => socket.once('open', open));
    await new Promise((settle) => setTimeout(settle, 20));
    expect(hub.attach).toHaveBeenCalledWith('d1', 'u1', expect.anything());

    const live = (gateway as unknown as { live: Map<unknown, { checkedAt: number; alive: boolean }> }).live;
    const sweep = () => (gateway as unknown as { sweep: () => Promise<void> }).sweep();
    const age = () => {
      for (const entry of live.values()) {
        entry.checkedAt = 0;
        entry.alive = true;
      }
    };

    authenticate.mockRejectedValueOnce(new Error('connection refused'));
    age();
    await sweep();
    expect(hub.disconnect).not.toHaveBeenCalled();
    expect(socket.readyState).toBe(WebSocket.OPEN);

    authenticate.mockRejectedValueOnce(new AppException('hub.identity.token_revoked'));
    age();
    await sweep();
    expect(hub.disconnect).toHaveBeenCalledWith('d1', BRIDGE_CLOSE.revoked, 'revoked');
    await expect(closed).resolves.toBe(BRIDGE_CLOSE.revoked);
  });
});
