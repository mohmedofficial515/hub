/**
 * @file Signed tokens: the 15 minute access token and the 5 minute TOTP challenge (HS256, HUB_JWT_SECRET).
 * @description Each has its own audience, so one can never stand in for the other. Time comes from the
 * injected clock, so tests can expire them.
 */
import { Inject, Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { CLOCK, type Clock } from '@/infra/clock/clock';

const ACCESS_AUDIENCE = 'hub:access';
const CHALLENGE_AUDIENCE = 'hub:totp-challenge';
export const ACCESS_TTL_SEC = 15 * 60;
const CHALLENGE_TTL_SEC = 5 * 60;

export interface AccessClaims {
  readonly userId: string;
  readonly familyId: string;
}

@Injectable()
export class CredentialTokens {
  private readonly key: Uint8Array;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.key = new TextEncoder().encode(config.HUB_JWT_SECRET);
  }

  signAccess({ userId, familyId }: AccessClaims): Promise<string> {
    return this.sign({ fam: familyId }, userId, ACCESS_AUDIENCE, ACCESS_TTL_SEC);
  }

  async verifyAccess(token: string): Promise<AccessClaims | null> {
    const payload = await this.verify(token, ACCESS_AUDIENCE);
    if (!payload?.sub || typeof payload['fam'] !== 'string') return null;
    return { userId: payload.sub, familyId: payload['fam'] };
  }

  signChallenge(userId: string): Promise<string> {
    return this.sign({}, userId, CHALLENGE_AUDIENCE, CHALLENGE_TTL_SEC);
  }

  /** The user the challenge was issued to, or null. */
  async verifyChallenge(token: string): Promise<string | null> {
    return (await this.verify(token, CHALLENGE_AUDIENCE))?.sub ?? null;
  }

  private sign(
    claims: Record<string, string>,
    subject: string,
    audience: string,
    ttlSec: number,
  ): Promise<string> {
    const now = Math.floor(this.clock.now().getTime() / 1000);
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(subject)
      .setAudience(audience)
      .setIssuedAt(now)
      .setExpirationTime(now + ttlSec)
      .sign(this.key);
  }

  private async verify(token: string, audience: string) {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        audience,
        currentDate: this.clock.now(),
      });
      return payload;
    } catch {
      return null;
    }
  }
}
