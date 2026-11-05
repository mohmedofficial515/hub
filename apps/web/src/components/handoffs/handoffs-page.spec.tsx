/**
 * @file Handoffs: the relay's counts, desks by receiving role, the four states and D25's Acknowledge.
 */
import { screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { HandoffsPage } from './handoffs-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/handoffs',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
});

const handoff = (key: string, status: string, detail: Record<string, unknown> = {}) => ({
  id: key,
  key,
  type: 'handoff',
  status,
  title: `Handoff no. ${key.slice(4)}`,
  priority: 'P2',
  ownerRole: detail['toRole'] ?? 'frontend',
  createdAt: new Date().toISOString(),
  lastEventAt: new Date().toISOString(),
  createdBy: { kind: 'user', userId: 'u2', displayName: 'Ali', via: 'web' },
  flags: {},
  tags: [],
  detail: {
    kind: 'contract',
    fromRole: 'backend',
    toRole: 'frontend',
    severity: 'notable',
    summary: 'A summary',
    payload: {},
    ...detail,
  },
});

const answer =
  (rows: unknown[], roles = ['owner'], status = 200) =>
  (url: URL) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/members')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/settings')) return { body: { data: [] } };
    if (url.pathname.endsWith('/cards')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/handoffs')) {
      return status === 200
        ? { body: { data: rows, meta: { pagination: { nextCursor: null, limit: 100 } } } }
        : { status, body: { error: { code: 'hub.common.internal', message: 'No', requestId: 'r1' } } };
    }
    return undefined;
  };

describe('HandoffsPage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('shows a skeleton first', () => {
    stubFetch(answer([]));
    renderWithApp(
      <Tooltip.Provider>
        <HandoffsPage />
      </Tooltip.Provider>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('counts every stop on the relay and lists what is moving', async () => {
    stubFetch(
      answer([handoff('DMO-1', 'pending'), handoff('DMO-2', 'acknowledged'), handoff('DMO-3', 'applied')]),
    );
    renderWithApp(
      <Tooltip.Provider>
        <HandoffsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('Handoff no. 1')).toBeTruthy();
    expect(screen.getByText('Handoff no. 2')).toBeTruthy();
    expect(screen.queryByText('Handoff no. 3')).toBeNull();
    const relay = screen.getByRole('group', { name: /./ });
    expect(within(relay).getAllByRole('button')).toHaveLength(4);
  });

  it('lets the owner acknowledge a handoff routed to another role (D25)', async () => {
    stubFetch(answer([handoff('DMO-4', 'pending')]));
    renderWithApp(
      <Tooltip.Provider>
        <HandoffsPage />
      </Tooltip.Provider>,
    );
    await screen.findByText('Handoff no. 4');
    expect((await screen.findByRole('button', { name: /Acknowledge/ })).hasAttribute('disabled')).toBe(false);
  });

  it('has an honest empty state', async () => {
    stubFetch(answer([]));
    renderWithApp(
      <Tooltip.Provider>
        <HandoffsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByRole('button', { name: /New handoff/ })).toBeTruthy();
  });

  it('shows the API’s code when the list fails', async () => {
    stubFetch(answer([], ['owner'], 500));
    renderWithApp(
      <Tooltip.Provider>
        <HandoffsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText(/hub\.common\.internal/)).toBeTruthy();
  });
});
