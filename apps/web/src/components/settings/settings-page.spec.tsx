/**
 * @file Settings: who sees which tab, honest "not connected" states, sources in real words, a token shown once.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'radix-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { SettingsPage } from './settings-page';

const search = vi.hoisted(() => ({ value: 'tab=general' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search.value),
  usePathname: () => '/en/demo/settings',
}));

const me = (roles: string[]) => ({
  id: 'u1',
  displayName: 'Owner',
  avatarColor: 'teal',
  totpEnabled: true,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles }],
});
const project = {
  id: 'w1',
  slug: 'demo',
  name: 'Demo',
  keyPrefix: 'DMO',
  timezone: 'Europe/Istanbul',
  defaultLocale: 'ar',
  description: 'About',
  goals: null,
  links: [],
  repoPaths: [],
  status: 'active',
  closedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};
const values: Record<string, unknown> = {
  'decisions.reminder_offsets_hours': [24, 2],
  'decisions.escalation_hours': 24,
  'decisions.default_due_days': 3,
  'handoffs.stale_hours': 48,
  'needs.stale_days': 5,
  'digest.morning_time': '07:30',
  'digest.weekly_day_time': 'SUN 08:00',
  'notifications.quiet_hours': { from: '22:00', to: '07:00' },
  'security.totp_required_roles': ['owner', 'pm', 'accountant'],
  'onboarding.paths': {},
};
const source = (over: Record<string, unknown>) => ({
  id: 's1',
  kind: 'local_path',
  name: 'hub-docs',
  config: { path: 'F:/Goteav/hub/docs', purpose: 'docs' },
  hasSecret: false,
  enabled: true,
  cursor: {},
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lagSec: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
});

const answer =
  (roles: string[], sources: unknown[] = [], projectRow: unknown = project) =>
  (url: URL, init?: RequestInit, request?: Request) => {
    const path = url.pathname;
    if (path.endsWith('/auth/me')) return { body: { data: me(roles) } };
    if (path.endsWith('/settings')) {
      return {
        body: {
          data: Object.entries(values).map(([key, value]) => ({
            key,
            value,
            default: value,
            isDefault: true,
          })),
        },
      };
    }
    if (path.endsWith('/sources')) return { body: { data: sources } };
    if (path.endsWith('/capture/runs')) return { body: { data: [] } };
    if (path.endsWith('/workspaces/demo')) return { body: { data: projectRow } };
    if (path.endsWith('/me/tokens')) {
      const method = request?.method ?? init?.method ?? 'GET';
      return method === 'POST'
        ? {
            body: {
              data: { id: 't1', token: 'hub_abcd1234_secret', prefix: 'hub_abcd', name: 'x', kind: 'mcp' },
            },
          }
        : { body: { data: [] } };
    }
    return undefined;
  };

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    search.value = 'tab=general';
  });

  it('gives the owner eleven tabs (Appearance first), Backups among them, and the project details', async () => {
    stubFetch(answer(['owner']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(11));
    expect(screen.getByRole('tab', { name: 'Backups' })).toBeTruthy();
    expect(await screen.findByDisplayValue('Demo')).toBeTruthy();
    expect(screen.getByDisplayValue('About')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close project' })).toBeTruthy();
  }, 20_000);

  it('waits for the session on a direct load, so the owner never sees "no access" first (review M1)', async () => {
    search.value = 'tab=backups';
    const { fake } = stubFetch(answer(['owner']));
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : String(input);
      if (raw.includes('/auth/me')) await gate;
      return fake(input, init);
    });
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByRole('status', { name: /Loading/i })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/You don.t have access/)).toBeNull();
    release();
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Backups' }).getAttribute('aria-selected')).toBe('true'),
    );
    expect(screen.queryByText(/You don.t have access/)).toBeNull();
  }, 20_000);

  it('gives a pm ten tabs: Backups is the owner’s alone (docs/16 D61)', async () => {
    stubFetch(answer(['pm']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(10));
    expect(screen.queryByRole('tab', { name: 'Backups' })).toBeNull();
  }, 20_000);

  it('keeps the two-step roles editable', async () => {
    stubFetch(answer(['owner']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('Roles that must use two-step sign-in')).toBeTruthy();
  });

  it('offers Reopen on a closed project', async () => {
    stubFetch(answer(['owner'], [], { ...project, status: 'closed', closedAt: '2026-11-02T00:00:00Z' }));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByRole('button', { name: 'Reopen project' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close project' })).toBeNull();
  });

  it('gives any other member five tabs (Appearance among them), and a 403 on the rest', async () => {
    search.value = 'tab=audit';
    stubFetch(answer(['frontend']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    await waitFor(() => expect(screen.getAllByRole('tab')).toHaveLength(5));
    expect(screen.getByRole('button', { name: 'Go to my settings' })).toBeTruthy();
  });

  it('says what notifications need, and offers no switch for them', async () => {
    search.value = 'tab=notifications';
    stubFetch(answer(['frontend']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findAllByText('Not connected')).toHaveLength(3);
    expect(screen.getByText(/VAPID/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('shows GitHub as not connected and a stored error as failing, with no fix button or strip', async () => {
    search.value = 'tab=sources';
    stubFetch(
      answer(
        ['owner'],
        [
          source({ id: 's2', kind: 'github_repo', name: 'backend', config: { owner: 'o', repo: 'r' } }),
          source({
            id: 's3',
            name: 'broken',
            lastRunAt: '2026-11-05T00:00:00Z',
            lastError: 'Folder is gone',
          }),
        ],
      ),
    );
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('Folder is gone')).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Last 24 hours/ })).toBeNull();
    // A source waiting on GitHub cannot run, so its row offers nothing to press.
    expect(screen.queryByRole('button', { name: /Run now/ })).toBeNull();
  });

  it('shows a new token once, with the exact commands for this project', async () => {
    search.value = 'tab=tokens';
    stubFetch(answer(['frontend']));
    renderWithApp(
      <Tooltip.Provider>
        <SettingsPage />
      </Tooltip.Provider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /Create token/ }));
    await userEvent.type(screen.getByRole('textbox'), 'Laptop');
    const buttons = screen.getAllByRole('button', { name: /Create token/ });
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement);
    expect(await screen.findByText('hub_abcd1234_secret')).toBeTruthy();
    expect(
      screen.getByText(/claude mcp add --transport http --scope user hub .*\/mcp --header/),
    ).toBeTruthy();
    expect(screen.getByText('hub link demo')).toBeTruthy();
  });
});
