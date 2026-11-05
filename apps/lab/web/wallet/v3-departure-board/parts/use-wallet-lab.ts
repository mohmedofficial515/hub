import { useCallback, useState } from 'react';
import {
  walletScenario,
  type LoyaltySummary,
  type Scenario,
  type WalletBalance,
  type WalletTransaction,
} from '@lab/mocks/wallet';
import { addDecimal, pointsToUsd } from './money';

/** Page size of `GET /wallet/transactions?limit=` in this lab (small on purpose, to show cursor paging). */
export const PAGE_SIZE = 6;
/** Amount the lab pretends the returning top-up (`?payment=`) was for. */
export const RETURNED_TOPUP = '100.00';

const SHOWN_KEY = 'wallet.balance.shown';
const GOAL_KEY = 'wallet.v3.goal';

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: per-session only */
  }
}

/** Real key and default from balance-card.tsx: amounts start hidden, the choice is remembered. */
export function useAmountsShown() {
  const [shown, setShown] = useState(() => readStore(SHOWN_KEY) === 'true');
  const toggle = useCallback(() => {
    setShown((s) => {
      writeStore(SHOWN_KEY, String(!s));
      return !s;
    });
  }, []);
  return { shown, toggle };
}

export function useGoal() {
  const [goalId, setGoalId] = useState<string | null>(() => readStore(GOAL_KEY));
  const setGoal = useCallback((id: string | null) => {
    writeStore(GOAL_KEY, id);
    setGoalId(id);
  }, []);
  return { goalId, setGoal };
}

export type TopUpReturn = 'pending' | 'done' | 'failed' | null;

/**
 * Lab state machine standing in for useWallet / useWalletTransactions / useLoyalty / useRedeemPoints / usePayment.
 * Everything is derived from the scenario once (the page remounts this when `?scenario=` changes).
 */
export function useWalletLab(scenario: Scenario | 'error') {
  const data = walletScenario(scenario === 'error' ? 'default' : scenario);
  const loading = scenario === 'loading';

  const [balance, setBalance] = useState<WalletBalance | null>(() => {
    if (!data.balance) return null;
    if (data.topUpResult !== 'done') return data.balance;
    return {
      ...data.balance,
      available: addDecimal(data.balance.available, RETURNED_TOPUP),
      balance: addDecimal(data.balance.balance, RETURNED_TOPUP),
    };
  });

  const [all, setAll] = useState<WalletTransaction[]>(() => {
    if (data.topUpResult !== 'done' || !data.balance) return data.transactions;
    const before = data.balance.balance;
    const tx: WalletTransaction = {
      id: 'tx_lab_topup',
      type: 'TOPUP',
      direction: 'CREDIT',
      amount: RETURNED_TOPUP,
      balanceBefore: before,
      balanceAfter: addDecimal(before, RETURNED_TOPUP),
      createdAt: '2026-10-27T16:02:00Z',
      description: 'Wallet top-up',
      reversalOfId: null,
      reference: { id: 'tpu_lab', type: 'TOPUP' },
    };
    return [tx, ...data.transactions];
  });

  const [loaded, setLoaded] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [logError, setLogError] = useState(scenario === 'error');
  const [loyalty, setLoyalty] = useState<LoyaltySummary>(data.loyalty);
  const [topUpReturn, setTopUpReturn] = useState<TopUpReturn>(data.topUpResult);

  // A pending return resolves itself in the real app (usePayment polls every 3 s); the lab keeps it pending so the
  // state can be reviewed.

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    window.setTimeout(() => {
      setLoaded((n) => n + PAGE_SIZE);
      setLoadingMore(false);
    }, 650);
  }, []);

  const retryLog = useCallback(() => {
    setLoadingMore(true);
    window.setTimeout(() => {
      setLogError(false);
      setLoadingMore(false);
    }, 650);
  }, []);

  /** Stand-in for POST /loyalty/redeem → RedeemPointsResultDto { amountUsd, points, pointsBalance, transaction }. */
  const redeem = useCallback(
    (points: number) =>
      new Promise<string>((resolve) => {
        window.setTimeout(() => {
          const amountUsd = pointsToUsd(points, loyalty.redemption.pointValueUsd);
          setBalance((b) =>
            b ? { ...b, available: addDecimal(b.available, amountUsd), balance: addDecimal(b.balance, amountUsd) } : b,
          );
          setAll((txs) => {
            const before = txs[0]?.balanceAfter ?? '0.00';
            const tx: WalletTransaction = {
              id: `tx_lab_redeem_${txs.length}`,
              type: 'REDEMPTION',
              direction: 'CREDIT',
              amount: amountUsd,
              balanceBefore: before,
              balanceAfter: addDecimal(before, amountUsd),
              createdAt: new Date().toISOString(),
              description: 'Points redeemed',
              reversalOfId: null,
              reference: { id: `loy_lab_${txs.length}`, type: 'LOYALTY' },
            };
            return [tx, ...txs];
          });
          setLoaded((n) => n + 1);
          setLoyalty((l) => {
            const left = l.pointsBalance - points;
            return { ...l, pointsBalance: left, redemption: { ...l.redemption, maxPoints: Math.min(l.redemption.maxPoints, left) } };
          });
          resolve(amountUsd);
        }, 900);
      }),
    [loyalty.redemption.pointValueUsd],
  );

  return {
    loading,
    balance,
    transactions: all.slice(0, loaded),
    hasMore: loaded < all.length,
    loadMore,
    loadingMore,
    logError,
    retryLog,
    loyalty,
    redeem,
    searches: data.searches,
    topUpReturn,
    dismissTopUpReturn: () => setTopUpReturn(null),
  };
}

export type WalletLab = ReturnType<typeof useWalletLab>;
