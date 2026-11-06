/**
 * @file The gallery's rules: the address, the frame, what a pane shows, and how a device fits.
 */
import { describe, expect, it } from 'vitest';

import {
  choicesOf,
  compareTarget,
  deviceBox,
  frameSrc,
  galleryQuery,
  paneBody,
  readGallery,
  shotName,
} from './gallery';

const fallback = { lang: 'ar', theme: 'dark' } as const;
const page = {
  liveUrl: 'http://localhost:6002/ar/account/wallet',
  renderable: ['v2-flight-path'],
  versions: ['v1-baseline', 'v2-flight-path'],
};

describe('readGallery', () => {
  it('starts from Hub language and theme, at desktop width', () => {
    expect(readGallery(new URLSearchParams(''), fallback)).toEqual({
      app: null,
      page: null,
      a: null,
      b: null,
      width: 1440,
      lang: 'ar',
      theme: 'dark',
      notes: false,
      scenario: 'default',
    });
  });

  it('reads what the address says, and ignores what it cannot use', () => {
    const state = readGallery(
      new URLSearchParams('app=web&page=wallet&a=v2&b=v1&w=390&lang=en&theme=light&notes=1&scenario=empty'),
      fallback,
    );
    expect(state).toMatchObject({
      app: 'web',
      a: 'v2',
      b: 'v1',
      width: 390,
      lang: 'en',
      theme: 'light',
      notes: true,
    });
    expect(readGallery(new URLSearchParams('app=evil&w=7&lang=fr'), fallback)).toMatchObject({
      app: null,
      width: 1440,
      lang: 'ar',
    });
  });

  it('round-trips through the address', () => {
    const state = readGallery(new URLSearchParams('app=hub&page=today&a=v5&w=fill&notes=1'), fallback);
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(galleryQuery(state))) if (value) query.set(name, value);
    expect(readGallery(query, fallback)).toEqual(state);
  });
});

describe('frameSrc', () => {
  const mode = { lang: 'en', theme: 'dark', scenario: 'default' } as const;
  it('is same origin, in the app frame, with the mode in the hash', () => {
    expect(frameSrc('web', 'wallet', 'v2', mode)).toBe('/lab/frame-web.html#/wallet/v2?lang=en&theme=dark');
  });
  it('carries a scenario only when it is not the default', () => {
    expect(frameSrc('hub', 'today', 'v5', { ...mode, scenario: 'empty' })).toMatch(/&scenario=empty$/);
  });
  it('cannot be led out of the frame by a name', () => {
    expect(frameSrc('web', '../x', 'a/b', mode)).toBe('/lab/frame-web.html#/..%2Fx/a%2Fb?lang=en&theme=dark');
  });
});

describe('paneBody', () => {
  it('frames a version with a page, and shows pictures of one without', () => {
    expect(paneBody(page, 'wallet', 'v2-flight-path', 0)).toBe('frame');
    expect(paneBody(page, 'wallet', 'v1-baseline', 3)).toBe('shots');
    expect(paneBody(page, 'wallet', 'v1-baseline', 0)).toBe('nothing');
  });
  it('shows the running page only when the brief names one', () => {
    expect(paneBody(page, 'wallet', 'live', 0)).toBe('live');
    expect(paneBody({ ...page, liveUrl: undefined }, 'wallet', 'live', 0)).toBe('nothing');
  });
  it('always frames the tokens preview, which is no version', () => {
    expect(paneBody(undefined, '_tokens', 'preview', 0)).toBe('frame');
  });
  it('before a scan knows, frames all but the baseline', () => {
    const unknown = { ...page, renderable: null };
    expect(paneBody(unknown, 'wallet', 'v2-flight-path', 0)).toBe('frame');
    expect(paneBody(unknown, 'wallet', 'v1-baseline', 2)).toBe('shots');
  });
  it('a version the page does not list is nothing', () => {
    expect(paneBody(page, 'wallet', 'v9-gone', 0)).toBe('nothing');
  });
});

describe('compare', () => {
  it('offers the running page first', () => {
    expect(choicesOf(page)).toEqual(['live', 'v1-baseline', 'v2-flight-path']);
  });
  it('prefers the baseline, and otherwise the first other', () => {
    expect(compareTarget(['live', 'v1-baseline', 'v2'], 'v2')).toBe('v1-baseline');
    expect(compareTarget(['live', 'v1-baseline', 'v2'], 'v1-baseline')).toBe('live');
    expect(compareTarget(['v2'], 'v2')).toBeNull();
  });
});

describe('deviceBox', () => {
  it('fill takes the stage at its real size', () => {
    expect(deviceBox('fill', { w: 900, h: 700 })).toEqual({ target: 900, height: 700, scale: 1 });
  });
  it('keeps the real width, and scales down to fit', () => {
    const box = deviceBox(1440, { w: 768, h: 648 });
    expect(box.target).toBe(1440);
    expect(box.scale).toBeCloseTo(0.5);
    expect(box.height).toBeCloseTo(1200);
  });
  it('never scales up', () => {
    expect(deviceBox(390, { w: 1440, h: 900 }).scale).toBe(1);
  });
});

describe('shotName', () => {
  it('names the picture of the mode, and fill uses desktop', () => {
    expect(shotName({ width: 390, lang: 'ar', theme: 'dark' })).toBe('390-rtl-dark');
    expect(shotName({ width: 'fill', lang: 'en', theme: 'light' })).toBe('1440-ltr-light');
  });
});
