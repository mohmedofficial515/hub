# Timeline as the one working surface: concepts (step 4)

Date: 2026-11-16. Scope of this round: baseline inventory + concepts only. No version is built.
Sources read: `README.md` (brief), `docs/09-pages.md` §4/§5/§15, `apps/web/src/{features,components}` for
timeline/today/inbox/live/cards, `packages/contracts/src/{notifications,today,cards/read-models}.ts`.
The baseline screenshots could not be taken (login refused, see `v1-baseline/components.md`), so every
statement about the current pages is from code and docs, not from looking at them running.

Wireframes are drawn left-to-right. In Arabic RTL everything mirrors (spine, chips, actions go to the
inline end = the left side). Card keys, branches and paths stay LTR inside the Arabic text.

## 0. The owner's question, answered first

Yes, the Timeline can be the single base. The three pages already share most of their data: Timeline rows
and Inbox items both carry the full card (`status`, `awaiting`, flags), Inbox items already carry
`data.action`, and the Inbox already holds the non-card items (brief, reminder, escalation, system).
What is missing is not a new page, it is (1) one row, (2) one definition of "awaiting me" and "new",
(3) a way to show card-less items in the stream. Two caveats, stated plainly:

- A Timeline row is "what happened"; an Inbox item is "why this reached me". They are different
  facts about the same card. The unified row must show both (a "why" chip on the event row) or the Inbox
  value is lost.
- "One read state, one counter" is not free. Today there are two semantics (per-notification `readAt`,
  one global `lastSeenAt`). Concept A hides the difference, B narrows it, C removes it.

## 1. What the surface must support (verified in code)

Data (existing endpoints): `GET /timeline` (`TimelineRow`: event + full card + collapsed count, 50/page,
cursor; filters from/to/types/roles/repos/modules/actors/kinds/q/`mine`), `GET /inbox` (`InboxItem`:
kind of 14, title, body, card?, data.action/link/count/i18nKey, groupKey, readAt, archivedAt),
`GET /today` (brief + narrative, `awaitingMe`, `readyTasks`, `deadlines`, `noSummarySessions`,
`changesSince`, `counters`, `team`, `sources`, `weekly`), `GET /counters`. Realtime: SSE `card.event`
(patches card lists, then batched refetch with a 200 ms / 2 s busy gap), `inbox.new`, `counters`.

States: loading skeleton, empty per view ("nothing waits for you", "no changes since", "no events match"),
error with code + request id + retry, SSE `live / reconnecting / unavailable`, "n new events" pill while
scrolled, refresh, tide line (last visit).

Actions: decide, deliver, verify, acknowledge, apply, approve, claim (inline today); open sheet `?card=`;
mark read / unread / archive / mark all read (with Undo); copy prompt/command; new card; filters;
shortcuts `j k Enter r c a e Shift+E f`.

Items that are not card events: morning brief, deadline reminder, escalation, system notices,
sessions without summary (a Today block), source problems.

Things to keep out of the stream (they are not "what happened"): team week stats, source health detail,
"ready tasks" backlog. They stay reachable (header, Tasks, Settings) and are not part of this concept
decision; each concept says where they go.

## 2. Foundations shared by all three concepts

### 2.1 One row anatomy ("FeedRow")

Phone, 390 px (nothing is hidden on phone; today the Timeline hides facts and actions there):

```
┌──────────────────────────────────────────────┐
│ ⚖ GTV-231                    ● Open · due 3h │  line 1: type icon + key (LTR) ... STATUS chip
│ Moyasar fees: customer or platform?          │  line 2: title, 2-line clamp, text-pretty
│ routed to accountant · backend agent · 11:00 │  line 3: WHY chip + who/what happened + age
│ [ Decide ]                       [ Open ] ⋯  │  line 4: one filled primary action, 44 px tall
└──────────────────────────────────────────────┘
```

Desktop, page width >= 768 (container query, not viewport: the chat panel and sheet narrow the page):

