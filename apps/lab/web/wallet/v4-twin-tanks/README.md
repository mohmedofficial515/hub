---
version: v4-twin-tanks
title: Twin tanks
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [features/account/wallet-settings.tsx, features/account/wallet/balance-card.tsx, features/account/wallet/top-up-card.tsx, features/account/wallet/wallet-history.tsx] # wallet-only files; no shared component (SpotlightCard, CardTitle, DynamicInput, DynamicSelect) is used or changed
ported:
---

# Twin tanks

## Idea
The layout is organised by where value comes from. Cash and points sit side by side as two instruments of
equal weight, so rewards stop hiding in a footnote. The navy **cash tank** shows `available` as liquid. A
striped teal band on top is the money held for a booking, and a dashed "ghost" is the top-up you are composing.
The fill line is a real vertical slider: drag it up, or type an amount, and the level rises before you pay.
The yellow **points tank** sits on the opposite side. The **valve** between them turns points into balance in
place: a slider mirrored by a number field, a live "adds about $X" preview, and a stream toward the cash side.
Under the panel, a **trips strip** shows which of the customer's own searches the balance already covers. If
the customer has no searches, it falls back to curated destinations. The history becomes a **ticket stack**:
each booking payment is one boarding pass with a step-tracker stub (held, then paid or returned), and money that
came in arrives as receipt slips. The reader can tell trips from money-in by shape, before reading any text.

## Key decisions
- **One hero number, `available`.** The baseline's duplicate "balance" total is gone. `reserved` appears only
  as the striped band plus a chip ("Held $30.00 · for Istanbul hotel · 1 night"). The chip scrolls to that
  booking's ticket, opens it and moves focus there.
- **"Tank = spending limit" risk, four mitigations:**
  1. The vessel has an **open top** (rim lips, no lid) and the liquid never reaches it: the scale is always the
     next "nice" ceiling above balance + top-up, with 15% headroom.
  2. The scale is a **ruler that visibly grows**. While you drag, the scale stays fixed. When you let go near
     the top, it steps up ($500 → $1,000), so the customer sees that there is no ceiling.
  3. The lines inside the tank are **trips, not capacity**: dashed lines at the price of each searched trip,
     labelled with the IATA code and a check when covered. The scale reads as "what this buys", not "how much
     fits".
  4. A plain-language line under the number: "No cap on your balance — the scale grows as it does." The only
     limit shown is labelled per top-up ("$5.00 to $5,000.00 per top-up").
- **Push toward booking (G4)** uses the same data in three places: trip lines on the tank, the trips strip
  (searches with a last-seen USD price and not departed, else curated "Popular from Cairo"), and "Book with your
  balance". A strip card shows "Covered by your balance", or "Covered after top-up" while a ghost is composed.
  Otherwise its "Add $56.50" button fills the top-up with the exact gap (raised to the $5 minimum) and focuses
  the amount field. Prices are labelled indicative ("Last seen" / "From").
- **Amounts hidden by default** (localStorage `wallet.balance.shown`, same key as today). Rule: **balances**
  are masked (available, held, balance after, available after top-up, scale numbers, gap amounts). **Movements**
  stay visible, as in today's history. The tank level and trip ticks stay visible: they show proportions, not
  figures (see open questions).
- **Drag-to-fill accessibility.** Radix vertical slider: `role=slider`, `aria-valuemin=5`, max = the room left
  under the current scale (up to 5,000), and `aria-valuetext` "$100.00, available after top-up $320.00".
  Arrow keys move ±5 and Home/End jump to the ends. It is mirrored by a labelled `inputMode=decimal` field with
  the real regex. `touch-action:none` is set only on the 44px handle, so the page still scrolls on phones. A
  vertical slider needs no RTL mirroring. The valve uses the real `@web/components/ui/slider` with `dir` from
  the locale (thumb 24px, track hit area 48px).
