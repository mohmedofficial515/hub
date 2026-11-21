---
version: v4-plan-story
title: Plan story
status: draft
base: v3-phase-rail
created: 2026-11-19
tokens: override
touches-components: [apps/web/src/components/planning/detail.tsx (header ring and next-step callout, journey section, chapter, roles panel), apps/web/src/components/planning/detail-parts.tsx (RouteLine replaced by JourneyMap, PlanRing, PhaseFocus, RolesChart), apps/web/src/styles (phase tones), features/planning/model.ts (phaseState, toneOf)]
ported:
---

# Plan story

Open: `http://127.0.0.1:7320/lab/frame-hub.html#/plan-page/v4-plan-story?lang=ar&theme=dark&scenario=midway`. Scenarios
(`&scenario=`): `default`, `midway` (demo state), `many` (20 phases), `empty`, `loading`, `error`.

## Idea

The owner asked (2026-11-19, with the `ui-ux-pro-max` skill) for a version that tells a plan as an engaging story: interactive,
expressive and professional colours, organised, no clutter, with interactive diagrams that make the plan clearer.

The page reads top to bottom as four answers, each with one picture:

1. **Where does it stand?** A ring split into an arc per phase (as long as its step count), each filling in its phase's colour,
   with the percentage in the middle; beside it "9 of 50 steps · 9 phases · 15 ideas" and the next step in a callout tinted with
   its phase's colour, with "Open the phase".
2. **What is the journey?** A map: a stop per phase on a path that runs along a row and turns back on the next, ending at a
   finish line ("41 left"). Any number of phases fits with no sideways scroll: 9 phases are two rows on desktop, 20 are four;
   under 560 px it becomes one vertical line. Finished stretches draw themselves once; the rest is dotted.
3. **What is in this chapter?** The phase picked on the map, in its colour: a band (number, "Current chapter · Phase 1 of 8 ·
   In progress", title, note, previous / next), a waffle of its steps (a square per step) beside the step list. Pointing at a
   square lights its row and the other way round.
4. **Who carries it, and the detail.** A bar per role split by phase colour (solid done, pale to do), then all phases folded,
   the plan text and the side column as in v2.

Ring, map, chapter and roles chart share one state: pointing at a phase anywhere lights it everywhere; picking it anywhere
opens its chapter.

## Key decisions

- **Colour means "which phase", shape means "what state".** Eight hues from one oklch formula (`story.css`), cycled. Done is a
  filled disc with a check, in progress is a ring with a slow pulse, not started is a hollow ring on a dotted path; the legend
  is in shapes. Words always say the state too.
- **This version breaks v2's rule "no colour on any surface"** on purpose, because the owner asked for expressive colour.
  Colour stays on marks and two quiet tinted surfaces (the next-step callout and the chapter band); cards stay neutral.
- **Contrast measured** in the browser for all 8 tones: text in the tone on card at least 6.6:1 (light) and 10.1:1 (dark); on
  its soft tint at least 6.0:1 and 8.9:1; text on a filled tone at least 4.86:1 and 7.8:1.
- **Motion, two things only** (`ui-ux-pro-max`: 1-2 animated elements per view): the path drawing once and the pulse on the
  current phase, plus a short slide when the chapter changes. All of it stops under `prefers-reduced-motion`.
- **Keyboard:** the map is one Tab stop with arrows along the path (kit `useRoving`); Enter picks. The ring and the roles chart
  are pointer shortcuts only and hidden from screen readers, with their numbers said in words beside them. The waffle is hidden
  from screen readers too; the step list next to it is the accessible version.
- **Less noise:** the role badge is left out of each step row when the whole phase has one role, which the "Roles in this phase"
  chip already says; all phases are folded by default under the chapter.
- **Design-system search** (`ui-ux-pro-max --design-system`) suggested a landing-page funnel, indigo and Inter / Playfair. Not
  used: no Arabic in those fonts, and Hub keeps Night Peacock and Cairo. Taken from the search: waffle chart for part of a whole,
  progressive disclosure, motion limits, and never colour alone.
- Layout classes the frame did not emit for a new folder live in `story.css` as plain classes (`ps-*`).

## Verification

- Playwright: 1440 ar dark (midway), 1440 en light (picking phase 5, arrow to phase 6), 1440 ar dark map with 20 phases,
  390 ar light (vertical map, page width 375 px, no horizontal overflow).
- Contrast for the 8 tones in both themes, as above.
- `pnpm lab:check`: 42 versions compile. `tsc --noEmit` over every version: clean. No physical direction classes or hex in TSX.
- Not done: an independent `ux-critic` review.

Shots in `shots/`: `1440-ar-dark-midway.png` (full page), `1440-en-light-phase5.png`, `map-1440-ar-dark-many.png`,
`390-ar-light-midway.png` (full page).

## Data

No new field beyond v2's proposal (`plan.phases`, `planStep.phaseId`). Tones are derived from the phase's position; the ring,
waffle and roles chart are computed from the steps.

## Open questions

1. Should phase colours be chosen by the owner per phase (stored), or stay derived from position as here?
2. Keep the pulse on the current phase, or make it a static ring?
3. When a plan has dates per step later, should the map gain a time axis (a Gantt view) as a second mode?
