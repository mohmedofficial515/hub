/**
 * @file rows.ts
 * @description Lists with detail: a type's own endpoint, followed to its last page and mapped to `HubCard` rows. Tasks, Decisions and
 * Planning read these under `qk.cardList`, so rows are patched and refetched like every other list.
 */
import { getPage, type Paginated } from '@/lib/api/client';

import { type CardFullDto, toHubCard } from './map';
import type { HubCard } from './types';

/** A page holds 100, so this is 1000 rows. Past that the page says it shows the most recent ones. */
const MAX_PAGES = 10;

type RowQuery = Record<string, string | number | boolean | readonly string[] | null | undefined>;

export async function fetchDetailRows<Dto extends CardFullDto, Row extends HubCard>(
  path: string,
  query: RowQuery,
  extend: (card: HubCard, dto: Dto) => HubCard = (card) => card,
): Promise<Paginated<Row>> {
  const items: Row[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: Paginated<Dto> = await getPage<Dto>(path, {
      limit: 100,
      ...query,
      ...(cursor ? { cursor } : {}),
    });
    for (const dto of result.items) items.push(extend(toHubCard(dto), dto) as Row);
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  return { items, nextCursor: cursor, total: undefined };
}
