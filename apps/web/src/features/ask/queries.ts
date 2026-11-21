'use client';

/**
 * @file queries.ts
 * @description `GET /search` for the Ask page. It lives under the cards prefix so that a card or doc changing elsewhere refreshes open results.
 */
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { get } from '@/lib/api/client';

import { type AskScope, isSearchable, type SearchDto, toResults } from './search';

export function useAskSearch(q: string, scope: AskScope) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'ask', q, scope }),
    enabled: !!ws && isSearchable(q),
    queryFn: async () =>
      toResults(
        await get<SearchDto>(`workspaces/${ws}/search`, {
          q: q.trim(),
          includeDocs: scope !== 'cards',
          limit: 20,
        }),
        q,
        scope,
      ),
  });
}
