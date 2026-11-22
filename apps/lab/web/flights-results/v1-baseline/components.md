# v1-baseline — components

**How this baseline was made.** The backend was not running on 2026-11-21, so `/[locale]/flights` cannot render
results live. The screenshots here are copied from the journey audit
(`F:/Goteav/research/web-uplift-2026-11/audit/shots/`, taken against the sandbox supplier, Arabic, light) and the
inventory below was read from the code in `F:/Goteav/wt-develop/web/src` (develop). No dark-mode, English or 768px
baseline exists for this page.

| File | Audit name | What it shows |
|---|---|---|
| `1440-rtl-light.png` | 05-results-ar-1440-light | Results list with the filter sidebar; two cards; "Book now" teal on every card |
| `390-rtl-light.png` | 19-results-card-ar-390-light | One card on a phone: 552px tall, price and button after both flights |
| `18-results-top-ar-390-light.png` | 18 | Phone: hero and the whole search form before the first card (L-16) |
| `06-fare-details-baggage-ar-1440.png` | 06 | "Fare details" expanded on the Baggage tab |
| `07-fare-details-conditions-vs-badge-ar-1440.png` | 07 | Red "Non-refundable" badge above a Conditions tab that says "the airline did not specify" (L-13) |

## Components in scope

| Component | File (web/src) | Shared? |
|---|---|---|
| Flights page (hero, modify bar, sidebar, results bar, list, pagination) | `features/flights/index.tsx` | flights only |
| FilterResultsBar (count, sort select never rendered, mobile filter drawer) | `components/shared/filter-results-bar.tsx` | shared: 8 list pages (flights, hotels, packages, trains, car rental, airport transfer, private driver, eSIM) |
| DynamicSelect (sort select) | `components/shared/dynamic-select` | shared, 23 files |
| ResultsList (searching, error, empty, cards) | `features/flights/results/results-list.tsx` | flights only |
| ResultsMessage | `features/flights/results/results-message.tsx` | flights only |
| FlightCard (shell, expand toggle) | `features/flights/flight-card.tsx` | flights only |
| CarrierPanel (logo, airline, cabin) | `features/flights/card/carrier-panel.tsx` | flights only |
| SliceRoute (times, duration, stops) | `features/flights/card/slice-route.tsx` | flights only |
| OfferHighlights (fare brand, "checked bag included" pill) | `features/flights/card/offer-highlights.tsx` | flights only |
| BookPanel (total, RefundBadge, Book now) | `features/flights/card/book-panel.tsx` | flights only |
| DetailsPanel (tabs Baggage / Fare / Policy) | `features/flights/card/details-panel.tsx` | flights only |
| FarePrice, OfferFacts, OfferPassengerPrices | `features/flights/card/fare-price.tsx`, `offer-facts.tsx` | flights only |
| Fare facts (baggageOf, refundStatusOf, conditions) | `features/flights/fare/facts.ts`, `fare/details.tsx` | shared with the checkout review step |
| FlightFilterSidebar + filter/* | `features/flights/flight-filter-sidebar.tsx`, `features/flights/filter/*` | flights only |
| Adapters (`toFlightCardView`, `formatMoney`, `durationParts`) | `apiEndpoint/flights/adapters.ts` | shared with reservation |
| Drawer, Skeleton | `components/ui/drawer`, `components/ui/skeleton` | shared primitives |

i18n: `messages/{ar,en,tr}/domains/flights.json` → `flights.card.*`, `flights.index.*` (`sort.*`), `flights.filter.*`,
`fareFacts.*`.

Porting note: everything in the card is flights-only. `FilterResultsBar` is shared, so the new strip should be a
flights component (`features/flights/results/results-strip.tsx`) rather than a change to the shared bar.
