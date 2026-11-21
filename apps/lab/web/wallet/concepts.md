# Wallet — concepts (Mode A)

Date: 2026-10-27 · Author: redesign-director · Status: proposals only, nothing built.
Scope (owner): **content only**, from the end of the wallet hero (the block overlaps the hero by `-mt-32` today)
down to the newsletter. Header, hero, newsletter and footer are untouched.

Inputs read: `README.md`, `v1-baseline/components.md`, `v1-baseline/owner-1920-rtl-light.png`,
`research/references.md`, `web/src/features/account/wallet-settings.tsx`, `wallet/balance-card.tsx`,
`wallet/top-up-card.tsx`, `wallet/wallet-history.tsx`, `web/src/app/globals.css`, and (read-only, to be strict
about data) the generated API types plus `backend/src/modules/wallet/domain/model/wallet.aggregate.ts` and
`backend/src/modules/payments/application/services/wallet-settlement.ts`.

---

## 0. Ground truth every concept must respect

### 0.1 What the page must support (from the real source)

| Area | Data / action | Source |
|---|---|---|
| Balance | `GET /wallet` → `available`, `balance`, `reserved` (decimal strings), `currency` (USD), `status` ACTIVE / FROZEN | `useWallet` |
| Hide amounts | eye toggle, remembered in `localStorage` (`wallet.balance.shown`), amounts start hidden | `balance-card.tsx` |
| Top-up | amount (regex `^\d{1,6}(\.\d{1,2})?$`), min/max from public settings (default 5 / 5000), quick chips 25/50/100/250 filtered by limits, payment methods by purpose `WALLET_TOPUP` filtered to `hosted_redirect`, idempotency key renewed on change, `POST /wallet/top-ups` → redirect | `top-up-card.tsx` |
| Top-up errors | `wallet.topup_disabled` (404), `topup_amount_out_of_range` (400), `topup_daily_limit_exceeded` (409), `topup_invalid_state` (409), `topup_payments_unavailable` (503), "unsupported" (non-hosted result), "redirecting" state | backend error codes |
| Top-up return | `?payment=<id>` → `usePayment` polls every 3 s → `SUCCEEDED` = done (refresh wallet), `FAILED/CANCELLED/EXPIRED` = failed, else pending | `TopUpResult` |
| History | `GET /wallet/transactions` cursor pages, newest first, "show more", loading / error / empty | `wallet-history.tsx` |
| Rewards | today only a link to `/account/rewards` in a footnote | `balance-card.tsx` |
| Frozen | top-up column removed, amber notice | `wallet-settings.tsx` |

### 0.2 Ledger facts that shape the design (verified in backend, not guessed)

- `balanceBefore/After` on a transaction is the **ledger balance** (= available + reserved), **not** available.
  - `RESERVE` = DEBIT of `amount` from *available*, but `balanceAfter == balanceBefore` (balance unchanged).
  - `CAPTURE` = DEBIT, balance drops by the reserved amount (the hold becomes a payment).
  - `RELEASE` = CREDIT back to available, balance unchanged.
  - So the baseline shows RESERVE −228.99 and then CAPTURE/PAYMENT −228.99 as two red rows: the customer reads
    "charged twice", while the balance moved only once. **Grouping RESERVE→CAPTURE/RELEASE is mandatory.**
- `reference` on RESERVE / CAPTURE / RELEASE / PAYMENT is `{ type: 'PAYMENT', id: paymentId }` — **not** the
  booking. Refunds carry `{ type: 'REFUND', id: refundId }`; redemptions `{ type: 'LOYALTY', id }`.
  - Group key for a booking story = `reference.id` of the PAYMENT (works client-side today).
  - Booking name: `GET /payments/{id}` (customer-readable, `usePayment` exists) → `bookingId` → trip detail.
    That is a 2-hop lookup per group: **available today but chatty**; do it lazily (on expand / in view), and
    propose backend enrichment (`reference.bookingId` + short label) as "needs backend".
  - Refund → booking: `PaymentDto.refunds[]` lists refund ids with `destination: WALLET`, so a REFUND row can be
    attached to a group **only if that payment was fetched**. Robust linking needs backend.
- Running available after each row is **not** in the DTO (only in the internal event). Running *balance* is.
- `LoyaltySummaryDto`: `pointsBalance`, `redemption { enabled, minPoints, maxPoints, pointValueUsd (number) }`,
  `tier { name, code, multiplier, discountPercent, benefits }`, `nextTier { name, remainingPoints?,
  remainingSpendUsd? } | null`. `POST /loyalty/redeem { points }` (idempotent) → `RedeemPointsResultDto
  { amountUsd (decimal string), points, pointsBalance, transaction }`; hook already invalidates wallet keys.
  `pointValueUsd` is a float: any "= $X" preview is labelled *about*; the credited value is `amountUsd`.
