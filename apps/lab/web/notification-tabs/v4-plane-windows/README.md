---
version: v4-plane-windows
title: Plane windows
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/account/notifications/notifications-page.tsx]
ported:
---

# Plane windows

## Idea
The three views (All, Unread, Trips) sit in a strip of cabin wall as three aircraft windows. A closed window keeps its
pull-down shade down (a flat panel with a small grip); the chosen window raises its shade on a spring and shows a flat
sky, light blue by day and the night navy in dark mode, with two simple clouds drifting slowly. The unread count is a
small gold badge on the unread window's frame. The panel under the strip comes out from under the windows like a tray
table folding down, so the link between "which window is open" and "what I am reading" is physical rather than a
moving pill.

## Key decisions
- Opening ("cabin waking up"): while the list loads, the shades lift one after another (0.22 s apart) and drop again;
  the chosen window's shade stays up. Then the tray folds down with the rows.
- Switching: the old shade is pulled down evenly (0.38 s) while the new one rises on a spring with a small bounce; a
  gold latch under the label follows the chosen window (shared layout). The tray folds back up (clip from the bottom
  edge, 0.22 s) and the new one folds down from its top hinge (rotateX -16 deg to 0, clip reveal, spring), rows
  following 45 ms apart.
- Raised shades stop at 90 % so a sliver stays at the top, as on a real window.
- Reduced motion: shades jump to their state, no wake-up, clouds stand still, the tray only cross-fades.
- Tabs keep the real page's WAI-ARIA pattern: one panel, roving tab index, arrows follow the page direction,
  Home/End. The window art is decorative; the label under it is the tab's name, and the badge has a screen-reader
  text.
- Windows are 56 x 76 px on phones and 74 x 100 px from `sm`, each whole tab (window + label) is the target.
- Colours: wall `neutral-100` / `ink-800`, frame white / `ink-600`, shade `neutral-200` / `ink-700`, sky
  `ocean-light` / `ocean-deep`. All flat; hairlines only, no shadows, no stripes. Badge gold with navy-950 text.
- Window geometry and the wall/frame/shade/sky colours are plain CSS classes in `tokens.css` (`v4-*`): the running lab did
  not generate new arbitrary Tailwind values for this folder, and plain CSS keeps the look independent of that scan.
  When ported they become ordinary Tailwind classes.
- Phones: "Mark all as read" moves to its own line so the unread summary is not squeezed.
- Opening an unread row marks it read (badge, summary, trip counts and the unread list update; in Unread the row
  leaves the list). Trips open a thread with an "All trips" control; the trips tab stays selected.

## Open questions
- The real thread has an "Open booking" action; it is left out here because the lab has no booking page to go to.
- Should the trips window also carry a badge (unread updates across trips), or only the unread window?
- The wake-up plays on every visit to the page; should it play only on the first visit in a session?
