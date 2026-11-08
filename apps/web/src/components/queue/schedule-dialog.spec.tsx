/**
 * @file The schedule dialog's pickers (docs/16 D58 to D60, queue review B1, M1, M8): the panel's resolved place, the run mode, extra folders, roles, a passed time, and the secret check.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { ScheduleDialog } from './run-bits';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/en/demo/queue',
}));

// The panel resolved a device and a folder that were never picked by hand (review B1).
vi.mock('@/components/workbench/store', () => ({
  useMaybeWb: () => ({
    place: {
      device: { id: '0190f0f0-0000-7000-8000-000000000001', name: 'Main', online: true },
      folder: 'F:/work/backend',
    },
    folders: ['F:/work/backend', 'F:/work/web', 'F:/work/dashboard'],
  }),
  revealChat: vi.fn(),
  revealApproval: vi.fn(),
}));

const state = {
  paused: false,
  pausedReason: null,
  resumesAt: null,
  maxConcurrent: 1,
  perDay: 5,
  usedToday: 0,
  running: 0,
  quietHours: null,
  inQuietHours: false,
  timezone: 'UTC',
  timezoneSource: 'setting',
  machineTimezone: 'UTC',
};

function serve() {
  return stubFetch((url, init) => {
    if (url.pathname.endsWith('/queue/runs') && init?.method === 'POST') {
      return {
        status: 201,
        body: {
          data: {
            id: 'r1',
            state: 'next',
            stored: 'queued',
            hold: null,
            folder: 'F:/work/backend',
            deviceName: 'Main',
            chatId: null,
          },
        },
      };
    }
    if (url.pathname.endsWith('/queue')) return { body: { data: { state, runs: [] } } };
    return undefined;
  });
}

describe('ScheduleDialog', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('takes the panel’s place, a mode, extra folders and roles, and sends them', async () => {
    const calls = serve();
    renderWithApp(
      <ScheduleDialog target={{ source: 'task', cardKey: 'GTV-1', title: 'Build it' }} onClose={() => {}} />,
      { locale: 'en' },
    );
    await userEvent.selectOptions(await screen.findByLabelText('When'), 'now');
    await userEvent.selectOptions(screen.getByLabelText('How it runs'), 'automatic');
    expect(screen.getByText(/Never waits for you/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'F:/work/web' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Backend' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Frontend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(calls.calls.some((call) => call.path.endsWith('/queue/runs'))).toBe(true));
    const body = calls.calls.find((call) => call.path.endsWith('/queue/runs'))!.body;
    expect(body).toMatchObject({
      source: 'task',
      cardKey: 'GTV-1',
      device: '0190f0f0-0000-7000-8000-000000000001',
      folder: 'F:/work/backend',
      mode: 'automatic',
      extraFolders: ['F:/work/web'],
      roles: ['backend', 'frontend'],
      when: { kind: 'now' },
    });
  });

  it('the main folder is never also an extra one', async () => {
    serve();
    renderWithApp(
      <ScheduleDialog target={{ source: 'task', cardKey: 'GTV-1', title: 'Build it' }} onClose={() => {}} />,
      { locale: 'en' },
    );
    await screen.findByLabelText('Main folder');
    expect(screen.queryByRole('checkbox', { name: 'F:/work/backend' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Main folder'), 'F:/work/web');
    expect(screen.getByRole('checkbox', { name: 'F:/work/backend' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'F:/work/web' })).toBeNull();
  });

  it('a passed time says it would start at once (review M1)', async () => {
    serve();
    renderWithApp(
      <ScheduleDialog target={{ source: 'task', cardKey: 'GTV-1', title: 'Build it' }} onClose={() => {}} />,
      { locale: 'en' },
    );
    await userEvent.selectOptions(await screen.findByLabelText('When'), 'custom');
    const date = screen.getByLabelText('Date');
    await userEvent.clear(date);
    await userEvent.type(date, '2020-01-01');
    expect(screen.getByText('That time has passed, so it would start at once.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add now' })).toBeInTheDocument();
  });

  it('New run refuses a prompt that holds a secret (review M8)', async () => {
    serve();
    renderWithApp(
      <ScheduleDialog target={{ source: 'prompt', prompt: '', title: '' }} onClose={() => {}} />,
      { locale: 'en' },
    );
    await userEvent.type(
      await screen.findByLabelText('What to do'),
      'use ghp_abcdefghijklmnopqrstuvwxyz0123456789',
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });
});
