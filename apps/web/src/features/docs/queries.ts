'use client';

/**
 * @file queries.ts
 * @description The Docs page's reads (docs/04 §3.15, §3.23). Read-only: docs live in Git. The tree sits under the cards prefix and a doc's text
 * under its card key, so when the indexer changes a doc the stream refreshes both.
 */
import { useQuery } from '@tanstack/react-query';

import { useRoute } from '@/components/shell/router';
import { qk } from '@/features/cards/keys';
import { type CardFullDto, type CardSummaryDto, toHubCard, toListItem } from '@/features/cards/map';
import type { CardListItem, DocCard, DocHeading } from '@/features/cards/types';
import { get } from '@/lib/api/client';

import { allDocs, type DocFolder, type DocSource, hideTwins } from './tree';

interface FolderDto {
  name?: string;
  path: string;
  docs?: CardFullDto[];
  folders?: FolderDto[];
}

interface SourceDto {
  source: { id: string; name: string };
  root: FolderDto;
}

const nameOf = (path: string) => path.split('/').filter(Boolean).pop() ?? path;

/** A doc's detail names its source by id; the tree and the viewer know its name. */
const withSource = (card: DocCard, name: string | undefined): DocCard =>
  name ? { ...card, doc: { ...card.doc, sourceName: name } } : card;

function toFolder(dto: FolderDto, source: string): DocFolder {
  return {
    path: dto.path,
    name: dto.name || nameOf(dto.path),
    docs: (dto.docs ?? []).map((d) => withSource(toHubCard(d) as DocCard, source)),
    folders: (dto.folders ?? []).map((f) => toFolder(f, source)),
  };
}

export interface DocTreeData {
  /** As the API has them, twins included. */
  all: DocCard[];
  /** What the tree draws. */
  sources: DocSource[];
}

export function toTree(rows: readonly SourceDto[]): DocTreeData {
  const raw = rows.map((row) => ({
    id: row.source.id,
    name: row.source.name,
    root: toFolder(row.root, row.source.name),
  }));
  const all = raw.flatMap((s) => allDocs(s.root));
  return { all, sources: raw.map((s) => ({ ...s, root: hideTwins(s.root) })) };
}

export function useDocTree() {
  const { ws } = useRoute();
  return useQuery({
    queryKey: qk.cardList(ws, { view: 'doc-tree' }),
    enabled: !!ws,
    queryFn: async () => toTree(await get<SourceDto[]>(`workspaces/${ws}/docs/tree`)),
  });
}

export type DocWithContent = DocCard & {
  /** Null when the file is gone or now holds something like a secret: `unavailable` says which. */
  content: string | null;
  unavailable: 'missing' | 'secret' | null;
  toc: DocHeading[];
  mentionedBy: CardListItem[];
};

interface DocContentDto extends CardFullDto {
  content?: string | null;
  unavailable?: 'missing' | 'secret' | null;
  docSource?: { id: string; name: string };
  toc?: DocHeading[];
  mentionedBy?: CardSummaryDto[];
}

export function toDocWithContent(dto: DocContentDto): DocWithContent {
  return {
    ...withSource(toHubCard(dto) as DocCard, dto.docSource?.name),
    content: dto.content ?? null,
    unavailable: dto.unavailable ?? null,
    toc: dto.toc ?? [],
    mentionedBy: (dto.mentionedBy ?? []).map(toListItem),
  };
}

export function useDoc(key: string | null) {
  const { ws } = useRoute();
  return useQuery({
    queryKey: [...qk.card(ws, key ?? ''), 'content'] as const,
    enabled: !!key,
    retry: false,
    queryFn: async () => toDocWithContent(await get<DocContentDto>(`workspaces/${ws}/docs/${key}`)),
  });
}
