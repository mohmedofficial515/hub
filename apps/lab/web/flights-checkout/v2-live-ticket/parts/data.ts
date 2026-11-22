/**
 * Mock data for v2-live-ticket, shaped like the web API models on develop:
 * - CheckoutDto (`totals` as decimal strings in `currency`, `passengerSlots`, `requiredFields`, `priceLock`,
 *   `holdAvailable`, `paymentRequirements.paymentRequiredBy`)
 * - PaymentMethodsDto (`methods[]` hosted_redirect with gateway, methodKind, chargeAmount, chargeCurrency, converted;
 *   `wallet` with balance, allowPartial, maxApplicable)
 * - TravellerDto (saved travellers, document number masked)
 * The trip is the sandbox offer seen in audit shot 08: EgyptAir IST → CAI, 16 Dec, back 23 Dec 2026.
 *
 * Totals per currency stand for what `POST /flights/checkout/{id}/currency` returns: the server re-prices, the
 * client never converts the lines itself.
 *
 * PROPOSED (not in the API today): `COUNTRY_METHODS` (methods ordered by the visitor's country) and
 * `CANCEL_QUOTE` shown before payment (today's cancellation terms card has the same lines on the payment step).
 */
import { convertUsd, fmtDec, parseDec } from '@lab/mocks/currencies';

export type PaxType = 'ADULT' | 'CHILD' | 'INFANT';
export type Gender = 'M' | 'F';
export type CheckoutCurrency = 'SAR' | 'USD' | 'TRY';
export type Country = 'SA' | 'KW' | 'AE' | 'TR';
export type Gateway = 'MYFATOORAH' | 'STRIPE' | 'IYZICO' | 'PAYTR';

export interface PassengerSlot {
  slotId: string;
  type: PaxType;
  /** Age searched with (children and infants). */
  age: number | null;
}

export interface Segment {
  flightNumber: string;
  carrier: { code: string; name: { ar: string; en: string } };
  aircraft: string;
  from: { iata: string; city: { ar: string; en: string } };
  to: { iata: string; city: { ar: string; en: string } };
  /** Local wall-clock time at the airport, no zone (as the API sends it). */
  departAt: string;
  arriveAt: string;
  durationMin: number;
}

export interface Slice {
  kind: 'outbound' | 'return';
  segments: Segment[];
}

export interface CheckoutTotals {
  fare: string;
  taxes: string;
  services: string;
  fees: string;
  serviceFee: string;
  discount: string;
  total: string;
  due: string;
}

const EGYPTAIR = { code: 'MS', name: { ar: 'مصر للطيران', en: 'EgyptAir' } };
const IST = { iata: 'IST', city: { ar: 'إسطنبول', en: 'Istanbul' } };
const CAI = { iata: 'CAI', city: { ar: 'القاهرة', en: 'Cairo' } };

export const ITINERARY: Slice[] = [
  {
    kind: 'outbound',
    segments: [
      {
        flightNumber: 'MS 0746',
        carrier: EGYPTAIR,
        aircraft: 'Airbus A320neo',
        from: IST,
        to: CAI,
        departAt: '2026-12-16T03:50',
        arriveAt: '2026-12-16T05:10',
        durationMin: 140,
      },
    ],
  },
  {
    kind: 'return',
    segments: [
      {
        flightNumber: 'MS 0745',
        carrier: EGYPTAIR,
        aircraft: 'Airbus A320neo',
        from: CAI,
        to: IST,
        departAt: '2026-12-23T23:20',
        arriveAt: '2026-12-24T02:50',
        durationMin: 150,
      },
    ],
  },
];

export const CHECKOUT = {
  id: 'chk_01JD8Q4M7X2W',
  offerId: 'off_01JD8PZ3K9R5',
  cabin: 'ECONOMY' as const,
  passengerSlots: [
    { slotId: 'p1', type: 'ADULT', age: null },
    { slotId: 'p2', type: 'ADULT', age: null },
    { slotId: 'p3', type: 'CHILD', age: 7 },
  ] satisfies PassengerSlot[],
  requiredFields: { documents: true, contactPhone: true, documentTypes: ['PASSPORT'] as const },
  /** Bags chosen on step 2 (one 23 kg bag), sold with the ticket. */
  extras: [{ kind: 'BAG' as const, weightKg: 23, slice: 'outbound' as const, slotId: 'p1' }],
  holdAvailable: true,
  paymentRequiredBy: '2026-11-23T18:00',
  priceLockSeconds: 14 * 60 + 32,
  dueUsd: '689.60',
};

