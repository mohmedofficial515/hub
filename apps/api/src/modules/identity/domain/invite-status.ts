/**
 * @file One status rule for an invite (docs/16 D68), so the members page, MCP and the counters agree.
 */
import type { InviteStatus } from '@hub/contracts';

export interface InviteFacts {
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly expiresAt: Date;
}

export function inviteStatusOf(invite: InviteFacts, now: Date): InviteStatus {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  return invite.expiresAt <= now ? 'expired' : 'pending';
}
