/**
 * @file The Deleted view: its way back leaves it, and a type filter with nothing of its own says so and offers every type.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { summary } from '@/components/cards/test-fixture';
import { renderWithApp, stubFetch } from '@/test/render';

import { DeletedView } from './deleted-view';

vi.mock('next/navigation', async () => (await import('@/components/cards/test-nav')).liveNavigation());

const answer = (rows: unknown[]) =>
  stubFetch((url) => {
    if (url.pathname.endsWith('/auth/me'))
      return {
        body: {
          data: {
            id: 'u1',
            displayName: 'Owner',
            workspaces: [{ slug: 'x', name: 'X', keyPrefix: 'DMO', roles: ['owner'] }],
          },
        },
      };
    if (url.pathname.endsWith('/members')) return { body: { data: [], meta: {} } };
    if (url.pathname.endsWith('/cards/deleted'))
      return { body: { data: rows, meta: { pagination: { nextCursor: null } } } };
    return undefined;
  });

const show = (search: string) => {
  window.history.replaceState(null, '', `/ar/x/tasks?${search}`);
  return renderWithApp(
    <Tooltip.Provider>
      <DeletedView />
    </Tooltip.Provider>,
    { locale: 'ar' },
  );
};

afterEach(() => vi.unstubAllGlobals());

describe('DeletedView', () => {
  it('leads back to Tasks without the Deleted view’s params', async () => {
    answer([]);
    show('view=deleted&type=task');
    const back = await screen.findByRole('link', { name: 'العودة إلى المهام' });
    const href = back.getAttribute('href') ?? '';
    expect(href).not.toContain('view=');
    expect(href).not.toContain('type=');
  });

  it('says nothing of this type was deleted, and shows every type on request', async () => {
    answer([
      summary('DMO-5', { type: 'decision', title: 'Old decision', archivedAt: '2026-11-01T10:00:00.000Z' }),
    ]);
    show('view=deleted&type=task');
    expect(await screen.findByText('لا محذوفات من هذا النوع')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'اعرض كل الأنواع' }));
    await waitFor(() => expect(screen.getByText('Old decision')).toBeTruthy());
  });
});
