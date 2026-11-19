/**
 * @file The Releases page in each state, on the shapes of docs/04 §3.20.
 */
import { screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { ReleasesPage } from './releases-page';

const page = (
  <Tooltip.Provider>
    <ReleasesPage />
  </Tooltip.Provider>
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/releases',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles }],
});

const base = {
  type: 'release',
  priority: 'P2',
  ownerRole: 'pm',
  lastEventAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
};
const task = (key: string, status = 'done') => ({
  ...base,
  id: key,
  key,
  type: 'task',
  title: `Task ${key}`,
  status,
  closedAt: '2026-11-02T00:00:00Z',
});

const releases = [
  {
    ...base,
    id: 'r2',
    key: 'GTV-20',
    title: 'Release 2026-11-10 · Wallet',
    status: 'planned',
    detail: {
      version: '2026-11-10',
      repo: 'backend',
      includedKeys: ['GTV-5'],
      notes: { team: '## Team\nShipped things', owner: null, accountant: null },
    },
  },
  {
    ...base,
    id: 'r1',
    key: 'GTV-10',
    title: 'Release 2026-10-20 · Search',
    status: 'released',
    detail: {
      version: '2026-10-20',
      repo: 'web',
      tag: 'v1',
      releasedAt: '2026-10-20T10:00:00Z',
      includedKeys: [],
      notes: { team: 'x', owner: 'y', accountant: 'z' },
    },
  },
];

function api(roles: string[], reply: { status?: number; body?: unknown }) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/releases')) return reply;
    if (url.pathname.endsWith('/events')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/cards')) {
      return { body: { data: [task('GTV-5'), task('GTV-6')], meta: { pagination: {} } } };
    }
    return undefined;
  });
}

describe('ReleasesPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a skeleton while it loads', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithApp(page);
    expect(screen.getByRole('status', { name: 'Loading the releases' })).toBeInTheDocument();
  });

  it('offers a manager the first release when there is none', async () => {
    api(['owner'], { body: { data: [], meta: { pagination: {} } } });
    renderWithApp(page);
    expect(await screen.findByText('No releases yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New release' })).toBeEnabled();
  });

  it('offers others no button when there is none', async () => {
    api(['qa'], { body: { data: [], meta: { pagination: {} } } });
    renderWithApp(page);
    expect(await screen.findByText('No releases yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New release' })).not.toBeInTheDocument();
  });

  it('names the error', async () => {
    api(['owner'], { status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByText('hub.common.internal')).toBeInTheDocument();
  });

  it('lays the next release open, and counts what waits', async () => {
    api(['pm'], { body: { data: releases, meta: { pagination: {} } } });
    renderWithApp(page);
    expect(await screen.findByRole('heading', { name: 'Release 2026-11-10 · Wallet' })).toBeInTheDocument();
    expect(screen.getByText(/Shipped things/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rebuild skeleton' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Release 2026-10-20 · Search' })).toBeInTheDocument();
    expect(await screen.findByText(/1 finished card is outside any release/)).toBeInTheDocument();
  });

  it('keeps the release button from those who may not', async () => {
    api(['qa'], { body: { data: releases, meta: { pagination: {} } } });
    renderWithApp(page);
    await screen.findByRole('heading', { name: 'Release 2026-11-10 · Wallet' });
    const wrapper = screen.getByLabelText('Mark released: Needs the owner or PM role.');
    expect(wrapper).toHaveAttribute('role', 'button');
    expect(wrapper).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: 'Rebuild skeleton' })).not.toBeInTheDocument();
  });

  it('labels a code block’s copy button in words, never with a raw {name}', async () => {
    const withCode = [
      {
        ...releases[0],
        detail: {
          ...releases[0]!.detail,
          notes: {
            team: ['Run:', '', '```sh', 'pnpm build', '```'].join('\n'),
            owner: null,
            accountant: null,
          },
        },
      },
    ];
    api(['pm'], { body: { data: withCode, meta: { pagination: {} } } });
    renderWithApp(page);
    await screen.findByRole('heading', { name: 'Release 2026-11-10 · Wallet' });
    await screen.findByText('pnpm build');
    const labels = [...document.querySelectorAll('[aria-label]')].map(
      (el) => el.getAttribute('aria-label') ?? '',
    );
    expect(labels.some((label) => label.includes('{name}'))).toBe(false);
  });

  it('counts every finished card, past the first page', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => task(`GTV-${100 + i}`));
    stubFetch((url) => {
      if (url.pathname.endsWith('/auth/me')) return { body: { data: me(['pm']) } };
      if (url.pathname.endsWith('/releases')) return { body: { data: releases, meta: { pagination: {} } } };
      if (url.pathname.endsWith('/events')) return { body: { data: [], meta: {} } };
      if (url.pathname.endsWith('/cards')) {
        const second = url.searchParams.get('cursor') === 'c2';
        return {
          body: {
            data: second ? rows.slice(100) : rows.slice(0, 100),
            meta: { pagination: { nextCursor: second ? null : 'c2', limit: 100 } },
          },
        };
      }
      return undefined;
    });
    renderWithApp(page);
    expect(await screen.findByText(/120 finished cards are outside any release/)).toBeInTheDocument();
  });

  it('asks for the repo as free text, with no other project’s list', async () => {
    api(['owner'], { body: { data: [], meta: { pagination: {} } } });
    renderWithApp(page);
    (await screen.findByRole('button', { name: 'New release' })).click();
    const repo = await screen
      .findByRole('combobox', { name: 'Repo' })
      .catch(() => screen.getByLabelText('Repo'));
    expect(repo.tagName).toBe('INPUT');
    expect(screen.queryByRole('option', { name: 'dashboard' })).toBeNull();
    expect(document.querySelectorAll('datalist option')).toHaveLength(0);
  });
});
