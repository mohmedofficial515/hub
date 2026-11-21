/**
 * @file Maps Prisma errors onto the catalogue.
 * @description Reduced from F:/Goteav/backend/src/shared/errors/prisma-error.mapper.ts. Duck-typed so this
 * file never imports the generated client.
 */
import { AppException } from './app.exception';

export function mapPrismaError(error: unknown): AppException | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  if (code === 'P2002') return new AppException('hub.common.conflict', { cause: error });
  if (code === 'P2025') return new AppException('hub.common.not_found', { cause: error });
  return null;
}
