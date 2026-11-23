---
version: v3-split-flap
title: Split-flap board
status: draft
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/account/notifications/notifications-page.tsx]
ported:
---

# Split-flap board

## Idea
The three views (All / Unread / Trips) become one strip of an airport departures board in navy. Each label sits on
split-flap tiles and the unread count is a two-digit flap counter. When the page opens the tiles run through other
faces and settle on their labels, tab by tab, while the counter steps up from 00 to the real count. Choosing a tab
flips its tiles once and lights a small gold "boarding" lamp. The panel under it is read like the board's rows: each
row flips down from its top edge, line by line, and carries a status cell (a flap that reads "new" or "read", and the
time). Opening an unread row marks it read: its status flap flips to "read", the counter steps down digit by digit and
in the Unread view the row folds away. The Trips view shows each booking with its route codes on letter flaps
(CAI ✈ IST) and its unread counter; opening one shows that booking's thread with a back control.

## Key decisions
- **Arabic shaping.** A flap never shows part of a word. Each face is the whole string, rendered twice and clipped
  with `clip-path` to the top and bottom halves; the 3D flip (`rotateX`) moves those clipped copies. Arabic labels get
  one tile per word, and while settling they pass through other whole printed words (city names: دبي، جدة، مسقط…),
  the way real boards print destination flaps whole. Latin labels, IATA codes and digits get one tile per character.
  The browser shapes every face normally, so joins are always correct.
- Tile width is fixed by an invisible copy of the final label, so the strip never jumps while faces pass through.
- Flip timing: a half falls in 60 ms, the other lands in 72 ms; faces change every 72 ms. The opening run starts tab
  by tab (260 ms apart, 6 faces + 1 per tile); a later pick runs 2 faces. Rows flip in 70 ms apart with a slight
  overshoot; on the first load they wait 550 ms so the strip settles first.
- Reduced motion: tiles show their labels at once, the counter jumps, rows appear without flipping (`MotionConfig
  reducedMotion="user"` plus `useReducedMotion` in the flap pieces).
- WAI-ARIA tabs exactly as the real page: roving tab index, arrows follow the page direction, Home/End, one
  `tabpanel`. Tiles are `aria-hidden`; each tab carries its name (and the unread count) as text for screen readers.
- Colours: board navy-800 (navy-900 in dark), flaps navy-950, labels navy-200 / white when chosen, gold only for the
  lamp, the counter digits and the "new" flap. No gradients, no shadows, rows are hairline-divided, no stripes.
- Phones (390 px): the middle tab is a little wider (1 : 1.4 : 1) so "غير المقروءة" keeps both word tiles; the lamp
  and counter go under the label, and each row's status cell moves under its text so the title keeps the width.
- Lab-only states from the address: `&state=loading`, `&state=error` (retry then loads), `&state=empty`.
- The trip thread opens inside the Trips panel (the real page swaps the whole card and keeps `?bookingId=` in the
  address); the "Open booking" link of the real thread is left out of the lab.

## Open questions
- Should the Arabic flaps pass through city names (current) or through blank flaps only?
- Keep the status flap ("new" / "read") on every row, or show it only on unread rows to calm the list?
- Should the thread keep the board strip above it (current) or replace the whole card as the real page does?
- Lab note: the running lab's Tailwind only knows classes found when it started, so classes new to this version
  render after the next lab restart. Screenshots were taken with those classes injected into the test tab only.
