import type { BookingLabel, WalletTransaction } from '@lab/mocks/wallet';
import { bookingLabels } from '@lab/mocks/wallet';
import { toCents, type Cents } from './money';

/**
 * Lab stand-in for `PaymentDto.refunds[]` (destination WALLET): which payment a refund belongs to.
 * In the real app this is only known after `GET /payments/{id}`; robust linking needs backend.
 */
export const refundToPayment: Record<string, string> = { ref_31: 'pay_64' };

export type Category = 'trips' | 'topups' | 'refunds' | 'points' | 'other';
export type Filter = 'all' | Exclude<Category, 'other'>;
export const FILTERS: Filter[] = ['all', 'trips', 'topups', 'refunds', 'points'];

export type StepKind = 'held' | 'paid' | 'released' | 'refunded';
export type StoryStatus = 'hold' | 'paid' | 'released' | 'refunded';

export interface StoryStep {
  kind: StepKind;
  tx: WalletTransaction;
  availableAfter: Cents;
}

export interface StoryEntry {
  kind: 'story';
  key: string;
  paymentId: string;
  label: BookingLabel | undefined;
  steps: StoryStep[]; // oldest first
  status: StoryStatus;
  amount: Cents;
  refunded: Cents;
  balanceAfter: Cents;
  /** Available (balance − held) right after the newest step: the same concept as the hero number. */
  availableAfter: Cents;
  at: string;
  partial: boolean; // earlier steps live on a page that is not loaded yet
  categories: Category[];
}

export interface SingleEntry {
  kind: 'single';
  key: string;
  tx: WalletTransaction;
  balanceAfter: Cents;
  availableAfter: Cents;
  at: string;
  categories: Category[];
}

export type Entry = StoryEntry | SingleEntry;

const STORY_TYPES = new Set(['RESERVE', 'CAPTURE', 'RELEASE', 'PAYMENT']);

const stepOf = (tx: WalletTransaction): StepKind =>
  tx.type === 'RESERVE' ? 'held' : tx.type === 'RELEASE' ? 'released' : tx.type === 'REFUND' ? 'refunded' : 'paid';

function categoryOf(tx: WalletTransaction): Category {
  switch (tx.type) {
    case 'TOPUP':
      return 'topups';
    case 'REFUND':
      return 'refunds';
    case 'REDEMPTION':
      return 'points';
    case 'PAYMENT':
    case 'CAPTURE':
    case 'RESERVE':
    case 'RELEASE':
      return 'trips';
    default:
      return 'other';
  }
}

/**
 * "Available after" for every loaded movement, so each running figure matches the hero (`available`), never the
 * ledger `balance`. Anchored on the server's current `reserved` and walked backwards (newest → oldest): before a
 * RESERVE the held total was smaller by its amount; before a CAPTURE/RELEASE it was larger (the hold it consumed).
 * Exact for every loaded page, whatever is not loaded yet.
 */
