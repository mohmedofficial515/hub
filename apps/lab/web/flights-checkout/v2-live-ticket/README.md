---
version: v2-live-ticket
title: Live ticket
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-21
tokens: override # tokens.css: develop's primitives + semantic roles, scoped to this version
touches-components: [features/flights/reservation/index.tsx, features/flights/reservation/itinerary-summary.tsx, features/flights/reservation/mobile-total-bar.tsx, features/flights/reservation/step-navigation.tsx, features/flights/reservation/price-lock-bar.tsx, features/flights/reservation/steps/passenger-form.tsx, features/flights/reservation/steps/passenger/passenger-card.tsx, features/flights/reservation/steps/passenger/contact-card.tsx, features/flights/reservation/steps/payment-form.tsx, features/flights/reservation/steps/payment/methods.ts, features/flights/reservation/steps/payment/method-list.tsx, features/flights/reservation/steps/payment/hold-offer.tsx, features/flights/reservation/steps/payment/company-invoice.tsx] # all reservation-only; shared DynamicInput / DynamicSelect / PhoneInput / DatePartsField / HeroBanner are NOT changed (the page simply stops using HeroBanner)
ported:
---

# Live ticket

Hub card GTV-521 (plan GTV-472, phase 3). Scope: step 1 (passengers + contact) and step 4 (payment) with the sticky
price summary.

## Idea
The summary is not a receipt that waits at the end; it is the ticket itself, written while the customer works. A
solid navy strip carries the route, both flights and the price-hold timer; below a tear line, each passenger
appears **exactly as the airline will print it** (`ALHARBI/MOHAMMED SALEH MR`) the moment it is typed or picked from
saved travellers; below a second tear line, every price line in the booking currency, the currency switch, and on
the payment step the exact amount each part of the payment charges. The same "as printed" line sits inside every
passenger card. This one device answers the two questions that decide a flight sale — *are the names right?* and
*what exactly am I paying, in which currency?* — and it does so with type and lines only (boarding-pass exactness,
direction B of the research), no gradient or decoration.

## How it reads
- **Desktop (lg+):** two columns. Main column: title "أكمل حجزك" (no photo hero, audit L-15), a 4-step line
  stepper, then the step. The end column is the sticky ticket; its body scrolls inside, and the total + the screen's
  one primary button stay pinned at its foot, so the button is always in view (checked at 1440×900).
- **Below lg (768, 390):** one column; a fixed bottom bar holds the total, "Price details" (opens the ticket as a
  bottom sheet) and the one primary button. A one-line trip summary (`IST → CAI · dates · 3 travellers`) sits under
  the title.

