---
version: v3-flap-board
title: Split-flap board
status: draft
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Split-flap board

## Idea
An airport departures board. The airline code flips on split-flap tiles, the flight is a board row with its status in amber. The whole message is dark in every mode, which also means no client can invert it badly.

## Key decisions
- Monospace only where a real board uses it: tiles, times, codes.
- The hinge on each tile is a gradient; without gradients the tiles stay flat and readable.
- The flight column is hidden on phones to keep time, destination and status large.
- Amber button on navy-black is the only warm surface.

## Across the other 49 templates
OTP codes become flap tiles, which suits them very well. Status words change per template: confirmed, delayed, cancelled.

## Open questions
Is an always-dark message acceptable for finance and security mail?
