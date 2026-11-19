// The overview is a command surface: one large search is the focal point, with filter chips (live counts),
// keyboard hints, grouped field results and, before anything is typed, pinned / recent / attention / index.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Check, ChevronDown, Lock, Search, Sparkles, TriangleAlert, X } from 'lucide-react';
import { SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { fmtNumber, loc } from './format';
import { iconFor } from './icons';
import { allEntries, canSee, PREFS_TITLE } from './model';
import { startParam } from './route';
import { AttentionBlock, IndexBlock, PinnedBlock, RecentBlock } from './home-blocks';
import { NoResults, ResultGroups, focusFirstResult, onResultsKeyDown, openEntry } from './results';
import { groupHits, search, type FilterId } from './search';
import { useStore } from './store';
import { Kbd, Menu, focusRing } from './ui';

const FILTERS: FilterId[] = ['changed', 'risk', 'proposed', 'attention'];
const PaletteIcon = iconFor('Palette');
const FILTER_ICON = { changed: null, risk: TriangleAlert, proposed: Sparkles, attention: TriangleAlert } as const;

function readStartFilters(): FilterId[] {
  const raw = startParam('chips');
  return raw ? (raw.split(',').filter((f) => (FILTERS as string[]).includes(f)) as FilterId[]) : [];
}

export function Overview() {
  const t = useT(messages);
  const locale = useLocale();
  const store = useStore();

  const [query, setQuery] = useState(() => startParam('q') ?? '');
  const [filters, setFilters] = useState<FilterId[]>(readStartFilters);
  const [section, setSection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const visible = (e: (ReturnType<typeof allEntries>)[number]) => canSee(store.role, e.groupKey, e.field);
  const valueOf = (e: (ReturnType<typeof allEntries>)[number]) => store.saved(e.groupKey, e.key);
  const total = useMemo(() => allEntries().filter(visible).length, [store.role]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenTotal = allEntries().length - total;

  const opts = { query, filters, section, locale, valueOf, visible };
  const hits = search(opts);
  const grouped = groupHits(hits, !!query.trim());

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, search({ ...opts, filters: filters.includes(f) ? filters : [...filters, f] }).length]),
  ) as Record<FilterId, number>;
  const searching = !!query.trim() || filters.length > 0 || !!section;
  const hiddenHits = searching
    ? search({ ...opts, visible: (e) => !visible(e) }).length
    : 0;

  const focusSearch = () => inputRef.current?.focus();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.closest('input, textarea, select, [contenteditable="true"]');
      // Only "/" here: Ctrl/Cmd+K belongs to the dashboard shell's global search.
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sectionLabel = section
    ? section === 'prefs'
      ? loc(PREFS_TITLE, locale)
      : loc(SETTINGS_SECTIONS.find((s) => s.id === section)?.title, locale)
    : t.search.allSections;

  const clearAll = () => {
    setFilters([]);
    setSection(null);
  };

  return (
    <LayoutGroup>
      <div className="mx-auto w-full max-w-6xl px-4 pb-40 sm:px-6">
        {/* The hero stays in place while typing: the search box never moves under the cursor (no layout shift). */}
        <div className="pt-8 text-center sm:pt-14">
          <h1 className="text-26 font-extrabold leading-tight tracking-tight sm:text-32">{t.hero.title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-14 leading-relaxed text-muted-foreground sm:text-15">{t.hero.lead(total, SETTINGS_SECTIONS.length)}</p>
        </div>

        <div className="sticky top-[var(--settings-sticky-top,0px)] z-30 -mx-4 bg-background/92 px-4 pb-3 pt-5 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground sm:start-5 sm:size-6" />
              <input
                ref={inputRef}
                type="search"
                role="searchbox"
                aria-label={t.hero.label}
                aria-describedby="search-hints search-status"
                aria-controls="search-results"
                autoComplete="off"
                spellCheck={false}
                value={query}
                placeholder={t.hero.placeholder(total)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    const first = resultsRef.current?.querySelector<HTMLElement>('[data-result]');
                    if (first) {
                      e.preventDefault();
                      first.focus();
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // Enter stays on the results: Ctrl/Cmd+Enter opens the first result's group, plain Enter moves to it.
                    if ((e.ctrlKey || e.metaKey) && hits[0] && searching) openEntry(hits[0].entry);
                    else focusFirstResult(resultsRef.current);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (query) setQuery('');
                    else clearAll();
                  }
                }}
                className={cn(
                  'h-14 w-full rounded-2xl border border-muted-foreground/85 bg-card ps-12 pe-24 text-16 font-medium text-foreground shadow-sm transition-shadow placeholder:text-muted-foreground sm:h-16 sm:ps-14 sm:text-18',
                  '[&::-webkit-search-cancel-button]:hidden',
                  'outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20',
                )}
              />
              <div className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {query ? (
                  <button
                    type="button"
                    aria-label={t.hero.clear}
                    onClick={() => {
                      setQuery('');
                      focusSearch();
                    }}
                    className={cn('grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground', focusRing)}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                ) : (
                  <Kbd className="me-3 hidden md:inline-flex">/</Kbd>
                )}
              </div>
            </div>

            <div className={cn('mt-3 flex flex-wrap items-center gap-2', 'justify-center')} role="group" aria-label={t.search.filtersLabel}>
              {FILTERS.map((f) => {
                const on = filters.includes(f);
                const Icon = FILTER_ICON[f];
                return (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilters((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-13 font-semibold transition-colors xl:min-h-10',
                      focusRing,
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {on ? (
                      <Check aria-hidden className="size-4" />
                    ) : f === 'changed' ? (
                      <span aria-hidden className="size-2 rounded-full bg-primary ring-2 ring-primary/20" />
                    ) : Icon ? (
                      <Icon aria-hidden className={cn('size-4', f === 'risk' ? 'text-destructive' : f === 'proposed' ? 'text-accent-violet' : 'text-warning-strong')} />
                    ) : null}
                    {t.search.filters[f]}
                    <span className={cn('rounded-full px-1.5 text-12 tabular-nums', on ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>
                      {fmtNumber(counts[f], locale)}
                    </span>
                  </button>
                );
              })}
              <Menu
                label={t.search.sectionMenu}
                trigger={
                  <button
                    type="button"
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-13 font-semibold transition-colors xl:min-h-10',
                      focusRing,
                      section ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:bg-muted',
                    )}
                  >
                    {section ? sectionLabel : t.search.bySection}
                    <ChevronDown aria-hidden className="size-4" />
                  </button>
                }
                items={[
                  { label: t.search.allSections, icon: section === null ? <Check /> : <span className="size-4" />, onSelect: () => setSection(null) },
                  ...SETTINGS_SECTIONS.map((s) => {
                    const Icon = iconFor(s.icon);
                    return { label: loc(s.title, locale), icon: section === s.id ? <Check /> : <Icon />, onSelect: () => setSection(s.id) };
                  }),
                  { label: loc(PREFS_TITLE, locale), icon: section === 'prefs' ? <Check /> : <PaletteIcon />, onSelect: () => setSection('prefs') },
                ]}
              />
              {(filters.length > 0 || section) && (
                <button
                  type="button"
                  onClick={clearAll}
                  className={cn('min-h-11 rounded-full px-3 text-13 font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline xl:min-h-10', focusRing)}
                >
                  {t.search.clearFilters}
                </button>
              )}
            </div>

            <p id="search-hints" className={cn('mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1 text-12 text-muted-foreground md:flex', 'justify-center')}>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>/</Kbd> {t.search.hints.focus}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> {t.search.hints.move}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Enter</Kbd> {t.search.hints.open}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> {t.search.hints.openGroup}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>Esc</Kbd> {t.search.hints.clear}
              </span>
            </p>
          </div>
        </div>

        <p id="search-status" role="status" aria-live="polite" className={cn(searching ? 'mt-3 px-1 text-14 text-muted-foreground' : 'sr-only')}>
          {searching && (
            <>
              <span className="font-semibold text-foreground">{t.n.results(hits.length)}</span>
              {grouped.length > 0 && ` ${t.search.inGroups(grouped.length)}`}
              {hiddenHits > 0 && (
                <span className="ms-2 inline-flex items-center gap-1">
                  <Lock aria-hidden className="size-3.5" />
                  {t.search.hidden(hiddenHits)}
                </span>
              )}
            </>
          )}
        </p>

        <AnimatePresence mode="wait" initial={false}>
          {searching ? (
            <motion.div
              key="results"
              id="search-results"
              ref={resultsRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onKeyDown={(e) => onResultsKeyDown(e, focusSearch)}
              className="mt-4 grid gap-8 xl:grid-cols-[minmax(0,1fr)_15rem]"
            >
              <div className="min-w-0">
                {hits.length ? (
                  <ResultGroups groups={grouped} query={query} />
                ) : (
                  <NoResults
                    query={query.trim()}
                    hasFilters={filters.length > 0 || !!section}
                    onClearFilters={clearAll}
                    onTry={(q) => {
                      setQuery(q);
                      clearAll();
                      focusSearch();
                    }}
                  />
                )}
              </div>
              {hits.length > 0 && (
                <aside aria-label={t.search.facets} className="hidden xl:block">
                  <div className="sticky top-[calc(var(--settings-sticky-top,0px)+12rem)] rounded-2xl border border-border bg-card p-2">
                    <p className="px-2 pb-1 pt-1.5 text-12 font-semibold text-muted-foreground">{t.search.facets}</p>
                    <ul>
                      {[...SETTINGS_SECTIONS.map((s) => ({ id: s.id as string, title: s.title, icon: s.icon })), { id: 'prefs', title: PREFS_TITLE, icon: 'Palette' }].map((s) => {
                        const n = hits.filter((h) => h.entry.sectionId === s.id).length;
                        const Icon = iconFor(s.icon);
                        const on = section === s.id;
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              aria-pressed={on}
                              disabled={!n && !on}
                              onClick={() => setSection(on ? null : s.id)}
                              className={cn(
                                'flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-start text-13 disabled:opacity-45',
                                focusRing,
                                on ? 'bg-primary/12 font-semibold text-foreground dark:bg-primary/25' : 'hover:bg-muted',
                              )}
                            >
                              <Icon aria-hidden className="size-4 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{loc(s.title, locale)}</span>
                              <span className="text-12 tabular-nums text-muted-foreground">{fmtNumber(n, locale)}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </aside>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-6 flex flex-col gap-10 sm:mt-10"
              ref={resultsRef}
              onKeyDown={(e) => onResultsKeyDown(e, focusSearch)}
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 flex-col gap-8">
                  <PinnedBlock />
                  <RecentBlock />
                </div>
                <div className="min-w-0">
                  <AttentionBlock />
                </div>
              </div>
              <IndexBlock />
              {hiddenTotal > 0 && (
                <p className="flex items-center gap-2 text-13 text-muted-foreground">
                  <Lock aria-hidden className="size-4" />
                  {t.search.hiddenTotal(hiddenTotal)}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
