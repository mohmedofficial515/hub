/**
 * @file Session cookies (docs/04 §1.6): HttpOnly, SameSite=Lax, and the refresh cookie only reaches its route.
 * @description `Secure` follows HUB_PUBLIC_URL: on for https, off for the first release's plain
 * http://localhost (docs/15 D33), where a browser that is not on localhost would drop a Secure cookie.
 */
import type { CookieOptions, Request, Response } from 'express';

import { AppException } from '@/shared/errors';

import type { IssuedSession } from '../application/session.service';

export const ACCESS_COOKIE = 'hub_access';
export const REFRESH_COOKIE = 'hub_refresh';
export const REFRESH_PATH = '/api/v1/auth/refresh';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'hub';

interface CookieConfig {
  readonly HUB_PUBLIC_URL: string;
  readonly SESSION_COOKIE_DOMAIN?: string | undefined;
}

export function baseCookieOptions(config: CookieConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.HUB_PUBLIC_URL.startsWith('https://'),
    ...(config.SESSION_COOKIE_DOMAIN ? { domain: config.SESSION_COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookies(
  response: Response,
  session: IssuedSession,
  config: CookieConfig,
  now: Date,
): void {
  const base = baseCookieOptions(config);
  response.cookie(ACCESS_COOKIE, session.accessToken, {
    ...base,
    path: '/',
    maxAge: session.accessExpiresAt.getTime() - now.getTime(),
  });
  response.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...base,
    path: REFRESH_PATH,
    maxAge: session.refreshExpiresAt.getTime() - now.getTime(),
  });
}

export function clearSessionCookies(response: Response, config: CookieConfig): void {
  const base = baseCookieOptions(config);
  response.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  response.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_PATH });
}

export function cookieOf(request: Request, name: string): string | undefined {
  const value = (request.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** A cookie request that changes something must carry the custom header, which forces a CORS preflight. */
export function assertCsrfHeader(request: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (request.header(CSRF_HEADER) !== CSRF_VALUE) throw new AppException('hub.common.forbidden');
}
