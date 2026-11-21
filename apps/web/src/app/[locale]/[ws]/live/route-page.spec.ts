/**
 * @file The old Live address opens the queue's "Running now" tab, its chat kept; `?profile=me` on Members opens Settings › Account.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${to}` });
  },
  notFound: () => {
    throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  },
}));
vi.mock('@/components/members/members-page', () => ({ MembersPage: () => null }));

const { default: LiveRedirect } = await import('./page');
const { default: MembersRoute } = await import('../members/page');

const live = (search: Record<string, string>) =>
  LiveRedirect({
    params: Promise.resolve({ locale: 'ar', ws: 'goteav' }),
    searchParams: Promise.resolve(search),
  });

describe('/[ws]/live', () => {
  it('opens the chat in the queue’s Running now tab', async () => {
    await expect(live({ chat: 'c1', pane: 'preview' })).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/ar/goteav/queue?chat=c1&pane=preview&show=live',
    });
  });

  it('opens the tab with no chat as well', async () => {
    await expect(live({})).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/ar/goteav/queue?show=live',
    });
  });
});

describe('/[ws]/members', () => {
  it('sends ?profile=me to Settings › Account', async () => {
    await expect(
      MembersRoute({
        params: Promise.resolve({ locale: 'en', ws: 'goteav' }),
        searchParams: Promise.resolve({ profile: 'me' }),
      }),
    ).rejects.toMatchObject({ digest: 'NEXT_REDIRECT;replace;/en/goteav/settings?tab=account' });
  });

  it('shows the page otherwise', async () => {
    await expect(
      MembersRoute({
        params: Promise.resolve({ locale: 'en', ws: 'goteav' }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();
  });
});
