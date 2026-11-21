// Field-level search (labels, help, keys, values; Arabic + English) with the path of every result and a deep link.
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@dash/lib/utils';
import { getSection, PREFERENCES, searchFields, SETTINGS_GROUPS, type FlatField } from '@lab/mocks/settings';
import { canonicalId } from './data';
import { formatValue } from './format';
import { useDesk } from './store';
import { Badge, focusRing, Icon } from './ui';

type Result =
  | { kind: 'group'; key: string; groupKey: string }
  | { kind: 'field'; key: string; field: FlatField }
  | { kind: 'pref'; key: string; tab: (typeof PREFERENCES)[number]; fieldKey: string };

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();

export const HIDDEN_FOR_STAFF = new Set(['payment_gateways']);

export function SearchBox() {
  const { t, l, go, role, get, draft } = useDesk();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: Event) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, []);

  const results = useMemo<Result[]>(() => {
    const query = fold(q);
    if (!query) return [];
    const hidden = (key: string) => role === 'staff' && HIDDEN_FOR_STAFF.has(key);
    const groups: Result[] = SETTINGS_GROUPS.filter(
      (g) => !hidden(g.key) && [g.title.ar, g.title.en, g.key, g.summary.ar, g.summary.en].some((s) => fold(s).includes(query)),
    ).map((g) => ({ kind: 'group', key: `g:${g.key}`, groupKey: g.key }));
    const fields: Result[] = searchFields(q)
      .filter((f) => !hidden(f.groupKey) && !(f.groupKey === 'whatsapp_provider' && f.type === 'secret' && role === 'staff'))
      .map((f) => ({ kind: 'field', key: `f:${f.id}`, field: f }));
    const prefs: Result[] = PREFERENCES.flatMap((tab) =>
      tab.fields
        .filter((f) => [f.label.ar, f.label.en, f.help.ar, f.help.en, f.key].some((s) => fold(s).includes(query)))
        .map((f) => ({ kind: 'pref' as const, key: `p:${f.key}`, tab, fieldKey: f.key })),
    );
    return [...groups.slice(0, 5), ...fields.slice(0, 40), ...prefs.slice(0, 5)];
  }, [q, role]);

  const fieldCount = results.filter((r) => r.kind === 'field').length;
  useEffect(() => setActive(0), [q]);

  const choose = (r: Result) => {
    if (r.kind === 'group') go({ v: 'group', g: r.groupKey });
    else if (r.kind === 'field') go({ v: 'group', g: r.field.groupKey, f: r.field.key });
    else go({ v: 'prefs', f: r.fieldKey });
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const Chevron = t.dir === 'rtl' ? ChevronLeft : ChevronRight;
  const path = (parts: string[]) => (
    <span className="flex min-w-0 flex-wrap items-center gap-0.5 text-12 text-muted-foreground">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <Chevron aria-hidden className="size-3" />}
          {p}
        </span>
      ))}
    </span>
  );

  const showPanel = open && q.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative w-full lg:w-[26rem]">
      <label htmlFor="desk-search" className="sr-only">
        {t.search.label}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id="desk-search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && results[active] ? `res-${results[active].key}` : undefined}
          autoComplete="off"
          value={q}
          placeholder={t.search.placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
            else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            else if (e.key === 'Enter' && results[active]) (e.preventDefault(), choose(results[active]));
            else if (e.key === 'Escape') (setOpen(false), setQ(''));
          }}
          className={cn(
            'h-11 w-full rounded-xl border bg-card ps-10 pe-16 text-14 text-foreground placeholder:text-muted-foreground shadow-xs',
            'outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          )}
        />
        {q ? (
          <button
            type="button"
            aria-label={t.search.clear}
            onClick={() => (setQ(''), inputRef.current?.focus())}
            className={cn('absolute end-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground sm:size-8', focusRing)}
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : (
          <kbd aria-hidden className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 text-12 font-semibold text-muted-foreground sm:block">
            /
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-12 text-muted-foreground" aria-live="polite">
            <span>{t.search.results(results.length)}</span>
            {fieldCount > 0 && <span>{t.search.fields}: {fieldCount}</span>}
          </div>
          {results.length === 0 ? (
            <div className="grid gap-3 p-4">
              <p className="text-14 font-semibold">{t.search.none(q)}</p>
              <p className="text-13 text-muted-foreground">{t.search.noneHint}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-12 text-muted-foreground">{t.search.suggestions}:</span>
                {t.search.suggest.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => (setQ(s), inputRef.current?.focus())}
                    className={cn('min-h-11 rounded-full border px-3 text-12 font-semibold hover:bg-muted sm:min-h-8', focusRing)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={t.search.label} className="max-h-[min(60dvh,460px)] overflow-y-auto py-1">
              {results.map((r, i) => {
                const on = i === active;
                const common = {
                  id: `res-${r.key}`,
                  role: 'option' as const,
                  'aria-selected': on,
                  onMouseEnter: () => setActive(i),
                  onMouseDown: (e: MouseEvent) => e.preventDefault(),
                  onClick: () => choose(r),
                  className: cn('mx-1 flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5', on && 'bg-muted'),
                };
                if (r.kind === 'group') {
                  const g = SETTINGS_GROUPS.find((x) => x.key === r.groupKey)!;
                  return (
                    <li key={r.key} {...common}>
                      <Icon name={g.icon} className="mt-0.5 size-4 shrink-0 text-[color:var(--primary)]" />
                      <div className="grid min-w-0 gap-0.5">
                        {path([t.search.groups, getSection(g.section)?.title[l] ?? ''])}
                        <span className="text-14 font-bold">{g.title[l]}</span>
                      </div>
                    </li>
                  );
                }
                if (r.kind === 'pref') {
                  const f = r.tab.fields.find((x) => x.key === r.fieldKey)!;
                  return (
                    <li key={r.key} {...common}>
                      <Icon name={r.tab.icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="grid min-w-0 gap-0.5">
                        {path([t.search.prefs, r.tab.title[l]])}
                        <span className="text-14 font-semibold">{f.label[l]}</span>
                      </div>
                    </li>
                  );
                }
                const f = r.field;
                const g = SETTINGS_GROUPS.find((x) => x.key === f.groupKey)!;
                const id = canonicalId(f);
                return (
                  <li key={r.key} {...common}>
                    <Icon name={g.icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      {path([getSection(f.sectionId)?.title[l] ?? '', g.title[l], f.subsectionTitle[l]])}
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-14 font-semibold">{f.label[l]}</span>
                        {id in draft && <Badge tone="warning">{t.ticket.staged}</Badge>}
                        {f.proposed && <Badge tone="info">{t.field.proposed}</Badge>}
                      </span>
                      <span className="truncate text-12 text-muted-foreground">
                        {t.search.valueNow}: <bdi>{formatValue(f, get(id), l, t)}</bdi>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
