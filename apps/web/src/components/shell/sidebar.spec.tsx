/**
 * @file The sidebar: groups, Planning first in Work (docs/15 §4), badges in words, the project switcher (docs/15 §5), in both directions.
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
    expect(await screen.findByRole('link', { name: 'Tasks, 1 task ready for you' })).toBeInTheDocument();
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
    const trigger = screen.getByRole('button', { name: 'Switch project' });
    await userEvent.setup().click(trigger);
    expect(await screen.findByRole('menuitem', { name: /Hub/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'New project' })).toBeInTheDocument();
  });

  it('renders in Arabic', () => {
    stubFetch(() => undefined);
    mount('ar');
    expect(screen.getByRole('link', { name: 'المهام' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'التخطيط' })).toBeInTheDocument();
  });
});
