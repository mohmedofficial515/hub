---
version: v8-boarding-complete
title: Boarding stub, complete
status: ported
ported: backend 2765b959, web a88c0bf (feat/full-dashboard-integration)
base: v7-boarding-detail
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Boarding stub, complete

## Idea
v7 (approved 2026-11-05) plus the owner's answers: bags per traveller, paid extras, a calendar link, and fare rules
that the owner can switch off from the dashboard settings.

## Key decisions
- **Bags moved into each traveller's row**, one line when all legs match and one line per leg when they differ. This
  also removes the bag rows under every leg.
- **Paid extras** is its own section and disappears when nothing was bought. Seats stay in the traveller row.
- **Calendar link** sits on the leg heading: small and out of the way. It is a Google Calendar link, one per leg, built
  from UTC times, and is left out when an airport has no time zone.
- **Fare rules** follow `notifications.emailContent.showFareRules` (default on). Off: the rows go and the section
  heading becomes "Payment". The total always stays.
- The lab bar has a `fare rules` toggle to preview both.

## Needed on port
Everything listed in v7, plus: `passengerList[].bags`, `extras[]`, `slices[].calendarUrl` (backend builds it from
`departingAt`, `arrivingAt` and `PlaceRef.timeZone`), and `showFareRules` in the render context.

## Open questions
- Google Calendar only. A hosted `.ics` link would also serve Apple and Outlook; it needs a new endpoint.
