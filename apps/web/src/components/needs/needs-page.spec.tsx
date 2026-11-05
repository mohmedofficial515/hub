/**
 * @file The Needs board: its stages, the four states, and D24's rule on the filled button.
 */
import { screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { NeedsPage } from './needs-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/needs',
}));

const me = {
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};

const need = (key: string, status: string, detail: Record<string, unknown> = {}) => ({
  id: key,
  key,
  type: 'need',
  status,
  title: `Need ${key}`,
  priority: 'P2',
  ownerRole: 'owner',
  createdAt: new Date().toISOString(),
  lastEventAt: new Date().toISOString(),
  createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
  flags: {},
  tags: [],
  detail: { kind: 'token', responsibleRole: 'owner', ...detail },
  blocks: [],
});

const answer =
  (needs: unknown[], status = 200) =>
  (url: URL) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/members')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/settings')) return { body: { data: [] } };
    if (url.pathname.endsWith('/cards')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/needs')) {
      return status === 200
        ? { body: { data: needs, meta: { pagination: { nextCursor: null, limit: 100 } } } }
        : { status, body: { error: { code: 'hub.common.internal', message: 'No', requestId: 'r1' } } };
    }
    return undefined;
  };

describe('NeedsPage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows a skeleton first, with a status region', () => {
    stubFetch(answer([]));
    renderWithApp(
      <Tooltip.Provider>
        <NeedsPage />
      </Tooltip.Provider>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Needs');
  });

  it('puts each need in its stage and draws its location as a pointer', async () => {
    stubFetch(
      answer([
        need('DMO-1', 'requested'),
        need('DMO-2', 'in_progress'),
        need('DMO-3', 'delivered', { location: '1Password › Goteav › PayTR', deliveredById: 'u2' }),
        need('DMO-4', 'verified', { verifiedById: 'u1' }),
      ]),
    );
    renderWithApp(
      <Tooltip.Provider>
        <NeedsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('Need DMO-1')).toBeTruthy();
    expect(screen.getByText('Need DMO-2')).toBeTruthy();
    expect(screen.getByText('PayTR')).toBeTruthy();
    // Verified stays off the board until asked for.
    expect(screen.queryByText('Need DMO-4')).toBeNull();
  });

  it('never fills Verify on my own delivery (D24)', async () => {
    stubFetch(answer([need('DMO-5', 'delivered', { location: 'vault', deliveredById: 'u1' })]));
    renderWithApp(
      <Tooltip.Provider>
        <NeedsPage />
      </Tooltip.Provider>,
    );
    await screen.findByText('Need DMO-5');
    const verify = await screen.findByRole('button', { name: 'Verify' });
    expect(verify.className).not.toContain('bg-primary');
  });

  it('has an honest empty state with the next step', async () => {
    stubFetch(answer([]));
    renderWithApp(
      <Tooltip.Provider>
        <NeedsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText(/When the team needs/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /New need/ }).className).toContain('bg-primary');
  });

  it('shows the API’s code when the list fails', async () => {
    stubFetch(answer([], 500));
    renderWithApp(
      <Tooltip.Provider>
        <NeedsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText(/hub\.common\.internal/)).toBeTruthy();
  });
});
