/**
 * @file Every page has its own `g` key (docs/08 P7), and the keys reach their pages, `n i` and `n p` included.
 */
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as KitModule from '@/components/kit';

type Kit = typeof KitModule;

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/components/kit', async (original) => ({
  ...(await original<Kit>()),
  navigate,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/goteav/tasks',
}));

const { useGlobalKeys } = await import('./shell');
const { views } = await import('./views');

const press = (key: string) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

describe('views', () => {
  afterEach(() => navigate.mockClear());

  it('gives every page a g key, each one different', () => {
    const keys = views.map((v) => v.goKey);
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('goes to Settings on g then s', () => {
    renderHook(() => useGlobalKeys({ palette: vi.fn(), help: vi.fn(), newCard: vi.fn() }));
    press('g');
    press('s');
    expect(navigate).toHaveBeenCalledWith('settings');
  });

  it('opens the idea and plan studios on n i and n p', () => {
    renderHook(() => useGlobalKeys({ palette: vi.fn(), help: vi.fn(), newCard: vi.fn() }));
    press('n');
    press('i');
    expect(navigate).toHaveBeenLastCalledWith('planning', {
      query: { studio: 'idea', chat: null, plan: null },
    });
    press('n');
    press('p');
    expect(navigate).toHaveBeenLastCalledWith('planning', {
      query: { studio: 'plan', chat: null, plan: null },
    });
  });
});
