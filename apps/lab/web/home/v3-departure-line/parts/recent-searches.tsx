/**
 * Recent searches under the card, as `features/flights/history/recent-searches.tsx` does today: at most 5, departed
 * ones left out, one click to search again, one to remove; "price now vs last time" only when both exist and are in
 * the same currency. Here they are ticket-like rows on a hairline list instead of glass pills.
 * Loading shows a quiet skeleton of the same height; with nothing to show, the section is not rendered.
 */
import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Equal, History, X } from 'lucide-react';
import { useLocale } from '@lab/i18n';
import { cn } from '@lab/utils';
import { fill, type Messages } from '../i18n';
import { focusRing } from './field';
import { money, shortDate, trend } from './format';
import type { HistoryEntry } from './mocks';
import { cabinLabel } from './party-field';

interface Props {
  source: 'account' | 'device' | null;
  history: HistoryEntry[] | 'loading';
  onPick: (entry: HistoryEntry) => void;
  t: Messages;
}

const CABIN = { ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium_economy', BUSINESS: 'business', FIRST: 'first' } as const;

export function RecentSearches({ source, history, onPick, t }: Props) {
  const locale = useLocale();
  const [removed, setRemoved] = useState<string[]>([]);
  const r = t.recent;

  if (history === 'loading') {
    return (
      <section aria-label={r.loading} aria-busy className="mt-6">
        <div className="mb-3 h-5 w-40 rounded bg-(--surface-3)" />
        <div className="grid gap-px overflow-hidden rounded-xl border border-(--line) bg-(--line) md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] bg-(--card) p-4">
              <div className="h-4 w-2/3 rounded bg-(--surface-3)" />
              <div className="mt-2 h-3 w-1/2 rounded bg-(--surface-2)" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const rows = history.filter((e) => !e.departed && !removed.includes(e.id)).slice(0, 5);
  if (!source || rows.length === 0) return null;

  return (
    <section aria-labelledby="recent-title" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="recent-title" className="flex items-center gap-2 text-base font-bold text-(--brand-ink)">
          <History className="size-4 text-(--ink-muted)" aria-hidden />
          {r.title}
        </h2>
        {source === 'account' ? (
          <a href="#account-searches" className={cn('text-sm font-semibold text-(--brand-ink) underline-offset-4 hover:underline', focusRing)}>
            {r.seeAll}
          </a>
        ) : (
          <span className="text-xs text-(--ink-muted)">{r.deviceOnly}</span>
        )}
      </div>
      <ul className="grid gap-px overflow-hidden rounded-xl border border-(--line) bg-(--line) md:grid-cols-2 xl:grid-cols-3">
        {rows.map((e, i) => {
          // Fill the last row so the hairline grid never shows an empty cell.
          const isLast = i === rows.length - 1;
          const span = cn(
            isLast && rows.length % 2 === 1 && 'md:col-span-2',
            isLast && rows.length % 3 === 1 && 'xl:col-span-3',
            isLast && rows.length % 3 === 2 && 'xl:col-span-2',
            isLast && rows.length % 3 === 0 && 'xl:col-span-1',
          );
          const first = e.slices[0];
          const last = e.slices[e.slices.length - 1];
          const round = e.slices.length === 2 && first.origin.iataCode === last.destination.iataCode;
          const end = round ? first.destination : last.destination;
          const route = fill(t.route, { from: first.origin.cityName ?? first.origin.iataCode, to: end.cityName ?? end.iataCode });
          const party = e.passengers.adults + e.passengers.children.length + e.passengers.infants.length;
          const dates = round
            ? `${shortDate(first.departureDate, locale)} – ${shortDate(last.departureDate, locale)}`
            : shortDate(first.departureDate, locale);
          // Each code is isolated, so the arrow between them follows the reading direction (← in Arabic).
          const codes = round ? [first.origin.iataCode, end.iataCode] : e.slices.map((s) => s.origin.iataCode).concat(end.iataCode);
          const joiner = round ? '⇄' : locale === 'ar' ? '←' : '→';
          const cmp = e.now && e.lastSeenPrice && e.now.currency === e.lastSeenPrice.currency ? trend(e.now.amount, e.lastSeenPrice.amount) : null;
          const TrendIcon = cmp === -1 ? ArrowDownRight : cmp === 1 ? ArrowUpRight : Equal;
          return (
            <li key={e.id} className={cn('relative flex min-h-[76px] items-stretch bg-(--card)', span)}>
              <button
                type="button"
                onClick={() => onPick(e)}
                aria-label={fill(r.searchAgain, { route })}
                className={cn('flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 py-3 text-start hover:bg-(--surface-2)', 'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)')}
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span translate="no" className="tnum shrink-0 text-sm font-bold text-(--brand-ink)">
                    {codes.map((code, k) => (
                      <span key={k}>
                        {k > 0 && <span aria-hidden> {joiner} </span>}
                        <bdi>{code}</bdi>
                      </span>
                    ))}
                  </span>
                  <span className="truncate text-sm text-(--ink)">{route}</span>
                </span>
                <span className="tnum truncate text-xs text-(--ink-muted)">
                  {dates} · {t.travellers(party)} · {cabinLabel(CABIN[e.cabinClass], t.form)}
                </span>
                {e.now ? (
                  <span className="tnum flex flex-wrap items-center gap-x-2 text-xs">
                    <span className="font-bold text-(--brand-ink)"><Price text={r.now} amount={money(e.now.amount, e.now.currency)} /></span>
                    {e.lastSeenPrice && (
                      <span className="text-(--ink-muted)"><Price text={r.lastTime} amount={money(e.lastSeenPrice.amount, e.lastSeenPrice.currency)} /></span>
                    )}
                    {cmp !== null && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 font-semibold',
                          cmp === -1 ? 'text-(--success-ink)' : cmp === 1 ? 'text-(--warning-ink)' : 'text-(--ink-muted)',
                        )}
                      >
                        <TrendIcon className="size-3.5 rtl:-scale-x-100" aria-hidden />
                        {cmp === -1 ? r.down : cmp === 1 ? r.up : r.same}
                      </span>
                    )}
                  </span>
                ) : e.lastSeenPrice ? (
                  <span className="tnum text-xs text-(--ink-muted)"><Price text={r.lastTime} amount={money(e.lastSeenPrice.amount, e.lastSeenPrice.currency)} /></span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setRemoved((x) => [...x, e.id])}
                aria-label={fill(r.remove, { route })}
                className={cn('flex w-11 shrink-0 items-center justify-center text-(--ink-muted) hover:bg-(--surface-2) hover:text-(--brand-ink)', 'outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)')}
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Now {price}" with the amount isolated LTR, so "$221.15" never reorders inside Arabic. */
function Price({ text, amount }: { text: string; amount: string }) {
  const [before, after = ''] = text.split('{price}');
  return (
    <>
      {before}
      <bdi dir="ltr">{amount}</bdi>
      {after}
    </>
  );
}
