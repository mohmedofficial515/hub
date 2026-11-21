/**
 * @file Tasks: the Focus desk fills the button of the task it calls next, keeps its stage in the URL and shows a member what they sent for
 * review; the list's table keeps a row's signals, returns to the default order on a third press, and filters by assignee.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { summary } from '@/components/cards/test-fixture';
import { getQueryClient } from '@/lib/query-client';
import { renderWithApp, stubFetch } from '@/test/render';

import { focusDeskOf } from './focus-desk';
import { TasksPage } from './tasks-page';

vi.mock('next/navigation', async () => (await import('@/components/cards/test-nav')).liveNavigation());

const ME = 'u1';

/** A title with no digits, which the page would set apart as a number run. */
const titleOf = (key: string) =>
  `Task ${key
    .slice(4)
    .split('')
    .map((d) => 'abcdefghij'[Number(d)])
    .join('')}`;

const row = (key: string, fields: Record<string, unknown> = {}, detail: Record<string, unknown> = {}) => ({
  ...summary(key, { title: titleOf(key), ownerRole: 'backend', ...fields }),
  links: [],
  allowedActions: [],
  detail: { specialty: 'backend', origin: 'manual', ...detail },
});

function serve(rows: unknown[], roles: string[] = ['backend'], next?: unknown[]) {
  return stubFetch((url) => {
    const p = url.pathname;
    if (p.endsWith('/today/next'))
      return next ? { body: { data: { items: next } } } : { status: 500, body: {} };
    if (p.endsWith('/auth/me'))
      return {
        body: {
          data: {
            id: ME,
            displayName: 'Me',
            workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
          },
        },
      };
    if (p.endsWith('/members'))
      return {
        body: {
          data: [
            { id: ME, displayName: 'Me', roles },
            { id: 'u2', displayName: 'Sara', roles: ['backend'] },
          ],
          meta: {},
        },
      };
    if (p.endsWith('/tasks') || p.endsWith('/tasks/ready'))
      return { body: { data: p.endsWith('/ready') ? [] : rows, meta: { pagination: { nextCursor: null } } } };
    if (p.endsWith('/counters')) return { body: { data: {} } };
    return undefined;
  });
}

function show(search: string) {
  window.history.replaceState(null, '', `/en/demo/tasks?${search}`);
  const client = getQueryClient();
  client.clear();
  client.setDefaultOptions({ queries: { retry: false } });
  return renderWithApp(
    <Tooltip.Provider>
      <main id="main">
        <TasksPage />
      </main>
    </Tooltip.Provider>,
    { client },
  );
}

const filled = () => [...document.querySelectorAll('button.btn-sheen')];
const params = () => new URLSearchParams(window.location.search);

afterEach(() => vi.unstubAllGlobals());

