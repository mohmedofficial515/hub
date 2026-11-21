'use client';

/**
 * @file queries.ts
 * @description Do next (docs/16 §11): `GET today/next`, the server's ranking with `doNext` from contracts, so Today and the panel show the same list. It sits under `qk.today`,
 * so every card event the stream brings rereads it with Today, and it needs no code of its own to stay live.
 */
import type { DoNextList, Role } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { get } from '@/lib/api/client';

export const nextKey = (ws: string, role: Role | null, limit: number) =>
  [...qk.today(ws), 'next', role ?? 'all', limit] as const;

/** What to start, ranked, with each item's reasons. A role narrows it to that role's work; the owner and no role see all. */
export function useDoNext({ role = null, limit = 5 }: { role?: Role | null; limit?: number } = {}) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: nextKey(ws, role, limit),
    queryFn: () => get<DoNextList>(`workspaces/${ws}/today/next`, { limit, ...(role ? { role } : {}) }),
    enabled: !!ws,
  });
}
