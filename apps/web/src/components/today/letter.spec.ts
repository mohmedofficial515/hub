/**
 * @file The agent's letter: the small Markdown it writes, and card keys in any project's prefix.
 */
import { describe, expect, it } from 'vitest';

import { parseLetter, splitKeys } from './letter';

describe('parseLetter', () => {
  it('reads bold and code, and leaves the rest as text', () => {
    expect(parseLetter('a **b** `c` d')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' d' },
    ]);
  });
});

describe('splitKeys', () => {
  it('finds keys in odd places', () => {
    expect(splitKeys('see GTV-12 and HUB-3.')).toEqual(['see ', 'GTV-12', ' and ', 'HUB-3', '.']);
  });

  it('does not take a lowercase or partial word for a key', () => {
    expect(splitKeys('utf-8 and X-1')).toEqual(['utf-8 and X-1']);
  });
});
