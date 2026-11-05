/**
 * @file The client's session handling: refresh once and retry, never refresh on wrong credentials, enrol when TOTP is required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubFetch } from '@/test/render';

import { get, refreshSession, totpSetupPath } from './client';

const refreshed = (calls: { path: string }[]) => calls.filter((c) => c.path.endsWith('/auth/refresh')).length;

describe('client', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes on session_expired and retries the request', async () => {
    let expired = true;
    const { calls } = stubFetch((url) => {
      if (url.pathname.endsWith('/auth/refresh')) {
        expired = false;
        return { body: { data: {} } };
      }
      return expired
        ? { status: 401, body: { error: { code: 'hub.identity.session_expired', message: 'x' } } }
        : { body: { data: { ok: true } } };
    });
    await expect(get('workspaces')).resolves.toEqual({ ok: true });
    expect(refreshed(calls)).toBe(1);
  });

  it('sends the CSRF header on the refresh', async () => {
    const { fake } = stubFetch(() => ({ body: { data: {} } }));
    await refreshSession();
    expect(fake.mock.calls[0]?.[1]?.headers).toMatchObject({ 'X-Requested-With': 'hub' });
  });

  it('shares one refresh between requests in a tab', async () => {
    const { calls } = stubFetch(() => ({ body: { data: {} } }));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(refreshed(calls)).toBe(1);
  });

  it('does not refresh again when another tab just did', async () => {
    localStorage.setItem('hub:refreshed-at', String(Date.now()));
    const { calls } = stubFetch(() => ({ body: { data: {} } }));
    await expect(refreshSession()).resolves.toBe(true);
    expect(refreshed(calls)).toBe(0);
  });

  it('holds the Web Lock while refreshing', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<boolean>) => fn());
    vi.stubGlobal('navigator', { locks: { request } });
    stubFetch(() => ({ body: { data: {} } }));
    await refreshSession();
    expect(request).toHaveBeenCalledWith('hub-refresh', expect.any(Function));
  });

  it('does not refresh on wrong credentials', async () => {
    const { calls } = stubFetch(() => ({
      status: 401,
      body: { error: { code: 'hub.identity.invalid_credentials', message: 'x' } },
    }));
    await expect(get('auth/password/change')).rejects.toMatchObject({
      code: 'hub.identity.invalid_credentials',
    });
    expect(refreshed(calls)).toBe(0);
  });

  it('still fails the request on totp_setup_required, and knows where enrolment is', async () => {
    stubFetch(() => ({
      status: 403,
      body: { error: { code: 'hub.identity.totp_setup_required', message: 'x' } },
    }));
    await expect(get('workspaces/goteav/cards')).rejects.toMatchObject({
      code: 'hub.identity.totp_setup_required',
    });
    expect(totpSetupPath('ar', '/ar/goteav/today', '?x=1')).toBe(
      '/ar/totp?setup=1&next=%2Far%2Fgoteav%2Ftoday%3Fx%3D1',
    );
  });
});
