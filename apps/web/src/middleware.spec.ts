/**
 * @file Redirects keep the address the browser used, so another device behind `tailscale serve` is never sent to localhost (docs/16 D43).
 */
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

import middleware from './middleware';

// next-intl's middleware does not load under Vitest. This stand-in redirects as it does: from `nextUrl`, the bind address.
vi.mock('next-intl/middleware', async () => {
  const { NextResponse } = await import('next/server');
  return {
    default: () => (req: NextRequest) => {
      const [first] = req.nextUrl.pathname.split('/').filter(Boolean);
      if (first === 'ar' || first === 'en') return NextResponse.next();
      const url = req.nextUrl.clone();
      url.pathname = `/ar${req.nextUrl.pathname === '/' ? '' : req.nextUrl.pathname}`;
      return NextResponse.redirect(url);
    },
  };
});

const TAILNET = 'hub-main.tail0000.ts.net';

function request(path: string, headers: Record<string, string> = {}) {
  // Next sees its own bind address, as it does with `next start -H 127.0.0.1`.
  return new NextRequest(new URL(path, 'http://localhost:7300'), {
    headers: { host: 'localhost:7300', ...headers },
  });
}

const behindTailscale = { 'x-forwarded-host': TAILNET, 'x-forwarded-proto': 'https' };

describe('middleware redirects', () => {
  it('adds the locale at the tailnet address, not localhost', () => {
    const location = middleware(request('/', behindTailscale)).headers.get('location');
    expect(location).toMatch(new RegExp(`^https://${TAILNET.replaceAll('.', '\\.')}/ar`));
  });

  it('sends a signed-out page to sign-in at the tailnet address', () => {
    const location = middleware(request('/ar/goteav/today', behindTailscale)).headers.get('location');
    expect(location).toBe(`https://${TAILNET}/ar/sign-in?next=${encodeURIComponent('/ar/goteav/today')}`);
  });

  it('keeps localhost when nothing is forwarded', () => {
    const location = middleware(request('/ar/goteav/today')).headers.get('location');
    expect(location).toBe(`http://localhost:7300/ar/sign-in?next=${encodeURIComponent('/ar/goteav/today')}`);
  });

  it('lets a signed-in page through with no redirect', () => {
    const res = middleware(request('/ar/goteav/today', { ...behindTailscale, cookie: 'hub_session=1' }));
    expect(res.headers.get('location')).toBeNull();
  });
});
