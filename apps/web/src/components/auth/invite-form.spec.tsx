/**
 * @file Accepting an invitation (docs/09 §1.3, docs/16 D68): the page's password rule is the API's, a browser signed in as someone else is
 * told so before anything is made, the invited account joins with one press, and a withdrawn link says so.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { InviteForm } from './invite-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/invite/tok',
}));

const preview = {
  email: 'friend@example.test',
  workspace: { slug: 'goteav', name: 'Goteav' },
  roles: ['backend'],
  expiresAt: '2030-01-01T00:00:00Z',
  invitedBy: 'Mohmed',
};
const account = (email: string) => ({
  id: 'u9',
  email,
  displayName: 'Someone',
  locale: 'en',
  avatarColor: 'teal',
  totpEnabled: false,
  createdAt: '2026-11-01T00:00:00Z',
  workspaces: [],
});

function answer(options: { me?: object | null; invite?: { status: number; code: string } } = {}) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    if (url.pathname.endsWith('/auth/invites/tok') && method === 'GET') {
      return options.invite
        ? { status: options.invite.status, body: { error: { code: options.invite.code, message: 'no' } } }
        : { body: { data: preview } };
    }
    if (url.pathname.endsWith('/auth/me')) {
      return options.me
        ? { body: { data: options.me } }
        : { status: 401, body: { error: { code: 'hub.common.unauthorized', message: 'no' } } };
    }
    if (url.pathname.endsWith('/auth/refresh')) {
      return { status: 401, body: { error: { code: 'hub.identity.refresh_invalid', message: 'no' } } };
    }
    if (url.pathname.endsWith('/auth/invites/tok/accept')) {
      return { status: 201, body: { data: { user: account(preview.email), workspace: { slug: 'goteav' } } } };
    }
    if (url.pathname.endsWith('/auth/sign-out')) return { status: 204 };
    return undefined;
  });
}

const posts = (calls: { method: string; path: string }[]) =>
  calls.filter((call) => call.method === 'POST').map((call) => call.path);

describe('InviteForm', () => {
  beforeEach(() => push.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  it('asks for 12 characters, as the API does, before it sends anything', async () => {
    const { calls } = answer();
    renderWithApp(<InviteForm token="tok" />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/Your name/), 'Friend');
    expect(screen.getByText('At least 12 characters.')).toBeTruthy();
    await user.type(screen.getByLabelText(/^Password/), 'elevenchars');
    await user.type(screen.getByLabelText(/Type it again/), 'elevenchars');
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(await screen.findByText('The password is shorter than 12 characters.')).toBeTruthy();
    expect(posts(calls)).toEqual([]);

    await user.clear(screen.getByLabelText(/^Password/));
    await user.clear(screen.getByLabelText(/Type it again/));
    await user.type(screen.getByLabelText(/^Password/), 'friend passphrase');
    await user.type(screen.getByLabelText(/Type it again/), 'friend passphrase');
    await user.click(screen.getByRole('button', { name: 'Create my account' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/goteav/onboarding'));
    expect(posts(calls)).toEqual(['/api/v1/auth/invites/tok/accept']);
  });

  it('a browser signed in as someone else is told so, and offered to sign out, with no form', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const { calls } = answer({ me: account('owner@example.test') });
    renderWithApp(<InviteForm token="tok" maybeSignedIn />);
    expect(
      await screen.findByRole('heading', { name: 'This browser is signed in with another account' }),
    ).toBeTruthy();
    expect(screen.getByText('friend@example.test')).toBeTruthy();
    expect(screen.getByText('owner@example.test')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create my account' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out and continue' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(posts(calls)).toEqual(['/api/v1/auth/sign-out']);
  });

  it('the invited account, signed in, joins with one press', async () => {
    const { calls } = answer({ me: account('Friend@Example.test') });
    renderWithApp(<InviteForm token="tok" maybeSignedIn />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Join the project' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/en/goteav/onboarding'));
    expect(calls.find((call) => call.path.endsWith('/accept'))?.body).toEqual({});
  });

  it('a stale cookie with no session left falls back to the form', async () => {
    answer({ me: null });
    renderWithApp(<InviteForm token="tok" maybeSignedIn />);
    expect(await screen.findByRole('button', { name: 'Create my account' })).toBeTruthy();
  });

  it('a withdrawn link says so, in Arabic too', async () => {
    answer({ invite: { status: 410, code: 'hub.identity.invite_revoked' } });
    renderWithApp(<InviteForm token="tok" />, { locale: 'ar' });
    expect(await screen.findByRole('heading', { name: 'سُحبت هذه الدعوة' })).toBeTruthy();
    expect(screen.getByText('اطلب من مالك المشروع دعوة جديدة.')).toBeTruthy();
  });
});
