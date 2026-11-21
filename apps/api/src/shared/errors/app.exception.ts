/**
 * @file The one exception type for expected failures.
 * @description Reduced from F:/Goteav/backend/src/shared/errors/app.exception.ts. The status comes from
 * the catalogue in @hub/contracts, so a code cannot be thrown with the wrong status.
 */
import { ERROR_CATALOGUE, type ErrorCode } from '@hub/contracts';
import { HttpException } from '@nestjs/common';

export type ErrorParams = Record<string, string | number>;

export interface AppExceptionOptions {
  /** Placeholders of the translated message. */
  readonly params?: ErrorParams;
  /** Machine-readable context returned as `error.details`. Never a secret value. */
  readonly details?: Record<string, unknown>;
  /** Response headers, such as Retry-After. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly cause?: unknown;
}

export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly params: ErrorParams;
  readonly details: Record<string, unknown> | undefined;
  readonly headers: Readonly<Record<string, string>> | undefined;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    super(code, ERROR_CATALOGUE[code], options.cause === undefined ? {} : { cause: options.cause });
    this.code = code;
    this.params = options.params ?? {};
    this.details = options.details;
    this.headers = options.headers;
  }
}
