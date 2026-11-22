---
version: v2-fare-shelf
title: Fare shelf
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-21
tokens: override # tokens.css: develop's semantic roles (GTV-472) + the owner's dark surfaces
touches-components: [features/flights/flight-card.tsx, features/flights/card/book-panel.tsx, features/flights/card/carrier-panel.tsx, features/flights/card/slice-route.tsx, features/flights/card/offer-highlights.tsx, features/flights/card/details-panel.tsx, features/flights/card/fare-price.tsx, features/flights/card/offer-facts.tsx, features/flights/results/results-list.tsx, features/flights/index.tsx, new features/flights/results/results-strip.tsx, new features/flights/card/fare-shelf.tsx] # flights-only files; the shared FilterResultsBar is left for the other list pages
ported:
---

# Fare shelf

## Idea
The strip above the list *is* the sort: three cells, **Best / Cheapest / Fastest**, each with its own total and flying
time, so the question people ask first is answered before the first card and ordering is one tap (L-12). Under it,
one line says what every price means (all travellers, taxes and airline charges included), the **"Price with a
checked bag"** switch re-prices the whole list, and two neutral buttons hold the rarer orders and the filter sheet.

Each card reads in the same order at every width: who flies it, **the total for everyone**, the two flights on one
line each, then what the chosen fare includes in words: checked bag (or "No checked bag", L-61), cabin bag, change
rule, and the **refund badge in three states** (L-13). The card's only action is a neutral **"Compare fares"** that
opens the **fare shelf** in place: the itinerary's fare families side by side in plain language (cabin bag, checked
bag, changes, refund, seat), one column per fare, with the price difference over the cheapest. Picking a column
re-prices the card above it (the figure slides in, so the change is noticed), and the shelf ends with the one teal
button: **"Continue with ExtraFly | SAR 5,868.30"**, a real link (L-44). One shelf is open at a time, so the screen
never has more than one primary button. The same flights stop repeating as one card per fare brand (L-39).

## Concepts considered
1. **Fare shelf (built).** Layout principle: the card is a summary; comparison happens in a shelf that opens under
   it, one at a time. Strongest on the brief's four product ideas and on the one-primary rule.
2. **Price-first ticket.** The card as a boarding stub with a dashed tear line; the stub (start side) carries the
   total and the refund badge, the body carries the flights. Fare families as a segmented control on the stub.
   Rejected for v2: it puts the price before the flights on desktop, which breaks the scan order people already
   have from every other OTA, and the stub repeats the e-mail design rather than solving L-39.
3. **Answer rows.** Google-Flights-style hairline rows inside one bordered list, the row expands to full detail. The
   densest option (about 96px per itinerary) but the plain-language bag and refund facts do not fit a row, which is
   the point of this brief. Worth a later version for a "compact" view.

## Key decisions
- **One primary per screen.** Cards carry a neutral outline action (`border-border-strong`, navy label). The teal
  `action` button exists only in the open shelf, and only one shelf is open, so the list never becomes a column of
  teal. On the error screen "Search again" is the only action, so it is teal there. The filter sheet's "Show
  flights" is navy (`brand`) because the sheet sits over the list.
- **Total first, per adult under it.** "Total for 3 travellers" + the total (30px, 700) + "Taxes and airline charges
  included" (a popover with base, taxes, total and "Adult × 2, SAR 1,856.10 each"), then "SAR 1,856.10 per adult".
  Per-type unit prices come from `price.perPassenger` grouped by slot type, never summed in the UI.
- **Refund badge, three states, icon + word on a neutral pill.** Refundable (green check, with the fee when there is
  one), Non-refundable (red cross), "Refund: airline did not say" (grey question mark). No tinted card, no stripe.
- **Bag switch is a pricing mode, not a filter.** On: fares without a bag show the server's total with one checked
  bag per traveller per flight ("Includes SAR 840.00 for bags at the airline's price"), and each card opens on its
  cheapest fare *with* a bag (flynas moves from Light 3,246.75 to Value 3,918.75). A separate "Checked bag included"
  filter lives in the sheet, under a new group "What the fare allows" built on facet counts the API already sends.
- **Strip selection:** 2px navy frame + navy-soft tint that glides between cells (`layoutId`, spring); radio-group
  semantics with arrow keys in the page direction. "Other order" holds earliest departure / arrival and takes the
  same navy frame when one of them is active.
- **Shelf on phones** scrolls sideways (two columns and a peek of the third, snap); from 640px it is one grid.
- **Direction:** origin at the reading start in both languages, plane icon mirrored in RTL, logical properties only.
  Money is `Intl.NumberFormat` on the decimal string (no floats); the shelf's "+684.00" uses BigInt cents.
