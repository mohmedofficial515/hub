'use client';

/**
 * @file queries.ts
 * @description Handoffs with their detail, from the type's own list (docs/04 §3.13). Under `qk.cardList`, so every stream message
 * and every write refreshes the page. The whole set is read, because the relay counts every status under the same filters.
 */
import { HANDOFF_STATUSES } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, toHubCard } from '@/features/cards/map';
import { HANDOFF_STALE_HOURS, handoffAgeMs } from '@/features/cards/store';
import type { HandoffCard } from '@/features/cards/types';
import { useSettings } from '@/features/settings/queries';
import { fetchAllPages } from '@/lib/api/pages';

export function useHandoffsQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'handoffs' }),
    enabled: !!ws,
    queryFn: async () => ({
      items: (
        await fetchAllPages<CardFullDto>(`workspaces/${ws}/handoffs`, { status: [...HANDOFF_STATUSES] })
      ).map((dto) => toHubCard(dto) as HandoffCard),
    }),
  });
}

/** Pending past `handoffs.stale_hours`. */
export function useHandoffStale() {
  const hours = useSettings().data?.['handoffs.stale_hours'];
  const limit = (typeof hours === 'number' ? hours : HANDOFF_STALE_HOURS) * 3_600_000;
  return useCallback(
    (card: Pick<HandoffCard, 'createdAt' | 'status'>) =>
      card.status === 'pending' && handoffAgeMs(card) > limit,
    [limit],
  );
}
