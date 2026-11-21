---
version: v3-phase-rail
title: Phase rail
status: draft
base: v2-route-line
created: 2026-11-19
tokens: inherit
touches-components: [apps/web/src/components/planning/detail-parts.tsx (RouteLine becomes an even, scrolling rail), apps/web/src/components/planning/detail.tsx (header holds the rail)]
ported:
---

# Phase rail

v2-route-line with one change: the route at the top of the plan. Everything else on the page is v2 as it was sent for review.

Open: `http://127.0.0.1:7320/lab/frame-hub.html#/plan-page/v3-phase-rail?lang=ar&theme=dark&scenario=midway`. Scenarios
(`&scenario=`): `default`, `midway`, `many` (new, 20 phases), `empty`, `loading`, `error`.

## Idea

The owner's note on v2 (2026-11-19): with many phases the route piles up and stops looking professional. In v2 a station's width
follows its step count, so a three-step phase got a sliver and its title broke into three or four lines while a ten-step phase
had room to spare; the counts sat at different heights and the last titles were cut at the edge.

The rail gives every phase the same width and the same shape, and holds up from 2 to 20 phases:

- **Even stations.** They share the width while each can have 7.5rem; past that the rail scrolls sideways with snap. 9 phases
  fit on desktop with no scroll; 20 phases, or 9 on a phone, scroll.
- **One layout per station:** track (dot + this phase's own fill), then the number and title clamped to two lines with two
  lines always kept, then "5 of 10" or "Done". Every count sits on one baseline whatever the titles.
- **When the rail scrolls:** the edge that hides more phases fades, round arrow buttons page by 80 % of the width from 768 px
  (phones swipe), and the rail opens centred on "You are here". Only the rail moves, never the page.
- **"You are here"** stays in words on the station ("· أنت هنا", "· Now" in English where the full phrase does not fit at 7.5rem);
  the accessible name keeps the full phrase.
- **Titles of API text** (`dir="auto"`) align with the page's own start, so an Arabic title on the English page lines up with its count.

## Key decisions

- Width no longer says the step count; the count is in words on every station, which is what people read anyway. The hint for
  screen readers now says the stations are even and the rail scrolls.
- One Tab stop and arrows along the rail stay (kit `useRoving`); the browser scrolls a focused station into view. The arrow buttons
  are pointer-only (`tabIndex=-1`), since the keyboard already moves station by station.
- Phones show titles too (v2 showed numbers only under 1024 px), because a station is now at least 7.5rem wide and the rail
  scrolls. This answers v2 open question 5: every station is a 44 px+ target.
- Station sizing and the two-line height are inline styles: in this frame the utility classes for them were not generated, the
  same reason v2 sized its stations inline.

## Verification

- Playwright, 1440 ar dark (midway, many), 1440 en light (midway), 390 ar dark (many). 9 phases at 1440: nine stations of 122 px,
  no scroll. 20 phases: scroll with both fades and arrows, opens on the current phase. 390: no page overflow (375 px), rail
  centred on the current phase.
- `pnpm lab:check`: 41 versions compile. `tsc --noEmit` over every version: clean. No physical direction classes.
- Not done: an independent `ux-critic` review; light/dark contrast is the v2 kit tokens.

Shots in `shots/`: `1440-ar-dark-midway.png`, `1440-en-light-midway.png`, `rail-1440-ar-dark-many.png`,
`rail-1440-en-light-midway.png`, `rail-390-ar-dark-many.png`, `390-ar-dark-many.png`.

## Open questions

1. Above about 12 phases, should the rail also offer a "show all phases" list (a popover grid), or is scrolling enough?
2. Keep the many-phase demo (`scenario=many`) as a lasting test case when this is ported?
