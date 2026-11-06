/**
 * @file Redis client and the realtime publisher.
 * @description The client connects on first command, so building the module opens nothing.
 * `RealtimePublisher.publishCardEvent` is what `CardService` calls after commit; the SSE module subscribes
 * through `RedisClients.createSubscriber()`. Each message also joins a capped stream, which is what a reconnect
 * replays with `Last-Event-ID` (docs/04 §3.22).
 */
import {
  REALTIME_REPLAY,
  type RealtimeCardEvent,
  type RealtimeEnvelope,
  workspaceEventsChannel,
  workspaceEventsStream,
} from '@hub/contracts';
import { Global, Inject, Injectable, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';

@Injectable()
export class RedisClients implements OnApplicationShutdown {
  /** Commands: ping, publish, locks, idempotency. */
  readonly main: Redis;
  private readonly extra: Redis[] = [];

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.main = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    this.main.on('error', () => undefined); // Readiness reports it; the event must not crash the process.
  }

  /** A dedicated connection for SUBSCRIBE. */
  createSubscriber(): Redis {
    const client = new Redis(this.config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null });
    client.on('error', () => undefined);
    this.extra.push(client);
    return client;
  }

  async onApplicationShutdown(): Promise<void> {
    for (const client of [this.main, ...this.extra]) client.disconnect();
  }
}

export type ProjectChangeScope = 'members' | 'invites' | 'settings' | 'sources' | 'project';

/**
 * Publishes `project.updated` once the decorated method has resolved, so after its transaction committed, and for
 * REST and MCP alike. The method's first argument is the actor; its class has `realtime: RealtimePublisher`.
 */
export function PublishesProjectChange(scope: ProjectChangeScope): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;
    descriptor.value = async function (
      this: { realtime: RealtimePublisher },
      actor: { workspaceId: string },
      ...rest: unknown[]
    ) {
      const result = await original.call(this, actor, ...rest);
      await this.realtime.publishProjectChange(actor.workspaceId, scope);
      return result;
    };
  };
}

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(private readonly redis: RedisClients) {}

  /** Never throws: the mutation has committed, and a lost message is caught up on reconnect. */
  async publishCardEvent(event: RealtimeCardEvent): Promise<void> {
    await this.send(event.workspaceId, event, event.cardKey);
  }

  /** Members, invites, settings, sources or project details changed: every open page rereads them (docs/15 §7). */
  async publishProjectChange(workspaceId: string, scope: ProjectChangeScope): Promise<void> {
    await this.publishEnvelope(workspaceId, { event: 'project.updated', data: { scope }, audience: 'all' });
  }

  /** Anything else for the open pages: `inbox.new`, `brief.ready`, `source.run` (docs/04 §4). Never throws. */
  async publishEnvelope(workspaceId: string, envelope: RealtimeEnvelope): Promise<void> {
    await this.send(workspaceId, envelope, envelope.event);
  }

  /**
   * For the chat's stream: goes to the open pages and skips the replay buffer, or one long reply would push every card event out of it. Not for anything that must survive a reconnect:
   * a page catches up on these by reading the chat, and a `chat.changed` envelope tells it to.
   */
  async publishTransient(workspaceId: string, envelope: RealtimeEnvelope): Promise<void> {
    try {
      await this.redis.main.publish(
        workspaceEventsChannel(workspaceId),
        JSON.stringify({ ...envelope, streamId: '' }),
      );
    } catch (error) {
      this.logger.warn(`Realtime publish failed for ${envelope.event}: ${String(error)}`);
    }
  }

  private async send(
    workspaceId: string,
    message: RealtimeCardEvent | RealtimeEnvelope,
    label: string,
  ): Promise<void> {
    try {
      const stream = workspaceEventsStream(workspaceId);
      const { main } = this.redis;
      const streamId = await main.xadd(
        stream,
        'MAXLEN',
        '~',
        REALTIME_REPLAY.maxEntries,
        '*',
        'message',
        JSON.stringify(message),
      );
      await main.pexpire(stream, REALTIME_REPLAY.maxAgeMs * 2);
      await main.publish(workspaceEventsChannel(workspaceId), JSON.stringify({ ...message, streamId }));
    } catch (error) {
      this.logger.warn(`Realtime publish failed for ${label}: ${String(error)}`);
    }
  }
}

@Global()
@Module({
  providers: [RedisClients, RealtimePublisher],
  exports: [RedisClients, RealtimePublisher],
})
export class RedisModule {}
