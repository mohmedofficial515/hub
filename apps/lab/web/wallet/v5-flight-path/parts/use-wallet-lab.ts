import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  walletScenario,
  type LoyaltySummary,
  type Scenario,
  type WalletBalance,
  type WalletTransaction,
} from '@lab/mocks/wallet';
import { fromCents, pointsToCents, toCents } from './money';

/** Cursor page size used to simulate `GET /wallet/transactions?cursor&limit`. */
export const PAGE_SIZE = 6;
/** Amount of the top-up the customer returns from (`?payment=` → `GET /payments/{id}`). Lab fixture. */
export const RETURN_TOPUP = '100.00';

/** `error` is a version-local scenario (not in the gallery toolbar): wallet + history fail to load. */
export type LabScenario = Scenario | 'error';

export function readScenario(): LabScenario {
  const query = location.hash.split('?')[1] ?? '';
  const raw = new URLSearchParams(query).get('scenario');
  const known: LabScenario[] = ['default', 'empty', 'loading', 'frozen', 'topup-pending', 'topup-done', 'topup-failed', 'error'];
  return known.includes(raw as LabScenario) ? (raw as LabScenario) : 'default';
}

function initial(scenario: LabScenario) {
  const data = walletScenario(scenario === 'error' ? 'default' : scenario);
  let balance = data.balance;
  let transactions = data.transactions;
  if (scenario === 'topup-done' && balance) {
    // The wallet is refetched once the payment SUCCEEDED, so the new TOPUP is already in the ledger.
    const add = toCents(RETURN_TOPUP);
    const before = toCents(balance.balance);
    balance = {
      ...balance,
      available: fromCents(toCents(balance.available) + add),
      balance: fromCents(before + add),
    };
    transactions = [
      {
        id: 'tx_return',
        type: 'TOPUP',
        direction: 'CREDIT',
        amount: RETURN_TOPUP,
        balanceBefore: fromCents(before),
        balanceAfter: balance.balance,
        createdAt: '2026-10-27T16:02:00Z',
        description: 'Wallet top-up',
        reversalOfId: null,
        reference: { id: 'tpu_10', type: 'TOPUP' },
      },
      ...transactions,
    ];
  }
  return { ...data, balance, transactions };
}

export interface WalletLab {
  scenario: LabScenario;
  balance: WalletBalance | null;
  walletError: boolean;
  retryWallet: () => void;
  transactions: WalletTransaction[]; // loaded pages only
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  historyError: boolean;
  retryHistory: () => void;
  loyalty: LoyaltySummary;
  redeem: (points: number) => Promise<{ amountUsd: string; points: number }>;
  topUpResult: 'pending' | 'done' | 'failed' | null;
  dismissTopUpResult: () => void;
  lastCreditId: string | null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Local, in-memory stand-in for useWallet / useWalletTransactions / useLoyaltySummary / useRedeemPoints. */
export function useWalletLab(scenario: LabScenario): WalletLab {
  const seed = useMemo(() => initial(scenario), [scenario]);
  const [balance, setBalance] = useState(seed.balance);
  const [all, setAll] = useState(seed.transactions);
  const [loaded, setLoaded] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loyalty, setLoyalty] = useState(seed.loyalty);
  const [walletError, setWalletError] = useState(scenario === 'error');
  const [historyError, setHistoryError] = useState(scenario === 'error');
  const [topUpResult, setTopUpResult] = useState(seed.topUpResult);
  const [lastCreditId, setLastCreditId] = useState<string | null>(scenario === 'topup-done' ? 'tx_return' : null);

  // Pending top-ups keep polling in the real app; the lab leaves it pending so the state can be inspected.
  useEffect(() => setTopUpResult(seed.topUpResult), [seed]);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    setTimeout(() => {
      setLoaded((n) => n + PAGE_SIZE);
      setLoadingMore(false);
    }, 650);
  }, []);

  const redeem = useCallback(
    async (points: number) => {
      await wait(800);
      // The server answers with an exact decimal `amountUsd`; the lab derives it from the fixture rate.
      const amountUsd = fromCents(pointsToCents(points, loyalty.redemption.pointValueUsd));
      const add = toCents(amountUsd);
      const id = `tx_redeem_${Date.now()}`;
      if (balance) {
        const before = toCents(balance.balance);
        const next = {
          ...balance,
          available: fromCents(toCents(balance.available) + add),
          balance: fromCents(before + add),
        };
        setBalance(next);
        setAll((list) => [
          {
            id,
            type: 'REDEMPTION',
            direction: 'CREDIT',
            amount: amountUsd,
            balanceBefore: fromCents(before),
            balanceAfter: next.balance,
            // Lab clock: one minute after the newest movement, so the new waypoint lands at the head of the path.
            createdAt: new Date(Math.max(Date.now(), ...list.map((tx) => Date.parse(tx.createdAt) + 60_000))).toISOString(),
            description: 'Points redeemed',
            reversalOfId: null,
            reference: { id: `loy_${Date.now()}`, type: 'LOYALTY' },
          },
          ...list,
        ]);
      }
      setLoaded((n) => n + 1);
      setLastCreditId(id);
      setLoyalty((l) => ({
        ...l,
        pointsBalance: l.pointsBalance - points,
        redemption: { ...l.redemption, maxPoints: Math.max(0, l.redemption.maxPoints - points) },
      }));
      return { amountUsd, points };
    },
    [balance, loyalty.redemption.pointValueUsd],
  );

  return {
    scenario,
    balance: walletError ? null : balance,
    walletError,
    retryWallet: () => setWalletError(false),
    transactions: historyError ? [] : all.slice(0, loaded),
    hasMore: !historyError && loaded < all.length,
    loadingMore,
    loadMore,
    historyError,
    retryHistory: () => setHistoryError(false),
    loyalty,
    redeem,
    topUpResult,
    dismissTopUpResult: () => setTopUpResult(null),
    lastCreditId,
  };
}
