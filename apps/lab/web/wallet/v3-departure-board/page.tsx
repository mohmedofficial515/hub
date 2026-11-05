import { useMemo, useRef, useState } from 'react';
import { useLocale, useT } from '@lab/i18n';
import { scenarioFromHash, type Scenario } from '@lab/mocks/wallet';
import { messages } from './i18n';
import { boardRows, DepartureBoard } from './parts/departure-board';
import { FlightLog } from './parts/flight-log';
import { Gate, parseAmount, type GateHandle } from './parts/gate';
import { openHolds } from './parts/log-model';
import { StatusBar } from './parts/status-bar';
import { TripGoal } from './parts/trip-goal';
import { RETURNED_TOPUP, useAmountsShown, useGoal, useWalletLab } from './parts/use-wallet-lab';

/**
 * v3 — departure board. Content area only (between the wallet hero and the newsletter); the navy band on top stands
 * in for the end of the real hero so the -mt overlap reads as it will in the app.
 */
export default function Page() {
  // The gallery toolbar rewrites `?scenario=` in the hash; the frame re-renders on hashchange, and keying by the
  // scenario resets the lab state machine.
  const scenario = scenarioFromHash() as Scenario | 'error';
  return <WalletDepartures key={scenario} scenario={scenario} />;
}

function WalletDepartures({ scenario }: { scenario: Scenario | 'error' }) {
  const t = useT(messages);
  const locale = useLocale();
  const w = useWalletLab(scenario);
  const { shown, toggle } = useAmountsShown();
  const { goalId, setGoal } = useGoal();
  const [raw, setRaw] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const gate = useRef<GateHandle>(null);

  const frozen = w.balance?.status === 'FROZEN';
  const available = w.balance?.available ?? null;
  const parsed = parseAmount(raw);
  const extra = parsed.ok && !frozen ? parsed.value : null;
  const { rows, curated } = useMemo(() => boardRows(w.searches[locale], locale), [w.searches, locale]);
  const holds = useMemo(() => openHolds(w.transactions), [w.transactions]);
  const goalRow = rows.find((r) => r.id === goalId);

  function openHold(key: string) {
    setOpenKey(key);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLButtonElement>(`[data-story="${key}"]`);
      el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
    });
  }

  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground" aria-busy={w.loading}>
      <div aria-hidden className="h-40 bg-gradient-to-b from-ocean to-primary dark:from-ocean-deep dark:to-primary-dark" />
      <div className="mx-auto -mt-32 max-w-6xl px-4">
        {w.loading && <p className="sr-only" role="status">{t.loading}</p>}

        <StatusBar
          balance={w.balance}
          loading={w.loading}
          shown={shown}
          onToggleShown={toggle}
          holds={holds}
          onOpenHold={openHold}
          loyalty={w.loyalty}
          onRedeem={w.redeem}
        />

        <div className="grid gap-4 rounded-b-3xl border border-t-0 border-border bg-muted/40 p-3 sm:p-4 md:p-5 lg:grid-cols-[minmax(0,1fr)_22rem] dark:bg-card/40">
          <div className="grid min-w-0 content-start gap-4">
            <DepartureBoard
              rows={rows}
              curated={curated}
              available={available}
              extra={extra}
              shown={shown}
              frozen={frozen}
              loading={w.loading}
              goalId={goalId}
              onToggleGoal={(id) => setGoal(goalId === id ? null : id)}
              onAddGap={(amount) => gate.current?.fill(amount)}
              onReveal={toggle}
              topUpReturn={w.topUpReturn}
              onDismissReturn={w.dismissTopUpReturn}
              onRetryTopUp={() => {
                w.dismissTopUpReturn();
                gate.current?.fill(RETURNED_TOPUP.replace(/\.00$/, ''));
              }}
            />
            {!w.loading && (
              <TripGoal row={goalRow} available={available} shown={shown} frozen={frozen} onComplete={(a) => gate.current?.fill(a)} />
            )}
          </div>
          <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <Gate ref={gate} raw={raw} onRaw={setRaw} available={available} shown={shown} frozen={frozen} loading={w.loading} />
          </div>
        </div>

        <div className="mt-6">
          <FlightLog
            transactions={w.transactions}
            hasMore={w.hasMore}
            loadingMore={w.loadingMore}
            onLoadMore={w.loadMore}
            loading={w.loading}
            error={w.logError}
            onRetry={w.retryLog}
            shown={shown}
            openKey={openKey}
            onOpenKey={setOpenKey}
          />
        </div>
      </div>
    </main>
  );
}
