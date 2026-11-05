---
version: v3-departure-board
title: Departure board
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [] # wallet-only parts; no shared component changes (see Porting)
ported:
---

# Departure board

## Idea
The page is organised around what the balance can buy. Directly under the hero, a navy status bar shows one
number, **available**, as split-flap digits. Next to it are the labelled hold and the points chip, which converts
points to balance inline. Below that is an airport **departures board** built from the customer's own flight
searches. Each row shows the destination, date, last seen price and a status that is checked against the balance:
COVERED, WITH TOP-UP, or `+$gap`. Next to the board stands the **gate**, the top-up control. While the customer types
or taps an amount, the board's status cells flip ("With $100 more you cover 3 of 4 trips"), so a top-up becomes a
set of trips it unlocks. A row can be pinned as a **trip goal** (progress bar plus a "complete the goal" button). The
honest **flight log** sits below. It groups booking stories (hold → paid → refunded as one row), adds month in/out
totals, a running balance column and filters.

## Key decisions
- **One hero number.** Only `available` is shown large. `reserved` appears as a "$30.00 held for 1 booking" chip.
  The chip scrolls to that booking story in the log, opens it and moves focus there. `balance` is never shown alone.
- **Amounts hidden by default** (owner decision). This uses the real key `wallet.balance.shown` in localStorage and
  defaults to hidden. Every money value on the page is masked, including the log, the hold, the points value, the
  balance after top-up and the goal progress. The board then goes on **standby**: prices stay visible because they
  are not private, but the status column shows masked tiles. A "Show balance & match trips" button sits in the board
  itself, so the privacy toggle becomes the way to switch the board on. Gap amounts and Add buttons only appear
  when amounts are shown, because they would reveal the balance.
- **Inline points → wallet** (owner decision). The points chip in the status bar opens a panel in place. It has a
  slider plus a number field (min/max from `redemption`, step 50), an "All" button, an "≈ $" preview labelled
  *about* (`pointValueUsd` is a float), and "Convert now", which uses the same `POST /loyalty/redeem` call. The
  credited `amountUsd` goes into the balance right above. Then the balance digits flip, the board re-evaluates, a
  REDEMPTION row appears at the top of the log, and a polite status line confirms it. When no points are left, focus
  moves to the confirmation. With 0 points the chip links to rewards instead. The panel is hidden while the wallet
  is frozen.
- **Board rows come from search history** (owner decision). Only searches that have not departed and have a USD
  `lastSeenPrice` are used. The copy says "last seen · may change — not a quote", and the row action says "Check
  price", never "Book for $X". With no searches, the board shows **curated destinations** under the title "Popular
  places to start", with a "From" column and an "indicative prices" note.
- **Gap chips fill the gate.** "Add $57" is the gap from `available`, rounded up to whole dollars and clamped to the
  top-up minimum. It fills the gate, scrolls it into view and moves focus to "Continue to payment". The goal's
  "Complete the goal" button does the same.
- **Split-flap that never hurts reading.** Latin strings (IATA codes, prices, gaps, balance) use one tile per
  character. Arabic text and long words are a single tile, so letter shaping and line width are kept. Tiles are
  `aria-hidden`, and screen readers get the full string once from an sr-only span. Only tiles whose character changed
  remount and flip (180 ms, 20–35 ms stagger). With `prefers-reduced-motion` there is no flip. The board is a real
  `<table>` with a caption and `th scope` from 640 px up, and a card list below that. Coverage is announced by one
  debounced (250 ms) `aria-live` sentence, not per cell.
- **Gate.** The amount is large and tabular (regex and limits from the real top-up card). Arabic digits are
  normalised, and the four presets are 44 px tall. A balance-after-top-up line is shown. The payment method can be
  picked **before** the amount (radio cards), which removes the baseline's disabled dropdown. The submit button uses
  teal fill with dark navy text (8:1 contrast), unlike the baseline's white on teal. It shows "Taking you to the
  payment page…" while redirecting. When frozen, the gate becomes "GATE CLOSED" with the reason.
- **Top-up return** (`?payment=`) is a pinned first row on the board: TOP-UP $100.00 · PROCESSING / LANDED /
  CANCELLED, with a status sentence. Failed offers "Try again", which refills the gate with the same amount.
  Done adds the credit and a TOPUP row (lab: $100).
- **Frozen.** An amber-edged notice in the status bar links to support. Every board status shows "PAY BY CARD",
  Add buttons and redeem are hidden, and the gate is closed.
