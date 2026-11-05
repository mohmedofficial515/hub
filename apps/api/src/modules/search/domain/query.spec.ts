/**
 * @file The widened query and the excerpt's escaping.
 */
import { safeExcerpt, widenedQuery, wordsOf } from './query';

describe('search query', () => {
  it('takes words, and drops punctuation that would be an operator', () => {
    expect(wordsOf('refund & !policy | (x) a')).toEqual(['refund', 'policy']);
    expect(widenedQuery('!!! ?')).toBeNull();
  });

  it('joins with OR and lower-cases latin', () => {
    expect(widenedQuery('Refund Policy')).toBe("'refund' | 'policy'");
  });

  it('adds the Arabic forms of a word', () => {
    const query = widenedQuery('الاسترداد') ?? '';
    expect(query).toContain("'استرداد'");
    expect(query).toContain("'الاسترداد'");
    const taa = widenedQuery('سياسة') ?? '';
    expect(taa).toContain("'سياسه'");
    expect(widenedQuery('احمد') ?? '').toContain("'أحمد'");
  });

  it('a document cannot inject markup into an excerpt', () => {
    expect(safeExcerpt('<img src=x> \u0001refund\u0002')).toBe('&lt;img src=x&gt; <mark>refund</mark>');
  });
});
