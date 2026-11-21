'use client';

/**
 * @file use-inbox.ts
 * @description The Inbox's reads and writes (docs/04 §3.17), all under `qk.inbox`, so the stream and the sidebar's count stay with them. A write predicts
 * in every cache, puts back what was there if the API refuses, then reads again. Every write has a real inverse, so Undo is real.
 */
import type { InboxItem, NotificationKind } from '@hub/contracts';
import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { showToast } from '@/components/common/toast';
import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type Counters } from '@/features/session/session';
import { getPage, type Paginated, post } from '@/lib/api/client';
import { isHubError } from '@/lib/api/errors';

const PAGE = 50;

export interface InboxFilters {
  unread?: boolean;
  archived?: boolean;
  kinds?: NotificationKind[];
}

const listKey = (ws: string, filters: InboxFilters) => [...qk.inbox(ws), 'list', filters] as const;

export function useInboxList(filters: InboxFilters) {
  const { ws } = useRoute();
  const query = useInfiniteQuery({
    queryKey: listKey(ws, filters),
    enabled: !!ws,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      getPage<InboxItem>(`workspaces/${ws}/inbox`, { ...filters, limit: PAGE, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return { ...query, items };
}

/** Whether the member has any notification at all, which decides between "none yet" and "all caught up". */
export function useHasAnyItem() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.inbox(ws), 'any'] as const,
    enabled: !!ws,
    queryFn: async () => (await getPage<InboxItem>(`workspaces/${ws}/inbox`, { limit: 1 })).items.length > 0,
  });
}

/** How many are archived, for the link to the archive. The API has no count of its own, so this reads the first page. */
export function useArchivedCount() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.inbox(ws), 'archived-count'] as const,
    enabled: !!ws,
    queryFn: async () =>
      (await getPage<InboxItem>(`workspaces/${ws}/inbox`, { archived: true, limit: 100 })).items.length,
  }).data;
}

type Patch = Partial<Pick<InboxItem, 'readAt' | 'archivedAt'>>;
type Undo = () => void;

export function useInboxActions(failed: string) {
  const { ws } = useRoute();
  const client = useQueryClient();

  const write = (
    ids: string[],
    patch: Patch,
    unreadDelta: number,
    request: (id: string) => Promise<unknown>,
  ) => {
    const prefix = qk.inbox(ws);
    const snapshot = client.getQueriesData({ queryKey: prefix });
    const counters = client.getQueryData<Counters>(qk.counters(ws));
    void client.cancelQueries({ queryKey: prefix });
    const wanted = new Set(ids);
    client.setQueriesData<InfiniteData<Paginated<InboxItem>>>({ queryKey: [...prefix, 'list'] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (wanted.has(item.id) ? { ...item, ...patch } : item)),
            })),
          }
        : data,
    );
    client.setQueryData<{ unread: number }>([...prefix, 'count'], (data) =>
      data ? { ...data, unread: Math.max(0, data.unread + unreadDelta) } : data,
    );
    void Promise.all(ids.map(request))
      .catch((error: unknown) => {
        for (const [queryKey, data] of snapshot) client.setQueryData(queryKey, data);
        client.setQueryData(qk.counters(ws), counters);
        showToast({ tone: 'error', message: isHubError(error) ? error.message : failed });
      })
      .finally(() => {
        void client.invalidateQueries({ queryKey: prefix });
        void client.invalidateQueries({ queryKey: qk.counters(ws) });
      });
  };

  const item = (id: string, verb: string) => post(`workspaces/${ws}/inbox/${id}/${verb}`);
  const now = () => new Date().toISOString();

  const markUnread = (ids: string[]): Undo => {
    write(ids, { readAt: null }, ids.length, (id) => item(id, 'unread'));
    return () => markRead(ids);
  };
  const markRead = (ids: string[]): Undo => {
    write(ids, { readAt: now() }, -ids.length, (id) => item(id, 'read'));
    return () => markUnread(ids);
  };
  const restore = (ids: string[], unread: number): Undo => {
    write(ids, { archivedAt: null }, unread, (id) => item(id, 'unarchive'));
    return () => archive(ids, unread);
  };
  const archive = (ids: string[], unread: number): Undo => {
    write(ids, { archivedAt: now() }, -unread, (id) => item(id, 'archive'));
    return () => restore(ids, unread);
  };
  return { markRead, markUnread, archive, restore };
}

/** "Mark all read" covers what is not loaded too. Its Undo can only restore what the page knows, so it is offered only when that is everything. */
export function useMarkAllRead(failed: string) {
  const { ws } = useRoute();
  const client = useQueryClient();
  return () => {
    const prefix = qk.inbox(ws);
    const before = new Date().toISOString();
    client.setQueriesData<InfiniteData<Paginated<InboxItem>>>({ queryKey: [...prefix, 'list'] }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((row) => (row.readAt ? row : { ...row, readAt: before })),
            })),
          }
        : data,
    );
    client.setQueryData<{ unread: number }>([...prefix, 'count'], (data) =>
      data ? { ...data, unread: 0 } : data,
    );
    void post(`workspaces/${ws}/inbox/read-all`, { before })
      .catch((error: unknown) => {
        showToast({ tone: 'error', message: isHubError(error) ? error.message : failed });
      })
      .finally(() => {
        void client.invalidateQueries({ queryKey: prefix });
        void client.invalidateQueries({ queryKey: qk.counters(ws) });
      });
  };
}
