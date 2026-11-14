'use client';

/**
 * @file docs-page.tsx
 * @description Reading the project's documentation: a sticky tree, the doc, and its outline. Read-only, because docs live in Git. With no doc
 * open, the reading pane lists what changed. Ported from the design's `pages/docs/page.tsx`.
 */
import { FileQuestion, History, LibraryBig, Search } from 'lucide-react';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import {
  AppLink,
  CardRow,
  cn,
  EmptyState,
  ErrorState,
  focusRing,
  LoadingRegion,
  navigate,
  openCard,
  PageContainer,
  PageHeader,
  RelativeTime,
  SectionHeader,
  setQuery,
  Skeleton,
  SkeletonRows,
  StatusBadge,
  useFilter,
  useKeyboardList,
  usePageWide,
  useSession,
  useT,
} from '@/components/kit';
import { useDoc, useDocTree } from '@/features/docs/queries';
import { allDocs, type DocFolder, recentDocs } from '@/features/docs/tree';
import { isHubError } from '@/lib/api/errors';

import type { DocsMessages } from './messages';
import { DocTree } from './tree';
import { DocViewer } from './viewer';

function SearchDocs() {
  const t = useT<DocsMessages>('docs');
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate('ask', { query: { scope: 'docs', q: q.trim() || null } });
  };
  return (
    <form role="search" onSubmit={submit} className="relative w-full md:w-72">
      <label>
        <span className="sr-only">{t.searchLabel}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <input
          dir="auto"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className={cn(
            'h-11 w-full rounded-md border border-input bg-card ps-9 pe-3 text-body text-foreground placeholder:text-muted-foreground md:h-9',
            focusRing,
          )}
        />
      </label>
    </form>
  );
}

const collect = (folder: DocFolder): string[] => allDocs(folder).map((d) => d.key);

export function DocsPage() {
  const t = useT<DocsMessages>('docs');
  const { isManager } = useSession();
  const docKey = useFilter('doc');
  const wide = usePageWide(1024);
  const tree = useDocTree();
  const selected = useDoc(docKey);
  const card = selected.data;

  const sources = useMemo(() => tree.data?.sources ?? [], [tree.data]);
  const all = useMemo(() => tree.data?.all ?? [], [tree.data]);
  const recent = useMemo(() => recentDocs(all), [all]);
  const empty = tree.isSuccess && all.length === 0;

  const heading = useRef<HTMLHeadingElement>(null);
  // `j` and `k` walk the tree and the recent list as one sequence. A tree row opens in the viewer, a card row in the sheet.
  const ids = useMemo(
    () => [...sources.flatMap(({ root }) => collect(root)), ...recent.map((c) => `recent:${c.key}`)],
    [sources, recent],
  );
  const list = useKeyboardList({
    ids,
    emptyFocusRef: heading,
    onOpen: (id) => {
      if (id.startsWith('recent:')) openCard(id.slice(7));
      else setQuery({ doc: id, anchor: null }, { replace: false });
    },
  });

  const header = (
    <PageHeader
      title={t.title}
      meta={t.meta}
      actions={tree.isSuccess && !empty ? <SearchDocs /> : undefined}
      className="[&>div:last-child]:max-md:w-full"
    />
  );

  if (tree.isError) {
    const error = tree.error;
    return (
      <PageContainer>
        {header}
        <ErrorState
          thing={t.errorThing}
          code={isHubError(error) ? error.code : 'hub.docs.unavailable'}
          requestId={isHubError(error) ? error.requestId : undefined}
          onRetry={() => void tree.refetch()}
        />
      </PageContainer>
    );
  }
  if (tree.isPending) {
    return (
      <PageContainer className="max-w-none">
        {header}
        <LoadingRegion label={t.loading}>
          <div className="grid gap-8 lg:@page-lg:grid-cols-[17.5rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className={cn('h-5', i % 4 === 0 ? 'w-2/3' : 'ms-4 w-4/5')} />
              ))}
            </div>
            <SkeletonRows count={6} withAction={false} className="max-lg:hidden @max-page-lg:hidden" />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (empty) {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={LibraryBig}
          title={t.emptyTitle}
          action={
            isManager ? (
              <AppLink
                view="settings"
                query={{ tab: 'sources' }}
                className={cn(
                  'inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9',
                  focusRing,
                )}
              >
                {t.emptyAction}
              </AppLink>
            ) : undefined
          }
        >
          {t.emptyBody}
        </EmptyState>
      </PageContainer>
    );
  }

  const treeView = <DocTree sources={sources} current={docKey} rowProps={list.rowProps} />;

  const landing = (
    <section aria-labelledby="recent-docs" className="flex flex-col gap-3">
      <SectionHeader ref={heading} id="recent-docs" icon={History} title={t.recentTitle} />
      <p className="text-body text-muted-foreground">{t.recentBody}</p>
      <ul data-hub-list className="flex flex-col gap-2">
        {recent.map((c) => (
          <li key={c.key}>
            <CardRow
              {...list.rowProps(`recent:${c.key}`)}
              cardKey={c.key}
              type="doc"
              hideType
              title={c.title}
              meta={
                <>
                  {c.status === 'stale' && <StatusBadge status="stale" />}
                  <RelativeTime iso={c.lastEventAt} />
                </>
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );

  const missing =
    docKey && selected.isError ? (
      <EmptyState icon={FileQuestion} title={t.notFound}>
        {t.notFoundBody}
      </EmptyState>
    ) : null;
  const loadingDoc =
    docKey && selected.isPending ? (
      <LoadingRegion label={t.loading}>
        <SkeletonRows count={6} withAction={false} />
      </LoadingRegion>
    ) : null;

  const reader = card ? (
    <DocViewer key={card.key} card={card} all={all} />
  ) : (
    (missing ?? loadingDoc ?? landing)
  );

  // 09 §11, phone: the tree is the list page and the viewer takes the whole screen.
  if (!wide) {
    return (
      <PageContainer>
        {card || loadingDoc ? (
          reader
        ) : (
          <>
            {header}
            {missing}
            {treeView}
            {!missing && landing}
          </>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-none">
      {header}
      <div className="grid items-start gap-5 lg:@page-lg:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside className="glass sticky top-18 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain rounded-2xl p-2">
          {treeView}
        </aside>
        <div className="glass min-w-0 rounded-2xl p-4 md:p-6">{reader}</div>
      </div>
    </PageContainer>
  );
}
