/**
 * @file `Idempotency-Key` on the routes that create cards (docs/04 §1.4). `IdempotencyService` holds the rule; a replay
 * also answers `Idempotent-Replay: true`.
 */
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { from, lastValueFrom, map, type Observable } from 'rxjs';

import type { HubRequest } from '@/shared/http';

import { IdempotencyService } from '../../application/idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<HubRequest>();
    const key = request.header('idempotency-key');
    if (!key) return next.handle();
    const run = this.idempotency.run(
      request.principal?.userId ?? 'anonymous',
      request.path,
      key,
      request.body,
      () => lastValueFrom(next.handle()),
    );
    return from(run).pipe(
      map(({ result, replayed }) => {
        if (replayed) http.getResponse<Response>().setHeader('Idempotent-Replay', 'true');
        return result;
      }),
    );
  }
}
