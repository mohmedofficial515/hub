/**
 * @file The Redesign page in each state, on the shapes of docs/04 §3.14.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import en from '../../../messages/en/redesign.json';
import { RedesignPage } from './redesign-page';

const page = (
  <Tooltip.Provider>
    <RedesignPage />
  </Tooltip.Provider>
);

const search = { value: 'status=' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/goteav/redesign',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles }],
});

const version = (key: string, name: string, status: string, extra = {}) => ({
  id: key,
  key,
  type: 'redesign',
  title: `web/wallet · ${name} — Flight path`,
  status,
  priority: 'P2',
  ownerRole: 'designer',
  lastEventAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
  detail: {
    app: 'web',
    page: 'wallet',
    version: name,
    labPath: `web/wallet/${name}`,
    labUrl: `http://lab.test/#/web/wallet/${name}`,
    frontMatter: { title: 'Flight path' },
    touchesComponents: ['components/x.tsx'],
    ...extra,
  },
});

const pages = [
  {
    app: 'web',
    page: 'wallet',
    route: '/account/wallet',
    liveUrl: '/ar/account/wallet',
    status: 'designing',
    brief: '# Wallet\n\nText',
    versions: [
      version('GTV-1', 'v1-baseline', 'reference'),
      version('GTV-2', 'v2-flight', 'draft'),
      version('GTV-3', 'v3-tanks', 'review', { base: 'v1-baseline', reviewScore: 86, reviewSummary: 'Good' }),
    ],
  },
];

const shots = [
  {
    kind: 'screenshot',
    name: '1440-ltr-light.png',
    url: '/api/v1/workspaces/goteav/lab/file?path=web%2Fwallet%2Fv3%2Fshots%2F1440-ltr-light.png',
  },
];

function api(roles: string[], reply: { status?: number; body?: unknown }) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/redesign/pages')) return reply;
    if (url.pathname.endsWith('/attachments')) return { body: { data: shots } };
    return undefined;
  });
}

describe('RedesignPage', () => {
  afterEach(() => {
    search.value = 'status=';
    vi.unstubAllGlobals();
  });

  it('shows a skeleton while it loads', () => {
    stubFetch(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithApp(page);
    expect(screen.getByRole('status', { name: 'Loading lab pages' })).toBeInTheDocument();
  });

  it('says so honestly when the project has no lab', async () => {
    api(['owner'], { body: { data: [] } });
    renderWithApp(page);
    expect(await screen.findByText('No lab pages yet')).toBeInTheDocument();
  });

  it('names the error and offers a retry', async () => {
    api(['owner'], {
      status: 503,
      body: { error: { code: 'hub.redesign.lab_unavailable', message: 'No lab' } },
    });
    renderWithApp(page);
    expect(await screen.findByText('hub.redesign.lab_unavailable')).toBeInTheDocument();
  });

  it('lays a review open with the real picture, and the rail lists every version', async () => {
    api(['owner'], { body: { data: pages } });
    renderWithApp(page);
    expect(await screen.findByRole('heading', { name: 'Wallet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByRole('list', { name: /Versions of Wallet/ }).children).toHaveLength(3);
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Screenshot of v3-tanks' })).toHaveAttribute(
        'src',
        expect.stringContaining('/lab/file?path='),
      ),
    );
    expect(screen.getByLabelText('Review score 86 out of 100')).toBeInTheDocument();
  });

  it('leaves the verdict to the owner', async () => {
    api(['frontend'], { body: { data: pages } });
    renderWithApp(page);
    const wrapper = await screen.findByRole('button', { name: 'Approve: Owner decides' });
    expect(wrapper).toHaveAttribute('aria-disabled', 'true');
    expect(within(wrapper).getByText('Approve').closest('button')).toBeDisabled();
  });

  const settled = [
    {
      ...pages[0],
      versions: [version('GTV-1', 'v1-baseline', 'reference'), version('GTV-2', 'v2-flight', 'approved')],
    },
  ];

  it('opens the owner on the gallery when nothing waits for his verdict', async () => {
    search.value = '';
    const replace = vi.spyOn(window.history, 'replaceState');
    api(['owner'], { body: { data: settled } });
    renderWithApp(page);
    expect(await screen.findByRole('heading', { name: 'Wallet' })).toBeInTheDocument();
    expect(screen.queryByText(en.noMatchTitle)).toBeNull();
    expect(replace.mock.calls.some(([, , href]) => String(href).includes('status=review'))).toBe(false);
    replace.mockRestore();
  });

  it('still opens the owner on review when a version waits', async () => {
    search.value = '';
    const replace = vi.spyOn(window.history, 'replaceState');
    api(['owner'], { body: { data: pages } });
    renderWithApp(page);
    await screen.findByRole('heading', { name: 'Wallet' });
    await waitFor(() =>
      expect(replace.mock.calls.some(([, , href]) => String(href).includes('status=review'))).toBe(true),
    );
    replace.mockRestore();
  });

  it('says the review is done when the last one was approved', async () => {
    search.value = 'status=review';
    api(['owner'], { body: { data: settled } });
    renderWithApp(page);
    expect(await screen.findByText(en.reviewDoneTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.showAllVersions })).toBeInTheDocument();
    expect(screen.queryByText(en.noMatchTitle)).toBeNull();
  });
});
