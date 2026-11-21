/** Field-level search: the box in the top bar and the results page (path, label, live value, help), with filter chips. */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Search, SearchX, X } from 'lucide-react';
import { SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { useBook } from './store';
import { chapterIndex, cleanLabel, docOf, fill, plural, same, search, sectionOfGroup, type Hit, type SearchFilter } from './model';
import { Token } from './sentence';
import { Crumb } from './group-page';
import { GroupIcon } from './icons';

export function SearchBox({ className }: { className?: string }) {
  const { t, query, setQuery, setFilter } = useBook();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div role="search" className={cn('relative', className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={t.ui.searchLabel}
        placeholder={t.ui.searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setQuery('');
            setFilter('all');
          }
        }}
        className="min-h-11 w-full rounded-2xl border border-border bg-card ps-10 pe-11 text-14 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring sm:min-h-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          aria-label={t.ui.clearSearch}
          onClick={() => {
            setQuery('');
            setFilter('all');
            ref.current?.focus();
          }}
          className="absolute inset-y-0 end-1 my-auto flex size-9 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute inset-y-0 end-3 my-auto hidden h-6 items-center rounded-md border border-border px-1.5 text-12 text-muted-foreground sm:flex">/</kbd>
      )}
    </div>
  );
}

/** Highlights the whole word that contains the match, so «ال» and suffixes stay inside the mark. */
function Mark({ text, q }: { text: string; q: string }): ReactNode {
  const needle = q.trim().toLowerCase();
  let i = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (i < 0) return text;
  let end = i + needle.length;
  while (i > 0 && !/[\s،,.:؛()«»"]/.test(text[i - 1])) i -= 1;
  while (end < text.length && !/[\s،,.:؛()«»"]/.test(text[end])) end += 1;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-warning/40 px-0.5 text-foreground dark:bg-warning/30">{text.slice(i, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function SearchResults() {
  const book = useBook();
  const { t, locale, query, filter, setFilter } = book;
  const hits = useMemo(() => {
    const all = search(query).filter((h) => (h.docKey.startsWith('prefs:') ? true : book.canSee(h.docKey) && book.canSeeSubsection(h.docKey, h.subsection.id)));
    const pass = (h: Hit) => {
      const v = book.get(h.docKey, h.field.key);
      switch (filter) {
        case 'changed':
          return !same(v, h.field.default);
        case 'unsaved':
          return book.isDirty(h.docKey, h.field.key);
        case 'proposed':
          return !!h.field.proposed;
        case 'risky':
          return h.field.risk === 'high' || h.field.control === 'security';
        default:
          return !!query.trim();
      }
    };
    return all.filter(pass);
  }, [query, filter, book]);

  const groups = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of hits) map.set(h.docKey, [...(map.get(h.docKey) ?? []), h]);
    return [...map.entries()];
  }, [hits]);

  const filters: SearchFilter[] = ['all', 'changed', 'unsaved', 'proposed', 'risky'];

  return (
    <section aria-labelledby="results-title" className="max-w-[52rem]">
      <h1 id="results-title" className="text-26 font-black">
        {t.ui.resultsTitle}
      </h1>
      <div role="group" aria-label={t.ui.filtersLabel} className="mt-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border px-4 text-13 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9',
              filter === f ? 'border-primary bg-primary/10 text-foreground dark:bg-primary/20' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {t.ui.filters[f]}
          </button>
        ))}
      </div>
      <p className="mt-4 text-14 text-muted-foreground" aria-live="polite">
        {hits.length
          ? fill(t.ui.resultsCount, { fields: plural(hits.length, 'fieldNom', locale, t), groups: plural(groups.length, 'groupGen', locale, t) })
          : ''}
      </p>

      {!hits.length ? (
        <div role="status" className="mt-6 grid justify-items-start gap-3 rounded-3xl border border-border bg-card p-8">
          <SearchX className="size-8 text-muted-foreground" aria-hidden />
          <h2 className="text-20 font-extrabold">{query.trim() ? fill(t.ui.noResultsTitle, { q: query.trim() }) : t.ui.noResultsFilter}</h2>
          {query.trim() ? <p className="text-15 leading-relaxed text-muted-foreground">{t.ui.noResultsHelp}</p> : null}
          <div className="flex flex-wrap items-center gap-2 text-14">
            <span className="text-muted-foreground">{t.ui.tryThese}</span>
            {t.ui.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilter('all');
                  book.setQuery(s);
                }}
                className="min-h-11 rounded-full bg-muted px-3.5 font-semibold outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-8">
          {groups.map(([docKey, list]) => {
            const doc = docOf(docKey)!;
            const section = sectionOfGroup(docKey);
            const prefs = doc.scope === 'prefs';
            return (
              <div key={docKey}>
                <p className="flex flex-wrap items-center gap-1.5 text-13 text-muted-foreground">
                  {prefs ? t.ui.prefs : section ? t.ui.chapters[chapterIndex(section.id)] + ': ' + section.title[locale] : ''}
                  <Crumb />
                  <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                    {doc.group ? <GroupIcon name={doc.group.icon} className="size-4 text-primary" /> : null}
                    {doc.title[locale]}
                  </span>
                </p>
                <ul className="mt-2 divide-y divide-border/70 rounded-2xl border border-border/80 bg-card">
                  {list.map((h) => (
                    <li key={h.field.key} className="grid gap-1 px-4 py-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => book.go(prefs ? { view: 'prefs' } : { view: 'group', key: docKey }, { docKey, fieldKey: h.field.key })}
                          className="min-h-9 rounded-md text-start text-15 font-bold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Mark text={cleanLabel(h.field.label[locale])} q={query} />
                        </button>
                        <p className="text-12 text-muted-foreground">
                          {prefs ? doc.title[locale] : h.subsection.title[locale]}
                          {h.field.proposed ? (locale === 'ar' ? '، ' : ', ') + t.ui.proposed : ''}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-13 leading-relaxed text-muted-foreground">
                          <Mark text={h.field.help[locale]} q={query} />
                        </p>
                      </div>
                      <div className="text-14 leading-[2]">
                        <Token docKey={docKey} fieldKey={h.field.key} mode="static" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export const SECTION_IDS = SETTINGS_SECTIONS.map((s) => s.id);
