import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BedDouble,
  ChevronDown,
  Gift,
  Info,
  Lock,
  Package,
  Plane,
  RotateCcw,
  Settings2,
  Wallet,
} from 'lucide-react';
import { Skeleton } from '@web/components/ui/skeleton';
import { useLocale, useT } from '@lab/i18n';
import type { WalletTransaction } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { buildEntries, byMonth, matches, type Entry, type Filter, type Story } from './log-model';
import { MASK, usd } from './money';
import { ringLight as ring } from './rings';
const FILTERS: Filter[] = ['all', 'trips', 'topups', 'refunds', 'points'];

function fmt(locale: 'ar' | 'en', iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { timeZone: 'UTC', ...opts }).format(new Date(iso));
}

export function FlightLog({
  transactions,
  hasMore,
  loadingMore,
  onLoadMore,
  loading,
  error,
  onRetry,
  shown,
  openKey,
  onOpenKey,
}: {
  transactions: WalletTransaction[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  shown: boolean;
  openKey: string | null;
  onOpenKey: (key: string | null) => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const [filter, setFilter] = useState<Filter>('all');
  const entries = useMemo(() => buildEntries(transactions), [transactions]);
  const months = useMemo(() => byMonth(entries.filter((e) => matches(e, filter)), transactions, hasMore), [entries, filter, transactions, hasMore]);
  const money = (v: string) => (shown ? usd(v) : `$${MASK}`);

  return (
    <section aria-labelledby="v6-log-title" className="rounded-2xl border border-border bg-card text-card-foreground">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-4 py-5 md:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-muted-foreground">{t.logEyebrow}</p>
          <h2 id="v6-log-title" className="mt-1 text-xl font-bold text-primary dark:text-foreground">
            {t.logTitle}
          </h2>
        </div>
        {!loading && !error && transactions.length > 0 && (
          <div role="group" aria-label={t.filterLabel} className="flex max-w-full flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
                  filter === f
                    ? 'border-primary bg-primary text-white dark:border-secondary dark:bg-secondary dark:text-primary-dark'
                    : 'border-border text-foreground hover:bg-muted',
                  ring,
                )}
              >
                {t.filters[f]}
              </button>
            ))}
          </div>
        )}
      </header>

      {loading ? (
        <ul aria-busy className="grid gap-px p-4 md:p-6">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-10 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div role="alert" className="grid justify-items-center gap-3 px-4 py-10 text-center">
          <p className="font-semibold">{t.logError}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={loadingMore}
            className={cn('min-h-11 rounded-full border border-border px-5 font-semibold hover:bg-muted disabled:opacity-60', ring)}
          >
            {loadingMore ? t.loadingMore : t.retry}
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="grid justify-items-center gap-2 px-4 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted">
            <Plane className="size-6 text-muted-foreground rtl:-scale-x-100" aria-hidden />
          </span>
          <p className="mt-2 text-lg font-bold">{t.logEmptyTitle}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t.logEmptyBody}</p>
        </div>
      ) : (
        <>
          <div
            aria-hidden
            className="hidden grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_8.5rem] gap-4 px-6 pt-4 text-xs font-semibold uppercase tracking-wider rtl:tracking-normal text-muted-foreground md:grid"
          >
            <span>{t.colWhen}</span>
            <span>{t.colMovement}</span>
            <span className="text-end">{t.colAmount}</span>
            <span className="text-end">{t.colBalance}</span>
          </div>

          {months.length === 0 && <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t.noMatches}</p>}

          {months.map((m) => (
            <div key={m.key} className="px-2 pb-2 md:px-4">
              <h3 className="sticky top-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/80 px-3 py-2 text-sm backdrop-blur md:px-4">
                <span className="font-bold">{fmt(locale, `${m.key}-15T12:00:00Z`, { month: 'long', year: 'numeric' })}</span>
                <span className="flex flex-wrap gap-x-3 text-foreground/75">
                  <span>
                    {t.monthIn} <bdi dir="ltr" className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">+{money(m.in)}</bdi>
                  </span>
                  <span>
                    {t.monthOut} <bdi dir="ltr" className="font-semibold text-foreground tabular-nums">−{money(m.out)}</bdi>
                  </span>
                  {!m.complete && <span>({t.soFar})</span>}
                </span>
              </h3>
              <ul className="divide-y divide-border">
                {m.entries.map((e) =>
                  e.kind === 'story' ? (
                    <StoryRow key={e.key} story={e} open={openKey === e.key} onToggle={() => onOpenKey(openKey === e.key ? null : e.key)} money={money} />
                  ) : (
                    <SingleRow key={e.key} entry={e} money={money} />
                  ),
                )}
              </ul>
            </div>
          ))}

          <div className="flex justify-center border-t border-border px-4 py-4">
            {hasMore ? (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                className={cn('min-h-11 rounded-full border border-border px-6 font-semibold hover:bg-muted disabled:opacity-60', ring)}
              >
                {loadingMore ? t.loadingMore : t.showMore}
              </button>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">{t.endOfLog}</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function When({ iso }: { iso: string }) {
  const locale = useLocale();
  return (
    <span className="text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{fmt(locale, iso, { day: 'numeric', month: 'short' })}</span>
      <span className="ms-1.5 md:ms-0 md:block">{fmt(locale, iso, { hour: 'numeric', minute: '2-digit' })}</span>
    </span>
  );
}

function SingleRow({ entry, money }: { entry: Extract<Entry, { kind: 'single' }>; money: (v: string) => string }) {
  const t = useT(messages);
  const locale = useLocale();
  const tx = entry.tx;
  const credit = tx.direction === 'CREDIT';
  const zero = /^0+(\.0+)?$/.test(tx.amount);
  const Icon = tx.type === 'TOPUP' ? Wallet : tx.type === 'REDEMPTION' ? Gift : tx.type === 'REFUND' ? RotateCcw : tx.type === 'ADJUSTMENT' ? Settings2 : credit ? ArrowDownLeft : ArrowUpRight;
  const title = t.txTitle[tx.type];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-2 py-3 md:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_8.5rem] md:px-2">
      <span className="order-3 col-span-2 ps-[3.25rem] md:order-none md:col-span-1 md:ps-0">
        <When iso={tx.createdAt} />
      </span>
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', credit ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          {locale === 'en' && tx.description && tx.description !== title && (
            <span className="block truncate text-xs text-muted-foreground">{tx.description}</span>
          )}
        </span>
      </span>
      <span className="text-end">
        <bdi dir="ltr" className={cn('font-bold tabular-nums', zero ? 'text-muted-foreground' : credit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
          {zero ? '' : credit ? '+' : '−'}
          {money(tx.amount)}
        </bdi>
        <span className="block text-xs text-muted-foreground md:hidden">
          {t.balShort} <bdi dir="ltr" className="tabular-nums">{money(tx.balanceAfter)}</bdi>
        </span>
      </span>
      <span className="hidden text-end text-sm text-muted-foreground md:block">
        <span className="sr-only">{t.colBalance}: </span>
        <bdi dir="ltr" className="tabular-nums">{money(tx.balanceAfter)}</bdi>
      </span>
    </li>
  );
}

