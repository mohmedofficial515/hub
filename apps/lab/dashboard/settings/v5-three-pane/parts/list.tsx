import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, Crown, LayoutGrid, Search, SearchX, X } from 'lucide-react';
import { PREFERENCES, SETTINGS_GROUPS, SETTINGS_SECTIONS, type SettingsGroup } from '@lab/mocks/settings';
import { cn } from './cn';
import { fieldsOf, groupByKey, readable, same, search, type FieldFlag, type Hit } from './lib';
import { useStore } from './store';
import { Icon, listKeys, Pill, StateDot } from './ui';

export type GroupState = 'on' | 'off' | 'attention' | 'new' | 'ok' | 'pending';

export function useGroupState() {
  const s = useStore();
  return (g: SettingsGroup): { state: GroupState; label: string } => {
    if (s.pending[g.key]) return { state: 'pending', label: s.t.state.pending };
    if (g.attention) return { state: 'attention', label: s.t.state.attention };
    if (!g.inDashboard) return { state: 'new', label: s.t.state.new };
    if (g.masterSwitch) {
      const on = s.values[g.key]?.[g.masterSwitch] === true;
      return { state: on ? 'on' : 'off', label: on ? s.t.state.on : s.t.state.off };
    }
    return { state: 'ok', label: g.kind === 'special' ? s.t.state.special : s.t.state.ok };
  };
}

export function changedCount(values: Record<string, unknown>, g: SettingsGroup) {
  return fieldsOf(g).filter((f) => !f.readOnly && !same(values[f.key] as never, f.default)).length;
}

