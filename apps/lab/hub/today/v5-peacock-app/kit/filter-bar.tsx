import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Search, SlidersHorizontal, UserRoundCheck, X } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/ui/hub-cn';
import { setQuery, useRoute } from '../shell/router';
import { Button } from './button';
import { Select } from './form';
import { useMedia } from './hooks';
import { kitMessages } from './i18n';
import { focusRing } from './meta';
import { useRoving } from './roving';
import { Segmented } from './segmented';
import { useSession } from './session';
import { Bidi, fmt } from './text';

export interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface FilterGroup {
  /** The URL query param this group writes (08 §5.2: filters live in the URL). */
  param: string;
  /** The group's name. It is visible, so two "All" chips can never be confused. */
  label: string;
  options: FilterOption[];
  /** Comma-separated values. Default: one value at a time, with an "All" chip. */
  multi?: boolean;
}

export interface SelectFilter {
  param: string;
  label: string;
  /** The option that means "no filter". */
  any: string;
  options: { value: string; label: string }[];
}

export interface ExtraChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Read a filter from the URL: `const status = useFilter('status')`. */
export function useFilter(param: string): string | null {
  return useRoute().query.get(param);
}

/** Read a multi filter from the URL as a list. */
export function useFilterList(param: string): string[] {
  return (useRoute().query.get(param) ?? '').split(',').filter(Boolean);
}

// ── Chips ────────────────────────────────────────────────────────────────────────────────────────

const chipClass = (active: boolean) =>
  cn(
    'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-body-sm font-medium transition-colors duration-120 md:h-8',
    active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
    focusRing,
  );

