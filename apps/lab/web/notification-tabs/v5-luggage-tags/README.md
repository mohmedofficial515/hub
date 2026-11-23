---
version: v5-luggage-tags
title: Luggage tags
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/account/notifications/notifications-page.tsx]
ported:
---

# Luggage tags

## Idea
The three views hang as luggage tags from a thin riveted rail. Each tag has chamfered top corners, a punched eyelet
with a gold ring, a short strap up to the rail, the view's icon and name, and below a perforation the count printed
like a bag-tag code (`ALL 09`, `NEW 05`, `TRP 03`). The chosen tag hangs lower on its strap, straight and navy; the
others hang short and slightly tilted. Under the tags a dashed belt line runs between two rollers, and the panel
behaves like a baggage belt: rows roll in from the inline start one after another and leave toward the inline end.

## Motion
- Opening: the rail draws itself from the inline start (0.5 s), a clip pops onto the rail above each tag, then the
  tags drop one after another (0.16 s apart) and swing to rest around the eyelet (under-damped spring on rotation,
  stiffness 110, damping 6). The strap is computed from the tag's own `y`, so it always ends at the eyelet.
- Switching: the chosen tag lets down 28 px further on its strap and straightens; the old one swings back up and
  tilts again. The belt line runs one step toward the inline end; the old panel slides off toward the inline end
  (0.2 s) and the new rows roll in from the inline start with a 70 ms stagger.
- Hover sways a tag a little; when a count changes (an entry read, "mark all as read") that tag jiggles and the
  number drops in.
- In the unread view a read row leaves on the belt and the rows behind it close up; the last one brings the empty
  state.
- Reduced motion: `MotionConfig reducedMotion="user"` makes every move instant (tags at rest, panel just swaps).

## Key decisions
- Tabs keep the WAI-ARIA pattern of the real page: `tablist/tab/tabpanel`, roving tab index, arrows follow the page
  direction, Home/End. The tag itself is the button (100 × 120 px on phones, 128 × 154 px from 640 px).
- Bag-tag codes are Latin in both locales, like a real tag; they are `aria-hidden` and screen readers hear
  "9 notifications / 5 unread / 3 trips" instead.
- Every tag shows a number (all = entries, unread = unread, trips = bookings), so the rail reads as a set; only the
  unread number changes as you read.
- Colours: white paper with a hairline edge; chosen tag navy-800 (navy-700 in dark, where navy-800 sinks into the
  ink card) with white text; gold only on the eyelet ring and the chosen tag's icon. No shadows, no gradients.
- Tag colours live in `parts/luggage.css`; `tokens.css` is copied verbatim from home-steps v5.
- While loading or after a failed load the tags print `--` and the summary line is blank, so no count is shown that
  was never loaded; the first real numbers drop in without a jiggle.
- Phones: the tags shrink to 100 × 120 px inside three equal columns (no horizontal scroll at 390 px), and "Mark all
  as read" takes its own full-width row under the title.
- Lab-only: add `&state=loading`, `&state=error` or `&state=empty` to the frame address to see those states.

## Verification (2026-11-22)
- `pnpm lab:check`: all versions compile.
- Playwright at 1440 and 390 px, AR-RTL light and EN-LTR dark: all, a row opened (marked read, unread tag jiggles),
  unread, trips, a trip's thread, mark all, unread empty state; error state. No horizontal scroll, no button under
  44 px, the forward arrow key follows the page direction. Screenshots in `shots/`.

## Open questions
- Is the tag area (about 200 px tall on desktop) too much height for a tab row on the account page, or is it right
  for a signature moment that only this page has?
- Keep the Latin bag-tag codes in Arabic, or print Arabic letters/digits?
- Should the trip thread keep the real page's "Open booking" button (left out here)?
