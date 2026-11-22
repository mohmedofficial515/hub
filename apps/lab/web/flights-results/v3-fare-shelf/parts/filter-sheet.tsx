import type { ReactNode, RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { FACETS, ITINERARIES } from '../mock';
import { formatMoney } from './money';
import { NO_FILTERS, type Filters } from './model';

/**
 * The filter entry opens one sheet (from the end side on wide screens, from the bottom on phones). Only the groups
 * the brief touches are drawn; "What the fare allows" is new and uses the facet counts the API already sends
 * (refundable, changeable, checkedBaggageIncluded). Zero-count options are hidden, not shown as "(0)" (L-40).
 */
export function FilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  resultCount,
  matching,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: string;
  /** Itineraries that match the current filters, for "Show 2 flights". */
  matching: number;
  /** The button that opened the sheet: focus goes back to it on close. */
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const airlineName = (code: string) => ITINERARIES.find((i) => i.owner.iataCode === code)?.owner.name[locale] ?? code;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fr fixed inset-0 z-50 bg-(--overlay) fr-fade-in" />
        <Dialog.Content
          dir={dir}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusRef.current?.focus();
          }}
          className="fr fixed inset-x-0 bottom-0 z-60 flex max-h-[88dvh] flex-col rounded-t-3xl border border-border bg-card text-ink shadow-xl outline-none fr-sheet-in md:inset-y-0 md:end-0 md:start-auto md:max-h-none md:w-[24rem] md:rounded-none md:border-y-0 md:border-e-0"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-brand-ink">{t.filters.title}</Dialog.Title>
            <Dialog.Close
              aria-label={t.filters.close}
              className="flex size-11 cursor-pointer items-center justify-center rounded-md text-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{resultCount}</Dialog.Description>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <Group title={t.filters.stops}>
              {FACETS.stops
                .filter((s) => s.count > 0)
                .map((s) => (
                  <Option
                    key={s.value}
                    label={t.filters.stopValue[s.value]}
                    count={s.count}
                    checked={filters.stops.includes(s.value)}
                    onToggle={() => onChange({ ...filters, stops: toggleIn(filters.stops, s.value) })}
                  />
                ))}
            </Group>

            <Group title={t.filters.fareRules}>
              <Option label={t.filters.refundable} count={FACETS.refundable} checked={filters.refundable} onToggle={() => onChange({ ...filters, refundable: !filters.refundable })} />
              <Option label={t.filters.changeable} count={FACETS.changeable} checked={filters.changeable} onToggle={() => onChange({ ...filters, changeable: !filters.changeable })} />
              <Option
                label={t.filters.bagIncluded}
                count={FACETS.checkedBaggageIncluded}
                checked={filters.bagIncluded}
                onToggle={() => onChange({ ...filters, bagIncluded: !filters.bagIncluded })}
              />
            </Group>

            <Group title={t.filters.airlines}>
              {FACETS.airlines.map((a) => (
                <Option
                  key={a.iataCode}
                  label={airlineName(a.iataCode)}
                  hint={t.filters.from(formatMoney(a.minPrice, FACETS.currency, locale))}
                  count={a.count}
                  checked={filters.airlines.includes(a.iataCode)}
                  onToggle={() => onChange({ ...filters, airlines: toggleIn(filters.airlines, a.iataCode) })}
                />
              ))}
            </Group>
          </div>

          <div className="flex items-center gap-3 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={() => onChange(NO_FILTERS)}
              className="min-h-11 cursor-pointer rounded-md px-3 text-sm font-semibold text-brand-ink outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t.filters.clear}
            </button>
            {/* Navy, not teal: the sheet sits over the list, and the list's teal belongs to the shelf. */}
            <Dialog.Close className="ms-auto min-h-11 flex-1 cursor-pointer rounded-md bg-brand px-4 text-sm font-bold text-brand-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">
              {t.filters.showN(matching)}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-brand-ink">{title}</legend>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>
    </fieldset>
  );
}

function Option({ label, hint, count, checked, onToggle }: { label: string; hint?: string; count: number; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-[5px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card',
          checked ? 'border-brand bg-brand text-brand-foreground' : 'border-input bg-card',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-muted tnum">{hint}</span>}
      </span>
      <span className="text-xs text-ink-muted tnum">{count}</span>
    </label>
  );
}
