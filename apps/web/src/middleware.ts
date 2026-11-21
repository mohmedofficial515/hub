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

/**
 * The address the browser used. Behind `tailscale serve` Next builds `nextUrl` from its own bind address (`-H 127.0.0.1`), so a
 * redirect would send another device to `https://localhost:7300` (docs/16 D43). The forwarded headers carry the real one; once
 * Hub is published it listens on 127.0.0.1 only, so only the local proxy can set them.
 */
function asSeenByBrowser(request: NextRequest, target: URL | string) {
  const url = new URL(target);
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host'))
    ?.split(',')[0]
    ?.trim();
  if (!host) return url;
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwarded === 'https' || forwarded === 'http' ? forwarded : url.protocol.slice(0, -1);
  // A new origin, not `url.host = …`: that keeps the old port when the new host has none.
  return new URL(`${url.pathname}${url.search}${url.hash}`, `${proto}://${host}`);
}

function redirectTo(request: NextRequest, url: URL) {
  return NextResponse.redirect(asSeenByBrowser(request, url));
}

/** The lab behind Hub's proxy: a member's, like every page, and only the lab's own files (docs/16 §6). The dev server keeps its own list of folders too. */
function labGate(request: NextRequest) {
  if (!labPathAllowed(request.nextUrl.pathname)) return new NextResponse(null, { status: 404 });
  if (request.cookies.has(ACCESS_COOKIE) || request.cookies.has(SESSION_MARKER_COOKIE))
    return NextResponse.next();
  if (!request.headers.get('accept')?.includes('text/html')) return new NextResponse(null, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = `/${routing.defaultLocale}/sign-in`;
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return redirectTo(request, url);
}

export default function middleware(request: NextRequest) {
  if (/^\/lab(\/|$)/.test(request.nextUrl.pathname)) return labGate(request);
  const response = intl(request);
  // The intl middleware decided to redirect (no locale prefix yet): let it, at the browser's address; the next request comes back here.
  const location = response.headers.get('location');
  if (location) {
    response.headers.set('location', asSeenByBrowser(request, new URL(location, request.nextUrl)).toString());
    return response;
  }

  const [locale = routing.defaultLocale, first] = request.nextUrl.pathname.split('/').filter(Boolean);
  const signedIn = request.cookies.has(ACCESS_COOKIE) || request.cookies.has(SESSION_MARKER_COOKIE);
  if (!signedIn && !(first && PUBLIC_SEGMENTS.has(first))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.search = first
      ? `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
      : '';
    return redirectTo(request, url);
  }
  return response;
}

export const config = {
  // Everything except the API proxy, Next's own files and anything with an extension. The lab's files have extensions and are still looked at.
  matcher: ['/lab', '/lab/:path*', '/((?!api|_next|lab(?:/|$)|.*\\..*).*)'],
};
