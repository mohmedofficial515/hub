/**
 * @file Today, Inbox and Timeline in their states: loading, empty, error, and with real-shaped data. A number and its rows come from the API, and nothing
 * the design faked (sparklines, trend words) renders.
 */
import { screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { InboxPage } from '@/components/inbox/inbox-page';
import { ReadyTasks } from '@/components/today/ready';
import { TodayPage } from '@/components/today/today-page';
import { renderWithApp, type Route, stubFetch } from '@/test/render';

import inbox from '../../../messages/en/inbox.json';
import kit from '../../../messages/en/kit.json';
import shell from '../../../messages/en/shell.json';
import timeline from '../../../messages/en/timeline.json';
import today from '../../../messages/en/today.json';
import { EventDetail } from './event-detail';
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

  it('draws the letter’s headings and lists, never their markers', async () => {
    withRoutes((url) =>
      url.pathname.endsWith('/today')
        ? {
            body: {
              data: todayData({
                brief: {
                  narrative: '## The plan\n- First GTV-9\n- Second\n\nThen **ship**.',
                  narrativeAt: '2026-11-05T05:00:00.000Z',
                },
              }),
            },
          }
        : undefined,
    );
    mount(<TodayPage />);
    const toggle = await screen.findByRole('button', { name: new RegExp(today.letter.expand) });
    toggle.click();
    expect(await screen.findByRole('heading', { name: 'The plan' })).toBeInTheDocument();
    const body = document.getElementById('letter-body');
    expect(body?.querySelectorAll('li')).toHaveLength(2);
    expect(body?.textContent).not.toContain('##');
    expect(body?.textContent).not.toContain('- ');
  });

  it('keeps the stack from /today when the awaiting list fails', async () => {
    withRoutes((url) => {
      if (url.pathname.endsWith('/cards')) {
        return { status: 500, body: { error: { code: 'hub.common.internal', message: 'no' } } };
      }
      if (url.pathname.endsWith('/today')) {
        return { body: { data: todayData({ awaitingMe: [card('GTV-1', { awaiting: 'decide' })] }) } };
      }
      return undefined;
    });
    mount(<TodayPage />);
    expect(await screen.findByText('Title of card 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: kit.actions.decide })).toBeInTheDocument();
    expect(screen.queryByText(today.stack.emptyTitle)).toBeNull();
  });

  it('keeps Ready from /today while the ready list has not answered', async () => {
    stubFetch((url, init, request) => {
      if (url.pathname.endsWith('/tasks/ready')) return undefined;
      if (url.pathname.endsWith('/today')) {
        return {
          body: {
            data: todayData({
              readyTasks: [card('GTV-5', { type: 'task', status: 'ready', ownerRole: 'backend' })],
            }),
          },
        };
      }
      return base(url, init, request);
    });
    const fetchNow = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input instanceof Request ? input.url : input).includes('/tasks/ready')
          ? new Promise(() => undefined)
          : fetchNow(input, init),
      ),
    );
    mount(<TodayPage />);
    expect(await screen.findByText('Title of card 5')).toBeInTheDocument();
  });

  it('refreshes the lists too, not only /today', async () => {
    const { calls } = withRoutes((url) =>
      url.pathname.endsWith('/today') ? { body: { data: todayData() } } : undefined,
    );
    mount(<TodayPage />);
    await screen.findByText(today.stack.emptyTitle);
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/cards'))).toBe(true));
    const before = calls.filter((c) => c.path.endsWith('/cards')).length;
    screen.getByRole('button', { name: today.refresh }).click();
    await waitFor(() =>
      expect(calls.filter((c) => c.path.endsWith('/cards')).length).toBeGreaterThan(before),
    );
  });

  it('opens the rest of a long stack in place', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) => card(`GTV-${i + 1}`, { awaiting: 'decide' }));
    withRoutes((url) => {
      if (url.pathname.endsWith('/cards')) return { body: { data: twelve, meta: {} } };
      if (url.pathname.endsWith('/today')) return { body: { data: todayData() } };
      return undefined;
    });
    mount(<TodayPage />);
    const more = await screen.findByRole('button', { name: 'See all (12)' });
    const stack = () =>
      document.querySelectorAll('#' + CSS.escape(more.getAttribute('aria-controls') ?? '') + ' > li');
    expect(stack()).toHaveLength(10);
    expect(more).toHaveAttribute('aria-expanded', 'false');
    more.click();
    await waitFor(() => expect(stack()).toHaveLength(12));
    expect(screen.getByRole('button', { name: today.stack.seeFewer })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(document.querySelector('a[href*="awaiting=me"][href*="inbox"]')).toBeNull();
  });

  it('draws sessions without a summary only when there is one, and the runway’s empty line without a box', async () => {
    withRoutes((url) => (url.pathname.endsWith('/today') ? { body: { data: todayData() } } : undefined));
    const first = mount(<TodayPage />);
    const empty = await screen.findByText(today.runway.empty);
    expect(empty.closest('.border-dashed')).toBeNull();
    expect(screen.queryByText(today.sessions.title)).toBeNull();
    first.unmount();

    withRoutes((url) =>
      url.pathname.endsWith('/today')
        ? {
            body: {
              data: todayData({
                noSummarySessions: [
                  {
                    sessionLogId: 's1',
                    sessionId: 'abc',
                    repo: 'web',
                    branch: 'main',
                    at: '2026-11-05T08:00:00.000Z',
                    durationMin: 30,
                    commits: 1,
                    files: 2,
                  },
                ],
              }),
            },
          }
        : undefined,
    );
    mount(<TodayPage />);
    expect(await screen.findByText(today.sessions.title)).toBeInTheDocument();
  });

  it('gives each list a short line that says what it holds', async () => {
    withRoutes((url) => (url.pathname.endsWith('/today') ? { body: { data: todayData() } } : undefined));
    mount(<TodayPage />);
    expect(await screen.findByText(today.stack.subtitle)).toBeInTheDocument();
    expect(screen.getByText(today.ready.subtitle.zero)).toBeInTheDocument();
  });

  it('groups the events since my last visit by card', async () => {
    const on = (id: string, key: string, kind: string) => ({
      ...row(key, kind),
      event: { ...row(key, kind).event, id },
    });
    withRoutes((url) =>
      url.pathname.endsWith('/today')
        ? {
            body: {
              data: todayData({
                changesSince: {
                  since: '2026-11-04T09:00:00.000Z',
                  events: [
                    on('e1', 'GTV-7', 'status_changed'),
                    on('e2', 'GTV-8', 'created'),
                    on('e3', 'GTV-7', 'commented'),
                    on('e4', 'GTV-7', 'created'),
                    on('e5', 'GTV-7', 'created'),
                  ],
                  total: 5,
                },
              }),
            },
          }
        : undefined,
    );
    mount(<TodayPage />);
    // One entry per card: the title once, its events under it, and what did not fit counted.
    expect(await screen.findAllByText('Title of card 7')).toHaveLength(1);
    expect(screen.getByRole('list', { name: '4 events' })).toBeInTheDocument();
    expect(screen.getByText('1 more event on this card')).toBeInTheDocument();
    expect(screen.getAllByText('Title of card 8')).toHaveLength(1);
  });
});

