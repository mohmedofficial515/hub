/**
 * @file One Redis subscriber per process, fanning out to the open SSE connections of each project (docs/15 §7).
 * @description A connection registers first and replays second, so nothing falls between the buffer and the live
 * channel: anything already sent is dropped by its stream id.
 */
import { type RealtimeMessage, workspaceEventsChannel } from '@hub/contracts';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import type Redis from 'ioredis';

import { RedisClients } from '@/infra/redis/redis.module';

export interface RealtimeConnection {
  deliver(message: RealtimeMessage): void;
}

/** Timings of the stream. An object so a test can shorten them. */
@Injectable()
export class RealtimeTimings {
  heartbeatMs = 25_000;
  maxConnectionMs = 55 * 60 * 1000;
}

@Injectable()
export class RealtimeHub implements OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeHub.name);
  private readonly connections = new Map<string, Set<RealtimeConnection>>();
  private subscriber: Redis | undefined;
  private ready: Promise<void> | undefined;

  constructor(private readonly redis: RedisClients) {}

  private connectSubscriber(): Promise<void> {
    this.ready ??= (async () => {
      const subscriber = this.redis.createSubscriber();
      subscriber.on('message', (channel: string, raw: string) => this.fanOut(channel, raw));
      await subscriber.connect();
      this.subscriber = subscriber;
    })();
    return this.ready;
  }

  private fanOut(channel: string, raw: string): void {
    const targets = this.connections.get(channel);
    if (!targets) return;
    let message: RealtimeMessage;
    try {
      message = JSON.parse(raw) as RealtimeMessage;
    } catch (error) {
      this.logger.warn(`Dropped an unreadable realtime message: ${String(error)}`);
      return;
    }
    for (const connection of targets) connection.deliver(message);
  }

  /** Returns the way to leave. Resolves once the channel is subscribed. */
  async register(workspaceId: string, connection: RealtimeConnection): Promise<() => void> {
    const channel = workspaceEventsChannel(workspaceId);
    await this.connectSubscriber();
    let targets = this.connections.get(channel);
    if (!targets) {
      targets = new Set();
      this.connections.set(channel, targets);
      await this.subscriber?.subscribe(channel);
    }
    targets.add(connection);
    return () => {
      const current = this.connections.get(channel);
      current?.delete(connection);
      if (current?.size === 0) {
        this.connections.delete(channel);
        void this.subscriber?.unsubscribe(channel).catch(() => undefined);
      }
    };
  }

  /** For the system page (docs/04 §3.23). */
  connectionCount(): number {
    let total = 0;
    for (const targets of this.connections.values()) total += targets.size;
    return total;
  }

  async onApplicationShutdown(): Promise<void> {
    this.connections.clear();
  }
}
