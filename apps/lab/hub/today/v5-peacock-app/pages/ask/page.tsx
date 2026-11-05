import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BookText, FileText, History, Search, SearchX, Terminal } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { ASK_SUGGESTIONS, searchProject, type AskScope, type CardHit, type DocHit, type Segment } from '@lab/mocks/hub-app/ask';
import { AppLink, Button, CardRow, cn, CopyButton, EmptyState, ErrorState, FilterBar, fmt, focusRing, LoadingRegion, Ltr, navigate, openCard, PageContainer, PageHeader, plural, SectionHeader, setQuery, Skeleton, SkeletonRows, StatusBadge, useCards, useFilter, useKeyboardList, useSession } from '../../kit';
import { messages } from './i18n';

const RECENT_KEY = 'hub-v5:ask-recent';

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* Storage can be blocked in the lab frame. Recent searches are a convenience. */
  }
}

/** Marked terms come as segments, so nothing here needs `dangerouslySetInnerHTML`. Reading direction comes from the text. */
function Excerpt({ segments, className }: { segments: Segment[]; className?: string }) {
  return (
    <span dir="auto" className={cn('block text-body text-foreground', className)}>
      {segments.map((s, i) =>
        s.mark ? (
          <mark key={i} className="rounded-sm bg-(--tide-soft) px-0.5 font-semibold text-foreground">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * A citation, not a reply: where the text lives comes first, the words after it. A row per document, with its best
 * sections under it, each of which opens the viewer at that heading.
 */
function DocResult({ hit, rowProps }: { hit: DocHit; rowProps: object }) {
  const t = useT(messages);
  return (
    <article {...rowProps} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:p-4">
      {/* The citation keeps the doc's own direction, as the viewer does. */}
      <div dir={hit.lang === 'ar' ? 'rtl' : 'ltr'} className="flex min-w-0 flex-col gap-2">
      <p className="flex min-w-0 items-center gap-2 text-body-sm">
        <FileText aria-hidden className="size-4 shrink-0 text-type-doc-fg" strokeWidth={1.75} />
        <Ltr mono className="min-w-0 truncate text-body-sm font-medium text-foreground">
          {hit.path}
        </Ltr>
      </p>
      <ul className="flex flex-col gap-2.5">
        {hit.chunks.map((chunk) => (
          <li key={chunk.anchor ?? 'intro'} className="flex flex-col gap-0.5">
            <AppLink
              view="docs"
              query={{ doc: hit.key, anchor: chunk.anchor, q: null, scope: null }}
              aria-label={`${fmt(t.openDoc, { path: hit.path })}: ${chunk.heading ?? t.noHeading}`}
              className={cn('hit-44 self-start rounded-sm text-body-sm font-semibold text-primary underline-offset-4 hover:underline', focusRing)}
            >
              {chunk.heading ?? t.noHeading}
            </AppLink>
            <Excerpt segments={chunk.excerpt} className="text-muted-foreground" />
          </li>
        ))}
      </ul>
      </div>
    </article>
  );
}

/** The hand-off, always in the same place: Hub searched; a written answer is the member's own Claude Code's job (D06). */
function Handoff({ query }: { query: string }) {
  const t = useT(messages).handoff;
  const command = query ? `/hub:ask ${query}` : null;
  return (
    <aside aria-labelledby="handoff-title" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 id="handoff-title" className="flex items-center gap-2 text-body-lg font-semibold text-foreground">
          <Terminal aria-hidden className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {t.title}
        </h2>
        <p className="text-body-sm text-muted-foreground">{t.body}</p>
      </div>
      {command ? (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-2 ps-3">
          <code dir="ltr" translate="no" className="key min-w-0 flex-1 py-1 text-start text-body-sm break-words text-foreground">
            {command}
          </code>
          <CopyButton text={command} showText={false} className="bg-card" />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-body-sm text-muted-foreground">{t.noQuery}</p>
      )}
      <div className="flex flex-col gap-3 max-lg:hidden">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-body-sm font-semibold text-foreground">{t.what}</h3>
          <ol className="flex list-decimal flex-col gap-1 ps-5 text-body-sm text-muted-foreground">
            {t.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="text-body-sm text-muted-foreground">{t.where}</p>
        </div>
        <p className="border-t border-border pt-3 text-body-sm text-muted-foreground">
          {t.setup}{' '}
          <AppLink view="settings" query={{ tab: 'tokens' }} className={cn('rounded-sm font-medium text-primary underline-offset-4 hover:underline', focusRing)}>
            {t.setupLink}
          </AppLink>
        </p>
      </div>
    </aside>
  );
}

export default function Page() {
  const { scenario } = useSession();
  return <Ask key={scenario} />;
}

function Ask() {
  const t = useT(messages);
  const locale = useLocale();
  const { loading, error, scenario, isManager } = useSession();
  const q = useFilter('q') ?? '';
  const scope = (useFilter('scope') as AskScope | null) ?? 'all';
  const cards = useCards();
  const [text, setText] = useState(q);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const input = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);

  // A link from Docs or the palette carries `q`. The field follows the URL.
  useEffect(() => setText(q), [q]);

  const results = useMemo(() => (q ? searchProject(q, scope, cards, locale) : { docs: [], cards: [], exactKey: false }), [q, scope, cards, locale]);
  const total = results.docs.length + results.cards.length;

  const submit = (value: string) => {
    const query = value.trim();
    setQuery({ q: query || null });
    if (!query) return;
    const next = [query, ...recent.filter((r) => r !== query)].slice(0, 6);
    setRecent(next);
    writeRecent(next);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  const ids = [...results.cards.filter(() => results.exactKey).map((c) => `card:${c.key}`), ...results.docs.map((d) => `doc:${d.key}`), ...results.cards.filter(() => !results.exactKey).map((c) => `card:${c.key}`)];
  const list = useKeyboardList({
    ids,
    emptyFocusRef: resultsHeading,
    onOpen: (id) => {
      const [kind, key] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)];
      if (kind === 'card') openCard(key);
      else navigate('docs', { query: { doc: key, anchor: results.docs.find((d) => d.key === key)?.chunks[0]?.anchor ?? null } });
    },
  });

  const header = <PageHeader title={t.title} meta={t.meta} />;

  if (error) {
    return (
      <PageContainer>
        {header}
        <ErrorState thing={t.errorThing} code="hub.ask.unavailable" requestId="req_7f3ac21" onRetry={() => setQuery({ scenario: null })} />
      </PageContainer>
    );
  }
  if (scenario === 'empty') {
    return (
      <PageContainer>
        {header}
        <EmptyState
          size="page"
          icon={BookText}
          title={t.emptyWorkspace.title}
          action={
            isManager ? (
              <AppLink view="settings" query={{ tab: 'sources' }} className={cn('inline-flex h-11 items-center rounded-md bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover md:h-9', focusRing)}>
                {t.emptyWorkspace.action}
              </AppLink>
            ) : undefined
          }
        >
          {t.emptyWorkspace.body}
        </EmptyState>
      </PageContainer>
    );
  }

  const cardRow = (c: CardHit) => (
    <li key={c.key}>
      <CardRow
        {...list.rowProps(`card:${c.key}`)}
        cardKey={c.key}
        type={c.type}
        title={c.title[locale]}
        meta={
          <>
            <StatusBadge status={c.status} />
            {c.excerpt.length > 0 && (
              <span className="basis-full">
                <Excerpt segments={c.excerpt} className="text-body-sm text-muted-foreground" />
              </span>
            )}
          </>
        }
      />
    </li>
  );

  return (
    <PageContainer>
      {header}
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t.inputLabel}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            ref={input}
            dir="auto"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
            className={cn('h-12 w-full rounded-lg border border-input bg-card ps-11 pe-3 text-body-lg text-foreground placeholder:text-muted-foreground', focusRing)}
          />
        </label>
        <Button type="submit" variant="primary" className="h-12 px-6 md:h-12">
          {t.search}
        </Button>
      </form>

      <FilterBar
        status={{
          label: t.scope,
          value: scope,
          onChange: (next) => setQuery({ scope: next === 'all' ? null : next }),
          options: [
            { value: 'all', label: t.scopes.all },
            { value: 'docs', label: t.scopes.docs },
            { value: 'cards', label: t.scopes.cards },
          ],
        }}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="order-first lg:sticky lg:top-18 lg:order-last">
          <Handoff query={q} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {loading ? (
            <LoadingRegion label={t.loading}>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-32" />
                <SkeletonRows count={3} withAction={false} />
              </div>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-6 w-32" />
                <SkeletonRows count={2} withAction={false} />
              </div>
            </LoadingRegion>
          ) : !q ? (
            <div className="flex flex-col gap-6">
              {recent.length > 0 && (
                <section aria-labelledby="ask-recent" className="flex flex-col gap-2">
                  <SectionHeader
                    id="ask-recent"
                    icon={History}
                    title={t.empty.recent}
                    level={2}
                    aside={
                      <button
                        type="button"
                        onClick={() => {
                          setRecent([]);
                          writeRecent([]);
                          input.current?.focus();
                        }}
                        className={cn('hit-44 rounded-sm text-body-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline', focusRing)}
                      >
                        {t.empty.clearRecent}
                      </button>
                    }
                  />
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button type="button" dir="auto" onClick={() => submit(r)} className={cn('inline-flex h-11 max-w-full items-center rounded-full border border-border bg-card px-3 text-body-sm text-foreground hover:bg-accent md:h-8', focusRing)}>
                          <span className="truncate">{r}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-labelledby="ask-try" className="flex flex-col gap-2">
                <SectionHeader id="ask-try" icon={Search} title={t.empty.try} />
                <p className="text-body text-muted-foreground">{t.empty.tryBody}</p>
                <ul className="flex flex-wrap gap-2">
                  {ASK_SUGGESTIONS.map((s) => (
                    <li key={s.q.en}>
                      <button type="button" dir="auto" onClick={() => submit(s.q[locale])} className={cn('inline-flex h-11 items-center rounded-full border border-border bg-card px-3 text-body-sm text-foreground hover:bg-accent md:h-8', focusRing)}>
                        {s.q[locale]}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <>
              <h2 ref={resultsHeading} tabIndex={-1} role="status" className="text-body text-muted-foreground outline-none">
                <bdi dir="auto">{fmt(t.statusLine, { count: plural(total, locale, t.resultCount), q })}</bdi>
              </h2>
              {total === 0 && (
                <EmptyState icon={SearchX} title={t.noResults.title}>
                  {t.noResults.body}
                </EmptyState>
              )}
              {results.exactKey && <ul data-hub-list className="flex flex-col gap-2">{results.cards.map(cardRow)}</ul>}
              {results.docs.length > 0 && (
                <section aria-labelledby="ask-docs" className="flex flex-col gap-2.5">
                  <SectionHeader id="ask-docs" title={t.docs} count={results.docs.length} />
                  <ul data-hub-list className="flex flex-col gap-2">
                    {results.docs.map((hit) => (
                      <li key={hit.key}>
                        <DocResult hit={hit} rowProps={list.rowProps(`doc:${hit.key}`)} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!results.exactKey && results.cards.length > 0 && (
                <section aria-labelledby="ask-cards" className="flex flex-col gap-2.5">
                  <SectionHeader id="ask-cards" title={t.cards} count={results.cards.length} />
                  <ul data-hub-list className="flex flex-col gap-2">
                    {results.cards.map(cardRow)}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
