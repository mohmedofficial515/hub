/**
 * @file The lab's own page: how Redesign opens it, what a version shows, what stays Hub's, and the honest states.
 */
import { screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { LabGallery } from './lab-gallery';
import { RedesignPage } from './redesign-page';

const page = (
  <Tooltip.Provider>
    <LabGallery />
  </Tooltip.Provider>
);

const search = { value: '' };
const path = { value: '/en/goteav/gallery' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => path.value,
}));

class FakeResizeObserver {
  constructor(private readonly tell: ResizeObserverCallback) {}
  observe() {
    this.tell([{ contentRect: { width: 900, height: 700 } } as ResizeObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
}

const me = {
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] }],
};

const version = (key: string, name: string, status: string) => ({
  id: key,
  key,
  type: 'redesign',
  title: `web/wallet · ${name} — Flight path`,
  status,
  priority: 'P2',
  ownerRole: 'designer',
  lastEventAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
  attachments:
    name === 'v1-baseline'
      ? [{ id: 's1', kind: 'screenshot', name: '1440-ltr-light.png', url: '/shot.png' }]
      : [],
  detail: {
    app: 'web',
    page: 'wallet',
    version: name,
    labPath: `web/wallet/${name}`,
    labUrl: `/lab/#/web/wallet/${name}`,
    base: 'v1-baseline',
    frontMatter: { title: 'Flight path', created: '2026-10-27', tokens: 'inherit' },
    touchesComponents: [],
  },
});

const pages = [
  {
    app: 'web',
    page: 'wallet',
    route: '/account/wallet',
    liveUrl: 'http://localhost:6002/ar/account/wallet',
    status: 'designing',
    brief: '# Wallet\n\nThe brief.',
    renderable: ['v2-flight-path'],
    versions: [version('GTV-1', 'v1-baseline', 'reference'), version('GTV-2', 'v2-flight-path', 'review')],
  },
];

function stub(labUp = true, rows: unknown[] = pages) {
  stubFetch((url) => {
    if (url.pathname.includes('/lab/frame-hub.html')) return labUp ? { body: {} } : { status: 502, body: {} };
    if (url.pathname.includes('/auth/me')) return { body: { data: me } };
    if (url.pathname.includes('/redesign/pages')) return { body: { data: rows } };
    if (url.pathname.includes('/readme'))
      return { body: { data: { markdown: 'The notes of this version.', review: null } } };
    return undefined;
  });
}

const frame = () => document.querySelector('iframe');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Redesign and the lab', () => {
  it('Redesign opens the lab in a new tab, and has no gallery of its own', async () => {
    search.value = '';
    path.value = '/en/goteav/redesign';
    stub();
    renderWithApp(
      <Tooltip.Provider>
        <RedesignPage />
      </Tooltip.Provider>,
      { locale: 'en' },
    );
    const link = await screen.findByRole('link', { name: 'Open the lab' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('href')).toMatch(/\/gallery$/);
    expect(screen.queryByRole('navigation', { name: 'Lab pages and versions' })).toBeNull();
    path.value = '/en/goteav/gallery';
  });
});

describe('LabGallery', () => {
  it('with nothing picked, says what the lab holds', async () => {
    search.value = '';
    stub();
    renderWithApp(page, { locale: 'en' });
    expect(await screen.findByText(/1 page · 2 versions/)).toBeInTheDocument();
    expect(frame()).toBeNull();
  });

  it('lists tokens, the running page and each version with its status', async () => {
    search.value = '';
    stub();
    renderWithApp(page, { locale: 'en' });
    const nav = await screen.findByRole('navigation', { name: 'Lab pages and versions' });
    expect(nav).toHaveTextContent('Tokens');
    expect(nav).toHaveTextContent('live');
    expect(nav).toHaveTextContent('v2-flight-path');
    expect(nav).toHaveTextContent('review');
    expect(nav.closest('[data-lab-gallery]')).toHaveAttribute('dir', 'ltr');
  });

  it('shows a version with a page in its own frame, same origin, at the mode in the address', async () => {
    search.value = 'app=web&page=wallet&a=v2-flight-path&w=390&lang=ar&theme=dark';
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stub();
    renderWithApp(page, { locale: 'en' });
    await waitFor(() => expect(frame()).not.toBeNull());
    expect(frame()?.getAttribute('src')).toBe(
      '/lab/frame-web.html#/wallet/v2-flight-path?lang=ar&theme=dark',
    );
    expect(frame()?.style.width).toBe('390px');
    expect(screen.getByRole('link', { name: /Open frame/ })).toHaveAttribute(
      'href',
      '/lab/frame-web.html#/wallet/v2-flight-path?lang=ar&theme=dark',
    );
  });

  it('shows a baseline as its pictures, the one named for the mode', async () => {
    search.value = 'app=web&page=wallet&a=v1-baseline&w=1440&lang=en&theme=light';
    stub();
    renderWithApp(page, { locale: 'en' });
    expect(await screen.findByRole('img', { name: /v1-baseline/ })).toHaveAttribute('src', '/shot.png');
    expect(frame()).toBeNull();
  });

  it('compares two versions, each in its own pane, and offers the running page', async () => {
    search.value = 'app=web&page=wallet&a=v2-flight-path&b=live&w=768';
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stub();
    renderWithApp(page, { locale: 'en' });
    await waitFor(() => expect(document.querySelectorAll('iframe')).toHaveLength(2));
    const sources = [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src'));
    expect(sources[0]).toMatch(/^\/lab\/frame-web\.html/);
    expect(sources[1]).toBe('http://localhost:6002/ar/account/wallet');
    expect(screen.getByRole('button', { name: 'Side-by-side' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('notes hold status, front-matter, the README, the brief, and the way to the verdict', async () => {
    search.value = 'app=web&page=wallet&a=v2-flight-path&notes=1';
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stub();
    renderWithApp(page, { locale: 'en' });
    const notes = await screen.findByRole('complementary', { name: 'Status & notes' });
    expect(await screen.findByText('The notes of this version.')).toBeInTheDocument();
    expect(notes).toHaveTextContent('review');
    expect(notes).toHaveTextContent('2026-10-27');
    expect(notes).toHaveTextContent('The brief.');
    expect(screen.getAllByRole('link', { name: /Open GTV-2/ })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('card=GTV-2'),
    );
  });

  it('the owner reaches the verdict from the toolbar, through the sheet', async () => {
    search.value = 'app=web&page=wallet&a=v2-flight-path';
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    stub();
    renderWithApp(page, { locale: 'en' });
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeInTheDocument();
  });

  it('a lab that is down is a state of the stage, and the page stands', async () => {
    search.value = 'app=web&page=wallet&a=v2-flight-path';
    stub(false);
    renderWithApp(page, { locale: 'en' });
    expect(await screen.findByText('The lab is not running')).toBeInTheDocument();
    expect(frame()).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Lab pages and versions' })).toBeInTheDocument();
  });

  it('a project with no lab has the honest empty state', async () => {
    search.value = '';
    stub(true, []);
    renderWithApp(page, { locale: 'en' });
    expect(await screen.findByText('No lab pages yet')).toBeInTheDocument();
  });
});
