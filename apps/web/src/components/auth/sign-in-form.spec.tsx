/**
 * @file Sign-in: requests, errors, and where it goes next (docs/09 §1.1).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { SignInForm } from './sign-in-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/sign-in',
}));

const fillForm = async (password: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Email/), 'a@example.test');
  await user.type(screen.getByLabelText(/^Password/), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('SignInForm', () => {
  beforeEach(() => push.mockClear());

  it('goes to the only project on success', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/auth/sign-in')
        ? { body: { data: { totpRequired: false, user: { workspaces: [{ slug: 'goteav' }] } } } }
        : undefined,
    );
    renderWithApp(<SignInForm />);
    await fillForm('correct horse');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/goteav/today'));
  });

  it('keeps the email and says so on a wrong password', async () => {
    stubFetch(() => ({
      status: 401,
      body: { error: { code: 'hub.identity.invalid_credentials', message: 'x' } },
    }));
    renderWithApp(<SignInForm />);
    await fillForm('nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(screen.getByLabelText(/Email/)).toHaveValue('a@example.test');
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the locked message on a rate limit too', async () => {
    stubFetch(() => ({ status: 429, body: { error: { code: 'hub.common.rate_limited', message: 'x' } } }));
    renderWithApp(<SignInForm />);
    await fillForm('nope');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts');
  });

  it('goes to /totp with a challenge', async () => {
    stubFetch(() => ({ body: { data: { totpRequired: true, challenge: 'c1' } } }));
    renderWithApp(<SignInForm />);
    await fillForm('correct horse');
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/totp'));
    expect(sessionStorage.getItem('hub:totp-challenge')).toBe('c1');
  });

  it('refuses an empty form without a request', async () => {
    const { calls } = stubFetch(() => undefined);
    renderWithApp(<SignInForm />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your email to continue.')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('renders in Arabic', () => {
    stubFetch(() => undefined);
    renderWithApp(<SignInForm />, { locale: 'ar' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('الدخول إلى Hub');
  });
});
