/**
 * @file The real `PRINCIPAL_RESOLVER`: a bearer API token, else the `hub_access` session cookie.
 * @description The session row and the user's status are read on every request, so signing out, revoking a
 * session and disabling an account all take effect at once, not when the 15 minute token expires. A hook
 * token stops here when it leaves its routes. `lastSeenAt` moves at most once a minute.
 */
import type { Principal } from '@hub/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { Request } from 'express';

import { CLOCK, type Clock } from '@/infra/clock/clock';
import { type PrismaTransactionalAdapter } from '@/infra/prisma/prisma.module';
import { AppException } from '@/shared/errors';

import { ApiTokenService } from '../application/api-token.service';
import { CredentialTokens } from '../application/credential-tokens.service';
import type { PrincipalResolver } from '../application/ports/principal-resolver';
import { hookTokenMayCall } from '../domain/credentials';
import { ACCESS_COOKIE, assertCsrfHeader, cookieOf } from './cookies';

const LAST_SEEN_RESOLUTION_MS = 60_000;

/** The family of the session behind a request, for "this session" in lists and sign-out. */
export const SESSION_FAMILY = Symbol('hub:session-family');
export type RequestWithFamily = Request & { [SESSION_FAMILY]?: string };

@Injectable()
export class CredentialsResolver implements PrincipalResolver {
  constructor(
    private readonly txHost: TransactionHost<PrismaTransactionalAdapter>,
    private readonly apiTokens: ApiTokenService,
    private readonly tokens: CredentialTokens,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async resolve(request: Request): Promise<Principal | null> {
    const authorization = request.header('authorization');
    if (authorization) return this.fromBearer(authorization, request.path);
    const access = cookieOf(request, ACCESS_COOKIE);
    return access ? this.fromCookie(access, request as RequestWithFamily) : null;
  }

  private async fromBearer(authorization: string, path: string): Promise<Principal> {
    const [scheme, raw] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !raw) throw new AppException('hub.identity.token_invalid');
    const principal = await this.apiTokens.authenticate(raw);
    if (principal.kind === 'hook' && !hookTokenMayCall(path)) {
      throw new AppException('hub.identity.token_scope');
    }
    return principal;
  }

  private async fromCookie(access: string, request: RequestWithFamily): Promise<Principal> {
    const claims = await this.tokens.verifyAccess(access);
    if (!claims) throw new AppException('hub.identity.session_expired');
    const now = this.clock.now();
    const session = await this.txHost.tx.session.findFirst({
      where: {
        familyId: claims.familyId,
        userId: claims.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: { user: { select: { status: true, lastSeenAt: true } } },
    });
    if (!session) throw new AppException('hub.identity.session_expired');
    if (session.user.status !== 'active') throw new AppException('hub.identity.account_disabled');
    assertCsrfHeader(request);
    const seen = session.user.lastSeenAt;
    if (!seen || now.getTime() - seen.getTime() >= LAST_SEEN_RESOLUTION_MS) {
      await this.txHost.tx.user.update({ where: { id: claims.userId }, data: { lastSeenAt: now } });
    }
    request[SESSION_FAMILY] = claims.familyId;
    return { kind: 'user', userId: claims.userId, via: 'web' };
  }
}

export function sessionFamilyOf(request: Request): string | null {
  return (request as RequestWithFamily)[SESSION_FAMILY] ?? null;
}
