---
version: v4-departures-board
title: Departures board
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/home/features-section.tsx, components/shared/decorative-plane.tsx]
ported:
---

# Departures board

## Idea
The steps are read off an airport departures board. Each row: a flight code (GTV 01/02/03) on split-flap tiles that
spin and settle, the step and its line, what you need, and a status: "Start here" (gold, blinking dot), "Next",
"Boarding" (teal). The board header shows "Departures" and the visitor's local time with a blinking colon. A familiar
airport object, so the section reads as travel at a glance and stays fully informative.

## Key decisions
- The board is dark in both themes (navy-950 light, ink-900 dark) with its own tokens in `tokens.css`; the page
  around it keeps the site colours. Contrast on the board: white text, navy-300 muted 10.6:1, gold 9.9:1, teal 9:1.
- Latin flight codes use per-letter flaps; Arabic words flip as whole cells, because Arabic letters join and must
  not be split into tiles.
- Desktop: four-column board with column heads; phones: each row stacks, status on the code line.
- Motion runs once when the board is a third in view; reduced motion shows it settled.

## Open questions
- The status words ("Start here / Next / Boarding") are playful; keep them or use plain "1 / 2 / 3"?
