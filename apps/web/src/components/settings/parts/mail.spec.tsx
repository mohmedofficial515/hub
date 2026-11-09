/**
 * @file Settings › System › Mail (docs/16 D68): the state in words, and the test email's result, translated, in ar and en.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp, stubFetch } from '@/test/render';

import { MailSection } from './mail';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/settings',
}));

const me = {
  id: 'u1',
  email: 'owner@gmail.com',
  displayName: 'Owner',
  avatarColor: 'teal',
  totpEnabled: false,
  workspaces: [{ slug: 'demo', name: 'Demo', keyPrefix: 'DMO', roles: ['owner'] }],
};
const gmail = {
  mode: 'real',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  authenticated: true,
  from: 'Hub <owner@gmail.com>',
};
const mailpit = {
  mode: 'local',
  host: 'localhost',
  port: 7342,
  secure: false,
  authenticated: false,
  from: 'Hub <hub@localhost>',
};

function answer(status: object, test?: object) {
  return stubFetch((url, init, request) => {
    const method = request?.method ?? init?.method ?? 'GET';
    if (url.pathname.endsWith('/auth/me')) return { body: { data: me } };
    if (url.pathname.endsWith('/workspaces/demo/mail') && method === 'GET') return { body: { data: status } };
    if (url.pathname.endsWith('/workspaces/demo/mail/test') && test) return { body: { data: test } };
    return undefined;
  });
}

describe('MailSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('says Mailpit is a test inbox nobody else reads, and how to get real email', async () => {
    answer(mailpit);
    renderWithApp(<MailSection />);
    expect(await screen.findByText('Test inbox only')).toBeTruthy();
    expect(screen.getByText(/Nobody else receives it/)).toBeTruthy();
    expect(screen.getByText(/create an app password/)).toBeTruthy();
    expect(screen.getAllByText('.env', { selector: 'bdi' }).length).toBeGreaterThan(0);
  });

  it('names the real server and sends a test to the owner’s own address', async () => {
    const { calls } = answer(gmail, {
      sent: true,
      to: 'owner@gmail.com',
      mode: 'real',
      failure: null,
      responseCode: null,
    });
    renderWithApp(<MailSection />);
    expect(await screen.findByText('Real email')).toBeTruthy();
    expect(screen.getByText('smtp.gmail.com')).toBeTruthy();
    expect(screen.queryByText(/create an app password/)).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send test email' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent to owner@gmail.com. Check that inbox, and its spam folder.',
    );
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.path)).toEqual([
      '/api/v1/workspaces/demo/mail/test',
    ]);
    // Nothing on the page ever holds a password.
    expect(document.body.textContent).not.toMatch(/SMTP_PASS/);
  });

  it('explains a refused app password in Arabic, with the setting to check', async () => {
    answer(gmail, { sent: false, to: 'owner@gmail.com', mode: 'real', failure: 'auth', responseCode: 535 });
    renderWithApp(<MailSection />, { locale: 'ar' });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'أرسل رسالة تجربة' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('رفض smtp.gmail.com تسجيل الدخول (الرمز 535)');
    expect(alert).toHaveTextContent('SMTP_USER');
    expect(alert.dataset['failure']).toBe('auth');
  });

  it('with no mail server the test is off', async () => {
    answer({ mode: 'off', host: null, port: null, secure: false, authenticated: false, from: null });
    renderWithApp(<MailSection />);
    expect(await screen.findByText('Not set up')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send test email' })).toBeDisabled();
  });
});
