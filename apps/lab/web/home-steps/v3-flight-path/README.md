---
version: v3-flight-path
title: Flight path
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/home/features-section.tsx, components/shared/decorative-plane.tsx]
ported:
---

# Flight path

## Idea
A flat navy block with one flight route drawn across it. As the visitor scrolls, the gold route draws itself and a
small plane flies along it; each step is a stop on the route and turns gold when the plane passes it, with its title
brightening under it. A "Departure: Search → Arrival: Ticket" read-out sits beside the heading. On phones the same
idea runs vertically: a dashed rail at the inline start, the flown part in gold and the plane moving down.

## Key decisions
- Uses the line language of the approved home hero (gold arc on navy), so the page tells one story.
- SVG route in a 1200 x 240 box; stop centres line up with three equal text columns. The drawing mirrors in RTL so
  the plane flies from the inline start; numbers are counter-mirrored.
- Scroll-linked (`useScroll` + spring). Reduced motion shows the finished route at once.
- The lab page adds dashed spacers above and below only so there is room to scroll; they are not part of the design.

## Open questions
- Navy block here and in the hero: is a second navy block on the home page too much? (Alternative: white section with
  a navy route.)
