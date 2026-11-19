---
app: hub
page: timeline
route: /[locale]/[workspace]/timeline (absorbs /today and /inbox)
live-url: http://localhost:7300/ar/goteav/timeline
sources:
  - apps/web/src/app/[locale]/[ws]/timeline, today, inbox
  - apps/web/src/features/timeline, today, inbox
  - docs/09-pages.md §4 (today), §5 (timeline), §15 (inbox)
  - docs/07-notifications-and-digests.md (notification kinds, recipients)
status: brief
---

# Hub — Timeline as the one working surface (الخط الزمني)

## Purpose
Today, Inbox and Timeline show largely the same facts three ways. The owner asked whether the Timeline,
at its ideal design with actions and status, can be the base for all three. This page is that base:
one stream of what happened and what needs me, with the state of every card and the action to take it
right in the row.

## What the three pages do now (verified in docs/09 and the code)
- **Timeline**: card events (`CardEvent`) of the whole project, grouped by day, filters, collapse of one
  card's events within 30 min, live pill.
- **Inbox**: per-user `Notification` rows (routed items, mentions, watch updates, reminders, briefs),
  unread/read state, "awaiting me", mark all read. Delivery to e-mail/Telegram/push also starts here.
- **Today**: an aggregate: awaiting me, ready tasks for my roles, deadlines, sessions without a summary,
  "since last visit" (= Timeline with `from=lastSeenAt`), counters, brief/narrative.

## Problems
- "Awaiting me" is computed three times (a Today block, an Inbox tab, the Timeline `awaiting=me` filter).
- Two different "new" counters (Inbox unread, Today since last visit) that disagree.
- Rows look different on each page, and the status/action set differs per page.
- A card's current status is not the first thing a row says; titles are often long or English-only.

## Goals
- Timeline is the base. One row anatomy everywhere: who/what happened, the card's current status, its
  title (short, Arabic), age, and the inline action (decide / acknowledge / deliver / claim / approve).
- Saved views over the same stream: **Awaiting me · Since last visit (unread) · Mentioned/reminders · All**.
  Inbox becomes the Awaiting/Unread view; Today shrinks to a light header (brief, deadlines, ready tasks,
  counters) that links into views.
- One read state per user, one counter.
- Items that are not card events (morning brief, deadline reminder, escalation) appear as system rows.
- Real-time: a status change shows in the row and its status chip within a second, no page refresh.
- Fast and calm on a loaded machine: virtualised list, no refetch storms, 390/768/1440.

## Constraints
- RTL (Arabic default) + LTR, light + dark, 390 / 768 / 1440. Card keys, branches, paths stay LTR.
- Data: `GET /timeline` (events + card header + collapse group), `GET /inbox`, `GET /today`, `GET /counters`,
  SSE `card.event`, `inbox.new`, `counters` (docs/09 §3).
- No new backend concept is assumed in the design except a per-user read marker on events and system rows
  for non-card notifications; note any extra need explicitly.
- Version-local tokens in `tokens.css`, `@lab/ui`, `@lab/mocks` only. Never import app code.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | the three current pages (Today, Inbox, Timeline) side by side | reference |
