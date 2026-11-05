import { bookingLabels, type BookingLabel, type WalletTransaction } from '@lab/mocks/wallet';
import { fromCents, toCents } from './money';

// Turns the flat ledger into what the customer reads: one boarding pass per booking payment
// (RESERVE → CAPTURE | RELEASE share `reference.id` of the PAYMENT), and receipt slips for money that came in.

export type StoryStatus = 'held' | 'paid' | 'released';
export type ReceiptKind = 'topup' | 'refund' | 'points' | 'opened' | 'adjustment' | 'reversal';
export type Filter = 'all' | 'trips' | 'topups' | 'refunds' | 'points';

export interface BookingStory {
  kind: 'story';
  id: string; // payment id
  status: StoryStatus;
  amount: string; // the booking amount (held, paid or released)
  balanceAfter: string;
  at: string; // newest step
  steps: WalletTransaction[]; // oldest → newest
  missingEarlier: boolean; // a CAPTURE/RELEASE whose RESERVE sits on a page not loaded yet
  label: BookingLabel | null;
}

export interface Receipt {
  kind: 'receipt';
  id: string;
  type: ReceiptKind;
  tx: WalletTransaction;
  at: string;
}

export type Entry = BookingStory | Receipt;

const STORY_TYPES = new Set(['RESERVE', 'CAPTURE', 'RELEASE', 'PAYMENT']);

function receiptKind(tx: WalletTransaction): ReceiptKind {
  switch (tx.type) {
    case 'TOPUP':
      return 'topup';
    case 'REFUND':
      return 'refund';
    case 'REDEMPTION':
      return 'points';
    case 'REVERSAL':
      return 'reversal';
    default:
      return tx.reference?.type === 'ADMIN' && toCents(tx.amount) === 0n ? 'opened' : 'adjustment';
  }
}

export function buildEntries(items: WalletTransaction[]): Entry[] {
  const stories = new Map<string, WalletTransaction[]>();
  const order: Entry[] = [];
  const placed = new Set<string>();

  for (const tx of items) {
    if (STORY_TYPES.has(tx.type) && tx.reference?.type === 'PAYMENT') {
      const key = tx.reference.id;
      const list = stories.get(key) ?? [];
      list.push(tx);
      stories.set(key, list);
      if (!placed.has(key)) {
        placed.add(key);
        order.push({ kind: 'story', id: key } as BookingStory); // filled below, keeps newest-first position
      }
    } else {
      order.push({ kind: 'receipt', id: tx.id, type: receiptKind(tx), tx, at: tx.createdAt });
    }
  }

  return order.map((entry) => {
    if (entry.kind === 'receipt') return entry;
    const newestFirst = stories.get(entry.id)!;
    const steps = [...newestFirst].reverse();
    const paid = steps.find((s) => s.type === 'CAPTURE' || s.type === 'PAYMENT');
    const released = steps.find((s) => s.type === 'RELEASE');
    const reserve = steps.find((s) => s.type === 'RESERVE');
    const status: StoryStatus = paid ? 'paid' : released ? 'released' : 'held';
    const main = paid ?? released ?? reserve ?? steps[0];
    return {
      kind: 'story',
      id: entry.id,
      status,
      amount: main.amount,
      balanceAfter: newestFirst[0].balanceAfter,
      at: newestFirst[0].createdAt,
      steps,
      missingEarlier: !reserve,
      label: bookingLabels.find((b) => b.paymentId === entry.id) ?? null,
    } satisfies BookingStory;
  });
}

export function matchesFilter(entry: Entry, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (entry.kind === 'story') return filter === 'trips';
  if (filter === 'topups') return entry.type === 'topup';
  if (filter === 'refunds') return entry.type === 'refund';
  if (filter === 'points') return entry.type === 'points';
  return false;
}

export interface MonthGroup {
  key: string; // yyyy-mm
  entries: Entry[];
  inCents: bigint;
  outCents: bigint;
  complete: boolean;
}

const monthKey = (iso: string) => iso.slice(0, 7);

/** Month totals use the raw ledger, so a filter never changes them. In = money that arrived; out = money spent. */
export function groupByMonth(entries: Entry[], loaded: WalletTransaction[], hasMore: boolean): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const entry of entries) {
    const key = monthKey(entry.at);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      const txs = loaded.filter((t) => monthKey(t.createdAt) === key);
      let inCents = 0n;
      let outCents = 0n;
      for (const t of txs) {
        if (t.direction === 'CREDIT' && t.type !== 'RELEASE') inCents += toCents(t.amount);
        if (t.direction === 'DEBIT' && (t.type === 'CAPTURE' || t.type === 'PAYMENT')) outCents += toCents(t.amount);
      }
      const complete = !hasMore || loaded.some((t) => monthKey(t.createdAt) < key);
      g = { key, entries: [], inCents, outCents, complete };
      groups.push(g);
    }
    g.entries.push(entry);
  }
  return groups;
}

export const centsStr = fromCents;

/** The booking story that currently holds money (for the held band on the cash tank). */
export function activeHold(items: WalletTransaction[]): { paymentId: string; label: BookingLabel | null } | null {
  const held = buildEntries(items).find((e): e is BookingStory => e.kind === 'story' && e.status === 'held');
  return held ? { paymentId: held.id, label: held.label } : null;
}