- **Tokens:** `tokens.css` copies develop's primitives and roles and builds this folder's utilities with them (a
  second Tailwind pass, `source(none)` + `@source './'`), because the lab's web checkout is an older branch. Dark
  mode uses the owner's surfaces `#0a0e21` page / `#0f172b` card (develop's `.dark` still has the shadcn greys).
- **Type and shape:** Cairo everywhere; weights 400-700; smallest text 12px, no 13px (D6); cards `rounded-2xl`
  (18px), controls `rounded-md` (8px); no shadow at rest, `border-border-strong` on hover; no gradient anywhere.
- **Motion:** shelf height 300ms, price figure 240ms slide, strip frame spring, sheet 300ms; all off under
  `prefers-reduced-motion` (`MotionConfig reducedMotion="user"` + CSS guard).
- **States:** loading (skeletons in the final shapes), empty after filters ("Clear filters"), error (supplier
  timeout wording). Lab-only switch under the page, or `&state=loading|empty|error` in the URL.

## Data this version needs from the backend (marked NEEDS BACKEND in `mock.ts`)
1. **Itinerary grouping:** the offers of the same flights grouped as fare families in the results page (today one
   card per offer). Without it the shelf can only be filled after opening an offer.
2. **Fare rules in the summary:** `refundable` / `changeable` as `true | false | null` plus penalty amounts, bag
   allowance with weight, seat choice. Today the summary has booleans only; "unknown" and fees need `useOffer`.
3. **Bag-inclusive total:** per offer, the server's total with one checked bag per traveller per flight, and the
   bag price; `null` when the airline does not sell the bag in this channel.
4. **Highlights:** best / cheapest / fastest of the whole result set (offer id, total, duration), with and without
   bags, recomputed when filters change.

## Mock data
`mock.ts`: RUH ⇄ IST, 17-24 Dec 2026, 2 adults + 1 child, SAR. Turkish Airlines (EcoFly / ExtraFly / PrimeFly,
direct), flynas (Light / Value, direct to SAW), Qatar Airways (Economy Classic / Economy Convenience, via DOH, refund
"not said" on Classic). Every total equals base + taxes and the sum of `perPassenger`. Facet counts are for 214
offers. Fare rules and fees are realistic placeholders, not quotes from the airlines.

## Verification (2026-11-21)
- Playwright, frame `http://127.0.0.1:7320/lab/frame-web.html#/flights-results/v2-fare-shelf?lang=…&theme=…`:
  390 / 768 / 1440 × ar-RTL / en-LTR × light / dark → `shots/<w>-<rtl|ltr>-<theme>.png` (12 files). No element
  overflows the viewport (fare shelf's own sideways scroll excluded), no truncated text at any width.
- States and interactions: `shots/state-loading-390-rtl-light.png`, `state-loading-1440-ltr-dark.png`,
  `state-empty-390-rtl-light.png`, `state-empty-1440-ltr-dark.png`,
  `state-error-1440-ltr-dark.png`, `state-error-390-rtl-light.png`, `bag-on-1440-rtl-light.png`,
  `shelf-extrafly-390-ltr-light.png` (picked with ArrowRight; focus stays on the checked radio),
  `filters-390-rtl-dark.png`, `filters-1440-ltr-light.png`.
- Typecheck: `node_modules/.bin/tsc --noEmit -p web/flights-results/v2-fare-shelf/tsconfig.check.json` (from
  `apps/lab`) exit 0; `tsc --noEmit` (all versions) exit 0; `node scripts/lab-check.mjs` (from the Hub root):
  "Lab: 47 versions compile."
- Note: in the lab frame the page scrollbar takes 15px at 390 (clientWidth 375); phones overlay it.

## Open questions
- **D3 / D6 assumed:** cards use 18px (`rounded-2xl`, B.1) and no 13px text. No photo card here, so the 22px photo
  radius does not come up.
- **Goteav's own fees:** is the service fee inside the results total? The shelf footnote says "Goteav's own fees are
  shown before you pay" (true today, L-38). If the fee is not in the total, should the card say so, or should the
  total include it (G-16)?
- **Bag switch default:** off (today's prices) or on for routes where most traffic carries bags (Egypt, Gulf)?
- **Highlights when filtered:** should Best / Cheapest / Fastest describe the filtered set (needs the backend to
  recompute) or always the whole search?
- **Filter sidebar on desktop:** the lab shows the filter entry at every width. On the real page keep the sidebar at
  `lg` and hide the button, or replace the sidebar by the sheet to give the list the full width?
- **Seat choice row:** keep it in the shelf (it depends on airline data we may not have per fare), or drop it until
  the provider sends it reliably?
- **Arabic duration** reads "4 س 5 د" (site style); "4 س 05 د" or "4 ساعات و5 دقائق" would read more naturally.
