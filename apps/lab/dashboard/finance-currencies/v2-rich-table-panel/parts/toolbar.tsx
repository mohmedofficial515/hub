import type { ReactNode } from 'react';
import { ArrowDownUp, FileDown, Rows2, Rows3, Rows4, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@lab/utils';
import { Button } from '@dash/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@dash/components/ui/dropdown-menu';
import type { CurrencyMessages } from '../i18n';
import { COLUMNS, TAB_ORDER, type ColId, type Tab } from './columns';
import type { Meta } from './derive';
import { Ltr, Tip } from './ui';

export type Filter = 'all' | 'visible' | 'hidden' | 'stale' | 'pinned' | 'displayOnly';
export type Density = 'comfortable' | 'standard' | 'compact';
export type SortId = 'currency' | ColId;
export interface Sort {
  id: SortId;
  dir: 'asc' | 'desc';
}

export const FILTERS: Filter[] = ['all', 'visible', 'hidden', 'stale', 'pinned', 'displayOnly'];

export function matchesFilter(m: Meta, f: Filter) {
  switch (f) {
    case 'visible':
      return !m.hidden;
    case 'hidden':
      return m.hidden;
    case 'stale':
      return m.stale;
    case 'pinned':
      return !!m.pin;
    case 'displayOnly':
      return m.displayOnly;
    default:
      return true;
  }
}

/** Same dot colours as the DataGrid quick filters (TONE_DOT). */
const DOT: Partial<Record<Filter, string>> = {
  visible: 'bg-emerald-500',
  hidden: 'bg-slate-400',
  stale: 'bg-teal-500',
  pinned: 'bg-blue-500',
  displayOnly: 'bg-muted-foreground',
};

const DENSITY_ICON = { comfortable: Rows2, standard: Rows3, compact: Rows4 } as const;

/** DataGrid icon-only toolbar button: h-9 rounded-lg outline, label in a tooltip. */
function ToolbarIconButton({ icon: Icon, label, onClick }: { icon: typeof FileDown; label: string; onClick?: () => void }) {
  return (
    <Tip label={label}>
      <Button variant="outline" size="icon" className="relative size-9 rounded-lg" onClick={onClick} aria-label={label}>
        <Icon className="size-4" />
      </Button>
    </Tip>
  );
}

interface Props {
  t: CurrencyMessages;
  search: string;
  onSearch: (v: string) => void;
  tab: Tab;
  onTab: (t: Tab) => void;
  filter: Filter;
  onFilter: (f: Filter) => void;
  counts: Record<Filter, number>;
  density: Density;
  onDensity: (d: Density) => void;
  hiddenCols: Set<ColId>;
  onToggleCol: (id: ColId) => void;
  onExport: () => void;
  sort: Sort;
  onSort: (s: Sort) => void;
  showTabs: boolean;
  /** Primary page action in the grid header (DataGrid `gridAction` slot). */
  gridAction?: ReactNode;
}

/** Toolbar laid out exactly like DataGrid: header bar (title, description, actions) then search + quick filters. */
export function Toolbar(p: Props) {
  const { t } = p;
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-11 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      active
        ? 'border-primary/60 bg-primary/10 text-primary-text'
        : 'border-border/60 bg-transparent text-muted-foreground hover:border-border hover:text-foreground',
    );
  const count = (active: boolean) =>
    cn(
      'min-w-[14px] rounded-full px-1 text-center text-9 font-bold tabular-nums',
      active ? 'bg-primary/15 text-primary-text' : 'bg-muted-foreground/10 text-muted-foreground',
    );

  return (
    <div className="flex min-w-0 flex-col">
      {/* header bar */}
      <div className="flex flex-col items-start justify-between gap-3 border-b border-border/60 bg-muted/50 px-5 py-4 md:flex-row">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-15 font-bold leading-tight text-primary-text">{t.grid.title}</h2>
          <p className="text-12 text-muted-foreground">{t.grid.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {p.showTabs && (
            <div role="tablist" aria-label={t.tabs.label} className="flex h-9 shrink-0 items-center rounded-lg border border-input p-0.5">
              {TAB_ORDER.map((id) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  id={`cur-tab-${id}`}
                  aria-selected={p.tab === id}
                  onClick={() => p.onTab(id)}
                  className={cn(
                    'h-full rounded-md px-3 text-12 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    p.tab === id ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.tabs[id]}
                </button>
              ))}
            </div>
          )}
          <DropdownMenu>
            <Tip label={t.viewOptions}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="relative size-9 rounded-lg max-md:hidden" aria-label={t.viewOptions}>
                  <SlidersHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </Tip>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel>{t.density.label}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={p.density} onValueChange={(v) => p.onDensity(v as Density)}>
                {(Object.keys(DENSITY_ICON) as Density[]).map((d) => {
                  const Icon = DENSITY_ICON[d];
                  return (
                    <DropdownMenuRadioItem key={d} value={d}>
                      <Icon /> {t.density[d]}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t.columnsHint}</DropdownMenuLabel>
              {COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={!p.hiddenCols.has(c.id)}
                  onCheckedChange={() => p.onToggleCol(c.id)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {t.col[c.id]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarIconButton icon={FileDown} label={t.export} onClick={p.onExport} />
          {p.gridAction}
        </div>
      </div>

      {/* search + quick filters (+ column-set tabs and mobile sort in the same row) */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-5 pt-3.5">
        <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
          <div className="flex h-9 items-center overflow-hidden rounded-lg border border-input max-sm:w-full transition-[border-color,box-shadow] duration-150 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-ring/40">
            <span className="pointer-events-none flex shrink-0 items-center ps-3 text-muted-foreground">
              <Search className="size-3.5" />
            </span>
            <input
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              placeholder={t.search}
              aria-label={t.searchLabel}
              type="search"
              autoComplete="off"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent max-sm:w-auto sm:w-[260px] sm:flex-none px-2 text-13 outline-none placeholder:text-12 placeholder:text-muted-foreground/55  [&::-webkit-search-cancel-button]:hidden"
            />
            {p.search && (
              <button
                type="button"
                onClick={() => p.onSearch('')}
                aria-label={t.empty.reset}
                className="me-1 flex shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* mobile sort (the table sorts from its header) */}
          <div className="flex items-center gap-1 md:hidden">
            <label className="sr-only" htmlFor="cur-sort">
              {t.sortBy}
            </label>
            <div className="relative">
              <ArrowDownUp className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <select
                id="cur-sort"
                value={p.sort.id}
                onChange={(e) => p.onSort({ id: e.target.value as SortId, dir: p.sort.dir })}
                className="h-9 appearance-none rounded-lg border border-input bg-background ps-8 pe-3 text-13 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="currency">{t.col.currency}</option>
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t.col[c.id]}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-lg"
              aria-label={p.sort.dir === 'asc' ? t.sortDir.asc : t.sortDir.desc}
              onClick={() => p.onSort({ ...p.sort, dir: p.sort.dir === 'asc' ? 'desc' : 'asc' })}
            >
              <Ltr className="text-14 font-bold">{p.sort.dir === 'asc' ? '↑' : '↓'}</Ltr>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }} role="group" aria-label={t.filters.label}>
          <span className="me-1 h-4 w-px shrink-0 bg-border" />
          {FILTERS.map((f) => {
            const active = p.filter === f;
            return (
              <button key={f} type="button" aria-pressed={active} onClick={() => p.onFilter(f)} className={chip(active)}>
                {DOT[f] && <span className={cn('size-1.5 shrink-0 rounded-full', DOT[f])} />}
                <span>{t.filters[f]}</span>
                <span className={count(active)}>{p.counts[f].toLocaleString('en-US')}</span>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
