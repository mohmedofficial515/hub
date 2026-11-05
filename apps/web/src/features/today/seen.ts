/**
 * @file seen.ts
 * @description `POST /today/seen` moves "since your last visit" forward (docs/04 §3.23). A visit to the Timeline does it at once. Today does it on
 * leaving, so the list and the sidebar's number stay what the member is reading, and the next visit shows only what is new (docs/09 §4).
 */
import type { QueryClient } from '@tanstack/react-query';

import { qk } from '@/features/cards/keys';
import type { Counters } from '@/features/session/session';
import { post } from '@/lib/api/client';

export async function markSeen(ws: string, client: QueryClient) {
  // `keepalive`: a reload or a closed tab still reaches the API.
  await post(`workspaces/${ws}/today/seen`, undefined, { keepalive: true });
  client.setQueryData<Counters>(qk.counters(ws), (old) => (old ? { ...old, newEvents: 0 } : old));
  void client.invalidateQueries({ queryKey: qk.counters(ws) });
}
