# v1-baseline: components

**How this baseline was made.** The backend was not running on 2026-11-21, so the checkout steps could not be
rendered live (the reservation route needs an offer and a checkout from the API). The baseline is:
- `1440-rtl-light.png`: audit shot 08 (`F:/Goteav/research/web-uplift-2026-11/audit/shots/08-reservation-gate-top-ar-1440.png`),
  the reservation page at the sign-in gate: photo hero with the slogan, the vertical step rail, the itinerary
  summary and the gate cards.
- The code of `develop` in `F:/Goteav/wt-develop/web/src` for the passenger, contact and payment steps, listed below.
  No screenshot exists of steps 1 to 4 (audit section "not walked in the browser").

## Page frame

| Component | File | Shared? |
|---|---|---|
| Route | `src/app/[locale]/(main-page)/flights/reservation/[id]/page.tsx` | page only |
| FlightReservation (hero, layout, stepper, content, summary) | `src/features/flights/reservation/index.tsx` | page only |
| HeroBanner (320px photo hero) | `src/components/shared/hero-banner` | shared, 19 files |
| ReservationContent (gates, steps, continue checks) | `src/features/flights/reservation/reservation-content.tsx` | page only |
| StepNavigation (vertical rail at xl, icon row below) | `src/features/flights/reservation/step-navigation.tsx` | page only |
| WizardFooter (Back / Next) | `src/features/flights/reservation/wizard-footer.tsx` | page only |
| StepCard, Notice, FormError, FieldError, StepMotion | `src/features/flights/reservation/parts.tsx` | reservation only |
| PriceLockBar (sticky timer, review + payment) | `src/features/flights/reservation/price-lock-bar.tsx` | page only |
| ItinerarySummary (sticky end pane, lg+) | `src/features/flights/reservation/itinerary-summary.tsx` | page only |
| MobileTotalBar (fixed pill + drawer below lg) | `src/features/flights/reservation/mobile-total-bar.tsx` | page only |
| Price lines (fare, taxes, extras, fees, service fee, discount) | `src/features/flights/reservation/steps/review/price-lines.ts` | review + summary |
| ShownCurrencyProvider / money() / exact() | `src/features/flights/reservation/use-shown-money.tsx` | page only |
| Currency switch (`POST /flights/checkout/{id}/currency`) | `src/features/flights/reservation/use-checkout-currency.ts` | page only |
| Drawer | `src/components/ui/drawer` | shared, 5 files |
| Dialog | `src/components/ui/dialog` | shared, 11 files |

## Step 1: passengers and contact

| Component | File | Shared? |
|---|---|---|
| PassengerForm | `src/features/flights/reservation/steps/passenger-form.tsx` | page only |
| PassengerCard (names, birth date, gender, title, nationality, document block, lap infant, saved-traveller select, save tick) | `src/features/flights/reservation/steps/passenger/passenger-card.tsx` | page only |
| ContactCard (email, phone) | `src/features/flights/reservation/steps/passenger/contact-card.tsx` | page only |
| usePassengerForm, draft store | `steps/passenger/use-passenger-form.ts`, `draft-store.ts` | page only |
| Validation (Latin names, ages, passport) | `src/apiEndpoint/checkout/validations.ts`, `src/apiEndpoint/travellers/validations.ts` | shared with account travellers |
| DynamicInput | `src/components/shared/dynamic-input` | shared, 35 files |
| DynamicSelect | `src/components/shared/dynamic-select` | shared, 23 files |
| PhoneInput (+ country picker, WhatsApp hint) | `src/components/shared/phone-input.tsx` | shared, 10 files |
| DatePartsField | `src/features/account/travellers/date-parts-field` | shared with account travellers |
| GuestBanner, GuestCheckout | `src/features/flights/reservation/guest-checkout.tsx` | page only |

## Step 4: payment

| Component | File | Shared? |
|---|---|---|
| PaymentForm | `src/features/flights/reservation/steps/payment-form.tsx` | page only |
| usePayment (pay, split, redirect, errors) | `steps/payment/use-payment.ts`, `pay-errors.ts` | page only |
| Method list and labels (hosted redirect only, de-duplicated) | `steps/payment/methods.ts`, `method-list.tsx` | page only |
| Hold offer (pay later) | `steps/payment/hold-plan.ts`, `hold-offer.tsx` | page only |
| SplitPaymentDialog (wallet + gateway) | `steps/payment/split-payment-dialog.tsx` | page only |
| Company invoice (Turkish VKN / TCKN) | `steps/payment/company-invoice.tsx` | page only |
| Cancellation terms ("If you cancel") | `steps/payment/cancellation-terms-card.tsx` | page only |
| RefundChoicePicker (wallet / original method; status page only today) | `src/features/checkout/refund-choice-picker.tsx` | checkout status + account booking |

## Strings
`messages/{ar,en,tr}/domains/flights.json` → `checkout.*` (`nav`, `passengers`, `summary`, `payment`, `priceLock`,
`review`, `invoice`, `currencySwitch`, `gate`).

## Porting note
Everything the redesign needs lives in reservation-only files, except: DynamicInput, DynamicSelect, PhoneInput and
DatePartsField (shared). v2 draws its own field look; a port should either restyle those primitives site-wide
(GTV-472 batch 4) or wrap them, not fork them.
