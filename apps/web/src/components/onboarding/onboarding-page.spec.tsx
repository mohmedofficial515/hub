/**
 * @file The Onboarding page in each state, the tick, and the manager's preview, which saves nothing.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { OnboardingPage } from './onboarding-page';

const page = (
  <Tooltip.Provider>
    <OnboardingPage />
  </Tooltip.Provider>
);

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/goteav/onboarding',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Sara Alharbi',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles }],
});

const items = [
  { id: 'what', kind: 'doc', title: 'What Goteav is', ref: 'docs/README.md', done: true, doneAt: 'x' },
  { id: 'arch', kind: 'doc', title: 'The architecture', ref: 'docs/01.md', done: false, doneAt: null },
  {
    id: 'pack',
    kind: 'action',
    title: 'Install the team pack',
    ref: 'install_pack',
    done: false,
    doneAt: null,
  },
];

function api(roles: string[], reply: { status?: number; body?: unknown }, settings: unknown = []) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/onboarding') && method === 'GET') return reply;
    if (url.pathname.endsWith('/done')) return { status: 204 };
    if (url.pathname.endsWith('/settings')) return { body: { data: settings } };
    if (url.pathname.endsWith('/docs/tree')) return { body: { data: [] } };
    return undefined;
  });
}

describe('OnboardingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    search.value = '';
  });

  it('shows a skeleton while it loads', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithApp(page);
    expect(screen.getByRole('status', { name: 'Loading your path' })).toBeInTheDocument();
  });

  it('tells a member who sets the path, and a manager where to set it', async () => {
    api(['qa'], { body: { data: [{ role: 'qa', items: [] }] } });
    const first = renderWithApp(page);
    expect(await screen.findByText(/has not set a reading path/)).toBeInTheDocument();
    first.unmount();
    api(['pm'], { body: { data: [{ role: 'pm', items: [] }] } });
    renderWithApp(page);
    expect(await screen.findByText('You have not set a reading path yet')).toBeInTheDocument();
  });

  it('names the error', async () => {
    api(['qa'], { status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByText('hub.common.internal')).toBeInTheDocument();
  });

  it('draws the trail, with one cell per step, and sets the next step beside it', async () => {
    api(['frontend', 'qa'], {
      body: {
        data: [
          { role: 'frontend', items },
          { role: 'qa', items: [items[0]] },
        ],
      },
    });
    renderWithApp(page);
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByRole('heading', { name: 'Welcome to Goteav, Sara' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The architecture' })).toBeInTheDocument();
  });

  it('ticks a step through the API, and a self-finishing step has no checkbox', async () => {
    const { calls } = api(['frontend'], { body: { data: [{ role: 'frontend', items }] } });
    renderWithApp(page);
    const box = await screen.findByRole('checkbox', { name: /The architecture/ });
    expect(screen.queryByRole('checkbox', { name: /Install the team pack/ })).not.toBeInTheDocument();
    await userEvent.click(box);
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/onboarding/arch/done'))).toBe(true),
    );
  });

  it('previews a role for a manager with nothing ticked and nothing to save', async () => {
    search.value = 'preview=qa';
    const { calls } = api(['owner'], { body: { data: [{ role: 'owner', items: [] }] } }, [
      { key: 'onboarding.paths', value: { qa: items } },
    ]);
    renderWithApp(page);
    expect(await screen.findByText(/This is what a new member/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method !== 'GET' && c.method !== 'HEAD')).toBe(false);
  });
});
