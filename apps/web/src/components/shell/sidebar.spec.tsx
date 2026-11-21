/**
 * @file The sidebar: the five groups of 2026-11-19 (Work, Follow, Delivery, Knowledge, Project), Planning first in Work (docs/15 §4), no Live
 * item, Getting started only while steps are left, badges in words, the project switcher (docs/15 §5), in both directions.
 */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { DesktopSidebar } from './sidebar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/tasks',
}));

const me = {
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [
    { slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] },
    { slug: 'hub', name: 'Hub', keyPrefix: 'HUB', roles: ['owner'] },
  ],
};

const api = (url: URL) => {
  if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
  if (url.pathname.endsWith('/inbox/count')) return { body: { data: { unread: 3 } } };
  if (url.pathname.endsWith('/tasks/ready')) {
    return { body: { data: [{ key: 'GTV-1', type: 'task', status: 'ready' }], meta: {} } };
  }
  return undefined;
};

const mount = (locale: 'ar' | 'en' = 'en') =>
  renderWithApp(
    <div id="hub-root">
      <Tooltip.Provider>
        <DesktopSidebar onShortcuts={vi.fn()} />
      </Tooltip.Provider>
    </div>,
    { locale },
  );

describe('DesktopSidebar', () => {
  beforeEach(() => {
    // A wide window: the sidebar shows its labels.
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches: true,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists Planning first in Work, and marks the current page', async () => {
    stubFetch(api);
    mount();
    const work = screen.getByRole('region', { name: 'Work' });
    const links = within(work).getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/en/goteav/planning');
    await waitFor(() =>
      expect(work.querySelector('[aria-current="page"]')).toHaveAttribute('href', '/en/goteav/tasks'),
    );
  });

  it('says the count in words', async () => {
    stubFetch(api);
    mount();
    expect(
      await screen.findByRole('link', { name: 'Tasks, 1 task ready in the project' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Inbox, 3 unread' })).toBeInTheDocument();
  });

  it('shows no number when nothing has answered', () => {
    stubFetch(() => undefined);
    mount();
    expect(screen.getByRole('link', { name: 'Inbox' })).not.toHaveAttribute('aria-label');
  });

  it('switcher lists the other projects and New project', async () => {
    stubFetch(api);
    mount();
    await screen.findByText('Goteav');
    const trigger = screen.getByRole('button', { name: /switch project/i });
    await userEvent.setup().click(trigger);
    expect(await screen.findByRole('menuitem', { name: /Hub/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New project' })).toBeInTheDocument();
  });

  it('offers All projects only when there is another project to see', async () => {
    stubFetch(api);
    mount();
    await screen.findByText('Goteav');
    await userEvent.setup().click(screen.getByRole('button', { name: /switch project/i }));
    expect(await screen.findByRole('menuitem', { name: 'All projects' })).toBeInTheDocument();
  });

  it('hides All projects with a single project, and keeps New project', async () => {
    const one = { ...me, workspaces: me.workspaces.slice(0, 1) };
    stubFetch((url) => (url.pathname.endsWith('/auth/me') ? { body: { data: one } } : api(url)));
    mount();
    await screen.findByText('Goteav');
    await userEvent.setup().click(screen.getByRole('button', { name: /switch project/i }));
    expect(await screen.findByRole('menuitem', { name: 'New project' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'All projects' })).not.toBeInTheDocument();
  });

  it('renders in Arabic', () => {
    stubFetch(() => undefined);
    mount('ar');
    expect(screen.getByRole('link', { name: 'المهام' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'التخطيط' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'البحث' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'المتابعة' })).toBeInTheDocument();
  });

  it('groups the pages as Work, Follow, Delivery, Knowledge and Project, with no Admin and no Live', () => {
    stubFetch(() => undefined);
    mount();
    const names = screen.getAllByRole('region').map((region) => region.getAttribute('aria-labelledby'));
    expect(names).toEqual(['nav-work', 'nav-follow', 'nav-delivery', 'nav-knowledge', 'nav-workspace']);
    const hrefs = (name: string) =>
      within(screen.getByRole('region', { name }))
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'));
    expect(hrefs('Work')).toEqual([
      '/en/goteav/planning',
      '/en/goteav/tasks',
      '/en/goteav/decisions',
      '/en/goteav/needs',
      '/en/goteav/handoffs',
    ]);
    expect(hrefs('Follow')).toEqual(['/en/goteav/timeline', '/en/goteav/queue']);
    expect(hrefs('Delivery')).toEqual(['/en/goteav/redesign', '/en/goteav/releases']);
    expect(hrefs('Knowledge')).toContain('/en/goteav/schema');
    expect(screen.queryByRole('link', { name: /Live|Running now/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/en/goteav/ask');
  });

  it('shows Getting started while steps are left, and hides it once the path is done', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/counters') ? { body: { data: { onboardingLeft: 2 } } } : api(url),
    );
    mount();
    expect(await screen.findByRole('link', { name: 'Getting started, 2 steps left' })).toBeInTheDocument();
  });

  it('keeps Getting started out of the sidebar once nothing is left, and in the member menu', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/counters') ? { body: { data: { onboardingLeft: 0 } } } : api(url),
    );
    mount();
    await screen.findByText('Goteav');
    expect(screen.queryByRole('link', { name: /Getting started/ })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'My account' }));
    expect(await screen.findByRole('menuitem', { name: 'Getting started' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
  });
});
