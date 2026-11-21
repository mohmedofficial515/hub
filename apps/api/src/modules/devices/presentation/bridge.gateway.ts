/**
 * @file The WebSocket door for bridges, at `/bridge` on the API port (docs/16 §4).
 * @description A bridge connects out with its device credential in the `Authorization` header. A wrong or revoked credential completes the handshake and
 * closes with `BRIDGE_CLOSE.revoked`, because a client cannot read an HTTP refusal and must know to stop trying. Any request with an `Origin` is refused
 * outright: a bridge has none, and a browser page always does. The credential is checked again once a minute, so disabling a member reaches a live socket too.
 * Only a credential Hub has read and refused counts as revoked. When the check itself fails (the database is down), a new socket closes with `BRIDGE_CLOSE.unavailable`
 * and the bridge tries again, and a live socket is left alone until the next check: on 2026-11-06 a passing database fault stopped the owner's bridge for good.
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import { BRIDGE_CLOSE, BRIDGE_SOCKET_PATH } from '@hub/contracts';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { type RawData, type WebSocket, WebSocketServer } from 'ws';

import { ApiTokenService } from '@/modules/identity';
import { AppException } from '@/shared/errors';

import { BridgeHub } from '../application/bridge-hub';

const PING_MS = 30_000;
const RECHECK_MS = 60_000;
const MAX_FRAME_BYTES = 1_048_576;

/** What Hub concluded about a credential. `unavailable` means it could not tell, and must never be taken as a refusal. */
type Check =
  | { readonly kind: 'device'; readonly deviceId: string; readonly userId: string }
  | { readonly kind: 'refused' }
  | { readonly kind: 'unavailable' };

/** The answers that mean the credential itself is wrong. Anything else thrown is a fault in Hub, and the bridge should come back. */
const REFUSALS = new Set([
  'hub.identity.token_invalid',
  'hub.identity.token_revoked',
  'hub.identity.account_disabled',
]);

interface Live {
  alive: boolean;
  checkedAt: number;
  readonly token: string;
  readonly deviceId: string;
}

function textOf(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  return Buffer.from(data as Buffer).toString('utf8');
}

@Injectable()
export class BridgeGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BridgeGateway.name);
  private readonly sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });
  private readonly live = new Map<WebSocket, Live>();
  private timer: NodeJS.Timeout | undefined;
  private server: Server | undefined;
  private readonly onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
    void this.upgrade(request, socket, head);
  };

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly hub: BridgeHub,
    private readonly tokens: ApiTokenService,
    private readonly cls: ClsService,
  ) {}

  onApplicationBootstrap(): void {
    this.server = this.adapter.httpAdapter?.getHttpServer() as Server | undefined;
    this.server?.on('upgrade', this.onUpgrade);
    this.timer = setInterval(() => void this.sweep(), PING_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.server?.off('upgrade', this.onUpgrade);
    this.hub.closeAll();
    for (const socket of this.sockets.clients) socket.terminate();
    this.sockets.close();
  }

  private async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const path = (request.url ?? '').split('?')[0];
    if (path !== BRIDGE_SOCKET_PATH || request.headers.origin) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const raw = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '')?.[1];
    const check: Check = raw ? await this.authenticate(raw) : { kind: 'refused' };
    this.sockets.handleUpgrade(request, socket, head, (client) => {
      if (check.kind === 'unavailable') {
        client.close(BRIDGE_CLOSE.unavailable, 'try again');
        return;
      }
      if (!raw || check.kind !== 'device') {
        client.close(BRIDGE_CLOSE.revoked, 'not paired');
        return;
      }
      this.accept(client, raw, check.deviceId, check.userId);
    });
  }

  private accept(client: WebSocket, token: string, deviceId: string, userId: string): void {
    const socket = {
      send: (text: string) => client.send(text),
      close: (code: number, reason: string) => client.close(code, reason),
    };
    this.hub.attach(deviceId, userId, socket);
    this.live.set(client, { alive: true, checkedAt: Date.now(), token, deviceId });
    client.on('pong', () => {
      const entry = this.live.get(client);
      if (entry) entry.alive = true;
    });
    client.on('message', (data, isBinary) => {
      if (isBinary) return;
      this.cls
        .run(() => this.hub.receive(deviceId, textOf(data)))
        .catch((error: unknown) => this.logger.warn(`A frame failed: ${String(error)}`));
    });
    client.on('close', () => {
      this.live.delete(client);
      this.hub.detach(deviceId, socket);
    });
    client.on('error', () => client.terminate());
  }

  private async sweep(): Promise<void> {
    const now = Date.now();
    for (const [client, entry] of this.live) {
      if (!entry.alive) {
        client.terminate();
        continue;
      }
      entry.alive = false;
      client.ping();
      if (now - entry.checkedAt < RECHECK_MS) continue;
      entry.checkedAt = now;
      const still = await this.authenticate(entry.token);
      if (still.kind === 'unavailable') continue;
      if (still.kind !== 'device' || still.deviceId !== entry.deviceId) {
        this.hub.disconnect(entry.deviceId, BRIDGE_CLOSE.revoked, 'revoked');
        client.close(BRIDGE_CLOSE.revoked, 'revoked');
      }
    }
  }

  private async authenticate(raw: string): Promise<Check> {
    try {
      const principal = await this.cls.run(() => this.tokens.authenticate(raw));
      if (principal.kind !== 'agent' || !principal.deviceId) return { kind: 'refused' };
      return { kind: 'device', deviceId: principal.deviceId, userId: principal.userId };
    } catch (error: unknown) {
      if (error instanceof AppException && REFUSALS.has(error.code)) return { kind: 'refused' };
      this.logger.warn(
        `A bridge credential could not be checked: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      return { kind: 'unavailable' };
    }
  }
}
