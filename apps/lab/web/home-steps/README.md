---
app: web
page: home-steps
route: /[locale] (home page, the "how booking works" section only)
live-url:
sources:
  - src/features/home/features-section.tsx
  - src/components/shared/decorative-plane.tsx
  - messages/<locale>/domains/home.json → home.features
status: designing
---

# Home page: "How booking works" section (خطوات بسيطة / احجز رحلتك في لحظات)

Owner request 2026-11-22: redesign this one section of the home page so it stops looking like a generic AI
template, and show four different versions in the lab. Only the section is in scope; the rest of the home page
follows `../home/v3-departure-line` (approved).

## Purpose
After the search card, a first-time traveller should understand in a few seconds that booking on Goteav is short
and safe: search and compare, add travellers and pay (card or wallet), receive the e-ticket by e-mail and manage the
booking any time.

## Problems with the current section (`v1-baseline/1440-rtl-light.png`)
- Template look: three identical white cards with a floating teal number box and a floating clip-art icon, beside a
  big tilted stock photo with a hard offset shadow. Nothing about it says "airline ticket" or "Goteav".
- Hot-linked assets from a template site (`travlla.dexignzone.com` icons) and Unsplash photos (audit L-48).
- Gradient over the photo, heavy shadows, 900 weights, the step number repeated as a ghost "02" over the photo.
- The photo changes on hover only; on touch screens the right column never changes, and it gives no information.
- Copy promises "hundreds of unique destinations" and a "dream holiday"; the site sells flights (L-08).

## Goals
- A section with its own idea, tied to air travel and to Goteav's real booking flow.
- Site colours unchanged and flat: navy, white, teal for action, gold as a small touch. No gradients, no shadows,
  no coloured side or top stripes on cards (owner rules).
- True copy (from the approved v3 home): search and compare → travellers and pay → e-ticket and Manage booking.
- RTL + LTR, light + dark, Cairo, headings <= 700, no 13 px text, motion respects reduced motion.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current section (owner screenshot 2026-11-22) | reference |
| v2-boarding-pass | the three steps are the three parts of one boarding pass, torn along perforations | draft |
| v3-flight-path | one flight route drawn across the section; a plane travels it as you scroll, three stops | draft |
| v4-departures-board | an airport departures board: each step is a row whose cells flip in, status "on time" | draft |
| v5-live-preview | step tabs beside a small live screen that plays the real product: search, pay, e-ticket | draft |
| v6-cinematic-film | a silent 16 s cinematic film of the booking flow (made in hams), looping as a GIF per locale | draft |
