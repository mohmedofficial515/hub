/**
 * @file query-client.ts
 * @description The browser's one QueryClient, reachable outside React because the sheet's writes and the palette read it from event
 * handlers. On the server every render gets its own.
 */
import { isServer, QueryClient } from '@tanstack/react-query';

import { HubError } from '@/lib/api/errors';

function create() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The stream invalidates what changed, so data stays fresh without polling.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => {
          if (error instanceof HubError && error.status < 500) return false;
          return count < 2;
        },
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return create();
  browserClient ??= create();
  return browserClient;
}
