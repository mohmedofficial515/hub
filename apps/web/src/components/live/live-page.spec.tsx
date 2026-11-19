/**
 * @file Live in its states: the chat list loading, failing and empty, and a `?chat=` that no longer exists. "No chats yet" is said only when it is true.
 */
import { screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { plural } from '@/lib/format';
import { renderWithApp, stubFetch } from '@/test/render';

import arLive from '../../../messages/ar/live.json';
import chat from '../../../messages/en/chat.json';
import kit from '../../../messages/en/kit.json';
import live from '../../../messages/en/live.json';
import shell from '../../../messages/en/shell.json';
import { LivePage, paneOf } from './live-page';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/goteav/live',
}));

const mount = () =>
  renderWithApp(
    <NextIntlClientProvider locale="en" timeZone="Europe/Istanbul" messages={{ kit, shell, live, chat }}>
      <Tooltip.Provider>
        <div id="hub-root">
          <LivePage />
        </div>
      </Tooltip.Provider>
    </NextIntlClientProvider>,
  );

afterEach(() => {
  search = '';
  vi.unstubAllGlobals();
});

const failure = {
  status: 500,
  body: { error: { code: 'hub.common.internal', message: 'no', requestId: 'r1' } },
};

describe('Live', () => {
  it('waits for the chat list before saying there are none', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    mount();
    expect(screen.getByRole('status', { name: live.title })).toBeInTheDocument();
    expect(screen.queryByText(live.noChatsTitle)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: live.title })).toBeInTheDocument();
  });

  it('says what failed when the list cannot load', async () => {
    stubFetch((url) => (url.pathname.endsWith('/chats') ? failure : undefined));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('hub.common.internal');
    expect(screen.queryByText(live.noChatsTitle)).toBeNull();
  });

  it('says a chat from the address is gone, with a way back', async () => {
    search = 'chat=x';
    stubFetch((url) => (url.pathname.endsWith('/chats') ? { body: { data: [] } } : undefined));
    mount();
    expect(await screen.findByText(live.gone.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: live.gone.action })).toBeInTheDocument();
  });

  it('is honest when there are no chats', async () => {
    stubFetch((url) => (url.pathname.endsWith('/chats') ? { body: { data: [] } } : undefined));
    mount();
    expect(await screen.findByText(live.noChatsTitle)).toBeInTheDocument();
    expect(screen.getByText(live.noChats)).toBeInTheDocument();
  });
});

describe('paneOf', () => {
  it('keeps its own tab, and falls back to Changes for anything else', () => {
    expect(paneOf('preview')).toBe('preview');
    expect(paneOf('comments')).toBe('changes');
    expect(paneOf(null)).toBe('changes');
  });
});

describe('Live counts', () => {
  it('says one file and two edits as Arabic does', () => {
    expect(plural(1, 'ar', arLive.filesCount)).toBe('ملف واحد');
    expect(plural(2, 'ar', arLive.edits)).toBe('تعديلان');
    expect(plural(11, 'ar', arLive.filesCount)).toBe('11 ملفًا');
  });
});
