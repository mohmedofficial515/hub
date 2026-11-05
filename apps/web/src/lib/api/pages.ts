/**
 * @file pages.ts
 * @description Every page of a cursor list, for a view that counts and groups the whole set on the client. The cap keeps a
 * runaway list from looping; these lists are small (needs, handoffs, an audit export).
 */
import { getPage, type Paginated } from './client';

type Query = Parameters<typeof getPage>[1];

export async function fetchAllPages<T>(path: string, query: Query = {}, cap = 1000): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null | undefined;
  do {
    const page: Paginated<T> = await getPage<T>(path, {
      ...query,
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < cap);
  return items;
}
