/**
 * @file Shortcuts survive an Arabic layout (review M16).
 */
import { describe, expect, it } from 'vitest';

import { matchKey } from './keys';

const key = (k: string, code: string, shiftKey = false) => ({ key: k, code, shiftKey });

describe('matchKey', () => {
  it('matches a letter by its physical key on an Arabic layout', () => {
    expect(matchKey(key('ت', 'KeyJ'), 'j')).toBe(true);
    expect(matchKey(key('ن', 'KeyK'), 'k')).toBe(true);
  });

  it('tells Shift apart', () => {
    expect(matchKey(key('E', 'KeyE', true), 'E')).toBe(true);
    expect(matchKey(key('e', 'KeyE'), 'E')).toBe(false);
    expect(matchKey(key('E', 'KeyE', true), 'e')).toBe(false);
  });

  it('accepts the Arabic question mark and the Slash key', () => {
    expect(matchKey(key('؟', 'Slash', true), '?')).toBe(true);
    expect(matchKey(key('ظ', 'Slash'), '/')).toBe(true);
  });

  it('compares named keys by name', () => {
    expect(matchKey(key('Enter', 'Enter'), 'Enter')).toBe(true);
  });
});
