/**
 * @file A clamped excerpt reads as prose, and an imported body's links cannot run anything (review B2).
 */
import { describe, expect, it } from 'vitest';

import { excerptText, inlineMarkdownText, isSafeHref, markdownExcerpt } from './markdown-text';

describe('markdownExcerpt', () => {
  it('reads the first paragraph under the first heading, with no markers', () => {
    expect(markdownExcerpt('## الملخص\n\nنقارن **ثلاثة** موردين عبر `API`.\n\n## التفاصيل\n\nلا.')).toBe(
      'نقارن ثلاثة موردين عبر API.',
    );
  });

  it('joins a wrapped paragraph on one line', () => {
    expect(markdownExcerpt('First line\nsecond line.')).toBe('First line second line.');
  });

  it('skips rules, tables and code', () => {
    expect(markdownExcerpt('---\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```\n\nThe text.')).toBe(
      'The text.',
    );
  });

  it('keeps a link and an image as their words', () => {
    expect(markdownExcerpt('See [the doc](https://x.test) and ![a shot](a.png).')).toBe(
      'See the doc and a shot.',
    );
  });

  it('drops raw HTML, and decodes what the lexer escaped', () => {
    expect(markdownExcerpt('Before <b onclick="x()">bold</b> after & more')).toBe('Before bold after & more');
    expect(markdownExcerpt('<script>alert(1)</script>\n\nReal text.')).toBe('Real text.');
    expect(markdownExcerpt('a `<b>` tag')).toBe('a <b> tag');
  });

  it('falls back to a list, then a heading, then nothing', () => {
    expect(markdownExcerpt('## Options\n\n- one\n- **two**\n')).toBe('one · two');
    expect(markdownExcerpt('# Only a title\n')).toBe('Only a title');
    expect(markdownExcerpt('---\n')).toBe('');
    expect(markdownExcerpt('')).toBe('');
  });
});

describe('isSafeHref', () => {
  it.each(['https://x.test', 'http://x.test', 'mailto:a@x.test', '/ar/goteav/docs', '#top', 'docs/a.md'])(
    'lets %s through',
    (href) => {
      expect(isSafeHref(href)).toBe(true);
    },
  );

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\nscript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
    'file:///c:/x',
  ])('stops %j', (href) => {
    expect(isSafeHref(href)).toBe(false);
  });
});

describe('inlineMarkdownText and excerptText', () => {
  it('reads a heading as its words', () => {
    expect(inlineMarkdownText('3.1 `save_doc` and [the guide](./g.md) **now**')).toBe(
      '3.1 save_doc and the guide now',
    );
  });
  it('takes list, task, heading and quote markers off each line', () => {
    expect(excerptText('## Title\n- [ ] one\n> quoted\n1. two')).toBe('Title one quoted two');
  });
  it('keeps an underscore inside a word', () => {
    expect(excerptText('_em_ and save_doc')).toBe('em and save_doc');
  });
});
