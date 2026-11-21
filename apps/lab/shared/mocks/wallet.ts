// Wallet fixtures shaped like web/src/apiEndpoint/generated/v1/types.gen.ts
// (WalletBalanceDto, WalletTransactionDto, LoyaltySummaryDto, FlightSearchHistoryEntryDto).
// Amounts are decimal strings, exactly as the API returns them — never parse to float for display.

export type WalletStatus = 'ACTIVE' | 'FROZEN';
export type TxDirection = 'CREDIT' | 'DEBIT';
export type TxType =
  | 'TOPUP'
  | 'RESERVE'
  | 'CAPTURE'
  | 'RELEASE'
  | 'PAYMENT'
  | 'REFUND'
  | 'REDEMPTION'
  | 'ADJUSTMENT'
  | 'REVERSAL';
export type TxReferenceType = 'PAYMENT' | 'BOOKING' | 'REFUND' | 'LOYALTY' | 'TOPUP' | 'ADMIN';

export interface WalletBalance {
  available: string;
  balance: string;
  reserved: string;
  currency: 'USD';
  status: WalletStatus;
}

export interface WalletTransaction {
  id: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  createdAt: string;
  description: string | null;
  direction: TxDirection;
  reversalOfId: string | null;
  reference: { id: string; type: TxReferenceType } | null;
  type: TxType;
}

export interface LoyaltySummary {
  lifetimePoints: number;
  lifetimeSpendUsd: string;
  pointsBalance: number;
  nextTier: { code: string; name: { ar: string | null; en: string }; remainingPoints?: number } | null;
  redemption: { enabled: boolean; minPoints: number; maxPoints: number; pointValueUsd: number };
  tier: { code: string; name: { ar: string | null; en: string } };
}

export interface FlightSearchEntry {
  id: string;
  tripType: 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY';
  cabinClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  currency: string;
  departed: boolean;
  searchedAt: string;
  lastSeenPrice: { amount: string; currency: string } | null;
  passengers: { adults: number; children: number[]; infants: number[] };
  slices: {
    departureDate: string;
    origin: { iataCode: string; cityName: string | null; name: string | null };
    destination: { iataCode: string; cityName: string | null; name: string | null };
  }[];
}

export interface PaymentMethodOption {
  gateway: 'STRIPE' | 'MYFATOORAH' | 'PAYMOB' | 'MOYASAR' | 'TAP';
  methodKind: 'card' | 'apple_pay' | 'google_pay';
}

/** Lab-only: in the real app booking labels need a lookup via GET /payments/{id} → bookingId (needs backend for a direct label). */
export interface BookingLabel {
  paymentId: string;
  bookingRef: string;
  title: { ar: string; en: string };
  kind: 'flight' | 'hotel' | 'package';
}

export const topUpLimits = { minUsd: 5, maxUsd: 5000 };
export const topUpPresets = ['25', '50', '100', '250'];

export const paymentMethods: PaymentMethodOption[] = [
  { gateway: 'STRIPE', methodKind: 'card' },
  { gateway: 'STRIPE', methodKind: 'apple_pay' },
  { gateway: 'STRIPE', methodKind: 'google_pay' },
];

// ── Default scenario: matches the owner's baseline screenshot, plus an active hold and points ──

export const balance: WalletBalance = {
  available: '220.00',
  balance: '250.00',
  reserved: '30.00',
  currency: 'USD',
  status: 'ACTIVE',
};

