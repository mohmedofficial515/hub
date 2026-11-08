/**
 * @file Settings › Backups (docs/16 D61 to D63): the history with each state, Back up now, Keep, Delete after asking, the low-space warning, the settings'
 * save bar, the restore command, the owner-only rule, and Arabic.
 */
import type { BackupDto, BackupsDto } from '@hub/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { BackupsTab, paddedTime } from './backups';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('tab=backups'),
  usePathname: () => '/en/demo/settings',
}));

const FOLDER = 'F:\\HubBackups';

const backup = (over: Partial<BackupDto> = {}): BackupDto => ({
  id: '0193ab12-0000-7000-8000-00000000000a',
  status: 'done',
  trigger: 'scheduled',
  startedAt: '2026-11-08T00:00:00.000Z',
  endedAt: '2026-11-08T00:00:20.000Z',
  path: `${FOLDER}\\hub-20261108-000000-0000000a`,
  sizeBytes: 52_400_000,
  docs: 3,
  pinned: false,
  failure: null,
  deletedAt: null,
  deletedBy: null,
  missing: false,
  ...over,
});

const history = (over: Partial<BackupsDto> = {}): BackupsDto => ({
  items: [],
  settings: {
    folder: FOLDER,
    folderSource: 'default',
    defaultFolder: FOLDER,
    time: '03:00',
    keep: 14,
    enabled: true,
    timezone: 'Europe/Istanbul',
  },
  disk: { freeBytes: 40 * 1024 ** 3, totalBytes: 117 * 1024 ** 3, low: false },
  nextAt: '2026-11-09T00:00:00.000Z',
  running: false,
  ...over,
});

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
});

function api(
  data: BackupsDto,
  roles: string[] = ['owner'],
  extra: (path: string, method: string) => unknown = () => undefined,
) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    const special = extra(url.pathname, method);
    if (special) return special;
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (url.pathname.endsWith('/workspaces/demo/backups') && method === 'GET') return { body: { data } };
    return undefined;
  });
}

const show = (locale: 'en' | 'ar' = 'en') =>
  renderWithApp(
    <Tooltip.Provider>
      <BackupsTab />
    </Tooltip.Provider>,
    { locale },
  );

