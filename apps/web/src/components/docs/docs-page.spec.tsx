/**
 * @file The Docs page in each state, on the API's tree and content shapes.
 */
import { screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { DocsPage } from './docs-page';

const page = (
  <Tooltip.Provider>
    <DocsPage />
  </Tooltip.Provider>
);

const search = { value: '' };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/goteav/docs',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles }],
});

const doc = (key: string, path: string, status = 'current') => ({
  id: key,
  key,
  type: 'doc',
  title: path,
  status,
  priority: 'P3',
  ownerRole: null,
  lastEventAt: '2026-11-01T00:00:00Z',
  createdAt: '2026-11-01T00:00:00Z',
  detail: { sourceId: 's1', path, kind: 'doc', headings: [], wordCount: 120, lastCommitSha: null },
});

const tree = [
  {
    source: { id: 's1', name: 'backend-docs' },
    total: 3,
    root: {
      name: '',
      path: '',
      docs: [],
      folders: [
        {
          name: 'docs',
          path: 'docs',
          docs: [doc('GTV-1', 'docs/21-safety.md'), doc('GTV-2', 'docs/21-safety.ar.md'), doc('GTV-3', 'docs/old.md', 'stale')],
          folders: [],
        },
      ],
    },
  },
];

function api(roles: string[], treeReply: { status?: number; body?: unknown }, docReply?: { status?: number; body?: unknown }) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/docs/tree')) return treeReply;
    if (/\/docs\/GTV-\d+$/.test(url.pathname)) return docReply;
    return undefined;
  });
}

describe('DocsPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    search.value = '';
  });

  it('shows a skeleton while it loads', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderWithApp(page);
    expect(screen.getByRole('status', { name: 'Loading the docs' })).toBeInTheDocument();
  });

  it('sends a manager to Sources when nothing is indexed, and no one else', async () => {
    api(['pm'], { body: { data: [] } });
    const first = renderWithApp(page);
    expect(await screen.findByText('No docs indexed')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Open sources' })).toBeInTheDocument();
    first.unmount();
    api(['qa'], { body: { data: [] } });
    renderWithApp(page);
    await screen.findByText('No docs indexed');
    expect(screen.queryByRole('link', { name: 'Open sources' })).not.toBeInTheDocument();
  });

  it('names the error', async () => {
    api(['qa'], { status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByText('hub.common.internal')).toBeInTheDocument();
  });

  it('lists recent docs, with a twin given no row of its own', async () => {
    api(['qa'], { body: { data: tree } });
    renderWithApp(page);
    expect(await screen.findByText('Recently updated')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'backend-docs 2' })).toBeInTheDocument();
    expect(screen.queryByText('docs/21-safety.ar.md')).not.toBeInTheDocument();
  });

  it('reads a doc in its own direction, with who mentions it', async () => {
    search.value = 'doc=GTV-2';
    api(['qa'], { body: { data: tree } }, {
      body: {
        data: {
          ...doc('GTV-2', 'docs/21-safety.ar.md'),
          content: '# أمان\n\n## القسم\n\nنص',
          unavailable: null,
          source: { id: 's1', name: 'backend-docs' },
          toc: [],
          mentionedBy: [{ ...doc('GTV-9', 'x'), type: 'decision', title: 'A decision' }],
        },
      },
    });
    renderWithApp(page);
    expect(await screen.findByRole('heading', { name: /القسم/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /القسم/ }).closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByText('A decision')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'English' })).toBeInTheDocument();
  });

  it('says why a file cannot be shown, and never shows it', async () => {
    search.value = 'doc=GTV-1';
    api(['qa'], { body: { data: tree } }, {
      body: {
        data: {
          ...doc('GTV-1', 'docs/21-safety.md'),
          content: null,
          unavailable: 'secret',
          source: { id: 's1', name: 'backend-docs' },
          toc: [],
          mentionedBy: [],
        },
      },
    });
    renderWithApp(page);
    expect(await screen.findByText(/holds something like a secret/)).toBeInTheDocument();
  });

  it('says a doc does not exist', async () => {
    search.value = 'doc=GTV-404';
    api(['qa'], { body: { data: tree } }, { status: 404, body: { error: { code: 'hub.docs.not_found', message: 'No' } } });
    renderWithApp(page);
    expect(await screen.findByText('This doc does not exist')).toBeInTheDocument();
  });
});