export const transactions: WalletTransaction[] = [
  {
    id: 'tx_09',
    type: 'RESERVE',
    direction: 'DEBIT',
    amount: '30.00',
    balanceBefore: '250.00',
    balanceAfter: '250.00', // a RESERVE moves money out of `available` only
    createdAt: '2026-10-27T15:40:00Z',
    description: 'Wallet payment reservation',
    reversalOfId: null,
    reference: { id: 'pay_77', type: 'PAYMENT' },
  },
  {
    id: 'tx_08',
    type: 'REDEMPTION',
    direction: 'CREDIT',
    amount: '21.01',
    balanceBefore: '228.99',
    balanceAfter: '250.00',
    createdAt: '2026-10-27T15:10:00Z',
    description: 'Points redeemed',
    reversalOfId: null,
    reference: { id: 'loy_12', type: 'LOYALTY' },
  },
  {
    id: 'tx_07',
    type: 'REFUND',
    direction: 'CREDIT',
    amount: '228.99',
    balanceBefore: '0.00',
    balanceAfter: '228.99',
    createdAt: '2026-10-27T15:07:00Z',
    description: 'Refund to wallet',
    reversalOfId: null,
    reference: { id: 'ref_31', type: 'REFUND' },
  },
  {
    id: 'tx_06',
    type: 'CAPTURE',
    direction: 'DEBIT',
    amount: '228.99',
    balanceBefore: '228.99',
    balanceAfter: '0.00',
    createdAt: '2026-10-27T15:06:30Z',
    description: null,
    reversalOfId: null,
    reference: { id: 'pay_64', type: 'PAYMENT' },
  },
  {
    id: 'tx_05',
    type: 'RESERVE',
    direction: 'DEBIT',
    amount: '228.99',
    balanceBefore: '228.99',
    balanceAfter: '228.99',
    createdAt: '2026-10-27T15:06:00Z',
    description: 'Wallet payment reservation',
    reversalOfId: null,
    reference: { id: 'pay_64', type: 'PAYMENT' },
  },
  {
    id: 'tx_04',
    type: 'RELEASE',
    direction: 'CREDIT',
    amount: '21.01',
    balanceBefore: '228.99',
    balanceAfter: '228.99',
    createdAt: '2026-10-26T09:20:00Z',
    description: null,
    reversalOfId: null,
    reference: { id: 'pay_51', type: 'PAYMENT' },
  },
  {
    id: 'tx_03',
    type: 'RESERVE',
    direction: 'DEBIT',
    amount: '21.01',
    balanceBefore: '228.99',
    balanceAfter: '228.99',
    createdAt: '2026-10-26T09:02:00Z',
    description: 'Wallet payment reservation',
    reversalOfId: null,
    reference: { id: 'pay_51', type: 'PAYMENT' },
  },
  {
    id: 'tx_02',
    type: 'TOPUP',
    direction: 'CREDIT',
    amount: '228.99',
    balanceBefore: '0.00',
    balanceAfter: '228.99',
    createdAt: '2026-10-12T14:57:00Z',
    description: 'Wallet top-up',
    reversalOfId: null,
    reference: { id: 'tpu_9', type: 'TOPUP' },
  },
  {
    id: 'tx_01',
    type: 'ADJUSTMENT',
    direction: 'CREDIT',
    amount: '0.00',
    balanceBefore: '0.00',
    balanceAfter: '0.00',
    createdAt: '2026-09-30T10:00:00Z',
    description: 'Wallet opened',
    reversalOfId: null,
    reference: { id: 'adm_1', type: 'ADMIN' },
  },
];

export const bookingLabels: BookingLabel[] = [
  { paymentId: 'pay_77', bookingRef: 'GT-10421', kind: 'hotel', title: { ar: 'فندق في إسطنبول · ليلة واحدة', en: 'Istanbul hotel · 1 night' } },
  { paymentId: 'pay_64', bookingRef: 'GT-10388', kind: 'flight', title: { ar: 'القاهرة ← دبي', en: 'Cairo → Dubai' } },
  { paymentId: 'pay_51', bookingRef: 'GT-10302', kind: 'package', title: { ar: 'باقة شرم الشيخ', en: 'Sharm El Sheikh package' } },
];

export const loyalty: LoyaltySummary = {
  lifetimePoints: 6400,
  lifetimeSpendUsd: '1280.00',
  pointsBalance: 2350,
  nextTier: { code: 'GOLD', name: { ar: 'ذهبي', en: 'Gold' }, remainingPoints: 1600 },
  redemption: { enabled: true, minPoints: 500, maxPoints: 2350, pointValueUsd: 0.01 },
  tier: { code: 'SILVER', name: { ar: 'فضي', en: 'Silver' } },
};

const search = (
  id: string,
  from: [string, string, string],
  to: [string, string, string],
  date: string,
  price: string | null,
  tripType: FlightSearchEntry['tripType'] = 'ROUND_TRIP',
): FlightSearchEntry => ({
  id,
  tripType,
  cabinClass: 'ECONOMY',
  currency: 'USD',
  departed: false,
  searchedAt: '2026-10-25T18:00:00Z',
  lastSeenPrice: price ? { amount: price, currency: 'USD' } : null,
  passengers: { adults: 1, children: [], infants: [] },
  slices: [
    {
      departureDate: date,
      origin: { iataCode: from[0], cityName: from[1], name: from[2] },
      destination: { iataCode: to[0], cityName: to[1], name: to[2] },
    },
  ],
});

