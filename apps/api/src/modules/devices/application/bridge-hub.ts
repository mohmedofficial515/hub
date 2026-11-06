/**
 * @file The channel to paired bridges (docs/16 §4): who is online, and asking one of them to do something.
 * @description `request` sends an action from the closed list and answers with its one `result`, passing every `event` before it to `onEvent`. This is
 * the extension point for Slice 3: a chat turn is `request(deviceId, 'turn.start', args, { timeoutMs: null, onEvent })`, and `turn.stop` is a second request.
 * The socket itself is behind `BridgeSocket`, so this file knows nothing of the transport. One API process holds the sockets: Hub runs on one
 * machine (D37), and several API processes would need a Redis relay here.
 */
import { randomUUID } from 'node:crypto';

import {
  type AllowedFolder,
  BRIDGE_CLOSE,
  BRIDGE_PROTOCOL_VERSION,
  type BridgeAction,
  bridgeFrameSchema,
  type BridgeRefusal,
  type HubFrame,
} from '@hub/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';

import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

export interface BridgeSocket {
  send(text: string): void;
  close(code: number, reason: string): void;
}

export interface BridgeEvent {
  readonly seq: number;
  readonly kind: string;
  readonly data: unknown;
}

export interface BridgeRequestOptions {
  /** `null` waits for as long as the device stays connected, for a chat turn. */
  readonly timeoutMs?: number | null;
  readonly onEvent?: (event: BridgeEvent) => void;
}

interface Pending {
  readonly deviceId: string;
  readonly resolve: (data: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout | null;
  readonly onEvent: ((event: BridgeEvent) => void) | undefined;
}

interface Connection {
  readonly deviceId: string;
  readonly userId: string;
  readonly socket: BridgeSocket;
  ready: boolean;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const STATUS_WRITE_EVERY_MS = 60_000;

function refusal(code: BridgeRefusal, message: string | undefined): AppException {
  if (code === 'folder_missing') return new AppException('hub.devices.folder_missing');
  return new AppException('hub.devices.refused', {
    details: { reason: code, ...(message ? { message } : {}) },
  });
}

@Injectable()
export class BridgeHub {
  private readonly logger = new Logger(BridgeHub.name);
  private readonly connections = new Map<string, Connection>();
  private readonly pending = new Map<string, Pending>();
  private readonly statusWrittenAt = new Map<string, number>();

  constructor(private readonly txHost: TransactionHost<PrismaTransactionalAdapter>) {}

  isOnline(deviceId: string): boolean {
    return this.connections.get(deviceId)?.ready === true;
  }

  /** A device has one socket. A second one from the same device replaces the first, as after a sleep. */
  attach(deviceId: string, userId: string, socket: BridgeSocket): void {
    const old = this.connections.get(deviceId);
    if (old) {
      old.socket.close(BRIDGE_CLOSE.replaced, 'replaced');
      this.failPending(deviceId);
    }
    this.connections.set(deviceId, { deviceId, userId, socket, ready: false });
  }

  detach(deviceId: string, socket: BridgeSocket): void {
    if (this.connections.get(deviceId)?.socket !== socket) return;
    this.connections.delete(deviceId);
    this.statusWrittenAt.delete(deviceId);
    this.failPending(deviceId);
  }

  /** Cuts a device off at once. Used on revoke, after the commit. */
  disconnect(deviceId: string, code: number, reason: string): void {
    const connection = this.connections.get(deviceId);
    if (!connection) return;
    connection.socket.close(code, reason);
    this.connections.delete(deviceId);
    this.failPending(deviceId);
  }

  /** Every socket, for shutdown. */
  closeAll(): void {
    for (const connection of [...this.connections.values()]) {
      connection.socket.close(1001, 'going away');
      this.connections.delete(connection.deviceId);
      this.failPending(connection.deviceId);
    }
  }

  /** One raw message from a bridge. A bad frame is dropped and its content is not logged, as it may hold anything. */
  async receive(deviceId: string, raw: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn(`A bad frame from device ${deviceId}: not JSON`);
      return;
    }
    const frame = bridgeFrameSchema.safeParse(parsed);
    if (!frame.success) {
      this.logger.warn(`A bad frame from device ${deviceId}: wrong shape`);
      return;
    }
    switch (frame.data.type) {
      case 'hello': {
        if (frame.data.protocol !== BRIDGE_PROTOCOL_VERSION) {
          connection.socket.close(BRIDGE_CLOSE.unsupportedProtocol, 'protocol');
          return;
        }
        await this.writeStatus(deviceId, frame.data.status, true);
        const folders = await this.foldersFor(connection.userId);
        this.send(connection, {
          type: 'welcome',
          protocol: BRIDGE_PROTOCOL_VERSION,
          deviceId,
          folders,
          docRoots: await this.docRootsFor(connection.userId, deviceId),
        });
        connection.ready = true;
        return;
      }
      case 'heartbeat':
        await this.writeStatus(deviceId, frame.data.status, false);
        return;
      case 'event': {
        const pending = this.pending.get(frame.data.id);
        if (pending?.deviceId !== deviceId) return;
        pending.onEvent?.({ seq: frame.data.seq, kind: frame.data.kind, data: frame.data.data });
        return;
      }
      case 'result': {
        const pending = this.pending.get(frame.data.id);
        if (pending?.deviceId !== deviceId) return;
        this.settle(frame.data.id, pending);
        if (frame.data.ok) pending.resolve(frame.data.data);
        else pending.reject(refusal(frame.data.error?.code ?? 'failed', frame.data.error?.message));
        return;
      }
    }
  }

