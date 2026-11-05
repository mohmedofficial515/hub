import type { Dict, EmailLang } from './render';

/**
 * Payload of `bookings.confirmed`, shaped like `FlightNotifications.bookingConfirmed` +
 * `bookingTemplateFacts` (backend/src/modules/flights/application/services/flight-notifications.ts).
 *
 * `outboundCity` is NEW: the existing `destination` is the LAST slice's destination, which on a
 * round trip is the city the traveller flies home to, so it cannot headline "your trip to …".
 * `firstName` is not passed by the flights module today; `sparse` shows the real anonymous case.
 */
export type EmailScenario = 'default' | 'roundtrip' | 'sparse';
export const EMAIL_SCENARIOS: EmailScenario[] = ['default', 'roundtrip', 'sparse'];

const branding = {
  siteName: 'Goteav',
  supportEmail: 'support@goteav.com',
  webUrl: 'https://www.goteav.com',
  link: 'https://www.goteav.com/ar/bookings/8f2c1e7a-4b1d-4e0a-9d6f-2a7c5b9e1f30',
};

const city = (lang: EmailLang, ar: string, en: string) => (lang === 'ar' ? ar : en);

/** What the backend would build from `departingAt`, `arrivingAt` and the airports' time zones. */
const gcal = (text: string, from: string, to: string) => {
  const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(text)}&dates=${utc(from)}/${utc(to)}`;
};

export function fixtureFor(scenario: EmailScenario, lang: EmailLang): Dict {
  if (scenario === 'roundtrip') {
    return {
      ...branding,
      firstName: city(lang, 'ليلى', 'Layla'),
      reference: 'GT-2K7M9Q',
      pnr: 'XK4P7A',
      route: 'CAI → IST',
      origin: city(lang, 'القاهرة', 'Cairo'),
      destination: city(lang, 'القاهرة', 'Cairo'),
      outboundCity: city(lang, 'إسطنبول', 'Istanbul'),
      airline: city(lang, 'الخطوط الجوية التركية', 'Turkish Airlines'),
      departureAt: '2026-12-05T10:30:00+02:00',
      arrivalAt: '2026-12-14T19:45:00+02:00',
      amount: '2486.00',
      currency: 'USD',
      passengers: ['LAYLA MOSTAFA ABDELRAHMAN', 'OMAR HASSAN ELSAYED', 'MARIAM OMAR HASSAN', 'YOUSSEF OMAR HASSAN'],
      passengerCount: 4,
      tripType: 'ROUND_TRIP',
      originCity: city(lang, 'القاهرة', 'Cairo'),
      passengerList: [
        { name: 'LAYLA MOSTAFA ABDELRAHMAN', type: 'ADULT', seats: '14A / 21C', bags: [{ carryOn: 1, checked: 2 }] },
        { name: 'OMAR HASSAN ELSAYED', type: 'ADULT', seats: '14B / 21D', bags: [{ leg: 'CAI → IST', carryOn: 1, checked: 3 }, { leg: 'IST → CAI', carryOn: 1, checked: 2 }] },
        { name: 'MARIAM OMAR HASSAN', type: 'CHILD', seats: '14C / 21E', bags: [{ carryOn: 1, checked: 2 }] },
        { name: 'YOUSSEF OMAR HASSAN', type: 'INFANT', bags: [{ carryOn: 0, checked: 1 }] },
      ],
      fareRules: { change: { allowed: true, fee: '50.00', currency: 'USD' }, refund: { allowed: false } },
      extras: [
        { type: 'BAGGAGE', weightKg: 23, quantity: 1, passenger: 'OMAR HASSAN ELSAYED', leg: 'CAI → IST', amount: '65.00', currency: 'USD' },
        { type: 'MEAL', passenger: 'MARIAM OMAR HASSAN', leg: 'CAI → IST', amount: '12.00', currency: 'USD' },
      ],
      slices: [
        {
          origin: 'CAI', destination: 'IST', departingAt: '2026-12-05T10:30:00+02:00', arrivingAt: '2026-12-05T19:10:00+03:00', flights: ['MS737', 'TK815'], calendarUrl: gcal('CAI to IST', '2026-12-05T10:30:00+02:00', '2026-12-05T19:10:00+03:00'), 
          durationMinutes: 460, stopsCount: 1, cabin: 'ECONOMY', fareBrand: 'Flex', baggage: { carryOn: 1, checked: 2 },
          segments: [
            { origin: 'CAI', originCity: city(lang, 'القاهرة', 'Cairo'), originTerminal: '3', destination: 'AMM', destinationCity: city(lang, 'عمّان', 'Amman'), departingAt: '2026-12-05T10:30:00+02:00', arrivingAt: '2026-12-05T12:05:00+03:00', flight: 'MS737', airline: city(lang, 'مصر للطيران', 'EgyptAir'), durationMinutes: 95, aircraft: 'Boeing 737-800', layoverAfter: { city: city(lang, 'عمّان', 'Amman'), minutes: 155 } },
            { origin: 'AMM', originCity: city(lang, 'عمّان', 'Amman'), destination: 'IST', destinationCity: city(lang, 'إسطنبول', 'Istanbul'), departingAt: '2026-12-05T14:40:00+03:00', arrivingAt: '2026-12-05T19:10:00+03:00', flight: 'TK815', airline: city(lang, 'الخطوط الجوية التركية', 'Turkish Airlines'), durationMinutes: 270, operatedBy: 'AnadoluJet', aircraft: 'Airbus A321neo' },
          ],
        },
        {
          origin: 'IST', destination: 'CAI', departingAt: '2026-12-14T17:20:00+03:00', arrivingAt: '2026-12-14T19:45:00+02:00', flights: ['TK694'], calendarUrl: gcal('IST to CAI', '2026-12-14T17:20:00+03:00', '2026-12-14T19:45:00+02:00'), 
          durationMinutes: 205, stopsCount: 0, cabin: 'ECONOMY', fareBrand: 'Flex', baggage: { carryOn: 1, checked: 2 },
          segments: [
            { origin: 'IST', originCity: city(lang, 'إسطنبول', 'Istanbul'), destination: 'CAI', destinationCity: city(lang, 'القاهرة', 'Cairo'), destinationTerminal: '2', departingAt: '2026-12-14T17:20:00+03:00', arrivingAt: '2026-12-14T19:45:00+02:00', flight: 'TK694', airline: city(lang, 'الخطوط الجوية التركية', 'Turkish Airlines'), durationMinutes: 205, aircraft: 'Boeing 737 MAX 8' },
          ],
        },
      ],
    };
  }
  if (scenario === 'sparse') {
    return {
      ...branding,
      reference: 'GT-5R2T8W',
      route: 'JED → RUH',
      origin: city(lang, 'جدة', 'Jeddah'),
      destination: city(lang, 'الرياض', 'Riyadh'),
      outboundCity: city(lang, 'الرياض', 'Riyadh'),
      departureAt: '2027-01-18T06:15:00+03:00',
      arrivalAt: '2027-01-18T08:00:00+03:00',
      passengers: ['AHMED ALI'],
      passengerCount: 1,
      tripType: 'ONE_WAY',
      originCity: city(lang, 'جدة', 'Jeddah'),
      passengerList: [{ name: 'AHMED ALI' }],
      slices: [
        {
          origin: 'JED', destination: 'RUH', departingAt: '2027-01-18T06:15:00+03:00', arrivingAt: '2027-01-18T08:00:00+03:00', flights: ['SV1020'], stopsCount: 0,
          segments: [
            { origin: 'JED', originCity: city(lang, 'جدة', 'Jeddah'), destination: 'RUH', destinationCity: city(lang, 'الرياض', 'Riyadh'), departingAt: '2027-01-18T06:15:00+03:00', arrivingAt: '2027-01-18T08:00:00+03:00', flight: 'SV1020' },
          ],
        },
      ],
    };
  }
  return {
    ...branding,
    firstName: city(lang, 'ليلى', 'Layla'),
    reference: 'GT-4H8N3C',
    pnr: 'QZ7M2D',
    route: 'IST → DXB',
    origin: city(lang, 'إسطنبول', 'Istanbul'),
    destination: city(lang, 'دبي', 'Dubai'),
    outboundCity: city(lang, 'دبي', 'Dubai'),
    airline: city(lang, 'طيران الإمارات', 'Emirates'),
    departureAt: '2026-12-05T10:30:00+03:00',
    arrivalAt: '2026-12-05T16:05:00+04:00',
    amount: '1284.50',
    currency: 'USD',
    passengers: ['LAYLA MOSTAFA', 'OMAR HASSAN'],
    passengerCount: 2,
    tripType: 'ONE_WAY',
    originCity: city(lang, 'إسطنبول', 'Istanbul'),
    passengerList: [
      { name: 'LAYLA MOSTAFA', type: 'ADULT', seats: '23A', bags: [{ carryOn: 1, checked: 1 }] },
      { name: 'OMAR HASSAN', type: 'ADULT', seats: '23B', bags: [{ carryOn: 1, checked: 1 }] },
    ],
    fareRules: { change: { allowed: true, fee: '75.00', currency: 'USD' }, refund: { allowed: false } },
    slices: [
      {
        origin: 'IST', destination: 'DXB', departingAt: '2026-12-05T10:30:00+03:00', arrivingAt: '2026-12-05T16:05:00+04:00', flights: ['EK122'], calendarUrl: gcal('IST to DXB', '2026-12-05T10:30:00+03:00', '2026-12-05T16:05:00+04:00'), 
        durationMinutes: 275, stopsCount: 0, cabin: 'ECONOMY', fareBrand: 'Saver', baggage: { carryOn: 1, checked: 1 },
        segments: [
          { origin: 'IST', originCity: city(lang, 'إسطنبول', 'Istanbul'), originTerminal: '1', destination: 'DXB', destinationCity: city(lang, 'دبي', 'Dubai'), destinationTerminal: '3', departingAt: '2026-12-05T10:30:00+03:00', arrivingAt: '2026-12-05T16:05:00+04:00', flight: 'EK122', airline: city(lang, 'طيران الإمارات', 'Emirates'), durationMinutes: 275, aircraft: 'Boeing 777-300ER' },
        ],
      },
    ],
  };
}
