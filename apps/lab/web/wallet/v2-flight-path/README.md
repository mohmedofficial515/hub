---
version: v2-flight-path
title: Flight path
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-10-27
tokens: inherit # inherit | override (see tokens.css)
touches-components: [] # wallet-only: replaces features/account/wallet/{balance-card,top-up-card,wallet-history}.tsx and recomposes wallet-settings.tsx; no shared component (SpotlightCard, CardTitle, DynamicInput, DynamicSelect) is used or changed
ported: # branch / commit once ported
---

# Flight path

## Idea
The layout is organised along time: the wallet is told as one vertical flight path. At the top, the **cockpit**
shows "now". It holds one available number, the labelled hold, the "applied automatically at checkout" promise,
an in-place **refuel** (top-up) panel with a climb preview, the trips the balance covers (or the exact amount to
add for each one), and an inline **points → wallet** strip. Below it, every movement is a **waypoint** on a single
path. The path's distance from the edge follows the ledger balance, so it climbs on top-ups, refunds and
redemptions and drops on payments. Holds are drawn as a dashed amber line that runs alongside the path until the
money lands. A booking's RESERVE → CAPTURE/RELEASE (+ linked REFUND) steps appear as one **boarding pass** with a
tear-off stub. That fixes the baseline's "charged twice" reading, the unexplained reserved amount, the English
labels and the missing running balance. The customer reads their money the way they read a journey, and the top
of the page always points to the next leg.

## Key decisions
- **One hero number: `available`.** `balance` is never shown on its own. `reserved` is a dashed amber chip
  ("$30.00 held for 1 booking ›") that scrolls to and focuses the booking holding it.
- **Amounts hidden by default** (owner decision), using the eye toggle and the same localStorage key
  `wallet.balance.shown` ('1' / '0'). When hidden, every amount (balance, ledger, plane label, gap chips, points ≈)
  shows `$•••.••`. Ledger rows keep their +/− sign so the direction still reads.
- **Booking stories** are grouped client-side by `reference.id` of the PAYMENT. Refund → booking linking uses a lab
  map that stands in for `PaymentDto.refunds[]` (`parts/ledger.ts`). A story whose RESERVE is on a page that is not
  loaded yet says "Earlier steps of this booking are not loaded yet". You can see it on the first page of the
  default scenario, and it resolves after "Show more".
- **Month "airports"** show In/Out from ledger movements only. RESERVE/RELEASE are excluded because they move
  `available`, not the balance. Totals appear only when the month is complete or is the current month ("so far");
  otherwise the month shows "Partial totals, load more".
- **Path geometry**: nodes are measured from the DOM (ResizeObserver), and a smooth spline is drawn through them on
  a linear [0, max loaded balance] scale. A refunded story also draws its internal dip (capture to $0 before the
  refund). The SVG is `aria-hidden`; the accessible structure is `section > h3 (month) + ol > li (waypoint)`.
  On screens narrower than 768 px the path becomes a 40 px rail with nodes centred on it (no altitude), as in the
  concept.
- **Refuel**: you can pick the payment method before typing an amount, which removes the baseline's disabled
  "enter amount first" dropdown. Quick chips come from `topUpPresets` filtered by the limits. Validation uses the
  real regex `^\d{1,6}(\.\d{1,2})?$` and the min/max range, compared in BigInt cents. The "after top-up" value
  and a mini altimeter preview the new altitude. Submitting shows the redirecting state; the lab then explains
  that the provider page would open. On desktop the panel sits inside the cockpit. Below 1024 px it opens inline
  from a "Top up" button, and it starts open with $50 selected (not submitted) when the wallet is empty.
- **Trip chips** use the customer's own searches (not departed, USD `lastSeenPrice`), labelled "Last seen prices;
  they may change". Each chip says either **Covered** or **+$X**. Tapping +$X fills the refuel amount with the gap
  (raised to the $5 minimum when smaller) and moves focus to "Continue to payment". With no searches the chips
  fall back to `curatedDestinations`, labelled as indicative "from" prices. Chips are hidden while the wallet is
  frozen.
