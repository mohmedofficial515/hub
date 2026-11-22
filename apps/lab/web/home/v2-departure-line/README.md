---
version: v2-departure-line
title: Departure line
status: review
base: v1-baseline
created: 2026-11-21
tokens: override
touches-components: [features/home/index.tsx, features/home/hero.tsx, features/home/pill-search-bar.tsx, features/home/flight-search-form.tsx, features/home/airport-input.tsx, features/home/round-trip-date-fields.tsx, features/home/services-grid.tsx, features/home/features-section.tsx, features/home/why-choose-us.tsx, features/flights/history/recent-searches.tsx, components/shared/airport-picker/airport-picker.tsx, components/shared/price-calendar/fare-calendar.tsx, components/ui/counter.tsx]
ported:
---

# Departure line

## Idea
The first screen is one flat navy block (header and hero on the same surface) and one white search card that sits
over its lower edge. The block carries a single decoration that does a job: a 1px gold great-circle arc that
**listens to the form**. Empty, it is a quiet dashed line with "From" and "To" at its ends and a one-line hint.
Pick an origin and its IATA code is planted; pick the destination and the arc draws once (700 ms), a small plane
settles on the apex and one line under it reads back the dates, travellers and cabin. A multi-city trip draws one
arc per leg. The art confirms the traveller's input, needs no photograph (so no scrim, no gradient and no
hot-linked image), and is the same "line" the rest of the page speaks: hairline field groups, a ruled list of
recent searches, a ruled list of "soon" products and a three-stop line for how booking works.

Why it beats the baseline: search is the only primary action and is fully visible at every width (fields at 390 px
without a tap, L-10); the card grows with its content (L-09); focus moves to the next empty field (L-55); steppers
are 44 px and named, trip type is a real radio group (L-43, L-53); the copy describes what is sold (L-08); the eight
photo tiles with shimmer, ping halos and blur become one open product and an honest "soon" list (L-58, L-48).

## Key decisions
- **Colours exactly as the owner fixed them**, through roles only (`tokens.css` is the only file with hex):
  navy `--surface-brand` block and header, `--brand-ink` headings, `--brand` selection (trip type, cabin, calendar
  day), teal `--action` search button with white `--action-foreground` (accepted 2.57:1), gold `--highlight` only
  for the arc, the plane and the active-nav underline (6.76:1 on navy-800, 8.33:1 on navy-900). Dark mode: page
  `#0a0e21`, card `#0f172b`, block navy-900, navy becomes `#cdd9f1`.
- **No gradient anywhere.** No photograph on the page, so the one allowed scrim is not used either.
- **One shadow** (`--elev-float`) on the layers that really float: the search card over the block and the popovers.
  Everything else is border-only.
- **Radius roles** (05 audit B.1): 8 px controls, 14 px field groups, 18 px cards and popovers, 22 px for the support
  panel. No photo cards exist in this version, so D3 (22 px) applies to the support panel only.
- **Type**: Cairo in both locales, headings 700 at most (D4), no 13 px (D6; labels 12 px, body 14-18 px), Latin
  digits with tabular figures for codes, dates and prices; IATA codes `translate="no"`; amounts in `<bdi dir="ltr">`.
- **Search card**: trip type as a segmented radio group; From / swap / To / Departure / Return / Travellers in one
  bordered group with 1px dividers (gap-px technique, so the dividers are right in RTL and in every grid shape);
  value = large IATA code or day number with the city or month beside it (Singapore Airlines pattern). Phone: From
  and To stack with the swap button on their divider at the end side, dates side by side, travellers full width,
  full-width button. Popovers render in place (no portal) so they keep the scoped tokens, and cap their height at
  the space Radix reports.
- **Behaviour kept from the real form**: limits (9 travellers, infants <= adults, lowering adults lowers infants),
  child ages required, the return calendar opening after the departure pick, multi-city legs (2-5; the next leg
  starts where the previous lands), `criteriaFromForm` messages, and the results link format of `url-state.ts`
  (defaults left out). The lab prints the link it would open under the card (`lab: /ar/flights?...`).
- **Recent searches**: the real behaviour (5 at most, departed left out, account vs device source, search again,
  remove, price now vs last time with an icon and a word). Picking one fills the form so the arc redraws; the real
  row navigates to results directly. Shown as a hairline grid, not pills on glass.
- **Services**: flights as the one open product ("Open now" with a check, an outline "Search flights" link that
  focuses the form, so the page keeps one primary button); the seven others as a ruled list, each with a line icon
  and a neutral "Soon" badge (icon + word). Not clickable, no dimming, no animation.
- **How booking works**: three true steps on one line (vertical on phones), copy rewritten to what the checkout does
  (search and compare, travellers and pay by card or wallet, e-ticket by e-mail and Manage booking).
