/**
 * @file Two-step sign-in: no state ends on a button that can never work, and a lock reads as a lock (docs/09 §1.2).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { TotpForm } from './totp-form';

const push = vi.fn();
const search = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/totp',
}));

describe('TotpForm', () => {
  beforeEach(() => {
    push.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('offers to start again when the setup fails, and starts again on the press', async () => {
    search.value = 'setup=1';
    let fail = true;
    const { calls } = stubFetch((url) => {
      if (!url.pathname.endsWith('/auth/totp/setup')) return undefined;
      return fail
        ? { status: 503, body: { error: { code: 'hub.common.unavailable', message: 'down' } } }
        : { body: { data: { secret: 'ABCDEF', otpauthUrl: 'otpauth://totp/Hub?secret=ABCDEF' } } };
    });
    renderWithApp(<TotpForm />);
    const retry = await screen.findByRole('button', { name: 'Retry' });
    fail = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByText('ABCDEF')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/auth/totp/setup'))).toHaveLength(2);
  });

  it('goes on to where the member was heading when two-step is already on', async () => {
    search.value = 'setup=1';
    stubFetch((url) => {
      if (url.pathname.endsWith('/auth/totp/setup')) {
        return { status: 409, body: { error: { code: 'hub.identity.totp_already_enabled', message: 'on' } } };
      }
      if (url.pathname.endsWith('/auth/me')) {
        return { body: { data: { id: 'u1', displayName: 'M', workspaces: [{ slug: 'goteav' }] } } };
      }
      return undefined;
    });
    renderWithApp(<TotpForm />);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/goteav/today'));
  });

  it('says the account is locked on a rate limit, not that the server is down', async () => {
    search.value = '';
    sessionStorage.setItem('hub:totp-challenge', 'c1');
    stubFetch((url) =>
      url.pathname.endsWith('/auth/totp/verify')
        ? { status: 429, body: { error: { code: 'hub.common.rate_limited', message: 'x' } } }
        : undefined,
    );
    renderWithApp(<TotpForm />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/code/i), '123456');
    await user.click(screen.getByRole('button', { name: /Verify|Continue|Sign in/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });
});