- `FlightSearchHistoryEntryDto` (customer's own searches, `/users/me/flight-searches`): `slices[].destination`,
  `departureDate`, `passengers`, `cabinClass`, `departed`, `lastSeenPrice { amount, currency } | null`,
  `searchedAt`. **This is real data for "what can my balance buy" without inventing an offers endpoint**;
  price is stale ("last seen") and may be in another currency (FX needed — `apiEndpoint/fx` exists, verify).

### 0.3 Rules shared by all three concepts (so each fixes every baseline problem)

1. **One hero number: `available`.** The duplicate "الرصيد" total disappears. `reserved` appears only as a
   labelled hold ("$228.99 held for 1 booking") that opens the booking story. `balance` is never shown alone.
2. **Type labels are always localised** from `type` (+ direction / reference.type); backend `description`
   is shown only as a secondary line in `en`, never as the Arabic title.
3. **Booking stories**: RESERVE + CAPTURE/RELEASE (+ linked REFUND) render as one entry with steps. A RESERVE
   alone = "On hold" (amber), never red. A group split across cursor pages shows "earlier steps not loaded".
4. Every amount in `<bdi dir="ltr">`, tabular numerals; decimal math only via `compareDecimal`,
   `subtractDecimal`, `addDecimal` (no floats). Gap-to-target = `subtractDecimal(target, available)`,
   clamped up to `minUsd`.
5. The Airbnb promise as a persistent line: *"Your balance is applied automatically at checkout."*
6. Payment method is choosable before the amount (methods requested with no amount, re-validated once an
   amount exists) — the current "enter amount first" disabled dropdown goes away.
7. Client-side filter chips over loaded items: All · Trips · Top-ups · Refunds · Points.
8. Month headers with in / out totals — computed only for months that are fully loaded (a month is complete
   once an older item has been loaded); the open month says "so far".
9. Hide-amounts eye kept (privacy), but default **shown** is an open question (see end).
10. Wallet-only parts. None of the concepts uses `SpotlightCard`, `CardTitle`, `DynamicInput`,
    `DynamicSelect` → no ripple to the ~40 account pages that share them.
11. Dark mode: `--primary` becomes near-white in `.dark`, so every navy surface uses
    `bg-primary dark:bg-ocean-deep` (or `primary-dark` / `secondary-dark`), as the baseline card already does.
    Yellow = `--secondary-foreground` `#e7b74c` (not AA as text on white — use it as fill, with navy text).
12. Motion: framer-motion (already a web dependency), max 1–2 animated elements per view,
    `useReducedMotion()` → static rendering with the same information.

Goals key: **G1** encourage top-ups · **G2** trust & clarity · **G3** rewards → wallet · **G4** push toward booking.

---

## Concept A — `flight-path`

**Layout principle: time is the axis.** One continuous vertical spine.

### Thesis
The wallet is the story of a trip fund, so tell it as a flight. The whole content area is a single column
hung on a vertical flight path. At the top sits "now": a cockpit strip with the available balance as the
altitude reading and the next action (refuel = top up, or "book with it"). Below, every movement is a waypoint
on the path, and the path's horizontal offset follows the ledger balance (`balanceAfter`), so the line climbs on
top-ups, refunds and redemptions and descends on payments. Holds are drawn as a dashed "in the air" segment
beside the line until they land (CAPTURE) or return (RELEASE). Booking stories are boarding-pass waypoints
whose stub shows Held → Paid → Refunded. Month "airports" carry in/out totals. The customer reads their money
the way they read a journey, and the current moment always invites the next leg.

### Desktop 1440, RTL (content area max-w 1240, start = right)

```
 ┌───────────────────────────────────── overlaps hero (-mt-32) ─────────────────────────────────────┐
 │  COCKPIT (navy / ocean-deep, rounded-3xl)                                                        │
 │                                                                                                  │
 │   [ eye ]  المتاح الآن                         ┌───────────── REFUEL ────────────────────────┐   │
 │            $250.00   ← huge, tabular           │  أضف رصيدًا           [Apple Pay][Card][GPay]│   │
 │            ● $228.99 محجوز لحجز واحد  ›        │  [25] [50] [100] [250]   |  $ [ 100.00 ]   │   │
 │            يُستخدم رصيدك تلقائيًا عند الدفع       │  min $5 · max $5,000 · صفحة دفع آمنة ↗     │   │
 │                                                │  [ المتابعة إلى الدفع  ↗ ]                  │   │
 │   ┌ يغطي رصيدك ┐ ┌ ينقصك $60 ┐               └──────────────────────────────────────────────┘   │
 │   │ إسطنبول $219│ │ دبي  $310 │  ← from search history (if any)                                  │
 │   └────────────┘ └───────────┘                                                                    │
 │   ✦ 1,200 نقطة ≈ $12   [ حوّلها إلى المحفظة ]   (yellow strip, tier: Silver)                       │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘

   [الكل] [الرحلات] [الشحن] [المبالغ المستردة] [النقاط]                          ← filter chips

     ┌ أكتوبر 2026 ─ دخل +$478.99 · خرج −$228.99 (حتى الآن) ┐   ← month "airport"
     │                                                       │
     │      ✈ (scroll marker shows balance at this point: $250.00)
     │       \
     │        ●──── ┌──────── BOARDING PASS ───────────┬─ stub ─────────────┐
     │        │     │ حجز طيران · القاهرة → إسطنبول  ›   │ ● محجوز   3:06 م   │
     │        │     │ −$228.99                          │ ● مدفوع   3:06 م   │
     │       /┆     │ الرصيد بعدها $21.01               │ ● مسترد  3:07 م   │
     │      / ┆ ←dashed hold segment                    └────────────────────┘
     │     ●──── ↑ شحن رصيد · +$250.00 · Visa · 2:57 م · الرصيد $250.00
     │     │
     └ سبتمبر 2026 ...                                                 [ عرض المزيد ]
```

The path column sits on the start side (right in RTL) ~120px wide; waypoint cards fill the rest. The SVG
mirrors in LTR.

### Mobile 390, RTL

```
 ┌ COCKPIT ─────────────────────────┐
 │ المتاح الآن            [eye]      │
 │ $250.00                           │
 │ ● $228.99 محجوز لحجز ›            │
 │ يُستخدم تلقائيًا عند الدفع          │
 │ [ ＋ أضف رصيدًا ] [ احجز برصيدك ] │  ← refuel opens as bottom sheet
 │ ┌إسطنبول ✓┐┌دبي +$60┐  → scroll  │
 │ ✦ 1,200 نقطة ≈ $12  [حوّل]        │
 └───────────────────────────────────┘
 [الكل][الرحلات][الشحن][…]  ← h-scroll chips
 أكتوبر · +$478.99 / −$228.99
 │●┌ حجز · القاهرة→إسطنبول ──────┐
 │ │ −$228.99 · الرصيد $21.01    │
 │ │ ●محجوز ●مدفوع ●مسترد  ⌄     │
 │ └─────────────────────────────┘
 │●┌ شحن · +$250.00 · 2:57 م ─────┐
 │ └─────────────────────────────┘
 [ عرض المزيد ]
```

On mobile the path collapses to a 24px rail with dots (offset by balance is dropped; the rail colour still
changes: navy segment = settled, dashed amber = held).

### Goals
- **G1** – Refuel panel lives in the cockpit next to the number, not in a side column; choosing an amount
  draws a dotted "climb" preview from the current altitude to the new one ("after top-up: $350.00"); the
  "ينقصك $60" chip pre-fills the exact gap.
- **G2** – Booking stories end the double-charge reading; running balance on every waypoint; holds visible as
  dashed segments with the booking; localised labels; month totals.
- **G3** – Points strip in the cockpit (balance ≈ USD, one tap to redeem); redemptions appear on the path as
  yellow climbs labelled "نقاط → رصيد".
- **G4** – "Book with your balance" button + destination chips (covered / gap) from the customer's own searches.

### Baseline problems fixed
Duplicate balance (one number) · unexplained reserve (chip + dashed segment + story) · English descriptions
(localised types) · no booking link (story header links to trip) · no running balance (on each waypoint) · no
filter (chips) · RESERVE+PAYMENT double charge (grouped) · flat top-up form (in-cockpit refuel with preview) ·
rewards footnote (cockpit strip) · balance not tied to booking (CTA + destination chips).

### Signature interaction + motion
- **Scrubbable altitude**: a small plane marker rides the path as the user scrolls (framer `useScroll` on the
  timeline container) and shows the balance at that point in a tooltip-like label; this is the one continuous
  animation.
- Path draws itself once on load (`pathLength 0→1`, 900 ms, ease-out) — second animated element.
- Refuel preview: dotted climb segment appears when an amount is chosen (150 ms fade).
- **Reduced motion**: path rendered fully, no draw-in; plane marker removed; every waypoint already prints its
  running balance as text, so no information is lost. The SVG path is `aria-hidden`; the real structure is an
  `<ol>` of waypoints with month `<h3>`s.

### States
- **Loading**: cockpit with skeleton number and skeleton refuel chips; path as a faint static rail with 3
  skeleton waypoints.
- **Empty (0 balance, no transactions)**: the cockpit shows `$0.00` with "Your trip fund is ready for take-off";
  refuel panel pre-expanded with the 50 chip pre-selected (not submitted); the path shows a dashed "runway" and
  one ghost waypoint "Your first top-up will land here" + secondary "or redeem 1,200 points" if points ≥ min.
- **Frozen**: cockpit desaturates (`grayscale` on the navy surface only, text keeps contrast), refuel panel is
  replaced by a lock panel "Wallet frozen — top-ups and wallet payments are paused" + contact support link;
  redeem button hidden; path stays readable.
- **Top-up return**: a new waypoint appears at the head of the path (`aria-live="polite"`):
  pending = pulsing node "Refuelling… $100.00" (spinner static in reduced motion); done = node turns teal, the
  number counts up once (reduced: swap); failed = broken dashed node in rose with "Payment not completed" +
  "Try again" (re-opens refuel with the same amount and method).
- **Errors**: wallet load error → cockpit error card with retry; history error → inline on the path with retry;
  loyalty error → points strip hidden (silent); top-up errors under the amount (range shows min/max), daily
  limit and 503 shown in the refuel panel; `topup_disabled` hides refuel and keeps "Book with balance".

### Data
| Available in the API today | Needs backend |
|---|---|
| `/wallet` (available, reserved, status) | Booking label + `bookingId` on the wallet `reference` (today: 2 lazy calls `/payments/{id}` → trip) |
| `/wallet/transactions` (type, direction, amount, balanceBefore/After, createdAt, reference, reversalOfId) | Reliable refund→booking link (today only via fetched `PaymentDto.refunds[]`) |
| Top-up limits, methods by purpose, `POST /wallet/top-ups`, `/payments/{id}` polling | Hold "released or captured by" date (maybe `PaymentDto.expiresAt` — verify meaning for wallet payments) |
| `/loyalty` summary + `/loyalty/redeem` | Running *available* per row (only `balance` today) |
| `/users/me/flight-searches` with `lastSeenPrice` (destination chips) | Curated fallback destinations for customers with no searches |
| Client-side: grouping, month totals, filters, gap maths | |

### Risks / trade-offs
- Balance-driven horizontal offset can be noisy with many small movements; offset is clamped to a band and
  smoothed (log scale), otherwise the line becomes a seismograph.
- A long timeline is slower to scan than a table for accountant-type users; filters + month totals mitigate,
  but there is no column sorting.
- Destination chips depend on search history; hidden when none.
- Scroll-linked marker must be cheap (transform only, one element) to avoid jank on low-end Android.

### Porting impact
Wallet-only: replaces `balance-card.tsx`, `top-up-card.tsx`, `wallet-history.tsx` with new wallet parts
(`cockpit`, `refuel`, `flight-path`, `waypoint`, `booking-story`). `wallet-settings.tsx` composition changes.
Reuses hooks only (`useWallet`, `useWalletTransactions`, `usePayment`, `useLoyaltySummary`, `useRedeemPoints`,
search-history hook). New i18n keys under `walletSettings.*` (ar/en/tr). No shared component edits.

---

## Concept B — `twin-tanks`

**Layout principle: value source is the axis.** A bilateral instrument panel (cash ↔ points) above a stack
of tickets.

### Thesis
The customer has two kinds of value, cash and points, and today one of them hides in a footnote. Put them
side by side as two physical instruments of equal weight: a navy **cash tank** whose liquid level is the
available balance, with a teal held-band on top labelled with the booking that holds it, and a yellow
**points tank** showing points and their dollar equivalent. Between them sits a **valve**: turn it and value
visibly flows from points into cash. Topping up is done on the cash tank itself — drag the fill line up (or type)
and the ghost liquid shows the new level before you pay. Below the panel, the history becomes a **ticket
stack**: booking stories are boarding passes with a tear-off stub tracker, while top-ups, refunds and
redemptions are smaller receipt slips, so money-in and trips are separated by shape before reading a word.

### Desktop 1440, RTL

```
 ┌─────────────────────────────────── overlaps hero (-mt-32) ────────────────────────────────────┐
 │  INSTRUMENT PANEL (white / card, rounded-3xl)                                                  │
 │                                                                                                │
 │   CASH (start)                     VALVE                       POINTS (end)                    │
 │   ┌───────────────┐                                            ┌───────────────┐               │
 │   │░ held $228.99 ░│ ← teal band,   ┌──────────────┐           │               │               │
 │   │░ حجز إسطنبول ›░│   opens story  │  ◐  1,200    │           │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ 1,200 نقطة    │
 │   │~~~~~~~~~~~~~~~│ ← ghost level   │  pts → $12   │ ← slider  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ≈ $12.00      │
 │   │███████████████│   (+$100)       │ [ حوّل ⇠ ]   │           │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ فضي · ×1.5    │
 │   │███████████████│ $250.00 متاح    └──────────────┘           └───────────────┘               │
 │   └──═══●═════════┘ ← drag handle (role=slider)                 ينقصك 300 نقطة للذهبي          │
 │   $ [ 100.00 ]  [25][50][100][250]  [Apple Pay][Card][GPay]    [ المكافآت › ]                  │
 │   بعد الشحن: $350.00 · يُستخدم تلقائيًا عند الدفع                                                │
 │   [ المتابعة إلى الدفع ↗ ]            [ احجز برصيدك › ]                                         │
 └────────────────────────────────────────────────────────────────────────────────────────────────┘

  [الكل][الرحلات][الشحن][المستردة][النقاط]                أكتوبر 2026 · +$478.99 / −$228.99

  ┌────────────── BOARDING PASS ─────────────────────┬┄┄ stub ┄┄┄┄┄┄┄┄┄┐
  │ CAI ──✈── IST    حجز #GT-4821  ›                  ┆ محجوز  3:06  ●   ┆
  │ −$228.99         الرصيد بعدها $21.01              ┆ مدفوع  3:06  ●   ┆
  │ 27 أكتوبر                                         ┆ مسترد  3:07  ●   ┆
  └───────────────────────────────────────────────────┴┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘
     ┌ receipt ───────────────────────┐   ┌ receipt (yellow edge) ─────────┐
     │ شحن رصيد · +$250.00 · Visa      │   │ نقاط ← رصيد · +$12.00 · 1,200 │
     │ 2:57 م · الرصيد $250.00         │   │ ...                            │
     └─────────────────────────────────┘   └────────────────────────────────┘
                                   [ عرض المزيد ]
```

Tickets use the full width; receipts flow two per row on desktop (masonry-free grid), so trips dominate.

### Mobile 390, RTL

```
 ┌ PANEL ────────────────────────────┐
 │ ┌ CASH ──────┐  ┌ POINTS ─────┐   │
 │ │░held $229 ░│  │▓▓▓▓▓▓▓▓▓▓▓▓│   │  two short tanks (h≈180)
 │ │~~~~~~~~~~~~│  │▓▓▓▓▓▓▓▓▓▓▓▓│   │
 │ │████████████│  │▓▓▓▓▓▓▓▓▓▓▓▓│   │
 │ └══●═════════┘  └────────────┘   │
 │ $250.00 متاح     1,200 ≈ $12      │
 │ ┌ VALVE ── 1,200 → $12 [حوّل] ┐   │  valve becomes a pill under both
 │ $ [100.00]  [25][50][100][250]    │
 │ [ApplePay][Card][GPay]            │
 │ [ المتابعة إلى الدفع ↗ ]          │
 │ [ احجز برصيدك › ]                 │
 └───────────────────────────────────┘
 [الكل][الرحلات][…]
 ┌ CAI→IST · −$228.99 ───────────┐
 │ الرصيد $21.01   ┄┄ stub ⌄ ┄┄  │  stub folds under, tap to expand
 └───────────────────────────────┘
 ┌ شحن +$250.00 · 2:57 ──────────┐
```

### Goals
- **G1** – Top-up is a direct manipulation of the thing you care about: the level rises before you pay
  ("after top-up $350.00"). Quick chips snap the handle. Method chosen any time.
- **G2** – Held money is a labelled band inside the tank (not a second total); tickets end the double-charge
  reading; receipts show running balance; shape separates trips from money-in.
- **G3** – Points are a peer instrument with tier and next-tier progress; the valve redeems in place and you
  watch the cash level rise. Strongest G3 of the three.
- **G4** – "Book with your balance" under the cash tank; each ticket links to its trip (manage / rebook).

### Baseline problems fixed
Duplicate balance (tank level + one number) · unexplained reserve (labelled band → story) · English
descriptions · no booking link (ticket header) · no running balance (on tickets/receipts) · no filter · double
charge (one ticket, stub steps) · plain top-up (drag-to-fill) · rewards footnote (equal instrument) · balance
not tied to booking (CTA; weaker than A/C).

### Signature interaction + motion
- **Drag-to-fill**: the fill handle is a real `role="slider"` (`aria-valuemin=minUsd`,
  `aria-valuemax=maxUsd`, `aria-valuetext="$100.00, balance after $350.00"`), arrows ±5, PageUp/Down ±50,
  Home/End = min/max; it is mirrored by a labelled numeric input, so typing works identically. Tank scale is
  the next "nice" ceiling above `available + amount` (250 / 500 / 1,000 / 2,500 / 5,000) and is printed as a
  tick label, so the level is never ambiguous.
- **Valve flow**: on successful redeem, a yellow stream (SVG path with animated dash offset, 600 ms) runs from
  the points tank into the cash tank and the cash number counts up to the new `available`. The amount shown is
  the server's `amountUsd`, never the float preview.
- Tank liquid springs to level on first load (one time).
- **Reduced motion**: no spring, no stream, no count-up; levels render at final height; a text confirmation
  "1,200 points → $12.00 added" is announced via `aria-live`. Tickets do not animate the tear; stub is a plain
  disclosure (`aria-expanded`).

### States
- **Loading**: both tank outlines with a shimmering empty interior (shimmer off in reduced motion), skeleton
  numbers; 2 ticket skeletons + 2 receipt skeletons.
- **Empty**: cash tank empty with the handle resting at the 50 chip as a *ghost* (not submitted) and the copy
  "Fill your trip fund"; points tank empty → "Earn points on every booking" + link to rewards; ticket area shows
  one outlined blank boarding pass "Your first trip ticket appears here" + "Search flights" CTA.
- **Frozen**: frost pattern overlay + lock on the cash tank, handle and input removed, notice under the tank;
  valve disabled with reason ("Redemption into a frozen wallet is paused" — confirm backend behaviour).
- **Top-up return**: pending = liquid "pouring" from the top edge into the tank (reduced: static striped band
  "Processing $100.00"); done = level settles, teal check; failed = ghost level drains, rose message with
  "Try again" keeping amount/method. All in an `aria-live="polite"` region above the panel.
- **Errors**: wallet error → panel replaced by retry card; loyalty error → points tank shows "Rewards
  unavailable" (cash side unaffected); redeem errors (below min, above max, disabled) inline under the valve;
  top-up errors under the input; `topup_disabled` removes the handle, keeps the gauge.

### Data
| Available in the API today | Needs backend |
|---|---|
| `/wallet`, `/wallet/transactions`, top-up limits/methods/`POST`, `/payments/{id}` | Booking label/route on the wallet reference (tickets need "CAI → IST"; today 2 lazy calls per ticket, fallback "Booking #ref") |
| `/loyalty` summary (pointsBalance, redemption min/max/pointValueUsd, tier, nextTier), `/loyalty/redeem` | Refund → booking link (partial today via `PaymentDto.refunds[]`) |
| Client-side: grouping, tank scale, month totals, filters | Top-up bonus tiers (would show as a "bonus" layer in the tank — not proposed without backend) |
| | Whether redeem is allowed while wallet is FROZEN (UI rule depends on it) |

### Risks / trade-offs
- Tank metaphor can read as "capacity/limit" — mitigated by the printed scale and "no limit on your balance"
  hint; still the riskiest metaphor for comprehension, needs the UX critic's look.
- Drag on mobile conflicts with page scroll if the handle is small: handle ≥ 44px, `touch-action: none` only
  on the handle, and the input/chips remain the primary path.
- Points tank is half the panel even for customers with 0 points (wasted prime space); empty-state copy must
  earn it.
- Booking push (G4) is the weakest of the three.
- Ticket "CAI → IST" requires the lazy booking lookup; without it tickets look generic.

### Porting impact
Wallet-only parts (`instrument-panel`, `cash-tank`, `points-tank`, `valve`, `ticket-stack`, `boarding-pass`,
`receipt-slip`). Replaces the three wallet files; `wallet-settings.tsx` composition changes. Reuses loyalty
hooks already used by the rewards page (no edits). The rewards page itself is untouched, but the owner may
later want the same valve there — that would be a separate decision.

---

## Concept C — `departure-board`

**Layout principle: outcome is the axis.** The page leads with what the balance can buy, as an airport
departures board; money management serves the board.

### Thesis
Nobody wants a wallet; they want the trip. So the first thing under the hero is a split-flap **departures
board** built from the customer's own recent flight searches (real `lastSeenPrice`), each row showing the
destination, date, last seen price and a status column computed against the available balance: **COVERED** or
**ADD $60**. Beside the board stands the **gate** — the top-up control with a huge tabular amount. The gate is
live: as the customer types or taps an amount, the board's status flaps re-evaluate ("with +$100 you cover 4 of
6 trips"), turning the abstract top-up into a concrete set of trips unlocked. Any row can be pinned as a
**trip goal** (Monzo-style pot: photo, `$250 / $310`, progress). The statement below is a compact, honest
**flight log** table: month headers, booking stories, running balance column, filters.

### Desktop 1440, RTL

```
 ┌──────────────────────────────── overlaps hero (-mt-32) ─────────────────────────────────────┐
 │ STATUS BAR (navy/ocean-deep, rounded-t-3xl)                                                  │
 │  المتاح  $250.00 [eye]   ● محجوز $228.99 لحجز واحد ›   ✦ 1,200 نقطة ≈ $12 [حوّل]            │
 ├───────────────────────────────────────────────────────────┬──────────────────────────────────┤
 │ DEPARTURES · رحلات يغطيها رصيدك  (navy board, flap cells)  │ GATE · بوابة الشحن                │
 │ ┌────┬──────────────┬────────┬─────────┬───────────────┐  │                                  │
 │ │ IST│ إسطنبول       │ 12 نوف │ $219   │ ✓ مغطّاة  [احجز]│  │   $ 100.00   ← huge, tabular     │
 │ │ DXB│ دبي           │ 03 ديس │ $310   │ + $60  [أضف] │  │   [25][50][100][250]              │
 │ │ LHR│ لندن          │ 20 ديس │ $540   │ + $290 [أضف] │  │   ─────────────────               │
 │ │ CDG│ باريس         │ 05 يناير│ $612  │ + $362       │  │   مع +$100 تغطي 2 من 4 رحلات       │
 │ └────┴──────────────┴────────┴─────────┴───────────────┘  │   بعد الشحن $350.00               │
 │  أسعار آخر بحث · قد تتغير       [ ابحث عن رحلة جديدة › ]   │   [ApplePay][Card][GPay]          │
 │                                                           │   [ المتابعة إلى الدفع ↗ ]        │
 │  📌 GOAL: دبي  ███████████████░░░░  $250 / $310 · 81%     │   min $5 · max $5,000 · آمن ↗      │
 │     [ أكمل الهدف: أضف $60 ]                                │   يُستخدم تلقائيًا عند الدفع        │
 ├───────────────────────────────────────────────────────────┴──────────────────────────────────┤
 │ FLIGHT LOG · سجل الحركات   [الكل][الرحلات][الشحن][المستردة][النقاط]                           │
 │ ── أكتوبر 2026 ─────────────────────────────── دخل +$478.99 · خرج −$228.99 (حتى الآن) ──     │
 │  التاريخ     الحركة                                  المبلغ        الرصيد بعدها              │
 │  27 · 3:06  ▸ حجز · القاهرة→إسطنبول (3 خطوات)  ›     −$228.99      $21.01                    │
 │               ├ محجوز 3:06 · مدفوع 3:06 · مسترد 3:07                                         │
 │  27 · 2:57    شحن رصيد · Visa                         +$250.00      $250.00                   │
 │                                           [ عرض المزيد ]                                     │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile 390, RTL

```
 ┌ STATUS ───────────────────────────┐
 │ المتاح $250.00            [eye]   │
 │ ● محجوز $228.99 ›  ✦1,200≈$12 [حوّل]│
 └───────────────────────────────────┘
 ┌ DEPARTURES ───────────────────────┐
 │ IST إسطنبول · 12 نوف              │
 │ $219              ✓ مغطّاة [احجز] │
 │ DXB دبي · 03 ديس                  │
 │ $310              +$60   [أضف]    │
 │ LHR …                             │
 │ مع +$100 تغطي 2 من 4  (sticky pill)│
 └───────────────────────────────────┘
 ┌ GATE ─────────────────────────────┐
 │ $ 100.00                          │
 │ [25][50][100][250]                │
 │ [ApplePay][Card][GPay]            │
 │ [ المتابعة إلى الدفع ↗ ]          │
 └───────────────────────────────────┘
 📌 دبي ████████░░ $250/$310
 FLIGHT LOG (cards, not table)
 أكتوبر · +$478.99 / −$228.99
 ▸ حجز CAI→IST −$228.99 · $21.01
   شحن +$250.00 · $250.00
```

On mobile, tapping "أضف $60" scrolls to the gate with the amount filled and focus on the submit button.

### Goals
- **G1** – The strongest: every top-up amount is translated into trips unlocked, live; gap chips pre-fill the
  exact amount; the pinned goal gives a reason to come back and top up.
- **G2** – Status bar shows one available number + labelled hold; the flight log is the most scannable ledger
  (table with running balance column, grouped stories, month totals, filters). Board prices are clearly
  labelled "last seen", never presented as quotes.
- **G3** – Points sit in the status bar with "≈ $" and inline redeem; redeemed value immediately re-flips the
  board (points can unlock a trip too). Weaker than B.
- **G4** – The strongest: "احجز" on covered rows opens the flight search pre-filled from the search entry
  (route, date, passengers, cabin).

### Baseline problems fixed
Duplicate balance (status bar) · unexplained reserve (hold chip → story in the log) · English descriptions ·
no booking link · no running balance (dedicated column) · no filter · double charge (grouped row with steps) ·
flat top-up (gate drives the board) · rewards footnote (status bar + board effect) · balance not tied to booking
(the whole board).

### Signature interaction + motion
- **Live what-if board**: amount in the gate → each status cell re-computes with `compareDecimal(price,
  available + amount)` and flips (split-flap: 2-frame `rotateX` per changed cell, 180 ms, staggered 40 ms,
  only cells whose state changed). A polite live region summarises: "With $100 more you cover 2 of 4 trips."
  Debounced 250 ms so screen readers are not flooded.
- Balance digits in the status bar flip once when the value changes (after redeem or top-up return).
- Goal bar fills on load (one time).
- **Reduced motion**: no flips — cells cross-fade instantly; the summary sentence carries the meaning. The board
  is a real `<table>` (`<caption>`, `<th scope>`), flaps are styling on cells, not separate characters for
  screen readers (`aria-hidden` on per-letter spans, full text in a visually-hidden span).

### States
- **Loading**: status bar skeleton; board rows show blank flaps "— — —" (static); gate skeleton chips.
- **Empty (0 balance, no transactions)**: if the customer has searches, the board shows all rows as "+$X" and
  the gate suggests the smallest gap; if no searches (likely for a new wallet), the board shows "NO DEPARTURES
  YET / لا رحلات بعد" flaps and an inline "Search a flight" prompt (link to flights with the hero search) — no
  invented destinations unless backend provides curated ones. Flight log empty: "Your log starts with your
  first top-up".
- **Frozen**: gate flaps to "GATE CLOSED / البوابة مغلقة" with the frozen explanation; board status column shows
  "pay by card" instead of covered/add (wallet payments are blocked when frozen — `assertActive` on reserve);
  redeem hidden.
- **Top-up return**: a pinned first row on the board: "TOP-UP $100.00 — PROCESSING" (pending) → "LANDED"
  (done: wallet refreshed, board re-flips with new coverage) → "CANCELLED" with "Try again" (failed). Plus an
  `aria-live` sentence.
- **Errors**: search-history error → board falls back to the "search a flight" prompt silently (non-critical);
  FX unavailable → rows in other currencies show price without status ("can't compare"); wallet / history /
  loyalty / top-up errors as in A.

### Data
| Available in the API today | Needs backend |
|---|---|
| `/wallet`, `/wallet/transactions`, top-up limits/methods/`POST`, `/payments/{id}` | Curated destinations + "from" prices for customers without searches (offers/destinations endpoint) |
| `/users/me/flight-searches` → destination, date, passengers, cabin, `lastSeenPrice`, `departed` (filter out departed) | Fresh price per route (today "last seen", possibly days old) |
| `/loyalty` summary + redeem | Server-side savings goals (pilot: goal stored per device in `localStorage`, labelled "saved on this device") |
| FX module in web (`apiEndpoint/fx`) for non-USD `lastSeenPrice` — **verify** it converts any pair | Booking label on wallet reference (same as A/B) |
| Flight search deep link from a history entry (existing search URL builder, read-only use) | Destination photos per IATA (static set exists only for ~6 footer cities) |

### Risks / trade-offs
- Depends on search history: new or app-only customers see an empty board — the bold part disappears exactly
  when the page is first seen. Biggest risk; curated fallback needs backend.
- Stale prices can disappoint ("covered" but the fare rose). Copy must say "last seen {date}" and the button
  says "check price", not "book for $219".
- Ties the wallet page to the flight-search domain (more coupling when porting).
- Split-flap motion is decorative-heavy; limited to changed cells and to one interaction.
- Hotels and packages are absent from search history (flights only today).

### Porting impact
Wallet-only parts (`status-bar`, `departure-board`, `gate`, `trip-goal`, `flight-log`). Reads the
search-history hook and the existing flight search URL builder without modifying them. If the owner later
wants curated fallback destinations, that is a backend + new endpoint task, not a shared component change.

---

## Comparison

| | A `flight-path` | B `twin-tanks` | C `departure-board` |
|---|---|---|---|
| Layout axis | Time (vertical spine) | Value source (cash ↔ points) | Outcome (trips the balance buys) |
| G1 top-ups | ●●● climb preview + gap chips | ●●●● drag-to-fill | ●●●●● live trips unlocked |
| G2 trust & clarity | ●●●●● | ●●●● | ●●●● (best ledger table) |
| G3 rewards | ●●● | ●●●●● | ●●● |
| G4 booking | ●●● | ●● | ●●●●● |
| Works for a brand-new wallet | Yes | Yes | Partly (needs searches) |
| Needs backend to shine | No (lookups lazy) | No | Yes (fallback destinations) |
| Comprehension risk | Low–medium | Medium (tank = limit?) | Low (stale prices) |
| Build effort | Medium–high (SVG path) | High (slider + flow) | Medium |

## Recommendation

**Build A `flight-path` first**, borrowing two pieces that are cheap and already designed into it: the gap
chips from C (from search history, hidden when none) and the inline points strip. Reason: the most numerous
and most damaging baseline problems are trust problems in the ledger (double charge, unexplained hold, English
labels, no running balance, no booking link), and A makes the ledger itself the signature instead of decorating
around it. It also works for a brand-new wallet with no extra backend, and every bold element degrades to plain
text under reduced motion. If the owner ranks top-ups and booking above trust, **C** is the higher-upside bet,
but it should wait until a curated-destinations fallback exists; **B** is the right pick only if rewards
redemption is the primary business goal.

## Open questions for the owner

1. Hide-amounts eye: keep amounts hidden by default (today) or shown by default with the eye still available?
   Hidden-by-default works against every goal on this page.
2. Should redeeming points be possible from the wallet page, or only link to `/account/rewards`?
   (All concepts assume an inline redeem using the existing endpoint.)
3. Backend enrichment: may we request `bookingId` + a short trip label on wallet transaction references? Without
   it each booking story needs two lazy requests.
4. Frozen wallet: is points redemption into a frozen wallet blocked by the backend? Is "book with balance"
   hidden while frozen (we assume yes)?
5. Destination chips/board from the customer's search history — acceptable privacy-wise on the wallet page?
6. Turkish (`tr`) exists in the real app; the lab builds ar + en — confirm tr strings come at port time.
