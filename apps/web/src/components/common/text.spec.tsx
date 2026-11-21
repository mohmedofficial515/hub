/**
 * @file Bidi keeps an English aside in an Arabic title as one left-to-right run, brackets included.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Bidi } from './text';

describe('Bidi', () => {
  it('isolates a bracketed English aside in an Arabic title, brackets and all', () => {
    const { container } = render(
      <Bidi>{'نقل مسار الاسترداد إلى المحفظة أولًا (Refund → Wallet first)'}</Bidi>,
    );
    const outer = container.firstElementChild!;
    expect(outer.getAttribute('dir')).toBe('rtl');
    const aside = [...outer.querySelectorAll('bdi[dir="ltr"]')].map((el) => el.textContent);
    expect(aside).toContain('(Refund → Wallet first)');
  });

  it('leaves an English title and an Arabic aside alone', () => {
    const { container } = render(<Bidi>{'Refund flow (المرحلة الأولى)'}</Bidi>);
    expect(container.querySelectorAll('bdi bdi')).toHaveLength(0);
  });

  it('still isolates a card key inside the rest of the line', () => {
    const { container } = render(<Bidi>{'راجع البطاقة GTV-12 قبل موعد الإصدار القادم (the release)'}</Bidi>);
    const inner = [...container.querySelectorAll('bdi bdi')].map((el) => el.textContent);
    expect(inner).toEqual(['GTV-12', '(the release)']);
  });
});
