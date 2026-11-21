/**
 * @file An inbox title is written again from its template, with a count of hours in words and the right Arabic plural.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { InboxGroup } from '@/features/inbox/group';

import ar from '../../../messages/ar/inbox.json';
import en from '../../../messages/en/inbox.json';
import { titleOf } from './row';

const reminder = (hours: unknown) =>
  ({
    id: 'n1',
    kind: 'deadline_reminder',
    title: 'stored title',
    card: null,
    data: { i18nKey: 'deadline_reminder', params: { hours, title: 'Pay the invoice' } },
  }) as unknown as InboxGroup['lead'];

describe('titleOf', () => {
  it('says two hours as a reader does, in Arabic', () => {
    const { container } = render(<p>{titleOf(reminder(2), ar.row.titles, 'ar')}</p>);
    expect(container.textContent).toContain('ساعتين');
    expect(container.textContent).not.toContain('2 ساعة');
    expect(container.textContent).toContain('Pay the invoice');
  });

  it('writes hours as a duration in English', () => {
    const { container } = render(<p>{titleOf(reminder(24), en.row.titles, 'en')}</p>);
    expect(container.textContent).toBe('Due within 24 h: Pay the invoice');
  });

  it('falls back to the stored title for a template it cannot fill', () => {
    const item = { ...reminder(2), data: { i18nKey: 'nope', params: {} } } as unknown as InboxGroup['lead'];
    const { container } = render(<p>{titleOf(item, en.row.titles, 'en')}</p>);
    expect(container.textContent).toBe('stored title');
  });
});
