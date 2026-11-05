import { useId, useState } from 'react';
import {
  BedDouble,
  ChevronDown,
  CircleDot,
  Coins,
  Gift,
  Loader2,
  Package,
  Plane,
  ReceiptText,
  RotateCcw,
  Search,
  Sparkles,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import type { WalletTransaction } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import {
  buildEntries,
  centsStr,
  groupByMonth,
  matchesFilter,
  type BookingStory,
  type Entry,
  type Filter,
  type Receipt,
} from './ledger';
import { focusRing, Money, SectionTitle } from './shared';

const FILTERS: Filter[] = ['all', 'trips', 'topups', 'refunds', 'points'];

export function TicketStack({
  items,
  hasMore,
  loadingMore,
  onMore,
  openStory,
}: {
  items: WalletTransaction[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  openStory: string | null;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const entries = buildEntries(items);
  const visible = entries.filter((e) => matchesFilter(e, filter));
  const months = groupByMonth(visible, items, hasMore);
  const monthFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { month: 'long', year: 'numeric' });

  return (
    <section aria-labelledby="history-title" className="space-y-5">
      <SectionTitle
        id="history-title"
        title={t.history.title}
        sub={t.history.subtitle}
        icon={<ReceiptText className="size-5" aria-hidden />}
      />

      {items.length === 0 ? (
        <EmptyTicket />
      ) : (
        <>
          <div role="group" aria-label={t.history.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors',
                  filter === f
                    ? 'border-primary bg-primary text-white dark:border-white dark:bg-white dark:text-ocean-deep'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  focusRing,
                )}
              >
                {t.history.filters[f]}
              </button>
            ))}
          </div>

          {months.length === 0 && <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t.history.noMatch}</p>}

          {months.map((m) => (
            <div key={m.key} className="space-y-3">
              <h3 className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
                <span className="text-base font-extrabold text-primary dark:text-white">
                  {monthFmt.format(new Date(`${m.key}-01T12:00:00Z`))}
                </span>
                <span className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    {t.history.in}{' '}
                    <Money value={centsStr(m.inCents)} sign="+" className="font-bold text-emerald-700 dark:text-emerald-300" />
                  </span>
                  <span>
                    {t.history.out}{' '}
                    <Money value={centsStr(m.outCents)} sign="−" className="font-bold text-foreground" />
                  </span>
                  {!m.complete && <span className="italic">· {t.history.soFar}</span>}
                </span>
              </h3>
              <EntryList entries={m.entries} openStory={openStory} />
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => !loadingMore && onMore()}
                aria-disabled={loadingMore || undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-6 text-sm font-bold hover:bg-muted',
                  focusRing,
                )}
              >
                {loadingMore && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden />}
                {loadingMore ? t.history.loadingMore : t.history.more}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Tickets take the full row; consecutive receipts share rows of two, so trips dominate. */
function EntryList({ entries, openStory }: { entries: Entry[]; openStory: string | null }) {
  const chunks: (BookingStory | Receipt[])[] = [];
  for (const e of entries) {
    if (e.kind === 'story') chunks.push(e);
    else {
      const last = chunks[chunks.length - 1];
      if (Array.isArray(last)) last.push(e);
      else chunks.push([e]);
    }
  }
  return (
    <ul className="space-y-3">
      {chunks.map((c, i) =>
        Array.isArray(c) ? (
          <li key={`r${i}`}>
            <ul className="grid gap-3 md:grid-cols-2">
              {c.map((r) => (
                <ReceiptSlip key={r.id} receipt={r} />
              ))}
            </ul>
          </li>
        ) : (
          <BoardingPass key={openStory === c.id ? `${c.id}-open` : c.id} story={c} defaultOpen={openStory === c.id} />
        ),
      )}
    </ul>
  );
}

const STATUS_TONE = {
  held: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
  paid: 'bg-primary/10 text-primary dark:bg-white/10 dark:text-white',
  released: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
} as const;

const KIND_ICON = { flight: Plane, hotel: BedDouble, package: Package } as const;

function BoardingPass({ story, defaultOpen }: { story: BookingStory; defaultOpen: boolean }) {
  const t = useT(messages);
  const locale = useLocale();
  const ids = useId();
  const [open, setOpen] = useState(defaultOpen);
  const time = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { hour: 'numeric', minute: '2-digit' });
  const day = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', { day: 'numeric', month: 'short' });
  const Icon = story.label ? KIND_ICON[story.label.kind] : Wallet;
  const title = story.label?.title[locale] ?? `${t.history.booking} · ${story.id}`;

  return (
    <li
      id={`story-${story.id}`}
      data-txids={story.steps.map((s) => s.id).join(' ')}
      tabIndex={-1}
      className="group/pass relative flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_30px_-22px_rgb(15_23_42/0.5)] outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/60 md:flex-row"
    >
      {/* main body */}
      <div className="flex min-w-0 flex-1 gap-3 p-4 sm:p-5">
        <span
          aria-hidden
          className={cn(
            'grid size-11 shrink-0 place-items-center rounded-xl',
            story.status === 'held'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200'
              : 'bg-primary text-white dark:bg-ocean-deep',
          )}
        >
          <Icon className="size-5 rtl:-scale-x-100" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATUS_TONE[story.status])}>
              {t.history.status[story.status]}
            </span>
            {story.label && (
              <span className="text-xs text-muted-foreground">
                {t.history.kind[story.label.kind]} ·{' '}
                <bdi dir="ltr" className="font-mono">
                  <span translate="no">{story.label.bookingRef}</span>
                </bdi>
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-base font-extrabold text-primary dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.history.statusHint[story.status]}</p>
          <a
            href="#booking"
            className={cn('mt-1 inline-flex min-h-11 items-center text-sm font-bold text-teal-700 underline-offset-4 hover:underline dark:text-secondary', focusRing)}
          >
            {t.history.openBooking}
          </a>
        </div>
        <div className="shrink-0 text-end">
          <Money
            value={story.amount}
            sign={story.status === 'paid' ? '−' : undefined}
            className={cn(
              'block text-lg font-extrabold',
              story.status === 'held' && 'text-amber-700 dark:text-amber-200',
              story.status === 'released' && 'text-muted-foreground line-through decoration-1',
              story.status === 'paid' && 'text-foreground',
            )}
          />
          <span className="text-xs text-muted-foreground">{day.format(new Date(story.at))}</span>
          <span className="mt-2 block text-xs text-muted-foreground">{t.history.balanceAfter}</span>
          <Money value={story.balanceAfter} balance className="text-xs font-bold" />
        </div>
      </div>

      {/* perforation */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed border-border md:h-auto md:w-0 md:border-s-2 md:border-t-0">
        <span className="absolute -start-2.5 -top-2.5 size-5 rounded-full bg-background md:-top-2.5 md:-start-2.5" />
        <span className="absolute -end-2.5 -top-2.5 size-5 rounded-full bg-background md:-bottom-2.5 md:top-auto md:-start-2.5 md:end-auto" />
      </div>

      {/* stub: step tracker */}
      <div className="bg-muted/40 md:w-64 dark:bg-white/[0.03]">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${ids}-steps`}
          onClick={() => setOpen((o) => !o)}
          className={cn('flex min-h-11 w-full items-center justify-between px-4 text-sm font-bold md:hidden', focusRing)}
        >
          {t.history.stepsToggle(story.steps.length)}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        <ol id={`${ids}-steps`} className={cn('space-y-3 px-4 pb-4 md:block md:p-5', open ? 'block' : 'hidden')}>
          {story.missingEarlier && (
            <li className="flex items-center gap-2 text-xs text-muted-foreground italic">
              <CircleDot className="size-3.5" aria-hidden />
              {t.history.missingEarlier}
            </li>
          )}
          {story.steps.map((s, i) => (
            <li key={s.id} className="relative flex items-start gap-3">
              {i < story.steps.length - 1 && (
                <span aria-hidden className="absolute start-[5px] top-4 h-[calc(100%+0.25rem)] w-px bg-border" />
              )}
              <span
                aria-hidden
                className={cn(
                  'mt-1 size-[11px] shrink-0 rounded-full ring-2 ring-card',
                  s.type === 'RESERVE' ? 'bg-amber-500' : s.type === 'RELEASE' ? 'bg-emerald-500' : 'bg-primary dark:bg-white',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="flex justify-between gap-2 text-sm font-bold">
                  {t.history.steps[s.type] ?? s.type}
                  <Money value={s.amount} className="text-xs font-semibold text-muted-foreground" />
                </p>
                <p className="text-xs text-muted-foreground">
                  <bdi>{time.format(new Date(s.createdAt))}</bdi> · {day.format(new Date(s.createdAt))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </li>
  );
}

const RECEIPT_ICON: Record<Receipt['type'], typeof Coins> = {
  topup: Wallet,
  refund: Undo2,
  points: Sparkles,
  opened: Gift,
  adjustment: Coins,
  reversal: RotateCcw,
};

function ReceiptSlip({ receipt }: { receipt: Receipt }) {
  const t = useT(messages);
  const locale = useLocale();
  const { tx } = receipt;
  const Icon = RECEIPT_ICON[receipt.type];
  const credit = tx.direction === 'CREDIT';
  const zero = tx.amount === '0.00';
  const when = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <li
      data-txids={tx.id}
      tabIndex={-1}
      className={cn(
        'relative flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 ps-4 outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/60',
        // zig-zag top edge = paper receipt
        'before:absolute before:inset-x-3 before:-top-px before:h-1 before:bg-[radial-gradient(circle_at_4px_0,var(--background)_3px,transparent_3.5px)] before:bg-[length:8px_4px] before:content-[""]',
        receipt.type === 'points' && 'border-s-4 border-s-secondary-foreground',
        receipt.type === 'topup' && 'border-s-4 border-s-secondary',
        receipt.type === 'refund' && 'border-s-4 border-s-emerald-500',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          receipt.type === 'points'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200'
            : 'bg-secondary/10 text-teal-700 dark:text-secondary',
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{t.history.receipt[receipt.type]}</p>
        <p className="text-xs text-muted-foreground">
          <bdi>{when.format(new Date(tx.createdAt))}</bdi>
          {locale === 'en' && tx.description && tx.description !== t.history.receipt[receipt.type] ? ` · ${tx.description}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-end">
        {!zero && (
          <Money
            value={tx.amount}
            sign={credit ? '+' : '−'}
            className={cn('block text-base font-extrabold', credit ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground')}
          />
        )}
        <span className="text-xs text-muted-foreground">
          {t.history.balanceAfter} <Money value={tx.balanceAfter} balance className="font-bold" />
        </span>
      </div>
    </li>
  );
}

function EmptyTicket() {
  const t = useT(messages);
  return (
    <div className="relative flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-10 text-center md:flex-row md:text-start">
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Plane className="size-6 rtl:-scale-x-100" />
      </span>
      <div className="flex-1">
        <p className="text-base font-extrabold text-primary dark:text-white">{t.history.emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.history.emptyBody}</p>
      </div>
      <a
        href="#search"
        className={cn(
          'inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white dark:bg-white dark:text-ocean-deep',
          focusRing,
        )}
      >
        <Search className="size-4" aria-hidden />
        {t.history.emptyCta}
      </a>
    </div>
  );
}
