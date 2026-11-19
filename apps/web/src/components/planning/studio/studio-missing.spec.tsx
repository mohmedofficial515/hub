/**
 * @file A studio whose address names a chat that is not there: it says so, with the way to a new session, and stops asking the API.
 */
import { fireEvent, screen } from '@testing-library/react';
import { Tooltip } from 'radix-ui';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as Store from '@/components/workbench/store';
import { renderWithApp, stubFetch } from '@/test/render';

let search = '';
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => '/en/demo/planning',
}));

/** The panel's store, as far as a studio reads it: opening a chat the API does not have ends with no chat open, as the real store does. */
let state = { activeId: null as string | null, chat: undefined, chats: [] as { id: string }[] };
const listeners = new Set<() => void>();
const set = (next: Partial<typeof state>) => {
  state = { ...state, ...next };
  for (const fn of listeners) fn();
};
const openChat = vi.fn((id: string | null) => {
  set({ activeId: id });
  queueMicrotask(() => set({ activeId: null }));
});
vi.mock('@/components/workbench/store', async (original) => ({
  ...(await original<typeof Store>()),
  useMaybeWb: () =>
    useSyncExternalStore(
      (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      () => state,
    ),
  openChat: (id: string | null) => openChat(id),
}));

const { IdeaStudio } = await import('./idea-studio');
const { PlanStudio } = await import('./plan-studio');

beforeEach(() => {
  state = { activeId: null, chat: undefined, chats: [] };
  openChat.mockClear();
  vi.unstubAllGlobals();
  stubFetch(() => undefined);
});

describe.each([
  ['idea', IdeaStudio],
  ['plan', PlanStudio],
] as const)('the %s studio on a chat that is gone', (studio, Studio) => {
  it('says the session was not found, offers a new one, and asks at most twice', async () => {
    search = `studio=${studio}&chat=nope`;
    renderWithApp(
      <Tooltip.Provider>
        <Studio />
      </Tooltip.Provider>,
    );
    expect(await screen.findByText('This session was not found')).toBeTruthy();
    expect(openChat.mock.calls.length).toBeLessThanOrEqual(2);
    fireEvent.click(screen.getByRole('button', { name: 'Start a new session' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(openChat.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
