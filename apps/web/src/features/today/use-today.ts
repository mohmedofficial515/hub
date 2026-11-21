'use client';

/**
 * @file use-today.ts
 * @description `GET /today` for the page (docs/04 §3.23), under `qk.today`, so the stream keeps it current. The stack and Ready rows keep coming from
 * the card lists, which writes patch at once; this response adds what a row in those lists does not carry.
 */
import type { CardWithDetail, Today } from '@hub/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import type { CardListItem, HubCard } from '@/features/cards/types';
import { get } from '@/lib/api/client';

import { asCard } from '../timeline/run-action';
import { markSeen } from './seen';

export function useTodayQuery() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.today(ws),
    enabled: !!ws,
    queryFn: () => get<Today>(`workspaces/${ws}/today`),
  });
}

/** Each card by key, in the form the rules and rows read. */
export function useDetailed(rows: readonly CardWithDetail[] | undefined) {
  return useMemo(() => new Map((rows ?? []).map((dto) => [dto.key, asCard(dto)])), [rows]);
}

/** The list's row wins, because it holds a predicted status; the detail comes from `/today`. */
export function enrich<T extends CardListItem>(
  row: T,
  detailed: ReadonlyMap<string, HubCard>,
): T & Partial<HubCard> {
  const full = detailed.get(row.key);
  return { ...(full ?? {}), ...row };
}

let pendingSeen: number | undefined;

/** Move the last-visit mark when this page goes away, including by reload. A remount in the same tick is the same visit. */
export function useSeenOnLeave(loaded: boolean) {
  const { ws } = useRoute();
  const client = useQueryClient();
  useEffect(() => {
    if (!loaded) return;
    window.clearTimeout(pendingSeen);
    const send = () => void markSeen(ws, client).catch(() => undefined);
    window.addEventListener('pagehide', send);
    return () => {
      window.removeEventListener('pagehide', send);
      pendingSeen = window.setTimeout(send, 0);
    };
  }, [loaded, ws, client]);
}
