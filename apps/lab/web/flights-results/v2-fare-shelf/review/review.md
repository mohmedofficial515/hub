# Review — web/flights-results/v2-fare-shelf   (2026-11-21)

Main task: compare offers on total price, times, bags and refund, pick a fare family, continue to booking.
Method: Playwright in an own browser context, frame `frame-web.html#/flights-results/v2-fare-shelf`,
390 / 768 / 1440 × ar-RTL / en-LTR × light / dark, keyboard walk, computed sizes and contrast, CLS observer,
console; source read of `page.tsx`, `parts/*.tsx`, `tokens.css` against the web interface guidelines and the
owner's binding rules.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | Total-first card and the answer strip read in the right order; one teal on screen holds. |
| Task flow & speed | 7 | Sort and compare are one tap; on phones the open shelf pushes Continue and the next results far down, and the 3rd fare is hidden. |
| Layout & responsiveness | 7 | No overflow at any width; phone shelf gives no hint of the third column; desktop price column has a hollow band. |
| RTL / bilingual | 8 | Route runs origin-first, plane mirrored, sheet from the end side; "+684.00" breaks in RTL. |
| Accessibility | 6 | Good radiogroups, 44px targets and visible rings, but focus is lost after the filter sheet and fare radios contain whole `<dl>` tables. |
| Visual craft & originality | 8 | Flat, hairlines, neutral pills, no stripes or gradients, Cairo ≤700; the 13px currency breaks a binding rule. |
| Motion & feedback | 8 | Short, purposeful, reduced-motion respected; bag switch re-prices silently for screen readers. |

Overall: **7.4 / 10**

## Blocking issues (must fix before approval)

1. **13px and sub-12px text (binding rule "no 13px"; README promises "smallest 12px").**
   Where: `parts/results-strip.tsx:110` `currencyClassName="text-[0.65em]"` on an `sm:text-xl` amount computes to
   **13px** at 768 and 1440 (strip cells, all modes); on 390 the same rule gives **10.4px**.
   `parts/fare-shelf.tsx:545` `text-[0.7em]` gives **11.2px** at 390 and 12.6px at ≥640.
   Measured with `getComputedStyle` (only offenders are the "ر.س / SAR" spans).
   Why: breaks the owner's type rule and drops the currency below legible size on phones.
   Fix: give the currency span a fixed `text-xs` (12px) instead of an `em` fraction, or 14px where the figure is ≥20px.

2. **Keyboard focus is lost when the filter sheet closes.**
   Where: `page.tsx` `onOpenFilters={() => setFiltersOpen(true)}` with the trigger in `parts/results-strip.tsx:179`
   being a plain button outside `Dialog.Trigger`. After "Show flights" or Escape, `document.activeElement` is `<body>`
   (verified at 390 and 1440, RTL).
   Why: keyboard and screen-reader users are thrown to the top of the page after every filter change, right when
   they want to read the new list.
   Fix: render the filter button as `Dialog.Trigger asChild`, or pass a ref and return focus in
   `onCloseAutoFocus`.

## Improvements

Major
- **Phone shelf hides the third fare.** 390 RTL, Turkish card: columns at x = 174…342 (EcoFly), −2…166 (ExtraFly),
  −178…−10 (PrimeFly). ExtraFly fills the rest of the row exactly, so there is no peek and no other cue that a
  third, refundable fare exists (README claims "two columns and a peek of the third"). Fix: column width
  `calc((100% - 0.5rem) / 2.3)` or similar, plus a "1 of 3" count or dots; `fare-shelf.tsx:126` `w-[10.5rem]`.
- **Fare columns are `role="radio"` buttons containing a `<dl>`** (`fare-shelf.tsx:113-162`). Block content inside
  `<button>` is invalid, and each column's accessible name is ~120 characters of flattened table read on every arrow
  press. Fix: name = brand + price + difference (`aria-label`), details via `aria-describedby`, or a visually hidden
  `input type=radio` inside a `label` card with the `dl` outside the control.
- **Phone length.** With the first shelf open by default the first card is 1223px tall at 390 and the teal Continue
  sits ~1540px from the top; flynas (the cheapest) starts on the third screen. Consider the shelf closed by default
  under `sm`, or open it on the first card only from `md`.

Minor
- RTL bidi: the difference renders as "684.00+ ر.س" (`fare-shelf.tsx:548`, `t.shelf.more`). Wrap the signed number
  in `<bdi dir="ltr">` or `⁦…⁩`.
- Empty state keeps the strip with prices (Best 5,184.30, Cheapest 3,246.75) over "no flights match" — contradictory.
  Hide or grey the strip figures in the empty state until the open question on filtered highlights is answered.
- Bag switch changes card totals (flynas 3,246.75 → 3,918.75) but the `aria-live` line (`results-strip.tsx:121`) does
  not change. Add "Prices now include a checked bag" to it.
