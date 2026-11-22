# v1-baseline: home page as it is

Route `/[locale]` (`src/app/[locale]/page.tsx` → `src/features/home/index.tsx`). Code read from `develop`
(`F:/Goteav/wt-develop/web`, 2026-11-21).

## Screenshots and why they are not fresh
The develop dev server at http://localhost:6002 answered HTTP 500 for `/ar` and `/en` during this study
(`Jest worker encountered 2 child process exceptions, exceeding retry limit`), and the backend is not running. It
was not restarted, because it belongs to another session. The captures here are the audit's, taken 2026-11-18
(`F:/Goteav/research/web-uplift-2026-11/audit/shots/`):

| File | Audit shot | What it shows |
|---|---|---|
| `1440-rtl-light.png` | 01 | First screen, desktop, Arabic |
| `390-rtl-light.png` | 15 | First screen, phone, Arabic |
| `audit-1440-rtl-airport-picker.png` | 02 | The airport picker (popular airports CAI, HBE, HMB, KWI, DXB, JED) |
| `audit-1440-rtl-calendar.png` | 03 | The departure calendar over the route fields |
| `audit-390-rtl-flight-drawer.png` | 16 | The phone drawer that held the form then |

Since those captures, develop changed: the form opens on Flights (L-08), the card grows with its content (L-09),
the form is inline on phones (L-10), and the offers, destinations, hotels, counters, gallery and testimonials
sections were removed (L-04). No dark or English captures exist.

## Sections and their components
| Section | File | Shared pieces it uses |
|---|---|---|
| Page | `src/features/home/index.tsx` | — |
| Hero (photo slideshow, gradient headline, destinations carousel, wave) | `src/features/home/hero.tsx` | `components/shared/custom-image.tsx`, `components/ui/carousel.tsx`, `lib/paths.ts` (`withBasePath`), `hooks/use-hydrated.ts`, `i18n/routing` (`Link`) |
| Search card (glass, product pills) | `src/features/home/pill-search-bar.tsx` | `features/flights/history/recent-searches.tsx`, `features/maintenance/maintenance-area-gate.tsx` |
| Flight form | `src/features/home/flight-search-form.tsx` | `components/ui/popover.tsx`, `components/ui/counter.tsx`, `components/shared/price-calendar/fare-calendar.tsx` + `fare-api.ts`, `apiEndpoint/flights` (`travellerLimits`, `withAdults`), `features/flights/modify-bar/form.ts` (`criteriaFromForm`), `features/flights/search/child-ages-field.tsx`, `infant-ages-field.tsx`, `url-state.ts` (`flightsHref`), `providers/currency-context`, `hooks/use-media-query` |
| Airport field | `src/features/home/airport-input.tsx` | `components/shared/airport-picker/airport-picker.tsx`, `airport-api.ts` |
| Round-trip dates | `src/features/home/round-trip-date-fields.tsx` | `components/ui/popover.tsx`, fare calendar |
| Other product forms (hotels, cars, trains) | `hotel-search-form.tsx`, `car-search-form.tsx`, `train-search-form.tsx`, `destination-dropdown.tsx` | — (hotels tab still listed; cars and trains commented out) |
| Recent searches | `src/features/flights/history/recent-searches.tsx`, `entry-view.tsx`, `history-href.ts`, `use-search-history.ts` | `apiEndpoint/search-history` (`FlightSearchHistoryEntryDto`) |
| Services grid (8 photo tiles, 4+ "soon" with shimmer, ping, blur) | `src/features/home/services-grid.tsx` | `components/shared/decorative-plane.tsx`, `providers/site-settings-context` (`useProductSoon`), framer-motion |
| How booking works (3 steps + photo) | `src/features/home/features-section.tsx` | `components/shared/decorative-plane.tsx`, `next/image`, template icons hot-linked |
| Why us + call us (radial gradient block) | `src/features/home/why-choose-us.tsx` | `lib/contact-links.ts` (`telHref`), `providers/site-settings-context` (`useSiteContacts`), template images hot-linked |
| Header / footer (context, out of scope) | `src/components/layout/home-header.tsx`, `header-top-bar.tsx`, `main-footer.tsx`, `mobile-bottom-nav.tsx`, `sandbox-banner.tsx` | — |

Messages: `messages/{ar,en,tr}/domains/home.json` (`home.hero`, `home.services`, `home.features`,
`home.whyChooseUs`), `domains/flights.json` (`flightSearchForm`, `flightModify.incomplete`, `searchHistory`).
