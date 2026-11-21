---
version: v2-timeline-views
title: Views over one stream
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-16
tokens: override # inherit | override (see tokens.css)
touches-components: [components/timeline/item.tsx (TimelineItem becomes FeedRow: status chip, why chip, action on phone), components/inbox/row.tsx (InboxRow replaced by FeedRow), components/today/counters.tsx (CountersBand becomes the one-line header), components/today/awaiting.tsx (AwaitingStack becomes the Needs me view), components/today/since.tsx (SinceLastVisit becomes the New view), components/common/segmented.tsx (reused for the views bar), components/shell/sidebar.tsx (one entry, one badge), components/shell/view-ids.ts (/today and /inbox redirect into ?view=), features/live/apply-event.ts (patch the timeline cache from SSE card.event), features/inbox InboxItem link mapping]
ported:
---

# Views over one stream

Concept A of `../concepts.md`, built. The Timeline is the one working surface; Today and Inbox become views of it.
Night Peacock tokens come from the approved `today/v5-peacock-app` (`tokens.css` imports them and adds only the
row-change highlight and the row layout). Data: `shared/mocks/hub-app/feed.ts` (a `TimelineRow` joined with the matching
`InboxItem`'s why and read state, plus card-less system items).

How to open it: `/lab/frame-hub.html#/timeline/v2-timeline-views?lang=ar&theme=dark`. Scenarios (`&scenario=`): `default`,
`empty`, `loading`, `long` (240 more rows), `error`. `&view=needs|new|mentions|all` picks the first view. `&live=off`
stops the two timed live events (the preview-only button at the foot still sends them).

## Idea
One row, four filters, one header. Every item that reaches the member is a `FeedRow` with the same four facts on
phone and desktop: type and key, the card's CURRENT status in a chip that is always visible, a title clamped to two lines
with a "why" chip and the age, and one filled action while the card still offers it. The four views are filters of the same
list: Needs me (ranked like a shelf, urgent first), New, Mentions and reminders, All (the old Timeline with its tide line).
Today shrinks to a header of one line: greeting, the one counter, the brief clamped to a line (opens in place), the next
deadline, the live state. Items with no card (brief, source problem) and card-bound reminders and escalations are system
rows: the same row, a system icon in place of the type icon, a kind chip in place of a status chip.

## Key decisions
- **One component, container-driven.** `parts/feed-row.tsx`. The arrangement switches on the width of the row (a container
  query on the `li`, 42 rem), not the viewport, so a narrowed page (chat panel, sheet) gets the stacked layout by itself.
  Phone has four lines, desktop two, and nothing is hidden on phone (the baseline hid facts and actions there).
- **Status is first-class.** `StatusChip` shows `card.status` now. When it changes while you look, it cross-fades to the new
  tone and shows "was: Pending" struck through for 4.5 s; the row gets a 1.6 s highlight (`tl-hot`). Reduced motion: no
  animation, the same ring and tint are shown statically for the same time, the swap is instant, a polite live region says
  "GTV-244 is now Acknowledged".
- **Actions follow the card, not the notification.** The button is `card.awaiting`. After the live acknowledgement the
  action on GTV-244 turns from "Acknowledge" into "Apply". After I act, the row shows the new status for 3.2 s with a toast
  and Undo, then leaves "Needs me" (it stays in All).
- **The one counter** is the distinct number of cards (or system items) that wait on me or are unread (13 in the default
  mock: 7 need me, 11 are new, 5 overlap). It is in the header with the overdue count; tab numbers are their own
  breakdown and are allowed to add up to more. It is `counts.attention` in `parts/model.ts`.
- **Needs me** bands: overdue or escalated, within 24 h, later. Ready tasks and sessions without a summary are two
  collapsed "also for you" groups, so Today loses nothing.
- **Mentions and reminders** = `mention`, `deadline_reminder`, `escalation` and the brief. `watch_update` is left out on
  purpose (a view named after mentions that also holds every watched card would be noise); it lives in New and All.
- **Long list.** Rows below the fold use `content-visibility: auto` (`tl-lazy`) once the list is over 40 rows, and the
  stream shows 50 at a time with "Show older" and "Showing 50 of 260". No virtualisation: concepts.md section 2.5 says to measure on real data first; `content-visibility` is the cheap step.
- **New arrivals** prepend when the page is at the top and queue behind a pill ("1 new arrived · show") when scrolled, so the
  list never moves under the reader. Status changes on visible rows apply in place and never reorder.
- **Directions.** Logical properties only. Keys, branches, paths, SHAs and `/hub:done` are `<bdi dir="ltr">`.
- **Short titles.** The mock uses short Arabic titles on purpose. One long title (GTV-255) is there to show the two-line clamp.
- **Not redrawn:** the All view's filter bar (roles, types, repo, member, date, mine), search, and the card sheet. They
  keep their current design; the sheet is stood in for by a toast.

## What I could verify and what I could not
See the report returned with this version. Screenshots are in `shots/`, named `<width>-<rtl|ltr>-<light|dark>.png`, plus
state shots (`state-*.png`).

## The seven open questions, with the default this version assumes
1. **Per-user per-card read marker as new backend?** Assumed yes, small: `card_reads(user_id, card_id, last_read_event_id)`
   and `counters.attentionCards`. This mock does it client-side (`read` map, distinct union) so the design works without it,
   but beyond page 1 the counter is approximate until the marker exists.
2. **Keep the global "since last visit" watermark or replace it?** Keep it for now. It only draws the tide line and decides
   what is "New" together with unread notifications. Replacing it is Concept C's decision, not this version's.
3. **Where do Team week and Source health live?** Team week moves to a "Team" entry in the header menu (not drawn here);
   Source health stays in Settings > Sources, and a failing source appears as a system row ("Source problem") with an
   "Open sources" action. Ready tasks and sessions are the two "also for you" groups.
4. **Short or Arabic title field on cards?** Assumed: enforce short titles at creation (agents and the New card dialog
   warn past about 60 characters); no new field. The row clamps to two lines as a safety net only.
5. **`/today` and `/inbox` as redirecting routes?** Yes. `/today` goes to `/timeline`, `/inbox` to `?view=new`, the Inbox
   "awaiting" tab to `?view=needs`, and e-mail, Telegram and push links keep working. The sidebar gets one entry and one badge.
6. **Fixed views or user-defined saved filters?** Four fixed views. Counts stay trustworthy; custom filters remain the All
   view's existing filter bar.
7. **Agents' automated events in "New"?** Only events that touch me or my cards: routed to my role, mention, a card I watch
   or own, reminder, escalation. Agent commit noise on cards I do not watch stays in All only. The mock reflects this
   (no commit rows from unwatched cards in New).

## Open questions for the owner
- Is 13 (distinct union) the right headline number, or should the header say only how many need a decision (7)?
- The row opens the card sheet from the title (stretched button). Is a separate visible "Open" button wanted on desktop?
- Should the sticky views bar also carry the search and filters on desktop?
- Is the preview-only "Send a live event" strip fine to keep in the lab version for review, or should the live events only
  run on a timer?
