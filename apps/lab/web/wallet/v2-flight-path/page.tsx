import { useMemo, useState } from 'react';
import { useLocale, useT, type Locale } from '@lab/i18n';
import { walletScenario } from '@lab/mocks/wallet';
import { messages } from './i18n';
import { Cockpit } from './parts/cockpit';
import { FilterChips, FlightPath, Legend } from './parts/flight-path';
import { useAmountsShown } from './parts/hooks';
import { activeHolds, buildEntries, groupByMonth, matchesFilter, type Filter } from './parts/ledger';
import { readScenario, useWalletLab, type LabScenario } from './parts/use-wallet-lab';
import { storyDomId } from './parts/waypoint';

/**
 * v2 · flight-path — the wallet as one vertical flight path. The cockpit at the top is "now" (available
 * balance, refuel, trips it covers, points); below, every movement is a waypoint whose distance from the edge
 * follows the ledger balance. Content area only: the real wallet hero, newsletter and footer stay as they are.
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

  const entries = useMemo(() => buildEntries(lab.transactions), [lab.transactions]);
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

  const jumpToHold = () => {
    const target = holds[0];
    if (!target) return;
    setFilter('all');
    requestAnimationFrame(() => {
      const el = document.getElementById(storyDomId(target.paymentId));
      el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
  };

  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-10 px-4 pt-6 sm:px-6 md:pt-10">
        <Cockpit
          balance={lab.balance}
          walletError={lab.walletError}
          onRetry={lab.retryWallet}
          shown={shown}
          onToggleShown={toggleShown}
          holdCount={holds.length || 1}
          onJumpToHold={jumpToHold}
          searches={walletSearches(scenario, locale)}
          loyalty={lab.loyalty}
          onRedeem={lab.redeem}
          topUpResult={lab.topUpResult}
          onDismissResult={lab.dismissTopUpResult}
          empty={empty}
        />

        <section aria-labelledby="fp-path" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10">
          <div className="min-w-0">
            <header className="mb-5">
              <h2 id="fp-path" className="text-2xl font-extrabold sm:text-3xl">
                {t.pathTitle}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t.pathSub}</p>
            </header>
            <details className="group mb-4 lg:hidden">
              <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-bold text-teal-700 underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-secondary/60 focus-visible:outline-none dark:text-secondary">
                {t.legendTitle}
              </summary>
              <div className="mt-2">
                <Legend />
              </div>
            </details>
            {!empty && !loading && !lab.historyError && (
              <div className="mb-5 lg:hidden">
                <FilterChips filter={filter} onChange={setFilter} />
              </div>
            )}
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

          <aside className="hidden lg:block">
            <div className="sticky top-6 flex flex-col gap-4">
              {!empty && !loading && !lab.historyError && <FilterChips filter={filter} onChange={setFilter} vertical />}
              <Legend />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function walletSearches(scenario: LabScenario, locale: Locale) {
  return walletScenario(scenario === 'error' ? 'default' : scenario).searches[locale];
}
