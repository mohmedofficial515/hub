import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Eye, EyeOff, Pin, PinOff, Plane, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { curatedDestinations, topUpLimits, type FlightSearchEntry } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Flap } from './flap';
import { MASK, addDecimal, ltr, ceilDollars, compareDecimal, gapTo, subtractDecimal, usd, usdCeil } from './money';
import { ringBoard } from './rings';
import { newSearchHref, searchHref } from './search-href';
import type { TopUpReturn } from './use-wallet-lab';
import { RETURNED_TOPUP } from './use-wallet-lab';

export interface BoardRow {
  id: string;
  code: string;
  city: string;
  date: string | null;
  price: string;
  /** The search this row re-runs; null for a curated destination. */
  search: FlightSearchEntry | null;
  /** Same-tab link to flight results pre-filled from the search (route, dates, travellers, cabin). */
  href: string;
}

/**
 * `neutral`: amounts hidden. The owner's rule is that nothing on the board may reveal the balance while hidden, so
 * the status column is removed rather than masked, and every row offers the same action.
 */
type Status =
  | { kind: 'covered' }
  | { kind: 'withTopUp' }
  | { kind: 'short'; gap: string }
  | { kind: 'card' }
  | { kind: 'neutral' }
  | { kind: 'blank' };

export function boardRows(searches: FlightSearchEntry[], locale: 'ar' | 'en'): { rows: BoardRow[]; curated: boolean } {
  const live = searches.filter((s) => !s.departed && s.lastSeenPrice && s.lastSeenPrice.currency === 'USD');
  if (live.length > 0) {
    return {
      curated: false,
      rows: live.map((s) => {
        const first = s.slices[0];
        return {
          id: s.id,
          code: first.destination.iataCode,
          city: first.destination.cityName ?? first.destination.iataCode,
          date: first.departureDate,
          price: s.lastSeenPrice!.amount,
          search: s,
          href: searchHref(s, locale),
        };
      }),
    };
  }
  return {
    curated: true,
    rows: curatedDestinations.map((d) => ({
      id: `cur_${d.iata}`,
      code: d.iata,
      city: d.city[locale],
      date: null,
      price: d.fromUsd,
      search: null,
      href: newSearchHref(locale),
    })),
  };
}

function boardDate(iso: string, locale: 'ar' | 'en'): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const text = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
  return locale === 'en' ? text.toUpperCase() : text;
}

/** What the row's link will search: trip type, travellers, cabin. `split` puts the trip type on its own line. */
function TripMeta({ search, className, split }: { search: FlightSearchEntry | null; className?: string; split?: boolean }) {
  const t = useT(messages);
  if (!search) return null;
  const { adults, children, infants } = search.passengers;
  const pax = adults + children.length + infants.length;
  return (
    <span className={cn('block text-xs leading-snug text-white/65', className)}>
      {t.tripType[search.tripType]}
      {split ? <br /> : ' · '}
      {t.pax(pax)} · {t.cabin[search.cabinClass]}
    </span>
  );
}