- **Flight log.** Rows are always localised from `type` (the backend `description` appears only as a small second
  line in `en`). RESERVE + CAPTURE/RELEASE + linked REFUND form one story with a state chip (on hold / paid /
  released / refunded), a step timeline, the booking ref and a "View booking" link. A story split across cursor
  pages says "Earlier steps not loaded yet". Month headers show in/out totals of movements that changed the balance;
  holds and releases are excluded, and an open month says "so far". The balance-after column is the ledger
  `balanceAfter`. The client-side filters are All · Bookings · Top-ups · Refunds · Points. Loading, empty ("Your log
  starts with your first top-up"), error with retry, paging and "end of log" states are all included.
- **Decimal safety.** All money maths uses the real `@web/apiEndpoint/shared/money` BigInt helpers, imported
  read-only (`compareDecimal`, `addDecimal`, `subtractDecimal`, `sumDecimals`, `formatMoney`). Amounts sit in
  `<bdi dir="ltr">`. Amounts inside translated sentences are wrapped in Unicode isolates (LRI/PDI), so
  "بين $5.00 و$5,000.00" keeps its order.
- **Dark mode.** The board uses `bg-primary-dark` in both themes, which makes it the single focal surface. The
  status bar uses `bg-primary dark:bg-ocean-deep`. Yellow (`secondary-foreground`) is used only as a fill with navy
  text, or as text on the near-black board, where its contrast is above 9:1. Letter-spacing is removed in RTL
  (`rtl:tracking-normal`) so Arabic eyebrows stay joined.
- **Scenarios.** `?scenario=` is read during render and the state machine is keyed by it. Supported scenarios:
  default, empty, loading, frozen, topup-pending, topup-done and topup-failed, plus a lab-only `error` (log fails,
  retry succeeds).

## Verification
- Lab frame at 390 / 768 / 1440 × ar / en × light / dark: no horizontal overflow (scrollWidth equals the viewport in
  all 12 combinations and in every scenario).
- Interaction script: reveal → amount 100 → board summary updates → "Add $57" fills the gate and focuses submit →
  pin goal → redeem 2,350 pts → +$23.50, the board re-flips and focus lands on the confirmation → hold chip opens and
  focuses story `pay_77` → show more → expand a refunded story. Checked with reduced motion on (390 ar dark) and
  off. No console errors.
- Keyboard: every control is reachable and shows a 3 px teal ring. Targets are at least 44 px.
- `pnpm typecheck` is clean.
- Shots: `shots/1440-rtl-light.png`, `shots/1440-ltr-dark.png`, `shots/768-rtl-dark.png`,
  `shots/390-rtl-light.png`, taken with amounts shown so the board is live.

## Porting
Wallet-only parts, which replace `balance-card`, `top-up-card` and `wallet-history` inside `wallet-settings.tsx`:
`status-bar`, `redeem-panel`, `departure-board`, `gate`, `trip-goal`, `flight-log`, `flap`, `log-model`. The port
reads the existing hooks (`useWallet`, wallet transactions, `useLoyalty`, `useRedeemPoints`, `usePayment`,
search history) and the flight search URL builder without changing them. No change to `SpotlightCard`,
`CardTitle`, `DynamicInput` or `DynamicSelect`. Lab-only stand-ins: the `REFUND_TO_PAYMENT` map (real source:
`PaymentDto.refunds[]` after a lazy `GET /payments/{id}`), booking labels, and the goal stored in localStorage
`wallet.v3.goal`.

## Open questions
- **Hidden-by-default against the board.** With amounts hidden, the board starts on standby, so its main value
  appears only after one click. Should coverage words (COVERED / NOT YET) be shown without amounts while hidden?
  They reveal a lower bound of the balance.
- **Curated fallback source.** The fallback list is a fixture here. Which endpoint (destinations/offers) supplies
  the "from" prices, and how often are they refreshed?
- **Non-USD `lastSeenPrice`.** Such rows are dropped today. Should they be converted with the FX module and marked
  "≈", or listed without a status?
- **Trip goal storage.** Is per-device (localStorage) acceptable for a pilot, or is a server-side goal needed?
- **Redeem while frozen.** Does the backend block `/loyalty/redeem` into a frozen wallet? This version hides it.
- **Booking enrichment.** Can we have `reference.bookingId` plus a short label on wallet transactions, so stories
  do not need two lazy lookups?
- **"Check price" deep link.** Should it re-run the search pre-filled (route, date, passengers, cabin) in the same
  tab or in a new tab?
