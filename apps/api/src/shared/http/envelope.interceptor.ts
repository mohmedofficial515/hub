/**
 * @file Wraps handler results as `{ data, meta }` (docs/04 §1.2).
 * @description Adapted from F:/Goteav/backend/src/shared/http/interceptors/response-envelope.interceptor.ts.
 * A `Paginated` result puts its page info in `meta.pagination`. `@RawResponse()` skips the wrap.
 */
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { map, type Observable } from 'rxjs';

import { RAW_RESPONSE_KEY } from './decorators';
import { isPaginated } from './pagination';

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cls: ClsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const raw = this.reflector.getAllAndOverride<boolean | undefined>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw === true) return next.handle();

    return next.handle().pipe(
      map((result: unknown) => {
        if (result instanceof StreamableFile) return result;
        const requestId = this.cls.isActive() ? this.cls.getId() : undefined;
        const meta = requestId === undefined ? {} : { requestId };
        if (isPaginated(result)) {
          return { data: result.items, meta: { ...meta, pagination: result.pagination } };
        }
        return { data: result === undefined ? null : result, meta };
      }),
    );
  }
}
