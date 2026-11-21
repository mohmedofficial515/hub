/**
 * @file The breadcrumb names a plan's or a doc's own page and links back to its lists, and the project is a way to Today.
 */
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { Breadcrumb } from './header';

const route = vi.hoisted(() => ({ path: '/en/goteav/planning', search: 'plan=GTV-9&status=active' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.search),
  usePathname: () => route.path,
}));

const me = {
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] }],
};

describe('Breadcrumb', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads Project › Planning (a link back, filters kept) › GTV-9 on a plan’s page', async () => {
    window.history.replaceState(null, '', `${route.path}?${route.search}`);
    stubFetch((url) => (url.pathname.endsWith('/auth/me') ? { body: { data: me } } : undefined));
    renderWithApp(<Breadcrumb />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Goteav' })).toHaveAttribute('href', '/en/goteav/today'),
    );
    expect(within(nav).getByRole('link', { name: 'Planning' })).toHaveAttribute(
      'href',
      '/en/goteav/planning?status=active',
    );
    expect(within(nav).getByText('GTV-9').closest('[aria-current="page"]')).toBeTruthy();
  });

  it('keeps the page itself as the current crumb on the lists', () => {
    route.search = '';
    window.history.replaceState(null, '', route.path);
    stubFetch(() => undefined);
    renderWithApp(<Breadcrumb />);
    expect(screen.getByText('Planning').closest('[aria-current="page"]')).toBeTruthy();
  });
});
