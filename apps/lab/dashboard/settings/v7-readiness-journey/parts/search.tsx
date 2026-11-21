// Field-level search (labels, help, keys and values, Arabic + English): results carry their path and open the group
// with the field highlighted. Combobox + listbox pattern, keyboard first.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, SearchX, ServerCog, X } from 'lucide-react';
import { searchFields, type FlatField, type SectionId, SETTINGS_SECTIONS } from '@lab/mocks/settings';
import { cn } from '@lab/utils';
import { canSeeField, findField, L, sectionOf } from './data';
import { useFmt, useNav } from './nav';
import { effectiveValue, useSettings } from './store';
import { Pill } from './ui';

const LIMIT = 40;

/** Highlights whole words: splitting an Arabic word into two elements breaks its letter joining. */
function Mark({ text, query }: { text: string; query: string }) {
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  let start = i;
  let end = i + query.length;
  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/[\s(،,]/.test(text[end])) end += 1;
  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded bg-warning/40 text-foreground">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function SettingsSearch({ className }: { className?: string }) {
  const { state, t, lang } = useSettings();
  const nav = useNav();
  const fmt = useFmt();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [section, setSection] = useState<SectionId | 'all'>('all');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const q = query.trim();

  const all = useMemo(() => (q ? searchFields(q).filter((f) => canSeeField(f.groupKey, f.key, state.role)) : []), [q, state.role]);
  const counts = useMemo(() => {
    const map = new Map<SectionId, number>();
    all.forEach((f) => map.set(f.sectionId, (map.get(f.sectionId) ?? 0) + 1));
    return map;
  }, [all]);
  const results = section === 'all' ? all : all.filter((f) => f.sectionId === section);
  const shown = results.slice(0, LIMIT);

  useEffect(() => setActive(0), [q, section]);
  useEffect(() => {
    if (section !== 'all' && !counts.get(section)) setSection('all');
  }, [counts, section]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const pick = (f: FlatField) => {
    setOpen(false);
    inputRef.current?.blur();
    nav.group(f.groupKey, f.key);
  };

  const expanded = open && q.length > 0;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t.search.label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={expanded}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={expanded && shown.length ? `${listId}-opt-${active}` : undefined}
          value={query}
          placeholder={t.search.placeholder}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, shown.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && shown[active]) {
              e.preventDefault();
              pick(shown[active]);
            } else if (e.key === 'Escape') {
              if (expanded) setOpen(false);
              else setQuery('');
            }
          }}
          className="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-12 text-15 shadow-xs outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {query ? (
          <button
            type="button"
            aria-label={t.search.clear}
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute end-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <p className="text-13 font-semibold" aria-live="polite">
              {t.search.results(all.length)}
            </p>
            <p className="hidden items-center gap-1 text-12 text-muted-foreground md:flex">
              <CornerDownLeft className="size-3.5" aria-hidden />
              {t.search.keys}
            </p>
          </div>
          {all.length ? (
            <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2 [scrollbar-width:thin]">
              <SectionChip active={section === 'all'} onClick={() => setSection('all')} label={t.search.allSections} n={all.length} />
              {SETTINGS_SECTIONS.filter((s) => counts.get(s.id)).map((s) => (
                <SectionChip key={s.id} active={section === s.id} onClick={() => setSection(s.id)} label={L(s.title, lang)} n={counts.get(s.id) ?? 0} />
              ))}
            </div>
          ) : null}
          {shown.length ? (
            <ul id={`${listId}-list`} role="listbox" aria-label={t.search.label} className="max-h-[min(60vh,28rem)] overflow-y-auto py-1">
              {shown.map((f, i) => {
                const hit = findField(f.groupKey, f.key);
                const value = hit ? fmt(hit.field, effectiveValue(state, f.groupKey, f.key)) : '';
                return (
                  <li
                    key={f.id}
                    id={`${listId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onPointerMove={() => setActive(i)}
                    onClick={() => pick(f)}
                    className={cn('mx-1 flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5', i === active && 'bg-muted')}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-14 font-semibold">
                        <Mark text={L(f.label, lang)} query={q} />
                        {f.proposed ? (
                          <Pill tone="violet" icon={<ServerCog />}>
                            {t.badge.proposed}
                          </Pill>
                        ) : null}
                      </p>
                      <p className="truncate text-12 text-muted-foreground">
                        {L(sectionOf(f.sectionId).title, lang)} › {L(f.groupTitle, lang)} › {L(f.subsectionTitle, lang)}
                      </p>
                    </div>
                    <span className="mt-0.5 max-w-[40%] shrink-0 truncate rounded-md bg-muted px-2 py-0.5 text-12 font-semibold text-muted-foreground">
                      <span className="sr-only">{t.search.current}: </span>
                      <bdi>{value}</bdi>
                    </span>
                  </li>
                );
              })}
              {results.length > LIMIT ? <li className="px-4 py-2 text-12 text-muted-foreground">{t.search.more(results.length - LIMIT)}</li> : null}
            </ul>
          ) : (
            <div id={`${listId}-list`} className="grid place-items-center gap-2 px-6 py-10 text-center">
              <SearchX className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-14 font-semibold">{t.search.none(q)}</p>
              <p className="max-w-[44ch] text-13 text-muted-foreground">{t.search.noneHint}</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SectionChip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-12 font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span className="tabular-nums opacity-80">{n}</span>
    </button>
  );
}
