---
version: v7-twin-tanks
title: Twin tanks (fix round 1)
status: review # draft | review | approved | rejected | ported
base: v4-twin-tanks
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [features/account/wallet-settings.tsx, features/account/wallet/balance-card.tsx, features/account/wallet/top-up-card.tsx, features/account/wallet/wallet-history.tsx] # wallet-only files; the shared web Slider is no longer used (Radix directly), and no shared component is changed
ported:
---

# Twin tanks (fix round 1)

## Idea
This version keeps the v4 concept. Cash and points are two tanks of equal weight. The cash tank's fill line is a
real slider that composes a top-up, a valve turns points into balance, a trips strip ties the balance to the
customer's own searches, and the history is a ticket stack. v7 fixes every blocking issue from the v4 review and
applies the owner's round-1 decisions:
- Hidden amounts are a **neutral state**.
- Covered trips and "Book with your balance" open the **real flight search, pre-filled**.

The panel is now organised as **two sides, each read top to bottom**:
- **Cash side:** tank, then top-up.
- **Points side:** tank, then the valve that pours toward cash.

This makes the DOM order, the tab order and the visual order the same at every width.

## Key decisions
- **Two sides instead of three columns.** v4 used cash | valve | points over a full-width top-up. Its tab order
  could not match the visual order at xl and on mobile at the same time.
  - **From lg:** two columns, cash (1.45fr) and points (1fr), split by a dashed amber rule. The valve sits under
    the points tank. Its pipe and arrow point toward the cash side, which is at the inline start.
  - **Stacked:** the same order. A compact **points row** ("2,350 pts · Silver · Convert ›") sits under the cash
    caption, so rewards are one glance from the balance on phones. Convert focuses the valve.
- **Neutral hidden state** (owner decision). While amounts are hidden, nothing reveals the balance.
  - **Cash tank:** no level and no held band. Drifting mist, faint horizontal lines, unlabelled ticks and an
    eye-off seal. The only fill drawn is the top-up being composed: a teal dashed slice from the bottom, on a
    scale that depends on that amount alone. Trip lines and IATA labels are not drawn.
  - **Trips strip:**
    - Prices and "Search again" (a pre-filled link) only. No covered, covered-after or gap badges, and no
      coverage tint.
    - A note says why, with an inline "Show amounts" button.
  - **Points:** count, tier and progress only. "Worth about $X" is removed. The valve's "Adds about" and the
    thumb's value text are masked. After a redeem, the success line names the points only.
  - **Unchanged:** movements stay visible, as in today's history.
- **Spending-limit reading.**
  - **Ticks:** unlabelled tick marks stay (5 ticks, longer at the halves). A teal double chevron above the
    scale says "it goes higher".
  - **Drag past the top:** past 90% of the height, the scale steps up live during the drag, one nice step every
    450 ms (for example $500 → $1,000 → $2,500), so the drag never hits a ceiling.
  - **"No cap":** sits next to the hero number at body size (teal, ∞). The longer "ruler, not a limit" line sits
    below it.
  - **Vessel outline:** about 3.75:1 in light and 5.2:1 in dark, measured. The rim lips are thicker (5px) and
    flared, so the open top reads.
- **Tank slider semantics.** The fill line is now a custom `role="slider"` with the **per-top-up range**:
  `aria-valuemin` 5 and `aria-valuemax` 5,000.
  - The gauge scale is visual only, so End means "maximum" and is idempotent (5,000 every time). It never
    escalates past the limit.
  - Keys: Home = 5, arrows = ±5, PageUp/PageDown = ±50.
  - The thumb shows "+$50", the top-up itself, which is a movement, not a balance.
  - `touch-action:none` is set only on the 44px handle.
- **Pre-filled flight search** (owner decision). The link uses the real web format:
  - **Source:** `features/flights/history/history-href.ts` → `flightsHref` → nuqs `serializeFlightSearch`, with
    the locale prefix (`localePrefix: 'always'`).
  - **Format:** `/{locale}/flights?trip=…&slices=ORIG_DEST_YYYY-MM-DD,…&adults=…&children=ages&infants=n&infantAges=…&cabin=…&cur=USD`.
  - **Defaults left out:** values equal to the default (1 adult, no children or infants, economy) are omitted, as
    nuqs `clearOnDefault` does.
  - **Same tab:** these are plain links.
  - **"Book with your balance":**
    - Amounts shown: the most recent search the balance covers, else the most recent search.
    - Hidden: the most recent search, so the target does not depend on the balance.
    - No searches: `/{locale}/flights`.
  - **Covered cards:** a covered card has "Book it". Other cards keep "Add $X" plus a search icon. Both go to the
    same pre-filled URL.
  - **Curated cards:** these have no search to re-run and go to `/{locale}/flights`.
- **Motion on transform.** The cash liquid, the held band, the ghost, the thumb and the points liquid are
  full-height layers moved with `translateY`; their height is no longer animated. The valve stream uses
  `translateX`, with the direction set by the locale. Every spinner is `motion-safe:`. Reduced motion places
  levels directly and stops the mist and the stream.

