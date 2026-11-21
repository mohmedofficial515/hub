/**
 * @file Idempotency of the calls that create cards (docs/04 §1.4), for REST and MCP alike.
 * @description Same key and same payload replays the first answer for 24 hours; same key with another payload answers
 * 422. A key is per member and per operation, so two members or two routes can never collide. REST reaches this through
 * `IdempotencyInterceptor`. An MCP tool calls `run` itself with its tool call id, because a tool has no HTTP route:
 *
 *   idempotency.run(principal.userId, 'create_task', toolCallId, input, () => cards.apply(...))
 *
 * A failed call stores nothing, so it may be retried. Two calls racing with one key may both run; the first answer
 * stored is the one replayed. Retries come one after another, so this is not worth a lock.
 */
import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { RedisClients } from '@/infra/redis/redis.module';
import { AppException } from '@/shared/errors';

const TTL_SECONDS = 24 * 60 * 60;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

export interface IdempotentResult<T> {
  readonly result: T;
  readonly replayed: boolean;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly redis: RedisClients) {}

  /** Runs `work` once per key. With no key it simply runs. The answer must survive JSON. */
  async run<T>(
    userId: string,
    operation: string,
    key: string | undefined,
    payload: unknown,
    work: () => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    if (!key) return { result: await work(), replayed: false };
    if (key.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new AppException('hub.common.validation', { details: { issues: [{ path: 'Idempotency-Key' }] } });
    }
    const storeKey = `idem:${userId}:${sha256(`${operation}|${key}`)}`;
    const hash = sha256(JSON.stringify(payload ?? {}));

    const stored = await this.redis.main.get(storeKey);
    if (stored) {
      const first = JSON.parse(stored) as { hash: string; result: T };
      if (first.hash !== hash) throw new AppException('hub.common.idempotency_key_reused');
      return { result: first.result, replayed: true };
    }
    const result = await work();
    await this.redis.main.set(storeKey, JSON.stringify({ hash, result }), 'EX', TTL_SECONDS, 'NX');
    return { result, replayed: false };
  }
}
