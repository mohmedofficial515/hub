# Port plan: web/flights-checkout v3-live-ticket (GTV-568)

Target: `F:/Goteav/wt-uplift/web`, branch `feat/gtv-472-redesign-ports` (already created from develop).

## Impact map

| Real file | Change | Other users | Class |
|---|---|---|---|
| `features/flights/reservation/index.tsx` | page shell: no HeroBanner, title + trip line, 2-column grid, ticket rail | reservation route only | own page |
| `features/flights/reservation/step-navigation.tsx` | line stepper (props kept) | reservation only | own page |
| `features/flights/reservation/itinerary-summary.tsx` | default export becomes the live ticket; `Leg` export unchanged | `Leg` → `account/trip/trip-summary-card.tsx` | unaffected (Leg untouched) |
| `features/flights/reservation/mobile-total-bar.tsx` | fixed bottom bar + real modal sheet | reservation only | own page |
| `features/flights/reservation/steps/passenger-form.tsx`, `passenger/*` | saved-travellers chooser, printed name, passport guide, gender segmented, title from gender + Change, required marks + focus first | reservation only | own page |
| `features/flights/reservation/steps/payment-form.tsx`, `payment/use-payment.ts`, `payment/methods.ts` | "what you pay" line, trust + refund lines, Apple Pay device filter, pay button → action role | `account/booking/booking-actions.tsx`, `account/extra-bags.tsx`, `account/flight-changes.tsx` | needs visual check (button colour, Apple Pay filter); new lines gated to the booking (no services/change) |
| `apiEndpoint/checkout/validations.ts` | additive `titleOf()` export | — | unaffected |
| `components/shared/dynamic-select.tsx` | additive `invalid` / `required` props | every form using it | unaffected (defaults unchanged) |
| `features/account/travellers/date-parts-field.tsx` | additive `invalid` / `required` / `idBase` props | account travellers form | unaffected (defaults unchanged) |
| `messages/{ar,en,tr}/domains/flights.json` | new keys under `checkout.*` | — | — |

HeroBanner, DynamicInput, PhoneInput, globals.css, ui/* are not changed.

## Data
- Totals: `checkout.totals` (fare, taxes, services, fees, serviceFee, discount, due) via existing `priceLinesOf`.
- Extras sub-lines: `checkout.services[]` (type, baggage.maximumWeightKg, price).
- Cancel estimate: existing `CancellationTermsCard` on payment (kept there).
- Payment methods: `GET /payments/methods` as today; order kept as the server sends it.
- `requiresApplePayDevice`: NOT in the generated client yet → guarded `'requiresApplePayDevice' in method` check + TODO.

## Kept behaviour
Silent hold before charge, pay-later hold, wallet split, company invoice, currency switch, price-hold expiry → Update price,
guest checkout, error gates, step URLs, `#checkout-next` / `#checkout-pay` ids used by e2e.

## Risks
- CTA stays in each step's footer (e2e ids, form submit wiring); lab pins it in the ticket foot / mobile bar.
- Backend not running locally: verification by unit/component tests.
