---
version: v7-boarding-detail
title: Boarding stub, detailed
status: approved
base: v2-boarding-stub
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Boarding stub, detailed

## Idea
Owner picked v2 as the direction (2026-11-05) and asked for a tidier phone view and more detail. The ticket head and
tear line stay. Below them the stub becomes clearly separate sections, so a long message still scans on a phone.

## Key decisions
- **Phone layout:** nothing stacks into one long right-aligned column any more. Facts are `label | value` rows at every
  width; codes share one strip; the itinerary is a vertical timeline, which needs no width.
- **Head:** a trip summary, not every leg: airport codes, cities, trip type, dates. Legs moved to the timeline.
- **Added from real order data:** terminals, duration per flight and overall, stops and layovers, operating carrier,
  aircraft, cabin and fare brand, baggage allowance, passenger type and seats, change and refund rules.
- **Fare rules** have three states: allowed free or with a fee, not allowed, and not stated by the airline. Silence is
  never shown as a promise.
- **Fallback link:** a short link label replaces the long raw URL (signed links wrap badly). The plain-text part keeps the URL.
- Every section is hidden when its data is missing (see the `sparse` scenario).

## Needed on port
- Payload additions: `tripType`, `originCity`, `slices[].segments[]` (terminals, carrier, operator, aircraft, duration, layover),
  `slices[].cabin/fareBrand/baggage/stopsCount/durationMinutes`, `passengerList[]` (name, type, seats), `fareRules`.
- Helpers `duration`, `concat`, and `year=true` on `day` (lab: `shared/email/render.ts`).

## Open questions
- Baggage is shown per leg from one passenger's allowance; infants may differ. Show per passenger, or add a "see booking" note?
- Should paid extras (bags, seats bought) and a calendar link be added?
