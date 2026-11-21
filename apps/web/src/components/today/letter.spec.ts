/**
 * @file The agent's letter: the small Markdown it writes, and card keys in any project's prefix.
 */
import { describe, expect, it } from 'vitest';

import { parseBlocks, parseLetter, splitKeys } from './letter';

describe('parseBlocks', () => {
  it('reads headings, lists and paragraphs, without their markers', () => {
    expect(parseBlocks('## عنوان\n- أ\n- ب\n\nفقرة')).toEqual([
      { kind: 'heading', text: 'عنوان' },
      { kind: 'bullets', items: ['أ', 'ب'] },
      { kind: 'paragraph', text: 'فقرة' },
    ]);
  });

  it('reads a numbered list, and keeps lines of one paragraph together', () => {
    expect(parseBlocks('1. one\n2. two\nline a\nline b')).toEqual([
      { kind: 'numbers', items: ['one', 'two'] },
      { kind: 'paragraph', text: 'line a\nline b' },
    ]);
  });
});

describe('parseLetter', () => {
  it('turns a web link into a link, and leaves a script link as its words', () => {
    expect(parseLetter('see [the PR](https://github.com/x/y/pull/1)')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'link', text: 'the PR', href: 'https://github.com/x/y/pull/1' },
    ]);
    expect(parseLetter('[x](javascript:alert)').some((s) => s.kind === 'link')).toBe(false);
  });

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
