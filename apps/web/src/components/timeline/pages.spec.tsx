/**
 * @file Today, Inbox and Timeline in their states: loading, empty, error, and with real-shaped data. A number and its rows come from the API, and nothing
 * the design faked (sparklines, trend words) renders.
 */
import { screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InboxPage } from '@/components/inbox/inbox-page';
import { TodayPage } from '@/components/today/today-page';
import { renderWithApp, type Route, stubFetch } from '@/test/render';

import inbox from '../../../messages/en/inbox.json';
import kit from '../../../messages/en/kit.json';
import shell from '../../../messages/en/shell.json';
import timeline from '../../../messages/en/timeline.json';
import today from '../../../messages/en/today.json';
import { TimelinePage } from './timeline-page';

let path = '/en/goteav/today';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => path,
}));

const mount = (ui: ReactNode) =>
  renderWithApp(
    <NextIntlClientProvider
      locale="en"
      timeZone="Europe/Istanbul"
      messages={{ kit, shell, today, inbox, timeline }}
    >
      <div id="hub-root">{ui}</div>
    </NextIntlClientProvider>,
  );

const me = {
  id: 'u1',
  displayName: 'Mohamed Ahmed',
  avatarColor: 'teal',
  workspaces: [{ slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner', 'backend'] }],
};

const actor = { kind: 'user', userId: 'u2', displayName: 'Sara', via: 'web' };
const card = (key: string, over: Record<string, unknown> = {}) => ({
  id: key,
  key,
  type: 'decision',
  title: `Title of ${key.replace('GTV-', 'card ')}`,
  status: 'open',
  priority: 'P1',
  ownerRole: 'owner',
  assignee: null,
  module: null,
  repo: null,
  branch: null,
  tags: [],
  dueAt: null,
  closedAt: null,
  archivedAt: null,
  commentCount: 0,
  lastEventAt: '2026-11-05T09:00:00.000Z',
  createdAt: '2026-11-05T09:00:00.000Z',
  createdBy: actor,
  source: 'web',
  flags: { blocked: false, overdue: false, escalated: false, stale: false, noSummary: false },
  awaiting: null,
  detail: null,
  ...over,
});
const row = (key: string, kind = 'created', collapsed = 0) => ({
  event: { id: `e-${key}`, seq: 3, kind, actor, via: 'web', data: {}, createdAt: new Date().toISOString() },
  card: card(key),
  collapsed,
  collapsedKinds: [],
});

const base: Route = (url) => {
  if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
  if (url.pathname.endsWith('/members')) return { body: { data: [], meta: {} } };
  if (url.pathname.endsWith('/inbox/count')) return { body: { data: { unread: 0 } } };
  if (url.pathname.endsWith('/tasks/ready')) return { body: { data: [], meta: {} } };
  if (url.pathname.endsWith('/cards')) return { body: { data: [], meta: {} } };
  return undefined;
};
const withRoutes = (extra: Route) =>
  stubFetch((url, init, request) => extra(url, init, request) ?? base(url, init, request));

const todayData = (over: Record<string, unknown> = {}) => ({
  date: '2026-11-05',
  timezone: 'Europe/Istanbul',
  now: new Date().toISOString(),
  brief: { narrative: null, narrativeAt: null },
  awaitingMe: [],
  readyTasks: [],
  deadlines: [],
  noSummarySessions: [],
  changesSince: { since: '2026-11-04T09:00:00.000Z', events: [], total: 0 },
  counters: {},
  team: {
    week: { from: '2026-11-02', to: '2026-11-08', iso: '2026-W45' },
    totals: [],
    flow: [],
    days: [],
    members: [],
  },
  sources: [],
  weekly: null,
  ...over,
});

const hang = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => undefined)),
  );
const refuse = (tail: string) =>
  withRoutes((url) =>
    url.pathname.endsWith(tail)
      ? { status: 500, body: { error: { code: 'hub.common.internal', message: 'no', requestId: 'r1' } } }
      : undefined,
  );

afterEach(() => vi.unstubAllGlobals());

