---
version: v2-boarding-stub
title: Ticket with a code
status: ported
ported: backend 2765b959, web a88c0bf (feat/full-dashboard-integration)
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: []
ported:
---

# Ticket with a code

## Idea
Trial of the approved ticket on a message with no trip: the code takes the place of the route in the head.

## Key decisions
- Layout and partials are imported from `email-booking-confirmed/v8-boarding-complete`, not copied. If this body works
  with them unchanged, the design transfers to the other templates.
- Copy is the real copy from `emails.json`; only `emails.design.*` strings are new.

## Open questions
- Does the ticket shape suit this kind of message? This trial exists to answer that.
