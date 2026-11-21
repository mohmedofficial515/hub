/**
 * Field-level search (combobox + listbox): labels, help, keys and values in Arabic and English through the mock's
 * folding search, plus group names and personal preferences. Each result shows its path (Section › Group ›
 * Subsection) and current value and deep-links to the field. Filter chips work without a query (VS Code @modified).
 * `/` focuses it from anywhere on the page.
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CornerDownLeft, Search, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { PREFERENCES, allFields, getSection, searchFields, type FlatField } from '@lab/mocks/settings';
import { fill, num, valueText } from './format';
import { fieldLabel, same } from './model';
import { useStore, type PrefTab } from './store';
import { IconTile, Kbd, Pill } from './ui';

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

type Option =
  | { kind: 'group'; id: string; groupKey: string }
  | { kind: 'field'; id: string; field: FlatField }
  | { kind: 'pref'; id: string; tab: PrefTab; key: string };

const MAX_FIELDS = 40;
const SUGGESTIONS = { ar: ['قفل', 'هامش', 'المحفظة', 'webhook'], en: ['lockout', 'markup', 'wallet', 'رمز'] };

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-warning/35 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchBox({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const { t, locale, groups, canSee, go, initialQuery, saved } = useStore();
  const reduce = useReducedMotion();
  const [q, setQ] = useState(size === 'lg' ? initialQuery : '');
  const [open, setOpen] = useState(size === 'lg' && !!initialQuery);
  const [active, setActive] = useState(0);
  const [filters, setFilters] = useState({ changed: false, risk: false, proposed: false });
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const anyFilter = filters.changed || filters.risk || filters.proposed;

  // "/" focuses the search unless the person is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      input.current?.focus();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const results = useMemo(() => {
    const query = q.trim();
    const qf = fold(query);
    const base = query ? searchFields(query) : anyFilter ? allFields() : [];
    const fields = base.filter((f) => {
      if (!canSee(f.groupKey)) return false;
      const value = saved[f.groupKey]?.[f.key];
      if (filters.changed && same(value, f.default)) return false;
      if (filters.risk && f.risk !== 'high') return false;
      if (filters.proposed && !f.proposed) return false;
      return true;
    });
    const groupHits = query && !anyFilter ? groups.filter((g) => [g.title.ar, g.title.en, g.key, g.summary.ar, g.summary.en].some((s) => fold(s).includes(qf))) : [];
    const prefHits =
      query && !anyFilter
        ? PREFERENCES.flatMap((tab) =>
            tab.fields
              .filter((f) => [f.label.ar, f.label.en, f.help.ar, f.help.en, f.key].some((s) => fold(s).includes(qf)))
              .map((f) => ({ tab: tab.id as PrefTab, tabTitle: tab.title, field: f })),
          )
        : [];
    return { fields, groupHits, prefHits };
  }, [q, anyFilter, filters, canSee, saved, groups]);

  const shownFields = results.fields.slice(0, MAX_FIELDS);
  const byGroup = useMemo(() => {
    const map = new Map<string, FlatField[]>();
    for (const f of shownFields) map.set(f.groupKey, [...(map.get(f.groupKey) ?? []), f]);
    return [...map.entries()];
  }, [shownFields]);

  const options: Option[] = useMemo(
    () => [
      ...results.groupHits.map((g) => ({ kind: 'group' as const, id: `${listId}-g-${g.key}`, groupKey: g.key })),
      ...byGroup.flatMap(([, fs]) => fs.map((f) => ({ kind: 'field' as const, id: `${listId}-f-${f.id.replace(/\W/g, '-')}`, field: f }))),
      ...results.prefHits.map((p) => ({ kind: 'pref' as const, id: `${listId}-p-${p.field.key.replace(/\W/g, '-')}`, tab: p.tab, key: p.field.key })),
    ],
    [results, byGroup, listId],
  );

  useEffect(() => setActive(0), [q, filters]);

  const choose = (option: Option | undefined) => {
    if (!option) return;
    setOpen(false);
    input.current?.blur();
    if (option.kind === 'group') go({ view: 'group', group: option.groupKey });
    else if (option.kind === 'field') go({ view: 'group', group: option.field.groupKey, field: option.field.key });
    else go({ view: 'prefs', tab: option.tab });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (q) setQ('');
    }
  };

  useEffect(() => {
    const id = options[active]?.id;
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }, [active, options]);

  const total = results.fields.length + results.groupHits.length + results.prefHits.length;
  const groupCount = new Set([...results.fields.map((f) => f.groupKey), ...results.groupHits.map((g) => g.key)]).size;
  const showPanel = open && (q.trim() !== '' || anyFilter || size === 'lg');
  let index = -1;
  const optionProps = (id: string) => {
    index += 1;
    const i = index;
    return {
      id,
      role: 'option' as const,
      'aria-selected': i === active,
      onMouseEnter: () => setActive(i),
      onMouseDown: (e: ReactMouseEvent) => e.preventDefault(),
      onClick: () => choose(options[i]),
      'data-active': i === active || undefined,
    };
  };

  const chip = (key: keyof typeof filters, label: string) => (
    <button
      type="button"
      aria-pressed={filters[key]}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
      className={cn(
        'inline-flex min-h-11 items-center rounded-full border px-3 text-12 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8',
        filters[key] ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );

  return (
    <div ref={box} className="relative w-full">
      <div
        className={cn(
          'flex w-full items-center gap-2 rounded-2xl border border-input bg-card ps-4 pe-2 shadow-xs transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30',
          size === 'lg' ? 'h-14' : 'h-12',
        )}
      >
        <Search className={cn('shrink-0 text-muted-foreground', size === 'lg' ? 'size-5' : 'size-4')} aria-hidden />
        <input
          ref={input}
          role="combobox"
          aria-label={t.search.label}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && options[active] ? options[active].id : undefined}
          value={q}
          placeholder={t.search.placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn('h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/80', size === 'lg' ? 'text-16' : 'text-14')}
        />
        {q ? (
          <button
            type="button"
            aria-label={t.search.clear}
            onClick={() => {
              setQ('');
              input.current?.focus();
            }}
            className="grid size-11 place-items-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="hidden sm:inline-flex" title={t.search.shortcut}>
            <Kbd>/</Kbd>
          </span>
        )}
      </div>

      <AnimatePresence>
        {showPanel ? (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.14 }}
            className="absolute inset-x-0 top-full z-50 mt-2 flex max-h-[min(72vh,600px)] flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="sr-only">{t.search.filters}</span>
              {chip('changed', t.search.fChanged)}
              {chip('risk', t.search.fRisk)}
              {chip('proposed', t.search.fProposed)}
              <span className="ms-auto text-12 font-semibold text-muted-foreground" aria-live="polite">
                {q.trim() || anyFilter ? (total === 1 ? t.search.resultsOne : fill(t.search.results, { n: num(locale, total), g: num(locale, groupCount) })) : null}
              </span>
            </div>

            <div id={listId} role="listbox" aria-label={t.search.label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {!q.trim() && !anyFilter ? (
                <div className="grid gap-3 px-2 py-3">
                  <p className="text-13 text-muted-foreground">{t.search.noneHint}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-12 font-semibold text-muted-foreground">{t.search.tryLabel}</span>
                    {SUGGESTIONS[locale].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setQ(s)}
                        className="min-h-11 rounded-full bg-muted px-3 text-13 font-semibold outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : total === 0 ? (
                <div className="grid gap-1.5 px-3 py-6 text-center">
                  <p className="text-15 font-bold">{fill(t.search.none, { q: q.trim() })}</p>
                  <p className="text-13 text-muted-foreground">{t.search.noneHint}</p>
                </div>
              ) : (
                <>
                  {results.groupHits.length ? (
                    <Heading>{t.search.groupsHeading}</Heading>
                  ) : null}
                  {results.groupHits.map((g) => (
                    <div key={g.key} {...optionProps(`${listId}-g-${g.key}`)} className={optionClass}>
                      <IconTile name={g.icon} section={g.section} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-14 font-bold">
                          <Highlight text={g.title[locale]} query={q} />
                        </span>
                        <span className="block truncate text-12 text-muted-foreground">{getSection(g.section)?.title[locale]}</span>
                      </span>
                      <CornerDownLeft className="size-4 shrink-0 text-muted-foreground opacity-0 group-data-[active]/opt:opacity-100 rtl:-scale-x-100" aria-hidden />
                    </div>
                  ))}

                  {byGroup.length ? <Heading>{t.search.fieldsHeading}</Heading> : null}
                  {byGroup.map(([groupKey, fields]) => {
                    const g = groups.find((x) => x.key === groupKey)!;
                    return (
                      <Fragment key={groupKey}>
                        <div role="presentation" className="flex items-center gap-2 px-2 pb-1 pt-2.5 text-12 font-bold text-muted-foreground">
                          <IconTile name={g.icon} section={g.section} size="sm" />
                          <span className="truncate">
                            {getSection(g.section)?.title[locale]} › {g.title[locale]}
                          </span>
                        </div>
                        {fields.map((f) => {
                          const value = saved[f.groupKey]?.[f.key];
                          return (
                            <div key={f.id} {...optionProps(`${listId}-f-${f.id.replace(/\W/g, '-')}`)} className={cn(optionClass, 'ps-12')}>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-14 font-semibold">
                                    <Highlight text={fieldLabel(f, locale, t)} query={q} />
                                  </span>
                                  {!same(value, f.default) ? <span aria-hidden className="size-1.5 rounded-full bg-primary" /> : null}
                                  {f.proposed ? <Pill tone="info" className="h-5 px-1.5 text-11">{t.field.proposed}</Pill> : null}
                                  {f.risk === 'high' ? <Pill tone="warning" className="h-5 px-1.5 text-11">{t.field.highRisk}</Pill> : null}
                                </span>
                                <span className="mt-0.5 block truncate text-12 text-muted-foreground">
                                  {f.subsectionTitle[locale]} · <bdi dir="ltr" className="font-mono text-11">{f.key}</bdi>
                                </span>
                              </span>
                              <span className="max-w-[40%] shrink-0 truncate rounded-lg bg-muted px-2 py-1 text-12 font-semibold">
                                <bdi>{valueText(locale, t, f, value ?? null, 3)}</bdi>
                              </span>
                            </div>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {results.fields.length > MAX_FIELDS ? <p className="px-3 py-2 text-12 text-muted-foreground">{fill(t.search.more, { n: num(locale, results.fields.length - MAX_FIELDS) })}</p> : null}

                  {results.prefHits.length ? <Heading>{t.search.prefsHeading}</Heading> : null}
                  {results.prefHits.map((p) => (
                    <div key={p.field.key} {...optionProps(`${listId}-p-${p.field.key.replace(/\W/g, '-')}`)} className={optionClass}>
                      <IconTile name="Palette" section="system" size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-14 font-semibold">
                          <Highlight text={p.field.label[locale]} query={q} />
                        </span>
                        <span className="block truncate text-12 text-muted-foreground">
                          {t.prefs.title} › {p.tabTitle[locale]}
                        </span>
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <p className="hidden border-t border-border px-4 py-2 text-12 text-muted-foreground sm:block">{t.search.keys}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const optionClass =
  'group/opt flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 data-[active]:bg-muted';

function Heading({ children }: { children: ReactNode }) {
  return (
    <p role="presentation" className="px-2 pb-1 pt-3 text-12 font-bold text-foreground/70 first:pt-1">
      {children}
    </p>
  );
}