describe('BackupsTab', () => {
  it('with no backup yet: an honest empty state, the next time and the free space', async () => {
    api(history());
    show();
    expect(await screen.findByText('No backups yet')).toBeTruthy();
    expect(screen.getByText(/Next backup/)).toBeTruthy();
    expect(screen.getByText(/free of/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lists each backup with its time, size, documents and state, in words', async () => {
    api(
      history({
        items: [
          backup({
            id: '0193ab12-0000-7000-8000-00000000000d',
            status: 'running',
            path: null,
            sizeBytes: null,
            docs: null,
            trigger: 'manual',
            endedAt: null,
          }),
          backup({
            id: '0193ab12-0000-7000-8000-00000000000c',
            status: 'failed',
            path: null,
            sizeBytes: null,
            docs: null,
            failure: 'No running Postgres container publishes the database port. Is Docker running?',
          }),
          backup({ id: '0193ab12-0000-7000-8000-00000000000b', pinned: true, trigger: 'catch_up' }),
          backup({ deletedAt: '2026-11-08T05:00:00.000Z', deletedBy: 'retention' }),
        ],
        running: true,
      }),
    );
    show();
    expect(await screen.findByText('Running')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    // The failure in words with a next step; the API's own text only under Details, to copy (review M3).
    expect(
      screen.getByText(/Start Docker Desktop, wait until it is ready, then press Back up now/),
    ).toBeTruthy();
    const details = screen.getByText('Details').closest('details')!;
    expect(details.open).toBe(false);
    expect(within(details).getByText(/No running Postgres container/)).toBeTruthy();
    expect(within(details).getByRole('button', { name: 'Copy the error text' })).toBeTruthy();
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Pinned')).toBeTruthy();
    expect(screen.getByText('Deleted')).toBeTruthy();
    expect(screen.getByText(/Removed by the keep rule/)).toBeTruthy();
    expect(screen.getByText('Catch-up for a missed night')).toBeTruthy();
    // A deleted line is not faded: its text keeps its contrast (review M5).
    const deleted = document.querySelector('[data-backup="0193ab12-0000-7000-8000-00000000000a"]')!;
    expect(deleted.className).not.toMatch(/opacity/);
    expect(screen.getAllByText('3 documents').length).toBeGreaterThan(0);
    expect(screen.getAllByText('52.4 MB').length).toBeGreaterThan(0);
    // A running backup holds the button, and says so.
    expect(screen.getByText('A backup is running…')).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /Back up now/ }).disabled).toBe(true);
    // Nothing to keep or delete on a running or deleted line.
    const running = document.querySelector('[data-backup="0193ab12-0000-7000-8000-00000000000d"]')!;
    expect(within(running as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('Back up now starts one', async () => {
    const started = backup({ status: 'running', path: null, sizeBytes: null });
    const { calls } = api(history(), ['owner'], (path, method) =>
      path.endsWith('/backups') && method === 'POST' ? { status: 202, body: { data: started } } : undefined,
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Back up now/ }));
    await waitFor(() =>
      expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/backups'))).toBe(true),
    );
  });

  it('Keep pins a backup, and Delete asks first, naming a kept one', async () => {
    const { calls } = api(history({ items: [backup({ pinned: true })] }), ['owner'], (path, method) => {
      if (path.endsWith('/pin')) return { body: { data: backup() } };
      if (method === 'DELETE')
        return { body: { data: backup({ deletedAt: '2026-11-08T06:00:00Z', deletedBy: 'owner' }) } };
      return undefined;
    });
    show();
    const stop = await screen.findByRole('button', { name: /^Unpin/ });
    expect(stop.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(stop);
    await waitFor(() =>
      expect(calls.find((call) => call.path.endsWith('/pin'))?.body).toEqual({ pinned: false }),
    );

    await userEvent.click(screen.getByRole('button', { name: /^Delete/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/This backup is pinned/)).toBeTruthy();
    // It names what goes: the size and the folder, since it cannot be undone.
    expect(within(dialog).getByText(/52.4 MB/)).toBeTruthy();
    expect(within(dialog).getByText('hub-20261108-000000-0000000a')).toBeTruthy();
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === 'DELETE' && call.path.endsWith('/backups/0193ab12-0000-7000-8000-00000000000a'),
        ),
      ).toBe(true),
    );
  });

  it('warns when the backup drive is low on space', async () => {
    api(history({ disk: { freeBytes: 2 * 1024 ** 3, totalBytes: 117 * 1024 ** 3, low: true } }));
    show();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('low on space');
  });

  it('saves the nightly time, how many to keep and the folder together, from the bar', async () => {
    const { calls } = api(history(), ['owner'], (path, method) =>
      method === 'PATCH' ? { body: { data: history().settings } } : undefined,
    );
    show();
    const keep = await screen.findByLabelText('Newest backups to keep');
    await userEvent.clear(keep);
    await userEvent.type(keep, '30');
    await userEvent.type(screen.getByLabelText('Backup folder'), 'E:\\Safe');
    await userEvent.click(screen.getByRole('button', { name: 'Save backup settings' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ keep: 30, folder: 'E:\\Safe' }),
    );
  });

  it('gives the restore command for the latest backup, and has no restore button', async () => {
    api(history({ items: [backup()] }));
    show();
    expect(
      await screen.findByText(`pnpm hub:restore "${FOLDER}\\hub-20261108-000000-0000000a"`),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Restore/ })).toBeNull();
  });

  it('is the owner’s alone: anyone else is told so, and nothing is asked', async () => {
    const { calls } = api(history(), ['pm']);
    show();
    expect(await screen.findByText(/You don.t have access/)).toBeTruthy();
    expect(calls.some((call) => call.path.endsWith('/backups'))).toBe(false);
  });

  it('renders in Arabic', async () => {
    api(history({ items: [backup()] }));
    show('ar');
    expect(await screen.findByText('تمت')).toBeTruthy();
    // "Back up" and "copy" are different words in Arabic, and so are "pinned" and "kept by the rule" (review M4).
    expect(screen.getByRole('button', { name: /خذ نسخة احتياطية الآن/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^ثبّتها/ })).toBeTruthy();
    expect(screen.getByLabelText('عدد أحدث النسخ التي تبقى')).toBeTruthy();
    expect(screen.getByText('ليلية')).toBeTruthy();
  });

  it('offers no pin for a backup whose folder is gone', async () => {
    api(history({ items: [backup({ missing: true })] }));
    show();
    expect(await screen.findByText('Folder missing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Pin/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Delete/ })).toBeTruthy();
  });

  it('says a refused folder or a full drive in words, with what to do', async () => {
    api(
      history({
        items: [
          backup({ status: 'failed', path: null, sizeBytes: null, failure: 'hub.backups.folder_in_repo' }),
          backup({
            id: '0193ab12-0000-7000-8000-00000000000e',
            status: 'failed',
            path: null,
            sizeBytes: null,
            failure: 'ENOSPC: no space left on device, write',
          }),
        ],
      }),
    );
    show();
    expect(await screen.findByText(/could not write to the backup folder/)).toBeTruthy();
    expect(screen.getByText(/The backup drive is full/)).toBeTruthy();
  });

  it('reads the nightly time in 24-hour form, pads it, and refuses what is not a time', async () => {
    const { calls } = api(history(), ['owner'], (path, method) =>
      method === 'PATCH' ? { body: { data: history().settings } } : undefined,
    );
    show();
    const time = await screen.findByLabelText('Time');
    expect(time.getAttribute('type')).not.toBe('time');
    await userEvent.clear(time);
    await userEvent.type(time, '25:00');
    expect(await screen.findByText(/24-hour form/)).toBeTruthy();
    // Not a change to save: the bar stays hidden.
    expect(screen.getByRole('button', { name: 'Save backup settings' }).parentElement!.className).toMatch(
      /\bhidden\b/,
    );
    await userEvent.clear(time);
    await userEvent.type(time, '4:30');
    await userEvent.tab();
    expect((time as HTMLInputElement).value).toBe('04:30');
    await userEvent.click(screen.getByRole('button', { name: 'Save backup settings' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({ time: '04:30' }),
    );
  });

  it('shows a neutral example in the empty folder field, not the default path', async () => {
    api(history());
    show();
    const folder = await screen.findByLabelText('Backup folder');
    expect(folder.getAttribute('placeholder')).toBe('such as D:\\HubBackups');
  });
});

describe('paddedTime', () => {
  it('pads hours and minutes, and leaves anything else', () => {
    expect(paddedTime('3:5')).toBe('03:05');
    expect(paddedTime(' 23:30 ')).toBe('23:30');
    expect(paddedTime('noon')).toBe('noon');
  });
});
