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

  it('an excerpt carries no raw Markdown, and a highlight survives it', () => {
    expect(safeExcerpt('## Refund **rules** and `code`')).toBe('Refund rules and code');
    expect(safeExcerpt('see [the guide](https://x.test/a) now')).toBe('see the guide now');
    expect(safeExcerpt('\u0001**refund**\u0002 first')).toBe('<mark>refund</mark> first');
    expect(safeExcerpt('**\u0001refund\u0002** first')).toBe('<mark>refund</mark> first');
    expect(safeExcerpt('- one\n- two | three')).toBe('one two three');
  });

  it('leaves what is not Markdown alone', () => {
    expect(safeExcerpt('snake_case and 2*3 stay')).toBe('snake_case and 2*3 stay');
    expect(safeExcerpt('الاسترداد **سريع** جدًا')).toBe('الاسترداد سريع جدًا');
  });

  it('a document cannot inject markup into an excerpt', () => {
    expect(safeExcerpt('<img src=x> \u0001refund\u0002')).toBe('&lt;img src=x&gt; <mark>refund</mark>');
  });
});