export function SearchBox({ autoFocusHint = true }: { autoFocusHint?: boolean }) {
  const s = useStore();
  const { t } = s;
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={s.searchRef}
          type="search"
          value={s.query}
          onChange={(e) => s.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && s.query) {
              e.stopPropagation();
              s.setQuery('');
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              document.querySelector<HTMLElement>('[data-results] [data-nav]')?.focus();
            }
          }}
          aria-label={t.search.label}
          placeholder={t.search.placeholder}
          className="h-11 w-full rounded-xl border border-input bg-background ps-9 pe-16 text-14 outline-none transition-colors placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
        />
        {s.query ? (
          <button type="button" aria-label={t.search.clear} onClick={() => s.setQuery('')} className="absolute end-0 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden />
          </button>
        ) : autoFocusHint ? (
          <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border bg-muted px-1.5 font-mono text-11 text-muted-foreground md:inline" title={t.search.shortcut}>
            /
          </kbd>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.search.filters}>
        {(['changed', 'proposed', 'risky'] as FieldFlag[]).map((flag) => {
          const on = s.flags.has(flag);
          return (
            <button
              key={flag}
              type="button"
              aria-pressed={on}
              onClick={() => s.toggleFlag(flag)}
              className={cn(
                'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2.5 text-12 font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring lg:min-h-7',
                on ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {t.search[flag]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Column 2: the groups of the chosen section, all groups, preference tabs, or search results. */
/** Counts for the overview row and the landing. */
export function useSettingsStatus() {
  const s = useStore();
  const visible = SETTINGS_GROUPS.filter((g) => !s.hidden(g.key));
  return {
    visible,
    groups: visible.length,
    fields: visible.reduce((n, g) => n + fieldsOf(g).length, 0),
    changed: visible.reduce((n, g) => n + changedCount(s.values[g.key] ?? {}, g), 0),
    attention: visible.filter((g) => g.attention).length,
  };
}

/** A persistent way back to the state summary, with the status in one line. */
export function OverviewRow() {
  const s = useStore();
  const { t } = s;
  const st = useSettingsStatus();
  const on = !s.group && !s.prefTab && !s.section && !s.searching;
  return (
    <button
      type="button"
      data-overview
      aria-current={on ? 'page' : undefined}
      onClick={() => {
        s.clearSearch();
        s.go({ group: null, section: null, prefTab: null, pane: 'home' });
      }}
      className={cn(
        'mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'bg-muted' : 'hover:bg-muted/60',
      )}
    >
      <span className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-card text-primary shadow-sm' : 'bg-muted/70 text-muted-foreground')}>
        <LayoutGrid className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-14', on ? 'font-bold' : 'font-semibold')}>{t.home}</span>
        <span className="block text-12 leading-relaxed text-muted-foreground">
          {t.landing.statusLine(st.groups, st.fields, st.changed)}
          {st.attention ? (
            <>
              {' · '}
              <span className="font-semibold text-warning-strong dark:text-warning">{t.landing.attentionCount(st.attention)}</span>
            </>
          ) : null}
        </span>
      </span>
    </button>
  );
}

export function ListColumn({ header }: { header?: ReactNode }) {
  const s = useStore();
  const { t, locale } = s;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b px-3 pb-2 pt-3">
        {header}
        <SearchBox />
        <OverviewRow />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {s.searching ? (
          <Results />
        ) : s.section === 'prefs' ? (
          <PrefList />
        ) : s.section ? (
          <SectionList id={s.section} />
        ) : (
          <div className="pb-4">
            <p className="px-4 pb-1 pt-4 text-12 font-bold text-muted-foreground">{t.list.allGroups}</p>
            {SETTINGS_SECTIONS.map((sec) => (
              <div key={sec.id}>
                <p className="flex items-center gap-2 px-4 pb-1 pt-3 text-12 font-semibold text-muted-foreground">
                  <Icon name={sec.icon} className="size-3.5" />
                  {sec.title[locale]}
                </p>
                <GroupItems groups={sec.groupKeys.map((k) => groupByKey.get(k)!).filter(Boolean)} compact />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionList({ id }: { id: string }) {
  const s = useStore();
  const { t, locale } = s;
  const sec = SETTINGS_SECTIONS.find((x) => x.id === id);
  if (!sec) return null;
  const groups = sec.groupKeys.map((k) => groupByKey.get(k)!).filter(Boolean);
  const hiddenN = groups.filter((g) => s.hidden(g.key)).length;
  return (
    <div className="pb-4">
      <div className="px-4 pb-2 pt-4">
        <h2 id="v5-list-title" tabIndex={-1} className="flex items-center gap-2 text-16 font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Icon name={sec.icon} className="size-4 text-primary" />
          {sec.title[locale]}
        </h2>
        <p className="mt-0.5 text-12 leading-relaxed text-muted-foreground">{sec.description[locale]}</p>
      </div>
      {groups.length ? <GroupItems groups={groups} /> : <p className="px-4 py-6 text-13 text-muted-foreground">{t.list.empty}</p>}
      {hiddenN ? (
        <p className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-12 text-muted-foreground">
          <Crown className="size-3.5 shrink-0" aria-hidden />
          {t.list.hiddenOwner(hiddenN)}
        </p>
      ) : null}
      <p className="sr-only">{t.list.keyboard}</p>
    </div>
  );
}

export function GroupItems({ groups, compact }: { groups: SettingsGroup[]; compact?: boolean }) {
  const s = useStore();
  const { t, locale } = s;
  const stateOf = useGroupState();
  return (
    <ul className="grid grid-cols-1 gap-0.5 px-2" onKeyDown={listKeys}>
      {groups
        .filter((g) => !s.hidden(g.key))
        .map((g) => {
          const on = s.group === g.key;
          const st = stateOf(g);
          const changed = changedCount(s.values[g.key] ?? {}, g);
          const unsaved = on && s.dirtyCount > 0;
          return (
            <li key={g.key}>
              <button
                type="button"
                data-nav
                data-group={g.key}
                aria-current={on ? 'page' : undefined}
                onClick={() => s.go({ group: g.key, pane: 'editor' })}
                className={cn(
                  'group/item flex w-full items-start gap-3 rounded-xl px-2.5 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  compact ? 'min-h-11 py-2' : 'min-h-16 py-2.5',
                  on ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <span className={cn('mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-card text-primary shadow-sm' : 'bg-muted/70 text-muted-foreground group-hover/item:text-foreground')}>
                  <Icon name={g.icon} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn('truncate text-14 leading-snug', on ? 'font-bold' : 'font-semibold')}>{g.title[locale]}</span>
                    {!g.inDashboard ? <Pill tone="info">{t.state.new}</Pill> : null}
                    <span className="ms-auto flex shrink-0 items-center">
                      <StateDot state={st.state} label={st.label} />
                    </span>
                  </span>
                  {!compact ? <span className="mt-0.5 line-clamp-1 text-12 text-muted-foreground">{g.summary[locale]}</span> : null}
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-11 text-muted-foreground">
                    <span className="tabular-nums">v{s.versions[g.key]}</span>
                    {changed ? <span className="tabular-nums">· {t.list.changed(changed)}</span> : null}
                    {unsaved ? <Pill tone="warning">{t.list.unsaved}</Pill> : null}
                    {st.state === 'pending' ? <Pill tone="warning">{t.state.pending}</Pill> : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
    </ul>
  );
}

function PrefList() {
  const s = useStore();
  const { t, locale } = s;
  return (
    <div className="pb-4">
      <div className="px-4 pb-2 pt-4">
        <h2 id="v5-list-title" tabIndex={-1} className="text-16 font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.prefs.title}</h2>
        <p className="mt-0.5 text-12 text-muted-foreground">{t.prefsHint}</p>
      </div>
      <ul className="grid grid-cols-1 gap-0.5 px-2" onKeyDown={listKeys}>
        {PREFERENCES.map((tab) => {
          const on = s.prefTab === tab.id && !s.group;
          return (
            <li key={tab.id}>
              <button
                type="button"
                data-nav
                aria-current={on ? 'page' : undefined}
                onClick={() => s.go({ group: null, section: 'prefs', prefTab: tab.id, pane: 'editor' })}
                className={cn('flex min-h-16 w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'bg-muted' : 'hover:bg-muted/60')}
              >
                <span className={cn('mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg', on ? 'bg-card text-primary shadow-sm' : 'bg-muted/70 text-muted-foreground')}>
                  <Icon name={tab.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-14', on ? 'font-bold' : 'font-semibold')}>{tab.title[locale]}</span>
                  <span className="mt-0.5 line-clamp-1 text-12 text-muted-foreground">{tab.description[locale]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Mark({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  // A <mark> inside an Arabic word breaks the letter joining, so only Latin text gets an inline highlight.
  const i = q && !/[؀-ۿ]/.test(text) ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-warning/30 px-0.5 text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const LIMIT = 120;

export function Results() {
  const s = useStore();
  const { t, locale } = s;
  const hits = useMemo(
    () =>
      search(s.query, s.flags, {
        locale,
        values: (g, f) => s.values[g]?.[f.key] ?? f.value,
        prefValue: s.prefValue,
        hidden: s.hidden,
      }),
    [s.query, s.flags, locale, s.values, s.prefValue, s.hidden],
  );

  const sectionsWithHits = useMemo(() => {
    const map = new Map<string, Hit[]>();
    for (const h of hits.slice(0, LIMIT)) {
      const k = h.kind === 'pref' ? 'prefs' : h.sectionId!;
      map.set(k, [...(map.get(k) ?? []), h]);
    }
    return map;
  }, [hits]);

  if (!hits.length) {
    return (
      <div className="grid place-items-center px-6 py-14 text-center" role="status">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-6" aria-hidden />
        </span>
        <p className="mt-3 text-15 font-bold">{t.search.none}</p>
        <p className="mt-1 max-w-64 text-13 text-muted-foreground">{t.search.noneHint}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="text-12 text-muted-foreground">{t.search.tryThese}</span>
          {t.search.suggestions.map((w) => (
            <button key={w} type="button" onClick={() => s.setQuery(w)} className="min-h-11 rounded-full border bg-card px-3 text-12 font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:min-h-7">
              {w}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const order = [...SETTINGS_SECTIONS.map((x) => x.id as string), 'prefs'];
  return (
    <div data-results className="pb-6" onKeyDown={listKeys}>
      <p className="px-4 pb-1 pt-3 text-12 font-semibold text-muted-foreground" aria-live="polite">
        {t.search.results(hits.length)}
      </p>
      {order
        .filter((k) => sectionsWithHits.has(k))
        .map((k) => {
          const sec = SETTINGS_SECTIONS.find((x) => x.id === k);
          const list = sectionsWithHits.get(k)!;
          return (
            <div key={k} className="mt-2">
              <p className="flex items-center gap-2 px-4 pb-1 text-12 font-bold text-muted-foreground">
                {sec ? <Icon name={sec.icon} className="size-3.5" /> : null}
                {sec ? sec.title[locale] : t.prefs.title}
                <span className="rounded-full bg-muted px-1.5 text-11 tabular-nums">{list.length}</span>
              </p>
              <ul className="grid grid-cols-1 gap-0.5 px-2">
                {list.map((h) => (
                  <li key={h.id}>
                    <HitRow hit={h} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      {hits.length > LIMIT ? <p className="px-4 pt-3 text-12 text-muted-foreground">{t.search.more(hits.length - LIMIT)}</p> : null}
    </div>
  );
}

function HitRow({ hit }: { hit: Hit }) {
  const s = useStore();
  const { t, locale } = s;
  const sep = <ChevronLeft className="inline size-3 opacity-60 ltr:rotate-180" aria-hidden />;
  if (hit.kind === 'group' && hit.group) {
    return (
      <button
        type="button"
        data-nav
        onClick={() => s.go({ group: hit.group!.key, pane: 'editor' })}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-primary">
          <Icon name={hit.group.icon} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-14 font-bold">
            <Mark text={hit.group.title[locale]} query={s.query} />
          </span>
          <span className="block truncate text-12 text-muted-foreground">{t.search.groups}</span>
        </span>
      </button>
    );
  }
  const f = hit.field!;
  const value = hit.kind === 'pref' ? s.prefValue(hit.prefTab!, f) : s.values[hit.groupKey!]?.[f.key];
  const path =
    hit.kind === 'pref'
      ? [t.prefs.title, hit.subsection?.[locale]]
      : [SETTINGS_SECTIONS.find((x) => x.id === hit.sectionId)?.title[locale], hit.group?.title[locale], hit.subsection?.[locale]];
  return (
    <button
      type="button"
      data-nav
      data-hit={hit.id}
      onClick={() =>
        hit.kind === 'pref'
          ? s.go({ group: null, section: 'prefs', prefTab: hit.prefTab!, field: f.key, pane: 'editor' })
          : s.go({ group: hit.groupKey!, field: f.key, pane: 'editor' })
      }
      className="grid w-full gap-0.5 rounded-xl px-3 py-2.5 text-start outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-14 font-semibold leading-snug">
          <Mark text={f.label[locale]} query={s.query} />
          {f.proposed ? <Pill tone="info" className="ms-1.5 align-middle">{t.field.proposed}</Pill> : null}
        </span>
        <span className="max-w-[45%] shrink-0 truncate text-12 font-semibold text-muted-foreground">
          <bdi>{readable(f, value, t, locale)}</bdi>
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1 text-11 text-muted-foreground">
        {path.filter(Boolean).map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 ? sep : null}
            {p}
          </span>
        ))}
      </span>
    </button>
  );
}