/** USD 1 = 3.75 SAR = 42.50 TRY. Lines add up to the total in each currency. */
export const TOTALS: Record<CheckoutCurrency, CheckoutTotals> = {
  SAR: {
    fare: '1867.50',
    taxes: '497.25',
    services: '142.50',
    fees: '45.00',
    serviceFee: '33.75',
    discount: '0.00',
    total: '2586.00',
    due: '2586.00',
  },
  USD: {
    fare: '498.00',
    taxes: '132.60',
    services: '38.00',
    fees: '12.00',
    serviceFee: '9.00',
    discount: '0.00',
    total: '689.60',
    due: '689.60',
  },
  TRY: {
    fare: '21165.00',
    taxes: '5635.50',
    services: '1615.00',
    fees: '510.00',
    serviceFee: '382.50',
    discount: '0.00',
    total: '29308.00',
    due: '29308.00',
  },
};

/** Estimated cancellation quote in USD (cancellation-terms-card lines); converted for display like the other lines. */
export const CANCEL_QUOTE_USD = {
  refundable: false,
  airlinePenalty: '498.00',
  cancellationFee: '15.00',
  nonRefundableServiceFee: '9.00',
  estimatedRefund: '167.60',
  voidUntil: '2026-11-22T23:59',
};

export const CURRENCY_DIGITS: Record<string, number> = { SAR: 2, USD: 2, TRY: 2, KWD: 3, AED: 2 };
/** 1 USD = rate × currency. */
export const USD_RATES: Record<string, string> = {
  USD: '1',
  SAR: '3.75',
  TRY: '42.50',
  KWD: '0.3075',
  AED: '3.6725',
};

// ── payment methods ────────────────────────────────────────────────────────────────────────────────

export interface MethodSeed {
  gateway: Gateway;
  methodKind: 'apple_pay' | 'mada' | 'stc_pay' | 'card' | 'knet';
  /** 'CHECKOUT' = the gateway charges in the checkout currency. */
  chargeCurrency: string | 'CHECKOUT';
}

/** PROPOSED: the order a visitor from each country sees. Apple Pay first wherever the gateway offers it. */
export const COUNTRY_METHODS: Record<Country, MethodSeed[]> = {
  SA: [
    { gateway: 'MYFATOORAH', methodKind: 'apple_pay', chargeCurrency: 'SAR' },
    { gateway: 'MYFATOORAH', methodKind: 'mada', chargeCurrency: 'SAR' },
    { gateway: 'MYFATOORAH', methodKind: 'stc_pay', chargeCurrency: 'SAR' },
    { gateway: 'STRIPE', methodKind: 'card', chargeCurrency: 'CHECKOUT' },
  ],
  KW: [
    { gateway: 'MYFATOORAH', methodKind: 'apple_pay', chargeCurrency: 'KWD' },
    { gateway: 'MYFATOORAH', methodKind: 'knet', chargeCurrency: 'KWD' },
    { gateway: 'STRIPE', methodKind: 'card', chargeCurrency: 'CHECKOUT' },
  ],
  AE: [
    { gateway: 'MYFATOORAH', methodKind: 'apple_pay', chargeCurrency: 'AED' },
    { gateway: 'STRIPE', methodKind: 'card', chargeCurrency: 'CHECKOUT' },
  ],
  TR: [
    { gateway: 'IYZICO', methodKind: 'card', chargeCurrency: 'TRY' },
    { gateway: 'PAYTR', methodKind: 'card', chargeCurrency: 'TRY' },
  ],
};

export const WALLET = { balance: '240.00', currency: 'USD' as const, allowPartial: true, maxApplicable: '240.00' };

export interface Charge {
  amount: string;
  currency: string;
  converted: boolean;
}

/** What one method charges for `usd` dollars of the due amount, given the checkout currency. */
export function chargeFor(seed: MethodSeed, currency: CheckoutCurrency, usd: string): Charge {
  const target = seed.chargeCurrency === 'CHECKOUT' ? currency : seed.chargeCurrency;
  const whole = usd === CHECKOUT.dueUsd && target === currency;
  const amount = whole ? TOTALS[currency].due : convertUsd(usd, USD_RATES[target], CURRENCY_DIGITS[target]).replaceAll(',', '');
  return { amount, currency: target, converted: target !== currency };
}