export function availableAfterById(txs: WalletTransaction[], reservedNow: Cents): Map<string, Cents> {
  const out = new Map<string, Cents>();
  const newestFirst = [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  let held = reservedNow;
  for (const tx of newestFirst) {
    out.set(tx.id, toCents(tx.balanceAfter) - held);
    const amount = toCents(tx.amount);
    if (tx.type === 'RESERVE') held -= amount;
    else if (tx.type === 'CAPTURE' || tx.type === 'RELEASE') held += amount;
    if (held < 0n) held = 0n;
  }
  return out;
}

/** RESERVE + CAPTURE/RELEASE (+ linked REFUND) → one booking story; everything else stays a single waypoint. */
export function buildEntries(txs: WalletTransaction[], reservedNow: Cents): Entry[] {
  const avail = availableAfterById(txs, reservedNow);
  const availOf = (tx: WalletTransaction) => avail.get(tx.id) ?? toCents(tx.balanceAfter);
  const stories = new Map<string, WalletTransaction[]>();
  const singles: WalletTransaction[] = [];

  for (const tx of txs) {
    if (tx.reference?.type === 'PAYMENT' && STORY_TYPES.has(tx.type)) {
      const list = stories.get(tx.reference.id) ?? [];
      list.push(tx);
      stories.set(tx.reference.id, list);
    } else singles.push(tx);
  }

  const rest: WalletTransaction[] = [];
  for (const tx of singles) {
    const paymentId = tx.type === 'REFUND' && tx.reference ? refundToPayment[tx.reference.id] : undefined;
    const story = paymentId ? stories.get(paymentId) : undefined;
    if (story) story.push(tx);
    else rest.push(tx);
  }

  const entries: Entry[] = [];

  for (const [paymentId, list] of stories) {
    const steps = [...list]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((tx) => ({ kind: stepOf(tx), tx, availableAfter: availOf(tx) }));
    const kinds = new Set(steps.map((s) => s.kind));
    const newest = steps[steps.length - 1].tx;
    const status: StoryStatus = kinds.has('refunded')
      ? 'refunded'
      : kinds.has('paid')
        ? 'paid'
        : kinds.has('released')
          ? 'released'
          : 'hold';
    const main = steps.find((s) => s.kind === 'paid') ?? steps.find((s) => s.kind === 'held') ?? steps[0];
    const refunded = steps.filter((s) => s.kind === 'refunded').reduce((sum, s) => sum + toCents(s.tx.amount), 0n);
    const hasReserve = kinds.has('held');
    const partial = !hasReserve && steps.some((s) => s.tx.type === 'CAPTURE' || s.tx.type === 'RELEASE');
    entries.push({
      kind: 'story',
      key: `story-${paymentId}`,
      paymentId,
      label: bookingLabels.find((b) => b.paymentId === paymentId),
      steps,
      status,
      amount: toCents(main.tx.amount),
      refunded,
      balanceAfter: toCents(newest.balanceAfter),
      availableAfter: availOf(newest),
      at: newest.createdAt,
      partial,
      categories: refunded > 0n ? ['trips', 'refunds'] : ['trips'],
    });
  }

  for (const tx of rest) {
    entries.push({
      kind: 'single',
      key: tx.id,
      tx,
      balanceAfter: toCents(tx.balanceAfter),
      availableAfter: availOf(tx),
      at: tx.createdAt,
      categories: [categoryOf(tx)],
    });
  }

  return entries.sort((a, b) => b.at.localeCompare(a.at));
}

export const matchesFilter = (entry: Entry, filter: Filter) =>
  filter === 'all' || entry.categories.includes(filter);

export interface MonthGroup {
  key: string; // YYYY-MM
  entries: Entry[];
  inflow: Cents;
  outflow: Cents;
  complete: boolean; // totals are trustworthy only once an older item is loaded (or there is nothing older)
  current: boolean;
}

/** Ledger in/out for a month. Holds (RESERVE/RELEASE) move `available` only, so they are not in/out. */
function monthTotals(txs: WalletTransaction[]) {
  let inflow = 0n;
  let outflow = 0n;
  for (const tx of txs) {
    if (tx.type === 'RESERVE' || tx.type === 'RELEASE') continue;
    const amount = toCents(tx.amount);
    if (tx.direction === 'CREDIT') inflow += amount;
    else outflow += amount;
  }
  return { inflow, outflow };
}

export function groupByMonth(
  entries: Entry[],
  txs: WalletTransaction[],
  hasMore: boolean,
  nowMonth: string,
): MonthGroup[] {
  const oldestLoaded = txs.reduce<string | null>(
    (min, tx) => (min === null || tx.createdAt < min ? tx.createdAt : min),
    null,
  );
  const groups: MonthGroup[] = [];
  for (const entry of entries) {
    const key = entry.at.slice(0, 7);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      const monthTxs = txs.filter((tx) => tx.createdAt.startsWith(key));
      const olderLoaded = oldestLoaded !== null && oldestLoaded.slice(0, 7) < key;
      group = {
        key,
        entries: [],
        ...monthTotals(monthTxs),
        complete: !hasMore || olderLoaded,
        current: key === nowMonth,
      };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

/** Active holds = RESERVE stories that have not landed yet. */
export const activeHolds = (entries: Entry[]) =>
  entries.filter((e): e is StoryEntry => e.kind === 'story' && e.status === 'hold');
