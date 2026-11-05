---
version: v2-boarding-stub
title: Boarding stub
status: draft
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Boarding stub

## Idea
The e-mail is a ticket: a navy head carrying the route in large airport codes, a tear line with two notches, then a white stub with the airline code and the details. The tear line is the one memorable element.

## Key decisions
- The row order follows reading direction, so Arabic reads from origin on the right to destination on the left.
- It is not presented as a boarding pass: no barcode, and the note about the e-ticket stays prominent.
- Outlook squares the notches; the dashed line remains.

## Across the other 49 templates
Head + tear line become the layout. Non-trip mail (OTP, password) puts the code or the title in the head, and the tear line separates it from the explanation.

## Open questions
Does the ticket shape feel wrong on mail with no flight, such as password reset?
