---
version: v3-departure-line
title: Departure line (fix round 1)
status: approved
base: v2-departure-line
created: 2026-11-21
tokens: override
touches-components: [features/home/index.tsx, features/home/hero.tsx, features/home/pill-search-bar.tsx, features/home/flight-search-form.tsx, features/home/airport-input.tsx, features/home/round-trip-date-fields.tsx, features/home/services-grid.tsx, features/home/features-section.tsx, features/home/why-choose-us.tsx, features/flights/history/recent-searches.tsx, components/shared/airport-picker/airport-picker.tsx, components/shared/price-calendar/fare-calendar.tsx, components/ui/counter.tsx]
ported:
decided-at: 2026-11-21T19:17:27.268Z
decided-by: Owner
decision-note: "موافقة المالك 2026-11-21. الأسئلة المفتوحة بالخيار الموصى به: لون حدود الحقول يبقى، النقر على بحث سابق يملأ النموذج."
---

# Departure line (fix round 1)

v2-departure-line went to `review`, so per the lab rule it stays frozen and the ux-critic fixes
(`../v2-departure-line/review/review.md`) land here. Owner decisions now final: D2 list-hero fade kept, D3 photo
cards 22 px, D4 weights <= 700, D6 no 13 px, D7 flat navy, D8 slider may be edited.

## Changes from v2
| Review finding | Fix in v3 |
|---|---|
| Blocker 1: shadow on the search card and popovers | `--elev-float` removed from `tokens.css`; `shadow-*` removed from `parts/search-card.tsx` (form and maintenance notice) and `parts/field.tsx` (popovers). The card keeps its 1 px `--line` border; popovers use a 1 px `--border-strong` border so they separate from the white card without a shadow. Measured: 0 elements with a box-shadow in all 12 modes. |
| Blocker 2: live "search again" rows in maintenance | `page.tsx` does not render recent searches while flight search is paused. The hero title and lead change to "البحث عن الرحلات يعود قريبًا" / "Flight search will be back shortly" + "your bookings are safe…", and the flights tile in Services reads "Paused for maintenance" with no search link. |
| Major: Search under the fold at 390 | Phones (`<sm`) show `RouteLine` (new in `parts/route-arc.tsx`): one line `CAI ——✈—— DXB` with the read-back under it, same empty / chosen / multi-city states as the arc. Hero padding and card overlap trimmed on phones. Search button bottom: 816 px (ar) / 805 px (en) on a 844 px screen (v2: 890 / 879). |
| Minor: trip-type segments 40 px | `min-h-11`: measured 44 px at every width. |
| Minor: LTR arrows in RTL rows | Each IATA code in a recent row is its own `<bdi>`; the joiner is `←` in Arabic and `→` in English, so "IST ← AMM" reads with "إسطنبول إلى عمّان". Round trips keep `⇄`. |
| Minor: step 3 icon | Step 3 shows "3" like steps 1 and 2. |
| Minor: empty space in the flights tile at 1440 | The services grid is `items-start` and the button follows the text (no `mt-auto`), so the tile sizes to its content. |

Everything else is as in v2 (below).

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
- **No shadow anywhere** (owner rule, v2 review blocker 1): the card over the block and the popovers are separated by
  1 px borders only.
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
  searches skeleton), `error` (flight search in maintenance: a notice with Manage booking replaces the form; the arc
  and recent searches are left out; the hero and the flights tile say the search is paused), `long` (account history with 5 entries including a 3-leg multi-city search).

## Verification (v3)
- `review/verify-matrix.js` (lab frame, own context, HMR socket muted): 390 / 768 / 1440 x ar / en x light / dark,
  full page plus the first viewport after picking a recent search (24 captures in `shots/`). Every mode: no
  horizontal overflow, no element outside the viewport, no console errors, 0 elements with a box-shadow,
  trip-type segments 44 px; Search button bottom 816 (ar) / 805 (en) px on 390x844, 826 / 860 on 768x1024,
  587 on 1440x900.
- `review/verify-scenarios.js`: `empty` (no recent, no phone link), `loading` (busy skeleton), `error` (no form, no
  recent searches, h1 "البحث عن الرحلات يعود قريبًا"), `long` (5 rows, three-leg arc) at 390 and 1440; tab order
  skip link → header → trip type → From → To → Departure → Return → Travellers → Search → recent rows; focus ring
  `solid 2px`; reduced motion draws the arc at once (`stroke-dasharray: 1px, 1px`).
- `review/verify-flow.js` (keyboard flow and results link) is carried over from v2; the form code it covers did not
  change except the trip-type height.
- `npx tsc --noEmit -p tsconfig.json` and `pnpm typecheck` in `apps/lab`: both exit 0.

## Open questions
- **Product photos** (D3 decided: photo cards 22 px): the services list has no photographs because the current ones
  are hot-linked stock (L-48). When licensed photos exist, should the eight products become 22 px photo cards?
- **Field group border**: the group outline is neutral-300 (1.48:1 on white). The fields are identified by their
  labels and values, so it passes in practice, but a stricter reading of WCAG 1.4.11 wants 3:1 (neutral-500).
  Keep the light line, or darken it?
- **Hero copy**: "احجز رحلة طيرانك بخطوات واضحة" / "Book your flight, one clear step at a time" replaces the old
  slogan. Approve, or provide the wording (Turkish to be written at port time)?
- **Recent search click**: here it fills the form (the arc redraws); today it opens the results directly. Which one?
- **Fare prices in the calendar**: the real calendar shows a price per day; the lab leaves them out rather than
  invent fares.
- **Header**: drawn with the audit's reduced navigation as context. It is not part of this card; a separate header
  version is needed before that part is ported.
- **Support phone**: the mock value is a placeholder for `supportPhone` from the platform settings.
