/**
 * @file errors.ts
 * @description The API's failure envelope as a typed error (docs/04 §1.2). `code` is stable and is what code branches on.
 */
export class HubError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;
  readonly requestId: string | undefined;

  constructor(input: {
    code: string;
    status: number;
    message?: string | undefined;
    details?: Record<string, unknown> | undefined;
    requestId?: string | undefined;
  }) {
    super(input.message ?? input.code);
    this.name = 'HubError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details ?? {};
    this.requestId = input.requestId;
  }
}

export const isHubError = (e: unknown, code?: string): e is HubError =>
  e instanceof HubError && (code === undefined || e.code === code);

interface Envelope {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

/** Turn any failed response into a HubError. A body that is not the envelope (a proxy's 502) still gets a code. */
export function toHubError(response: Pick<Response, 'status' | 'headers'>, data: unknown): HubError {
  const body = (typeof data === 'object' && data !== null ? data : {}) as Envelope;
  return new HubError({
    code:
      body.error?.code ?? (response.status >= 500 ? 'hub.common.unavailable' : 'hub.common.request_failed'),
    status: response.status,
    message: body.error?.message,
    details: body.error?.details,
    requestId: body.error?.requestId ?? response.headers.get('x-request-id') ?? undefined,
  });
}
