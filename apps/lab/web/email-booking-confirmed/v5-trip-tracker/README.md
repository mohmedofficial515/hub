---
version: v5-trip-tracker
title: Trip tracker
status: draft
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Trip tracker

## Idea
An open white page with a large sentence and a four-stop track: paid, confirmed, e-ticket, fly. The e-mail tells you where you are and what comes next, then gives the facts. The most useful and the most systematic of the five.

## Key decisions
- No card at all: type and space do the structure, so it reads calmly on any client.
- The headline names the destination using `outboundCity`, correct on round trips.
- Done stops are teal, the current stop is navy with a heavier label, future stops are outlined.
- The logo swaps in dark mode.

## Across the other 49 templates
Every trip mail lights a different stop: hold, confirmed, ticket issued, reminder. Non-trip mail drops the track and keeps the type and the next-step box.

## Open questions
Is 'paid' always true when this is sent, including agent bookings paid by link or wallet? If not, the first stop needs a condition.
