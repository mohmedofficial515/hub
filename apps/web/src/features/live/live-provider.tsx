'use client';

/**
 * @file live-provider.tsx
 * @description One SSE connection for the signed-in shell (docs/15 §7). It keeps the query caches current, resumes with
 * `Last-Event-ID`, and reports a state the header's indicator can show without lying: `live` only while bytes can arrive.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { API_PREFIX, refreshSession } from '@/lib/api/client';
import { backoffDelay, readStream, SseHttpError } from '@/lib/sse';

import { applyLiveMessage, refetchEverything } from './apply-event';

/**
 * - `connecting`: the first attempt, or a retry that has been failing for under 5 s (docs/09 §3).
 * - `live`: connected, and heard from within the watchdog's window.
 * - `reconnecting`: down for 5 s or more, still trying.
 * - `unavailable`: the server answered that this stream does not exist. Pages still work and only refresh on their own.
 */
export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'unavailable';

const LiveContext = createContext<LiveStatus>('connecting');
export const useLiveStatus = () => useContext(LiveContext);

export const streamUrl = (ws: string) => `${API_PREFIX}/workspaces/${encodeURIComponent(ws)}/events/stream`;

const SHOW_RECONNECTING_AFTER = 5_000;
/** Pings arrive every 25 s (docs/04 §3.22). Two missed means the connection is gone even if the socket says otherwise. */
const SILENCE_LIMIT = 60_000;

export function LiveProvider({ ws, children }: { ws: string; children: ReactNode }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    let stopped = false;
    let lastEventId: string | null = null;
    let attempt = 0;
    let everConnected = false;
    let current: AbortController | null = null;
    let lastHeard = Date.now();
    let downSince = Date.now();

    const watchdog = window.setInterval(() => {
      const now = Date.now();
      if (current && everConnected && attempt === 0 && now - lastHeard > SILENCE_LIMIT) current.abort();
      if (attempt > 0 && now - downSince >= SHOW_RECONNECTING_AFTER) setStatus('reconnecting');
    }, 1000);

    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

    const run = async () => {
      while (!stopped) {
        current = new AbortController();
        let opened = false;
        try {
          await readStream({
            url: streamUrl(ws),
            lastEventId,
            signal: current.signal,
            onOpen: () => {
              opened = true;
              lastHeard = Date.now();
              attempt = 0;
              setStatus('live');
              // Back after a gap: the stream replays what it still holds, and a refetch covers the rest.
              if (everConnected) refetchEverything(client);
              everConnected = true;
            },
            onActivity: () => {
              lastHeard = Date.now();
            },
            onMessage: (message) => {
              if (message.id) lastEventId = message.id;
              try {
                applyLiveMessage(client, ws, {
                  event: message.event,
                  data: JSON.parse(message.data) as unknown,
                });
              } catch {
                /* One unreadable message must not cost the connection. */
              }
            },
          });
        } catch (error) {
          if (error instanceof SseHttpError) {
            if (error.status === 401 && (await refreshSession())) continue;
            if (error.status === 404 || error.status === 403) {
              setStatus('unavailable');
              // Try again slowly: the endpoint may come up, and the indicator must follow it.
              await wait(30_000);
              continue;
            }
          }
        }
        if (stopped) return;
        if (opened) downSince = Date.now();
        attempt += 1;
        if (!opened && attempt === 1) downSince = Date.now();
        setStatus((s) => (s === 'live' ? 'connecting' : s));
        await wait(backoffDelay(attempt - 1));
      }
    };
    void run();

    return () => {
      stopped = true;
      window.clearInterval(watchdog);
      current?.abort();
    };
  }, [client, ws]);

  return <LiveContext.Provider value={status}>{children}</LiveContext.Provider>;
}