```
⚖ GTV-231  Moyasar fees: customer or platform?          ● Open · P1 · due in 3 h   [Decide] ⋯
   routed to accountant · 🤖 backend agent opened · 11:00 · blocks GTV-236            (+3 earlier ▾)
```

Rules:
- Status chip is first-class and always visible: `StatusBadge` at the inline end of line 1 (phone) or the
  row's end (desktop). It carries the card's CURRENT status, not the event's status.
- The inline action is the API's own `card.awaiting` verb (`actionsFor` / `awaitedAction`); one filled
  button, at most one secondary. Anything else is under "more" or in the sheet. Actions show only while the
  card still offers them, so a stale row never lies (same rule as `InboxItem.data.action`).
- WHY chip answers "why is this in front of me": routed to my role / mentioned / watching / reminder /
  escalated. It comes from the matching Inbox item(s) (join on card key + time). No match, no chip.
- Titles: the card has a single `title`. Clamp to 2 lines and keep key + type visible so a long English
  title still scans. A short/Arabic title field is a data decision for the owner (see §7), not assumed.
- Same component for event rows, notification-only rows and (Concept C) threads, via one adapter
  `toFeedRow(TimelineRow | InboxItem | Card)`.

### 2.2 System rows (non-card items)

A different shape so they are never mistaken for a card, same grid and same read behaviour:
- Morning brief: sun icon, one line "Morning brief, 4 Nov", expandable in place (markdown reuse of
  `MorningLetter`), "Open in Claude" copy hint inside. Sorted by its time (07:30), not pinned.
- Deadline reminder: clock icon + the card chip + "due in 24 h" (it IS card-bound, rendered as a reminder row
  with the card's status chip and action).
- Escalation: danger border (rust hairline, same token as `CardRow tone="danger"`), shown with the card and its
  action; sorted into "needs me".
- System / source problem: neutral icon, link from `data.link = {view, query}` (Settings > Sources).

### 2.3 Read state and the one counter

Define ONE user-facing counter: "cards that need me or have news for me", counted per distinct card, not per
event. Sidebar badge = that number (danger tone when something is overdue). Views show their own breakdown
and never add up to a different total.
- Backend-free version (A): "needs me" = `card.awaiting`; "new" = card has an event after `lastSeenAt` by
  someone else, or an unread notification; the badge is the distinct union computed client-side from the
  data already loaded for the first page. Honest limit: beyond page 1 it is approximate.
- Proper version (B small, C required): a per-user per-card read marker (`lastReadEventId` or `readThroughAt`
  per user+card) and a `counters.attentionCards` field. This replaces both `readAt` semantics for card items.

### 2.4 Real-time status

- SSE `card.event` already carries `cardKey`, `kind`, `status`, `at`, `eventId`. Add a patch of the
  `qk.timeline` / feed caches (today `patchRows` only patches `qk.cards`), so the chip changes without
  waiting for the batched refetch. Verify at runtime that the current path is not already inside one
  second; this is not measured.
- On change: the chip cross-fades old to new (160 ms) in the new status tone, and the row's start edge
  glows once for ~1.2 s. If I performed the action, the row also shows a quiet "Decided" state for 3 s with
  Undo (existing `usePerformAction` inverse) before it leaves the "needs me" band.
- `prefers-reduced-motion`: no glow, no cross-fade, instant swap; a polite live region says
  "GTV-231 is now Decided".
- Scrolled down: rows stay put, the existing pill counts ("3 new"), and status changes on visible rows still
  apply in place (they do not move rows).

### 2.5 Performance and no refetch storms

- Keep the existing refetch batcher (`createRefetchBatcher`: 200 ms calm, 2 s when 8 rounds in 10 s). The
  stream must not add its own invalidations on top of it.
- New: head polling instead of refetching all loaded pages. On SSE, ask only for rows newer than the newest
  shown (`GET /timeline?from=<newestAt>`, `from` exists today) and merge at the top; patch statuses in place.
  Pages below the first are not refetched on every event.
- Cap memory with TanStack Query's `maxPages` on the infinite query (keep ~6 pages = 300 rows; older pages
  drop and reload on scroll back) and `content-visibility: auto` with `contain-intrinsic-size` on rows and
  day groups. This is cheap, keeps browser find, anchors (`?card=` deep link) and the roving keyboard list
  working.
