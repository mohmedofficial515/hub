/**
 * @file middleware.ts
 * @description Locale prefix and the auth redirect (docs/09 §1). It only looks for a session cookie, because a real check
 * needs the API: an expired session is caught by the client's 401 handling, which refreshes or sends the member to sign-in.
 * The refresh cookie never reaches a page URL, so `hub_session` stands for it. A session from before that marker still has
 * `hub_access` for up to 15 minutes and gets the marker on its next refresh; past that it signs in once.
 */
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

import { labPathAllowed } from './features/redesign/lab-path';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

const PUBLIC_SEGMENTS = new Set(['sign-in', 'totp', 'invite', 'reset', 'forgot']);
const ACCESS_COOKIE = 'hub_access';
const SESSION_MARKER_COOKIE = 'hub_session';

/** The lab behind Hub's proxy: a member's, like every page, and only the lab's own files (docs/16 §6). The dev server keeps its own list of folders too. */
function labGate(request: NextRequest) {
  if (!labPathAllowed(request.nextUrl.pathname)) return new NextResponse(null, { status: 404 });
  if (request.cookies.has(ACCESS_COOKIE) || request.cookies.has(SESSION_MARKER_COOKIE))
    return NextResponse.next();
  if (!request.headers.get('accept')?.includes('text/html')) return new NextResponse(null, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = `/${routing.defaultLocale}/sign-in`;
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export default function middleware(request: NextRequest) {
  if (/^\/lab(\/|$)/.test(request.nextUrl.pathname)) return labGate(request);
  const response = intl(request);
  // The intl middleware decided to redirect (no locale prefix yet): let it, the next request comes back here.
  if (response.headers.has('location')) return response;

  const [locale = routing.defaultLocale, first] = request.nextUrl.pathname.split('/').filter(Boolean);
  const signedIn = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(SESSION_MARKER_COOKIE);
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
  // Everything except the API proxy, Next's own files and anything with an extension. The lab's files have extensions and are still looked at.
  matcher: ['/lab', '/lab/:path*', '/((?!api|_next|lab(?:/|$)|.*\\..*).*)'],
};
