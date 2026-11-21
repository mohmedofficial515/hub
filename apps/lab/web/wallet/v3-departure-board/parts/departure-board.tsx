import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Eye, Pin, PinOff, Plane, Search } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { curatedDestinations, topUpLimits, type FlightSearchEntry } from '@lab/mocks/wallet';
import { cn } from '@lab/utils';
import { messages } from '../i18n';
import { Flap } from './flap';
import { MASK, addDecimal, ltr, ceilDollars, compareDecimal, gapTo, subtractDecimal, usd, usdCeil } from './money';
import type { TopUpReturn } from './use-wallet-lab';
import { RETURNED_TOPUP } from './use-wallet-lab';

export interface BoardRow {
  id: string;
  code: string;
  city: string;
  date: string | null;
  price: string;
  roundTrip: boolean | null;
}

type Status =
  | { kind: 'covered' }
  | { kind: 'withTopUp' }
  | { kind: 'short'; gap: string }
  | { kind: 'card' }
  | { kind: 'hidden' }
  | { kind: 'blank' };

const ringDark =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark';

export function boardRows(searches: FlightSearchEntry[], locale: 'ar' | 'en'): { rows: BoardRow[]; curated: boolean } {
  const live = searches.filter((s) => !s.departed && s.lastSeenPrice && s.lastSeenPrice.currency === 'USD');
  if (live.length > 0) {
    return {
      curated: false,
      rows: live.map((s) => {
        const slice = s.slices[0];
        return {
          id: s.id,
          code: slice.destination.iataCode,
          city: slice.destination.cityName ?? slice.destination.iataCode,
          date: slice.departureDate,
          price: s.lastSeenPrice!.amount,
          roundTrip: s.tripType === 'ROUND_TRIP',
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
      roundTrip: null,
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
    if (!shown) return { kind: 'hidden' };
    if (compareDecimal(available, r.price) >= 0) return { kind: 'covered' };
    if (compareDecimal(reach, r.price) >= 0) return { kind: 'withTopUp' };
    return { kind: 'short', gap: subtractDecimal(r.price, reach) };
  });

  // One polite sentence instead of per-cell announcements, debounced so typing an amount does not flood readers.
  const sentence = useMemo(() => {
    if (loading || !available || !shown || rows.length === 0) return '';
    if (frozen) return t.summaryFrozen;
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

  const standby = !loading && !frozen && !shown;
  const title = curated ? t.boardCuratedTitle : t.boardTitle;

  return (
    <section
      aria-labelledby="v3-board-title"
      className="relative min-w-0 overflow-clip rounded-2xl bg-primary-dark text-white ring-1 ring-white/5"
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-4 pb-4 pt-5 md:px-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] rtl:tracking-normal text-secondary-foreground">
            <Plane className="size-4 rtl:-scale-x-100" aria-hidden />
            {t.boardEyebrow}
          </p>
          <h2 id="v3-board-title" className="mt-1 text-xl font-bold md:text-2xl">
            {title}
          </h2>
        </div>
        <span aria-hidden className="hidden items-center gap-1.5 text-xs text-white/60 sm:inline-flex">
          <span className="size-2 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
          {curated ? t.curatedIndicative : t.indicative}
        </span>
      </header>

      {topUpReturn && (
        <ReturnRow state={topUpReturn} shown={shown} onDismiss={onDismissReturn} onRetry={onRetryTopUp} />
      )}

      {standby && (
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t.standbyTitle}</p>
            <p className="text-sm text-white/75">{t.standbyBody}</p>
          </div>
          <button
            type="button"
            onClick={onReveal}
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-bold text-primary-dark hover:brightness-105',
              ringDark,
            )}
          >
            <Eye className="size-4" aria-hidden />
            {t.standbyAction}
          </button>
        </div>
      )}

      {/* ≥640: a real table (caption + th scope). <640: the same rows as a list of cards. */}
      <div className="hidden overflow-x-auto sm:block">
      <table className="w-full border-collapse text-start">
        <caption className="sr-only">{curated ? t.boardCuratedCaption : t.boardCaption}</caption>
        <thead>
          <tr className="text-xs font-semibold whitespace-nowrap uppercase tracking-wider rtl:tracking-normal text-white/60">
            <th scope="col" className="px-4 py-3 text-start font-semibold md:ps-6">
              {t.colFlight}
            </th>
            <th scope="col" className="px-2 py-3 text-start font-semibold">
              {t.colDestination}
            </th>
            {!curated && (
              <th scope="col" className="px-2 py-3 text-start font-semibold">
                {t.colDate}
              </th>
            )}
            <th scope="col" className="px-2 py-3 text-start font-semibold">
              {curated ? t.colFrom : t.colPrice}
            </th>
            <th scope="col" className="px-2 py-3 text-start font-semibold">
              {t.colStatus}
            </th>
            <th scope="col" className="px-4 py-3 text-end font-semibold md:pe-6">
              <span className="sr-only">{t.colAction}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={cn('border-t border-white/[0.06]', goalId === r.id && 'bg-secondary-foreground/[0.07]')}>
              <th scope="row" className="px-4 py-3 text-start font-normal md:ps-6">
                <Flap text={loading ? '———' : r.code} className="text-lg font-bold text-secondary-foreground" />
              </th>
              <td className="px-2 py-3">
                <Flap text={loading ? '———' : up(r.city)} whole={!loading} className="text-base font-semibold tracking-wider rtl:tracking-normal" />
              </td>
              {!curated && (
                <td className="px-2 py-3 text-sm whitespace-nowrap">
                  {loading || !r.date ? '—' : <Flap text={boardDate(r.date, locale)} whole className="text-sm tracking-wider rtl:tracking-normal" />}
                </td>
              )}
              <td className="px-2 py-3">
                <Flap text={loading ? '———' : usdCeil(r.price)} srText={loading ? '' : usd(r.price)} className="text-base font-bold tabular-nums" />
              </td>
              <td className="px-2 py-3">
                <StatusCell status={statuses[i]} up={up} />
              </td>
              <td className="px-4 py-2 md:pe-6">
                <RowActions
                  row={r}
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

      <ul className="divide-y divide-white/[0.06] sm:hidden" aria-label={curated ? t.boardCuratedCaption : t.boardCaption}>
        {rows.map((r, i) => (
          <li key={r.id} className={cn('px-4 py-3', goalId === r.id && 'bg-secondary-foreground/[0.07]')}>
            <div className="flex items-center gap-3">
              <Flap text={loading ? '———' : r.code} className="text-base font-bold text-secondary-foreground" />
              <span className="min-w-0 flex-1 truncate font-semibold">{loading ? '—' : r.city}</span>
              {r.date && !loading && <span className="text-sm text-white/70">{boardDate(r.date, locale)}</span>}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <bdi dir="ltr" className="text-lg font-bold tabular-nums">
                {loading ? '—' : usdCeil(r.price)}
              </bdi>
              <span className="min-w-0 flex-1">
                <StatusCell status={statuses[i]} up={up} />
              </span>
              <RowActions
                row={r}
                status={statuses[i]}
                available={available}
                min={min}
                pinned={goalId === r.id}
                onToggleGoal={onToggleGoal}
                onAddGap={onAddGap}
                loading={loading}
                compact
              />
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-4 md:px-6">
        <p aria-live="polite" className="min-h-6 text-sm font-semibold text-white md:text-base">
          {announced}
        </p>
        <a
          href="#flights"
          className={cn('inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-secondary hover:bg-white/5', ringDark)}
        >
          <Search className="size-4" aria-hidden />
          {t.searchNew}
        </a>
        <p className="w-full text-xs text-white/60 sm:hidden">{curated ? t.curatedIndicative : t.indicative}</p>
      </footer>
    </section>
  );
}

function StatusCell({ status, up }: { status: Status; up: (s: string) => string }) {
  const t = useT(messages);
  switch (status.kind) {
    case 'blank':
      return <Flap text="———" className="text-sm text-white/40" />;
    case 'hidden':
      return <Flap text={MASK} srText={t.hiddenStatus} className="text-sm text-white/50" />;
    case 'card':
      return <Flap whole text={up(t.payByCard)} className="text-sm font-bold text-amber-300" stagger={0.015} />;
    case 'covered':
      return <Flap whole text={up(t.covered)} className="text-sm font-bold text-secondary" stagger={0.02} />;
    case 'withTopUp':
      return <Flap whole text={up(t.coveredWithTopUp)} className="text-sm font-bold text-secondary-foreground" stagger={0.015} />;
    case 'short':
      return <Flap text={`+${usdCeil(status.gap)}`} srText={`+${usd(status.gap)}`} className="text-sm font-bold text-white/80" />;
  }
}

function RowActions({
  row,
  status,
  available,
  min,
  pinned,
  onToggleGoal,
  onAddGap,
  loading,
  compact,
}: {
  row: BoardRow;
  status: Status;
  available: string | null;
  min: string;
  pinned: boolean;
  onToggleGoal: (id: string) => void;
  onAddGap: (amount: string) => void;
  loading: boolean;
  compact?: boolean;
}) {
  const t = useT(messages);
  if (loading) return null;
  const canAdd = (status.kind === 'short' || status.kind === 'withTopUp') && available;
  const gap = canAdd ? gapTo(row.price, available!, min) : null;
  const fill = gap ? ceilDollars(gap) : null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {fill ? (
        <button
          type="button"
          onClick={() => onAddGap(fill)}
          aria-label={`${t.addAmount(ltr(usd(fill)))} · ${row.city}`}
          className={cn(
            'inline-flex min-h-11 items-center gap-1 rounded-full bg-secondary-foreground px-3 text-sm font-bold whitespace-nowrap text-primary-dark hover:brightness-105',
            ringDark,
          )}
        >
          {t.add} <bdi dir="ltr">{usdCeil(fill)}</bdi>
        </button>
      ) : (
        <a
          href="#flights"
          aria-label={`${t.checkPrice} · ${row.city}`}
          className={cn(
            'inline-flex min-h-11 items-center gap-1 rounded-full border border-white/20 px-3 text-sm font-semibold whitespace-nowrap hover:bg-white/10',
            ringDark,
          )}
        >
          {!compact && t.checkPrice}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
          {compact && <span className="sr-only">{t.checkPrice}</span>}
        </a>
      )}
      <button
        type="button"
        onClick={() => onToggleGoal(row.id)}
        aria-pressed={pinned}
        aria-label={`${pinned ? t.unpin : t.pin} · ${row.city}`}
        title={pinned ? t.unpin : t.pin}
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-full transition hover:bg-white/10',
          pinned ? 'text-secondary-foreground' : 'text-white/60',
          ringDark,
        )}
      >
        {pinned ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
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
        <Flap text={en ? t.trTopUp.toUpperCase() : t.trTopUp} className="text-sm font-bold" stagger={0.02} />
        <Flap
          text={shown ? usd(RETURNED_TOPUP) : `$${MASK}`}
          srText={shown ? usd(RETURNED_TOPUP) : t.hiddenStatus}
          className="text-sm font-bold tabular-nums"
        />
        <Flap text={en ? label.toUpperCase() : label} className={cn('text-sm font-bold', tone)} stagger={0.02} />
      </div>
      <p className="min-w-0 flex-1 basis-56 text-sm text-white/80">{body}</p>
      <div className="flex gap-1">
        {state === 'failed' && (
          <button
            type="button"
            onClick={onRetry}
            className={cn('min-h-11 rounded-full bg-secondary px-4 text-sm font-bold text-primary-dark', ringDark)}
          >
            {t.tryAgain}
          </button>
        )}
        {state !== 'pending' && (
          <button type="button" onClick={onDismiss} className={cn('min-h-11 rounded-full px-4 text-sm text-white/80 hover:bg-white/10', ringDark)}>
            {t.dismiss}
          </button>
        )}
      </div>
    </div>
  );
}
