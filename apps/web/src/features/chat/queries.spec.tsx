/**
 * @file `useTurnStatus`: the live stream fills it, and it never asks the API.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyChatLive } from './live';
import { useTurnStatus } from './queries';

vi.mock('@/components/shell/router', () => ({ useRoute: () => ({ ws: 'ws' }) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTurnStatus', () => {
  it('follows the stream, and makes no request', async () => {
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTurnStatus('c1'), { wrapper });
    expect(result.current).toBeNull();

    const live = (seq: number, event: Parameters<typeof applyChatLive>[2]['event']) =>
      act(() => applyChatLive(client, 'ws', { chatId: 'c1', messageId: 'm1', seq, event }));
    live(1, { kind: 'turn.status', state: 'retrying', attempt: 1 });
    await waitFor(() => expect(result.current).toMatchObject({ state: 'retrying', attempt: 1 }));

    live(2, { kind: 'text.delta', text: 'hi' });
    await waitFor(() => expect(result.current).toBeNull());
    expect(fetched).not.toHaveBeenCalled();
  });

  it('with no chat it has nothing to say', () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    expect(renderHook(() => useTurnStatus(null), { wrapper }).result.current).toBeNull();
  });
});
