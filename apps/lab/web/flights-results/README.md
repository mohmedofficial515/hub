---
app: web
page: flights-results
route: /[locale]/flights   # results phase of the flight search (search criteria in the URL)
live-url:
sources:
  - src/features/flights/index.tsx
  - src/features/flights/flight-card.tsx
  - src/features/flights/card/book-panel.tsx
  - src/features/flights/card/carrier-panel.tsx
  - src/features/flights/card/slice-route.tsx
  - src/features/flights/card/offer-highlights.tsx
  - src/features/flights/card/details-panel.tsx
  - src/features/flights/card/fare-price.tsx
  - src/features/flights/card/offer-facts.tsx
  - src/features/flights/results/results-list.tsx
  - src/components/shared/filter-results-bar.tsx
  - src/features/flights/constants/search.ts (SORTS)
status: designing
---

# Flight results: one result card and the strip above the list (GTV-520, plan GTV-472 phase 3)

## Purpose
A traveller who has just searched compares offers and picks one fare to book. They must see, without opening
anything: what everyone pays in total, when they fly, whether bags are included, and whether the money comes back if
plans change. Then they choose a fare family and continue to the booking step.

Scope of this page in the lab: **one result card** and **the "Best / Cheapest / Fastest" strip** above the list,
with the **sort** and the **filter entry**. The hero, the modify-search bar and the filter sidebar's own design are
out of scope (sidebar: GTV-472 later; search summary: L-16 / GTV-519).

## Problems with the current page (from `research/web-uplift-2026-11/audit/03-journey-logic-audit.md`)
- L-12: the results cannot be sorted: `FilterResultsBar` receives the sort props and never draws the control.
- L-13: a fare whose refund rule the airline did not send shows a red "Non-refundable" on the card, while the
  same card's Conditions tab says "the airline did not specify".
- L-39: the same flights repeat as separate cards, one per fare brand; the differences are only visible by opening
  each card.
- L-61: a fare without a checked bag shows nothing; only fares with a bag get a chip.
- L-44: "Book now" is a `<button>` that navigates: no new tab, no middle-click.
- L-62: route labels drawn left to right inside RTL cards.
- L-38: Goteav's own fees are first mentioned at checkout step 3.
- Every card has a teal "Book now": a column of primary buttons, against the one-primary rule.
- Raw zinc/gray/emerald/red classes, 13px text, `shadow-sm` at rest (05-design-system-audit.md).

## Goals (owner's product ideas for this card)
- Total price first, with taxes and fees, for everyone and per passenger.
- A "price includes bags" switch.
- A clear refund badge with three states: refundable / non-refundable / unknown.
- A plain-language entry to compare fare families.
- One primary button per screen; flat surfaces, hairlines, no stripes; current colours (navy, teal with white
  text, gold for small touches); Cairo; headings at most 700; no 13px.

## Constraints
- RTL + LTR, light + dark (dark on `#0a0e21` / `#0f172b`, navy becomes `#cdd9f1`).
- Data available from the API (`OffersPageDto`): per offer `price { base, taxes, total, currency, perPassenger[] }`,
  `refundable`, `changeable`, `checkedBaggageIncluded` (booleans), `slices[]` (times, duration, stops, layovers,
  `fareBrandName`), `owner` carrier with logo URLs, `sortKeys`; per page `facets` (price min/max, stops, airlines with
  `minPrice`, counts of `refundable`, `changeable`, `checkedBaggageIncluded`). Change and refund *conditions* (with
  penalties and "not specified") come only from the offer detail (`useOffer`).
- Backend not running during this work: the baseline is the audit screenshots plus the code.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current card and results bar (audit shots, code inventory) | reference |
| v2-fare-shelf | answer strip as the sort; card with total first; fare families compared in a shelf that opens in place | review (7.4, 2 blockers) |
| v3-fare-shelf | fix round of v2: every review finding fixed | review |
