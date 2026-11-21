'use client';

/**
 * @file queries.ts
 * @description Needs with their detail, from the type's own list (docs/04 §3.12). Under `qk.cardList`, so every stream message
 * and every write refreshes the board. The whole set is read, because the board counts and groups all of it on the client.
 */
import { NEED_STATUSES } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, type CardSummaryDto, toHubCard, toListItem } from '@/features/cards/map';
import type { NeedCard } from '@/features/cards/types';
import { useSettings } from '@/features/settings/queries';
import { fetchAllPages } from '@/lib/api/pages';
import { nowMs } from '@/lib/format';

type NeedDto = CardFullDto & { blocks?: CardSummaryDto[] };

/** The list answers `blocks` beside each need, in place of the full card's links. */
export const toNeedCard = ({ blocks = [], ...dto }: NeedDto): NeedCard => {
  const card = toHubCard(dto) as NeedCard;
  return {
    ...card,
    links: [
      ...card.links,
      ...blocks.map((other) => ({ kind: 'blocks' as const, key: other.key, card: toListItem(other) })),
    ],
  };
};

export function useNeedsQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'needs' }),
    enabled: !!ws,
    queryFn: async () => ({
      items: (await fetchAllPages<NeedDto>(`workspaces/${ws}/needs`, { status: [...NEED_STATUSES] })).map(
        toNeedCard,
      ),
    }),
  });
}

const DAY_MS = 86_400_000;

/** Past `needs.stale_days`, or flagged by the deadline engine. */
export function useNeedStale() {
  const days = useSettings().data?.['needs.stale_days'];
  const limit = (typeof days === 'number' ? days : 5) * DAY_MS;
  return useCallback(
    (card: Pick<NeedCard, 'status' | 'flags' | 'createdAt'>) =>
      card.status === 'requested' && (!!card.flags?.stale || nowMs() - Date.parse(card.createdAt) > limit),
    [limit],
  );
}
