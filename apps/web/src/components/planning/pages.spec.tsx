/**
 * @file Tasks, Decisions and Planning: each page's states, and the rule on the filled button.
 */
import { screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DecisionsPage } from '@/components/decisions/decisions-page';
import { TasksPage } from '@/components/tasks/tasks-page';
import { renderWithApp, stubFetch } from '@/test/render';

import { PlanningPage } from './planning-page';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/demo/tasks',
}));

const me = {
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};

const row = (key: string, type: string, status: string, detail: Record<string, unknown> = {}, over = {}) => ({
  id: key,
  key,
  type,
  status,
  title: `Title ${key}`,
  priority: 'P2',
  ownerRole: 'owner',
  createdAt: new Date().toISOString(),
  lastEventAt: new Date().toISOString(),
  createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
  flags: {},
  tags: [],
  commentCount: 0,
  detail,
  ...over,
});

const page = (items: unknown[]) => ({
  body: { data: items, meta: { pagination: { nextCursor: null, limit: 100 } } },
});
const failure = {
  status: 500,
  body: { error: { code: 'hub.common.internal', message: 'No', requestId: 'r1' } },
};

function answer(lists: Record<string, unknown[] | 'fail'>) {
  return (url: URL) => {
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return { body: { data: me } };
    if (path.endsWith('/members')) return page([]);
    const name = Object.keys(lists).find((k) => path.endsWith(k));
    if (name === undefined) return path.endsWith('/tasks/ready') ? page([]) : undefined;
    const list = lists[name];
    return list === 'fail' ? failure : page(list ?? []);
  };
}

const show = (ui: ReactNode) => renderWithApp(<Tooltip.Provider>{ui}</Tooltip.Provider>);
const filled = () =>
  screen.queryAllByRole('button').filter((button) => button.className.includes('bg-primary'));

beforeEach(() => {
  vi.unstubAllGlobals();
  search = '';
});

describe('TasksPage', () => {
  it('shows a skeleton first', () => {
    stubFetch(answer({ '/tasks': [] }));
    show(<TasksPage />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows an honest empty page, with creating as the filled button', async () => {
    stubFetch(answer({ '/tasks': [] }));
    show(<TasksPage />);
    expect(await screen.findByText('No tasks yet')).toBeTruthy();
    expect(filled().map((b) => b.textContent)).toEqual(['New task']);
  });

  it('says so when the list fails', async () => {
    stubFetch(answer({ '/tasks': 'fail' }));
    show(<TasksPage />);
    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeTruthy();
  });

  it('fills only the first task I can claim, and names a task’s blocker', async () => {
    search = 'view=list';
    stubFetch(
      answer({
        '/tasks': [
          row('T-1', 'task', 'ready', { specialty: 'backend' }),
          row('T-2', 'task', 'ready', { specialty: 'backend' }),
          row('T-3', 'task', 'in_progress', { specialty: 'backend' }, { blockedBy: ['D-9'] }),
        ],
      }),
    );
    show(<TasksPage />);
    expect((await screen.findAllByText('Title T-1')).length).toBeGreaterThan(0);
    expect(filled()).toHaveLength(1);
    expect(screen.getAllByText('Blocked by', { exact: false }).length).toBeGreaterThan(0);
  });

  it('opens the Deleted view from its query, with Restore on each row', async () => {
    search = 'view=deleted';
    stubFetch(
      answer({
        '/cards/deleted': [row('T-7', 'task', 'ready', {}, { archivedAt: new Date().toISOString() })],
      }),
    );
    show(<TasksPage />);
    expect(await screen.findByText('Title T-7')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Restore/ })).toBeTruthy();
  });

  it('shows the Deleted view’s empty state', async () => {
    search = 'view=deleted';
    stubFetch(answer({ '/cards/deleted': [] }));
    show(<TasksPage />);
    expect(await screen.findByText('Nothing here')).toBeTruthy();
  });
});

const option = (id: string, recommended = false) => ({
  id,
  title: `Option ${id}`,
  pros: [],
  cons: [],
  recommended,
});

