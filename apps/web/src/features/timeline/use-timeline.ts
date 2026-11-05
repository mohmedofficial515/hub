'use client';

/**
 * @file use-timeline.ts
 * @description The Timeline's data: `GET /timeline` page by page under `qk.timeline`, so the stream refreshes it (docs/04 §3.9), and the view that
 * decides what the reader sees of it (`stream.ts`). A row keeps its place while the member reads; they choose when new ones arrive.
 */
import type { TimelineRow, Today } from '@hub/contracts';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type EventDto, toEvent } from '@/features/cards/map';
import { get, getPage } from '@/lib/api/client';

import { markSeen } from '../today/seen';
import { asCard } from './run-action';
import { freshIds, reconcile, type StreamRow } from './stream';

const PAGE = 50;
/** Within this of the top the reader is not holding a place. */
const TOP_PX = 40;

export interface TimelineFilters {
  from?: string;
  to?: string;
  types?: string[];
  roles?: string[];
  repos?: string[];
  modules?: string[];
  actors?: string[];
  mine?: boolean;
}

export const toStreamRow = (dto: TimelineRow): StreamRow => ({
  id: dto.event.id,
  event: toEvent(dto.event as unknown as EventDto),
  card: asCard(dto.card),
  collapsed: dto.collapsed,
  collapsedKinds: dto.collapsedKinds,
});

function useTimelineQuery(filters: TimelineFilters) {
  const { ws } = useRoute();
  return useInfiniteQuery({
    queryKey: [...qk.timeline(ws), filters] as const,
    enabled: !!ws,
    initialPageParam: undefined as string | undefined,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      getPage<TimelineRow>(`workspaces/${ws}/timeline`, { ...filters, limit: PAGE, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

const atTop = () => window.scrollY < TOP_PX;
const EMPTY: ReadonlySet<string> = new Set();

interface View {
  filterKey: string;
  rows: StreamRow[];
  pending: number;
  fresh: Set<string>;
}

/** The stream as the reader sees it. `showNew` is the pill and `r`. */
export function useTimeline(filters: TimelineFilters) {
  const query = useTimelineQuery(filters);
  const filterKey = JSON.stringify(filters);
  const incoming = useMemo(
    () => query.data?.pages.flatMap((page) => page.items).map(toStreamRow) ?? [],
    [query.data],
  );
  const [view, setView] = useState<View | null>(null);
  const placeholder = query.isPlaceholderData;

  useEffect(() => {
    if (!query.data || placeholder) return;
    setView((current) => {
      if (!current || current.filterKey !== filterKey) {
        return { filterKey, rows: incoming, pending: 0, fresh: new Set() };
      }
      if (atTop()) {
        return { filterKey, rows: incoming, pending: 0, fresh: freshIds(current.rows, incoming) };
      }
      return { ...reconcile(current.rows, incoming), filterKey, fresh: new Set() };
    });
  }, [incoming, filterKey, placeholder, query.data]);

  const latest = useRef(incoming);
  latest.current = incoming;

  const { refetch } = query;
  const showNew = useCallback(async () => {
    const done = await refetch();
    const rows = done.data?.pages.flatMap((page) => page.items).map(toStreamRow) ?? latest.current;
    setView((current) => ({ filterKey, rows, pending: 0, fresh: freshIds(current?.rows ?? [], rows) }));
    window.scrollTo({ top: 0 });
  }, [filterKey, refetch]);

  return {
    rows: view?.rows ?? [],
    pending: view?.pending ?? 0,
    fresh: view?.fresh ?? EMPTY,
    showNew,
    /** First load only: a refresh or a change of filter keeps the page where it is. */
    isPending: query.isPending,
    isError: query.isError && !query.data,
    error: query.error,
    retry: () => void refetch(),
    hasOlder: query.hasNextPage,
    loadingOlder: query.isFetchingNextPage,
    loadOlder: query.fetchNextPage,
  };
}

/**
 * When the member was last here, for the tide line, read once per visit. Reading it is what counts as the visit (review M4): the same number on the
 * sidebar and Today clears now, and the line stays where it was. The key sits outside `qk.timeline`, so the stream never asks again.
 */
export function useLastVisit() {
  const { ws } = useRoute();
  const client = useQueryClient();
  return useQuery({
    queryKey: ['timeline-visit', ws] as const,
    enabled: !!ws,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const today = await get<Today>(`workspaces/${ws}/today`);
      void markSeen(ws, client);
      return today.changesSince.since;
    },
  }).data;
}