export function usdMinus(a: string, b: string) {
  return fmtDec(parseDec(a) - parseDec(b), 2);
}

/** A USD figure in the checkout currency (display only). */
export function fromUsd(usd: string, currency: CheckoutCurrency) {
  return convertUsd(usd, USD_RATES[currency], CURRENCY_DIGITS[currency]).replaceAll(',', '');
}

// ── travellers and countries ───────────────────────────────────────────────────────────────────────

export interface SavedTraveller {
  id: string;
  givenName: string;
  familyName: string;
  birthDate: string;
  gender: Gender;
  nationality: string;
  /** TravellerDto.avatarColour, unused on the site today (assist audit row 5). */
  avatarColour: 'navy' | 'teal' | 'gold' | 'slate';
  document: { type: 'PASSPORT'; numberMasked: string; country: string; expiryDate: string } | null;
}

export const SAVED_TRAVELLERS: SavedTraveller[] = [
  {
    id: 'trv_01',
    givenName: 'MOHAMMED SALEH',
    familyName: 'ALHARBI',
    birthDate: '1988-03-14',
    gender: 'M',
    nationality: 'SA',
    avatarColour: 'navy',
    document: { type: 'PASSPORT', numberMasked: '•••• 4821', country: 'SA', expiryDate: '2030-06-30' },
  },
  {
    id: 'trv_02',
    givenName: 'NOURA',
    familyName: 'ALQAHTANI',
    birthDate: '1991-09-02',
    gender: 'F',
    nationality: 'SA',
    avatarColour: 'teal',
    document: { type: 'PASSPORT', numberMasked: '•••• 0937', country: 'SA', expiryDate: '2027-04-10' },
  },
  {
    id: 'trv_03',
    givenName: 'LEEN',
    familyName: 'ALHARBI',
    birthDate: '2019-05-21',
    gender: 'F',
    nationality: 'SA',
    avatarColour: 'gold',
    document: null,
  },
  {
    id: 'trv_04',
    givenName: 'SALEH',
    familyName: 'ALHARBI',
    birthDate: '2014-01-08',
    gender: 'M',
    nationality: 'SA',
    avatarColour: 'slate',
    document: { type: 'PASSPORT', numberMasked: '•••• 7712', country: 'SA', expiryDate: '2028-01-07' },
  },
];

export const COUNTRIES: { code: string; ar: string; en: string }[] = [
  { code: 'SA', ar: 'السعودية', en: 'Saudi Arabia' },
  { code: 'EG', ar: 'مصر', en: 'Egypt' },
  { code: 'TR', ar: 'تركيا', en: 'Türkiye' },
  { code: 'KW', ar: 'الكويت', en: 'Kuwait' },
  { code: 'AE', ar: 'الإمارات', en: 'United Arab Emirates' },
  { code: 'JO', ar: 'الأردن', en: 'Jordan' },
  { code: 'SY', ar: 'سوريا', en: 'Syria' },
  { code: 'GB', ar: 'المملكة المتحدة', en: 'United Kingdom' },
];

export const PAYMENT_COUNTRIES: Country[] = ['SA', 'KW', 'AE', 'TR'];

export const SIGNED_IN_EMAIL = 'm.alharbi@example.com';
export const SIGNED_IN_PHONE = '+966 55 214 7730';

/** Departure of the final flight: ages are measured on it (checkout validation). */
export const LAST_DEPARTURE = '2026-12-23';
/** Local arrival of the last flight: a passport must be valid after it. */
export const LAST_ARRIVAL = '2026-12-24';

export function ageOn(birth: string, on: string) {
  const [by, bm, bd] = birth.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Does a saved traveller fit a slot (travellerFits on develop)? */
export function fits(t: SavedTraveller, slot: PassengerSlot) {
  const age = ageOn(t.birthDate, LAST_DEPARTURE);
  if (slot.type === 'ADULT') return age >= 18;
  if (slot.type === 'CHILD') return slot.age === null ? age >= 2 && age < 18 : age === slot.age;
  return age < 2;
}
