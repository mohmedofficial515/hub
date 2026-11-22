---
version: v3-fare-shelf
title: Fare shelf (fix round 1)
status: approved # draft | review | approved | rejected | ported
base: v2-fare-shelf
created: 2026-11-21
tokens: override # tokens.css: develop's semantic roles (GTV-472) + the owner's dark surfaces
touches-components: [features/flights/flight-card.tsx, features/flights/card/book-panel.tsx, features/flights/card/carrier-panel.tsx, features/flights/card/slice-route.tsx, features/flights/card/offer-highlights.tsx, features/flights/card/details-panel.tsx, features/flights/card/fare-price.tsx, features/flights/card/offer-facts.tsx, features/flights/results/results-list.tsx, features/flights/index.tsx, new features/flights/results/results-strip.tsx, new features/flights/card/fare-shelf.tsx] # flights-only files; the shared FilterResultsBar is left for the other list pages
ported:
decided-at: 2026-11-21T19:17:27.970Z
decided-by: Owner
decision-note: "موافقة المالك 2026-11-21. الأسئلة المفتوحة بالخيار الموصى به: مفتاح الحقيبة مطفأ افتراضيًا، رسوم جوتيف تُذكر في الشرح قبل الدفع، صف المقعد يبقى."
---

# Fare shelf (fix round 1)

Same concept as v2-fare-shelf, with every finding of `../v2-fare-shelf/review/review.md` fixed (score 7.4, two
blockers). v2 stays frozen for comparison. Owner decisions now final: D3 photo cards 22px (non-photo cards stay
18px), D4 weights ≤700, D6 no 13px, minimum 12px.

## Fixes after review (v2 → v3)
| Review finding | Fix in v3 |
|---|---|
| Blocker 1: currency at 13px (strip) and 10.4 / 11.2px (phones) from `em` fractions | `Amount` sets the currency at a fixed `text-xs` (12px); the card total's currency is `text-sm` (14px); no `text-[…em]` left anywhere |
| Blocker 2: focus lost after the filter sheet closes | `Dialog.Content onCloseAutoFocus` returns focus to the Filters button (ref passed from the page) |
| Phone shelf hides the third fare | Columns are `(100% − 1rem) / 2.4` wide under 640px, so the third column peeks in; a visible count ("3 fares") sits beside the shelf title |
| Fare columns were `role=radio` buttons containing a `<dl>` | Native `input type=radio` (visually hidden) inside a label with the fare name, price and difference; `aria-label` "EcoFly, SAR 5,184.30, Cheapest"; the rules `<dl>` is outside the control and linked by `aria-describedby`; focus ring on the column via `:has(input:focus-visible)` |
| Phone length: first shelf open by default | Under 768px every shelf starts closed and opens on "Compare 3 fares"; from 768px the first card's shelf starts open |
| "+684.00" breaks in RTL | `SignedMoney` isolates sign and figure in `<bdi dir="ltr">` |
| Empty state keeps strip prices | Strip cells show "–" with no prices or durations in the empty state |
| Bag switch silent for screen readers | The `aria-live` line under the strip adds "Prices now include a checked bag for every traveller." |
| "Show flights" without a count | "Show 214 flights" / "Show 2 flights" / "No matching flights" |
| Heading jump h1 → h3 | `h2` "Available flights" (visually hidden) before the list; the shelf title is `h4` under the card's `h3` |
| "Best" explained only in `title` | Visible sentence in the live line when Best is the order: "Sorted by Best: a balance of price, duration and number of stops." |
| Hollow band in the price column at 1440 | From 768px the action sits directly under the price (the price cell spans the card's rows); on phones it stays after the facts |
| "3 fares from …" line repeats the total; "أجرات" plural | Line removed; the count moved into the action ("Compare 3 fares" / "قارن 3 فئات أجرة"); Arabic uses "فئات أجرة" |

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
- **Shelf on phones** starts closed; when opened it scrolls sideways with columns of (100% − 1rem) / 2.4, so the third
  column peeks in (84px at 390), and the lead line says "3 fares"; from 640px it is one grid.
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

## Verification (v3, 2026-11-21)
- Playwright 1.64.1 (headless Chromium, own browser, script in the session scratchpad), frame
  `http://127.0.0.1:7320/lab/frame-web.html#/flights-results/v3-fare-shelf?lang=…&theme=…`:
  390 / 768 / 1440 × ar-RTL / en-LTR × light / dark → `shots/<w>-<rtl|ltr>-<theme>.png` (12). In all 12: no
  horizontal overflow, 0 truncated texts, rendered font sizes 12, 14, 16, (18), 20, 24, 30 px only (nothing under 12,
  nothing at 13), weights 400-700, no page errors. Shelf closed at load at 390, open on the first card at 768 and 1440.
- Interactions: "Compare" opens the shelf at 390 (`shots/shelf-390-rtl-light.png`); fare columns at 390 RTL span
  229-357, 92-221 and -44-84 px (third column peeks 84px); radio names "EcoFly, 5,184.30 ر.س, الأرخص",
  "ExtraFly, 5,868.30 ر.س, +684.00 ر.س"; ArrowLeft in RTL moves and checks the next fare and keeps focus on it; the
  bag switch adds "الأسعار الآن تشمل حقيبة مشحونة لكل مسافر." to the live line; the sheet says "اعرض 214 رحلة", then
  "اعرض رحلتين" after "Direct only"; after Escape and after "Show" focus is back on the Filters button
  ("الفلاتر، 1 مفعّلة"); headings H1 H2 H3 H4 H3 H3.
- States: `shots/state-{loading,empty,error}-390-rtl-light.png` and `-1440-ltr-dark.png`; the empty state's strip
  shows "–" with no prices. Also `bag-on-1440-ltr-light.png`, `filters-390-rtl-light.png`, `filters-1440-ltr-light.png`.
- Typecheck (from `apps/lab`): `node_modules/.bin/tsc --noEmit -p web/flights-results/v3-fare-shelf/tsconfig.check.json`
  exit 0; `node_modules/.bin/tsc --noEmit` (all versions) exit 0, 0 errors; `-p tsconfig.core.json` exit 0.
  From the Hub root: `node scripts/lab-check.mjs` → "Lab: 51 versions compile."

## Open questions
- (Decided by the owner: D3 photo cards 22px, other cards 18px; D4 ≤700; D6 no 13px, minimum 12px. This version
  has no photo card, cards are 18px.)
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