- Real virtualisation (`@tanstack/react-virtual`, a new dependency) only if a profile on the real data shows
  it is needed. Variable-height rows (expanders, system rows, sticky day headers) make it costly, and it
  complicates deep links, screen readers and `j/k` focus. I recommend measuring first. Not measured yet.
- First paint: render the first page plus skeletons for the header; the brief and counters must not block
  the list (today `GET /today` is a separate heavy request: do not make the stream wait for it).

### 2.5.1 Routes and links

`/today` and `/inbox` stay as routes that redirect into the surface (`/timeline?view=needs`, `?view=new`,
`?view=brief`) so that bookmarks, e-mail/Telegram/push links and `data.link = {view:'today'}` keep working.
The sidebar then has one entry. This is a change to `view-ids.ts`, the sidebar and `InboxRow` link mapping.

## 3. Concept A: "Views over one stream" (conservative, changes least)

Name for the version folder: `v2-timeline-views`.

Thesis. Keep what the Timeline already is (a chronological stream with a spine and a tide line) and add
two things: a one-line "day header" and a segmented bar of saved views. Inbox becomes the "Needs me" and
"New" views, Today becomes the header. The row gets a visible status and a real action on every width. It is
the smallest step that answers the owner's question and the easiest to port.

Layout principle: one chronological list, views are filters, Today is a header.

```
DESKTOP (page container >= 768)
┌ Timeline ─────────────────────────────────────── ● live  ⟲  [+ New ▾] ┐
│ Good morning Sara · 3 need you · 1 overdue                  Tue 4 Nov   │  day header (1 line)
│ ☀ Brief: "Yesterday the backend changed…" [read ▾]   ⏰ GTV-231 in 3 h  │  brief (clamped) + next deadline
├─────────────────────────────────────────────────────────────────────────┤
│ [Needs me 4] [New 12] [Mentions & reminders 2] [All]      ⌕  Filters ▾  │  saved views = Segmented
├─────────────────────────────────────────────────────────────────────────┤
│ ── Needs me ───────────────────────────────────────────────────────────  │
│ ⚖ GTV-231 Moyasar fees…                      ● Open · P1 · due 3 h  [Decide] ⋯ │
│    routed to accountant · 🤖 backend agent · 11:00 · blocks GTV-236      │
│ ⇄ GTV-244 Breaking change POST /refund…      ● Pending · ⚠   [Acknowledge] ⋯  │
│ ── Today ──────────────────────────────────────────────────────────────  │
│ ☀ Morning brief · 07:30                                       [expand ▾]  │
│ ◉ GTV-250 … ── tide: your last visit 08:10 ──                             │

PHONE (390)
┌────────────────────────────┐
│ Good morning · 3 need you  │
│ ☀ brief (3 lines) ▾  ⏰ 3h │
│ [Needs me 4|New 12|@ 2|All]│  horizontally scrollable, 44 px
│ ┌────────────────────────┐ │
│ │ ⚖ GTV-231   ● Open 3h  │ │
│ │ Moyasar fees…          │ │
│ │ routed to accountant   │ │
│ │ [ Decide ]       ⋯     │ │
│ └────────────────────────┘ │
│  FilterBar -> bottom sheet │
└────────────────────────────┘
```

Saved views (URL `?view=`, remembered per user, default = Needs me if >0, else New, else All):
- Needs me: the API-ranked awaiting list (`useAwaiting`), urgent first, then next 24 h, then rest; rows are
  cards with their latest event as the sentence. Replaces Today's "Awaiting me" and the Inbox "awaiting" tab.
