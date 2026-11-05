/**
 * @file The live connection: what it reports, what it asks for on reconnect, and that a message reaches the caches.
 */
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { qk } from '@/features/cards/keys';
import { renderWithApp } from '@/test/render';

import { LiveProvider, useLiveStatus } from './live-provider';

function Status() {
  return <p data-testid="status">{useLiveStatus()}</p>;
}

function streamOf(frames: string[], { end = false }: { end?: boolean } = {}) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
      if (end) controller.close();
    },
  });
}

describe('LiveProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  const mount = (client = new QueryClient()) =>
    renderWithApp(
      <LiveProvider ws="goteav">
        <Status />
      </LiveProvider>,
      { client },
    );

  it('says live only once the stream is open, and puts messages in the caches', async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve(
        new Response(streamOf(['id: 1-0\nevent: counters\ndata: {"inboxUnread":7}\n\n']), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchStub);
    const client = new QueryClient();
    const { unmount } = mount(client);
    expect(screen.getByTestId('status')).toHaveTextContent('connecting');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('live'));
    await waitFor(() => expect(client.getQueryData(qk.counters('goteav'))).toEqual({ inboxUnread: 7 }));
    expect(fetchStub.mock.calls[0]?.[0 as never]).toBe('/api/v1/workspaces/goteav/events/stream');
    unmount();
  });

  it('says unavailable when the server refuses the stream, not live', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
    const { unmount } = mount();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unavailable'));
    unmount();
  });

  it('resumes with Last-Event-ID after the stream ends', async () => {
    const seen: (string | undefined)[] = [];
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: { headers: Record<string, string> }) => {
        seen.push(init.headers['Last-Event-ID']);
        call += 1;
        return Promise.resolve(
          new Response(
            call === 1 ? streamOf(['id: 9-0\nevent: x\ndata: {}\n\n'], { end: true }) : streamOf([]),
            {
              status: 200,
            },
          ),
        );
      }),
    );
    const { unmount } = mount();
    await waitFor(() => expect(seen.length).toBeGreaterThan(1), { timeout: 4000 });
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toBe('9-0');
    unmount();
  });
});
