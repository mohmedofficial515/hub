import { describe, expect, it } from 'vitest';

import { cardLinkTarget } from './card-link';

describe('cardLinkTarget', () => {
  it('opens the card over Today, with the key in capitals', () => {
    expect(cardLinkTarget('ar', 'goteav', 'GTV-1')).toBe('/ar/goteav/today?card=GTV-1');
    expect(cardLinkTarget('en', 'goteav', 'gtv-12')).toBe('/en/goteav/today?card=GTV-12');
  });

  it('refuses what is not a card key', () => {
    expect(cardLinkTarget('ar', 'goteav', 'nope')).toBeNull();
    expect(cardLinkTarget('ar', 'goteav', 'GTV-')).toBeNull();
    expect(cardLinkTarget('ar', 'goteav', '../x-1')).toBeNull();
  });
});