describe('Tasks › Focus desk', () => {
  it('fills only the button of the task it calls next', async () => {
    serve([
      row('DMO-1', { status: 'in_progress', assigneeId: ME }, { claimedById: ME }),
      row('DMO-2', { status: 'ready' }),
    ]);
    show('view=focus');
    const next = await screen.findByRole('region', { name: 'Next for you' });
    await within(next).findByText(titleOf('DMO-1'));
    await waitFor(() => expect(filled()).toHaveLength(1));
    expect(next.contains(filled()[0]!)).toBe(true);
  });

  it('takes its next task from Do next, with the reasons as pills', async () => {
    const item = (key: string, reasons: string[], blocks = 0) => ({
      key,
      type: 'task',
      title: titleOf(key),
      reasons,
      blocks,
      runnable: true,
      score: 1,
    });
    serve(
      [row('DMO-12', { status: 'ready' }), row('DMO-13', { status: 'ready' })],
      ['backend'],
      [item('DMO-13', ['blocks', 'ready'], 1), item('DMO-12', ['ready'])],
    );
    show('view=focus');
    const next = await screen.findByRole('region', { name: 'Next for you' });
    await within(next).findByText(titleOf('DMO-13'));
    expect(await within(next).findByText('Blocks 1 card')).toBeTruthy();
    // Ready to start is the queue's own word, so a ranked row there shows no pill for it.
    const queue = screen.getByRole('region', { name: /Ready tasks/ });
    expect(within(queue).getByText(titleOf('DMO-12'))).toBeTruthy();
    expect(queue.querySelector('[data-task-reasons]')).toBeNull();
  });

  it('keeps the board order when Do next has no answer', async () => {
    serve([row('DMO-14', { status: 'ready' }), row('DMO-15', { status: 'ready' })]);
    show('view=focus');
    const next = await screen.findByRole('region', { name: 'Next for you' });
    expect(await within(next).findByText(titleOf('DMO-14'))).toBeTruthy();
    expect(next.querySelector('[data-task-reasons]')).toBeNull();
  });

  it('opens a task in review from its row, rather than finishing it there', async () => {
    serve([row('DMO-16', { status: 'in_review' })], ['owner']);
    show('view=focus&stage=in_review');
    const review = await screen.findByRole('button', { name: 'Review' });
    expect(screen.queryByRole('button', { name: 'Mark done' })).toBeNull();
    fireEvent.click(review);
    await waitFor(() => expect(params().get('card')).toBe('DMO-16'));
  });

  it('keeps the chosen stage in the URL', async () => {
    serve([row('DMO-3', { status: 'in_review' })]);
    const view = show('view=focus');
    fireEvent.click(await screen.findByRole('button', { name: /^In review/ }));
    await waitFor(() => expect(params().get('stage')).toBe('in_review'));
    view.unmount();
    show(`view=focus&stage=in_review`);
    expect(await screen.findByRole('heading', { name: /In review tasks/ })).toBeTruthy();
  });

  it('shows a member who does not review what they sent', async () => {
    serve([row('DMO-4', { status: 'in_review', assigneeId: ME })]);
    show('view=focus');
    const sent = await screen.findByRole('region', { name: /Sent, waiting for review/ });
    expect(within(sent).getByText(titleOf('DMO-4'))).toBeTruthy();
  });

  it('groups what a non-reviewer sent', () => {
    const empty = { backlog: [], ready: [], claimed: [], in_progress: [], done: [] };
    const sent = { key: 'DMO-5', status: 'in_review', assigneeId: ME } as never;
    const other = { key: 'DMO-6', status: 'in_review', assigneeId: 'u2' } as never;
    const desk = focusDeskOf({ ...empty, in_review: [sent, other] }, 'ready', {
      meId: ME,
      primaryKey: undefined,
      seesReview: false,
    });
    expect(desk.sent.map((c) => c.key)).toEqual(['DMO-5']);
    expect(
      focusDeskOf({ ...empty, in_review: [sent] }, 'ready', {
        meId: ME,
        primaryKey: undefined,
        seesReview: true,
      }).sent,
    ).toEqual([]);
  });
});

describe('Tasks › List', () => {
  const wide = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  beforeEach(() => {
    // jsdom lays nothing out, so the page reports the width of a desktop.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1400 });
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    if (wide) Object.defineProperty(window, 'matchMedia', wide);
    if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
  });

  it('keeps mine, overdue and blocked under the title', async () => {
    serve([
      {
        ...row('DMO-7', {
          status: 'in_progress',
          assigneeId: ME,
          dueAt: '2026-01-01T10:00:00.000Z',
          flags: { overdue: true },
        }),
        blockedBy: ['DMO-8'],
      },
    ]);
    show('view=list');
    const table = await screen.findByRole('table');
    const signals = await waitFor(() => {
      const el = table.querySelector<HTMLElement>('[data-task-signals]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(within(signals).getByText(/overdue/i)).toBeTruthy();
    expect(within(signals).getByText(/DMO-8/)).toBeTruthy();
    expect(signals.children.length).toBe(3);
  });

  it('returns to the default order on the third press', async () => {
    serve([row('DMO-9')]);
    show('view=list');
    const sortBy = async () => screen.findByRole('button', { name: 'Sort by Priority' });
    fireEvent.click(await sortBy());
    await waitFor(() => expect(params().get('sort')).toBe('priority'));
    fireEvent.click(await sortBy());
    await waitFor(() => expect(params().get('order')).toBe('desc'));
    fireEvent.click(await sortBy());
    await waitFor(() => expect(params().get('sort')).toBeNull());
    expect((await sortBy()).closest('th')?.getAttribute('aria-sort')).toBe('none');
  });

  it('filters to the tasks nobody holds', async () => {
    serve([row('DMO-10'), row('DMO-11', { status: 'in_progress', assigneeId: 'u2' })]);
    show('view=list&assignee=none');
    expect(await screen.findByText(titleOf('DMO-10'))).toBeTruthy();
    expect(screen.queryByText(titleOf('DMO-11'))).toBeNull();
  });
});
