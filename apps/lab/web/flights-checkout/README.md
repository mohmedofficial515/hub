---
app: web
page: flights-checkout
route: /[locale]/flights/reservation/[id]   # ?checkout=<id>&step=passenger|extras|review|payment
live-url: # backend not running on 2026-11-21: the checkout cannot render live
sources:
  - src/app/[locale]/(main-page)/flights/reservation/[id]/page.tsx
  - src/features/flights/reservation/index.tsx
  - src/features/flights/reservation/reservation-content.tsx
  - src/features/flights/reservation/step-navigation.tsx
  - src/features/flights/reservation/itinerary-summary.tsx
  - src/features/flights/reservation/mobile-total-bar.tsx
  - src/features/flights/reservation/price-lock-bar.tsx
  - src/features/flights/reservation/steps/passenger-form.tsx
  - src/features/flights/reservation/steps/passenger/passenger-card.tsx
  - src/features/flights/reservation/steps/passenger/contact-card.tsx
  - src/features/flights/reservation/steps/payment-form.tsx
  - src/features/flights/reservation/steps/payment/*
  - src/features/flights/reservation/steps/review/price-lines.ts
  - src/features/checkout/refund-choice-picker.tsx
status: designing
---

# Flight checkout: passengers, contact and payment (GTV-521)

Hub card GTV-521, plan GTV-472 phase 3. Shared brief:
`F:/Goteav/research/web-uplift-2026-11/phase3-brief.md` (Hub doc GTV-553).

## Purpose
A traveller who picked a flight enters who is flying and how to reach them, then pays. Two things decide
whether the ticket is right and the sale closes: the names must match the passports, and the customer
must trust what they pay, in which currency and by which method.

## Scope of the versions
Step 1 (passengers + contact) and step 4 (payment), with the sticky price summary. Steps 2 (seats and
bags) and 3 (review and terms) appear in the stepper only. Site header and footer stay as they are.

## Problems with the current page (code read on develop + audit shot 08)
- A 320px photo hero with a generic slogan above the checkout (audit L-15); the better copy
  `checkout.heroTitle` "أكمل حجزك" is unused.
- Fees that change the choice (service fee not refunded, Goteav cancellation fee, kept FX margin) appear
  first at step 3 (L-38) and in dollars whatever the booking currency (L-63).
- The summary shows a single "Seats & bags" line and the total; the charge currency is explained only on
  the payment step, in one long sentence.
- Payment methods keep the backend order; nothing puts Apple Pay or the local scheme first by country
  (regional research R-06: Apple Pay is 44% of payments at the Saudi market leader).
- The Latin-only name guard says what is wrong, not where to copy the name from (assist audit row 3).
- Saved travellers are a plain select inside each card; the guest still sees "save traveller" (L-56).
- Gender and Title are both asked although Title is derived from gender (L-56).

## Goals
- Full fee transparency from step 1 to payment: fare, taxes, extras, fees, service fee, total, currency.
- One sentence that says what is paid, how, and in which currency, updated with the chosen method.
- Methods ordered by the visitor's country, Apple Pay first where offered.
- A passport-name helper that shows where the Latin name is printed and how it will appear on the ticket.
- A saved-travellers chooser that fills slots by age fit.
- Owner rules: current colours, flat surfaces with hairlines, one primary button per screen, no gradients,
  no card stripes, Cairo, weights up to 700, no 13px, 22px radius only for photo cards.

## Constraints
- RTL + LTR, light + dark (dark on ink-950 / ink-900, navy becomes #cdd9f1).
- Data from the real API: `CheckoutDto` (totals as decimal strings, `passengerSlots`, `requiredFields`,
  `priceLock`, hold fields, `display`), `PaymentMethodsDto` (hosted redirect methods, wallet),
  `TravellerDto`. Mocks in `v2-live-ticket/parts/data.ts` follow those shapes.
- Existing behaviour to keep: silent hold before charge, refund choice by the customer with wallet default,
  checkout currency switch (`POST /flights/checkout/{id}/currency`), price lock timer, hold (pay later),
  split wallet payment, company invoice.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page: audit shot 08 + code inventory | reference |
| v2-live-ticket | the summary is a ticket that writes itself as you type and choose | review (7.3) |
| v3-live-ticket | fix round of v2: modal sheet, required marks, mobile timer, fee lines in view, Cairo only | review |