## Key decisions
- **Passport-name helper, three layers.**
  1. Every card shows "Printed on the ticket as" with the live airline-format name (title derived from gender).
  2. Non-Latin letters are stripped as typed (develop's rule, unchanged) and the error now says what to do: "Latin
     letters only. Copy the name from the passport data page, e.g. MOHAMMED."
  3. "Where is my name in Latin letters?" opens a drawn passport data page (always LTR, as printed) with the Surname
     and Given names fields numbered 1 and 2 and mapped to the two inputs, plus the MRZ lines with the same spelling
     highlighted, and "do not translate or add words that are not printed".
- **Saved travellers chooser** ("Who is travelling?") above the cards replaces the per-card select. Chips show the
  Latin name, type and age; tapping fills the first free slot that fits the age (develop's `travellerFits` rule:
  adult ≥ 18, child = searched age); a chip that fits no free seat is disabled with the reason ("Age fits no seat").
  The traveller's `avatarColour` (unused today) colours the initials disc. Tapping again removes the traveller.
  Guests see a notice instead (tickets go to the verified e-mail + sign-in link), and no "save traveller" tick (L-56).
- **Title is derived from gender** and shown as one line "Title on the ticket: MR · Change"; the select appears only
  on Change (L-56). Gender is a two-cell segmented control, navy = selected.
- **Full fee transparency from step 1.** The ticket shows fare, taxes and airline charges, seats & bags (with the
  item: "23 kg bag · Outbound"), booking fees, service fee (non-refundable) and the total, in the booking currency,
  on every step. "If you cancel" (estimate) is one tap away in the ticket from step 1, with the airline penalty,
  our cancellation fee and the kept service fee **in the booking currency** (L-38, L-63).
- **Currency.** "Prices in [SAR ▾]" in the ticket runs the existing switch (`POST /flights/checkout/{id}/currency`);
  while it runs, lines dim and "Updating prices to USD…" is announced. Totals come from the server per currency
  (mock `TOTALS`), the client never converts lines.
- **"What you pay, and in which currency"** — one sentence under the methods, rebuilt from the chosen method:
  - same currency: "You pay SAR 2,586.00 with Apple Pay. That is the amount on your statement."
  - converted: "Apple Pay charges in SAR: you pay SAR 2,586.00. Prices on this page are shown as about USD 689.60."
  - wallet split: "USD 240.00 comes from your wallet, then you pay TRY 19,108.00 with … on the payment page."
  The ticket repeats it as "Charged with Apple Pay · SAR 2,586.00" (+ "From your Goteav wallet" when split), and
  every method tile shows what it would charge ("Charged as SAR 2,586.00" when converted).
- **Methods ordered by country, Apple Pay first where offered.** "Ordered for paying from Saudi Arabia" with a
  country select (SA: Apple Pay, mada, STC Pay, card · KW: Apple Pay, KNET, card · AE: Apple Pay, card · TR: card via
  iyzico, card via PayTR). Labels follow develop's `methods.ts` rule ("via" for PayTR/iyzico and for twins).
  Hosted redirect only; "Card details are never entered on this site" stays.
- **Wallet** keeps develop's behaviour: the wallet tile is shown disabled with "Balance USD 240.00 does not cover this
  booking", and "Use my wallet balance (USD 240.00)" splits the payment.
- **Pay later (hold)** is a separate card with an **outline** button, so the screen keeps one primary button; for
  guests it says an account is needed. Company invoice is a tick that opens the Turkish fields.
- **Trust lines** at the end: "Nothing is charged before you confirm on the payment page" and the refund choice
  (wallet at once or back to the payment method) if the airline cannot issue the ticket. The silent hold before
  charge is not surfaced as a step.
- **Price hold** appears on the payment step only (as today): timer in the ticket header and next to the total at
  the ticket foot; under 2 min it turns amber (gold on the navy strip); at 0 the primary button becomes
  "Update price" (re-price, as `price-lock-bar.tsx` does).
- **Continue with missing fields** does not disable the button: it scrolls to the first incomplete card, and the
  line under the button says "Fill N fields to continue". Each card header counts its own missing fields.
- **Owner rules applied:** white page, navy headings/selection, teal primary with white text (exactly one per
  screen, verified in all 24 captures), gold only on the navy strip (route arc, plane, low-timer), flat cards with
  1px hairlines, 2px only for selection, no gradients, glows or blur (the sheet backdrop is the flat scrim colour
  at 60%), no stripes (meaning = icon + word), Cairo, weights ≤ 700, no 13px (12px only for meta), card radius 18px,
  sheet 22px; no photo cards on this page. Dashed lines only for the ticket tear lines.
- **Motion:** step change slides 24px from the inline end (direction-aware), price amounts roll on change, the
  printed name cross-fades, guide and invoice open with height; 150–280ms, one easing; `MotionConfig
  reducedMotion="user"` and a CSS guard in `tokens.css`; spinners are `motion-safe:` only.

## Concepts considered (not built)
- **A · Flagship form** — direction B's checkout as written: numbered section cards (Travellers, Contact, Extras,
  Payment) on one long page, a sticky summary with a navy header and the total in gold. Safe and fast to port, but the
  summary stays passive and the gold total conflicts with "gold for small touches only".
- **B · One traveller at a time** — a traveller rail (chips 1–3 with progress) and one passenger form on screen, with
  "Next traveller". Shortest visible form on phones, but hides the others' state and adds clicks for families; worse
  for review of all names together.