- New: events by others after `lastSeenAt` merged with unread notifications, per card, newest first. Replaces
  "Since your last visit" and Inbox Unread.
- Mentions & reminders: Inbox kinds `mention`, `deadline_reminder`, `escalation`, `watch_update` (the Inbox
  family filter, reused). Includes the brief.
- All: today's Timeline unchanged (all current filters; `mine`).
Custom saved filters (user-defined) are NOT in scope: four fixed views, so counts stay trustworthy.

Counters / brief / deadlines. Counts are the tab badges and the sidebar badge (distinct cards, §2.3). Brief is
the clamped header line, expands in place. The next 1-2 deadlines are chips in the header; the 72 h runway
strip is dropped from this surface (a deadline already shows "due in 3 h" on its row). "Ready for my roles"
and "Sessions without summary" move to the end of the Needs me view as two collapsed "also for you" groups, so
nothing is lost. Team week and Sources move to a "Team" tab in the header menu / stay on Settings (open
question).

Real-time and perf: §2.4, §2.5. Needs me / Mentions re-sort live; New and All keep the pill behaviour.

What improves vs baseline. Task speed: decide/ack without opening a page, on phone too. Hierarchy: status and
action first on every row. Density: one row type instead of three. Discoverability: one place; counters
explain themselves (tab = reason). Counter disagreement shrinks (one distinct-card number).

Risks / trade-offs.
- "New" merges two cursors (timeline + inbox) client-side; pagination past page 1 is approximate and the
  merge logic is real work. A server `GET /feed` would fix it (Concept C needs it anyway).
