/**
 * @file Redis client and the realtime publisher.
 * @description The client connects on first command, so building the module opens nothing.
 * `RealtimePublisher.publishCardEvent` is what `CardService` calls after commit; the SSE module subscribes
 * through `RedisClients.createSubscriber()`.
 */
import { type RealtimeCardEvent, workspaceEventsChannel } from '@hub/contracts';
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

@Injectable()
export class RealtimePublisher {
  private readonly logger = new Logger(RealtimePublisher.name);

  constructor(private readonly redis: RedisClients) {}

  /** Never throws: the mutation has committed, and a lost message is caught up on reconnect. */
  async publishCardEvent(event: RealtimeCardEvent): Promise<void> {
    try {
      await this.redis.main.publish(workspaceEventsChannel(event.workspaceId), JSON.stringify(event));
    } catch (error) {
      this.logger.warn(`Realtime publish failed for ${event.cardKey}: ${String(error)}`);
    }
  }
}

@Global()
@Module({
  providers: [RedisClients, RealtimePublisher],
  exports: [RedisClients, RealtimePublisher],
})
export class RedisModule {}
