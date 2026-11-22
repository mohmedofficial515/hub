# Port plan: web/flights-results v3-fare-shelf (GTV-567)

Target: `F:/Goteav/wt-uplift/web`, branch `feat/gtv-472-redesign-ports` (no new branch, per the owner's brief).

## Impact map

| Real file | Change | Used by |
|---|---|---|
| `src/features/flights/index.tsx` | `FilterResultsBar` replaced by a phone/tablet search card + the new `ResultsStrip` | `/[locale]/flights` only |
| `src/features/flights/results/results-strip.tsx` | new: Best / Cheapest / Fastest cells as the sort, live line, "Other order" menu, Filters button + drawer (below `lg`) | flights results only |
| `src/features/flights/results/strip.ts` | new, pure: figures of the strip cells from what the page has | flights results only |
| `src/features/flights/results/results-list.tsx` | `ol` list, sr-only `h2`, one open shelf at a time, skeletons in the new shapes | flights results only |
| `src/features/flights/flight-card.tsx` + `card/*` | new card layout (header, price column, slice rows, fare facts, refund badge) and the fare shelf (`card/fare-shelf.tsx`, new) replacing the tabbed details panel | flights results only (Grep: no other importer) |
| `messages/{ar,en,tr}/domains/flights.json` | new keys under `flights.card`, `flights.strip`, `flights.shelf` | flights only |
| `e2e/support/flights.ts`, `e2e/flight-search.spec.ts` | "Book Now" is now the shelf's "Continue" link | e2e only |

Not touched: `src/components/shared/filter-results-bar.tsx` (8 pages; flights simply stops using it, its API and the other
7 pages stay as they are), `FlightFilterSidebar` (desktop from `lg`, and the drawer content below `lg`), the checkout
files (26c2daa), the home port files of the parallel agent.

Pages classified: hotels, esim, packages, car-rental, private-driver, trains, airport-transfer — unaffected (no shared
file changes).

## Data used (current contract only)
`OffersPageDto.items[]` (owner, cabin, slices, price total/base/taxes/perPassenger, refundable, changeable,
checkedBaggageIncluded, fareBrandName), `facets.price.min`, `total`, search head `passengerSlots` (types for per-adult
price), `useOffer` (conditions change/refund with fees, per-segment baggage, `advanceSeatSelection`).

## Hidden or reduced because the API lacks it (NEEDS BACKEND)
1. Fare families per itinerary: the shelf shows the one fare of the offer.
2. Bag-inclusive totals and bag price: the bag switch is not rendered (owner: off by default).
3. Result-set highlights: Cheapest uses `facets.price.min`; Best/Fastest figures only for the active order on page 1
   (the first offer the server ranked); no duration for cells the server did not rank.
4. Three-state refund/change and fees in the summary: summary booleans until `useOffer` loads (GTV-508 rule).
5. Bag weights (kg), layover durations, seat price: not shown.

## Risks
- E2E helpers relied on "Book Now" on the results card; updated, not runnable without the backend.
- One extra click to book (card action opens the shelf; teal Continue lives in it), as the approved design says.
