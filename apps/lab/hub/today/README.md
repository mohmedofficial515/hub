---
app: hub
page: today
route: /[locale]/[workspace]/today
live-url:
sources:
  - F:/Goteav/project-hub/docs/09-pages.md §4 (page spec)
  - F:/Goteav/project-hub/docs/07-notifications-and-digests.md §6.1 (brief sections)
  - F:/Goteav/project-hub/docs/08-ux-and-design.md (tokens, components)
  - F:/Goteav/project-hub/docs/04-api-reference.md §3.23 (GET /today, /counters, /system)
status: designing
---

# Hub — Today (يومي)

## Purpose
The page every member opens first each morning. It answers, in this order: **what waits for me**,
**what is due**, **what I can pick up**, **what changed since I last looked**, and — added by the
owner — **how the team and the capture sources are doing this week**. Every member uses it; the
owner (who holds `owner` + `pm` + `accountant` today) uses it as the project's command view.

## Problems this page must solve (there is no current page — Hub is new)
- Updates travel orally; nobody sees in one place what changed overnight across backend, web,
  dashboard and the lab.
- Decisions and needs that block others are not visible to the person who must act, with their
  deadline.
- The team's rhythm (who is active, on what, with how many AI sessions) is invisible.
- Capture problems (a repo not polled, docs failing to index) would go unnoticed.

## Goals
- One strong focal point: the items awaiting me, with their inline action (Decide, Deliver,
  Verify, Acknowledge, Approve, Claim).
- Counters that read in one glance and link to their page.
- "Since your last visit" readable as a story, not a log.
- Team stats (this week vs last week, per-member activity, card flow by type) and source health,
  without turning the page into a BI dashboard.
- A colour system inspired by a **multicoloured living creature**: vivid and joyful, used
  deliberately (one colour per card type) so the page stays calm enough to read all day.

## Data (mock: `@lab/mocks/hub-today`)
`today` = persona **owner** (default). Scenarios: `frontend` (Sara's view: handoff + ready
frontend tasks, no admin cards), `empty` (quiet morning), `loading`.
Sections: narrative (agent-written, optional) · counters (9) · awaitingMe (6) · deadlines (4, one
overdue + escalated) · readyTasks (3, one blocked) · changesSince (10 of 27) · noSummarySessions (1)
· decided · blocked · releases · team (6 weekly totals with deltas, flow per type, 7 members with
14-day activity + current focus) · sources (6: ok / lagging / failing).

## Constraints
- RTL (Arabic default) + LTR (English), light + dark, 390 / 768 / 1440.
- Phone order (09 §4): narrative, awaiting me, deadlines, ready, no-summary sessions, since last visit; team and sources last.
- Card keys, branches, paths and numbers stay LTR (`.key` / `unicode-bidi: isolate`).
- WCAG AA text contrast in both themes; colour is never the only signal (icon + label too).
- Version-local tokens in `tokens.css` scoped to the version root.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | spec wireframe (09 §4), no real page yet | reference |
| v2-peacock-lanes | Night Peacock palette, dark-first; two lanes: "needs me" / "what happened"; team + sources band | review |
| v3-reef-letter | Reef & Sand palette, light-first; editorial morning letter + tide line. Stopped unfinished by the owner, kept | draft |
| v4-mandarin-bento | Mandarin Ink palette, bold editorial bento tiles. Stopped unfinished by the owner, kept | draft |
| v5-peacock-app | Night Peacock as the full app, the owner's chosen direction: grouped sidebar, header, card sheet, kit; all 14 sidebar pages; no coloured card edges. Approved by the owner 2026-11-05, being ported to `F:/Goteav/hub` | approved |
