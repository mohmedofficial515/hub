/**
 * @file The Docs page in each state, on the API's tree and content shapes.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getQueryClient } from '@/lib/query-client';
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

function api(
  roles: string[],
  treeReply: { status?: number; body?: unknown },
  docReply?: { status?: number; body?: unknown },
  path?: unknown,
) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (path && url.pathname.endsWith('/onboarding')) return { body: { data: path } };
    if (path && url.pathname.endsWith('/done')) {
      // The API keeps the tick, so the path read after it says so.
      const id = decodeURIComponent(url.pathname.split('/').at(-2) ?? '');
      for (const group of path as { items: { id: string; done?: boolean }[] }[])
        for (const item of group.items) if (item.id === id) item.done = true;
      return { body: { data: null } };
    }
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
          docSource: { id: 's1', name: 'backend-docs' },
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
          docSource: { id: 's1', name: 'backend-docs' },
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

  it('says a failed read as a failure, with a retry, and never as a missing doc (knowledge-02)', async () => {
    search.value = 'doc=GTV-1';
    api(['qa'], { body: { data: tree } }, { status: 500, body: { error: { code: 'hub.common.internal', message: 'Boom' } } });
    renderWithApp(page);
    expect(await screen.findByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.queryByText('This doc does not exist')).not.toBeInTheDocument();
  });

  it('filters the tree by name, says when nothing matches, and Esc brings it back (knowledge-04)', async () => {
    api(['qa'], { body: { data: tree } });
    renderWithApp(page);
    const field = await screen.findByRole('searchbox', { name: /Filter the tree/ });
    fireEvent.change(field, { target: { value: 'old' } });
    const nav = within(screen.getByRole('navigation', { name: 'Docs tree' }));
    expect(nav.getByRole('link', { name: /old/ })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: /21-safety/ })).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'zzz' } });
    expect(screen.getByText(/No doc’s name or path holds “zzz”/)).toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Escape', code: 'Escape' });
    expect(field).toHaveValue('');
    expect(screen.getByRole('button', { name: 'backend-docs 2' })).toBeInTheDocument();
  });

  const SAFETY = ['# Safety', '', 'text'].join('\n');
  const content = (key: string, path: string, text: string) => ({
    body: {
      data: {
        ...doc(key, path),
        content: text,
        unavailable: null,
        docSource: { id: 's1', name: 'backend-docs' },
        toc: [],
        mentionedBy: [],
      },
    },
  });

  it('shows where the doc lives and the next one in reading order (knowledge-05)', async () => {
    search.value = 'doc=GTV-1';
    api(['qa'], { body: { data: tree } }, content('GTV-1', 'docs/21-safety.md', SAFETY));
    renderWithApp(page);
    const trail = await screen.findByRole('navigation', { name: 'Where this doc lives' });
    expect(trail.textContent).toBe('backend-docsdocs21-safety');
    const pager = screen.getByRole('navigation', { name: 'Reading order' });
    expect(pager.textContent).not.toContain('Previous');
    expect(pager.querySelector('a')?.getAttribute('href')).toContain('doc=GTV-3');
  });

  it('says which onboarding step a doc is, and marks it read (knowledge-12)', async () => {
    search.value = 'doc=GTV-1';
    const { calls } = api(
      ['qa'],
      { body: { data: tree } },
      content('GTV-1', 'docs/21-safety.md', SAFETY),
      [
        {
          role: 'qa',
          items: [
            { id: 'read-safety', kind: 'doc', title: 'Safety', ref: 'docs/21-safety.md' },
            { id: 'first', kind: 'action', title: 'Claim a task', ref: 'first_claim' },
          ],
        },
      ],
    );
    // The tick writes to the app's own client, as the sheet's writes do.
    const client = getQueryClient();
    client.clear();
    renderWithApp(page, { client });
    expect(await screen.findByText('Step 1 of your path')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark it read' }));
    expect(await screen.findByText('Next: Claim a task')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/onboarding/read-safety/done'))).toBe(true);
    client.clear();
  });

  it('a doc that is not on the path shows no step', async () => {
    search.value = 'doc=GTV-3';
    api(['qa'], { body: { data: tree } }, content('GTV-3', 'docs/old.md', 'text'), [
      { role: 'qa', items: [{ id: 'x', kind: 'doc', title: 'Safety', ref: 'docs/21-safety.md' }] },
    ]);
    renderWithApp(page);
    await screen.findByRole('navigation', { name: 'Reading order' });
    expect(document.querySelector('[data-onboarding-strip]')).toBeNull();
  });
});
