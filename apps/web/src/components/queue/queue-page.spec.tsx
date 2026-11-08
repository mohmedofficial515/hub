/**
 * @file The agent queue page: its four states, its sections, why a run waits, the one filled button, and the keyboard order.
 */
import type { AgentRunDto, QueueDto } from '@hub/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { QueuePage } from './queue-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/en/demo/queue',
}));

const state: QueueDto['state'] = {
  paused: false,
  pausedReason: null,
  resumesAt: null,
  maxConcurrent: 1,
  perDay: 5,
  usedToday: 2,
  running: 1,
  quietHours: null,
  inQuietHours: false,
  timezone: 'Europe/Istanbul',
  timezoneSource: 'machine',
  machineTimezone: 'Europe/Istanbul',
};

const run = (over: Partial<AgentRunDto>): AgentRunDto => ({
  id: 'r1',
  source: 'prompt',
  title: 'Tidy the README',
  cardKey: null,
  planStep: null,
  prompt: 'Tidy the README',
  deviceId: 'd1',
  deviceName: 'Main',
  folder: 'F:/work/repo',
  extraFolders: [],
  mode: 'approval',
  roles: [],
  decisions: [],
  state: 'next',
  stored: 'queued',
  hold: null,
  runAt: null,
  repeat: null,
  paused: false,
  position: 1,
  chatId: null,
  messageId: null,
  waitingOn: null,
  failure: null,
  summary: null,
  changedFiles: [],
  moved: null,
  createdAt: '2026-11-08T08:00:00Z',
  startedAt: null,
  endedAt: null,
  ...over,
});

function serve(queue: QueueDto | 'error') {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/queue')) {
      return queue === 'error'
        ? { status: 500, body: { error: { code: 'hub.common.internal', message: 'down' } } }
        : { body: { data: queue } };
    }
    if (url.pathname.endsWith('/queue/order')) return { body: { data: queue } };
    return undefined;
  });
}

