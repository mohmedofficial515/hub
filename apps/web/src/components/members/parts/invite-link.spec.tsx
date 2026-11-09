/**
 * @file The invite link panel (docs/16 D68, D69): copy, share, WhatsApp, mail, where the email went, and the tailnet step, in ar and en.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { InviteLink } from './invite-link';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/members',
}));

const ON_TAILNET = 'https://mohmed--ahmed.tail0e5baa.ts.net/ar/invite/abc_-DEF';
const me = {
  id: 'u1',
  email: 'owner@hub.test',
  displayName: 'Mohmed',
  avatarColor: 'teal',
  totpEnabled: false,
  workspaces: [{ slug: 'demo', name: 'Goteav', keyPrefix: 'GTV', roles: ['owner', 'pm'] }],
};
const publishing = (publicUrl: string, dnsName: string | null) => ({
  publicUrl,
  apiPublicUrl: publicUrl,
  secureCookies: publicUrl.startsWith('https://'),
  bindHost: '127.0.0.1',
  tailscale: {
    installed: true,
    running: true,
    dnsName,
    servesWeb: true,
    servesApi: true,
    matchesPublicUrl: true,
  },
});

function answer(
  publicUrl = 'https://mohmed--ahmed.tail0e5baa.ts.net',
  dnsName: string | null = 'mohmed--ahmed.tail0e5baa.ts.net',
) {
  return stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/me/devices/publishing')) {
      return { body: { data: publishing(publicUrl, dnsName) } };
    }
    return undefined;
  });
}

describe('InviteLink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'share');
  });

  it('shows the link to copy, WhatsApp and mail with the whole message, where the mail went, and the tailnet step', async () => {
    answer();
    renderWithApp(<InviteLink email="friend@example.test" url={ON_TAILNET} mail="local" />);
    expect(screen.getByText(ON_TAILNET)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy the link' })).toBeTruthy();
    expect(
      await screen.findByRole('heading', { name: 'Share this machine with them in Tailscale' }),
    ).toBeTruthy();
    expect(screen.getByText('mohmed--ahmed')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open Tailscale machines/ }).getAttribute('href')).toBe(
      'https://login.tailscale.com/admin/machines',
    );

    // The shell has the member and the project already; here they arrive with the first answer.
    const href = () => screen.getByRole('link', { name: /WhatsApp/ }).getAttribute('href') ?? '';
    await waitFor(() => expect(href()).toContain('Mohmed'));
    const text = decodeURIComponent(href().replace('https://wa.me/?text=', ''));
    expect(text).toContain('Mohmed invited you to Goteav on Hub.');
    expect(text.split('\n')).toContain(ON_TAILNET);
    expect(text).toContain('accept the share of the machine “mohmed--ahmed”');
    const mail = new URL(screen.getByRole('link', { name: /Email/ }).getAttribute('href') ?? '');
    expect(mail.pathname).toBe('friend@example.test');
    expect(mail.searchParams.get('subject')).toBe('Invitation to Goteav on Hub');
    expect(mail.searchParams.get('body')).toBe(text);

    expect(screen.getByText(/Hub only has the local test inbox \(Mailpit\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Set up real email' }).getAttribute('href')).toBe(
      '/en/demo/settings?tab=system',
    );
    // jsdom has no share sheet, so there is no Share button.
    expect(screen.queryByRole('button', { name: 'Share…' })).toBeNull();
  });

  it('uses the browser’s share sheet where there is one', async () => {
    answer();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    renderWithApp(<InviteLink email="friend@example.test" url={ON_TAILNET} mail="real" />);
    await screen.findByRole('heading', { name: 'Share this machine with them in Tailscale' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Share…' }));
    expect(share).toHaveBeenCalledWith({
      title: 'Invitation to Goteav on Hub',
      text: expect.stringContaining(ON_TAILNET) as string,
    });
    expect(screen.getByText(/An email with this link went to/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Set up real email' })).toBeNull();
  });

  it('off a tailnet there is no Tailscale step, and in Arabic the words are Arabic', async () => {
    answer('http://localhost:7300', null);
    renderWithApp(
      <InviteLink email="friend@example.test" url="http://localhost:7300/ar/invite/abc" mail="off" />,
      { locale: 'ar' },
    );
    await waitFor(() => expect(screen.getByText(/لا خادم بريد لدى Hub/)).toBeTruthy());
    expect(screen.getByRole('link', { name: /واتساب/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'شارك هذا الجهاز معه في Tailscale' })).toBeNull();
  });
});
