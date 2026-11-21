/**
 * @file The acting subject of an account event that belongs to no project, for `AuditService.recordAccount`.
 */
import type { AccountSubject } from '@/modules/audit';

export function webSubject(userId: string): AccountSubject {
  return { kind: 'user', userId, via: 'web' };
}
