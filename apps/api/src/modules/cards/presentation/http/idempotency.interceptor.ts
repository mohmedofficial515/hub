/**
 * @file `Idempotency-Key` on the routes that create cards (docs/04 §1.4).
 * @description Same key and same body replays the first answer for 24 hours, with `Idempotent-Replay: true` on the
 * response; same key with another body answers 422. A key is per member, so two members can never collide.
 */
import { createHash } from 'node:crypto';

import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { from, map, type Observable, of, switchMap } from 'rxjs';

import { RedisClients } from '@/infra/redis/redis.module';
import { AppException } from '@/shared/errors';
import type { HubRequest } from '@/shared/http';

const TTL_SECONDS = 24 * 60 * 60;
const MAX_KEY_LENGTH = 128;

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisClients) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HubRequest>();
    const key = request.header('idempotency-key');
    if (!key) return next.handle();
    if (key.length > MAX_KEY_LENGTH) {
      throw new AppException('hub.common.validation', { details: { issues: [{ path: 'Idempotency-Key' }] } });
    }
    const who = request.principal?.userId ?? 'anonymous';
    const storeKey = `idem:${who}:${createHash('sha256').update(`${request.path}|${key}`).digest('hex')}`;
    const bodyHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    return from(this.redis.main.get(storeKey)).pipe(
      switchMap((stored) => {
        if (stored) {
          const { hash, result } = JSON.parse(stored) as { hash: string; result: unknown };
          if (hash !== bodyHash) throw new AppException('hub.common.idempotency_key_reused');
          http.getResponse<Response>().setHeader('Idempotent-Replay', 'true');
          return of(result);
        }
        return next
          .handle()
          .pipe(
            switchMap((result: unknown) =>
              from(
                this.redis.main.set(
                  storeKey,
                  JSON.stringify({ hash: bodyHash, result }),
                  'EX',
                  TTL_SECONDS,
                  'NX',
                ),
              ).pipe(map(() => result)),
            ),
          );
      }),
    );
  }
}
