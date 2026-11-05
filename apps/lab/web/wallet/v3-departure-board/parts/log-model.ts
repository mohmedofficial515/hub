import { bookingLabels, type BookingLabel, type WalletTransaction } from '@lab/mocks/wallet';
import { sumDecimals as sumDecimal } from '@web/apiEndpoint/shared/money';

/**
 * Lab-only: refund id → payment id. In the real app this comes from `PaymentDto.refunds[]` (destination WALLET) once
 * the payment is fetched; a direct `reference.bookingId` on wallet rows is a "needs backend" request.
 */
const REFUND_TO_PAYMENT: Record<string, string> = { ref_31: 'pay_64' };

const STORY_TYPES = new Set(['RESERVE', 'CAPTURE', 'RELEASE', 'PAYMENT']);

export type StoryState = 'held' | 'paid' | 'released' | 'refunded';

export interface Story {
  kind: 'story';
  key: string;
  /** Newest first, as the API returns them. */
  txs: WalletTransaction[];
  latest: WalletTransaction;
  state: StoryState;
  incomplete: boolean;
  label: BookingLabel | undefined;
}

export interface Single {
  kind: 'single';
  key: string;
  tx: WalletTransaction;
  latest: WalletTransaction;
}

export type Entry = Story | Single;

function storyKey(tx: WalletTransaction): string | null {
  if (STORY_TYPES.has(tx.type) && tx.reference?.type === 'PAYMENT') return tx.reference.id;
  if (tx.type === 'REFUND' && tx.reference?.type === 'REFUND') return REFUND_TO_PAYMENT[tx.reference.id] ?? null;
  return null;
}

export function buildEntries(txs: WalletTransaction[]): Entry[] {
  const entries: Entry[] = [];
  const stories = new Map<string, Story>();
  for (const tx of txs) {
    const key = storyKey(tx);
    if (!key) {
      entries.push({ kind: 'single', key: tx.id, tx, latest: tx });
      continue;
    }
    const hit = stories.get(key);
    if (hit) {
      hit.txs.push(tx);
      continue;
    }
    const story: Story = {
      kind: 'story',
      key,
      txs: [tx],
      latest: tx,
      state: 'held',
      incomplete: false,
      label: bookingLabels.find((b) => b.paymentId === key),
    };
    stories.set(key, story);
    entries.push(story);
  }
  for (const s of stories.values()) {
    const types = new Set(s.txs.map((t) => t.type));
    s.state = types.has('REFUND') ? 'refunded' : types.has('CAPTURE') || types.has('PAYMENT') ? 'paid' : types.has('RELEASE') ? 'released' : 'held';
    s.incomplete = !types.has('RESERVE') && (types.has('CAPTURE') || types.has('RELEASE'));
  }
  return entries;
}

/** Holds still open: stories whose only step is RESERVE. */
export function openHolds(txs: WalletTransaction[]): Story[] {
  return buildEntries(txs).filter((e): e is Story => e.kind === 'story' && e.state === 'held');
}

const IN_TYPES = new Set(['TOPUP', 'REFUND', 'REDEMPTION', 'ADJUSTMENT', 'REVERSAL']);
const OUT_TYPES = new Set(['CAPTURE', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL']);

export interface Month {
  key: string; // YYYY-MM
  entries: Entry[];
  in: string;
  out: string;
  complete: boolean;
}

/**
 * Month buckets by each entry's latest movement. Totals count money that changed the ledger balance (holds and
 * releases are excluded). A month is complete once something older is loaded, or the log has no more pages.
 */
export function byMonth(entries: Entry[], loaded: WalletTransaction[], hasMore: boolean): Month[] {
  const months: Month[] = [];
  for (const e of entries) {
    const key = e.latest.createdAt.slice(0, 7);
    let m = months.find((x) => x.key === key);
    if (!m) {
      m = { key, entries: [], in: '0', out: '0', complete: false };
      months.push(m);
    }
    m.entries.push(e);
  }
  const oldest = loaded[loaded.length - 1]?.createdAt.slice(0, 7);
  for (const m of months) {
    const txs = loaded.filter((t) => t.createdAt.startsWith(m.key));
    m.in = sumDecimal(txs.filter((t) => t.direction === 'CREDIT' && IN_TYPES.has(t.type)).map((t) => t.amount));
    m.out = sumDecimal(txs.filter((t) => t.direction === 'DEBIT' && OUT_TYPES.has(t.type)).map((t) => t.amount));
    m.complete = !hasMore || (oldest !== undefined && oldest < m.key);
  }
  return months;
}

export type Filter = 'all' | 'trips' | 'topups' | 'refunds' | 'points';

export function matches(e: Entry, f: Filter): boolean {
  if (f === 'all') return true;
  if (e.kind === 'story') return f === 'trips' || (f === 'refunds' && e.state === 'refunded');
  const t = e.tx.type;
  if (f === 'topups') return t === 'TOPUP';
  if (f === 'refunds') return t === 'REFUND';
  if (f === 'points') return t === 'REDEMPTION';
  return false;
}
