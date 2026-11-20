/**
 * @file The plan page's live layer (v5-live-plan, batch 2) on Hub's data: a queue run on a step shows Claude's card with its stages, the halo on
 * its phase and the live row; a run waiting on an approval answers it on the run's chat; the feed reads stored times; a phase completing while the
 * page is open celebrates.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Store from '@/components/workbench/store';
import { renderWithApp, stubFetch } from '@/test/render';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/demo/planning',
}));

vi.mock('@/components/workbench/store', async (original) => {
  const wb = { deviceName: 'Main PC', engine: 'ok', place: { device: null, folder: null } };
  return { ...(await original<typeof Store>()), useMaybeWb: () => wb, useWb: () => wb };
});

const { PlanningPage } = await import('./planning-page');

const me = {
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};

const page = (items: unknown[]) => ({
  body: { data: items, meta: { pagination: { nextCursor: null, limit: 100 } } },
});

const phases = [
  { id: 'p0', title: 'Setup' },
  { id: 'p1', title: 'Build' },
];
const baseSteps = [
  { id: 's1', title: 'Decide', done: true, doneAt: '2026-11-19T09:00:00.000Z', phaseId: 'p0' },
  { id: 's2', title: 'Write the form', done: false, phaseId: 'p0' },
  { id: 's3', title: 'Build the page', done: false, phaseId: 'p1' },
];

const plan = (steps: unknown[]) => ({
  id: 'id-P-1',
  key: 'P-1',
  type: 'plan',
  status: 'in_progress',
  title: 'Title P-1',
  priority: 'P2',
  ownerRole: 'owner',
  createdAt: '2026-11-18T09:00:00.000Z',
  lastEventAt: '2026-11-19T09:00:00.000Z',
  createdBy: { kind: 'user', userId: 'u1', displayName: 'Owner', via: 'web' },
  flags: {},
  tags: [],
  commentCount: 0,
  body: 'The approach',
  allowedActions: ['plan.update'],
  detail: { revision: 1, phases, steps },
});

const queueRun = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  source: 'plan_step',
  title: 'Write the form',
  cardKey: 'P-1',
  planStep: 1,
  prompt: '',
  deviceId: 'd1',
  deviceName: 'Main PC',
  folder: 'F:/web',
  extraFolders: [],
  mode: 'approval',
  roles: [],
  decisions: [],
  state: 'running',
  stored: 'running',
  hold: null,
  worktree: null,
  dirtyFiles: null,
  allowDirty: false,
  runAt: null,
  repeat: null,
  paused: false,
  position: 0,
  chatId: 'c1',
  messageId: 'm1',
  waitingOn: null,
  failure: null,
  summary: null,
  changedFiles: [],
  moved: null,
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  endedAt: null,
  ...over,
});

const chat = (approvals: unknown[] = []) => ({
  id: 'c1',
  deviceOnline: true,
  messages: [
    {
      id: 'm1',
      role: 'assistant',
      stages: [
        { protocol: 'work', stage: 'understand', state: 'done', at: '2026-11-20T10:00:00.000Z' },
        {
          protocol: 'work',
          stage: 'plan',
          state: 'started',
          at: '2026-11-20T10:01:00.000Z',
          note: 'Writing the checks',
        },
      ],
      approvals,
      questions: [],
    },
  ],
});

interface Api {
  card: unknown;
  runs: unknown[];
  chat: unknown;
}

function api(state: Api) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return { body: { data: me } };
    if (method === 'POST' && path.endsWith('/chats/c1/approvals/a1')) return { body: { data: null } };
    if (method !== 'GET') return undefined;
    if (path.endsWith('/members')) return page([]);
    if (path.endsWith('/cards/P-1')) return { body: { data: state.card } };
    if (path.endsWith('/queue')) return { body: { data: { state: {}, runs: state.runs } } };
    if (path.endsWith('/chats/c1')) return { body: { data: state.chat } };
    if (path.endsWith('/work-reports')) return { body: { data: [] } };
    if (path.endsWith('/events') || path.endsWith('/comments')) return page([]);
    if (path.endsWith('/ideas') || path.endsWith('/plans')) return page([]);
    return undefined;
  });
}

const show = (ui: ReactNode) => renderWithApp(<Tooltip.Provider>{ui}</Tooltip.Provider>);

beforeEach(() => {
  vi.unstubAllGlobals();
  search = 'plan=P-1';
});

describe('the plan page, live with Claude', () => {
  it('shows Claude on the running step: its stages, the halo on its phase, the live row and the feed', async () => {
    api({ card: plan(baseSteps), runs: [queueRun()], chat: chat() });
    show(<PlanningPage />);
    const card = await screen.findByRole('region', { name: 'Claude on step 2' });
    expect(within(card).getByText('Claude is working on step 2')).toBeTruthy();
    // The stages are the run's own `report_stage` reports, read from its chat.
    expect(await within(card).findByText('Writing the checks')).toBeTruthy();
    const stages = within(card).getByRole('list', { name: "Stages of Claude's work" });
    expect(stages.textContent).toContain('Understand: done');
    expect(stages.textContent).toContain('Plan: in progress');
    expect(stages.textContent).toContain('Execute: not started');
    expect(await within(card).findByText('Writing the checks')).toBeTruthy();
    // The halo is on the phase holding the step, and the stop says so.
    const map = screen.getByRole('group', { name: 'The plan as a journey' });
    const stops = within(map).getAllByRole('button');
    expect(stops[0]?.getAttribute('aria-label')).toMatch(/Claude is working here$/);
    expect(stops[1]?.getAttribute('aria-label')).not.toMatch(/Claude is working here/);
    expect(document.querySelectorAll('[data-pj-halo]')).toHaveLength(1);
    expect(document.querySelector('[data-pj-live-row]')).toBeTruthy();
    const feed = screen.getByRole('region', { name: 'Live activity' });
    expect(within(feed).getByText('Claude started step 2')).toBeTruthy();
    expect(within(feed).getByText('Step 1 done')).toBeTruthy();
  });

  it('a run waiting on an approval asks in place, and Approve answers on the run’s chat', async () => {
    const { calls } = api({
      card: plan(baseSteps),
      runs: [
        queueRun({
          state: 'waiting',
          waitingOn: { id: 'a1', kind: 'approval', command: 'pnpm test', category: 'other' },
        }),
      ],
      chat: chat([
        {
          id: 'a1',
          messageId: 'm1',
          toolUseId: 't1',
          toolName: 'Bash',
          command: 'pnpm test',
          category: 'other',
          input: null,
          effect: '',
          draftId: null,
          status: 'pending',
          expiresAt: '',
          answeredAt: null,
          createdAt: '2026-11-20T10:02:00.000Z',
        },
      ]),
    });
    show(<PlanningPage />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Waiting for you')).toBeTruthy();
    expect(within(alert).getByText('pnpm test')).toBeTruthy();
    expect(screen.getByText('Claude is waiting for you on step 2')).toBeTruthy();
    // A press right as the box appears is not an answer.
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
    fireEvent.click(within(alert).getByRole('button', { name: 'Approve' }));
    await waitFor(() => {
      const call = calls.find((c) => c.method === 'POST' && c.path.endsWith('/chats/c1/approvals/a1'));
      expect(call?.body).toEqual({ decision: 'allow' });
    });
    expect(await within(alert).findByText('Your answer is on its way to Claude.')).toBeTruthy();
    const feed = screen.getByRole('region', { name: 'Live activity' });
    expect(within(feed).getByText('Waiting for your approval to run pnpm test')).toBeTruthy();
  });

  it('a question sends the owner to the chat instead of offering Approve', async () => {
    api({
      card: plan(baseSteps),
      runs: [
        queueRun({ state: 'waiting', waitingOn: { id: 'q1', kind: 'question', command: '', category: '' } }),
      ],
      chat: chat(),
    });
    show(<PlanningPage />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Claude asked you a question')).toBeTruthy();
    expect(within(alert).queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(within(alert).getByRole('button', { name: 'Open the chat' })).toBeTruthy();
  });

  it('with no run, the next step is in the head and nothing wears the halo', async () => {
    api({
      card: plan(baseSteps),
      runs: [queueRun({ state: 'done', endedAt: new Date().toISOString() })],
      chat: chat(),
    });
    show(<PlanningPage />);
    expect(await screen.findByText('Claude finished its run on step 2')).toBeTruthy();
    expect(screen.queryByRole('region', { name: /^Claude on step/ })).toBeNull();
    expect(document.querySelector('[data-pj-halo]')).toBeNull();
  });

  it('the chapter follows the running step whenever it moves, even after the owner picked another chapter', async () => {
    const state = { card: plan(baseSteps), runs: [queueRun()] as unknown[], chat: chat() };
    api(state);
    const { queryClient } = show(<PlanningPage />);
    await screen.findByRole('region', { name: 'Claude on step 2' });
    const chapter = () => screen.getByRole('heading', { level: 3, name: /^(Setup|Build)$/ }).textContent;
    // Step 2 is in Setup, so the chapter shows Setup.
    expect(chapter()).toBe('Setup');
    const map = screen.getByRole('group', { name: 'The plan as a journey' });
    fireEvent.click(within(map).getAllByRole('button')[1]!);
    await waitFor(() => expect(chapter()).toBe('Build'));
    // A rereading with the same running step leaves the owner's choice alone.
    await act(() => queryClient.invalidateQueries());
    expect(chapter()).toBe('Build');
    fireEvent.click(within(map).getAllByRole('button')[0]!);
    await waitFor(() => expect(chapter()).toBe('Setup'));
    // Claude moves to step 3, in Build: the chapter follows.
    state.runs = [queueRun({ planStep: 2, title: 'Build the page' })];
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => expect(chapter()).toBe('Build'));
    expect(await screen.findByRole('region', { name: 'Claude on step 3' })).toBeTruthy();
  });

  it('celebrates a phase that completes while the page is open, once', async () => {
    const state = { card: plan(baseSteps), runs: [] as unknown[], chat: chat() };
    api(state);
    const { queryClient } = show(<PlanningPage />);
    await screen.findByRole('region', { name: 'Live activity' });
    expect(document.querySelector('[data-pj-celebration]')).toBeNull();
    state.card = plan(
      baseSteps.map((s) => (s.id === 's2' ? { ...s, done: true, doneAt: new Date().toISOString() } : s)),
    );
    await act(() => queryClient.invalidateQueries());
    const banner = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-pj-celebration]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(banner.textContent).toContain('Phase 0 complete');
    expect(banner.textContent).toContain('Setup');
  });
});
