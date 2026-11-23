---
version: v2-flight-path
title: Flight path
status: ported
base: v1-baseline
created: 2026-11-22
tokens: override
touches-components: [features/account/notifications/notifications-page.tsx]
ported: web feat/gtv-472-redesign-ports@a93c45f
---

# Flight path

## Idea
The three views (All / Unread / Trips) are three airports on one dashed route arc. When the page opens the route
draws itself, the airports appear one after another, and a small plane comes in from the route's tail to the chosen
airport. Choosing another view flies the plane along the arc to it, with a solid gold contrail behind it; when it
touches down a gold ring opens out from the airport and the panel's rows come down into place one by one ("landing").
The tabs stop being a generic segmented control and say "Goteav, travel" without adding any work for the customer:
it is still one click on a big target, and the unread count sits on its airport as a small badge.

## Key decisions
- **Real tabs, decorative route.** The airports are `role=tab` buttons (roving tab index, arrows follow the page
  direction, Home/End, `aria-controls` to the one `tabpanel`). The SVG route, contrail and plane are `aria-hidden`.
- **Direction.** The arc is drawn in logical coordinates and the SVG is mirrored in RTL, so "All" sits at the inline
  start and the plane always flies in the reading direction (right-to-left in Arabic). Airports use
  `inset-inline-start`.
- **Geometry.** One symmetric quadratic curve; the outer airports sit on its ends, "Unread" on its top. The arc is
  40 px high on desktop, 28 px on tablets and 16 px under 420 px, so the three names stay on one line at 390 px.
- **Motion.** Opening: route reveal 0.9 s (mask over the dashed line, so the dashes stay), airports spring in with
  0.2 s steps, the plane flies in at 1.15 s. Switch: flight 0.5 s + 0.55 s per arc length (0.78 s to the next
  airport, 1.05 s end to end), eased; the plane turns along the curve's tangent and faces backwards when flying back.
  Panel: old content leaves in 0.14 s, new content drops 10 px into place, rows stagger 55 ms. Reading a row in
  "Unread" lifts it out and the rest close the gap (layout animation).
- **Reduced motion.** No route draw, no flight, no pop: the active airport is filled at once and the panel only
  cross-fades (`MotionConfig reducedMotion="user"` plus explicit checks for the imperative flight).
- **Colour.** Flat site colours: navy for the chosen airport and the plane, a hairline dashed route, gold only for the
  contrail, the landing ring and a short bar under the chosen name; teal-700 for the unread dot, badge and actions
  (AA on white). Rows are neutral cards with a hairline; colour is in the icon tile only. No shadows, no stripes.
- **States.** Skeleton on first load, error with retry, empty states with account.json copy. Lab-only:
  `&state=loading|error|empty` in the frame address shows them.

## Open questions
- Should the plane stay parked on the chosen airport after landing? It now fades out and the airport fills, which
  keeps the resting state calm; a parked plane would be more playful but sits on top of the view's icon.
- The rows wait ~0.12 s for the panel; should they wait for the whole flight (up to 1 s) to sell the "landing", at
  the cost of task speed?
- "Open booking" from a trip's thread is left out in the lab (no booking page here); the port keeps the real link.