/** City names come back in the request language; the lab keeps both for AR/EN rendering. */
export const flightSearches: Record<'ar' | 'en', FlightSearchEntry[]> = {
  ar: [
    search('fs_1', ['CAI', 'القاهرة', 'مطار القاهرة'], ['IST', 'إسطنبول', 'مطار إسطنبول'], '2026-11-14', '184.00'),
    search('fs_2', ['CAI', 'القاهرة', 'مطار القاهرة'], ['DXB', 'دبي', 'مطار دبي'], '2026-12-02', '276.50'),
    search('fs_3', ['CAI', 'القاهرة', 'مطار القاهرة'], ['LHR', 'لندن', 'هيثرو'], '2026-12-20', '612.00'),
    search('fs_4', ['CAI', 'القاهرة', 'مطار القاهرة'], ['JED', 'جدة', 'مطار الملك عبدالعزيز'], '2026-11-28', '149.00', 'ONE_WAY'),
  ],
  en: [
    search('fs_1', ['CAI', 'Cairo', 'Cairo Intl'], ['IST', 'Istanbul', 'Istanbul Airport'], '2026-11-14', '184.00'),
    search('fs_2', ['CAI', 'Cairo', 'Cairo Intl'], ['DXB', 'Dubai', 'Dubai Intl'], '2026-12-02', '276.50'),
    search('fs_3', ['CAI', 'Cairo', 'Cairo Intl'], ['LHR', 'London', 'Heathrow'], '2026-12-20', '612.00'),
    search('fs_4', ['CAI', 'Cairo', 'Cairo Intl'], ['JED', 'Jeddah', 'King Abdulaziz Intl'], '2026-11-28', '149.00', 'ONE_WAY'),
  ],
};

/** Lab-only fallback when the customer has no searches (real source needs backend). */
export const curatedDestinations = [
  { iata: 'IST', city: { ar: 'إسطنبول', en: 'Istanbul' }, fromUsd: '190.00' },
  { iata: 'DXB', city: { ar: 'دبي', en: 'Dubai' }, fromUsd: '260.00' },
  { iata: 'KUL', city: { ar: 'كوالالمبور', en: 'Kuala Lumpur' }, fromUsd: '540.00' },
  { iata: 'TBS', city: { ar: 'تبليسي', en: 'Tbilisi' }, fromUsd: '320.00' },
];

// ── Scenarios: versions read `?scenario=` from the frame hash via scenarioFromHash() ──

export type Scenario = 'default' | 'empty' | 'frozen' | 'topup-pending' | 'topup-done' | 'topup-failed' | 'loading';

export interface WalletScenarioData {
  balance: WalletBalance | null; // null while loading
  transactions: WalletTransaction[];
  loyalty: LoyaltySummary;
  searches: Record<'ar' | 'en', FlightSearchEntry[]>;
  topUpResult: 'pending' | 'done' | 'failed' | null;
}

export function walletScenario(s: Scenario): WalletScenarioData {
  const base: WalletScenarioData = { balance, transactions, loyalty, searches: flightSearches, topUpResult: null };
  switch (s) {
    case 'empty':
      return {
        ...base,
        balance: { ...balance, available: '0.00', balance: '0.00', reserved: '0.00' },
        transactions: [],
        loyalty: { ...loyalty, pointsBalance: 0 },
        searches: { ar: [], en: [] },
      };
    case 'frozen':
      return { ...base, balance: { ...balance, status: 'FROZEN' } };
    case 'topup-pending':
      return { ...base, topUpResult: 'pending' };
    case 'topup-done':
      return { ...base, topUpResult: 'done' };
    case 'topup-failed':
      return { ...base, topUpResult: 'failed' };
    case 'loading':
      return { ...base, balance: null, transactions: [] };
    default:
      return base;
  }
}

export function scenarioFromHash(): Scenario {
  const query = location.hash.split('?')[1] ?? '';
  return (new URLSearchParams(query).get('scenario') as Scenario) || 'default';
}
