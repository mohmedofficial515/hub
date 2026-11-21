---
version: v2-boarding-stub
title: Ticket for a failed booking
status: ported
ported: backend 2765b959, web a88c0bf (feat/full-dashboard-integration)
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: []
ported:
---

# Ticket for a failed booking

## Idea
Trial of the approved ticket on bad news: same shape, muted route, a plain status, and the refund before anything else.

## Key decisions
- Layout and partials are imported from `email-booking-confirmed/v8-boarding-complete`, not copied. If this body works
  with them unchanged, the design transfers to the other templates.
- Copy is the real copy from `emails.json`; only `emails.design.*` strings are new.

## Open questions
- Does the ticket shape suit this kind of message? This trial exists to answer that.
