---
version: v3-live-ticket
title: Live ticket (fix round 1)
status: approved # draft | review | approved | rejected | ported
base: v2-live-ticket
created: 2026-11-21
tokens: override # tokens.css: develop's primitives + semantic roles, scoped to this version
touches-components: [features/flights/reservation/index.tsx, features/flights/reservation/itinerary-summary.tsx, features/flights/reservation/mobile-total-bar.tsx, features/flights/reservation/step-navigation.tsx, features/flights/reservation/price-lock-bar.tsx, features/flights/reservation/steps/passenger-form.tsx, features/flights/reservation/steps/passenger/passenger-card.tsx, features/flights/reservation/steps/passenger/contact-card.tsx, features/flights/reservation/steps/payment-form.tsx, features/flights/reservation/steps/payment/methods.ts, features/flights/reservation/steps/payment/method-list.tsx, features/flights/reservation/steps/payment/hold-offer.tsx, features/flights/reservation/steps/payment/company-invoice.tsx] # all reservation-only; shared DynamicInput / DynamicSelect / PhoneInput / DatePartsField / HeroBanner are NOT changed (the page simply stops using HeroBanner)
ported:
decided-at: 2026-11-21T19:17:28.496Z
decided-by: Owner
decision-note: "موافقة المالك 2026-11-21. عدّاد حجز السعر في المراجعة والدفع فقط كما اليوم، واختيار جهة الاسترداد يُعرض قبل الدفع."
---

# Live ticket (fix round 1)

Same concept as v2-live-ticket; this version applies every finding of the v2 ux-critic review.

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
- **Owner rules applied (v3):** names, airport codes and name fields use Cairo 700 + wide tracking (no monospace); sheet radius 18px; otherwise as v2: white page, navy headings/selection, teal primary with white text (exactly one per
  screen, verified in all 24 captures), gold only on the navy strip (route arc, plane, low-timer), flat cards with
  1px hairlines, 2px only for selection, no gradients, glows or blur (the sheet backdrop is the flat scrim colour
  at 60%), no stripes (meaning = icon + word), Cairo, weights ≤ 700, no 13px (12px only for meta), card radius 18px,
  sheet 22px; no photo cards on this page. Dashed lines only for the ticket tear lines.
- **Motion:** step change slides 24px from the inline end (direction-aware), price amounts roll on change, the
  printed name cross-fades, guide and invoice open with height; 150–280ms, one easing; `MotionConfig
  reducedMotion="user"` and a CSS guard in `tokens.css`; spinners are `motion-safe:` only.

## Fixes after review (ux-critic, v2-live-ticket/review/review.md)

| # | Finding | Fix in v3 |
|---|---|---|
| B1 | Price sheet is `aria-modal` but not modal | `parts/mobile-bar.tsx` `Sheet`: Tab / Shift+Tab wrap inside the panel, Escape closes, page `main` and the bottom bar get `inert`, `<html>` scroll is locked, focus returns to the opener. The effect is bound to `open` only (in v2 it re-ran every second because of the timer and could pull focus). Verified: 7 Tab / Shift+Tab presses stay inside, `main.inert` and bar `inert` true, overflow hidden, focus back on the "Price details" opener. |
| B2 | "Continue" with gaps gives no field feedback | After a failed Continue every empty required field is marked: red border (`--danger`), `aria-invalid`, `aria-required`, the message "مطلوب / Required" linked by `aria-describedby`. Date groups mark only the empty parts; gender marks the group. Focus moves to the first invalid control, scrolled to the centre. Verified at 1440 ar (24 controls marked, focus on passenger 2 given name, described by "مطلوب") and 390 en dark guest. Contact e-mail and phone take part. |
| B3 | Hold timer invisible on phones | The bottom bar has a timer row on both steps: clock + "السعر محجوز 14:32", amber (`--warning-ink`) under 2 min, "انتهت مدة حجز السعر" at 0. The desktop rail shows it in the ticket head and in the pinned foot on both steps. |
| M1 | Fee lines hidden by the rail's inner scroll at 1440×900 | Ticket head compacted (one line per leg with the flight number; carrier, durations and cabin once; 24px codes). In the rail the total moved into the pinned foot next to the button; the body keeps fare, taxes, extras, booking fee and service fee. A sticky "More below / المزيد في الأسفل" line shows when anything (cancel quote, charge rows) is below. Measured at 1440×900, ar/en, both steps: every fee line visible, total + button in the foot. |
| M2 | Monospace face | All `font-mono` removed: printed names, IATA codes, name and passport inputs, saved-traveller chips, the passport drawing and MRZ use Cairo 700 with `tracking-wide`. Script check: 0 elements with a monospace family in all 24 captures. |
| m | Phone code clipped ("SA +96…") | The select shows the code only (`+966`), 108px wide; the country name stays in each option's text. |
| m | "14 حقول" | `Intl.PluralRules('ar')`: 1 حقل واحد, 2 حقلان, 3–10 N حقول, 11–99 N حقلًا, 100+ N حقل (button helper and card header). Seen: "أكمل 14 حقلًا للمتابعة". |
| m | 36px currency select | 44px (`h-11`) everywhere, also in the sheet. |
| m | Sheet radius 24px | `rounded-t-2xl` = 18px (owner D3: 22px only for photo cards). Measured 18px. |
| m | Tear-line notches look stray | Notches are page-colour fills with no outline. |
| m | RTL CLS 0.011–0.022 | The page stays `invisible` until Cairo's Arabic 400/700 faces are loaded (max 1.5 s), so no font-swap reflow is seen. Measured CLS 0 in Arabic at 1440. At port, next/font with its fallback metrics replaces this gate. |
| m | Gender / save checkbox focus | The native inputs are `outline-none`; the visible 2px navy ring is on the segment label (`has-[:focus-visible]`) and the checkbox box (`peer-focus-visible`). |
| — | Not changed | `autocomplete` on passenger names stays off (passport names differ from account names); recorded only. |

## Verification (2026-11-21)
- 24 full-page captures in `review/` (`{390|768|1440}-{rtl|ltr}-{light|dark}-{passengers|payment}.png`), classic scrollbar hidden
  while capturing. Script check on all 24: no horizontal overflow, no element outside the viewport, exactly one teal primary and it
  is in the first viewport, 0 monospace elements, phone-code select 108px, bar timer present below lg. No page errors.
- States in `review/`: `state-390-rtl-light-sheet.png`, `state-1440-rtl-light-continue-missing.png`,
  `state-390-ltr-dark-continue-missing.png`, `state-390-rtl-light-bar-timer-low.png`, `state-390-rtl-light-bar-timer-ended.png`,
  `state-1440-rtl-light-rail.png`, `state-1440-ltr-light-rail.png`, `state-390-rtl-light-latin-guard.png`,
  `state-1440-ltr-dark-usd-split.png`, `state-1440-rtl-dark-guest-payment.png`, `state-768-ltr-light-no-methods.png`,
  `state-1440-ltr-dark-loading.png`, `state-390-rtl-dark-error.png`.
- `pnpm --filter @hub/lab typecheck` passes; scoped `tsc` over this folder passes; `pnpm lab:check`: "Lab: 51 versions compile."

## Open questions
- Owner decisions now applied: D3 (22px for photo cards only; cards and the sheet 18px), D4 (weights ≤ 700), D6 (no 13px).
- Still open from v2: the refund wording before payment, Title behind "Change", a visible country select for payment methods,
  saved-traveller chips wrapping on 390px.
- The timer now shows on the passengers step too (on develop the lock bar is on review + payment only). Keep it?
