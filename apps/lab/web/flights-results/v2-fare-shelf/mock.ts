/**
 * Mock results for one search: RUH ⇄ IST, 17–24 Dec 2026, 2 adults + 1 child, economy, prices in SAR.
 *
 * Shapes follow `OffersPageDto` (web/src/apiEndpoint/generated/v1/types.gen.ts): decimal strings for money, local
 * times without offset, `perPassenger` by slot, `facets` with counts. Two things the API does not send today are
 * marked NEEDS BACKEND and listed in the README:
 *   1. `fares`: the offers of one itinerary grouped as fare families (today each family is its own card, L-39).
 *   2. `withCheckedBag`: the server's total with one checked bag per traveller per flight.
 *   3. `highlights`: best / cheapest / fastest of the whole result set, for the strip above the list.
 * Every total below equals base + taxes and the sum of `perPassenger` (checked by hand, no float math in the UI).
 */

export type CabinClass = 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
export type PassengerType = 'ADULT' | 'CHILD' | 'INFANT';
export type OfferSort = 'best' | 'price' | 'duration' | 'departure' | 'arrival';

export interface Carrier {
  iataCode: string;
  name: { ar: string; en: string };
  logoSymbolUrl: string | null;
}

export interface SliceSummary {
  originIata: string;
  destinationIata: string;
  /** Local time, no offset (API shape). */
  departingAt: string;
  arrivingAt: string;
  durationMinutes: number;
  stopsCount: number;
  layoverIatas: string[];
  /** Layover length per connection, in minutes (from the offer's segments). */
  layoverMinutes: number[];
}

/** `allowed: null` means the airline did not say (the API's `conditions.*` is null). */
export interface Condition {
  allowed: boolean | null;
  penaltyAmount: string | null;
}

export interface FareOption {
  /** Offer id: each fare family is one bookable offer. */
  offerId: string;
  fareBrandName: string;
  cabinClass: CabinClass;
  price: {
    currency: string;
    base: string;
    taxes: string;
    total: string;
    perPassenger: { slotId: string; total: string }[];
  };
  /** NEEDS BACKEND: server total with one checked bag per traveller on every flight; null when the bag is not sold here. */
  withCheckedBag: { total: string; bagsPrice: string } | null;
  checkedBaggageIncluded: boolean;
  baggage: { carryOnKg: number | null; checkedPieces: number; checkedKg: number | null };
  conditions: { change: Condition; refund: Condition };
  seatChoice: 'free' | 'paid' | 'unknown';
}

export interface Itinerary {
  id: string;
  searchId: string;
  owner: Carrier;
  slices: SliceSummary[];
  /** NEEDS BACKEND: fare families of the same flights, cheapest first. */
  fares: FareOption[];
  sortKeys: { best: number; price: number; durationMinutes: number; departureAt: number; arrivalAt: number };
}

export const SEARCH = {
  id: 'srch_01JF7QK2V9',
  currency: 'SAR',
  passengers: [
    { slotId: 'pas_1', type: 'ADULT' as PassengerType },
    { slotId: 'pas_2', type: 'ADULT' as PassengerType },
    { slotId: 'pas_3', type: 'CHILD' as PassengerType },
  ],
};

const TK: Carrier = { iataCode: 'TK', name: { ar: 'الخطوط الجوية التركية', en: 'Turkish Airlines' }, logoSymbolUrl: null };
const XY: Carrier = { iataCode: 'XY', name: { ar: 'طيران ناس', en: 'flynas' }, logoSymbolUrl: null };
const QR: Carrier = { iataCode: 'QR', name: { ar: 'الخطوط الجوية القطرية', en: 'Qatar Airways' }, logoSymbolUrl: null };

const pax = (adult: string, child: string) => [
  { slotId: 'pas_1', total: adult },
  { slotId: 'pas_2', total: adult },
  { slotId: 'pas_3', total: child },
];

