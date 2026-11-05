/**
 * @file The lab's rules: file names, the closest picture, the compare pair and the address of a version.
 */
import { describe, expect, it } from 'vitest';

import { compareDefaults, labHref, parseShot, pickShot, shotsFrom, togglePicked } from './lab';

const shot = (name: string) => parseShot(name, `/x/${name}`);

describe('parseShot', () => {
  it('reads width, direction and theme, in both spellings of the language', () => {
    expect(shot('1440-rtl-dark.png')).toMatchObject({ width: 1440, dir: 'rtl', theme: 'dark' });
    expect(shot('390-en-light.png')).toMatchObject({ width: 390, dir: 'ltr', theme: 'light' });
  });
  it('leaves a named state out of the matrix', () => {
    expect(shot('sheet-decide-form-ar-dark.png').width).toBeUndefined();
  });
});

describe('pickShot', () => {
  const shots = [
    '1440-ltr-dark.png',
    '1440-rtl-light.png',
    '390-rtl-dark.png',
    '768-ltr-light.png',
    'x.png',
  ].map(shot);
  it('takes the exact file', () => {
    expect(pickShot(shots, { width: 390, dir: 'rtl', theme: 'dark' })?.name).toBe('390-rtl-dark.png');
  });
  it('prefers the nearest width, then direction over theme', () => {
    expect(pickShot(shots, { width: 1440, dir: 'rtl', theme: 'dark' })?.name).toBe('1440-rtl-light.png');
  });
  it('finds nothing when no picture is in the matrix', () => {
    expect(pickShot([shot('x.png')], { width: 390, dir: 'rtl', theme: 'dark' })).toBeUndefined();
  });
});

describe('shotsFrom', () => {
  it('keeps screenshots only, widest first', () => {
    const list = shotsFrom([
      { kind: 'review', name: 'review.md', url: '/r' },
      { kind: 'screenshot', name: '390-rtl-dark.png', url: '/a' },
      { kind: 'screenshot', name: '1440-rtl-dark.png', url: '/b' },
    ]);
    expect(list.map((s) => s.url)).toEqual(['/b', '/a']);
  });
});

describe('compareDefaults', () => {
  const v = (key: string, version: string, base?: string) => ({ key, redesign: { version, base } });
  const [one, two, three] = [v('A', 'v1'), v('B', 'v2', 'v1'), v('C', 'v3', 'v9')];
  const page = [one, two, three];
  it('is the base against this', () => {
    expect(compareDefaults(two, page)).toEqual(['A', 'B']);
  });
  it('falls back to the version before, then after', () => {
    expect(compareDefaults(three, page)).toEqual(['B', 'C']);
    expect(compareDefaults(one, page)).toEqual(['B', 'A']);
  });
});

describe('togglePicked', () => {
  it('holds two at most, and only from one page', () => {
    expect(togglePicked(['A', 'B'], 'C', ['A', 'B', 'C'])).toEqual(['B', 'C']);
    expect(togglePicked(['A'], 'X', ['X', 'Y'])).toEqual(['X']);
    expect(togglePicked(['A', 'B'], 'A', ['A', 'B'])).toEqual(['B']);
  });
});

describe('labHref', () => {
  it('uses a full address as it came, and otherwise the hash route', () => {
    const base = { app: 'web', page: 'wallet', version: 'v2' } as const;
    expect(labHref({ ...base, labUrl: 'http://lab/x' })).toBe('http://lab/x');
    expect(labHref({ ...base, labUrl: '/lab/web/wallet/v2' })).toMatch(/\/#\/web\/wallet\/v2$/);
  });
});
