'use client';

/**
 * @file queries.ts
 * @description The Redesign page's reads (docs/04 §3.14). Everything sits under keys the live stream invalidates: pages under the cards
 * prefix, a version's files under its card key, so a change in the lab folder reaches the page with no code here.
 */
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, toHubCard } from '@/features/cards/map';
import type { CardAttachment, RedesignCard } from '@/features/cards/types';
import { get } from '@/lib/api/client';

import { LAB_BASE } from './gallery';
import { shotsFrom } from './lab';

export type BriefStatus = 'brief' | 'researching' | 'designing' | 'decided' | 'ported';

export interface LabPage {
  app: string;
  page: string;
  title: string;
  route?: string | undefined;
  liveUrl?: string | undefined;
  status: BriefStatus;
  /** The page brief, as Markdown. */
  brief?: string | undefined;
  /** The versions with a `page.tsx`. Null until a scan has said. */
  renderable: string[] | null;
  /** Oldest first: a page reads in the order its versions were made. */
  versionKeys: string[];
}

export interface LabPageDto {
  app: string;
  page: string;
  title?: string | null;
  route?: string | null;
  liveUrl?: string | null;
  status?: string | null;
  brief?: string | null;
  renderable?: string[] | null;
  versions: CardFullDto[];
}

const BRIEF_STATUSES = new Set<string>(['brief', 'researching', 'designing', 'decided', 'ported']);

/** `items` is the shape the cache's row patches understand, so a version takes a new status the moment it is predicted. */
export interface LabData {
  items: RedesignCard[];
  pages: LabPage[];
}

/** A brief has no title field: its first heading is the page's name. */
const briefTitle = (brief: string | null | undefined) => /^#\s+(.+)$/m.exec(brief ?? '')?.[1]?.trim();

export function toLabData(rows: readonly LabPageDto[]): LabData {
  const items: RedesignCard[] = [];
  const pages = rows.map((row): LabPage => {
    const versions = row.versions.map((v) => toHubCard(v) as RedesignCard);
    items.push(...versions);
    return {
      app: row.app,
      page: row.page,
      title: row.title?.trim() || briefTitle(row.brief) || row.page,
      route: row.route ?? undefined,
      liveUrl: row.liveUrl ?? undefined,
      status: (BRIEF_STATUSES.has(row.status ?? '') ? row.status : 'brief') as BriefStatus,
      brief: row.brief ?? undefined,
      renderable: row.renderable ?? null,
      versionKeys: versions.map((v) => v.key),
    };
  });
  return { items, pages };
}

export function useLabPages() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'lab-pages' }),
    enabled: !!ws,
    queryFn: async () => toLabData(await get<LabPageDto[]>(`workspaces/${ws}/redesign/pages`)),
  });
}

/**
 * Whether the lab answers behind Hub's proxy. It is a separate process and may be down while Hub is up, which is a state of the page and not an error. A
 * quick look at one frame, and again every few seconds while it is down.
 */
export function useLabRunning() {
  return useQuery({
    queryKey: ['lab-running'] as const,
    retry: false,
    refetchInterval: (query) => (query.state.data === false ? 5_000 : false),
    queryFn: async () => {
      try {
        return (await fetch(`${LAB_BASE}/frame-hub.html`, { cache: 'no-store' })).ok;
      } catch {
        return false;
      }
    },
  });
}

/** A version's pictures. A row of the list may already carry them; otherwise they are one small request, made once a tile is drawn. */
export function useShots(card: Pick<RedesignCard, 'key' | 'attachments'> | undefined) {
  const { ws } = useRoute();
  const carried = card?.attachments.length ? card.attachments : undefined;
  const query = useQuery({
    queryKey: [...qk.card(ws, card?.key ?? ''), 'attachments'] as const,
    enabled: !!card && !carried,
    queryFn: () => get<CardAttachment[]>(`workspaces/${ws}/cards/${card?.key}/attachments`),
  });
  return { shots: shotsFrom(carried ?? query.data ?? []), loading: !carried && query.isPending && !!card };
}

/** The raw files beside a version (docs/04 §3.14). */
export function useVersionFiles(key: string, enabled: boolean) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.card(ws, key), 'readme'] as const,
    enabled,
    queryFn: () =>
      get<{ markdown: string; review: string | null }>(`workspaces/${ws}/redesign/${key}/readme`),
  });
}