describe('DecisionsPage', () => {
  it('shows a skeleton first', () => {
    stubFetch(answer({ '/decisions': [] }));
    show(<DecisionsPage />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows an honest empty page', async () => {
    stubFetch(answer({ '/decisions': [] }));
    show(<DecisionsPage />);
    expect(await screen.findByText('No open decisions')).toBeTruthy();
  });

  it('says so when the list fails', async () => {
    stubFetch(answer({ '/decisions': 'fail' }));
    show(<DecisionsPage />);
    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeTruthy();
  });

  it('lays open the first question I can settle, and fills its recommended option alone', async () => {
    const dueAt = new Date(Date.now() + 3_600_000).toISOString();
    const detail = {
      kind: 'product',
      question: 'Q',
      deciderRole: 'owner',
      adrStatus: 'none',
      remindersSent: [],
      options: [option('a'), option('b', true)],
    };
    stubFetch((url) =>
      url.pathname.endsWith('/decisions')
        ? url.searchParams.getAll('status').includes('open')
          ? page([
              row('D-1', 'decision', 'open', detail, { dueAt }),
              row('D-2', 'decision', 'open', detail, { dueAt }),
            ])
          : page([])
        : answer({})(url),
    );
    show(<DecisionsPage />);
    expect(await screen.findByRole('button', { name: 'Choose: Option b' })).toBeTruthy();
    expect(filled().map((b) => b.getAttribute('aria-label'))).toEqual(['Choose: Option b']);
    expect(screen.getByText('Due in 24 h')).toBeTruthy();
  });

  it('keeps a band’s rule neutral (D31)', async () => {
    const detail = {
      kind: 'product',
      question: 'Q',
      deciderRole: 'owner',
      adrStatus: 'none',
      remindersSent: [],
      options: [],
    };
    const dueAt = new Date(Date.now() - 3_600_000).toISOString();
    stubFetch((url) =>
      url.pathname.endsWith('/decisions')
        ? url.searchParams.getAll('status').includes('open')
          ? page([row('D-1', 'decision', 'open', detail, { dueAt })])
          : page([])
        : answer({})(url),
    );
    const { container } = show(<DecisionsPage />);
    await screen.findByText('Overdue');
    expect(container.querySelectorAll('.h-px.bg-destructive\\/50, .h-px.bg-warning\\/50')).toHaveLength(0);
    expect(container.querySelectorAll('.h-px.bg-border').length).toBeGreaterThan(0);
  });
});

describe('PlanningPage', () => {
  it('shows a skeleton first', () => {
    stubFetch(answer({ '/ideas': [], '/plans': [] }));
    show(<PlanningPage />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows an honest empty page, with one filled button', async () => {
    stubFetch(answer({ '/ideas': [], '/plans': [] }));
    show(<PlanningPage />);
    expect(await screen.findByText('Nothing is being thought about yet')).toBeTruthy();
    expect(filled().map((b) => b.textContent)).toEqual(['New idea']);
  });

  it('says so when a list fails', async () => {
    stubFetch(answer({ '/ideas': 'fail', '/plans': [] }));
    show(<PlanningPage />);
    expect(await screen.findByRole('button', { name: /try again|retry/i })).toBeTruthy();
  });

  it('makes the plan waiting for approval the focal card, with the only filled button, and never repeats it', async () => {
    const steps = [
      { id: 's1', title: 'Write it', done: true, taskKey: 'T-1' },
      { id: 's2', title: 'Ship it', done: false },
    ];
    stubFetch(
      answer({
        '/ideas': [row('I-1', 'idea', 'exploring', { problem: 'A problem' })],
        '/plans': [
          row('P-1', 'plan', 'in_review', { steps }, { body: 'The approach' }),
          row('P-2', 'plan', 'draft', { steps: [] }),
        ],
      }),
    );
    show(<PlanningPage />);
    await waitFor(() => expect(screen.getAllByText('Title P-1')).toHaveLength(1));
    expect(filled().map((b) => b.textContent)).toEqual(['Approve']);
    expect(screen.getByText('1 of 2 steps done')).toBeTruthy();
    expect(screen.getByText('What we are thinking about')).toBeTruthy();
    expect(screen.getByText('What is planned next')).toBeTruthy();
  });

  it('draws no coloured edge on any card', async () => {
    stubFetch(
      answer({
        '/ideas': [row('I-1', 'idea', 'open', {})],
        '/plans': [row('P-1', 'plan', 'draft', { steps: [] })],
      }),
    );
    const { container } = show(<PlanningPage />);
    await screen.findByText('Title P-1');
    expect(container.innerHTML).not.toMatch(
      /border-[setblr]-\d|border-[setblr]-(?:primary|destructive|warning|success)/,
    );
  });
});
