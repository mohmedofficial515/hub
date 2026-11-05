/**
 * @file Cursor pagination (docs/04 §1.3). Cursors are `(sortKey, id)` in base64url, opaque to clients.
 */
import { z } from 'zod';

import { AppException } from '../errors';

export interface Pagination {
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total?: number;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly pagination: Pagination;
  /** More page-level facts for `meta`, such as the timeline's day counts. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

export function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { items?: unknown }).items) &&
    typeof (value as { pagination?: unknown }).pagination === 'object'
  );
}

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function encodeCursor(sortKey: string, id: string): string {
  return Buffer.from(JSON.stringify([sortKey, id])).toString('base64url');
}

export function decodeCursor(cursor: string): { sortKey: string; id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const [sortKey, id] = z.tuple([z.string(), z.string()]).parse(parsed);
    return { sortKey, id };
  } catch (cause) {
    throw new AppException('hub.common.validation', { details: { issues: [{ path: 'cursor' }] }, cause });
  }
}
