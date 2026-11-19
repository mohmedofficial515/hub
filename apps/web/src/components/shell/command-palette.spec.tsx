/**
 * @file The palette: one server search per pause in typing, no false "no results" while it answers, the studio commands, and the API's connect command.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { CommandPalette } from './command-palette';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/tasks',
}));

const me = (roles: string[], projects = 1) => ({
  id: 'u1',
  displayName: 'Mohamed',
  avatarColor: 'teal',
  workspaces: [
    { slug: 'goteav', name: 'Goteav', keyPrefix: 'GTV', roles },
    { slug: 'hub', name: 'Hub', keyPrefix: 'HUB', roles },
  ].slice(0, projects),
});

const mount = () =>
  renderWithApp(
    <div id="hub-root">
      <CommandPalette open onOpenChange={vi.fn()} onNewCard={vi.fn()} onShortcuts={vi.fn()} />
    </div>,
  );

describe('CommandPalette', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks the server once for a word typed in a row, and says it is searching meanwhile', async () => {
    let answer: (() => void) | undefined;
    const held = new Promise<void>((resolve) => (answer = resolve));
    const { fake, calls } = stubFetch((url) => {
      if (url.pathname.endsWith('/auth/me')) return { body: { data: me(['owner']) } };
      if (url.pathname.endsWith('/search')) {
        return {
          body: {
            data: {
              cards: [{ key: 'GTV-7', type: 'task', status: 'ready', title: 'Refund flow', priority: 'P2' }],
            },
          },
        };
      }
      return undefined;
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const raw = input instanceof Request ? input.url : String(input);
      if (raw.includes('/search')) await held;
      return fake(input, init);
    });
    mount();
    for (const text of ['z', 'zq', 'zqx', 'zqxw', 'zqxwv']) {
      fireEvent.change(screen.getByRole('combobox'), { target: { value: text } });
    }
    expect(await screen.findByText('Searching…')).toBeInTheDocument();
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(screen.queryByText(/No results/)).not.toBeInTheDocument();
    answer?.();
    expect(await screen.findByText('Refund flow')).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/search'))).toHaveLength(1);
  });

  it('offers New idea and New plan, and Switch project only with another project', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/auth/me') ? { body: { data: me(['frontend']) } } : undefined,
    );
    mount();
    expect(await screen.findByRole('option', { name: 'New idea' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'New plan' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Switch project' })).not.toBeInTheDocument();
  });

  it('shows Switch project to a member of two projects', async () => {
    stubFetch((url) =>
      url.pathname.endsWith('/auth/me') ? { body: { data: me(['owner'], 2) } } : undefined,
    );
    mount();
    expect(await screen.findByRole('option', { name: 'Switch project' })).toBeInTheDocument();
  });

  it('copies the connect command the API gives, the same as Settings › Devices', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    stubFetch((url) => {
      if (url.pathname.endsWith('/auth/me')) return { body: { data: me(['owner']) } };
      if (url.pathname.endsWith('/me/devices/connect-command')) {
        return {
          body: {
            data: {
              apiUrl: 'https://hub.example.ts.net',
              connect: 'node -e "connect"',
              uninstall: 'node -e "x"',
            },
          },
        };
      }
      return undefined;
    });
    mount();
    await screen.findByRole('option', { name: 'Copy the command to connect a device' });
    // The answer has to land first, or the command opens Settings › Devices instead.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    fireEvent.click(screen.getByRole('option', { name: 'Copy the command to connect a device' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('node -e "connect"'));
  });
});
