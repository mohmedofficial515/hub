import { useRef, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpDown, Check, ChevronDown, SlidersHorizontal, Sparkles, Tag, Zap, type LucideIcon } from 'lucide-react';
import { DropdownMenu, Switch } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import type { HighlightKey, OfferSort } from '../mock';
import { Amount } from './money';
import { durationOf } from './model';

const CELLS: { key: HighlightKey; icon: LucideIcon; tone: string }[] = [
  { key: 'best', icon: Sparkles, tone: 'text-highlight-ink' },
  { key: 'price', icon: Tag, tone: 'text-brand-ink' },
  { key: 'duration', icon: Zap, tone: 'text-brand-ink' },
];

type Highlight = { total: string; durationMinutes: number };

/**
 * The strip above the list. The three answers people ask for (best, cheapest, fastest) are the sort control itself,
 * each with its price, so ordering is one tap and never hidden (L-12). Below it: what the prices mean, the bag
 * switch that re-prices every card, the rarer orders, and the filter entry.
 */
export function ResultsStrip({
  sort,
  onSort,
  highlights,
  currency,
  withBag,
  onWithBag,
  countLabel,
  priceNote,
  filterCount,
  onOpenFilters,
}: {
  sort: OfferSort;
  onSort: (sort: OfferSort) => void;
  highlights: Record<HighlightKey, Highlight>;
  currency: string;
  withBag: boolean;
  onWithBag: (on: boolean) => void;
  countLabel: string;
  priceNote: string;
  filterCount: number;
  onOpenFilters: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cellOn = CELLS.findIndex((c) => c.key === sort);
  const moreOn = sort === 'departure' || sort === 'arrival';

  const onKey = (e: KeyboardEvent, index: number) => {
    const forward = locale === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    const back = locale === 'ar' ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === forward) next = (index + 1) % CELLS.length;
    else if (e.key === back) next = (index - 1 + CELLS.length) % CELLS.length;
    else return;
    e.preventDefault();
    onSort(CELLS[next].key);
    refs.current[next]?.focus();
  };

  return (
    <section aria-label={t.strip.label} className="space-y-3">
      <div role="radiogroup" aria-label={t.strip.label} className="grid grid-cols-3 overflow-hidden rounded-2xl border border-border bg-card">
        {CELLS.map(({ key, icon: Icon, tone }, index) => {
          const isOn = sort === key;
          const h = highlights[key];
          return (
            <button
              key={key}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isOn}
              tabIndex={isOn || (cellOn === -1 && index === 0) ? 0 : -1}
              onClick={() => onSort(key)}
              onKeyDown={(e) => onKey(e, index)}
              title={key === 'best' ? t.strip.bestHint : undefined}
              className={cn(
                'relative flex min-h-20 min-w-0 cursor-pointer flex-col items-start px-3 py-3 text-start outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5',
                index > 0 && 'border-s border-border',
                !isOn && 'hover:bg-surface-2',
              )}
            >
              {/* The selection is a 2px navy frame plus a tint that glides between cells; the text never moves. */}
              {isOn && (
                <motion.span
                  layoutId="strip-selection"
                  aria-hidden
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42 }}
                  className="absolute inset-0 rounded-[inherit] border-2 border-brand bg-brand-soft"
                />
              )}
              <span className="relative flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Icon className={cn('size-4 shrink-0', tone)} aria-hidden />
                <span className={cn('truncate', isOn && 'text-brand-ink')}>{t.strip[key]}</span>
              </span>
              <Amount
                amount={h.total}
                currency={currency}
                locale={locale}
                className="relative mt-1 text-base font-bold text-brand-ink sm:text-xl"
                currencyClassName="text-[0.65em]"
              />
              <span className="relative text-xs text-ink-muted tnum" title={t.strip.durationNote}>
                {durationOf(h.durationMinutes, locale)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="min-w-0 flex-1 basis-full text-sm text-ink sm:basis-auto" aria-live="polite">
          <span className="font-semibold text-brand-ink">{countLabel}</span>
          <span className="text-ink-muted">. {priceNote}</span>
        </p>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-ink" title={t.strip.bagToggleHint}>
          <Switch.Root
            checked={withBag}
            onCheckedChange={onWithBag}
            aria-describedby="bag-hint"
            className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border-strong bg-surface-3 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=checked]:border-brand data-[state=checked]:bg-brand"
          >
            <Switch.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-card shadow-md transition-transform duration-150 data-[state=checked]:translate-x-[1.05rem] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.05rem]" />
          </Switch.Root>
          {t.strip.bagToggle}
          <span id="bag-hint" className="sr-only">
            {t.strip.bagToggleHint}
          </span>
        </label>

        <div className="ms-auto flex items-center gap-2">
          <DropdownMenu.Root dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <DropdownMenu.Trigger
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                moreOn ? 'border-2 border-brand bg-brand-soft text-brand-ink' : 'border-border-strong bg-card text-ink hover:bg-surface-2',
              )}
            >
              <ArrowUpDown className="size-4" aria-hidden />
              {moreOn ? t.strip.moreSorts[sort] : t.strip.more}
              <ChevronDown className="size-4 text-ink-muted" aria-hidden />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="fr z-40 min-w-52 rounded-2xl border border-border bg-popover p-1.5 text-sm text-ink shadow-xl"
              >
                <DropdownMenu.RadioGroup value={sort} onValueChange={(v) => onSort(v as OfferSort)}>
                  {(['departure', 'arrival'] as const).map((s) => (
                    <DropdownMenu.RadioItem
                      key={s}
                      value={s}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 outline-none data-[highlighted]:bg-surface-2 data-[state=checked]:font-semibold data-[state=checked]:text-brand-ink"
                    >
                      <span className="flex size-4 items-center justify-center">
                        <DropdownMenu.ItemIndicator>
                          <Check className="size-4" aria-hidden />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      {t.strip.moreSorts[s]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            type="button"
            onClick={onOpenFilters}
            aria-label={filterCount ? t.strip.filtersCount(filterCount) : t.strip.filters}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border-strong bg-card px-3 text-sm font-semibold text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {t.strip.filters}
            {filterCount > 0 && (
              <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground tnum">
                {filterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
