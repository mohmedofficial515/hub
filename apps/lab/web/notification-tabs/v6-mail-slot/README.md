---
version: v6-mail-slot
title: Mail slot
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/account/notifications/notifications-page.tsx]
ported:
---

# Mail slot

## Idea
The inbox as a mailbox. The three views (All / Unread / Trips) are flat envelopes hanging under a mail slot. Closed
envelopes are sealed with a small gold dot on their flap; the chosen one opens its flap (3D rotateX over its top
edge) and a sheet of paper peeks out. The entries then rise out of it as letter cards. The unread count is an airmail
stamp in the corner of the "Unread" envelope (dashed edge in navy, teal and gold, flat). Reading an entry seals its
teal dot into a check, the stamp ticks down and a tiny letter flies on an arc into the stamp, which thumps once.

## Motion
- Opening: the slot plate draws from the centre (0.38 s), the envelopes drop through it one after another (spring,
  0.12 s apart, clipped at the slot while falling), then the chosen flap opens and the letters rise (staggered
  55 ms, a slight tilt that settles).
- Tab switch: the old flap closes and its sheet drops back, the new flap opens; the old letters sink down (0.16 s),
  the new ones rise out. Hovering a closed envelope lifts its flap a little (32 degrees).
- Reading: dot → check (scale and path draw), number in the stamp ticks (new number drops in from above), letter
  flight 0.75 s. In the Unread view the read row stays 0.7 s so the seal is seen, then slides back down and the
  rows below close the gap. "Mark all" sends up to four letters.
- Trips: a trip's letter opens its thread in the same panel with a back control; focus moves to "All trips" and back
  to the trip row.
- Reduced motion: `MotionConfig reducedMotion="user"` drops every transform (flaps, drops, flights); the intro is
  skipped, content only fades.

## Key decisions
- Phones (< 640 px): envelopes become 52 px pills with a small flap and sheet; icons hidden so "غير المقروءة" fits.
- No shadows, no coloured edges: envelopes and letters are hairline outlines; the chosen envelope gets a navy
  outline. Teal only for the unread dot, the mark-all action and the "N unread" chip; gold only for the seals, the
  slot screws and one stamp dash colour.
- Every row is a button (44 px+); WAI-ARIA tabs as on the real page (roving tab index, arrows follow the direction,
  Home/End). The stamp is hidden from screen readers; the tab name carries ", N unread" instead.
- Loading and error states: add `&state=loading` or `&state=error` to the frame address.
- `utilities.css`: the running lab's shared web.css did not pick up the class names of this new folder, so the version
  builds its own utilities from `./` (theme as reference only). Remove it when porting.

## Open questions
- Should read entries keep the small check, or show nothing (as today) once the seal animation has played?
- Real page opens an entry's link (booking, support request) after marking it read; here a click only marks it read.
- Is the open flap above the tabs (needs about 56 px of height on desktop) acceptable inside the account card?
