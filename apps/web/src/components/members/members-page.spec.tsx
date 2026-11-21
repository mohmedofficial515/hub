/**
 * @file Members: manager and member views, invites, the four states.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as KitModule from '@/components/kit';
import { renderWithApp, stubFetch } from '@/test/render';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/components/kit', async (original) => ({
  ...(await original<typeof KitModule>()),
  navigate,
}));

const { MembersPage } = await import('./members-page');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/members',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Owner One',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
});
const row = (userId: string, name: string, roles: string[], extra = {}) => ({
  userId,
  email: `${userId}@hub.test`,
  displayName: name,
  avatarColor: 'teal',
  roles,
  status: 'active',
  joinedAt: '2026-11-01T00:00:00Z',
  lastSeenAt: null,
  githubLogins: [],
  totpEnabled: true,
  ...extra,
});
const members = [
  row('u1', 'Owner One', ['owner']),
  row('u2', 'Sara Dev', ['frontend'], { totpEnabled: false }),
];
const invite = {
  id: 'i1',
  email: 'new@hub.test',
  roles: ['qa'],
  createdBy: 'u1',
  expiresAt: '2030-01-01T00:00:00Z',
  acceptedAt: null,
  revokedAt: null,
  status: 'pending',
};

const answer =
  (roles: string[], team: unknown[] = members, invites: unknown[] = [invite], status = 200) =>
  (url: URL) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/settings')) {
      return { body: { data: [{ key: 'security.totp_required_roles', value: ['owner'], default: [] }] } };
    }
    if (url.pathname.endsWith('/invites')) return { body: { data: invites } };
    if (url.pathname.endsWith('/members')) {
      return status === 200
        ? { body: { data: team, meta: { pagination: { nextCursor: null, limit: 100 } } } }
        : { status, body: { error: { code: 'hub.common.internal', message: 'No', requestId: 'r1' } } };
    }
    return undefined;
  };

describe('MembersPage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows a skeleton first', () => {
    stubFetch(answer(['owner']));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('gives a manager emails, the waiting room and Invite', async () => {
    stubFetch(answer(['owner']));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('new@hub.test')).toBeTruthy();
    expect(screen.getAllByText('u2@hub.test').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Invite member/ })).toBeTruthy();
  });

  it('shows every invite’s status: waiting and expired get New link, joined and revoked sit below the team', async () => {
    const invites = [
      invite,
      { ...invite, id: 'i2', email: 'late@hub.test', expiresAt: '2026-01-01T00:00:00Z', status: 'expired' },
      {
        ...invite,
        id: 'i3',
        email: 'joined@hub.test',
        acceptedAt: '2026-11-02T00:00:00Z',
        status: 'accepted',
      },
      { ...invite, id: 'i4', email: 'gone@hub.test', revokedAt: '2026-11-03T00:00:00Z', status: 'revoked' },
    ];
    stubFetch(answer(['owner'], members, invites));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('new@hub.test')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New link for new@hub.test' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New link for late@hub.test' })).toBeTruthy();
    expect(screen.getByText(/^Expired /)).toBeTruthy();
    const earlier = screen.getByRole('region', { name: /Earlier invites/ });
    expect(earlier).toHaveTextContent('joined@hub.test');
    expect(earlier).toHaveTextContent(/Joined /);
    expect(earlier).toHaveTextContent('gone@hub.test');
    expect(earlier).toHaveTextContent(/Revoked /);
    expect(screen.queryByRole('button', { name: 'New link for joined@hub.test' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New link for gone@hub.test' })).toBeNull();
  });

  it('hides emails and invites from everyone else, and does not ask for invites', async () => {
    const { calls } = stubFetch(answer(['frontend']));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    await waitFor(() => expect(screen.getAllByText('Sara Dev').length).toBeGreaterThan(0));
    expect(screen.queryByText('u2@hub.test')).toBeNull();
    expect(screen.queryByRole('button', { name: /Invite member/ })).toBeNull();
    expect(calls.some((c) => c.path.endsWith('/invites'))).toBe(false);
  });

  it('with nobody else, the empty state carries the filled Invite', async () => {
    stubFetch(answer(['owner'], [members[0]], []));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    const invites = await screen.findAllByRole('button', { name: /Invite member/ });
    expect(invites).toHaveLength(1);
    expect(invites[0]?.className).toContain('bg-primary');
  });

  it('shows the API’s code when the list fails', async () => {
    stubFetch(answer(['owner'], [], [], 500));
    renderWithApp(
      <Tooltip.Provider>
        <MembersPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText(/hub\.common\.internal/)).toBeTruthy();
  });

  it('sends My profile to Settings › Account, where the profile lives now', async () => {
    stubFetch(answer(['owner']));
    renderWithApp(
      <Tooltip.Provider>
        <div id="hub-root">
          <MembersPage />
        </div>
      </Tooltip.Provider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Options for Owner One' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'My profile' }));
    expect(navigate).toHaveBeenCalledWith('settings', { query: { tab: 'account' } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