export function DepartureBoard({
  rows,
  curated,
  available,
  extra,
  shown,
  frozen,
  loading,
  goalId,
  onToggleGoal,
  onAddGap,
  onReveal,
  topUpReturn,
  onDismissReturn,
  onRetryTopUp,
}: {
  rows: BoardRow[];
  curated: boolean;
  available: string | null;
  extra: string | null;
  shown: boolean;
  frozen: boolean;
  loading: boolean;
  goalId: string | null;
  onToggleGoal: (id: string) => void;
  onAddGap: (amount: string) => void;
  onReveal: () => void;
  topUpReturn: TopUpReturn;
  onDismissReturn: () => void;
  onRetryTopUp: () => void;
}) {
  const t = useT(messages);
  const locale = useLocale();
  const en = locale === 'en';
  const up = (s: string) => (en ? s.toUpperCase() : s);
  const min = String(topUpLimits.minUsd);
  const reach = available ? addDecimal(available, extra ?? '0') : null;

  const statuses: Status[] = rows.map((r) => {
    if (loading || !available || !reach) return { kind: 'blank' };
    if (frozen) return { kind: 'card' };
    if (!shown) return { kind: 'neutral' };
    if (compareDecimal(available, r.price) >= 0) return { kind: 'covered' };
    if (compareDecimal(reach, r.price) >= 0) return { kind: 'withTopUp' };
    return { kind: 'short', gap: subtractDecimal(r.price, reach) };
  });
  // Hidden: no status column at all (a masked column still looks like a broken display and hints at a value).
  const statusCol = loading || frozen || shown;

  // One polite sentence instead of per-cell announcements, debounced so typing an amount does not flood readers.
  const sentence = useMemo(() => {
    if (loading || !available || rows.length === 0) return '';
    if (frozen) return t.summaryFrozen;
    if (!shown) return '';
    const m = rows.length;
    const now = statuses.filter((s) => s.kind === 'covered').length;
    if (now === m) return t.summaryAll;
    if (extra && compareDecimal(extra, '0') > 0) {
      const withIt = statuses.filter((s) => s.kind === 'covered' || s.kind === 'withTopUp').length;
      return withIt === 0 ? t.summaryWithNone(ltr(usd(extra)), m) : t.summaryWith(ltr(usd(extra)), withIt, m);
    }
    return now === 0 ? t.summaryNone(m) : t.summaryNow(now, m);
  }, [loading, available, shown, frozen, rows.length, extra, statuses.map((s) => s.kind).join(), t]);
  const [announced, setAnnounced] = useState(sentence);
  useEffect(() => {
    const id = window.setTimeout(() => setAnnounced(sentence), 250);
    return () => window.clearTimeout(id);
  }, [sentence]);

  // B2: the reveal button unmounts on click. The summary strip renders in the same slot, so focus moves there (no
  // scroll jump) and the user hears "Your balance covers 2 of 4 trips" and continues from inside the board.
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const focusSummary = useRef(false);
  useEffect(() => {
    if (!shown || !focusSummary.current) return;
    focusSummary.current = false;
    setAnnounced(sentence);
    requestAnimationFrame(() => summaryRef.current?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const standby = !loading && !frozen && !shown && rows.length > 0;
  const title = curated ? t.boardCuratedTitle : t.boardTitle;

  return (
    <section aria-labelledby="v6-board-title" className="relative min-w-0 overflow-clip rounded-2xl bg-primary-dark text-white ring-1 ring-white/5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-4 pb-4 pt-5 md:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-secondary-foreground">
            <Plane className="size-4 rtl:-scale-x-100" aria-hidden />
            {t.boardEyebrow}
          </p>
          <h2 id="v6-board-title" className="mt-1 text-xl font-bold md:text-2xl">
            {title}
          </h2>
        </div>
        <span aria-hidden className="hidden items-center gap-1.5 text-xs text-white/65 sm:inline-flex">
          <span className="size-2 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
          {curated ? t.curatedIndicative : t.indicative}
        </span>
      </header>

      {topUpReturn && <ReturnRow state={topUpReturn} shown={shown} onDismiss={onDismissReturn} onRetry={onRetryTopUp} />}

      {standby ? (
        // B1: stacks below `sm` so the text never squeezes into a 62 px column next to the button.
        <div className="flex flex-col items-stretch gap-3 border-b border-white/10 bg-gradient-to-r from-secondary/[0.10] to-transparent px-4 py-4 sm:flex-row sm:items-center md:px-6 rtl:bg-gradient-to-l">
          <span aria-hidden className="hidden size-11 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-secondary sm:grid">
            <EyeOff className="size-5" />
          </span>
          <div className="min-w-0 sm:flex-1">
            <p className="font-semibold">{t.standbyTitle}</p>
            <p className="mt-0.5 text-sm text-white/75">{t.standbyBody}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              focusSummary.current = true;
              onReveal();
            }}
            className={cn(
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-bold text-primary-dark transition hover:brightness-105 sm:w-auto',
              ringBoard,
            )}
          >
            <Eye className="size-4" aria-hidden />
            {t.standbyAction}
          </button>
        </div>
      ) : (
        !loading &&
        rows.length > 0 && (
          <p
            ref={summaryRef}
            tabIndex={-1}
            aria-live="polite"
            className={cn(
              'min-h-[3.25rem] border-b border-white/10 px-4 py-3.5 text-sm font-semibold text-white outline-none focus-visible:bg-white/[0.04] md:px-6 md:text-base',
              frozen && 'text-amber-200',
            )}
          >
            {announced}
          </p>
        )
      )}

      {/* ≥768: a real table (caption + th scope). <768: the same rows as a list of cards. */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-start">
          <caption className="sr-only">{curated ? t.boardCuratedCaption : t.boardCaption}</caption>
          <thead>
            <tr className="text-xs font-semibold whitespace-nowrap uppercase tracking-wider rtl:tracking-normal text-white/65">
              <th scope="col" className="px-4 py-3 text-start font-semibold lg:ps-6">
                {t.colFlight}
              </th>
              <th scope="col" className="px-1.5 py-3 text-start font-semibold">
                {t.colDestination}
              </th>
              {!curated && (
                <th scope="col" className="px-1.5 py-3 text-start font-semibold">
                  {t.colDate}
                </th>
              )}
              {/* Price and status share a column (status flips under the price) so the row fits beside the gate. */}
              <th scope="col" className="px-1.5 py-3 text-start font-semibold">
                {curated ? t.colFrom : t.colPrice}
                {statusCol && ` · ${t.colStatus}`}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold lg:pe-6">
                <span className="sr-only">{t.colAction}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={cn('border-t border-white/[0.06]', goalId === r.id && 'bg-secondary-foreground/[0.07]')}>
                <th scope="row" className="px-4 py-3 text-start align-middle font-normal lg:ps-6">
                  <Flap text={loading ? '———' : r.code} className="text-lg font-bold text-secondary-foreground" />
                </th>
                <td className="px-1.5 py-3">
                  <Flap
                    text={loading ? '———' : up(r.city)}
                    srText={loading ? '' : r.city}
                    whole={!loading}
                    className="text-base font-semibold tracking-wider rtl:tracking-normal"
                  />
                  {!loading && <TripMeta search={r.search} split className="mt-1" />}
                </td>
                {!curated && (
                  <td className="px-1.5 py-3 text-sm whitespace-nowrap">
                    {loading || !r.date ? '—' : <Flap text={boardDate(r.date, locale)} whole className="text-sm tracking-wider rtl:tracking-normal" />}
                  </td>
                )}
                <td className="px-1.5 py-3">
                  <Flap text={loading ? '———' : usd(r.price)} srText={loading ? '' : undefined} className="text-base font-bold tabular-nums" />
                  {statusCol && (
                    <span className="mt-1.5 flex">
                      <StatusCell status={statuses[i]} up={up} />
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 lg:pe-6">
                  <RowActions
                    row={r}
                    curated={curated}
                    status={statuses[i]}
                    available={available}
                    min={min}
                    pinned={goalId === r.id}
                    onToggleGoal={onToggleGoal}
                    onAddGap={onAddGap}
                    loading={loading}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-white/[0.06] md:hidden" aria-label={curated ? t.boardCuratedCaption : t.boardCaption}>
        {rows.map((r, i) => (
          <li key={r.id} className={cn('px-4 py-3.5', goalId === r.id && 'bg-secondary-foreground/[0.07]')}>
            <div className="flex items-start gap-3">
              <Flap text={loading ? '———' : r.code} className="text-base font-bold text-secondary-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{loading ? '—' : r.city}</span>
                {!loading && <TripMeta search={r.search} className="mt-0.5" />}
              </span>
              {r.date && !loading && <span className="text-sm text-white/75">{boardDate(r.date, locale)}</span>}
            </div>
            {/* Hidden: price + actions share one line. Shown: price + status, then the actions on their own line. */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
              <span className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <bdi dir="ltr" className="text-lg font-bold tabular-nums">
                  {loading ? '—' : usd(r.price)}
                </bdi>
                {statusCol && <StatusCell status={statuses[i]} up={up} />}
              </span>
              {!loading && (
                <span className={cn(statusCol && 'basis-full')}>
                  <RowActions
                    row={r}
                    curated={curated}
                    status={statuses[i]}
                    available={available}
                    min={min}
                    pinned={goalId === r.id}
                    onToggleGoal={onToggleGoal}
                    onAddGap={onAddGap}
                    loading={loading}
                    stacked
                  />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 md:px-6">
        <a href={newSearchHref(locale)} className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-secondary hover:bg-white/5', ringBoard)}>
          <Search className="size-4" aria-hidden />
          {t.searchNew}
        </a>
        <p className="w-full text-xs text-white/65 sm:hidden">{curated ? t.curatedIndicative : t.indicative}</p>
      </footer>
    </section>
  );
}

function StatusCell({ status, up }: { status: Status; up: (s: string) => string }) {
  const t = useT(messages);
  switch (status.kind) {
    case 'blank':
      return <Flap text="———" className="text-sm text-white/40" />;
    case 'neutral':
      return null;
    case 'card':
      return <Flap words text={up(t.payByCard)} className="text-sm font-bold text-amber-300" stagger={0.03} />;
    case 'covered':
      return <Flap whole text={up(t.covered)} className="text-sm font-bold text-secondary" stagger={0.02} />;
    case 'withTopUp':
      return <Flap words text={up(t.coveredWithTopUp)} className="text-sm font-bold text-secondary-foreground" stagger={0.03} />;
    case 'short':
      // Visible word + exact gap (no rounding: the ceiling is only used for the Add amount).
      return (
        <span className="inline-flex">
          <span className="sr-only">{t.shortSr(ltr(usd(status.gap)))}</span>
          <span aria-hidden className="inline-flex flex-col items-start gap-1">
            <span className="text-[11px] font-bold uppercase leading-none tracking-wider text-white/70 rtl:tracking-normal">{t.shortWord}</span>
            <Flap text={usd(status.gap)} srText="" className="text-sm font-bold tabular-nums text-white" />
          </span>
        </span>
      );
  }
}

function RowActions({
  row,
  curated,
  status,
  available,
  min,
  pinned,
  onToggleGoal,
  onAddGap,
  loading,
  stacked,
}: {
  row: BoardRow;
  curated: boolean;
  status: Status;
  available: string | null;
  min: string;
  pinned: boolean;
  onToggleGoal: (id: string) => void;
  onAddGap: (amount: string) => void;
  loading: boolean;
  /** Mobile card: the goal keeps its visible label (the table shows it from md). */
  stacked?: boolean;
}) {
  const t = useT(messages);
  if (loading) return null;
  const canAdd = (status.kind === 'short' || status.kind === 'withTopUp') && available;
  const gap = canAdd ? gapTo(row.price, available!, min) : null;
  const fill = gap ? ceilDollars(gap) : null;
  const covered = status.kind === 'covered';
  const checkLabel = curated ? t.searchFlights : t.checkPrice;
  const pill = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm whitespace-nowrap transition';

  return (
    <div className={cn('flex items-center gap-1.5', stacked ? 'justify-start' : 'justify-end')}>
      {covered ? (
        // Owner decision: a covered trip opens the pre-filled search in the same tab, as the primary action.
        <a
          href={row.href}
          aria-label={`${curated ? t.searchFlights : t.bookWithBalance} · ${row.city}`}
          className={cn(pill, 'bg-secondary font-bold text-primary-dark hover:brightness-110', ringBoard)}
        >
          {curated ? t.searchFlights : t.bookWithBalance}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </a>
      ) : (
        <>
          {fill && (
            <button
              type="button"
              onClick={() => onAddGap(fill)}
              aria-label={`${t.addAmount(ltr(usd(fill)))} · ${row.city}`}
              className={cn(pill, 'bg-secondary-foreground px-3 font-bold text-primary-dark hover:brightness-105', ringBoard)}
            >
              {t.add} <bdi dir="ltr">{usdCeil(fill)}</bdi>
            </button>
          )}
          <a
            href={row.href}
            aria-label={`${checkLabel} · ${row.city}`}
            className={cn(
              pill,
              'min-w-11 border border-white/25 font-semibold hover:bg-white/10',
              // With an Add button beside it, the table shows the icon only until lg; alone it always has its label.
              fill && 'px-0',
              ringBoard,
            )}
          >
            <span className={cn(fill && 'sr-only')}>{checkLabel}</span>
            <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </a>
        </>
      )}
      <button
        type="button"
        onClick={() => onToggleGoal(row.id)}
        aria-pressed={pinned}
        aria-label={`${t.goalLabel}: ${row.city}`}
        title={pinned ? t.unpin : t.pin}
        className={cn(
          'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold transition hover:bg-white/10',
          pinned ? 'bg-secondary-foreground/15 text-secondary-foreground' : 'text-white/75',
          !stacked && 'px-0 md:px-2.5',
          ringBoard,
        )}
      >
        {pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
        <span className={cn(!stacked && 'hidden md:inline')} aria-hidden>
          {pinned ? t.goalOn : t.goalLabel}
        </span>
      </button>
    </div>
  );
}

function ReturnRow({
  state,
  shown,
  onDismiss,
  onRetry,
}: {
  state: Exclude<TopUpReturn, null>;
  shown: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const t = useT(messages);
  const en = useLocale() === 'en';
  const label = state === 'pending' ? t.trPending : state === 'done' ? t.trDone : t.trFailed;
  const body = state === 'pending' ? t.trPendingBody : state === 'done' ? t.trDoneBody : t.trFailedBody;
  const tone = state === 'pending' ? 'text-amber-300' : state === 'done' ? 'text-secondary' : 'text-red-300';
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 md:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Flap whole text={en ? t.trTopUp.toUpperCase() : t.trTopUp} className="text-sm font-bold" />
        <Flap
          whole={!shown}
          text={shown ? usd(RETURNED_TOPUP) : `$ ${MASK}`}
          srText={shown ? usd(RETURNED_TOPUP) : t.hiddenStatus}
          className="text-sm font-bold tabular-nums"
        />
        <Flap whole text={en ? label.toUpperCase() : label} className={cn('text-sm font-bold', tone)} />
      </div>
      <p className="min-w-0 flex-1 basis-56 text-sm text-white/80">{body}</p>
      <div className="flex gap-1">
        {state === 'failed' && (
          <button type="button" onClick={onRetry} className={cn('min-h-11 rounded-full bg-secondary px-4 text-sm font-bold text-primary-dark', ringBoard)}>
            {t.tryAgain}
          </button>
        )}
        {state !== 'pending' && (
          <button type="button" onClick={onDismiss} className={cn('min-h-11 rounded-full px-4 text-sm text-white/80 hover:bg-white/10', ringBoard)}>
            {t.dismiss}
          </button>
        )}
      </div>
    </div>
  );
}
