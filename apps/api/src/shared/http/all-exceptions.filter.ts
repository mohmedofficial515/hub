/**
 * @file Global exception filter: every failure becomes `{ error: { code, message, details, requestId } }`.
 * @description Adapted from F:/Goteav/backend/src/shared/http/filters/all-exceptions.filter.ts, with the
 * envelope of docs/04 §1.2 (no `success` field).
 */
import type { ErrorCode } from '@hub/contracts';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { AppException, type ErrorParams, mapPrismaError } from '../errors';

interface Normalized {
  readonly status: number;
  readonly code: ErrorCode;
  readonly params: ErrorParams;
  readonly details?: Record<string, unknown> | undefined;
  readonly headers?: Readonly<Record<string, string>> | undefined;
}

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'hub.common.validation',
  401: 'hub.common.unauthorized',
  403: 'hub.common.forbidden',
  404: 'hub.common.not_found',
  409: 'hub.common.conflict',
  413: 'hub.common.payload_too_large',
  429: 'hub.common.rate_limited',
  503: 'hub.common.unavailable',
};

function issuesOf(error: ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }));
}

function zodErrorOf(exception: ZodValidationException): ZodError | null {
  const error = exception.getZodError();
  return error instanceof ZodError ? error : null;
}

export function normalizeException(exception: unknown): Normalized {
  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      code: exception.code,
      params: exception.params,
      details: exception.details,
      headers: exception.headers,
    };
  }
  if (exception instanceof ZodError) {
    return {
      status: 400,
      code: 'hub.common.validation',
      params: {},
      details: { issues: issuesOf(exception) },
    };
  }
  if (exception instanceof ZodValidationException) {
    const zodError = zodErrorOf(exception);
    return {
      status: 400,
      code: 'hub.common.validation',
      params: {},
      details: { issues: zodError ? issuesOf(zodError) : [] },
    };
  }
  const prisma = mapPrismaError(exception);
  if (prisma) return normalizeException(prisma);
  // Express body-parser failures arrive as plain errors that carry a status.
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : ((exception as { status?: unknown } | null)?.status as number | undefined);
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { status, code: STATUS_CODES[status] ?? 'hub.common.validation', params: {} };
  }
  if (status === 503) return { status, code: 'hub.common.unavailable', params: {} };
  return { status: 500, code: 'hub.common.internal', params: {} };
}

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(exception);
      return;
    }
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const normalized = normalizeException(exception);
    const requestId = this.cls.isActive() ? this.cls.getId() : undefined;

    if (normalized.status >= 500) {
      this.logger.error({ err: exception, requestId, path: request.path, code: normalized.code });
    }
    if (response.headersSent) return;

    for (const [name, value] of Object.entries(normalized.headers ?? {})) response.setHeader(name, value);
    response.status(normalized.status).json({
      error: {
        code: normalized.code,
        message: this.translate(normalized, request),
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
        ...(requestId === undefined ? {} : { requestId }),
      },
    });
  }

  private translate(normalized: Normalized, request: Request): string {
    const lang = I18nContext.current()?.lang ?? this.langFromHeader(request);
    return this.i18n.t(`errors.${normalized.code}`, { lang, args: normalized.params });
  }

  /** An error raised before the i18n middleware ran still answers in the asked language. */
  private langFromHeader(request: Request): string {
    return request.headers['accept-language']?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
}