- Filter sheet: "Show flights" does not say how many (`filter-sheet.tsx:103`); facet counts stay static after
  other filters are ticked. Use "Show 2 flights".
- Heading levels jump h1 → h3 (`flight-card.tsx:72`, `fare-shelf.tsx:97`); add an h2 (can be `sr-only`) for the list.
- "Best" explanation lives only in `title` (`results-strip.tsx:85`), unreachable on touch and for most screen readers.
- Desktop 1440: price column of collapsed cards has an empty ~100px band between "per adult" and "fares from"
  (`md:justify-end` on the action cell). Acceptable, but reads hollow; anchor the action under the price instead.
- "3 أجرات تبدأ من 5,184.30" repeats the total when the cheapest fare is shown, and "أجرات" is an unusual plural;
  consider "3 فئات أسعار" and hide the line when the shown fare is already the cheapest.
- Notes only (owner-accepted): teal + white measured 2.57:1; gold Sparkles icon 1.86:1 on white, acceptable as a
  small touch since the word beside it carries the meaning.

Checked and clean: no horizontal overflow at any of the 12 combinations; no console errors or warnings; CLS 0.012
on load and 0 during sort, bag toggle and shelf changes; all hit targets ≥ 24px, main controls 44-48px; muted text
4.76:1 light, slate-400 on #0f172b in dark; focus rings visible on every stop; tab order strip → switch →
other order → filters → card → shelf radio → Continue → next card; strip and shelf arrows follow page direction;
only one teal button at a time (verified after opening another card); weights 400-700; Cairo; no shadows at rest,
no gradients, no stripes; sheet enters from the end side (left in RTL).

## What is better than baseline
- Sort is visible and one tap, each answer with its price and time (baseline L-12: no sort control at all).
- "Refund: airline did not say" is neutral grey, not red (L-13); "No checked bag" is stated (L-61).
- One teal action on the screen instead of a teal "Book now" on every card; Continue is a real link (L-44).
- Total for all 3 travellers first, taxes in, breakdown one tap away; per-adult below.
- Fare families compared side by side in plain words instead of one repeated card per brand (L-39).
- Route lines run origin-first in RTL (L-62).

## Screenshots
All in this folder: `390|768|1440-rtl|ltr-light|dark.png` (12), `bag-on-1440-rtl-light.png`,
`filters-1440-rtl-light.png`, `filters-390-rtl-light.png`, `shelf-390-rtl-light.png`,
`state-loading|empty|error-390-ltr-dark.png`.

## Fixes after review (2026-11-21)

v2 is frozen in `review`, so the fixes are in **`../../v3-fare-shelf/`** (base v2, status `review`). Each finding:

| Finding | Fix in v3 |
|---|---|
| Blocker 1: currency 13px / 10.4px / 11.2px from `em` fractions (`results-strip.tsx:110`, `fare-shelf.tsx:545`) | `Amount` sets the currency at a fixed `text-xs` (12px), the card total's currency at `text-sm`; no `text-[…em]` left. Measured in all 12 combos: sizes 12/14/16/18/20/24/30 px only |
| Blocker 2: focus lost after the filter sheet | `Dialog.Content onCloseAutoFocus` returns focus to the Filters button (ref from the page). Verified after Escape and after "Show" |
| Phone shelf hides the third fare | Columns `(100% − 1rem) / 2.4` under 640px: at 390 RTL the third column peeks 84px; the lead line says "3 fares" |
| Fare columns = `role=radio` buttons containing `<dl>` | Native visually hidden radios in a label (name, price, difference) with a short `aria-label`; the rules `<dl>` sits outside the control, linked by `aria-describedby`; ring via `:has(input:focus-visible)` |
| Phone length (first shelf open) | Shelves start closed under 768px; the first card's shelf starts open from 768px |
| "+684.00" breaks in RTL | `SignedMoney`: sign and figure in `<bdi dir="ltr">` |
| Empty state keeps strip prices | Strip shows "–" without prices or durations in the empty state |
| Bag switch silent | Live line adds "Prices now include a checked bag for every traveller." |
| "Show flights" without a count | "Show 214 flights" / "Show 2 flights" (ar "اعرض رحلتين") / "No matching flights" |
| h1 → h3 jump | Visually hidden `h2` "Available flights"; shelf title is `h4` |
| "Best" explained only in `title` | Visible sentence in the live line while Best is the order |
| Hollow band in the price column at 1440 | From 768px the action sits under the price |
| "3 fares from …" repeats the total; "أجرات" | Line removed; "Compare 3 fares" / "قارن 3 فئات أجرة" |

Checks: `node_modules/.bin/tsc --noEmit -p web/flights-results/v3-fare-shelf/tsconfig.check.json` exit 0,
`node_modules/.bin/tsc --noEmit` exit 0 (0 errors), `node scripts/lab-check.mjs` "Lab: 51 versions compile."
Screenshots: `v3-fare-shelf/shots/` (12 combos + states + shelf + filters + bag on).
