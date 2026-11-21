/**
 * @file The card deep link redirects to the sheet over Today, and an unknown key is not found.
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

const { default: CardLinkPage } = await import('./page');

const call = (key: string) => CardLinkPage({ params: Promise.resolve({ locale: 'ar', ws: 'goteav', key }) });

describe('/[ws]/cards/[key]', () => {
  it('redirects to the card over Today', async () => {
    await expect(call('GTV-1')).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/ar/goteav/today?card=GTV-1',
    });
  });

  it('is not found for a key that is not one', async () => {
    await expect(call('nope')).rejects.toMatchObject({ message: 'NEXT_NOT_FOUND' });
  });
});