- **Points strip** is a yellow fill with ocean-deep text (AA in both themes). It shows points ≈ USD (a preview
  labelled "about", because `pointValueUsd` is a float), the tier and the distance to the next tier. "Move to
  wallet" opens an inline form (points input, "All points", min/max errors). On success it shows the server's
  decimal `amountUsd` in the cockpit's live region, counts the balance up and adds a "New" waypoint at the head
  of the path. Below the minimum it shows "Earn N more points". At 0 points it shows earn copy plus a Rewards
  link. While frozen it shows "paused" and has no button.
- **States** (all of them come from `?scenario=`):
  - default
  - empty: $0.00 with "ready for take-off", a dashed runway and a ghost waypoint
  - loading: skeleton cockpit and a static rail with 3 skeleton cards
  - frozen: the surface desaturates while text keeps its contrast, a lock panel replaces refuel, chips are hidden
    and the points strip shows "paused"
  - topup-pending: cockpit pill plus a pulsing head waypoint
  - topup-done: the wallet is refetched, so +$100.00 shows as a "New" TOPUP and the balance is $320.00
  - topup-failed: rose pill plus a broken head node. "Try again" fills refuel with $100 and Card and focuses
    submit
  - **`error`** (version-local, not in the toolbar; add `&scenario=error` to the frame hash): a wallet load error
    card with retry, plus an inline history error with retry
- **Motion** (framer-motion), limited to two continuous elements:
  - the path draws itself once (`pathLength`, 0.9 s)
  - a scroll-linked plane rides the path (transform only, ≥ 768 px) with a "Balance here" read-out
  - the balance counts up after a top-up or redemption
  - the climb preview fades in
  - panels expand by height

  With `prefers-reduced-motion` there is no draw-in, no plane, no count-up, no height animation and no spinner
  rotation. Every waypoint already prints its balance as text, so no information is lost.
- **Accessibility**: every interactive target is at least 44 px (checked with a script at 390 px), with a visible
  3 px focus ring. Filter chips use `aria-pressed`. Payment methods are a real radio group. Amounts are always in
  `<bdi dir="ltr">`; amounts placed inside sentences use LRI/PDI isolates. Live regions announce top-up results
  and redemptions.
- **Money is never parsed to float for display**: `parts/money.ts` works in BigInt cents (`toCents`, `fromCents`,
  `formatUsd`). Floats are used only for SVG geometry and the "about" points preview.
- **Tokens**: navy surfaces use `bg-primary dark:bg-ocean-deep`, accents use `secondary` (teal) and
  `secondary-foreground` (yellow, as a fill only). Credit amounts use emerald-700 / emerald-400 text for AA; the
  teal token is too light for text on white.

## Lab notes
- Data comes from `@lab/mocks/wallet`. Version-local fixtures live in `parts/use-wallet-lab.ts` (page size 6 to
  simulate cursor paging, the `RETURN_TOPUP = 100.00` return amount, the topup-done ledger entry) and in
  `parts/ledger.ts` (refund → payment map).
- Links (View booking, Book with your balance, covered trip chips, Rewards, Contact support) are inert in the lab.
- Verified with Playwright (Chromium) at 390 / 768 / 1440 × ar-RTL / en-LTR × light / dark, all 7 toolbar
  scenarios plus `error`, reduced motion, keyboard focus, and the redeem / gap-chip / jump-to-hold flows. No
  horizontal overflow and no console errors. Screenshots are in `shots/`.

## Open questions
- **Covered trip chips**: should a covered chip deep-link to flight search pre-filled from the search entry
  (route, date, passengers, cabin), or to the search page only? In the lab it does nothing.
- **Backend enrichment**: may we ask for `bookingId` and a short trip label on the wallet transaction `reference`,
  plus a reliable refund → payment link? Without them each boarding pass needs `GET /payments/{id}` → booking,
  fetched lazily.
- **Non-USD `lastSeenPrice`**: should these searches go through FX, or be hidden? They are hidden now.
- **Frozen wallet**: does the backend block points redemption into a frozen wallet? The UI assumes yes and hides
  the button.
- **Curated fallback**: the "Popular from Cairo" set is lab-only. Should there be a destinations/offers endpoint,
  or a static list per market?
- **Altitude scale**: the scale is linear over the loaded history. With a single large top-up years ago the line
  could sit low for a long time. Should the scale use only the last N months instead?
- **Turkish (`tr`) strings** are to be added at port time.
