import { useMemo, useRef, useState, type FormEvent } from 'react';
import { FileQuestion, History, LibraryBig, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { docTree } from '@lab/mocks/hub-app/docs';
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
  useCard,
  useCards,
  useFilter,
  useKeyboardList,
  useSession,
  type DocCard,
} from '../core/kit';
import { messages } from '../../../today/v5-peacock-app/pages/docs/i18n';
import { DocTree } from '../../../today/v5-peacock-app/pages/docs/parts/tree';
import { DocBar } from './doc-bar';
import { DocViewer, useMainWidth } from './doc-viewer';

export default function Page() {
  const { scenario } = useSession();
  return <Docs key={scenario} />;
}

function SearchDocs() {
  const t = useT(messages);
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate('ask', { query: { scope: 'docs', q: q.trim() || null } });
  };
  return (
    <form role="search" onSubmit={submit} className="relative w-full md:w-72">
      <label>
        <span className="sr-only">{t.searchLabel}</span>
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
        <input
          dir="auto"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.search}
          className={cn('h-11 w-full rounded-md border border-input bg-card ps-9 pe-3 text-body text-foreground placeholder:text-muted-foreground md:h-9', focusRing)}
        />
      </label>
    </form>
  );
}

function Docs() {
  const t = useT(messages);
  const locale = useLocale();
  const { loading, error, scenario, isManager } = useSession();
  const docKey = useFilter('doc');
  // v5 reads the window here. Behind the panel the page is much narrower than the window, so this version reads the page.
  const wide = useMainWidth() >= 860;
  const tree = useMemo(() => docTree(), []);
  const cards = useCards();
  const selected = useCard(docKey);
  const card = selected?.type === 'doc' ? selected : undefined;

  const recent = useMemo(
    () =>
      cards
        .filter((c): c is DocCard => c.type === 'doc' && !c.doc.path.endsWith('.ar.md'))
        .sort((a, b) => Date.parse(b.lastEventAt) - Date.parse(a.lastEventAt))
        .slice(0, 6),
    [cards],
  );

  const heading = useRef<HTMLHeadingElement>(null);
  // `j` and `k` walk the tree and the recent list as one sequence. A tree row opens in the viewer, a card row in the sheet.
  const ids = useMemo(() => [...tree.flatMap(({ root }) => collect(root)), ...recent.map((c) => `recent:${c.key}`)], [tree, recent]);
  const list = useKeyboardList({
    ids,
    emptyFocusRef: heading,
    onOpen: (id) => (id.startsWith('recent:') ? openCard(id.slice(7)) : setQuery({ doc: id, anchor: null }, { replace: false })),
  });

  const header = <PageHeader title={t.title} meta={t.meta} actions={!loading && !error && scenario !== 'empty' ? <SearchDocs /> : undefined} className="[&>div:last-child]:max-md:w-full" />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.docs.unavailable" requestId="req_7f3ac21" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }
  if (loading) {
    return (
      <PageContainer className="max-w-none">
        {header}
        <LoadingRegion label={t.loading}>
          <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton key={i} className={cn('h-5', i % 4 === 0 ? 'w-2/3' : 'ms-4 w-4/5')} />
              ))}
            </div>
            <SkeletonRows count={6} withAction={false} className="max-lg:hidden" />
          </div>
        </LoadingRegion>
      </PageContainer>
    );
  }
  if (scenario === 'empty') {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={LibraryBig}
          title={t.emptyTitle}
          action={
            isManager ? (
              <AppLink view="settings" query={{ tab: 'sources' }} className={cn('inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
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

  const treeView = <DocTree tree={tree} current={card?.key ?? null} rowProps={list.rowProps} />;

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
              title={c.title[locale]}
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

  const missing = docKey && !card && (
    <EmptyState icon={FileQuestion} title={t.notFound}>
      {t.notFoundBody}
    </EmptyState>
  );

  const reader = (
    <div className="flex min-w-0 flex-col gap-4">
      <DocBar doc={card} />
      {card ? <DocViewer key={card.key} card={card} /> : missing || landing}
    </div>
  );

  // 09 §11, phone: the tree is the list page and the viewer takes the whole screen.
  if (!wide) {
    return <PageContainer>{card ? reader : <>{header}<DocBar />{missing}{treeView}{!missing && landing}</>}</PageContainer>;
  }

  return (
    <PageContainer className="max-w-none">
      {header}
      <div className="grid items-start gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <aside className="sticky top-18 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain pe-1">{treeView}</aside>
        <div className="min-w-0">{reader}</div>
      </div>
    </PageContainer>
  );
}

function collect(folder: ReturnType<typeof docTree>[number]['root']): string[] {
  return [...folder.docs.map((d) => d.key), ...folder.folders.flatMap(collect)];
}