function StoryRow({ story, open, onToggle, money }: { story: Story; open: boolean; onToggle: () => void; money: (v: string) => string }) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const latest = story.latest;
  const kind = story.label?.kind ?? 'flight';
  const Icon = kind === 'hotel' ? BedDouble : kind === 'package' ? Package : Plane;
  const title = story.label?.title[locale] ?? t.kind[kind];
  const steps = [...story.txs].reverse();
  const headline =
    story.state === 'held'
      ? { sign: '', cls: 'text-amber-700 dark:text-amber-300', amount: latest.amount }
      : story.state === 'refunded'
        ? { sign: '+', cls: 'text-emerald-700 dark:text-emerald-400', amount: story.txs.find((x) => x.type === 'REFUND')!.amount }
        : story.state === 'paid'
          ? { sign: '−', cls: 'text-foreground', amount: story.txs.find((x) => x.type === 'CAPTURE' || x.type === 'PAYMENT')!.amount }
          : { sign: '', cls: 'text-muted-foreground', amount: latest.amount };
  const chip = {
    held: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    paid: 'bg-muted text-foreground',
    released: 'bg-muted text-foreground/75',
    refunded: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300',
  }[story.state];
  const panelId = `v6-story-panel-${story.key}`;
  const nameId = `v6-story-name-${story.key}`;
  const descId = `v6-story-desc-${story.key}`;

  return (
    <li id={`v6-story-${story.key}`} className="scroll-mt-24">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        data-story={story.key}
        aria-labelledby={nameId}
        aria-describedby={descId}
        className={cn(
          'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 text-start transition hover:bg-muted/60 md:grid-cols-[7.5rem_minmax(0,1fr)_8.5rem_8.5rem]',
          ring,
        )}
      >
        {/* Short accessible name (title · state · amount); date, steps, ref and balance go to the description. */}
        <span id={nameId} className="sr-only">
          {title} · {t.storyState[story.state]} · {headline.sign}
          {money(headline.amount)}
        </span>
        <span id={descId} className="sr-only">
          {fmt(locale, latest.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {t.steps(story.txs.length)}
          {story.label ? ` · ${story.label.bookingRef}` : ''} · {t.colBalance}: {money(latest.balanceAfter)}
        </span>
        <span aria-hidden className="order-3 col-span-2 ps-[3.25rem] md:order-none md:col-span-1 md:ps-0">
          <When iso={latest.createdAt} />
        </span>
        <span aria-hidden className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white dark:bg-ocean">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="line-clamp-2 lg:line-clamp-1">{title}</span>
              <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold', chip)}>
                {story.state === 'held' && <Lock className="size-3" aria-hidden />}
                {t.storyState[story.state]}
              </span>
              <span>{t.steps(story.txs.length)}</span>
              {story.label && (
                <bdi dir="ltr" className="font-mono">
                  {story.label.bookingRef}
                </bdi>
              )}
            </span>
          </span>
        </span>
        <span aria-hidden className="text-end">
          <bdi dir="ltr" className={cn('font-bold tabular-nums', headline.cls)}>
            {headline.sign}
            {money(headline.amount)}
          </bdi>
          <span className="block text-xs text-muted-foreground md:hidden">
            {t.balShort} <bdi dir="ltr" className="tabular-nums">{money(latest.balanceAfter)}</bdi>
          </span>
        </span>
        <span aria-hidden className="hidden text-end text-sm text-muted-foreground md:block">
          <bdi dir="ltr" className="tabular-nums">{money(latest.balanceAfter)}</bdi>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mb-3 ms-[3.75rem] me-2 rounded-xl border border-border bg-background p-3 md:ms-[11.5rem]">
              {story.incomplete && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5" aria-hidden />
                  {t.earlierNotLoaded}
                </p>
              )}
              <ol className="relative grid gap-3 border-s-2 border-dashed border-border ps-4">
                {steps.map((s) => (
                  <li key={s.id} className="relative flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                    <span aria-hidden className="absolute -start-[1.4rem] top-1.5 size-2.5 rounded-full bg-secondary ring-4 ring-background" />
                    <span>
                      <span className="font-semibold">{t.step[s.type as keyof typeof t.step] ?? t.txTitle[s.type]}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {fmt(locale, s.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </span>
                    <bdi dir="ltr" className="tabular-nums text-muted-foreground">
                      {s.type === 'RESERVE' || s.type === 'RELEASE' ? '' : s.direction === 'CREDIT' ? '+' : '−'}
                      {money(s.amount)}
                    </bdi>
                  </li>
                ))}
              </ol>
              {story.state === 'held' && <p className="mt-3 text-xs text-muted-foreground">{t.holdExplain}</p>}
              {story.label && (
                <a
                  href={`#booking/${story.label.bookingRef}`}
                  className={cn('mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline dark:text-secondary', ring)}
                >
                  {t.viewBooking}
                  <bdi dir="ltr" className="font-mono">{story.label.bookingRef}</bdi>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
