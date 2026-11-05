import { useEffect, useMemo, useState } from 'react';
import { useLocale, useT, type Locale } from '@lab/i18n';
import { walletScenario } from '@lab/mocks/wallet';
import { messages } from './i18n';
import { Cockpit, type HoldJump } from './parts/cockpit';
import { FilterChips, FlightPath, Legend } from './parts/flight-path';
import { prefersReducedMotion, useAmountsShown } from './parts/hooks';
import { LabNavToast } from './parts/lab-link';
import { activeHolds, buildEntries, groupByMonth, matchesFilter, type Filter } from './parts/ledger';
import { toCents } from './parts/money';
import { useTrips } from './parts/trip-chips';
import { readScenario, useWalletLab, type LabScenario } from './parts/use-wallet-lab';
import { storyDomId } from './parts/waypoint';

/**
 * v5 · flight-path (fix round of v2) — the wallet as one vertical flight path. The cockpit at the top is "now"
 * (available balance, refuel, trips it covers, points); below, every movement is a waypoint whose distance from
 * the edge follows the *available* balance. Content area only: the real wallet hero, newsletter and footer stay.
 */
export default function Page() {
  // The gallery toolbar writes `?scenario=` into the frame hash; the frame re-renders on hash change.
  const scenario = readScenario();
  return <FlightPathWallet key={scenario} scenario={scenario} />;
}

function FlightPathWallet({ scenario }: { scenario: LabScenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const lab = useWalletLab(scenario);
  const [shown, toggleShown] = useAmountsShown();
  const [filter, setFilter] = useState<Filter>('all');
  const [holdJump, setHoldJump] = useState<HoldJump>('idle');
  const trips = useTrips(walletSearches(scenario, locale));

  const reservedNow = lab.balance ? toCents(lab.balance.reserved) : 0n;
  const entries = useMemo(() => buildEntries(lab.transactions, reservedNow), [lab.transactions, reservedNow]);
  const months = useMemo(
    () =>
      groupByMonth(
        entries.filter((e) => matchesFilter(e, filter)),
        lab.transactions,
        lab.hasMore,
        new Date().toISOString().slice(0, 7),
      ),
    [entries, filter, lab.transactions, lab.hasMore],
  );
  const holds = activeHolds(entries);
  const loading = lab.balance === null && !lab.walletError;
  const empty = !!lab.balance && lab.transactions.length === 0 && !lab.hasMore && !lab.historyError;
  const showFilters = !empty && !loading && !lab.historyError;

  // Jump to the booking holding the money. When its RESERVE is on a page that is not loaded yet, keep loading pages
  // until it appears (or the history ends), instead of a chevron that silently does nothing.
  const target = holds[0];
  useEffect(() => {
    if (holdJump !== 'finding') return;
    if (target) {
      setHoldJump('idle');
      setFilter('all');
      requestAnimationFrame(() => {
        const el = document.getElementById(storyDomId(target.paymentId));
        el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
        el?.focus({ preventScroll: true });
      });
    } else if (lab.historyError || !lab.hasMore) {
      setHoldJump('not-found');
    } else if (!lab.loadingMore) {
      lab.loadMore();
    }
  }, [holdJump, target, lab.hasMore, lab.loadingMore, lab.historyError, lab.loadMore]);

  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pt-6 sm:px-6 md:pt-10">
        <Cockpit
          balance={lab.balance}
          walletError={lab.walletError}
          onRetry={lab.retryWallet}
          shown={shown}
          onToggleShown={toggleShown}
          holdCount={holds.length}
          holdJump={holdJump}
          onJumpToHold={() => setHoldJump('finding')}
          trips={trips}
          loyalty={lab.loyalty}
          onRedeem={lab.redeem}
          topUpResult={lab.topUpResult}
          onDismissResult={lab.dismissTopUpResult}
          empty={empty}
        />

        <section aria-labelledby="fp-path" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className="min-w-0">
            <header className="mb-4">
              <h2 id="fp-path" className="text-2xl font-extrabold sm:text-3xl">
                {t.pathTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.pathSub}</p>
            </header>
            {/* Filters come before the list in the DOM at every width, so keyboard users filter first. */}
            {showFilters && (
              <div className="mb-4">
                <FilterChips filter={filter} onChange={setFilter} />
              </div>
            )}
            <LegendDisclosure shown={shown} />
            <FlightPath
              months={months}
              allEntries={entries}
              filter={filter}
              shown={shown}
              hasMore={lab.hasMore}
              loadingMore={lab.loadingMore}
              onLoadMore={lab.loadMore}
              historyError={lab.historyError}
              onRetry={lab.retryHistory}
              loading={loading}
              topUpResult={lab.topUpResult}
              lastCreditId={lab.lastCreditId}
            />
          </div>

          {/* Non-interactive reading aid; after the list in the DOM. */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <Legend shown={shown} />
            </div>
          </aside>
        </section>
      </div>
      <LabNavToast />
    </main>
  );
}

/** Below 1024 px the legend is a disclosure under the heading. */
function LegendDisclosure({ shown }: { shown: boolean }) {
  const t = useT(messages);
  return (
    <details className="mb-4 lg:hidden">
      <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-bold text-teal-700 underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none dark:text-secondary">
        {t.legendTitle}
      </summary>
      <div className="mt-2">
        <Legend shown={shown} />
      </div>
    </details>
  );
}

function walletSearches(scenario: LabScenario, locale: Locale) {
  return walletScenario(scenario === 'error' ? 'default' : scenario).searches[locale];
}
