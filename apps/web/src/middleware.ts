/**
 * @file middleware.ts
 * @description Locale prefix and the auth redirect (docs/09 §1). It only looks for a session cookie, because a real check
 * needs the API: an expired session is caught by the client's 401 handling, which refreshes or sends the member to sign-in.
 */
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

const PUBLIC_SEGMENTS = new Set(['sign-in', 'totp', 'invite', 'reset', 'forgot']);
const ACCESS_COOKIE = 'hub_access';
const REFRESH_COOKIE = 'hub_refresh';

export default function middleware(request: NextRequest) {
  const response = intl(request);
  // The intl middleware decided to redirect (no locale prefix yet): let it, the next request comes back here.
  if (response.headers.has('location')) return response;

  const [locale = routing.defaultLocale, first] = request.nextUrl.pathname.split('/').filter(Boolean);
  const signedIn = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  if (!signedIn && !(first && PUBLIC_SEGMENTS.has(first))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.search = first
      ? `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
      : '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Everything except the API proxy, Next's own files and anything with an extension.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