describe('Ready on Today', () => {
  it('counts the tasks Start with these already shows, and draws no empty state for them', async () => {
    withRoutes(() => undefined);
    mount(<ReadyTasks tasks={[]} inNext={2} />);
    expect(screen.getByText(today.ready.subtitle.other.replace('#', '2'))).toBeInTheDocument();
    expect(screen.queryByText(today.ready.emptyTitleProject)).toBeNull();
    expect(screen.queryByText(today.ready.emptyTitle)).toBeNull();
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
    // Written from the live card, not the title stored with the item.
    expect(await screen.findByText('Title of card 1')).toBeInTheDocument();
    expect(screen.queryByText('Item a')).toBeNull();
    expect(screen.getByRole('button', { name: kit.actions.decide })).toBeInTheDocument();
    screen.getByRole('button', { name: inbox.row.archive }).click();
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/archive'))).toBe(true));
  });

  it('names the page a link without a card goes to', async () => {
    path = '/en/goteav/inbox';
    const backup = item('b', {
      kind: 'system',
      card: null,
      data: {
        link: { view: 'settings', query: { tab: 'backups' } },
        i18nKey: 'backup_failed',
        params: { reason: 'disk' },
      },
    });
    const brief = item('c', { kind: 'brief', card: null, data: {} });
    withRoutes((url) =>
      url.pathname.endsWith('/inbox') ? { body: { data: [backup, brief], meta: {} } } : undefined,
    );
    mount(<InboxPage />);
    const settings = await screen.findByRole('link', { name: `Open ${shell.nav.settings}` });
    expect(settings.getAttribute('href')).toMatch(/\/settings\?tab=backups$/);
    expect(screen.getByRole('link', { name: `Open ${shell.nav.today}` })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /^Open / })).toHaveLength(2);
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

  it('draws small events as one line, runs of one card under its first line, and marks the hour', async () => {
    path = '/en/goteav/timeline';
    const done = (id: string, key: string, kind: string) => {
      const r = row(key, kind);
      return { ...r, event: { ...r.event, id }, card: card(key, { type: 'task', status: 'done' }) };
    };
    withRoutes((url) => {
      if (url.pathname.endsWith('/timeline')) {
        return {
          body: {
            data: [
              done('e3', 'GTV-4', 'commented'),
              done('e2', 'GTV-4', 'status_changed'),
              done('e1', 'GTV-5', 'created'),
            ],
            meta: {},
          },
        };
      }
      if (url.pathname.endsWith('/today')) return { body: { data: todayData() } };
      if (url.pathname.endsWith('/today/seen')) return { status: 204 };
      return undefined;
    });
    mount(<TimelinePage />);
    await screen.findAllByText('Title of card 4');
    const lines = [...document.querySelectorAll('[data-tl-line]')].map((el) =>
      el.getAttribute('data-tl-line'),
    );
    // Nothing asks for action, so no row is a card; the second event of GTV-4 reads under the first.
    expect(lines).toEqual(['line', 'continued', 'line']);
    expect(document.querySelectorAll('[data-tl-hour]').length).toBeGreaterThan(0);
  });
  // The wide row and Today's "Since your last visit" both print this line; a narrow test window hides it on the row, so it renders alone.
  const mountEdited = async (data: Record<string, unknown>) => {
    path = '/en/goteav/timeline';
    withRoutes(() => undefined);
    const event = { id: 'e1', kind: 'field_changed', data, at: new Date().toISOString(), actorKind: 'user' };
    mount(
      <p data-testid="detail">
        <EventDetail card={{ type: 'task', key: 'GTV-1' } as never} event={event as never} />
      </p>,
    );
    await waitFor(() => expect(screen.getByTestId('detail')).toBeInTheDocument());
  };

  it('says which field changed in words, never the raw key, hash or ISO date', async () => {
    await mountEdited({
      changes: [
        { field: 'body', from: 'aaa111', to: 'bbb222' },
        { field: 'dueAt', from: null, to: '2026-11-19T15:42:00.000Z' },
      ],
    });
    const text = screen.getByTestId('detail').textContent ?? '';
    expect(text).toContain(timeline.row.fieldEdited.replace('{field}', timeline.row.fields.body));
    for (const raw of ['aaa111', 'bbb222', 'T15:42', 'dueAt']) expect(text).not.toContain(raw);
  });

  it('writes a due date and a role as a reader says them', async () => {
    await mountEdited({
      changes: [
        { field: 'dueAt', from: null, to: '2026-11-19T15:42:00.000Z' },
        { field: 'ownerRole', from: 'backend', to: 'frontend' },
      ],
    });
    const text = screen.getByTestId('detail').textContent ?? '';
    expect(text).toContain(`${timeline.row.fields.dueAt}:`);
    expect(text).toContain(kit.sheet.history.values.none);
    expect(text).toMatch(/\d{2}:\d{2}/);
    expect(text).not.toContain('T15:42');
  });

  it('draws no detail for a field it cannot name', async () => {
    await mountEdited({ changes: [{ field: 'xyz', to: 1 }] });
    expect(screen.getByTestId('detail')).toBeEmptyDOMElement();
  });
});
