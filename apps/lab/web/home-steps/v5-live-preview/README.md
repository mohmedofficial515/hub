---
version: v5-live-preview
title: Live preview
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/home/features-section.tsx, components/shared/decorative-plane.tsx]
ported:
---

# Live preview

## Idea
Step tabs beside a small screen that plays the real product for the chosen step: the search card and three results
(the cheapest marked), the passenger name being typed and the wallet chosen before Pay, then the e-ticket with an
"in your inbox" notice. It replaces the stock photo with something that shows what booking on Goteav looks like.
Steps advance on their own every 6.5 s; a ring around the number shows the time left.

## Key decisions
- Screens are drawn from the site tokens (no screenshots, no photos); a line under the screen says the values are an
  example and not real.
- Accessible tabs: `role=tablist` (vertical), arrow keys, Home/End, roving tab index. Hover or focus inside the
  section stops auto-advance; a Pause button is offered; with reduced motion nothing advances by itself.
- One bordered card for the chosen tab only, no stripes; the chosen step opens its line with a height transition.
- Phones: tabs above, screen below.

## Open questions
- Should the screens follow the final checkout design (GTV-561 "Live ticket") once it is approved?
