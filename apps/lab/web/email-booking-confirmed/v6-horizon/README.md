---
version: v6-horizon
title: Horizon
status: draft
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Horizon

## Idea
The feeling of the trip first: full-bleed sky at sunset with the city set very large and the button already in view, then a calm white sheet with the facts. The most emotional of the five.

## Key decisions
- The photo is the site's aviation hero with the plane painted out, because its livery shows a made-up airline next to the real one.
- The image is mirrored per direction so the sun sits away from the text.
- Solid navy behind the text means it stays readable with images off or in Outlook.
- Peach button appears only here, taken from the sunset.

## Across the other 49 templates
Trip and loyalty mail keep the hero; security and failure mail use the solid navy without a photo. One shared image needs hosting; per-destination photos would be a later step.

## Open questions
Would you later want a photo per destination? That needs an image library. Very long city names reach the sunny side of the image; worth testing.