export const ITINERARIES: Itinerary[] = [
  {
    id: 'itn_tk_0840',
    searchId: SEARCH.id,
    owner: TK,
    slices: [
      { originIata: 'RUH', destinationIata: 'IST', departingAt: '2026-12-17T08:40:00', arrivingAt: '2026-12-17T13:05:00', durationMinutes: 265, stopsCount: 0, layoverIatas: [], layoverMinutes: [] },
      { originIata: 'IST', destinationIata: 'RUH', departingAt: '2026-12-24T19:05:00', arrivingAt: '2026-12-24T23:10:00', durationMinutes: 245, stopsCount: 0, layoverIatas: [], layoverMinutes: [] },
    ],
    fares: [
      {
        offerId: 'off_0000AqTK1ecof',
        fareBrandName: 'EcoFly',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '3912.00', taxes: '1272.30', total: '5184.30', perPassenger: pax('1856.10', '1472.10') },
        withCheckedBag: { total: '5184.30', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 8, checkedPieces: 1, checkedKg: 20 },
        conditions: { change: { allowed: true, penaltyAmount: '375.00' }, refund: { allowed: false, penaltyAmount: null } },
        seatChoice: 'paid',
      },
      {
        offerId: 'off_0000AqTK1extr',
        fareBrandName: 'ExtraFly',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '4596.00', taxes: '1272.30', total: '5868.30', perPassenger: pax('2084.10', '1700.10') },
        withCheckedBag: { total: '5868.30', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 8, checkedPieces: 1, checkedKg: 25 },
        conditions: { change: { allowed: true, penaltyAmount: '0.00' }, refund: { allowed: true, penaltyAmount: '375.00' } },
        seatChoice: 'free',
      },
      {
        offerId: 'off_0000AqTK1prim',
        fareBrandName: 'PrimeFly',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '5634.00', taxes: '1272.30', total: '6906.30', perPassenger: pax('2430.10', '2046.10') },
        withCheckedBag: { total: '6906.30', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 8, checkedPieces: 1, checkedKg: 30 },
        conditions: { change: { allowed: true, penaltyAmount: '0.00' }, refund: { allowed: true, penaltyAmount: '0.00' } },
        seatChoice: 'free',
      },
    ],
    sortKeys: { best: 1, price: 5184.3, durationMinutes: 510, departureAt: Date.parse('2026-12-17T08:40:00Z'), arrivalAt: Date.parse('2026-12-24T23:10:00Z') },
  },
  {
    id: 'itn_xy_0615',
    searchId: SEARCH.id,
    owner: XY,
    slices: [
      { originIata: 'RUH', destinationIata: 'SAW', departingAt: '2026-12-17T06:15:00', arrivingAt: '2026-12-17T10:45:00', durationMinutes: 270, stopsCount: 0, layoverIatas: [], layoverMinutes: [] },
      { originIata: 'SAW', destinationIata: 'RUH', departingAt: '2026-12-24T12:05:00', arrivingAt: '2026-12-24T16:20:00', durationMinutes: 255, stopsCount: 0, layoverIatas: [], layoverMinutes: [] },
    ],
    fares: [
      {
        offerId: 'off_0000AqXY1lght',
        fareBrandName: 'Light',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '2310.00', taxes: '936.75', total: '3246.75', perPassenger: pax('1138.25', '970.25') },
        withCheckedBag: { total: '4086.75', bagsPrice: '840.00' },
        checkedBaggageIncluded: false,
        baggage: { carryOnKg: 7, checkedPieces: 0, checkedKg: null },
        conditions: { change: { allowed: true, penaltyAmount: '250.00' }, refund: { allowed: false, penaltyAmount: null } },
        seatChoice: 'paid',
      },
      {
        offerId: 'off_0000AqXY1valu',
        fareBrandName: 'Value',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '2982.00', taxes: '936.75', total: '3918.75', perPassenger: pax('1362.25', '1194.25') },
        withCheckedBag: { total: '3918.75', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 7, checkedPieces: 1, checkedKg: 20 },
        conditions: { change: { allowed: true, penaltyAmount: '150.00' }, refund: { allowed: false, penaltyAmount: null } },
        seatChoice: 'paid',
      },
    ],
    sortKeys: { best: 2, price: 3246.75, durationMinutes: 525, departureAt: Date.parse('2026-12-17T06:15:00Z'), arrivalAt: Date.parse('2026-12-24T16:20:00Z') },
  },
  {
    id: 'itn_qr_0730',
    searchId: SEARCH.id,
    owner: QR,
    slices: [
      { originIata: 'RUH', destinationIata: 'IST', departingAt: '2026-12-17T07:30:00', arrivingAt: '2026-12-17T15:30:00', durationMinutes: 480, stopsCount: 1, layoverIatas: ['DOH'], layoverMinutes: [105] },
      { originIata: 'IST', destinationIata: 'RUH', departingAt: '2026-12-24T17:40:00', arrivingAt: '2026-12-25T02:35:00', durationMinutes: 535, stopsCount: 1, layoverIatas: ['DOH'], layoverMinutes: [175] },
    ],
    fares: [
      {
        offerId: 'off_0000AqQR1clas',
        fareBrandName: 'Economy Classic',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '3240.00', taxes: '1481.20', total: '4721.20', perPassenger: pax('1694.40', '1332.40') },
        withCheckedBag: { total: '4721.20', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 7, checkedPieces: 1, checkedKg: 25 },
        conditions: { change: { allowed: null, penaltyAmount: null }, refund: { allowed: null, penaltyAmount: null } },
        seatChoice: 'unknown',
      },
      {
        offerId: 'off_0000AqQR1conv',
        fareBrandName: 'Economy Convenience',
        cabinClass: 'ECONOMY',
        price: { currency: 'SAR', base: '3894.00', taxes: '1481.20', total: '5375.20', perPassenger: pax('1912.40', '1550.40') },
        withCheckedBag: { total: '5375.20', bagsPrice: '0.00' },
        checkedBaggageIncluded: true,
        baggage: { carryOnKg: 7, checkedPieces: 1, checkedKg: 30 },
        conditions: { change: { allowed: true, penaltyAmount: '0.00' }, refund: { allowed: true, penaltyAmount: '300.00' } },
        seatChoice: 'free',
      },
    ],
    sortKeys: { best: 3, price: 4721.2, durationMinutes: 1015, departureAt: Date.parse('2026-12-17T07:30:00Z'), arrivalAt: Date.parse('2026-12-25T02:35:00Z') },
  },
];

