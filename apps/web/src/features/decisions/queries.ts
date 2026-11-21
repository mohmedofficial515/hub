'use client';

/**
 * @file queries.ts
 * @description The Decisions page's data: `GET /decisions`, open and closed apart because the API sorts them differently, each with what it blocks.
 */
import type { UpdateCardInput } from '@hub/contracts';
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { patch } from '@/lib/api/client';

import { qk } from '../cards/keys';
import { type CardFullDto, type CardSummaryDto, toListItem } from '../cards/map';
import { fetchDetailRows } from '../cards/rows';
import { writeCard } from '../cards/store';
import type { DecisionCard, DecisionOption } from '../cards/types';

type DecisionRowDto = CardFullDto & { blocks?: CardSummaryDto[] };

const CLOSED = ['decided', 'withdrawn', 'superseded'];

function useDecisionRows(status: string[]) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'decisions', status }),
    enabled: !!ws,
    queryFn: () =>
      fetchDetailRows<DecisionRowDto, DecisionCard>(
        `workspaces/${ws}/decisions`,
        { status },
        (card, dto) => ({
          ...card,
          links: (dto.blocks ?? []).map((other) => ({
            kind: 'blocks' as const,
            key: other.key,
            card: toListItem(other),
          })),
        }),
      ),
  });
}

export const useOpenDecisions = () => useDecisionRows(['open']);
export const useClosedDecisions = () => useDecisionRows(CLOSED);

/** One save of the sheet's form: the header and, while the decision is open, its options. */
export function saveDecision(
  ws: string,
  key: string,
  header: UpdateCardInput,
  options: DecisionOption[] | null,
) {
  const { dueAt, ...rest } = header;
  return writeCard(
    {
      key,
      fields: {
        ...rest,
        ...(dueAt === undefined ? {} : { dueAt: dueAt ?? undefined }),
      } as Partial<DecisionCard>,
      card: (card) => {
        if (card.type !== 'decision') return card;
        return {
          ...card,
          decision: {
            ...card.decision,
            ...(options ? { options } : {}),
            ...(header.ownerRole ? { deciderRole: header.ownerRole } : {}),
          },
        };
      },
    },
    async () => {
      if (Object.keys(header).length > 0) await patch(`workspaces/${ws}/cards/${key}`, header);
      if (options) await patch(`workspaces/${ws}/decisions/${key}/options`, { options });
    },
    ws,
  );
}
