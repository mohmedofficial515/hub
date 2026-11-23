---
app: web
page: notification-tabs
route: /[locale]/account/notifications (the view tabs "All / Unread / Trips" and the panel under them)
live-url:
sources:
  - src/features/account/notifications/notifications-page.tsx (ViewTabs, InboxViews, TripsView)
  - src/features/account/notifications/inbox-entry.tsx
  - src/features/account/notifications/notification-links.ts (kinds, icons, tones)
  - messages/<locale>/domains/account.json → notifications.views / empty / trips
status: designing
---

# Account notifications: view tabs (الكل / غير المقروءة / الرحلات)

Owner request 2026-11-22: 20 creative ideas for these tabs, each with its own opening animation, its own way of
moving between tabs, and sample content so the whole experience can be tried. Build the first five now; the other
fifteen wait for the owner.

Source read from `F:/Goteav/wt-uplift/web` (branch `feat/gtv-472-redesign-ports`), where the page lives.

## Purpose
The customer opens their inbox and in one glance sees what is new, then moves between every update, only the unread
ones, and updates grouped by trip (booking).

## Current tabs (`v1-baseline/1440-rtl-light.png`)
Segmented control on a grey track: white pill with a small gold underline under the active tab, icons Inbox / Mail /
Plane, spring layout animation between tabs. Clean but generic; nothing says "Goteav" or "travel", and the panel under
it just swaps.

## Constraints for every version
- Same three views, same order: `all` → `unread` → `trips`. Unread count visible on the "unread" tab.
- WAI-ARIA tabs: `role=tablist/tab/tabpanel`, roving tabindex, arrows follow the page direction, Home/End.
- Site colours flat: navy, white, teal for action, gold small touches. No decorative gradients, no coloured side or
  top stripes on cards (owner rules). Cairo; headings ≤ 700; RTL + LTR; light + dark; 390 / 768 / 1440.
- Motion with framer-motion, respects `prefers-reduced-motion` (falls back to a plain cross-fade or none).
- Full experience on sample data (`@lab/mocks/notifications-inbox`): opening a row marks it read and the unread count
  updates; "mark all as read"; empty state when unread is empty; trips view lists bookings and opens a booking's
  thread with a back control.

## The 20 ideas
| # | Version | Idea | Status |
|---|---|---|---|
| 1 | v2-flight-path | Tabs are three airports on a dashed route arc; a small plane flies to the chosen tab and draws its contrail; the panel "lands" | ported (a93c45f, feat/gtv-472-redesign-ports) |
| 2 | v3-split-flap | Departures board: tab names on split-flap tiles that flip letter by letter; rows flip in like board lines | draft |
| 3 | v4-plane-windows | Each tab is an aircraft window; the chosen one raises its shade to show sky, the content slides out from it | draft |
| 4 | v5-luggage-tags | Tabs hang as luggage tags on a rail; the chosen tag swings down on its strap; panel rolls on like a belt | draft |
| 5 | v6-mail-slot | Inbox as a mailbox: tabs are envelopes; choosing one opens its flap and the letters (rows) slide out | draft |
| 6 | passport-pages | Tabs are the coloured edge tabs of a passport; switching turns the page in 3D |  |
| 7 | radar-sweep | A radar disc where the three views are blips; the sweep line rotates to the chosen one, unread pings pulse |  |
| 8 | cockpit-switches | Tabs are overhead-panel toggle switches with indicator lights; panel boots like an instrument screen |  |
| 9 | boarding-stub | Tabs are the tear-off stubs of one boarding pass; the chosen stub tears along the perforation |  |
| 10 | baggage-carousel | Tabs ride a curved baggage belt; the chosen one stops at the front, content comes round on the belt |  |
| 11 | runway-lights | Tabs sit on a runway; approach lights chase toward the chosen one, content taxis in |  |
| 12 | seat-map | Three seats in a cabin row (window/middle/aisle); choosing a seat "books" it with a tick |  |
| 13 | compass-dial | A rotary compass bezel; turning to N/E/S chooses the view, needle settles with inertia |  |
| 14 | gooey-blob | A liquid indicator that stretches and splits between tabs (SVG goo filter), rows drip in |  |
| 15 | folder-stack | Manila folders with file tabs; the chosen folder comes to the front and opens |  |
| 16 | cloud-layers | Tabs at three altitudes; switching climbs or descends through parallax cloud layers |  |
| 17 | stamp-pad | Tabs as rubber stamps; the chosen one stamps the panel header with a "received" mark |  |
| 18 | dock-magnify | A dock of three big icons that magnify under the pointer, bounce on select |  |
| 19 | ticket-punch | One long ticket; the chosen tab gets a punched hole, confetti of the punched paper |  |
| 20 | world-clock | Three airport clocks; the chosen one lights up, hands sweep, content sorted by time |  |