  /** Sends a fresh allowlist, then the action, so a folder registered a moment ago counts and a removed one does not. */
  async request<T = unknown>(
    deviceId: string,
    action: BridgeAction,
    args: Readonly<Record<string, unknown>> = {},
    options: BridgeRequestOptions = {},
  ): Promise<T> {
    const connection = this.connections.get(deviceId);
    if (!connection?.ready) throw new AppException('hub.devices.offline');
    await this.pushAllowlist(deviceId);
    // The device may have gone during that wait, and nothing would ever answer.
    if (this.connections.get(deviceId) !== connection) throw new AppException('hub.devices.offline');
    const id = randomUUID();
    const timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : options.timeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timer =
        timeoutMs === null
          ? null
          : setTimeout(() => {
              this.pending.delete(id);
              reject(new AppException('hub.devices.timeout'));
            }, timeoutMs);
      timer?.unref();
      this.pending.set(id, {
        deviceId,
        resolve: resolve as (data: unknown) => void,
        reject,
        timer,
        onEvent: options.onEvent,
      });
      this.send(connection, { type: 'action', id, action, args });
    });
  }

  async pushAllowlist(deviceId: string): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return;
    this.send(connection, {
      type: 'allowlist',
      folders: await this.foldersFor(connection.userId),
      docRoots: await this.docRootsFor(connection.userId, deviceId),
    });
  }

  /** The folders of every open project this member belongs to (`repoPaths`). The bridge refuses anything else. */
  async foldersFor(userId: string): Promise<AllowedFolder[]> {
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active', workspace: { status: { not: 'closed' } } },
      select: { workspace: { select: { slug: true, repoPaths: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.flatMap(({ workspace }) =>
      workspace.repoPaths.map((path) => ({ path, project: workspace.slug })),
    );
  }

  /** Docs folders this member's projects keep on this device (docs/16 §10). */
  private async docRootsFor(userId: string, deviceId: string): Promise<string[]> {
    const memberships = await this.txHost.tx.membership.findMany({
      where: { userId, status: 'active', workspace: { status: { not: 'closed' } } },
      select: { workspaceId: true },
    });
    const sources = await this.txHost.tx.source.findMany({
      where: { workspaceId: { in: memberships.map((row) => row.workspaceId) }, kind: 'local_path' },
      select: { config: true },
    });
    return sources.flatMap((source) => {
      const config = source.config as { path?: string; purpose?: string; deviceId?: string };
      return config.path && config.purpose === 'docs' && config.deviceId === deviceId ? [config.path] : [];
    });
  }

  private send(connection: Connection, frame: HubFrame): void {
    connection.socket.send(JSON.stringify(frame));
  }

  private settle(id: string, pending: Pending): void {
    if (pending.timer) clearTimeout(pending.timer);
    this.pending.delete(id);
  }

  private failPending(deviceId: string): void {
    for (const [id, pending] of [...this.pending.entries()]) {
      if (pending.deviceId !== deviceId) continue;
      this.settle(id, pending);
      pending.reject(new AppException('hub.devices.offline'));
    }
  }

  private async writeStatus(
    deviceId: string,
    status: {
      bridgeVersion?: string | undefined;
      claudeVersion?: string | null | undefined;
      vscodeFound?: boolean | null | undefined;
    },
    force: boolean,
  ): Promise<void> {
    const now = Date.now();
    if (!force && now - (this.statusWrittenAt.get(deviceId) ?? 0) < STATUS_WRITE_EVERY_MS) return;
    this.statusWrittenAt.set(deviceId, now);
    await this.txHost.tx.device.updateMany({
      where: { id: deviceId, revokedAt: null },
      data: {
        lastSeenAt: new Date(now),
        ...(status.bridgeVersion === undefined ? {} : { bridgeVersion: status.bridgeVersion }),
        ...(status.claudeVersion === undefined ? {} : { claudeVersion: status.claudeVersion }),
        ...(status.vscodeFound === undefined ? {} : { vscodeFound: status.vscodeFound }),
      },
    });
  }
}