describe('Today', () => {
  it('shows a skeleton first', () => {
    hang();
    mount(<TodayPage />);
    expect(screen.getByRole('status', { name: today.loading })).toBeInTheDocument();
  });

  it('says what failed, with its code', async () => {
    refuse('/today');
    mount(<TodayPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('hub.common.internal');
  });

  it('is honest when empty: no letter, nothing waiting, no sources', async () => {
    withRoutes((url) => (url.pathname.endsWith('/today') ? { body: { data: todayData() } } : undefined));
    mount(<TodayPage />);
    expect(await screen.findByText(today.stack.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(today.letter.absentTitle)).toBeInTheDocument();
    expect(screen.getByText(today.sources.emptyTitle)).toBeInTheDocument();
    expect(document.querySelector('svg polyline')).toBeNull();
  });

  it('lists the stack from the awaiting list, and marks an unsourced total', async () => {
    withRoutes((url) => {
      if (url.pathname.endsWith('/cards')) {
        return { body: { data: [card('GTV-1', { awaiting: 'decide' })], meta: {} } };
      }
      if (url.pathname.endsWith('/today')) {
        return {
          body: {
            data: todayData({
              team: {
                week: { from: '2026-11-02', to: '2026-11-08', iso: '2026-W45' },
                totals: [{ key: 'commits', value: 0, prev: 0, available: false }],
                flow: [],
                days: [],
                members: [],
              },
            }),
          },
        };
      }
      return undefined;
    });
    mount(<TodayPage />);
    expect(await screen.findByText('Title of card 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: kit.actions.decide })).toBeInTheDocument();
    expect(screen.getByText(today.team.noSource)).toBeInTheDocument();
  });

  it('writes the agent letter with its card keys as chips', async () => {
    withRoutes((url) =>
      url.pathname.endsWith('/today')
        ? {
            body: {
              data: todayData({
                brief: { narrative: 'Yesterday **GTV-9** moved.', narrativeAt: '2026-11-05T05:00:00.000Z' },
              }),
            },
          }
        : undefined,
    );
    mount(<TodayPage />);
    expect(await screen.findByText(today.letter.title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /GTV-9/ })).toBeInTheDocument();
  });
});

describe('Inbox', () => {
  const item = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    kind: 'routed_decision',
    title: `Item ${id}`,
    body: null,
    card: card('GTV-1', { awaiting: 'decide' }),
    data: { cardKey: 'GTV-1', action: 'decide' },
    groupKey: null,
    createdAt: new Date().toISOString(),
    readAt: null,
    archivedAt: null,
    ...over,
  });

  it('shows a skeleton first', () => {
    path = '/en/goteav/inbox';
    hang();
    mount(<InboxPage />);
    expect(screen.getByRole('status', { name: inbox.title })).toBeInTheDocument();
  });

  it('says what failed', async () => {
    path = '/en/goteav/inbox';
    refuse('/inbox');
    mount(<InboxPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('hub.common.internal');
  });

  it('tells "none yet" from the empty list', async () => {
    path = '/en/goteav/inbox';
    withRoutes((url) => (url.pathname.endsWith('/inbox') ? { body: { data: [], meta: {} } } : undefined));
    mount(<InboxPage />);
    expect(await screen.findByText(inbox.empty.allTitle)).toBeInTheDocument();
  });

  it('offers the action the card still offers, and clears on read', async () => {
    path = '/en/goteav/inbox';
    const { calls } = withRoutes((url) => {
      if (url.pathname.endsWith('/inbox/count')) return { body: { data: { unread: 1 } } };
      if (url.pathname.endsWith('/inbox')) return { body: { data: [item('a')], meta: {} } };
      if (url.pathname.endsWith('/read')) return { status: 204 };
      return undefined;
    });
    mount(<InboxPage />);
    expect(await screen.findByText('Item a')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: kit.actions.decide })).toBeInTheDocument();
    screen.getByRole('button', { name: inbox.row.archive }).click();
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/archive'))).toBe(true));
  });
});

describe('Timeline', () => {
  it('shows a skeleton first', () => {
    path = '/en/goteav/timeline';
    hang();
    mount(<TimelinePage />);
    expect(screen.getByRole('status', { name: timeline.title })).toBeInTheDocument();
  });

  it('says what failed', async () => {
    path = '/en/goteav/timeline';
    refuse('/timeline');
    mount(<TimelinePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('hub.common.internal');
  });

  it('says where the record starts when a project has no events', async () => {
    path = '/en/goteav/timeline';
    withRoutes((url) => {
      if (url.pathname.endsWith('/timeline')) return { body: { data: [], meta: {} } };
      if (url.pathname.endsWith('/today')) return { body: { data: todayData() } };
      return undefined;
    });
    mount(<TimelinePage />);
    expect(await screen.findByText(timeline.empty.firstTitle)).toBeInTheDocument();
  });

  it('counts folded events, and moves the last visit on arrival', async () => {
    path = '/en/goteav/timeline';
    const { calls } = withRoutes((url) => {
      if (url.pathname.endsWith('/timeline')) {
        return { body: { data: [row('GTV-1', 'commit', 3), row('GTV-2')], meta: {} } };
      }
      if (url.pathname.endsWith('/today')) return { body: { data: todayData() } };
      if (url.pathname.endsWith('/today/seen')) return { status: 204 };
      return undefined;
    });
    mount(<TimelinePage />);
    expect(await screen.findByText('Title of card 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+3/ })).toBeInTheDocument();
    expect(screen.getAllByText('5 events in this view').length).toBeGreaterThan(0);
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/today/seen'))).toBe(true));
  });
});