- **C · Live ticket (built)** — the summary becomes the printed ticket and the passport-name helper. Chosen because it
  serves both product goals (names right, payment clear) with one signature element and keeps the current wizard.

## States in this version
Lab panel at the bottom (review only): signed in, guest, loading (skeleton in the page's own frame), error (retry +
search again), no methods (warning + contact link, hold stays), price hold ends. URL shortcuts for captures:
`?step=payment`, `?state=guest|loading|error|no-methods`.

## Verification (2026-11-21)
- Lab frame `http://127.0.0.1:7320/lab/frame-web.html#/flights-checkout/v2-live-ticket?lang=ar|en&theme=light|dark[&step=payment]`
  at 390×844, 768×1024, 1440×900 × ar/en × light/dark × passengers/payment = 24 full-page captures in `review/`
  (`<width>-<rtl|ltr>-<theme>-<step>.png`). Classic scrollbars hidden while capturing so the frame is the real width.
- Each capture checked by script: no horizontal overflow, no element outside the viewport, no page errors, exactly
  one teal primary button and it is inside the first viewport.
- State captures in `review/`: `state-390-rtl-light-sheet.png`, `state-390-rtl-light-latin-guard.png` (Arabic typed
  into a name + guide open), `state-1440-ltr-light-usd-converted.png`, `state-1440-ltr-light-wallet-split.png`,
  `state-1440-ltr-light-turkey.png`, `state-1440-rtl-dark-guest-payment.png`, `state-1440-rtl-dark-lock-ended.png`,
  `state-768-ltr-light-no-methods.png`, `state-1440-ltr-dark-loading.png`, `state-390-rtl-dark-error.png`,
  `state-1440-rtl-light-scrolled-rail.png`.
- Keyboard (1440, payment, ar): tab order country → method group → wallet split → hold → invoice → back → currency →
  "If you cancel" → Pay; every stop shows the 2px navy ring; Escape closes the sheet and focus starts on its close
  button. Touch targets ≥ 44px except the 36px currency select and lab chips.
- `pnpm --filter @hub/lab typecheck` passes; a scoped `tsc` over this page folder passes; `pnpm lab:check`:
  "Lab: 47 versions compile."
- Not run: an independent `ux-critic` review (`review.md`).

## Needs backend / proposed
- **Methods ordered by country** — today the client keeps the backend order. Needs the visitor country (IP or account)
  and either a backend order per country or a client order table. Apple Pay first also depends on the device
  (Safari + a card in Wallet); on other devices the tile should drop.
- **Cancellation quote before payment** from step 1 — today the cancellation terms card appears on the payment step;
  showing it in the summary earlier needs the quote with the offer/checkout.
- **Extras breakdown** — `totals.services` is one number; the "23 kg bag · Outbound" sub-line needs the checkout's
  service items (they exist on the extras step).

## Open questions
1. **Pay button colour on navy?** The teal button sits on white in the ticket foot, never on the navy strip. OK, or
   should the ticket foot also be navy?
2. **Refund promise on the payment step** ("you choose the refund: wallet at once or back to your payment method") —
   is this wording acceptable to show before payment, given the refund choice today appears only after a failure?
3. **Hiding Title behind "Change"** (L-56): fine for all airlines, or must Title stay visible when the airline needs it?
4. **Country select on payment:** keep a visible select (lets a Saudi customer in Türkiye pick SA methods) or infer the
   country silently?
5. **Monospace for printed names** uses the system mono stack (05 audit B.8 `--font-mono`). Keep, or Cairo semibold
   with letter-spacing?
6. **Saved travellers as chips** wrap one per line on 390px when names are long; acceptable, or a horizontal scroller?
7. Design decisions this version assumes (owner has not decided): **D3** cards at 18px and sheet at 22px; **D4**
   weights ≤ 700; **D6** no 13px (meta at 12px).
8. Turkish strings to be written at port time (tr not in the lab).