describe('QueuePage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('says when nothing is in the queue, and New run is the filled button', async () => {
    serve({ state, runs: [] });
    renderWithApp(<QueuePage />, { locale: 'en' });
    expect(await screen.findByText('Nothing in the queue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New run/ }).className).toMatch(/bg-primary/);
  });

  it('shows an error it can retry', async () => {
    serve('error');
    renderWithApp(<QueuePage />, { locale: 'en' });
    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });

  it('puts runs in their sections, says why a run waits, and fills Answer on the first waiting run', async () => {
    serve({
      state: { ...state, pausedReason: null },
      runs: [
        run({
          id: 'w',
          state: 'waiting',
          stored: 'running',
          chatId: 'c1',
          waitingOn: { id: 'a', kind: 'approval', command: 'git push origin main', category: 'push' },
        }),
        run({ id: 'n', title: 'Lint', hold: 'concurrency' }),
        run({
          id: 's',
          title: 'Weekly tidy',
          state: 'scheduled',
          runAt: '2026-11-09T05:00:00Z',
          repeat: { day: 'MON', time: '08:00' },
        }),
        run({
          id: 'd',
          title: 'Docs pass',
          state: 'done',
          stored: 'done',
          summary: 'Rewrote the intro.',
          changedFiles: [{ path: 'README.md', source: 'git' }],
        }),
      ],
    });
    renderWithApp(<QueuePage />, { locale: 'en' });
    const waiting = await screen.findByRole('region', { name: /Waiting for your approval/ });
    expect(within(waiting).getByText('git push origin main')).toBeInTheDocument();
    expect(within(waiting).getByRole('button', { name: 'Answer' }).className).toMatch(/bg-primary/);
    const next = screen.getByRole('region', { name: /Next/ });
    expect(within(next).getByText('Waits for a running run to finish')).toBeInTheDocument();
    expect(within(next).getByText('Every Monday at 08:00')).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: /Ended lately/ });
    expect(within(recent).getByText('Rewrote the intro.')).toBeInTheDocument();
    expect(within(recent).getByText('1 changed file')).toBeInTheDocument();
  });

  it('says a usage-limit pause and when it continues', async () => {
    serve({
      state: { ...state, paused: true, pausedReason: 'usage_limit', resumesAt: '2026-11-08T15:45:00Z' },
      runs: [run({})],
    });
    renderWithApp(<QueuePage />, { locale: 'en' });
    expect(await screen.findByText(/usage limit is reached, so the queue is paused/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume all/ })).toBeInTheDocument();
  });

  it('moves a run with Alt and an arrow, and says where it went', async () => {
    const calls = serve({
      state,
      runs: [run({ id: 'a', title: 'A' }), run({ id: 'b', title: 'B', position: 2 })],
    });
    renderWithApp(<QueuePage />, { locale: 'en' });
    await screen.findByText('B');
    const second = document.querySelector<HTMLElement>('[data-queue-run="b"]')!;
    second.focus();
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await waitFor(() => expect(calls.calls.some((call) => call.path.endsWith('/queue/order'))).toBe(true));
    const order = calls.calls.find((call) => call.path.endsWith('/queue/order'))!.body as { ids: string[] };
    expect(order.ids).toEqual(['b', 'a']);
    expect(await screen.findByText('Moved “B” to place 1 of 2')).toBeInTheDocument();
  });

  it('shows an automatic run’s decisions and its pending push, which runs later in a chat (D58)', async () => {
    const calls = serve({
      state,
      runs: [
        run({
          id: 'auto',
          title: 'Ship the fix',
          state: 'done',
          stored: 'done',
          mode: 'automatic',
          chatId: 'c1',
          extraFolders: ['F:/work/web'],
          roles: ['backend', 'frontend'],
          summary: 'Fixed it.',
          decisions: [
            {
              id: 'q1',
              kind: 'answered',
              command: 'Which store?',
              category: 'other',
              folder: 'F:/work/repo',
              why: null,
              answers: [{ question: 'Which store?', answer: 'Postgres (Recommended)' }],
              at: '2026-11-08T08:01:00Z',
              followChatId: null,
            },
            {
              id: 'p1',
              kind: 'skipped',
              command: 'git push origin main',
              category: 'push',
              folder: 'F:/work/repo',
              why: 'Publish the fix',
              answers: [],
              at: '2026-11-08T08:02:00Z',
              followChatId: null,
            },
          ],
        }),
      ],
    });
    renderWithApp(<QueuePage />, { locale: 'en' });
    const recent = await screen.findByRole('region', { name: /Ended lately/ });
    expect(within(recent).getByText('Automatic')).toBeInTheDocument();
    expect(within(recent).getByText('+1 folders')).toBeInTheDocument();
    expect(within(recent).getByText(/Backend.*Frontend/)).toBeInTheDocument();
    expect(within(recent).getByText(/Choices taken: 1 · Commands kept for you: 1/)).toBeInTheDocument();
    expect(within(recent).getByText('git push origin main')).toBeInTheDocument();
    expect(within(recent).getByText('Why: Publish the fix')).toBeInTheDocument();
    expect(within(recent).getByText(/Took “Postgres \(Recommended\)”/)).toBeInTheDocument();
    await userEvent.click(within(recent).getByRole('button', { name: /Run it now/ }));
    await waitFor(() =>
      expect(calls.calls.some((call) => call.path.endsWith('/runs/auto/pending/p1/run'))).toBe(true),
    );
  });

  it('a run not started can switch to automatic from its menu, and each menu names its run', async () => {
    const calls = serve({ state, runs: [run({ id: 'n', title: 'Lint' })] });
    renderWithApp(<QueuePage />, { locale: 'en' });
    await userEvent.click(await screen.findByRole('button', { name: 'More for “Lint”' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Run automatically' }));
    await waitFor(() => {
      const call = calls.calls.find((each) => each.path.endsWith('/runs/n/mode'));
      expect(call?.body).toEqual({ mode: 'automatic' });
    });
  });
});
