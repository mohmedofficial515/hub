/**
 * @file The Ask page: Hub searches and writes no answers (D06, D26).
 */
import { screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { AskPage } from './ask-page';

const page = (
  <Tooltip.Provider>
    <AskPage />
  </Tooltip.Provider>
);

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/goteav/ask',
}));

const me = {
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner'] }],
};
const summary = (key: string, type: string, title: string) => ({
  id: key,
  key,
  type,
  title,
  status: 'open',
  priority: 'P2',
  ownerRole: null,
  lastEventAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
});
const tree = [
  {
    source: { id: 's', name: 'x' },
    total: 1,
    root: { name: '', path: '', docs: [summary('GTV-1', 'doc', 'x')], folders: [] },
  },
];

function api(reply: { status?: number; body?: unknown }, treeData: unknown = tree) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/docs/tree')) return { body: { data: treeData } };
    if (url.pathname.endsWith('/search')) return reply;
    return undefined;
  });
}

const found = {
  cards: [
    {
      ...summary('GTV-5', 'decision', 'Moyasar fees'),
      rank: 1,
      highlight: 'who pays the <mark>refund</mark>',
    },
  ],
  docs: [
    {
      card: summary('GTV-9', 'doc', 'Safety'),
      path: 'docs/21-safety.md',
      source: 'backend',
      chunks: [
        { heading: 'Refund', anchor: 'refund', excerpt: 'the <mark>refund</mark> &lt;goes&gt;', rank: 1 },
      ],
    },
  ],
};

describe('AskPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    search.value = '';
    localStorage.clear();
  });

  it('starts with what to try, and no command until there is a question', async () => {
    api({ body: { data: found } });
    renderWithApp(page);
    expect(await screen.findByRole('button', { name: 'TOTP' })).toBeInTheDocument();
    expect(screen.getByText(/Type your question first/)).toBeInTheDocument();
  });

  it('says when nothing is indexed yet', async () => {
    api({ body: { data: found } }, []);
    renderWithApp(page);
    expect(await screen.findByText('Nothing to search yet')).toBeInTheDocument();
  });

  it('shows a skeleton while it searches', () => {
    search.value = 'q=refund';
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderWithApp(page);
    expect(screen.getByRole('status', { name: 'Searching' })).toBeInTheDocument();
  });

  it('cites docs and cards with marked words, and hands over the exact command', async () => {
    search.value = 'q=refund policy';
    const { calls } = api({ body: { data: found } });
    renderWithApp(page);
    expect(await screen.findByText('docs/21-safety.md')).toBeInTheDocument();
    const marks = document.querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toEqual(['refund', 'refund']);
    expect(screen.getByText(/<goes>/)).toBeInTheDocument();
    const hand = screen.getByRole('complementary', { name: 'Want a written answer?' });
    expect(within(hand).getByText('/hub:ask refund policy')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/search'))).toBe(true);
  });

  it('honours the scope', async () => {
    search.value = 'q=refund&scope=docs';
    api({ body: { data: found } });
    renderWithApp(page);
    await screen.findByText('docs/21-safety.md');
    expect(screen.queryByText('Moyasar fees')).not.toBeInTheDocument();
  });

  it('says when nothing matched', async () => {
    search.value = 'q=zzz';
    api({ body: { data: { cards: [], docs: [] } } });
    renderWithApp(page);
    expect(await screen.findByText('Nothing matched')).toBeInTheDocument();
  });

  it('names the error', async () => {
    search.value = 'q=refund';
    api({ status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByText('hub.common.internal')).toBeInTheDocument();
  });

  it('asks for two letters instead of saying nothing matched (knowledge-10)', async () => {
    search.value = 'q=a';
    const { calls } = api({ body: { data: found } });
    renderWithApp(page);
    expect(await screen.findByText('Type at least two characters to search.')).toBeInTheDocument();
    expect(screen.queryByText('Nothing matched')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/search'))).toBe(false);
  });

  it('keeps the field and the scope when the search fails, with a retry beside them (knowledge-10)', async () => {
    search.value = 'q=refund';
    api({ status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search docs and cards' })).toHaveValue('refund');
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('reads a doc in the language the index gives it, and puts results before the hand-off (knowledge-11)', async () => {
    search.value = 'q=refund';
    const arabicTree = [
      {
        source: { id: 's', name: 'x' },
        total: 1,
        root: {
          name: '',
          path: '',
          docs: [{ ...summary('GTV-9', 'doc', 'Safety'), detail: { path: 'docs/21-safety.md', lang: 'ar' } }],
          folders: [],
        },
      },
    ];
    api({ body: { data: found } }, arabicTree);
    renderWithApp(page);
    const path = await screen.findByText('docs/21-safety.md');
    expect(path.closest('[dir="rtl"]')).not.toBeNull();
    const hand = screen.getByRole('complementary', { name: 'Want a written answer?' });
    expect(hand.parentElement?.className).toContain('order-last');
  });
});
