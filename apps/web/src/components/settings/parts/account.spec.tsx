/**
 * @file Settings › Account: the profile that left Members. It shows the saved name, holds only what changed, undoes it, checks the
 * password before sending, and saves only the changed fields.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllDrafts } from '@/features/settings/drafts';
import { renderWithApp, stubFetch } from '@/test/render';

import { AccountTab } from './account';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=account'),
  usePathname: () => '/en/demo/settings',
}));

const me = {
  id: 'u1',
  displayName: 'Owner One',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};

const serve = () =>
  stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/settings')) {
      return { body: { data: [{ key: 'security.totp_required_roles', value: ['owner'], default: [] }] } };
    }
    if (url.pathname.endsWith('/me') && method === 'PATCH') return { body: { data: me } };
    return undefined;
  });

const mount = () =>
  renderWithApp(
    <Tooltip.Provider>
      <div id="hub-root">
        <AccountTab />
      </div>
    </Tooltip.Provider>,
  );

describe('AccountTab', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    clearAllDrafts();
  });

  it('shows the saved name, and Undo brings it back after an edit', async () => {
    serve();
    mount();
    const name = screen.getByLabelText(/Display name/);
    await waitFor(() => expect(name).toHaveValue('Owner One'));
    expect(screen.queryByText('Changes not saved yet')).toBeNull();
    fireEvent.change(name, { target: { value: 'Someone else' } });
    expect(screen.getByText('Changes not saved yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo changes' }));
    expect(screen.getByLabelText(/Display name/)).toHaveValue('Owner One');
    expect(screen.queryByText('Changes not saved yet')).toBeNull();
  });

  it('keeps an unsaved name through a tab switch, and never keeps a password (docs/08 §5.7)', async () => {
    serve();
    const first = mount();
    await waitFor(() => expect(screen.getByLabelText(/Display name/)).toHaveValue('Owner One'));
    fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: 'Someone else' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'a-long-new-password' } });
    first.unmount();
    mount();
    expect(screen.getByLabelText(/Display name/)).toHaveValue('Someone else');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByText('Changes not saved yet')).toBeInTheDocument();
  });

  it('asks for the current password and 12 characters before sending anything', async () => {
    const { calls } = serve();
    mount();
    await waitFor(() => expect(screen.getByLabelText(/Display name/)).toHaveValue('Owner One'));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Use at least 12 characters.')).toBeInTheDocument();
    expect(screen.getByText('Write your current password.')).toBeInTheDocument();
    expect(calls.some((call) => call.method !== 'GET')).toBe(false);
  });

  it('saves only the name that changed', async () => {
    const { calls } = serve();
    mount();
    await waitFor(() => expect(screen.getByLabelText(/Display name/)).toHaveValue('Owner One'));
    fireEvent.change(screen.getByLabelText(/Display name/), { target: { value: 'Owner Two' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      const call = calls.find((each) => each.method === 'PATCH' && each.path.endsWith('/me'));
      expect(call?.body).toEqual({ displayName: 'Owner Two' });
    });
  });

  it('says two-step sign-in is on and required for the role, with no switch to turn it off', async () => {
    serve();
    mount();
    expect(await screen.findByText(/On\. Your role requires it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).toBeNull();
    expect(screen.getAllByText('Not connected')).toHaveLength(3);
  });
});
