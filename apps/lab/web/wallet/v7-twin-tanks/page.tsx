import { useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import {
  scenarioFromHash,
  topUpLimits,
  walletScenario,
  type Scenario,
  type WalletBalance,
  type WalletTransaction,
} from '@lab/mocks/wallet';
import { messages } from './i18n';
import { CashTank } from './parts/cash-tank';
import { activeHold } from './parts/ledger';
import { addDecimal } from './parts/money';
import { CashCaption, PanelSkeleton, RETURNING_TOPUP, TopUpBanner } from './parts/panel-bits';
import { PointsCaption, PointsTank, previewUsd } from './parts/points';
import { PointsChip, Valve, VALVE_INPUT_ID } from './parts/valve';
import { focusRing, ShownContext, useAmountsShown } from './parts/shared';
import { TicketStack } from './parts/tickets';
import { TopUpForm } from './parts/top-up';
import { bookWithHref, TripsStrip, tripsFor } from './parts/trips';

const PAGE = 6; // cursor page size in the lab

export default function Page() {
  // The gallery toolbar changes `?scenario=` in the hash; a new scenario starts from fresh state.
  const scenario = scenarioFromHash();
  return <Wallet key={scenario} scenario={scenario} />;
}

function Wallet({ scenario }: { scenario: Scenario }) {
  const t = useT(messages);
  const locale = useLocale();
  const data = useMemo(() => walletScenario(scenario), [scenario]);
  const { shown, toggle } = useAmountsShown();

  const [wallet, setWallet] = useState<WalletBalance | null>(data.balance);
  const [txs, setTxs] = useState<WalletTransaction[]>(data.transactions);
  const [loyalty, setLoyalty] = useState(data.loyalty);
  const [loaded, setLoaded] = useState(PAGE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openStory, setOpenStory] = useState<string | null>(null);
  const [selectedPts, setSelectedPts] = useState(Math.min(1000, data.loyalty.pointsBalance));
  const [amount, setAmount] = useState(
    data.topUpResult === 'failed' || data.topUpResult === 'pending' ? RETURNING_TOPUP.replace('.00', '') : '50',
  );
  const amountRef = useRef<HTMLInputElement>(null);

  const { minUsd, maxUsd } = topUpLimits;
  const frozen = wallet?.status === 'FROZEN';
  const items = txs.slice(0, loaded);
  const hasMore = txs.length > loaded;
  const hold = useMemo(() => activeHold(txs), [txs]);
  const trips = useMemo(() => tripsFor(data.searches[locale], locale), [data, locale]);

  const focusAmount = () => {
    amountRef.current?.focus({ preventScroll: true });
    amountRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const showHold = () => {
    if (!hold) return;
    setOpenStory(hold.paymentId);
    window.setTimeout(() => {
      const el = document.getElementById(`story-${hold.paymentId}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    }, 30);
  };

  // Lab stand-in for POST /loyalty/redeem → RedeemPointsResultDto. The credited amount is the server's string.
  const redeem = (points: number) =>
    new Promise<{ amountUsd: string; points: number }>((resolve) => {
      window.setTimeout(() => {
        const amountUsd = previewUsd(points, loyalty.redemption.pointValueUsd);
        setLoyalty((l) => ({ ...l, pointsBalance: l.pointsBalance - points }));
        setSelectedPts(0);
        setWallet((w) => w && { ...w, available: addDecimal(w.available, amountUsd), balance: addDecimal(w.balance, amountUsd) });
        setTxs((list) => {
          const before = wallet?.balance ?? '0.00';
          const tx: WalletTransaction = {
            id: `tx_local_${list.length}`,
            type: 'REDEMPTION',
            direction: 'CREDIT',
            amount: amountUsd,
            balanceBefore: before,
            balanceAfter: addDecimal(before, amountUsd),
            createdAt: new Date().toISOString(),
            description: 'Points redeemed',
            reversalOfId: null,
            reference: { id: `loy_local_${list.length}`, type: 'LOYALTY' },
          };
          return [tx, ...list];
        });
        setLoaded((n) => n + 1);
        resolve({ amountUsd, points });
      }, 900);
    });

  // After "Show more" the button may disappear: focus moves to the first newly loaded movement.
  const loadMore = () => {
    const firstNew = txs[loaded]?.id;
    setLoadingMore(true);
    window.setTimeout(() => {
      setLoaded(txs.length);
      setLoadingMore(false);
      window.setTimeout(() => {
        const el = firstNew ? document.querySelector<HTMLElement>(`[data-txids~="${firstNew}"]`) : null;
        el?.focus({ preventScroll: true });
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 30);
    }, 700);
  };

  const focusValve = () => {
    const el = document.getElementById(VALVE_INPUT_ID);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <ShownContext.Provider value={shown}>
      <main className="min-h-dvh bg-background pb-24 text-foreground">
        {/* Lab-only stand-in for the end of the wallet hero, so the overlap reads as on the real page. */}
        <div aria-hidden className="h-44 bg-gradient-to-b from-primary to-ocean dark:from-ocean-deep dark:to-secondary-dark" />

        <div className="relative z-10 mx-auto -mt-32 max-w-[1240px] space-y-10 px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            <TopUpBanner result={data.topUpResult} onRetry={focusAmount} />

            {!wallet ? (
              <PanelSkeleton />
            ) : (
              <section
                aria-labelledby="panel-title"
                className="rounded-3xl border border-slate-100 bg-card p-4 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)] sm:p-6 lg:p-8 dark:border-slate-800 dark:bg-secondary-dark"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="panel-title" className="text-xl font-extrabold text-primary sm:text-2xl dark:text-white">
                      {t.panelTitle}
                    </h2>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden />
                      {t.promise}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-pressed={shown}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-bold hover:bg-muted',
                      focusRing,
                    )}
                  >
                    {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    {shown ? t.hideAmounts : t.showAmounts}
                  </button>
                </header>

                {/* Two sides, each read top to bottom (DOM order = visual order at every width):
                    cash (tank, then top-up) and points (tank, then the valve that pours toward cash). */}
                <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-0">
                  <div className="min-w-0 space-y-6 lg:pe-10" data-side="cash">
                    <div className="flex min-w-0 items-start gap-3 sm:gap-5">
                      <CashTank
                        available={wallet.available}
                        reserved={wallet.reserved}
                        amount={frozen ? '' : amount}
                        minUsd={minUsd}
                        maxUsd={maxUsd}
                        markers={frozen ? [] : trips.map((tr) => ({ id: tr.id, iata: tr.iata, price: tr.price }))}
                        frozen={frozen}
                        pouring={data.topUpResult === 'pending'}
                        interactive={!frozen && data.topUpResult !== 'pending'}
                        onAmount={setAmount}
                        sizeClass="h-[240px] w-[84px] lg:h-[300px] lg:w-[112px]"
                      />
                      <div className="min-w-0 flex-1 pt-6">
                        <CashCaption
                          available={wallet.available}
                          reserved={wallet.reserved}
                          holdLabel={hold?.label?.title[locale] ?? null}
                          frozen={frozen}
                          bookHref={bookWithHref(trips, wallet.available, shown, locale)}
                          onHold={showHold}
                        />
                      </div>
                    </div>

                    <PointsChip loyalty={loyalty} onConvert={frozen ? undefined : focusValve} />

                    {!frozen && (
                      <div className="@container min-w-0 border-t border-dashed border-border pt-6">
                        <TopUpForm
                          ref={amountRef}
                          amount={amount}
                          onAmount={setAmount}
                          available={wallet.available}
                          minUsd={minUsd}
                          maxUsd={maxUsd}
                        />
                      </div>
                    )}
                  </div>

                  <div
                    className="min-w-0 space-y-6 border-t border-dashed border-amber-500/40 pt-8 lg:border-t-0 lg:border-s lg:ps-10 lg:pt-0 dark:border-secondary-foreground/25"
                    data-side="points"
                  >
                    <div className="flex min-w-0 items-start gap-4 pt-6 sm:gap-5">
                      <PointsTank loyalty={loyalty} selected={frozen ? 0 : selectedPts} sizeClass="h-[170px] w-[68px] lg:h-[220px] lg:w-[88px]" />
                      <PointsCaption loyalty={loyalty} />
                    </div>
                    <Valve
                      loyalty={loyalty}
                      frozen={frozen}
                      selected={selectedPts}
                      onSelected={setSelectedPts}
                      onRedeem={redeem}
                    />
                  </div>
                </div>
              </section>
            )}
          </div>

          {wallet && !frozen && (
            <TripsStrip
              trips={trips}
              available={wallet.available}
              amount={amount}
              minUsd={minUsd}
              onShowAmounts={toggle}
              onFill={(gap) => {
                setAmount(gap.endsWith('.00') ? gap.slice(0, -3) : gap);
                focusAmount();
              }}
            />
          )}

          {wallet ? (
            <TicketStack items={items} hasMore={hasMore} loadingMore={loadingMore} onMore={loadMore} openStory={openStory} />
          ) : null}
        </div>
      </main>
    </ShownContext.Provider>
  );
}

