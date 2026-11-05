/**
 * @file Settings › Devices: the four states, the health rows with their Fix, Revoke, the one command, and the approval page's answers. No secret is ever on the page.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectApproval } from '@/components/auth/connect-approval';
import { renderWithApp, stubFetch } from '@/test/render';

import { DevicesTab } from './devices';
import { LinkFolder } from './link-folder';

const search = vi.hoisted(() => ({ value: 'code=ABCD-EFGH' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/demo/settings',
}));

const check = (over: Record<string, unknown>) => ({
  id: 'mcp_server',
  ok: true,
  level: 'ok',
  detail: null,
  fix: null,
  hint: null,
  ...over,
});

const device = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  name: 'LAPTOP',
  platform: 'win32',
  online: true,
  bridgeVersion: '0.1.0',
  claudeVersion: '2.1.318',
  vscodeFound: true,
  lastSeenAt: '2026-11-06T10:00:00Z',
  pairedAt: '2026-11-06T09:00:00Z',
  health: [],
  healthAt: new Date().toISOString(),
  ...over,
});

const COMMAND = {
  apiUrl: 'http://localhost:7310',
  connect: 'node -e "fetch(\'http://localhost:7310/api/v1/connect/bootstrap\')"',
  uninstall: 'node -e "fetch(\'http://localhost:7310/api/v1/connect/bootstrap?action=uninstall\')"',
};

function api(devices: unknown, extra: (url: string, method: string) => unknown = () => undefined) {
  return stubFetch(({ href: url }, _init, request) => {
    const special = extra(url, request?.method ?? 'GET');
    if (special) return special;
    if (url.includes('me/devices/connect-command')) return { body: { data: COMMAND } };
    if (url.endsWith('me/devices')) return { body: { data: devices } };
    return undefined;
  });
}

const show = (ui: React.ReactElement, locale: 'en' | 'ar' = 'en') =>
  renderWithApp(<Tooltip.Provider>{ui}</Tooltip.Provider>, { locale });

describe('DevicesTab', () => {
  beforeEach(() => {
    search.value = 'code=ABCD-EFGH';
  });

  it('with no device: an honest empty state, and the one command', async () => {
    api([]);
    show(<DevicesTab />);
    expect(await screen.findByText('No devices yet')).toBeTruthy();
    expect(await screen.findByText(COMMAND.connect)).toBeTruthy();
  });

  it('says what is online, and its Claude Code', async () => {
    api([device(), device({ id: 'd2', name: 'OLD-PC', online: false, health: [check({})] })]);
    show(<DevicesTab />);
    expect(await screen.findByText('LAPTOP')).toBeTruthy();
    expect(screen.getByText('Online')).toBeTruthy();
    expect(screen.getByText('Offline')).toBeTruthy();
    expect(screen.getAllByText('2.1.318').length).toBeGreaterThan(0);
  });

  it('shows a check that failed, with its hint, and Fix runs the named fix', async () => {
    const fixed = device({ health: [check({})] });
    const { calls } = api(
      [
        device({
          health: [
            check({ id: 'mcp_server', ok: false, level: 'error', fix: 'mcp_server', detail: 'http://h/mcp' }),
            check({
              id: 'claude_path_version',
              ok: false,
              level: 'warn',
              detail: '2.1.202',
              hint: 'npm install -g @anthropic-ai/claude-code@latest',
            }),
          ],
        }),
      ],
      (url) => (url.includes('/fix') ? { body: { data: fixed } } : undefined),
    );
    show(<DevicesTab />);
    expect(await screen.findByText('Hub is not set up in Claude Code')).toBeTruthy();
    expect(screen.getByText('npm install -g @anthropic-ai/claude-code@latest')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Fix/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Fix/ }));
    await waitFor(() =>
      expect(calls.find((call) => call.path.endsWith('/fix'))?.body).toEqual({ fix: 'mcp_server' }),
    );
    expect(await screen.findByText('Hub is set up in Claude Code')).toBeTruthy();
  });

  it('asks an online device for its report on open, once, when the last one is old', async () => {
    const asked: string[] = [];
    api([device({ healthAt: null })], (url) => {
      if (url.endsWith('/health')) {
        asked.push(url);
        return { body: { data: device({ health: [check({})] }) } };
      }
      return undefined;
    });
    show(<DevicesTab />);
    expect(await screen.findByText('Hub is set up in Claude Code')).toBeTruthy();
    expect(asked).toHaveLength(1);
  });

  it('an offline device cannot be checked or fixed, and says so', async () => {
    api([
      device({
        online: false,
        health: [check({ id: 'plugin', ok: false, level: 'error', fix: 'plugin' })],
        healthAt: '2026-11-06T09:00:00Z',
      }),
    ]);
    show(<DevicesTab />);
    await screen.findByText('LAPTOP');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Check now' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: /^Fix/ }).disabled).toBe(true);
  });

  it('revokes after asking', async () => {
    const deleted: string[] = [];
    api([device()], (url, method) => {
      if (method === 'DELETE') {
        deleted.push(url);
        return { status: 204 };
      }
      return undefined;
    });
    show(<DevicesTab />);
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke: LAPTOP' }));
    expect(deleted).toEqual([]);
    const buttons = await screen.findAllByRole('button', { name: 'Revoke' });
    await userEvent.click(buttons.at(-1)!);
    await waitFor(() => expect(deleted[0]).toContain('me/devices/d1'));
  });

  it('renders in Arabic', async () => {
    api([device({ health: [check({})] })]);
    show(<DevicesTab />, 'ar');
    expect(await screen.findByText('متصل')).toBeTruthy();
  });

  it('shows an error state when the list fails', async () => {
    stubFetch(({ href: url }) =>
      url.includes('me/devices')
        ? { status: 500, body: { error: { code: 'hub.common.internal', message: 'x' } } }
        : undefined,
    );
    show(<DevicesTab />);
    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeTruthy();
  });
});

describe('LinkFolder', () => {
  it('with no online device: says where to connect one', async () => {
    api([device({ online: false })]);
    show(<LinkFolder slug="demo" />);
    expect(await screen.findByText(/No device is online/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Link this folder' })).toBeNull();
  });

  it('refuses a relative path before asking anything', async () => {
    const posts: string[] = [];
    api([device()], (url, method) => {
      if (method === 'POST') posts.push(url);
      return undefined;
    });
    show(<LinkFolder slug="demo" />);
    await userEvent.type(await screen.findByLabelText(/Folder/), 'relative/path');
    await userEvent.click(screen.getByRole('button', { name: 'Link this folder' }));
    expect(await screen.findByText(/absolute path/)).toBeTruthy();
    expect(posts).toEqual([]);
  });

  it('on a press: says what changed, and names the backup', async () => {
    api([device()], (url, method) =>
      url.includes('/link') && method === 'POST'
        ? {
            body: {
              data: {
                outcome: 'linked',
                folder: 'F:/work/repo',
                project: 'demo',
                backup: 'C:/Users/me/.claude.json.hub-backup-1',
                registered: true,
              },
            },
          }
        : undefined,
    );
    show(<LinkFolder slug="demo" />);
    await userEvent.type(await screen.findByLabelText(/Folder/), 'F:/work/repo');
    await userEvent.click(screen.getByRole('button', { name: 'Link this folder' }));
    expect(await screen.findByText('F:/work/repo')).toBeTruthy();
    expect(screen.getByText('C:/Users/me/.claude.json.hub-backup-1')).toBeTruthy();
  });

  it('an unexpected config: changed nothing, and tells the owner to accept the dialog once', async () => {
    api([device()], (url, method) =>
      url.includes('/link') && method === 'POST'
        ? {
            body: {
              data: {
                outcome: 'shape_unexpected',
                folder: 'F:/work/repo',
                project: 'demo',
                backup: null,
                registered: true,
              },
            },
          }
        : undefined,
    );
    show(<LinkFolder slug="demo" />);
    await userEvent.type(await screen.findByLabelText(/Folder/), 'F:/work/repo');
    await userEvent.click(screen.getByRole('button', { name: 'Link this folder' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/changed nothing/i);
    expect(alert.textContent).toMatch(/accept the trust dialog once/i);
  });
});

describe('ConnectApproval', () => {
  const pairing = (status: string) => ({
    userCode: 'ABCD-EFGH',
    name: 'NEW-LAPTOP',
    platform: 'win32',
    status,
    expiresAt: '2026-11-06T10:10:00Z',
  });

  beforeEach(() => {
    search.value = 'code=ABCD-EFGH';
  });

  it('shows the device and the code to compare, and approves', async () => {
    const posted: string[] = [];
    let status = 'pending';
    stubFetch(({ href: url }, _init, request) => {
      if (request?.method === 'POST') {
        posted.push(url);
        status = 'approved';
        return { status: 204 };
      }
      if (url.includes('pairing/ABCD-EFGH')) return { body: { data: pairing(status) } };
      return undefined;
    });
    renderWithApp(<ConnectApproval />, { locale: 'en' });
    expect(await screen.findByText('NEW-LAPTOP')).toBeTruthy();
    expect(screen.getAllByText('ABCD-EFGH').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Approve this device' }));
    await waitFor(() => expect(posted[0]).toContain('pairing/ABCD-EFGH/approve'));
    expect(await screen.findByText('This device is approved')).toBeTruthy();
  });

  it('a refusal says so', async () => {
    stubFetch(({ href: url }) =>
      url.includes('pairing/') ? { body: { data: pairing('denied') } } : undefined,
    );
    renderWithApp(<ConnectApproval />, { locale: 'en' });
    expect(await screen.findByText('This device was refused')).toBeTruthy();
  });

  it('a wrong or expired code tells the owner to run the command again', async () => {
    stubFetch(({ href: url }) =>
      url.includes('pairing/')
        ? { status: 404, body: { error: { code: 'hub.devices.pairing_not_found', message: 'gone' } } }
        : undefined,
    );
    renderWithApp(<ConnectApproval />, { locale: 'en' });
    expect(await screen.findByText(/Run the command again/)).toBeTruthy();
  });

  it('no code at all: the same, with no call', async () => {
    search.value = '';
    renderWithApp(<ConnectApproval />, { locale: 'ar' });
    expect(await screen.findByText(/شغّل الأمر من جديد/)).toBeTruthy();
  });
});
