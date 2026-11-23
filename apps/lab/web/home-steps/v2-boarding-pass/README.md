---
version: v2-boarding-pass
title: Boarding pass
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/home/features-section.tsx, components/shared/decorative-plane.tsx]
ported:
---

# Boarding pass

## Idea
The three steps are the three parts of one boarding pass, separated by perforations with punched notches. Each part
has an icon, "Stop 01/02/03", the step, its line, and a "You need" field (route and dates / passport and card or
wallet / e-mail); the last part carries the barcode. When the pass scrolls into view a round check-in stamp lands on
each part in turn. It ties the section to the ticket the traveller ends up holding, and to the boarding-stub family
already approved for the e-mails, instead of three generic cards beside a stock photo.

## Key decisions
- Flat: 1 px `--border-strong` outline, dashed perforations, notches drawn as page-coloured circles clipped to the
  inside so the outline bends around them. No shadow, no gradient, no coloured stripe; colour only in the icon tile
  and the teal-700 stamp.
- Desktop: three parts side by side; phones: parts stacked with horizontal perforations and side notches.
- Copy from the approved home v3 (true steps); "You need" is new and tells the traveller what to have ready.
- Motion: stamp spring once per part (0.45 s apart), off with reduced motion.

## Open questions
- Keep the wordmark row on the pass, or drop it to make the pass shorter?
