import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plane,
  Plus,
  RotateCw,
  XCircle,
} from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { cn } from '@lab/utils';
import { paymentMethods, type FlightSearchEntry, type LoyaltySummary, type WalletBalance } from '@lab/mocks/wallet';
import { messages } from '../i18n';
import { Amount } from './amount';
import { useMedia } from './hooks';
import { formatUsd, isolate, MASK, toCents } from './money';
import { PointsStrip } from './points-strip';
import { Refuel, type RefuelRequest } from './refuel';
import { TripChips } from './trip-chips';
import { RETURN_TOPUP } from './use-wallet-lab';

const focusRing =
  'focus-visible:ring-[3px] focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary dark:focus-visible:ring-offset-ocean-deep focus-visible:outline-none';

interface CockpitProps {
  balance: WalletBalance | null;
  walletError: boolean;
  onRetry: () => void;
  shown: boolean;
  onToggleShown: () => void;
  holdCount: number;
  onJumpToHold: () => void;
  searches: FlightSearchEntry[];
  loyalty: LoyaltySummary;
  onRedeem: (points: number) => Promise<{ amountUsd: string; points: number }>;
  topUpResult: 'pending' | 'done' | 'failed' | null;
  onDismissResult: () => void;
  empty: boolean;
}

/** Dashed great-circle route behind the instruments (decorative). */
function RouteDecor() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full rtl:-scale-x-100"
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="fp-glow" cx="0.15" cy="0.1" r="0.6">
          <stop offset="0" stopColor="#2db2b9" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2db2b9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="420" fill="url(#fp-glow)" />
      <path d="M-20 380 C 260 60, 760 -10, 1220 150" fill="none" stroke="white" strokeOpacity="0.09" strokeWidth="2" strokeDasharray="3 10" />
      <path d="M-20 430 C 340 170, 820 120, 1220 300" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="2" strokeDasharray="3 10" />
    </svg>
  );
}