- **Payment method can be chosen before the amount** (3 radio tiles). The disabled dropdown is gone.
- **No floats for money.** Sums, gaps and comparisons run on BigInt cents (`parts/money.ts`). Display passes
  decimal strings to `Intl` (en-US, Latin digits). Amounts sit in `<bdi dir="ltr">`; amounts inside sentences
  use LRI/PDI isolates. Points preview is in whole cents and labelled "about". The credited value is the
  server's `amountUsd`.
- **Ledger grouping** (`parts/ledger.ts`): RESERVE/CAPTURE/RELEASE that share `reference.id` (PAYMENT) become
  one ticket: On hold (amber, never red), Paid, or Back in your balance (struck amount). Month headers show
  in/out totals ("so far" while older pages are not loaded). RELEASE is not counted as money in. When a group is
  split across cursor pages, the ticket shows "Earlier steps not loaded yet" (visible on the first page of the
  default data). Filter chips (All / Trips / Top-ups / Refunds / Points) work on loaded items. Type labels are
  always localised. The backend `description` appears only as a secondary line in `en`.
- **Contrast.** The teal CTA uses navy text (`text-ocean-deep` on `#2db2b9`), not white. Yellow is used only
  as a fill, with navy text. Every navy surface has `dark:bg-ocean-deep`.
- **Motion** (framer-motion, 2 elements): the tank liquid springs to its level on load, and the valve stream
  plus cash count-up play after a redeem. Under `prefers-reduced-motion` the levels render at their final
  height, and there is no stream or count-up. The result is announced in an `aria-live` line. The loading
  shimmer is `motion-safe` only.
- **States** (via `?scenario=`): loading (outlined empty tanks with shimmer plus ticket skeletons), empty ($0
  tank with a $50 ghost on a $100 scale, points empty state with a rewards link, curated trips, a blank-ticket
  empty state with "Search flights"), frozen (frost and lock on the tank, top-up and trips removed, notice with
  support link, valve paused with a reason), topup-pending (banner plus striped "pouring" ghost, handle
  disabled), topup-done, topup-failed (banner with "Try again", which focuses the amount; amount prefilled).
  Lab-only extras: amounts above $2,000 simulate `topup_daily_limit_exceeded`; submit shows the "redirecting"
  state.
- A navy band at the top stands in for the end of the wallet hero, so the `-mt-32` overlap reads correctly.
  It is not part of the design.

## Verification
- Lab frame checked at 390 / 768 / 1440 × ar / en × light / dark. Each scenario was checked at 390 RTL light
  and at 1440 LTR dark. No horizontal overflow and no console errors.
- Interaction script: the slider keys change the input (50 → 60), End rescales the gauge (max 250 → 750), the
  gap button fills 56.50 and focuses the input, redeem credits and announces, the hold chip focuses the
  ticket, and out-of-range and daily-limit errors show. Targets under 44px: only the sr-only radio inputs (the
  labels are 44px) and the valve slider thumb (track hit area 48px).
- `pnpm typecheck` passes.
- Screenshots in `shots/`: `1440-rtl-light`, `1440-ltr-dark`, `768-ltr-light` (all with amounts shown),
  `390-rtl-light` (default, amounts hidden), `390-rtl-dark` (reduced motion, amounts shown).

## Needs backend
Booking label on wallet references (today: 2 lazy calls, `GET /payments/{id}` then the booking). A refund →
booking link. Whether redeem into a FROZEN wallet is blocked. Converting non-USD `lastSeenPrice` (non-USD
searches are skipped today). A curated-destinations source for the fallback.

## Open questions
- With amounts hidden, is it acceptable that the tank level and the trip check marks still show proportions
  (for example "Istanbul is covered")? The other option is to blur the liquid while hidden, which makes the
  default first view much weaker.
- Should the $50 ghost be pre-filled for every customer (a top-up nudge), or only for an empty wallet?
- Points tank level: here it is points against its own growing scale, with a line at the redeem minimum. Would
  you rather it show progress to the next tier (lifetime points)?
- Should the frozen state keep showing the trips strip (as inspiration) or hide it, as here?
- Turkish strings are to be added at port time.