- Needs me is not time-ordered, All is: two sort orders under one roof can confuse. The band headers ("Needs
  me", "Today", "Yesterday") make it explicit.
- Today's richer blocks (runway, team, sources) are demoted; a member who loves Today loses its dashboard feel.
- Read state still has two semantics under the hood; the UI hides it, the data does not unify it.

Extra backend: none required. Strongly recommended and small: `awaiting=me` param on `GET /timeline`
(docs/09 §5 already promises it, the code has only `mine`), and `counters.attentionCards` (distinct count).

Shared components it would change when ported: `TimelineItem` (+ status chip, why chip, action on phone),
`InboxRow` (replaced by FeedRow), `CountersBand` (becomes the header), `AwaitingStack` / `SinceLastVisit` (become
views), `Segmented` (reused), sidebar entries and badges, `view-ids.ts` redirects, `InboxItem` link mapping.

## 4. Concept B: "Shelf and river" (priority shelf above a time river)

Name for the version folder: `v3-timeline-shelf`.

Thesis. Do not make the member choose a view to find out what needs them. A fixed "shelf" at the top of the
Timeline holds only cards that need me, ranked by urgency, each with its inline action; below it the river is
the chronological stream of everything else, with what is new since the tide line visibly marked. Resolving a
shelf item makes it leave the shelf with a quiet motion and it reappears in the river as a past event. There
are no tabs to decide between; the lenses (Unread, Mentions, All) are small chips on the river only. It
reads like Today but is the Timeline.

Layout principle: two bands in one scroll (act now, then history); vertical priority replaces tabs.

```
DESKTOP
┌ Timeline ─────────────────────────────────────── ● live  ⟲  [+ New ▾] ┐
│ Tue 4 Nov · ☀ brief ▾ · ⏰ GTV-231 in 3 h · 6 tasks ready for you        │  strip (counters as sentence)
├ NEEDS YOU · 4 ────────────────────────────────────────── [collapse ▴] ─┤  sticky shelf
│ ⚖ GTV-231 Moyasar fees…        ● Open · due 3 h   [Decide]              │
│ ⇄ GTV-244 Breaking change…     ● Pending ⚠        [Acknowledge]         │
│ ⚑ GTV-250 task in review       ● In review        [Approve]             │
│ ⏰ GTV-199 due tomorrow          ● In progress      [Open]                │
├ THE RIVER ──── [All] [Unread 12] [Mentions] [Reminders]  ⌕  Filters ▾ ─┤
│ ── Today ──                                                              │
│ ● feat/refunds · 4 commits   ● Merged   👤 Sara 08:40–09:50     +3 ▾     │
│ ── tide: your last visit ──                                              │
│ ◌ GTV-231 opened by backend agent 11:00  (in your shelf ↑)               │

PHONE
┌────────────────────────────┐
│ ☀ brief ▾ · ⏰ 3h          │
│ NEEDS YOU · 4     ▴ collapse│  shelf is a stack of FeedRows, first one expanded
│ ┌ GTV-231 ● Open 3h ─────┐ │
│ │ Moyasar fees… [Decide] │ │
│ └ (3 more, peek 24 px) ──┘ │
│ River: [All|Unread|@|⏰]    │
│ ... rows ...               │
└────────────────────────────┘
```

Saved views: the shelf IS "Needs me" (always on, collapsible, remembers collapsed state). The river lenses are
All, Unread (new by others + unread notifications), Mentions, Reminders & escalations. URL `?lens=`. The
Inbox page = scroll to the Unread lens; Today = the strip + the shelf.

Row anatomy: §2.1 in the shelf (action-first, status chip, why chip); in the river the event sentence leads
and the card's current status is the chip. A card on the shelf appears in the river as an event row with a
muted "in your shelf" tag instead of a second button, so the same action is never offered twice.

System rows: the brief is the strip (expand in place) and also a dated river row. Reminders and escalations
sit on the shelf (they are asks) and as river rows after they are resolved. Source problems: a danger chip in
the strip (owner/pm).

Counters / brief / deadlines: counters are a sentence in the strip ("4 need you, 12 new, 1 overdue"), the shelf
header and the sidebar badge are the same number. The next deadline is a strip chip; overdue cards sort first
on the shelf.

Real-time: a new ask drops onto the shelf with the glow (§2.4) and bumps the shelf count; the river never
reflows under the reader (pill). Resolving an item: chip becomes "Decided" 3 s with Undo, then the row slides
out (layout animation, 220 ms, none under reduced motion) and the river gains its event.

Perf: shelf is small (cap 10, then "see all N" which switches the river to the Needs lens); the river uses §2.5.

What improves. The most important thing (what waits for me) needs zero clicks and is always first, on phone
too. Hierarchy is the clearest of the three. It keeps Today's mental model (act, then read), so it is the
easiest for current Today users.

Risks / trade-offs.
- Duplicate presence (shelf + river event for the same card) must be handled by the "in your shelf" rule; if
  done badly it reads as a bug.
- A tall shelf pushes the river down; on phone the first screen can be all shelf. Cap + collapse mitigates it.
- Two scroll "zones" in one page makes sticky headers and keyboard `j/k` navigation more complex (one list,
  two sections; `F6`-style jump).
- "Unread" lens still needs the two-source merge of Concept A.

Extra backend: same as A. Optional: shelf from `awaiting=me` with `limit=10` ranking server-side (already how
`GET /cards?awaiting=me` works).

Shared components changed when ported: as A, plus a new sticky `Shelf` container; `AwaitingStack` is largely
reused (it already has urgent / 24 h / rest bands and the Presence animation).

## 5. Concept C: "Threads and tide" (bold: card-centric feed with a sweep gesture)

Name for the version folder: `v4-timeline-threads`.

Thesis. Change the unit of the list from the event to the card. Each card is one thread row that says
"where it is now and what changed since I last looked", ordered by "needs me first, then newest activity",
grouped into three horizons by a live tide line: NOW (needs you), SINCE YOU LEFT, EARLIER. Read state is per
thread, so "awaiting me" is computed once and "new" has one meaning. The signature interaction is the
sweep: `Space`/swipe or the tide-line button marks everything above the tide as seen in one move (with Undo),
and the line animates down as the stream settles. The chronological event Timeline stays as the "All
activity" view for history and audit. This is the Linear-inbox / GitHub-notifications model adapted to Hub.

Layout principle: threads by card with horizon bands; the time axis becomes a secondary view.

```
DESKTOP
┌ Timeline ───────────────────── [Threads | Activity]  ● live  [+ New ▾] ┐
│ ☀ Morning brief ▾ ......................... 4 need you · 12 new · ⏰ 3h │
│ ━━ NOW · needs you · 4 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ⚖ GTV-231  Moyasar fees…        Open ▸ (was: –)   ● 3 new   [Decide]    │
│    backend agent opened · accountant asked · +2 comments · 11:00        │
│ ━━ tide ──────────────────────────── sweep ▾ (mark all seen, Space) ━━  │
│ ━━ SINCE YOU LEFT · 12 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ ⇄ GTV-244  Breaking change…     Pending ▸ Acknowledged   ● 1 new        │
│    frontend acknowledged · 09:40                                         │
│ ━━ EARLIER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │

PHONE
┌────────────────────────────┐
│ ☀ brief (3 lines) ▾        │
│ NOW · 4                    │
│ ┌ ⚖ GTV-231   ● Open ────┐ │
│ │ Moyasar fees…  (3 new) │ │
│ │ [ Decide ]  swipe ← read│ │  swipe = mark thread seen (RTL: swipe →)
│ └────────────────────────┘ │
│ ── tide · sweep ▾ ──       │
│ SINCE YOU LEFT · 12 ...    │
└────────────────────────────┘
```

Saved views: bands are the views (NOW = Needs me, SINCE YOU LEFT = New, EARLIER = history), plus a header
toggle Threads | Activity. Activity is today's Timeline (event rows, spine, collapse "+n", all filters) kept for
auditing and "what exactly happened". Mentions and reminders are thread reasons (chips) and a filter chip, not a
tab. Inbox = Threads with Unread filter; Today = the header.

Row anatomy: §2.1 where the "what happened" line summarises the unread events of the thread ("opened,
2 comments, status changed"), and the status line shows `previous > current` when it changed since I last read.
Why chip(s) come from notifications attached to the thread.

System rows: card-less items are "system threads" keyed by kind and date (brief per day, reminder per card,
source problem per source): same row grammar, read/sweep behaviour is identical. Escalations are NOW threads
with a danger border.

Counters / brief / deadlines: band counts are the only counters; sidebar badge = NOW + SINCE YOU LEFT distinct
threads (one definition, one read state). Brief is the header (clamped). Deadlines raise a thread into NOW when
within 24 h and show as a chip on the row (no separate runway).

Real-time: a thread whose card changes rises to the top of its band with a layout animation (`framer-motion`
`layout`, 220 ms), its status line shows the transition (old struck through, new in tone), the unread dot count
increments. While scrolled, nothing moves: a pill "3 updated" appears (the existing stream rule). Sweep and
reduced motion: the tide line jumps instead of gliding, rows do not translate.

Perf: threads are fewer than events (a busy card is one row, not twenty), which helps density and DOM size; list
uses §2.5. The thread query is server-side, so no client merge.

What improves. One definition of awaiting and of new; counters cannot disagree because there is one read state;
the longest feeds (many commits on one card) collapse naturally; the best inbox-zero loop of the three
(sweep, Undo). Signature interaction gives the surface its own identity.

Risks / trade-offs.
- Largest change and the only one that needs new backend. If the backend slips, it cannot ship partially.
- Loses the pure time axis in the default view; members who read the Timeline as a story must switch to Activity.
  The spine/tide design that exists today moves to the secondary view.
- Per-thread read state is a product decision (opening a card marks the thread read; what about events I did not
  see in the sheet?). Needs rules and tests, like docs/07.
- Heavier migration for e-mail/Telegram digests that count events, not threads.
- The sweep is destructive-feeling; it must be undoable and clearly labelled (and never touch NOW items, which
  are cleared only by acting).

Extra backend (required): a per-user per-card read marker (e.g. `card_reads(user_id, card_id,
last_read_event_id)`), `GET /feed` returning thread rows (card header + latest event + unread count + reasons
joined from notifications + band), `POST /feed/seen` (sweep up to a marker), and `counters.attentionCards`.
SSE can stay as is (`card.event`, `inbox.new`, `counters`), the client patches thread rows.

Shared components changed when ported: new `ThreadRow`; `TimelineItem` becomes the Activity view only;
`InboxRow`, `AwaitingStack`, `SinceLastVisit`, `CountersBand` retired or reduced; sidebar and counters; `useSeenOnLeave`
and `markSeen` (the global watermark) replaced by the per-thread marker.

## 6. Side by side

| | A: Views over one stream | B: Shelf and river | C: Threads and tide |
| --- | --- | --- | --- |
| Layout principle | one time list, views as filters | act-now shelf above a time river | card-centric threads in horizon bands |
| Where "Needs me" lives | a view (tab) | always-on shelf | the NOW band |
| Where "New" lives | a view | the Unread lens + tide line | the SINCE YOU LEFT band |
| Inbox becomes | Needs me + New views | the Unread lens | Threads + Unread filter |
| Today becomes | one-line header | strip + shelf | header |
| One read state | no (hidden) | no (hidden), shelf removes the confusion | yes |
| Backend need | none (2 small recommended) | none (2 small recommended) | required: read marker, `/feed`, counters |
| Change vs today's Timeline | small | medium | large |
| Risk | merged pagination, two sort orders | shelf/river duplication, tall shelf | scope, product rules, loses time axis |
| Boldness | low | medium | high |
| Ported effort (relative) | 1x | 1.3x | 2.5x+ |

## 7. Recommendation

Build A first (`v2-timeline-views`) and carry two things from the others into it so it is not a dead end:
the row anatomy (§2.1) is written as a single `FeedRow` that C's thread row extends, and the "Needs me" view
is ranked like B's shelf. Reasons: it answers the owner's question with no required backend, it fixes the real
defects found (status/actions hidden on phone, three row shapes, three "awaiting" computations, no card-less
rows on the Timeline), and it is verifiable quickly against the existing API. C is the better long-term answer
to "one read state" and I would prototype its thread row as a second version only if the owner wants the
backend investment; the decision depends on whether per-thread read state is wanted as a product rule. B is the
best choice if Today users must feel nothing was removed.

Open questions for the owner:
1. Is a per-user per-card read marker acceptable as new backend (needed for C, strongly useful for A)?
2. Keep the global "since last visit" watermark, or replace it with per-card read? (Decides A vs C.)
3. Where do Team week and Source health live once Today is a header: a header menu tab, Settings, or kept
   as a separate small page?
4. Titles: add a short/Arabic title field on cards, or enforce short titles at creation? The row cannot fix a
   long English title by styling alone.
5. Should `/today` and `/inbox` stay as redirecting routes (recommended, keeps links working) or be removed?
6. Four fixed views, or user-defined saved filters? (Fixed is recommended; counts stay trustworthy.)
7. Are agents' automated events (commits, status noise) shown in "New", or only events that need a human?

## 8. What this round did not do

- No screenshots of the real pages (login refused: 401 with the credentials from `.env`). Findings about
  current behaviour are from source reading and have not been checked running; item 6 in
  `v1-baseline/components.md` (whether the status chip updates inside one second today) is explicitly unverified.
- No measurement of list size, scroll cost or refetch frequency; the performance section is a plan, not a
  result.
- No `research/references.md` exists for this page; the concepts draw on known patterns (Linear inbox,
  GitHub notifications) from general knowledge, not from collected references. Run `visual-researcher` if the
  owner wants sourced references before picking.
- Nothing built, no version folder created, no real project file modified.
