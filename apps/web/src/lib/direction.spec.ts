/**
 * @file Direction by majority, on the shapes real bodies have (review R2, R10).
 */
import { describe, expect, it } from 'vitest';

import { blockDirection, LATIN_NUMBER_RUN, textDirection } from './direction';

describe('textDirection', () => {
  it('an Arabic body that opens with a product name stays right to left', () => {
    expect(textDirection('Sentry لا يرى أخطاء 5xx ولا يبلغ عنها عندما يتجاوز الملف 100 MB')).toBe('rtl');
  });

  it('an English body stays left to right, even with an Arabic word in it', () => {
    expect(textDirection('The refund fails when the name is «محمد» and the amount is 100 MB.')).toBe('ltr');
  });

  it('code and addresses do not count', () => {
    expect(textDirection('نفّذ الأمر `pnpm --filter @hub/api test:e2e --runInBand` الآن')).toBe('rtl');
    expect(textDirection('راجع https://example.test/a/very/long/english/path/here هنا')).toBe('rtl');
    expect(textDirection('[الدليل](https://example.test/english/words/only)')).toBe('rtl');
  });

  it('no letters, or a tie, leaves it open', () => {
    expect(textDirection('100 / 200')).toBeUndefined();
    expect(textDirection('')).toBeUndefined();
    expect(textDirection('abc ابج')).toBeUndefined();
  });
});

describe('LATIN_NUMBER_RUN', () => {
  const runs = (text: string) => text.match(LATIN_NUMBER_RUN);

  it('finds a number with its unit or suffix', () => {
    expect(runs('أخطاء 5xx في ملف 100 MB بنسبة 2% وعرض 16px')).toEqual(['5xx', '100 MB', '2%', '16px']);
  });

  it('leaves a bare number and a card key alone', () => {
    expect(runs('بعد 14 يومًا')).toBeNull();
    expect(runs('GTV-35 وEAR-2')).toBeNull();
  });
});

describe('blockDirection', () => {
  it('a short mixed line stays with the document', () => {
    expect(blockDirection('Sentry يبلّغ عن 5xx', 'rtl')).toBe('rtl');
    expect(blockDirection('أضف Stripe webhook retry', 'rtl')).toBe('rtl');
    expect(blockDirection('The name «محمد» is on the ticket', 'ltr')).toBe('ltr');
  });

  it('a block with next to nothing of the document’s script turns', () => {
    expect(blockDirection('It ends with a full stop.', 'rtl')).toBe('ltr');
    expect(blockDirection('فقرة عربية خالصة هنا.', 'ltr')).toBe('rtl');
  });

  it('no letters stays with the document, and no document direction falls to the majority', () => {
    expect(blockDirection('100 / 200', 'rtl')).toBe('rtl');
    expect(blockDirection('It ends here.', undefined)).toBe('ltr');
  });
});
