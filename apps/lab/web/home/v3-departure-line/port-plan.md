# Port plan: web/home v3-departure-line (GTV-566)

Target: `F:/Goteav/wt-uplift/web`, branch `feat/gtv-472-redesign-ports` (from develop). The header is out of scope
(GTV-569 / GTV-548); a parallel agent owns `src/features/flights/reservation/**` and `src/features/checkout/**`.

## Impact map

| Real file | Used by | Change | Classification |
|---|---|---|---|
| `src/features/home/index.tsx` | `app/[locale]/page.tsx` only | rewritten: navy block + card + sections | home only |
| `src/features/home/hero.tsx`, `pill-search-bar.tsx`, `flight-search-form.tsx`, `airport-input.tsx`, `round-trip-date-fields.tsx` | home only (chain from `index.tsx`) | replaced by `src/features/home/departure/**`; old files deleted | home only |
| `hotel-search-form.tsx`, `car-search-form.tsx`, `train-search-form.tsx`, `destination-dropdown.tsx` | only `pill-search-bar.tsx` | left in place, unused (hotels search returns with its own redesign) | none |
| `src/features/home/services-grid.tsx`, `why-choose-us.tsx` | home **and** `features/about-us/index.tsx` | NOT changed; home gets new `departure/services.tsx`, `departure/support.tsx` | about-us unaffected |
| `src/features/home/features-section.tsx` | home **and** `features/packages/package-details.tsx` | NOT changed; home gets `departure/steps.tsx` | packages unaffected |
| `src/features/flights/history/recent-searches.tsx` | only `pill-search-bar.tsx` | NOT changed (kept with its tests); home gets `departure/recent-trips.tsx` reusing `useRecentHistory`, `useSeenOnScreen`, `CurrentPrice`, `historyHref` data | none |
| `src/components/shared/search-picker/search-picker.tsx` + `airport-picker/airport-picker.tsx` | hotels search bar, flights modify bar (`route-fields.tsx`), destinations, home | additive optional props `contentClassName`, `onCloseAutoFocus` (no change when omitted) | needs visual check: none (defaults unchanged) |
| `src/components/shared/price-calendar/*`, `components/ui/counter.tsx`, `ui/popover.tsx` | many | NOT changed (popover gets `shadow-none` per call site) | none |
| `src/app/globals.css` | all | additive roles `--on-brand`, `--on-brand-muted`, `--line-on-brand` (+ Tailwind mapping) | none (new names only) |
| `messages/{ar,en,tr}/domains/home.json` | home | additive namespace `home.departure` | none |
| `e2e/fare-calendar.spec.ts`, `e2e/search-history.spec.ts` | real-backend e2e of the home form | selectors follow the new form (no Flights tab; recent row fills the form) | tests only |

## Data and behaviour kept

- Form state is the flights `ModifyFormState`; submit through `criteriaFromForm` + `flightsHref` (same URL format), the
  `flightModify.incomplete.*` messages, `travellerLimits` / `withAdults`, `ChildAgesField` / `InfantAgesField`.
- Airports: real `AirportPicker` (`GET /flights/places`); dates: real `DepartureCalendar` / `ReturnCalendar` /
  `FareCalendar` with prices; the return calendar opens after the departure pick.
- Recent searches: `useRecentHistory` (account vs device), remove, price now (`CurrentPrice`) and last time; a row
  fills the form (owner decision) through `formFromCriteria(criteriaOfEntry(entry))`.
- Maintenance: `useMaintenanceArea('flights_search')`: hero copy changes, arc and recent searches hidden, the card is
  the real `MaintenanceAreaGate` notice (variant `card`) plus a Manage booking link; flights tile says paused.
- Products: `useProductSoon`; flights open unless its switch is off, others `SoonBadge`.
- Support phone/e-mail: `useSiteContacts()` (GET /settings/public), never the mock.

## Risks

- e2e specs on the home form need the backend (skipped without it); updated selectors are not run here.
- The fixed transparent site header sits over the navy block; top padding is tuned to it, the header itself is
  unchanged.
