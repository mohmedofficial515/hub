---
app: web
page: home
route: /[locale]
live-url: http://localhost:6002/ar
sources:
  - src/app/[locale]/page.tsx
  - src/features/home/index.tsx
  - src/features/home/hero.tsx
  - src/features/home/pill-search-bar.tsx
  - src/features/home/flight-search-form.tsx
  - src/features/home/airport-input.tsx
  - src/features/home/round-trip-date-fields.tsx
  - src/features/home/services-grid.tsx
  - src/features/home/features-section.tsx
  - src/features/home/why-choose-us.tsx
  - src/features/flights/history/recent-searches.tsx
status: designing
---

# Home page with the flight search (GTV-519)

Plan GTV-472, phase 3. Shared brief: Hub doc GTV-553 (`phase3-brief.md`). Sources read: `F:/Goteav/research/web-uplift-2026-11/`
`design/references.md`, `05-design-system-audit.md`, `audit/03-journey-logic-audit.md` (+ `audit/shots/`), and
`01`, `02`, `04` for product ideas. Code read from `develop` (`F:/Goteav/wt-develop/web`).

## Purpose
A traveller (Arabic first, also English and Turkish) lands on `/[locale]` and must start a flight search at once,
on any screen size. Secondary jobs: search again from a recent search, see what Goteav sells (flights now, the rest
"soon"), understand how booking works, and reach support or Manage booking.

## Scope of this page (brief)
The first screen (hero + search card) and the sections that stay: services grid, how booking works, support
contact. Header and footer are drawn in the versions only as context.

## Data, states and actions the page must support (from the code)
- **Search form** (`flight-search-form.tsx`): trip type one way / round trip / multi-city (extra legs, add and
  remove); From / To (airport picker, `Airport { code, city, name, country, kind }`); departure date, return date
  (round trip, the return calendar follows the departure one); travellers (adults 1-9, children with an age each
  2-17, lap infants 0-1 with an age, at most 9, infants <= adults) and cabin (economy, premium economy, business,
  first); fare-calendar prices per day; `criteriaFromForm` checks (`origin`, `destination`, `sameAirport`, `dates`,
  `returnDate`, `childAges`, `dateOrder`, `travellers`, `infants`) with one message; Search opens
  `/{locale}/flights?trip=…&slices=…&adults=…&children=…&infants=…&infantAges=…&cabin=…&cur=…`.
- **Maintenance**: `MaintenanceAreaGate area="flights_search"` replaces the form while flight search is paused.
- **Recent searches** (`recent-searches.tsx`): up to 5, departed left out; account history when signed in (with
  "See all"), device history otherwise ("saved on this device only"); search again; remove; price now vs last time.
  Hidden while loading or empty.
- **Services**: eight products; "soon" follows the platform switches (`useProductSoon`); only flights is on sale.
- **How booking works**: three steps.
- **Support**: `supportPhone` from the platform settings (`useSiteContacts`); the block is left out without it.
- Sandbox banner (`DEPLOY_MODE=sandbox`), currency (`useCurrency`), locale ar / en / tr, light / dark.

## Problems with the current page
- Audit L-08: hero copy promises private jets and resorts; the site sells flights. (Develop already opens the
  form on Flights.)
- L-09: the form used to sit in a fixed-height glass box with an inner scroll bar (develop let it grow).
- L-10: on a phone the form was behind two pills (develop now shows it inline, still on dark glass).
- L-55: after choosing From, focus stays on From; the date popover covers the route just chosen.
- L-43 / L-53: traveller steppers are 32px and unnamed; trip-type buttons expose no selected state.
- L-48: hot-linked stock and template images (hero, services, steps, support block).
- L-58: half the services grid is dimmed "coming soon" tiles with animated shimmer, ping halos and blur.
- Visual debt (05 audit): gradient text, italic Arabic, dimmed photo over a gradient, wave divider, glass card,
  radial-gradient "why us" block, 900 weights, 13px text, seven radii.

## Goals
- Flight search is the first and only primary action on the screen, visible without a tap at 390 px.
- The site's current colours, flat: navy blocks, white work surface, teal search button with white text, gold only
  as a small touch. No gradients, glows, glass or stripes.
- True content only; non-flight products marked "soon".

## Constraints
- RTL + LTR, light + dark; Cairo for every locale; headings <= 700; no 13px; photo cards 22px.
- The backend was not running and the develop dev server answered 500 during this study (`Jest worker encountered
  2 child process exceptions`), so the baseline uses the audit captures of 2026-11-18 (see `v1-baseline/`).

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page (audit captures + component inventory) | reference |
| v2-departure-line | navy block with a gold route arc that draws the search; white card over its edge | review (7.7; fixes in v3) |
| v3-departure-line | fix round of v2: no shadows, maintenance state, one-line route on phones | review |

## Concepts considered (v2 chose the first)
1. **Departure line** (built as v2). One flat navy block holds header and hero; its only decoration is a 1px gold
   great-circle arc that listens to the form (references.md 8.2 idea 3). The white search card overlaps the block's
   lower edge with every field in one hairline group and the teal button at the end. Below: recent searches as a
   ruled list, services as one open product beside a ruled "soon" list, steps on the same line language, support
   on flat navy.
2. **Timetable strip** (direction A import). White page, headline on the start side and the search as a ruled
   timetable strip across the container (no card, rules above and below, vertical rules between fields). Calm and
   editorial, but it drops the navy block the owner kept for the header and loses the "card over the first block"
   rule of the brief.
3. **Boarding pass** (bold). The search card is drawn as a boarding pass with a perforated stub that fills in as you
   type (the approved e-mail "boarding stub" family), and the stub tears off into the results page. Distinctive and
   on-brand with the e-mails, but the stub doubles every value on the screen and the tear-off motion needs the
   results page redesign (GTV-520) to land first.

Why 1: it is the one that follows every binding rule as written (navy header, card over the first block, one
primary
button, no photo so no scrim needed), it fixes the audit items of the first screen, and its signature (the arc)
confirms the traveller's input instead of decorating, at zero image cost.