/** Named chips, one Tab stop. Also used outside `FilterBar` (the Onboarding role preview). */
export function ChipGroup({ label, showLabel = true, options, isActive, onPick, className }: { label: string; showLabel?: boolean; options: FilterOption[]; isActive: (value: string) => boolean; onPick: (value: string) => void; className?: string }) {
  const id = useId();
  const { root, groupProps, itemProps } = useRoving(options.findIndex((o) => isActive(o.value)));
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2', className)}>
      {showLabel && (
        <span id={id} className="shrink-0 text-body-sm text-muted-foreground">
          {label}
        </span>
      )}
      <div ref={root} role="toolbar" aria-label={showLabel ? undefined : label} aria-labelledby={showLabel ? id : undefined} {...groupProps} className="flex min-w-0 flex-wrap gap-1.5">
        {options.map((option, i) => {
          const active = isActive(option.value);
          return (
            <button key={option.value} type="button" aria-pressed={active} {...itemProps(i)} onClick={() => onPick(option.value)} className={chipClass(active)}>
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Mine ─────────────────────────────────────────────────────────────────────────────────────────

const mineKey = (page: string, memberId: string) => `hub-v5:mine:${page}:${memberId}`;

function readMine(page: string, memberId: string) {
  try {
    return localStorage.getItem(mineKey(page, memberId));
  } catch {
    return null;
  }
}

/** Only an explicit choice is written: a link that arrives with the filter on does not change what the member chose. */
export function rememberMine(page: string, memberId: string, on: boolean) {
  try {
    localStorage.setItem(mineKey(page, memberId), on ? '1' : '0');
  } catch {
    /* A blocked store only loses the remembered choice. */
  }
}

function MineToggle({ page, param, value }: { page: string; param: string; value: string }) {
  const t = useT(kitMessages);
  const { me } = useSession();
  const { query } = useRoute();
  const on = query.get(param) === value;
  useLayoutEffect(() => {
    if (!query.has(param) && readMine(page, me.id) === '1') setQuery({ [param]: value });
    // Once, on arrival. After that the toggle decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        rememberMine(page, me.id, !on);
        setQuery({ [param]: on ? null : value });
      }}
      className={chipClass(on)}
    >
      <UserRoundCheck aria-hidden className="size-3.5" strokeWidth={1.75} />
      {t.filters.mine}
    </button>
  );
}

// ── The bar ──────────────────────────────────────────────────────────────────────────────────────

function GroupChips({ group }: { group: FilterGroup }) {
  const t = useT(kitMessages);
  const { query } = useRoute();
  const current = (query.get(group.param) ?? '').split(',').filter(Boolean);
  const ALL = '__all';
  const options = group.multi ? group.options : [{ value: ALL, label: t.all }, ...group.options];
  return (
    <ChipGroup
      label={group.label}
      options={options}
      isActive={(value) => (value === ALL ? current.length === 0 : current.includes(value))}
      onPick={(value) => {
        if (value === ALL) return setQuery({ [group.param]: null });
        if (!group.multi) return setQuery({ [group.param]: current[0] === value ? null : value });
        const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        setQuery({ [group.param]: next.length ? next.join(',') : null });
      }}
    />
  );
}

/**
 * One filter bar for the whole app (review M6). Always in this order: a status segment, a separate Mine toggle, then "Filters (n)".
 *
 * Everything else (chip groups, selects, search) sits behind that button. `collapse="always"` keeps it there at every width, for
 * Timeline and Tasks, where the stream or board is what the page is for. `collapse="phone"` shows it inline from 768 px and folds it
 * below that. While folded, each active filter is a removable chip, so nothing filters the page out of sight.
 *
 * The rule for Mine, on every page: off by default, with mine marked and sorted first. An explicit choice is remembered per member
 * and per page.
 */
export function FilterBar<S extends string = string>({
  status,
  mine,
  groups = [],
  selects = [],
  searchParam,
  searchPlaceholder,
  extra,
  extraChips = [],
  collapse = 'phone',
  openRef,
  className,
}: {
  status?: { label: string; value: S; options: { value: S; label: string; count?: number }[]; onChange: (value: S) => void };
  /** `page` keys the remembered choice. `param` and `value` default to `awaiting=me`. */
  mine?: { page: string; param?: string; value?: string };
  groups?: FilterGroup[];
  selects?: SelectFilter[];
  searchParam?: string;
  searchPlaceholder?: string;
  /** A control the bar does not know how to draw (the Timeline's date range). Pair it with `extraChips`. */
  extra?: ReactNode;
  extraChips?: ExtraChip[];
  collapse?: 'always' | 'phone';
  /** Set to a function that opens the panel and moves focus into it (the Timeline's `f`). */
  openRef?: RefObject<(() => void) | null>;
  className?: string;
}) {
  const t = useT(kitMessages);
  const locale = useLocale();
  const { query } = useRoute();
  const wide = useMedia('(min-width: 768px)');
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const chipRow = useRef<HTMLDivElement>(null);
  const folded = collapse === 'always' || !wide;
  const hasPanel = groups.length > 0 || selects.length > 0 || !!searchParam || !!extra;

  if (openRef) {
    openRef.current = () => {
      setOpen(true);
      requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('button[tabindex="0"], select, input')?.focus());
    };
  }
  useEffect(
    () => () => {
      if (openRef) openRef.current = null;
    },
    [openRef],
  );

  const chips: ExtraChip[] = [
    ...groups.flatMap((group) => {
      const current = (query.get(group.param) ?? '').split(',').filter(Boolean);
      return current.map((value) => ({
        key: `${group.param}:${value}`,
        label: `${group.label}: ${group.options.find((o) => o.value === value)?.label ?? value}`,
        onRemove: () => {
          const next = current.filter((v) => v !== value);
          setQuery({ [group.param]: next.length ? next.join(',') : null });
        },
      }));
    }),
    ...selects.flatMap((select) => {
      const value = query.get(select.param);
      return value ? [{ key: select.param, label: `${select.label}: ${select.options.find((o) => o.value === value)?.label ?? value}`, onRemove: () => setQuery({ [select.param]: null }) }] : [];
    }),
    ...(searchParam && query.get(searchParam) ? [{ key: searchParam, label: `${searchPlaceholder ?? t.search}: ${query.get(searchParam)}`, onRemove: () => setQuery({ [searchParam]: null }) }] : []),
    ...extraChips,
  ];

  const removeChip = (chip: ExtraChip) => {
    chip.onRemove();
    // The chip is gone, so focus goes to its neighbour, or back to the button when it was the last.
    requestAnimationFrame(() => (chipRow.current?.querySelector<HTMLElement>('button') ?? toggle.current)?.focus());
  };

  const showFirstRow = !!status || !!mine || (folded && hasPanel);
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      {showFirstRow && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {status && <Segmented label={status.label} value={status.value} options={status.options} onChange={status.onChange} />}
          {mine && <MineToggle page={mine.page} param={mine.param ?? 'awaiting'} value={mine.value ?? 'me'} />}
          {folded && hasPanel && (
            <Button ref={toggle} size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
              <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
              {chips.length ? fmt(t.filters.openCount, { n: new Intl.NumberFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB').format(chips.length) }) : t.filters.open}
            </Button>
          )}
        </div>
      )}

      {folded && chips.length > 0 && (
        <div ref={chipRow} className="flex min-w-0 flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-label={fmt(t.filters.remove, { name: chip.label })}
              onClick={() => removeChip(chip)}
              className={cn('inline-flex h-11 max-w-full min-w-0 items-center gap-1.5 rounded-full border border-border bg-accent px-3 text-body-sm font-medium text-foreground transition-colors duration-120 hover:bg-muted md:h-7.5', focusRing)}
            >
              <span className="min-w-0 truncate">
                <Bidi>{chip.label}</Bidi>
              </span>
              <X aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}

      {hasPanel && (
        <div
          ref={panel}
          id={panelId}
          hidden={folded && !open}
          className={cn('min-w-0 flex-wrap items-center gap-x-6 gap-y-3', folded && open ? 'flex rounded-lg border border-border bg-card p-3' : !folded ? 'flex' : 'hidden')}
        >
          {groups.map((group) => (
            <GroupChips key={group.param} group={group} />
          ))}
          {selects.map((select) => (
            <label key={select.param} className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
              <span className="shrink-0 text-body-sm text-muted-foreground">{select.label}</span>
              <Select value={query.get(select.param) ?? ''} onChange={(e) => setQuery({ [select.param]: e.target.value || null })} className="w-auto max-w-56 min-w-28 text-body-sm md:h-8">
                <option value="">{select.any}</option>
                {select.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
          ))}
          {extra}
          {searchParam && (
            <label className="relative w-full md:w-60">
              <span className="sr-only">{searchPlaceholder ?? t.search}</span>
              <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
              <input
                dir={query.get(searchParam) ? 'auto' : undefined}
                value={query.get(searchParam) ?? ''}
                onChange={(e) => setQuery({ [searchParam]: e.target.value || null })}
                placeholder={searchPlaceholder ?? t.search}
                className={cn('h-11 w-full rounded-md border border-input bg-card px-9 text-body text-foreground placeholder:text-muted-foreground md:h-9', focusRing)}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