- **Support**: flat navy (D7). Phone and e-mail from the platform settings; without a phone only the e-mail shows.
  Manage booking sits beside it as an outline button (audit section 4: manage-booking entry on the home page).
- **Header** is context only (not in scope): the audit's cleaned navigation (Flights, Manage booking, Help; USD,
  language as text, theme, Sign in), flat on the block's navy.
- **Motion**: one entrance (hero text and arc fade up 8 px, 320 ms) and the arc draw; the date grid and popovers use
  a 150 ms fade. `MotionConfig reducedMotion="user"` plus a CSS guard: with reduced motion the arc is drawn at
  once (verified: `stroke-dasharray: 1px, 1px` 80 ms after the pick).
- **Scenarios** (`?scenario=`): `empty` (first visit: no recent searches, no support phone), `loading` (recent
  searches skeleton), `error` (flight search in maintenance: a notice with Manage booking replaces the form, and the
  arc is left out), `long` (account history with 5 entries including a 3-leg multi-city search).

## Verification
- Lab frame, own browser context with Vite's HMR socket muted (other sessions were saving into the lab):
  390 / 768 / 1440 x ar / en x light / dark, first visit (full page) and after picking a recent search (first
  viewport): 24 captures in `shots/`, no horizontal overflow, no element outside the viewport, no console errors
  (`review/verify-matrix.js`).
- Flow (`review/verify-flow.js`, ar, 1440): From "CAI" + Enter moves focus to To; "dub" + Enter moves focus to
  Departure; the calendar opens focused on today; PageDown to December; picking 16 Dec opens the return calendar
  with the hint; picking 23 Dec moves focus to Travellers; adding a child and searching shows "اختر عمر كل طفل." and
  focuses Travellers; choosing age 7 and searching produces
  `/ar/flights?trip=round&slices=CAI_DXB_2026-12-16,DXB_CAI_2026-12-23&children=7&cur=USD`.
- Scenarios (`review/verify-scenarios.js`) at 390 and 1440: `empty` hides recent searches and the phone link,
  `loading` shows the busy skeleton, `error` shows the maintenance notice and no form, `long` renders 5 rows and the
  multi-city pick draws three arcs. No overflow, no errors.
- Keyboard: tab order skip link, logo, Flights, Manage booking, Help, language, theme, Sign in, trip type, From,
  To, Departure, Return, Travellers, Search, recent searches. Focus rings are a 2 px navy outline (light) / navy-200
  (dark); a Tailwind v4 trap (`outline-none` + `focus-visible:outline-2` keeps `outline-style: none`) was found
  and fixed with `outline-solid`.
- Contrast (computed): white on navy-800 12.58:1, navy-200 on navy-800 8.86:1, gold on navy-800 6.76:1, muted
  `#64748b` on white 4.76:1, success `#047857` on white 5.48:1, warning `#b45309` on its tint 4.84:1, danger
  `#be123c` on white 6.29:1; dark: neutral-400 on ink-900 6.95:1, navy-950 on navy-200 (selected trip type) 12.83:1.
  White on teal 2.57:1 is the owner's accepted exception.
- `npx tsc --noEmit -p tsconfig.json` in `apps/lab`: exit 0.

## Open questions
- **D2 (hero edge)**: this version has a hard edge between the navy block and the white page (no fade), with the card
  bridging it. Keep the hard edge here even though D2 allows one soft fade on list-page heroes?
- **D3 (photo cards 22 px)**: the services list has no photographs (the current ones are hot-linked stock, L-48).
  Should licensed product photos come back as 22 px photo cards, or stay as icon rows until they exist?
- **Field group border**: the group outline is neutral-300 (1.48:1 on white). The fields are identified by their
  labels and values, so it passes in practice, but a stricter reading of WCAG 1.4.11 wants 3:1 (neutral-500).
  Keep the light line, or darken it?
- **Hero copy**: "احجز رحلة طيرانك بخطوات واضحة" / "Book your flight, one clear step at a time" replaces the old
  slogan. Approve, or provide the wording (Turkish to be written at port time)?
- **Arc on phones**: the arc takes about 150 px of the 390 px first screen, so the Search button sits just under
  the fold (all fields are above it). Keep the arc on phones, or show only the two codes there?
- **Recent search click**: here it fills the form (the arc redraws); today it opens the results directly. Which one?
- **Fare prices in the calendar**: the real calendar shows a price per day; the lab leaves them out rather than
  invent fares.
- **Header**: drawn with the audit's reduced navigation as context. It is not part of this card; a separate header
  version is needed before that part is ported.
- **Support phone**: the mock value is a placeholder for `supportPhone` from the platform settings.
