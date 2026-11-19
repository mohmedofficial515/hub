import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllDrafts, useDraft, useHasDraft, useLeaveWithDraft } from './drafts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/demo/settings',
}));

describe('settings drafts', () => {
  afterEach(() => clearAllDrafts());

  it('outlives the component that wrote it, until cleared', () => {
    const first = renderHook(() => useDraft<Record<string, string>>('general', {}));
    act(() => first.result.current[1]((current) => ({ ...current, name: 'New name' })));
    first.unmount();
    const again = renderHook(() => ({
      draft: useDraft<Record<string, string>>('general', {}),
      has: useHasDraft('general'),
    }));
    expect(again.result.current.draft[0]).toEqual({ name: 'New name' });
    expect(again.result.current.has).toBe(true);
    act(() => again.result.current.draft[2]());
    expect(again.result.current.draft[0]).toEqual({});
    expect(again.result.current.has).toBe(false);
  });

  it('treats a blank value as no draft', () => {
    const hook = renderHook(() => ({
      draft: useDraft<object | null>('backups', null),
      has: useHasDraft('backups'),
    }));
    act(() => hook.result.current.draft[1]({}));
    expect(hook.result.current.has).toBe(false);
  });

  it('says so when a tab with a draft unmounts, and not otherwise', () => {
    const onLeave = vi.fn();
    const empty = renderHook(() => useLeaveWithDraft('general', onLeave));
    empty.unmount();
    expect(onLeave).not.toHaveBeenCalled();
    const hook = renderHook(() => {
      useLeaveWithDraft('general', onLeave);
      return useDraft<Record<string, string>>('general', {});
    });
    act(() => hook.result.current[1]({ name: 'x' }));
    hook.unmount();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