## Review findings and how they were resolved
| # | Finding (v4 review) | Resolution in v7 |
|---|---|---|
| B1 | Valve slider has no accessible name | `parts/valve.tsx` uses `radix-ui` `Slider` directly. `aria-label` ("Points to convert") and `aria-valuetext` ("1,000 points, adds about $10.00", or the points only when hidden) sit on `Slider.Thumb`. The shared web slider is untouched. Verified in the CDP AX tree: name "Points to convert". |
| B2 | Drag-to-fill slider nested in `role="img"` | The vessel is a decorative `role="img"` layer. The slider is a **sibling** layer over it. AX tree check: the slider has no img ancestor. |
| B3 | Focus lost after redeem, Show more and top-up submit | All three use `aria-disabled` while busy and ignore repeats, so focus stays on the button (verified: "Converting…", "Loading…", "Taking you to…"). After Show more, focus moves to the first newly loaded movement (verified: `li#story-pay_51`). The redeem result is announced in the live line. |
| B4 | Hidden amounts leak the balance (owner: neutral state) | See "Neutral hidden state" above. Automated check with amounts hidden in en and ar: no "Covered", "Worth about", "Top up to cover" or Arabic equivalents in the page, and the tank's text is only "+$50". |
| H | Tank reads as a capacity gauge when hidden; drag clamps at the scale; "No cap" too small | Unlabelled ticks plus a growth chevron, live scale growth while dragging (drag test: 100 → 735 → 2,240 → 4,685 → 5,000), "No cap" at body size next to the number. |
| H | Keyboard End escalates | `aria-valuemax` is pinned to `maxUsd`, and End = 5,000 every time (tested 3×). |
| H | Tab order at xl does not follow the visual order | Two-sided layout; the DOM order is the visual order at every width (tab walk at 1440: hide → tank slider → hold → book → amount → presets → method → continue → rewards → valve → trips → filters). |
| H | Amount field focus indicator weak | Wrapper gets the shared ring through `focus-within:ring-[3px]` with an offset. |
| H | "Book with your balance" shows on a $0 wallet | Hidden when `available` is 0 (empty scenario verified). |
| M | Vessel outline about 1.3:1 | `border-primary/60` (about 3.75:1) and `dark:border-white/50` (about 5.2:1). Lips are 5px and flared. |
| M | Valve arrow points the wrong way when stacked | Below lg a wallet glyph replaces the arrow, with the line "Goes into your cash balance". From lg the arrow points toward the cash side (inline start). |
| M | Mobile: points after the whole top-up form | A points row under the cash caption (lg:hidden) with "Convert", which focuses the valve input. |
| M | 10–11px text carrying data | Ticks, markers, the thumb label, "balance after", status chips and the preview note are now 12px. |
| M | Points input does not submit on Enter | The valve is a `<form onSubmit>`. |
| M | "Server" jargon | "The exact amount is confirmed when you convert." / "يتأكد المبلغ الدقيق عند التحويل." |
| M | "محجوز لـ فندق" | "مخصّص لحجز فندق في إسطنبول · ليلة واحدة". The fallback is "مخصّص لحجز قيد التنفيذ". |
| M | Return banner not announced | The live region and its box render at mount; the text arrives 250 ms later, so it is announced with no layout shift. |
| L | Animated `height`/`bottom`/`inset-inline-start` | Uses transform (see Motion). |
| L | `animate-spin` not gated | All spinners use `motion-safe:animate-spin`. |
| L | Inputs lack `name`/`autoComplete` | `name="amount"`, `name="points"`, `autoComplete="off"`. |
| L | IATA codes and booking refs translatable | `translate="no"`. |
| L | Shared slider `touch-none` on the whole root | Radix is used directly; `touch-none` is on the thumb only. |
| — | Payment-method tiles truncated "Google Pay" in narrow columns | Container-query top-up layout (`@container`, `@lg:` two columns) and an auto-fit method grid. |
| — | Not done | The trips carousel position indicator, and the filter state in the URL (optional per review). |

## Verification
- Lab frame at 390 / 768 / 1440 × ar / en × light / dark, each with amounts hidden and shown (24 captures). No
  horizontal overflow and no console errors.
- All 7 scenarios at 390 and 1440 (ar): no overflow and no errors. "Book with your balance" is absent in empty,
  frozen and loading.
- Keyboard: tab order, End/Home/arrows, redeem / Show more / top-up focus, and the hold chip all pass. The AX tree
  shows both sliders named and the tank slider outside the img.
- Pointer: dragging past the top grows the scale live, with amounts both shown and hidden.
- Reduced motion: levels render at their final position (transform applied, no spring), and there is no mist
  drift or stream.
- `pnpm typecheck` passes.
- Screenshots in `shots/` (amounts shown): `1440-rtl-light.png`, `1440-ltr-dark.png`, `768-ltr-light.png`,
  `390-rtl-dark.png`.

## Needs backend
Unchanged from v4:
- A booking label on wallet references.
- A refund → booking link.
- A rule on whether redeem into a FROZEN wallet is blocked.
- Conversion of non-USD `lastSeenPrice`.
- A curated-destinations source.

## Open questions
- **The $0 case:** hiding "Book with your balance" on a $0 wallet also happens while amounts are hidden, so a
  shoulder-surfer can tell "zero" from "not zero". Keep it, or show "Search flights" there instead?
- **Hold chip:** with amounts hidden, the hold chip still shows that a hold exists and what it is for (its amount
  is masked). Is that acceptable?
- **Mock trip type:** the lab's round-trip mocks carry one slice, so their links leave out `trip=` and the results
  page treats them as one-way. Real round-trip entries have two slices and get `trip=round`.
- **Drag growth speed:** past the top, the scale grows one step every 450 ms. Is that too fast or too slow on a
  phone?
- Carried over from v4:
  - Should the $50 ghost be pre-filled for everyone?
  - Should the frozen state keep the trips strip?
  - Turkish strings are to be added at port time.
