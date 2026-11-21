---
version: v4-postcard
title: Postcard
status: draft
base: v1-baseline
created: 2026-11-05
tokens: override
touches-components: [email.layout.hbs, partials/button, partials/greeting, partials/link_fallback, partials/signature]
ported:
---

# Postcard

## Idea
A postcard lying on a teal desk: stamp with the destination, round postmark saying confirmed, the message on one side and the travellers on ruled address lines on the other. The warmest of the five.

## Key decisions
- Serif for the message so it reads like a note; sans for data.
- The postmark tilts where supported and sits straight elsewhere, so nothing depends on it.
- Arabic serif faces run small, so the message side is set at 18px.
- The card stays light in dark mode, as paper would; only the desk darkens.

## Across the other 49 templates
Strong for trip and loyalty mail. Weak for security and failure mail, where a stamp needs a different tone: the card would stay but stamp and postmark drop out.

## Open questions
Arabic serif varies most by device (Sakkal Majalla, Geeza Pro, Times). Test on a real phone first.