export function Cockpit(props: CockpitProps) {
  const t = useT(messages);
  const locale = useLocale();
  const reduce = useReducedMotion();
  const desktop = useMedia('(min-width: 1024px)');
  const { balance, shown, empty } = props;
  const [refuelOpen, setRefuelOpen] = useState(empty);
  const [request, setRequest] = useState<RefuelRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  const frozen = balance?.status === 'FROZEN';
  const available = balance ? toCents(balance.available) : 0n;
  const reserved = balance ? toCents(balance.reserved) : 0n;

  const prefill = (amount: string, method?: string) => {
    setRefuelOpen(true);
    setRequest({ amount, method, nonce: Date.now() });
  };

  const refuel =
    balance && !frozen ? (
      <Refuel
        available={available}
        shown={shown}
        request={request}
        initialAmount={empty ? '50' : ''}
        onClose={desktop ? undefined : () => setRefuelOpen(false)}
      />
    ) : null;

  const lockPanel = (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5" role="note">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-amber-400/15 text-amber-300">
          <Lock className="size-5" aria-hidden />
        </span>
        <h3 className="text-lg font-bold">{t.frozenTitle}</h3>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-white/80">{t.frozenBody}</p>
      <a
        href="#support"
        onClick={(e) => e.preventDefault()}
        className={cn('mt-4 inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-bold text-ocean-deep', focusRing)}
      >
        {t.contactSupport}
      </a>
    </div>
  );

  return (
    <section
      aria-labelledby="fp-available"
      className="relative isolate overflow-hidden rounded-3xl bg-primary text-white shadow-2xl shadow-primary/25 dark:bg-ocean-deep dark:shadow-black/40"
    >
      {/* Frozen: only the surface desaturates; text keeps its contrast. */}
      {frozen && <div className="absolute inset-0 -z-10 bg-slate-700/70 backdrop-grayscale" aria-hidden />}
      <RouteDecor />

      <div className="relative grid gap-6 p-4 sm:p-7 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-10 lg:p-9 xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-secondary">
              <Plane className="size-4 rtl:-scale-x-100" aria-hidden />
              {t.kicker}
            </p>
            {balance && (
              <button
                type="button"
                onClick={props.onToggleShown}
                aria-pressed={shown}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-3 text-sm font-medium text-white/90 hover:bg-white/10',
                  focusRing,
                )}
              >
                {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                {shown ? t.hideAmounts : t.showAmounts}
              </button>
            )}
          </div>

          {props.walletError ? (
            <div role="alert" className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-6 shrink-0 text-amber-300" aria-hidden />
                <p id="fp-available" className="text-lg font-bold">
                  {t.walletError}
                </p>
              </div>
              <p className="mt-2 text-sm text-white/75">{t.walletErrorSub}</p>
              <button
                type="button"
                onClick={props.onRetry}
                className={cn('mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-ocean-deep', focusRing)}
              >
                <RotateCw className="size-4" aria-hidden />
                {t.retry}
              </button>
            </div>
          ) : !balance ? (
            <div aria-busy="true" aria-label={t.loading} className="flex flex-col gap-3">
              <div className="h-4 w-28 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
              <div className="h-14 w-64 max-w-full animate-pulse rounded-xl bg-white/15 motion-reduce:animate-none" />
              <div className="h-9 w-56 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
              <div className="mt-2 flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 w-36 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" />
                ))}
              </div>
              <div className="h-16 animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              <div>
                <h2 id="fp-available" className="text-sm font-medium text-white/75">
                  {t.availableNow}
                </h2>
                <p className="mt-1 text-5xl leading-none font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
                  <Amount cents={available} shown={shown} countUp />
                </p>
                {empty && <p className="mt-3 max-w-md text-sm text-white/80">{t.fundReady}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {reserved > 0n && (
                    <button
                      type="button"
                      onClick={props.onJumpToHold}
                      aria-label={`${shown ? formatUsd(reserved) : MASK} ${t.heldFor(props.holdCount)}. ${t.jumpToHold}`}
                      className={cn(
                        'group inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-amber-300/70 bg-amber-300/10 ps-3 pe-2 text-sm font-medium text-amber-100 hover:bg-amber-300/20',
                        focusRing,
                      )}
                    >
                      <span className="size-2 rounded-full bg-amber-300" aria-hidden />
                      <Amount cents={reserved} shown={shown} className="font-bold text-white" />
                      <span>{t.heldFor(props.holdCount)}</span>
                      <Chevron className="size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden />
                    </button>
                  )}
                  <p className="flex items-center gap-1.5 text-sm text-white/80">
                    <CheckCircle2 className="size-4 text-secondary" aria-hidden />
                    {t.autoApply}
                  </p>
                </div>
                <ResultPill
                  result={props.topUpResult}
                  notice={notice}
                  shown={shown}
                  onDismiss={() => {
                    props.onDismissResult();
                    setNotice(null);
                  }}
                  onRetry={() => prefill(RETURN_TOPUP, `${paymentMethods[0].gateway}:${paymentMethods[0].methodKind}`)}
                />
              </div>


              {!frozen && (
                <div className="flex flex-wrap gap-2">
                  {!desktop && (
                    <button
                      type="button"
                      aria-expanded={refuelOpen}
                      onClick={() => setRefuelOpen((o) => !o)}
                      className={cn(
                        'flex min-h-12 flex-1 basis-40 items-center justify-center gap-2 rounded-xl bg-secondary px-4 font-bold text-ocean-deep hover:bg-secondary/90',
                        focusRing,
                      )}
                    >
                      <Plus className="size-5" aria-hidden />
                      {t.topUp}
                    </button>
                  )}
                  <a
                    href="#flights"
                    onClick={(e) => e.preventDefault()}
                    className={cn(
                      'flex min-h-12 flex-1 basis-40 items-center justify-center gap-2 rounded-xl border border-white/25 px-4 font-bold text-white hover:bg-white/10 lg:flex-none',
                      focusRing,
                    )}
                  >
                    <Plane className="size-4 rtl:-scale-x-100" aria-hidden />
                    {t.bookWithBalance}
                  </a>
                </div>
              )}

              {!desktop && (
                <AnimatePresence initial={false}>
                  {(frozen || refuelOpen) && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="-mx-1 overflow-hidden px-1 py-1"
                    >
                      {frozen ? lockPanel : refuel}
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {!frozen && <TripChips available={available} shown={shown} searches={props.searches} onGap={(a) => prefill(a)} />}

              <PointsStrip
                loyalty={props.loyalty}
                shown={shown}
                frozen={frozen}
                onRedeem={props.onRedeem}
                onRedeemed={setNotice}
              />
            </>
          )}
        </div>

        {desktop && balance && <div className="self-start">{frozen ? lockPanel : refuel}</div>}
        {desktop && !balance && !props.walletError && (
          <div className="h-[30rem] animate-pulse rounded-2xl bg-white/10 motion-reduce:animate-none" aria-hidden />
        )}
      </div>
    </section>
  );
}

function ResultPill({
  result,
  notice,
  shown,
  onDismiss,
  onRetry,
}: {
  result: 'pending' | 'done' | 'failed' | null;
  notice: string | null;
  shown: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const t = useT(messages);
  const amount = isolate(shown ? formatUsd(toCents(RETURN_TOPUP)) : MASK);
  const kind = notice ? 'done' : result;
  const text = notice ?? (result === 'pending' ? t.pending(amount) : result === 'done' ? t.done(amount) : result === 'failed' ? t.failed : null);

  return (
    <div role="status" aria-live="polite" className="[&:not(:empty)]:mt-4">
      {kind && text && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-3',
            kind === 'pending' && 'border-white/20 bg-white/5',
            kind === 'done' && 'border-secondary/50 bg-secondary/15',
            kind === 'failed' && 'border-rose-300/50 bg-rose-400/15',
          )}
        >
          {kind === 'pending' && <Loader2 className="size-5 shrink-0 animate-spin text-secondary motion-reduce:animate-none" aria-hidden />}
          {kind === 'done' && <CheckCircle2 className="size-5 shrink-0 text-secondary" aria-hidden />}
          {kind === 'failed' && <XCircle className="size-5 shrink-0 text-rose-300" aria-hidden />}
          <div className="min-w-0 flex-1 basis-52">
            <p className="text-sm font-bold">{text}</p>
            {kind === 'pending' && <p className="text-xs text-white/70">{t.pendingSub}</p>}
          </div>
          {kind === 'failed' && (
            <button
              type="button"
              onClick={onRetry}
              className={cn('min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-ocean-deep', focusRing)}
            >
              {t.tryAgain}
            </button>
          )}
          {kind !== 'pending' && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn('min-h-11 rounded-xl px-3 text-sm font-medium text-white/80 underline-offset-4 hover:underline', focusRing)}
            >
              {t.dismiss}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
