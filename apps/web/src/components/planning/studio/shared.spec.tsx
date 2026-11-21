/**
 * @file The studios' shared logic: opening the chat their address names without looping on one that is gone, and the line that holds one request.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PanelChat } from '@/components/workbench/store';

const openChat = vi.fn<(id: string | null) => void>();
const send = vi.fn(async (): Promise<boolean> => true);
vi.mock('@/components/workbench/store', () => ({
  openChat: (id: string | null) => openChat(id),
  send: () => send(),
  activeChatId: () => null,
}));

const { useStudioChat, useStudioSend } = await import('./shared');

type Fake = { activeId: string | null; chat: PanelChat | undefined; chats: { id: string }[] };
const wbOf = (over: Partial<Fake> = {}) =>
  ({ activeId: null, chat: undefined, chats: [], ...over }) as unknown as Parameters<typeof useStudioChat>[0];

beforeEach(() => {
  openChat.mockClear();
  send.mockClear();
});

describe('useStudioChat', () => {
  it('tries a chat the API does not have once, then says it is missing, and stops asking', () => {
    const { result, rerender } = renderHook(({ wb }) => useStudioChat(wb, 'nope'), {
      initialProps: { wb: wbOf() },
    });
    expect(openChat).toHaveBeenCalledTimes(1);
    // The store opens it, the API answers 404, the store lets go.
    rerender({ wb: wbOf({ activeId: 'nope' }) });
    rerender({ wb: wbOf({ activeId: null }) });
    expect(result.current.missing).toBe(true);
    rerender({ wb: wbOf({ activeId: null }) });
    expect(openChat).toHaveBeenCalledTimes(1);
  });

  it('tries a listed chat at most twice, whatever the store does', () => {
    const chats = [{ id: 'nope' }];
    const { result, rerender } = renderHook(({ wb }) => useStudioChat(wb, 'nope'), {
      initialProps: { wb: wbOf({ chats }) },
    });
    for (let i = 0; i < 5; i += 1) {
      rerender({ wb: wbOf({ chats, activeId: 'nope' }) });
      rerender({ wb: wbOf({ chats, activeId: null }) });
    }
    expect(openChat.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.current.missing).toBe(true);
  });

  it('gives the chat once it is open, and brings it back after the owner opens another', () => {
    const chat = { id: 'c1' } as PanelChat;
    const { result, rerender } = renderHook(({ wb }) => useStudioChat(wb, 'c1'), {
      initialProps: { wb: wbOf({ activeId: 'c1', chat }) },
    });
    expect(result.current).toEqual({ chat, missing: false });
    expect(openChat).not.toHaveBeenCalled();
    rerender({ wb: wbOf({ activeId: 'other', chat: { id: 'other' } as PanelChat }) });
    expect(openChat).toHaveBeenCalledWith('c1');
    expect(result.current.missing).toBe(false);
  });
});

describe('useStudioSend', () => {
  it('holds one request while Claude works, and refuses a second rather than replacing it', async () => {
    const { result } = renderHook(() => useStudioSend({ id: 'line-1' } as PanelChat, true));
    let first = false;
    let second = true;
    await act(async () => {
      first = await result.current.onSend('my answers');
    });
    await act(async () => {
      second = await result.current.onSend('apply this');
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.current.queued).toBe('my answers');
    expect(result.current.blocked).toBe(true);
    expect(send).not.toHaveBeenCalled();
    act(() => result.current.cancelQueued());
    expect(result.current.queued).toBeNull();
  });
});