/** `OffersPageDto.facets` for the whole result set (counts are over all 214 offers, not the three shown). */
export const FACETS = {
  total: 214,
  currency: 'SAR',
  price: { min: '3246.75', max: '14850.00' },
  refundable: 38,
  changeable: 121,
  checkedBaggageIncluded: 167,
  stops: [
    { value: 0 as const, count: 142 },
    { value: 1 as const, count: 64 },
    { value: 2 as const, count: 8 },
  ],
  airlines: [
    { iataCode: 'TK', count: 46, minPrice: '5184.30' },
    { iataCode: 'XY', count: 31, minPrice: '3246.75' },
    { iataCode: 'QR', count: 28, minPrice: '4721.20' },
  ],
};

/** NEEDS BACKEND: best / cheapest / fastest of the whole set; `withBag` is the same with checked bags priced in. */
export const HIGHLIGHTS = {
  plain: {
    best: { itineraryId: 'itn_tk_0840', total: '5184.30', durationMinutes: 510 },
    price: { itineraryId: 'itn_xy_0615', total: '3246.75', durationMinutes: 525 },
    duration: { itineraryId: 'itn_tk_0840', total: '5184.30', durationMinutes: 510 },
  },
  withBag: {
    best: { itineraryId: 'itn_tk_0840', total: '5184.30', durationMinutes: 510 },
    price: { itineraryId: 'itn_xy_0615', total: '3918.75', durationMinutes: 525 },
    duration: { itineraryId: 'itn_tk_0840', total: '5184.30', durationMinutes: 510 },
  },
};

export type HighlightKey = keyof typeof HIGHLIGHTS.plain;
