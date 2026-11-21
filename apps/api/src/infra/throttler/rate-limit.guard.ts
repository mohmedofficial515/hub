/**
 * @file Rate limits of docs/04 §1.7, one fixed window per scope in Redis.
 * @description It runs after `ActorGuard`, so it knows who is calling. `@RateLimit('auth')` puts a public
 * route on the 10 a minute per IP limit, per route. Authenticated calls share one bucket per token or user,
 * with the limit of their kind. A public route with no decorator (health) is not limited. If Redis is down
 * the request passes, because readiness already reports the outage and sign-in must not depend on a counter.
 */
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { APP_CONFIG, type AppConfig } from '@/config/config.module';
import { AppException } from '@/shared/errors';
import type { HubRequest } from '@/shared/http';

import { RedisClients } from '../redis/redis.module';

export const RATE_LIMIT_KEY = 'hub:rate-limit';
const WINDOW_SEC = 60;

/** Limits per minute (docs/04 §1.7). */
export const RATE_LIMITS = { auth: 10, poll: 60, search: 60, agent: 120, hook: 60, user: 600 } as const;
export type RateLimitScope = 'auth' | 'poll' | 'search';

export const RateLimit = (scope: RateLimitScope): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, scope);

/** Counts one call in the window. Returns the seconds to wait when over the limit, else null. */
const INCREMENT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('TTL', KEYS[1]) }
`;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisClients,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    const request = context.switchToHttp().getRequest<HubRequest>();
    const scope = this.reflector.getAllAndOverride<RateLimitScope | undefined>(RATE_LIMIT_KEY, targets);
    const bucket = this.bucketFor(scope, request, context);
    if (!bucket) return true;

    const retryAfter = await this.count(bucket.key, bucket.limit);
    if (retryAfter === null) return true;
    throw new AppException('hub.common.rate_limited', {
      details: { retryAfterSec: retryAfter },
      headers: { 'Retry-After': String(retryAfter) },
    });
  }

  private bucketFor(
    scope: RateLimitScope | undefined,
    request: HubRequest,
    context: ExecutionContext,
  ): { key: string; limit: number } | null {
    const principal = request.principal;
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    if (scope === 'auth') return { key: `rl:auth:${route}:${request.ip}`, limit: RATE_LIMITS.auth };
    if (scope === 'poll') return { key: `rl:poll:${route}:${request.ip}`, limit: RATE_LIMITS.poll };
    if (!principal) return null; // A public route with no decorator, such as health.
    if (scope === 'search') return { key: `rl:search:${principal.userId}`, limit: RATE_LIMITS.search };
    if (principal.kind === 'agent') {
      return { key: `rl:token:${principal.tokenId}`, limit: RATE_LIMITS.agent };
    }
    if (principal.kind === 'hook') {
      return { key: `rl:token:${principal.tokenId}`, limit: RATE_LIMITS.hook };
    }
    return { key: `rl:user:${principal.userId}`, limit: this.config.HUB_RATE_LIMIT_USER ?? RATE_LIMITS.user };
  }

  private async count(key: string, limit: number): Promise<number | null> {
    try {
      const [count, ttl] = (await this.redis.main.eval(INCREMENT, 1, key, WINDOW_SEC)) as [number, number];
      return count > limit ? Math.max(ttl, 1) : null;
    } catch (error) {
      this.logger.warn(`Rate limit skipped: ${String(error)}`);
      return null;
    }
  }
}
