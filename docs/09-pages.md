# 09 — Pages

One section per route of `apps/web` (routes from `02-repo-structure.md`). Components are those of
`08-ux-and-design.md`. API paths are the vocabulary of `01`/`03`; **the exact shapes and query
parameters must match `04-api-reference.md`** — where this document names a parameter, doc 04 must
provide it (or the executor reconciles and records the change in `docs/status/`). All routes are
under `/[locale]/` (`ar` default); app routes are under `/[locale]/[workspace]/`. Wireframes are
LTR; Arabic mirrors them.

**Endpoint reconciliation (read first).** `04-api-reference.md` §3.23 is authoritative where this
document's paths differ; the mapping table there covers: sources enable/disable (→ `PATCH`),
`redesign/{key}/review` (→ `/readme`), push/telegram/test endpoints (→ `/me/...`), the Goteav
import (→ `/capture/import/goteav`), GitHub login mapping (→ `PUT …/github-logins`), the SSE path
(workspace-scoped), and the session-context endpoint (→ `GET /me/context`). The composite
`GET …/today`, `GET …/counters`, `GET …/docs/tree`, onboarding, system, audit CSV and member
disable/enable/password-reset-link endpoints are specified in §3.23.

Common conventions used below:

- Lists are cursor-paginated: `?cursor=<opaque>&limit=50`, response `meta.nextCursor`.
- Filters live in the URL as repeatable params (`types=task&types=need`) so links are shareable.
- `awaiting=me` means "cards whose `ownerRole` ∈ my roles and status is actionable".
- i18n keys are given as `ns.key`; English text shown is the `en` value.
- "Permission" names the role(s) or `any member`. Actor kind plays no part (D27): a member's Claude Code may do what the member may do.
- **First-release corrections (`15-first-release.md` wins):** the UI word for a workspace is Project, «مشروع» (D30); a Handoff is «إحالة», and «تسليم» is only a Need's delivery (D23); delete is «حذف», restored from «المحذوفات» (D28); Arabic is set in Cairo; no coloured side or top edge on any card or panel (D31); TOTP is optional unless a project requires it for a role (D34); Planning («التخطيط») is the first item under Work (15 §4).
- Acceptance criteria are Playwright/vitest-testable statements.

---

## 1. Auth

### 1.1 `/sign-in`

Purpose: email + password sign-in, optional TOTP step. Who: everyone.

```
┌──────────────────────────────────────────────┐
│               Hub ▣                          │
│   Sign in to Hub                             │
│   [ email                         ]          │
│   [ password                  👁 ]           │
│   [        Sign in          ]                │
│   Forgot password?            AR | EN        │
└──────────────────────────────────────────────┘
```

Phone: identical, full-width card, keyboard-safe.

- Data/API: `POST /api/v1/auth/sign-in {email, password}` → `{ requiresTotp: boolean, user? }`.
  If `requiresTotp`, route to `/totp`. On success → last workspace (`/[ws]/today`) or
  `/workspaces`.
- Errors: `hub.identity.invalid_credentials` → `auth.errors.invalid` ("Email or password is
  incorrect."); `hub.identity.locked` → `auth.errors.locked` ("Too many attempts. Try again in 15
  minutes."); `hub.identity.disabled` → `auth.errors.disabled`.
- Rate limit 10/min/IP (UI shows the locked message on 429 as well).
- No self sign-up link (invites only). Locale switch persists in cookie before login.
- Acceptance: wrong password shows inline error and keeps the email; 10 failures → locked message;
  successful login with TOTP enabled lands on `/totp`; `Enter` submits.
- After a password reset the page opens with `?reset=1` and confirms it in a `role="status"` line above the form.

### 1.2 `/totp`

Purpose: second factor for roles in `security.totp_required_roles` (and anyone who enabled it).

- `POST /api/v1/auth/totp/verify {code}`; 6-digit input auto-advances, paste supported;
  "Use a recovery code" toggles a text input (`POST …/totp/recover`).
- First-time setup (when the role requires TOTP but it is not enabled) is forced here:
  `POST /api/v1/auth/totp/setup` → `{otpauthUrl, secret}` rendered as QR (`qrcode.react`) +
  manual secret (mono, copy); `POST …/totp/confirm {code}` → shows 8 recovery codes once with
  download/copy; "I saved them" continues.
- A failed `totp/setup` shows the error with "Try again"; `totp_already_enabled` continues to the member's destination. Locked and disabled accounts read their own sentence on the verify step.
- Acceptance: wrong code → `auth.errors.totp_invalid`; setup flow cannot be skipped for a role the project requires it of (`security.totp_required_roles` defaults to none, D34).

### 1.3 `/invite/[token]`

Purpose: accept an invitation. `GET /api/v1/invites/{token}` → `{ workspaceName, email, roles,
invitedBy, expiresAt }`.

```
┌────────────────────────────────────────────────┐
│  You're invited to Goteav                       │
│  as [backend] [qa]  by Mohamed                  │
│  Email: name@company.com (fixed)                │
│  [ display name           ]                     │
│  [ password               ]  strength meter     │
│  [ confirm password       ]                     │
│  Language: (•) العربية  ( ) English             │
│  [ Create my account ]                          │
└────────────────────────────────────────────────┘
```

- `POST /api/v1/invites/{token}/accept {displayName, password, locale}` → signed in → if the roles
  require TOTP → `/totp` setup → else `/[ws]/onboarding`.
- Existing user with the same email: form shows "Sign in to join" instead (`POST …/accept` with an
  active session links the membership).
- Errors: expired (`hub.identity.invite_expired`) → "This invitation expired. Ask the owner for a
  new one."; used → `invite_used`.
- Acceptance: password < 10 chars rejected client-side; after accept, `GET /auth/me` lists the
  membership with the roles from the invite.

### 1.4 `/reset/[token]`

`GET /api/v1/auth/password/reset/{token}` validates; form new password ×2; `POST …/reset
{token, password}`; then sign-in. "Forgot password" on sign-in posts `POST …/password/forgot
{email}` and always shows "If the email exists, we sent a link" (email channel must be configured;
if not, the owner resets from Members).

---

## 2. `/workspaces`

Purpose: pick or create a workspace. Who: members of ≥ 2 workspaces, or users with none.

```
┌───────────────────────────────────────────────┐
│ Your workspaces                                │
│ ┌─────────────┐ ┌─────────────┐  [+ New]      │
│ │ Goteav  GTV │ │ Bitaqaty BTQ│  (owner/pm of │
│ │ owner, pm   │ │ frontend    │   any ws, or  │
│ │ 3 awaiting  │ │ 0 awaiting  │   first user) │
│ └─────────────┘ └─────────────┘               │
└───────────────────────────────────────────────┘
```

- `GET /api/v1/workspaces` → `[{slug, name, keyPrefix, myRoles, awaitingCount}]`.
- New workspace dialog: name, slug (auto, editable, validated unique), key prefix (3–4 uppercase,
  unique), timezone, default locale → `POST /api/v1/workspaces` → creator becomes `owner`.
- Users with exactly one workspace never see this page (redirect).
- Acceptance: duplicate slug → inline error; creating redirects to `/[slug]/settings/sources`.

---

## 3. App shell (`(app)/[workspace]/layout.tsx`)

- Loads `GET /api/v1/workspaces/{ws}` (workspace, my roles, settings subset) and
  `GET /api/v1/workspaces/{ws}/counters`; opens `EventSource` on
  `GET /api/v1/workspaces/{ws}/events/stream` (doc 01 §6 says `/api/v1/events/stream`; doc 04
  decides the final path — the shell reads it from the generated client).
- SSE message kinds: `card.event` `{cardId, cardKey, type, eventKind, at}`, `inbox.new` `{id}`,
  `counters` `{…}`. Handling: invalidate `['card', key]`, `['timeline']` (sets the "new events"
  pill instead of refetching while the user is scrolled), `['inbox']`, `['counters']`.
- 403 on the workspace → `ErrorState` "You are not a member of this workspace" with a link to
  `/workspaces`.
- A failed background refetch of `auth/me` keeps the page; `ErrorState` shows only when the first load fails with no data, and a 401 with no data goes to `sign-in?next=`.
- Breadcrumb: project name (link to Today) › page › the plan key from `?plan=` or the doc key from `?doc=` (mono); the page link returns to the list with its filters. "All projects" in the switcher and "Switch project" in the palette are hidden for a member of one project.
- Sidebar groups and the Me menu: `08-ux-and-design.md` §2. Every view has its own folder; an address that names none (`/[ws]/nope`) is "Not
  found" inside the shell (`[ws]/[view]`), and there is no placeholder page any more.
- Acceptance: switching workspace changes counters and URL; SSE reconnects with backoff
  (1 s → 30 s) and shows the "Reconnecting…" indicator after 5 s.

---

### The chat panel (docs/16 §7)

On every project page except the lab's own `gallery`: page, card sheet, grip, panel and a 52 px strip, side by side. A phone has no strip: a button in the header, and the panel and sheet are full screen. `Ctrl+/` closes and reopens. `F6` moves between page, sheet, panel and strip. A second skip link goes to the panel. The sheet is a plain region on every page, with no scrim and no Tab trap. See docs/16 "Panel as built".

## 4. `/[ws]/today`

Purpose: the member's start page: what waits for me, what is ready for my roles, what changed since
I last looked, deadlines, and my sessions without a summary. Who: every member; phone-first.

```
┌ Today · Tuesday 4 Nov ───────────────────────────────────────────── [Refresh] ┐
│ ┌ Narrative (only if saved) ──────────────────────────────────────────────┐   │
│ │ 🤖 Written by your agent at 08:41 · "Yesterday the backend changed …"   │   │
│ │ … markdown …                                        [Open in Claude ▸]  │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│ ┌ Awaiting me (4) ──────────────┐ ┌ Deadlines (2) ───────────────────────┐   │
│ │ ● decision GTV-231 …  Decide  │ │ ⏰ GTV-231 due in 3 h  (warning)     │   │
│ │ ● need GTV-240 …      Deliver │ │ ⏰ GTV-199 due tomorrow              │   │
│ │ ● handoff GTV-244 …   Ack     │ └──────────────────────────────────────┘   │
│ │ ● task GTV-250 (in review)    │ ┌ Sessions without summary (1) ────────┐   │
│ └───────────────────────────────┘ │ 🤖 yesterday 17:20 · feat/refunds · 4│   │
│ ┌ Ready for my roles (6) ───────┐ │   commits   "Run /hub:start to add"  │   │
│ │ P1 task GTV-248 …  [Claim]    │ └──────────────────────────────────────┘   │
│ │ P2 task GTV-245 …  [Claim]    │ ┌ Since your last visit (12) ──────────┐   │
│ │ … (max 10, "see all")         │ │ TimelineItem compact ×12 · see all   │   │
│ └───────────────────────────────┘ └──────────────────────────────────────┘   │
│ Counters strip: open decisions 3 · pending handoffs 2 · needs 1 · my tasks 2  │
└───────────────────────────────────────────────────────────────────────────────┘
```

Phone: single column in this order: narrative, awaiting me, deadlines, ready for my roles, no-summary
sessions, since last visit (first 5 + "see all").

- Data: `GET /api/v1/workspaces/{ws}/today` → `{ brief: {date, sections, narrative?,
  narrativeBy?, narrativeAt?}, awaitingMe: Card[], readyTasks: Card[], deadlines: Card[],
  noSummarySessions: SessionLog[], changesSince: {since, events: TimelineEvent[], total},
  counters }`. `sections` is the template brief from `briefs` (rendered server-side in the
  member's locale); if today's brief is not generated yet (before `digest.morning_time`) the API
  computes it on the fly and marks `generatedNow: true` (no "brief" card is created).
- Narrative block: shown only when `narrative` exists; header "Written by your agent at {time}"
  (`today.narrative.by`); "Open in Claude" renders a copyable `/hub:start` hint. It renders headings, lists, bold, code and safe links (a path inside Hub opens in place, a link with a scheme in a new tab); folded on a phone it is one `markdownExcerpt` paragraph clamped to three lines.
- Awaiting me: cards with `ownerRole ∈ myRoles` and actionable status (decision `open`, need
  `requested|in_progress`, handoff `pending`, task `in_review` where I am a `qa`/`pm`, redesign
  `review` for owner). Each row is a `TimelineItem` compact with the inline action; max 10 then
  "See all (n)" expands the list in place ("Show less" folds it back).
- No card shows twice (owner's decision, 2026-11-19): Do next leaves out what Awaiting me holds (it asks for 20 and keeps 5), and Ready
  leaves out what Do next shows while its header still counts them all and says how many sit above. A short line under each list says
  what it holds.
- Rows of Awaiting me and Ready come from their lists once those answer, and from `awaitingMe` / `readyTasks` of `/today` until then or when they fail. Refresh refetches `/today`, both lists, the counters and the inbox count.
- Ready for my roles: tasks `status=ready` whose `specialty` maps to one of my roles
  (`backend→backend`, `frontend→frontend`, `design→designer`, `qa→qa`, `ops|docs→pm|backend`),
  sorted P0→P3 then oldest; `[Claim]` → `POST /cards/{key}/actions/claim` → optimistic status
  `claimed`, toast "Claimed GTV-248 — paste `/hub:next GTV-248` in Claude Code" with copy.
- Deadlines: decisions/needs/tasks with `dueAt` in the next 72 h routed to my roles or assigned to
  me; overdue first (`destructive-soft`), `< 24 h` warning.
- Sessions without summary (drawn only when there is one; an empty Deadlines block is a plain line, not an `EmptyState`): `session_logs` of mine with `hookReceivedAt` and no
  `summaryReceivedAt` in the last 7 days; row shows branch, commits, time, and the hint
  "Run `/hub:start` in Claude Code to write the summary" (`CopyButton`).
- Since last visit: events after `lastSeenAt`, excluding my own. Reading changes nothing: `POST /today/seen`
  moves it, which the page sends on leaving, and the Timeline on arrival (review M4), so the list and the
  sidebar's number agree while reading; grouped per repo, then per card: one entry and one keyboard stop per card with up to three
  events under it, then "n more events on this card"; "See all" → timeline
  with `from=<lastSeenAt>`.
- Actions: Claim (role), Decide/Deliver/Acknowledge open the sheet on the action, Refresh.
- Empty states: awaiting me → "Nothing waits for you. Enjoy." (`today.empty.awaiting`); ready →
  "No ready tasks for your roles. Check the backlog." with link; since last visit → "No changes
  since {time}."
- Role differences: `accountant` sees awaiting me (value checks, financial decisions), deadlines and
  since-last-visit; the "ready for my roles" block is hidden when no specialty maps to the member's
  roles; `owner` additionally sees "Redesign versions in review (n)" inside awaiting me.
- Shortcuts: `j/k` rows, `Enter` open, `c` claim, `r` refresh.
- Acceptance: with a decision routed to `accountant` and the user holding `accountant`, the row
  appears in Awaiting me with a `Decide` button; claiming a task removes it from "Ready" and the
  toast contains the `/hub:next` command; after loading Today twice, "since last visit" is empty the
  second time unless new events arrived; the narrative block is absent when no narrative is saved
  and present after `hub.save_brief` (seeded in test).

---

## 5. `/[ws]/timeline`

Purpose: the full event stream of the workspace with filters, day grouping, collapsing and live
updates. Who: everyone.

```
┌ Timeline ───────────────────────────────────────────────────────────── [+ New ▾] ┐
│ [All roles] [owner] [backend] [frontend] …   [All types] [task] [decision] …     │
│ Repo ▾  Module ▾  Member ▾  Date range ▾  (•) Awaiting me   ⟲ live               │
│                                ╭ 3 new events ↑ ╮                                │
│ ── Today ─────────────────────────────────────────────────────────────────────── │
│ ●  [decision] Moyasar fees: customer or platform?        accountant · P1         │
│ │  🤖 backend agent opened · 11:00 · due tomorrow 12:00 · blocks GTV-236         │
│ │  [Decide…] [Open]                                                              │
│ ●  [handoff] Breaking change: POST /admin/payments/{id}/refund   frontend ⚠      │
│ │  ⚙ oasdiff · 09:02 · backend → frontend · pending 4 h                          │
│ │  [Acknowledge] [Copy prompt] [Open]                                             │
│ ●  [change] feat/refunds · 4 commits                                    +3 ▾     │
│ │  👤 Sara · 08:40–09:50 · 12 files +240 −35                                      │
│ ── Yesterday ───────────────────────────────────────────────────────────────────  │
│ …                                                                                │
│ [Load older]                                                                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Phone: filters collapse into a "Filters (2)" button → bottom sheet; rows keep type badge, title,
one meta line; inline actions move into the sheet.

- Data: `GET /api/v1/workspaces/{ws}/timeline?from&to&types[]&roles[]&repos[]&modules[]&members[]&kinds[]&awaiting=me&archived=false&cursor&limit=50`
  → `TimelineEvent[]` (event + card header + collapse group id + `moreCount`). Server collapses
  consecutive events of one card within 30 min (`timeline.collapse_minutes`, constant) and returns
  `collapsed: [{kind, at, actor}]` for the "+n" expander. Newest first.
- URL params as above (`roles` filters `card.ownerRole`; `members` is the API's `actors`). Mine is `mine=1`,
  the API's `mine` (docs/04 §3.9 wins): events on cards I watch, own or claimed. A card waiting on me is marked on its newest row.
  `from`/`to` ISO dates in workspace timezone. Defaults: none (all).
- Day dividers: sticky, labels `common.day.today|yesterday|date`, with a calendar icon and a rule; each hour gets a mark on the rail.
- Rows: a full card only for an event that asks for action (the newest of its card with an action open to me or awaiting me, an
  escalation, a breaking handoff); every other event is one line, and the following events of the same card hang under it with no
  title (`08-ux-and-design.md` §5.2).
- Live: SSE `card.event` → if the list is scrolled to top and no filter excludes the event, prepend
  immediately (fade in); otherwise increment the pill "n new events"; click → prepend + scroll to top.
  `r` triggers the same.
- Row actions per type: `08-ux-and-design.md` §5.2. Clicking a row opens `CardSheet`
  (`?card=GTV-123` shallow).
- `+ New ▾`: task / decision / need / handoff → create dialog (shared `NewCardDialog`, §21).
- Deep link: `/timeline?card=GTV-231` opens the sheet over the unfiltered timeline positioned at
  the card's latest event.
- Empty: "No events match these filters." with "Clear filters"; workspace with no events: "The
  timeline fills up as soon as a source is connected or a card is created." + link to
  Settings › Sources (owner/pm).
- Role differences: none in visibility (all members see all events); actions follow permissions.
- Shortcuts: `j/k`, `Enter`, `r`, `c`/`a` on focused row, `f` focus filter bar.
- Acceptance: filter chips update the URL and the list; a new SSE event while scrolled down shows
  the pill with the right count and prepends on click; collapsing shows "+3" for 4 commits within
  30 min and expands to the 4 commit events; "Load older" appends with `nextCursor`; the sheet
  opens from `?card=` on direct navigation.

---

## 6. `/[ws]/tasks`

Purpose: find, claim and run tasks by specialty; board and list views. Who: engineers, designer, qa,
pm; owner for priorities.

```
┌ Tasks ───────────────── (•) Board ( ) List ─────────── [Mine] [Awaiting review] [+ New task] ┐
│ Specialty: [All] [backend] [frontend] [design] [qa] [ops] [docs]   Priority ▾  Module ▾  🔍    │
│ ┌ Backlog (14) ┐ ┌ Ready (6) ──┐ ┌ Claimed (3) ─┐ ┌ In progress (4) ┐ ┌ In review (2) ┐ ┌ Done (last 14 d) ┐
│ │ P2 GTV-245   │ │ P1 GTV-248  │ │ GTV-250 👤Ali│ │ GTV-241 👤Sara  │ │ GTV-239        │ │ GTV-230 ✓        │
│ │  backend · M │ │  frontend·S │ │  feat/x      │ │  feat/refunds   │ │  PR #112       │ │                  │
│ │  [Ready]     │ │  [Claim]    │ │  [Start]     │ │  [Submit review]│ │  [Review]      │ │                  │
│ └──────────────┘ └─────────────┘ └──────────────┘ └─────────────────┘ └────────────────┘ └──────────────────┘
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

List view: table (key, title, specialty, effort, priority, status, assignee, branch/PR, due,
updated) with column sort; same filters.

- Data: `GET /api/v1/workspaces/{ws}/cards?type=task&status[]&specialty[]&priority[]&module&assignee=me&q&sort=priority|updated|due&cursor`.
  Board columns load the first 50 per status and page per column.
- URL: `view=board|list|focus&specialty[]&status[]&priority[]&module&assignee=none|<memberId>&mine=1&q&sort&order`, plus the focus desk's `stage` and open `rails`. A third click on a column header returns to the default order. Under 80rem of main width the list hides "Branch or PR" and "Updated".
- In review: the row button is Review (`tasks` focus, board and list alike, when `complete` is open to me) and opens the sheet, where Mark done is
  the filled button beside Back to work; without the grant Mark done stays disabled with the role it needs.
- Focus desk: the only filled button is on the "Next for you" card. That card is what I hold, else the first Ready task in Do next order
  (`GET today/next`) that I can claim, with its reasons as pills (blocks n, next step in KEY, small); the stage queue follows the same order,
  and the board's order stands in while the answer is missing or failed. A member who does not review sees "Sent and waiting for review" in place of the review rail.
- Column moves by button only (no drag in v1; drag-and-drop is a later improvement — `@dnd-kit` is
  allowed but must keep the button path). Transitions: `backlog→ready` (owner/pm/creator),
  `ready→claimed` (`claim`, any member whose roles include the specialty's role, or pm), `claimed→
  in_progress` (`start`, claimer), `in_progress→in_review` (`submit_review`, claimer; PR URL
  optional), `in_review→done` (`complete`, pm/qa/owner or claimer if no qa role exists in the
  workspace), `in_review→in_progress` (`reopen`, reviewer with note), any→`cancelled` (owner/pm/
  creator with reason). Unclaim: claimer/pm.
- Card sheet `TaskSection` (§08 5.4): prompt block with `Copy prompt` and the hint
  "In Claude Code paste: `/hub:next GTV-248`" (`tasks.openInClaude`), rendered as a mono line with
  `CopyButton`. Acceptance checklist, branch binding (`PATCH /cards/{key}` with `branch` — also set
  automatically when a session log names the task key).
- Blocked badge when `blocked_by` links to open cards; column header shows "n blocked".
- `+ New task` dialog: title, specialty (required; prefilled only from a role that has one, never derived as `backend`), effort, priority, module, body, acceptance (markdown
  checklist), prompt (optional; pm can "Generate skeleton" → `POST /cards/{key}/actions/render_prompt`
  which fills the template from title/body/acceptance/linked docs), links, due.
- Empty: Ready column "No ready tasks for this specialty."; whole page "No tasks yet. Import the
  Goteav suggestions in Settings › Sources or create one." (owner/pm).
- Role differences: `Mine` default for engineers (`mine=1` preselected on first visit, remembered
  locally); `accountant` sees the page read-only; owner/pm see priority edit in place.
- Shortcuts: `c` claim, `n t` new, `v` toggle view.
- Acceptance: claiming from Ready moves the card to Claimed with my avatar and emits
  `claimed`; a member without the specialty role sees Claim disabled with tooltip; `Copy prompt`
  copies the prompt text; the list view sorts by priority with P0 first; cancelled tasks disappear
  from the board but show in list with `status=cancelled` filter.

---

## 7. `/[ws]/decisions`

Purpose: the decision room: everything waiting for a choice, sorted by deadline, with the
options compared and the outcome recorded. Who: owner, pm, accountant (deciders), everyone to read
and comment; phone-first.

```
┌ Decisions ─────────────────────────────────── [Open] [Decided] [All]  [+ New decision] ┐
│ Decider: [All] [owner] [pm] [accountant] [backend] [frontend]   Kind ▾   (•) Mine     │
│ ── Overdue (1) ───────────────────────────────────── neutral rule, danger word, icon ─  │
│ ⚠ GTV-199 Which Turkish gateway first?          owner · due 2 d ago · escalated to pm │
│ ── Due in 24 h (1) ──────────────────────────────── neutral rule, warning word, icon ──  │
│ ⏰ GTV-231 Moyasar fees: customer or platform?   accountant · due in 3 h · blocks 1   │
│ ── Later (3) ───────────────────────────────────────────────────────────────────────   │
│ ● GTV-236 Keep 8 checkout steps?                 owner · due Fri · 2 comments          │
│ …                                                                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
Sheet (DecisionSection):
┌ ▌ [decision] GTV-231  [open] P1                            [Decide…] [Withdraw] ⋯ ✕ ┐
│ Moyasar fees: customer or platform?                                                  │
│ accountant · opened by 🤖 backend agent (Ali) · due tomorrow 12:00 · reminders: 24h ✓ │
│ Question (body-lg) …                                                                 │
│ ┌ Option A: Customer pays ─────────┐ ┌ Option B: Platform absorbs ≤ 2 % ★ recommended┐│
│ │ + simpler accounting             │ │ + better conversion                           ││
│ │ − price shown changes by method  │ │ − margin −1.8 % on cards                      ││
│ │ cost: none                       │ │ cost: ~$140 / month at current volume         ││
│ └──────────────────────────────────┘ └───────────────────────────────────────────────┘│
│ Blocks: GTV-236 (task) · Related docs: 05-flights-and-payments §7                     │
│ ADR: not drafted · "Draft with /hub:adr GTV-231" [copy]                               │
│ Tabs: Details · Comments (2) · History (5)                                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
Decide dialog:
┌ Decide GTV-231 ───────────────────────────────────────┐
│ (•) Option A   ( ) Option B ★                          │
│ Rationale (required, ≥ 20 chars)                       │
│ [                                                   ]  │
│ ☑ Draft the ADR skeleton now (owner/pm can edit later) │
│ Target repo for ADR: [backend docs ▾]                  │
│                               [Cancel] [Record decision]│
└────────────────────────────────────────────────────────┘
```

- Data: `GET /api/v1/workspaces/{ws}/cards?type=decision&status[]=open&ownerRole[]&kind&mine=1&sort=due&cursor`;
  bands computed client-side from `dueAt` and `decision.escalatedAt`.
- Rows (owner's decision, 2026-11-19): every open decision shows its options as small read-only chips, the recommended one first with a star
  (and "recommended" for a screen reader), three at most then "and n more". Overdue is marked by tone alone (the time, the dot on the rail and
  the band's word); no red frame on the row or on the decision on the table.
- URL: `status=open|decided|all&decider[]&kind&mine=1`.
- Decide: `POST /cards/{key}/actions/decide {optionId, rationale, draftAdr: boolean,
  adrRepoSourceId?}` — role = `deciderRole` or `owner`, also through MCP (D27). Result: status `decided`,
  event `decided`, blocked cards get `unblocked`, ADR skeleton stored in `adrBody` with
  `adrStatus=drafted` when requested; the ADR PR is opened by `POST /cards/{key}/actions/open_adr_pr`
  (owner/pm) after the body is final (agents may fill it with `hub.draft_adr`). ADR block shows
  status chain `drafted → pr_opened → merged` with the PR link.
- Withdraw (creator/owner/pm, reason). Supersede: creating a new decision with link `supersedes`
  sets the old to `superseded` (action `supersede` on the old card from the new card's link menu).
- Escalation: when `escalatedAt` is set, the row shows "escalated to pm" and the `pm` role sees it
  in Awaiting me even if not the decider.
- New decision dialog: question (title), kind, body/context, options (min 2, each title/pros/cons/
  cost/recommended), decider role (default by kind: financial→accountant, product→owner,
  technical→creator's role lead → pm, design→owner), due (default `decisions.default_due_days`),
  blocks (card picker), related docs (doc picker).
- Empty: open → "No open decisions. When an agent or a teammate needs a choice they cannot make, it
  appears here."; decided → "No decisions recorded yet."
- Role differences: `Mine` default on for deciders; non-deciders see Decide disabled with tooltip
  "Only {role} can decide".
- Shortcuts: `d` opens Decide on focused row (when permitted).
- Acceptance: a decision past due renders in the Overdue band; decide dialog refuses an empty
  rationale; after deciding, the card shows the chosen option with "Chosen" and a `decided` event
  with the rationale; a blocked task linked via `blocks` receives an `unblocked` event; an agent
  token calling decide succeeds and its event records `via: mcp` (D27, API test); the ADR block shows the PR link
  after `open_adr_pr`.

---

## 8. `/[ws]/needs`

Purpose: the board of things required from outside the code (tokens, accounts, contracts, value
checks), by status and responsible role. Who: owner, accountant, pm (responsible), engineers
(requesters); phone-first (as a list).

```
┌ Needs ───────────────────────────────── Responsible: [All] [owner] [accountant] [pm]  [+ New need] ┐
│ Kind ▾   (•) Mine   [Show verified]                                                               │
│ ┌ Requested (3) ───────────┐ ┌ In progress (1) ───────┐ ┌ Delivered (2) ─────────┐ ┌ Verified (hidden) ┐
│ │ 🔑 GTV-240 Moyasar live  │ │ 📄 GTV-212 TÜRSAB doc  │ │ 🔑 GTV-205 PayTR test  │ │                   │
│ │  token · owner · blocks 2│ │  contract · owner      │ │  token · owner         │ │                   │
│ │  requested 2 d ago ⚠     │ │  [Deliver…]            │ │  1Password › Goteav    │ │                   │
│ │  [Start] [Deliver…]      │ │                        │ │  [Verify] (backend)    │ │                   │
│ └──────────────────────────┘ └────────────────────────┘ └────────────────────────┘ └───────────────────┘
│ Swimlane toggle: (•) by status  ( ) by responsible role                                            │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
Deliver dialog:
┌ Deliver GTV-240 ──────────────────────────────────────────────┐
│ Where is the value now? (never paste the value itself)        │
│ [ backend .env on prod, key MOYASAR_SECRET                  ] │
│ Note (optional) [                                           ] │
│ ⚠ "This text looks like it contains a secret (api_key)…"      │
│                                         [Cancel] [Mark delivered]│
└───────────────────────────────────────────────────────────────┘
```

- Data: `GET /api/v1/workspaces/{ws}/cards?type=need&status[]&ownerRole[]&needKind&mine=1&cursor`
  + `blocksCount` in the list projection (count of open cards with `blocked_by` this card).
- URL: `lane=status|role&responsible[]&kind&mine=1&verified=1`.
- Transitions: `requested→in_progress` (`start`, responsible role), `→delivered` (`deliver
  {location, note?}`, responsible role), `delivered→verified` (`verify {note?}`, the
  need's routed role, its requester, or whoever delivered it, who must write a note and is recorded as self-verified, D24), any→`cancelled` (creator/owner/pm with reason).
- Secret filter: the API answers `400 hub.security.secret_detected {pattern}` → dialog shows
  `SecretFilterError` under the field; the dialog does not close.
- Stale: `requested` older than `needs.stale_days` shows ⚠ and a reminder was sent (event).
- New need dialog: title, kind, responsible role (default by kind: token/account/access→owner,
  value_check→accountant, contract→owner, file→pm), body (what exactly, where it will be used),
  blocks (card picker), due.
- "Blocks n" badge opens a popover listing the blocked cards.
- Empty: "Nothing is needed from outside right now."
- Role differences: owner/accountant default `Mine`; engineers see Deliver disabled unless they hold
  the responsible role.
- Acceptance: deliver with a string matching a JWT pattern is rejected with the inline error and the
  need stays `in_progress`; deliver with a location succeeds, shows the location in the sheet and
  emits `delivered`; verify by the requester moves to Verified and the card leaves the board unless
  `verified=1`; the `blocks 2` badge lists two cards and those cards show the blocked badge.

---

## 9. `/[ws]/handoffs`

Purpose: what one team handed to another and whether it was received. Who: frontend/backend/
designer (receivers), pm (overview).

```
┌ Handoffs ───────────────── To: [All] [frontend] [backend] [designer]  Status: [Pending] [Acknowledged] [Applied] [All] ┐
│ Severity ▾  Kind ▾  (•) To my roles                                                                                   │
│ ⚠ breaking  GTV-244  Contract: 3 breaking, 5 changes in openapi.json      backend → frontend   pending 4 h   [Ack] [Copy prompt] │
│ ● notable   GTV-238  Shared component DataGrid density prop renamed       frontend → frontend  pending 2 d ⚠ │
│ ✓ applied   GTV-220  Contract: PricesDto.truncated added                  backend → frontend   applied by Sara → GTV-222 │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Sheet (HandoffSection): from → to · severity · pending age · summary · HandoffDiffList (breaking / non-breaking / schemas) ·
prompt block [Copy] · source change card · [Acknowledge] [Apply…] [Dismiss…]
```

- Data: `GET /api/v1/workspaces/{ws}/cards?type=handoff&status[]&toRole[]&severity&handoffKind&mine=1&sort=pending_age&cursor`.
- URL: `to[]&status[]&severity&kind&mine=1`.
- Transitions: `pending→acknowledged` (`acknowledge`, any holder of `toRole`, or owner and pm with their name shown, D25),
  `acknowledged→applied` (`apply {taskKey? | createTask: boolean, note?}`, holder of `toRole` only, D25), `pending|acknowledged→dismissed` (`dismiss {reason}`, holder of `toRole` or pm).
- "Apply…" with `createTask` creates a task (specialty from `toRole`, prompt = the handoff prompt,
  link `relates`) and sets `appliedTaskId`.
- Pending age > `handoffs.stale_hours` → ⚠ and the row sorts first; reminder event visible in
  history.
- Manual handoff dialog: to role, kind, severity, summary, prompt (optional), files/endpoints list,
  link to change card.
- Empty: "No handoffs to your roles. When the API contract or a shared component changes, the
  handoff appears here with a ready prompt."
- Acceptance: an `oasdiff` fixture with one breaking change produces a row with `breaking` badge,
  the diff list groups it under Breaking, `Copy prompt` copies text containing `pnpm api:sync`;
  acknowledge and dismiss via an agent token succeed for a member who may do them (D27).

---

## 10. `/[ws]/redesign`

Purpose: the gallery of lab pages and versions with the owner's decisions. Who: owner (decides),
designer/frontend (work), everyone (view). Desktop-first.

```
┌ Redesign ───────────────────────────────── App: [All] [web] [dashboard]   Status: [review] [draft] [approved] [all]  [Open lab ↗] ┐
│ ┌ web / wallet ─────────────────────── brief: researching · live: /ar/account/wallet ───────────────────────────────────────────┐ │
│ │ [v1-baseline ref] [v2-flight-path review 86] [v3-departure-board draft] [v4-twin-tanks draft] … [v7-twin-tanks review 81]       │ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐                                                                                    │ │
│ │ │ shot       │ │ shot       │ │ shot       │   click → sheet · [Compare] selects two                                            │ │
│ │ └────────────┘ └────────────┘ └────────────┘                                                                                    │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ dashboard / finance-currencies ──────── v2-rich-table-panel ported ✓ ─────────────────────────────────────────────────────────┐ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Sheet (RedesignSection): status · score · summary · touches-components · screenshots · [Open in lab ↗] [Compare]
[Approve…] [Request changes…] [Reject…] (owner)   [Mark ported…] (frontend/pm)   Port task: GTV-260 (chip)
```

- Data: `GET /api/v1/workspaces/{ws}/redesign/pages?app&status` → `[{app, page, brief:
  {status, route, liveUrl}, versions: Card[] (redesign)}]`; version cards also come from
  `/cards?type=redesign`.
- URL: `app&status[]&page`.
- Actions (`POST /cards/{key}/actions/…`): `approve {note?}`, `reject {note}`, `request_changes
  {note}` — **owner**, through the web or MCP (D27); `mark_ported {ref}` — `frontend`/`pm`/`owner`. Each writes the lab
  front-matter (`10-lab-integration.md` §6) and emits the event; approve also creates the port task
  (specialty `lab.port_task_specialty`) and links it.
- Gallery (`/[ws]/gallery`): the frame follows Hub's language and theme; `lang` and `theme` go into the address only when the member picks
  values that differ from Hub's. The gallery's own chrome stays dark and in English.
- Compare: `RedesignCompare` dialog with two version selects (default: base vs this), device/lang/
  theme toggles (lab frame URL contract `?w=&lang=&theme=&notes=`).
- Review score from `review.md` (`reviewScore`), "Open review" opens the markdown in `DocViewer`
  (served from `/lab/<path>/review.md` through the API `GET /redesign/{key}/review`).
- Empty: "No lab pages yet. Create a page brief in `apps/lab` (see the redesign-workflow skill)."
- Role differences: non-owners see approve/reject disabled with tooltip "Owner decides"; owner sees
  a "Versions in review (n)" filter preselected, only once the lab has loaded and a version is in review. An empty review filter shows "No versions waiting for you" with "Show all versions".
- Acceptance: approving a `review` version changes its badge to `approved`, creates a task whose
  prompt contains the version path and the touches-components list, and the lab README on disk has
  `status: approved` (e2e with a temp lab fixture); reject requires a note; compare dialog loads two
  iframes with the chosen `w/lang/theme` params.

---

## 11. `/[ws]/docs`

Purpose: read the project's documentation from Git in one place. Who: everyone.

```
┌ Docs ─────────────────────────────────────────────────────────────────── 🔍 search docs ┐
│ ┌ Tree (280) ───────────┐ ┌ Viewer ───────────────────────────────────────────────────┐ │
│ │ ▾ backend docs        │ │ docs/21-confirmation-safety.md  [copy] [GitHub ↗]  adr? no │ │
│ │   00-decisions        │ │ updated 2 d ago · commit 676b609 · en · 2 310 words        │ │
│ │   01-architecture     │ │ ┌ outline ┐  # 21 — Confirmation safety                     │ │
│ │   …                   │ │ │ 1 …     │  … rendered markdown …                           │ │
│ │   ▸ adr (14)          │ │ │ 2 …     │                                                   │ │
│ │   ▸ status (13)       │ │ └─────────┘  Referenced by: GTV-231, GTV-199                 │ │
│ │ ▾ dashboard docs      │ │                                                              │ │
│ │ ▾ hub docs            │ │                                                              │ │
│ └───────────────────────┘ └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

Phone: tree as a list page; viewer full screen.

- Data: `GET /api/v1/workspaces/{ws}/docs/tree` → sources → folders → docs (`{key, path, title,
  kind, lang, updatedAt}`); `GET /api/v1/workspaces/{ws}/docs/{key}` → doc card + `content`
  (markdown, read from the clone at `lastCommitSha`) + `referencedBy`.
- Route for a doc: `/docs/[key]` (card key), also reachable as `/cards/[key]`.
- Search box → `/ask?scope=docs&q=`. Above the tree a local filter by name or path keeps the matching docs with their folders open; `Esc` clears it.
- Viewer: `DocViewer` (§08 5.4); relative links between docs resolve to Hub doc routes when the
  target is indexed, otherwise to GitHub. Images are not loaded: an inline placeholder (dashed frame, icon, alt text) with "Open the image" for an `https` source.
- A 404 (or a code ending in `not_found`) shows "No such document"; any other error is an `ErrorState` with Retry.
- A doc that is a step of the member's onboarding path shows "Step N of your path" with "Mark as read", then the next step.
- `.ar.md` twins: a language toggle on the viewer when both exist (`path` without suffix matched).
- Stale badge when the source commit moved but indexing has not run yet (`doc.status=stale`).
- Empty: "No docs indexed. Add a docs folder source in Settings." (owner/pm).
- Acceptance: tree lists the three Goteav sources after import; opening an ADR shows kind `adr`;
  a doc referenced by a decision shows it under "Referenced by"; `copy path` copies the repo path.

---

## 12. `/[ws]/ask`

Purpose: full-text search across docs and cards with excerpts (no generation), plus the hint to ask
the member's own Claude Code. Who: everyone.

```
┌ Ask the project ───────────────────────────────────────────────────────────────┐
│ [ how are refunds settled to the wallet?                          ] [Search]  │
│ Scope: (•) All ( ) Docs ( ) Cards       🤖 In Claude Code: /hub:ask how are … [copy] │
│ ── Docs (3) ─────────────────────────────────────────────────────────────────── │
│ 21-confirmation-safety.md › §4 Refund destination                               │
│   "…the customer chooses the **refund** destination; **wallet** is default…"   │
│ 18-post-booking-services-admin.md › §2.3                                        │
│ ── Cards (2) ────────────────────────────────────────────────────────────────── │
│ [decision] GTV-231 Moyasar fees …  decided · "…platform absorbs…"               │
│ [need] GTV-205 PayTR test token … verified                                      │
└────────────────────────────────────────────────────────────────────────────────┘
```

- Named Search («البحث») in the sidebar, the breadcrumb and the tab; the page title is "Search the project" («البحث في المشروع»).
- Data: `GET /api/v1/workspaces/{ws}/search?q&scope=all|docs|cards&limit=20` → `{ docs:
  [{docKey, path, title, hits: [{heading, anchor, excerptHtml}]}], cards: [{card, excerptHtml}] }`;
  `excerptHtml` from `ts_headline` with `<mark>` only (sanitised).
- URL: `q&scope`. Enter searches; results group as above; clicking a doc hit opens the viewer at
  the anchor; a card hit opens the sheet.
- The Claude hint renders `/hub:ask <question>` with `CopyButton` (`ask.claudeHint`).
- Excerpts are plain text (no Markdown marks) around the `<mark>`; a doc hit takes its direction from the doc's language. A one-letter query says "Type at least two letters"; a search error shows in the results column and keeps the form. Under `lg`, with a query, the Claude panel comes after the results.
- Empty query: recent searches (local) and "Try: refund, TOTP, Duffel balance". No results: "Nothing
  matched. Try fewer words or Arabic/English spelling." (trigram fallback already applied server-side).
- Acceptance: searching an Arabic phrase present in a doc returns the doc with a marked excerpt; a
  card key typed (`GTV-231`) returns that card first; the hint copies the command with the query.

---

## 13. `/[ws]/onboarding`

Purpose: a role-based reading path and checklist for a new member. Who: new members; hidden from the
sidebar once completed (reopenable from the profile menu).

```
┌ Welcome to Goteav, Sara ───────────────────────────────────────────── 3 / 9 done ┐
│ Your roles: [frontend]                                                           │
│ 1 ☑ Read "What Goteav is" (docs/README.md)                                       │
│ 2 ☑ Read 01-architecture §3 context map                                          │
│ 3 ☐ Read dashboard docs/api-integration/README.md                        [Open]  │
│ 4 ☐ Install the Hub team pack (Settings › Tokens shows the command)      [Open]  │
│ 5 ☐ Run /hub:start once in Claude Code (auto-checks when a session log arrives)  │
│ 6 ☐ Claim your first task                                                 [Tasks] │
│ …                                                                                │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Named Getting started («دليل البدء»). The sidebar item shows only while `/counters` reports steps left, or while the member is on the page;
  the Me menu and the palette always hold it.
- Data: `GET /api/v1/workspaces/{ws}/onboarding` → `{ items: [{id, kind: doc|action|auto, title,
  docKey?, href?, done}], progress }`. Items come from workspace setting
  `onboarding.paths` (`{ [role]: [{ docPath | action }] }`, editable in Settings › General; **this
  setting is an addition to `03-data-model.md` §4.2**) merged for the member's roles, plus the fixed
  actions (install pack, first session, first claim) auto-completed by events.
- `POST /api/v1/workspaces/{ws}/onboarding/{itemId}/done` (and undo).
- Empty (no paths configured): "The owner has not set a reading path for {role} yet. Start with the
  docs." + link.
- Acceptance: a member with roles `frontend,qa` sees the union of both paths without duplicates;
  receiving a session log for the member marks item 5 done automatically.

---

## 14. `/[ws]/cards/[key]`

Purpose: full-page card (deep links, phones, printing). Renders `CardSheet` content inline with a
breadcrumb; same actions. `GET /api/v1/workspaces/{ws}/cards/{key}` (card + detail + links +
watchers + counts), `GET …/cards/{key}/events?cursor`, `GET/POST …/cards/{key}/comments`,
`POST/DELETE …/cards/{key}/links`, `POST …/cards/{key}/actions/{action}`,
`PATCH …/cards/{key}`.

- As built, `/[ws]/cards/[key]` (the link the API writes, e.g. in an ADR) redirects to `today?card=KEY` (upper case) and the sheet opens there; an invalid key is a 404 inside the shell.
- Unknown key → 404 `ErrorState` (neutral `notFound` kind) "No card GTV-999 in this workspace".
- Deleted card → banner "Deleted by {actor} {time}" + Restore (owner, pm or its creator, D28).
- Comments: markdown composer with `@` member autocomplete (`GET /members?q=`) and `GTV-`
  autocomplete (`GET /search?scope=cards&q=`); mention creates a `mention` inbox item; `Ctrl+Enter`
  sends; a comment by an agent token is labelled "(agent)".
- History tab: every event with `data` rendered as "field: from → to" rows (from `data.changes`; long text reads "edited", a member id reads as the name). History and comments read up to 1000 items.
- Links tab: any key may be added and the API refuses a wrong one; each link has a remove button, except `child` (removed from the parent card).
- Acceptance: direct navigation renders the card server-side (title in `<title>`); adding a
  `blocks` link to another card shows "blocked by" on the other card; archive hides the card from
  lists and shows the banner here.

---

## 15. `/[ws]/inbox`

Purpose: everything addressed to me (routed, mentions, watch updates, reminders, briefs). Who:
everyone; phone-first.

```
┌ Inbox ─────────────────────────── [Unread (4)] [All] [Awaiting me]  Kind ▾   [Mark all read] ┐
│ ● ⚖ Decision routed to accountant · GTV-231 Moyasar fees…        11:02   [Decide]         │
│ ● ⇄ Handoff to frontend · GTV-244 Breaking change…  +1 more        09:02   [Acknowledge]    │
│ ● @ Ali mentioned you · GTV-238 "…can you check the density…"      yesterday               │
│   ⏰ Reminder · GTV-199 due in 24 h                                yesterday               │
│   ☀ Morning brief · 4 Nov                                         07:30   [Open Today]     │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Data: `GET /api/v1/workspaces/{ws}/inbox?unread=1&kind[]&awaiting=me&cursor` → `Notification[]`
  grouped by `groupKey` within 30 min (`moreCount`); `POST /inbox/{id}/read`, `POST /inbox/read-all`,
  `POST /inbox/{id}/archive`.
- URL: `show=all` (Unread is the default, review M9), `kind` (one of six families of kinds), `awaiting=me`, `archived=1`.
- Opening an item marks it read and opens the card sheet on the quick action. An item with no card names the page it opens ("Open Settings", "Open Today").
- Live: SSE `inbox.new` prepends with a fade; the sidebar badge updates.
- Empty: unread → "You're all caught up." ; all → "Notifications appear here when something is
  routed to your roles, you are mentioned, or a card you watch changes."
- Shortcuts: `j/k`, `Enter`, `e` mark read, `Shift+E` mark all.
- Acceptance: a decision routed to one of my roles creates an unread item with a Decide action;
  `Mark all read` clears the badge; archived items are not listed under All unless `archived=1`.

---

## 16. `/[ws]/releases`

Purpose: planned and shipped releases with per-audience notes. Who: pm/owner (write), everyone.

- List: `GET /cards?type=release&sort=released_desc`; rows: version, repo/tag, status, included
  count, released date.
- New release (pm/owner): version, repo (free text with suggestions from the project's own repos; not sent when empty), tag (optional), include cards (picker filtered to `done`
  tasks, `applied` handoffs, `decided` decisions, `ported` redesigns since the last release) →
  `POST /cards {type: release, …}`; "Regenerate skeleton" → `POST /cards/{key}/actions/render_notes`
  (digest template per audience); "Mark released" → `release {releasedAt, tag?}`.
- Sheet `ReleaseSection` with notes tabs (team / owner / accountant) and `CopyButton`; agents may
  polish via `hub.update_card` (visible author chip changes to agent).
- Empty: "No releases yet. Create one when a batch goes to production."
- Acceptance: creating a release with 3 included cards renders a skeleton that lists them grouped
  by type in each audience tab; marking released sets the date and emits `status_changed`.

---

## 17. `/[ws]/members`

Purpose: who is in the workspace, their roles, GitHub identity, invitations. Who: owner/pm
(manage), everyone (view names and roles).

```
┌ Members (7) ──────────────────────────────────────────────────── [Invite member] ┐
│ Name            Email               Roles                GitHub      Last seen  ⋯ │
│ Mohamed (you)   m@…                 owner pm accountant  mohmed…     now          │
│ Sara            s@…                 frontend             sara-dev    2 h ago     ⋯ │
│ Ali             a@…                 backend              —           yesterday   ⋯ │
│ ── Pending invites (1) ─────────────────────────────────────────────────────────── │
│ q@…  qa  sent 2 d ago by Mohamed  [Copy link] [Resend] [Revoke]                     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Data: `GET /api/v1/workspaces/{ws}/members` (`{user, roles, githubLogin, lastSeenAt, status}`),
  `GET …/invites`.
- Actions (owner/pm): `POST …/invites {email, roles[]}` → dialog shows the invite link once
  with copy (email sent too when configured); `PATCH …/members/{id} {roles[]}` (cannot remove the
  last `owner`; owner-role changes are owner-only); `PATCH …/members/{id} {githubLogin}` (maps
  commits to the member); `POST …/members/{id}/disable` / `enable`; "Reset password link" →
  `POST …/members/{id}/password-reset-link` (shown once); "Revoke all sessions & tokens".
- Row `⋯` menu for the above; the current user's own row and its "My profile" item go to Settings › Account (owner's decision, 2026-11-19);
  no dialog opens, and the old `?profile=me` redirects there on the server.
- Acceptance: inviting shows a link that opens `/invite/[token]` with the roles; removing `owner`
  from the only owner is refused with `hub.workspaces.last_owner`; setting `githubLogin` makes the
  next GitHub capture attribute commits to the member (worker test).

---

## 18. Settings (`/[ws]/settings/*`) — owner/pm only (403 page otherwise)

Tabs across the top: General · Sources · Roles · Notifications · Tokens · System · Audit.

As built, the tabs come in three labelled groups: Mine («إعداداتي»: Account, Appearance, Tokens, Devices, Queue), Project (General, Sources, Roles, Audit) and This server (System, Backups); a group with no visible tab is not drawn. A member who is not owner/pm lands on Account, as does "Go to my settings". Account holds the profile (display name, language), the password,
two-step sign-in and the notifications, with a bar at the foot (Undo changes, Save) once something changed. The drafts of General, Backups and
Account's name and language live for the visit across tab and page changes: a dot marks the tab and a toast says the edits are kept, in place of a confirm dialog. The token commands and the palette's MCP command take the URL from the API. Roles shows a skeleton while members load, a retry line if they fail, and a link to Members.

### 18.1 `general`

Workspace name, slug (read-only after creation), key prefix (read-only), timezone (select),
default locale, decision defaults (`decisions.*`), handoff/need staleness, digest times, quiet hours,
onboarding reading paths editor (per role: ordered list of doc picker + action items), archive
workspace (owner, confirmation by typing the slug). `GET/PATCH /api/v1/workspaces/{ws}/settings`
(flat key/value map validated per key). Acceptance: changing `digest.morning_time` reschedules the
job (worker test); invalid time string → inline error.

### 18.2 `sources`

```
┌ Sources ───────────────────────────────────────────────── [Add source ▾] (github repo · openapi · lab · docs folder) ┐
│ Name       Kind         Config                         Last run        Status           Actions                      │
│ backend    github_repo  mohmedofficial515/Goteav-backend  2 min ago    ✓ ok (12 new)   [Run now] [Test] [Edit] [Disable]│
│ backend-oas openapi     backend · openapi/openapi.json    2 min ago    ✓ ok            [Run now] [Edit]               │
│ lab        lab          apps/lab · web,dashboard          1 min ago    ✓ ok            [Run now] [Edit]               │
│ backend docs docs_folder backend · docs/**                5 min ago    ⚠ 1 parse error [Run now] [Edit] [View runs]   │
│ ── Import Goteav history (one-time) ─────────── [Import map YAML + status + contract-changes…] last: 2026-11-10 ✓      │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- `GET/POST/PATCH /api/v1/workspaces/{ws}/sources`, `POST …/sources/{id}/test` (GitHub: token
  scopes + repo reachable; lab: folder exists + versions count; docs: files matched),
  `POST …/sources/{id}/run` (enqueue now), `GET …/sources/{id}/runs` (last 50 `CaptureRun`),
  `POST …/sources/{id}/disable|enable`.
- Add GitHub repo dialog: owner/repo, default branch, app label, token (password field, stored
  encrypted, never shown again; "Replace token" later), branch patterns. Add openapi: pick the repo
  source, path, from/to roles. Add docs folder: repo source, path, include/exclude globs, kind
  rules. Lab: root path (read-only on the host), apps.
- Import block: `POST /api/v1/workspaces/{ws}/import/goteav` with the clone path of
  `Goteav-backend` (fixed per `06-capture-adapters.md`); shows a result summary (decisions,
  suggestions→tasks, status notes, contract changes imported/skipped).
- Acceptance: Test on a wrong token shows the GitHub error message; Run now creates a `CaptureRun`
  visible in View runs; disabling a source stops its repeatable job (worker test).

### 18.3 `roles`

Read-only catalogue of the seven roles with their labels and what each may do (matrix from doc 04
§2), plus which members hold each role; "Specialty → role" mapping editor for tasks (default
mapping in §6). `GET /api/v1/workspaces/{ws}/roles`.

### 18.4 `notifications` (every member, not only owner/pm — the tab is visible to all)

As built, this is a section of the Account tab, not a tab of its own; `?tab=notifications` lands on Account.

Per channel (in-app always on; push, Telegram, email): mode off / immediate / digest; kinds
multi-select; quiet hours (workspace default shown, member override). Push: "Enable on this
browser" → service worker registration + `POST /api/v1/push/subscribe {subscription}`; lists this
browser's subscription with remove. Telegram: "Link Telegram" → `POST /api/v1/telegram/link-code`
→ shows `/start <code>` + bot `@…` link + QR; status "Linked as @name" with unlink. Email: shows
the address, test button (`POST /api/v1/notifications/test {channel}`). `GET/PUT
/api/v1/workspaces/{ws}/notification-preferences`. Acceptance: enabling push stores a subscription;
a test notification arrives on the chosen channel (fakes in e2e).

### 18.5 `tokens` (every member)

```
┌ Personal API tokens ───────────────────────────────────── [Create token] ┐
│ Name                  Kind  Prefix        Last used   Created    Actions  │
│ Claude Code — laptop  mcp   hub_a8f3…     5 min ago   2 d ago    [Revoke] │
│ hook — laptop         hook  hub_09c2…     yesterday   2 d ago    [Revoke] │
└──────────────────────────────────────────────────────────────────────────┘
Create → dialog: name, kind (mcp | hook) → result shown ONCE:
┌ Token created ──────────────────────────────────────────────────────────────┐
│ hub_a8f3k2…(full)   [Copy]                                                   │
│ Set it up in Claude Code (one command):                                      │
│ claude mcp add --transport http --scope user hub https://hub.goteav.lan/mcp  │
│   --header "Authorization: Bearer hub_a8f3k2…"                 [Copy]        │
│ Or install the team pack:  npx @hub/team-pack init --url https://hub.goteav.lan --token hub_a8f3k2…   [Copy] │
│ ⚠ You won't see this token again.                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- `GET/POST/DELETE /api/v1/workspaces/{ws}/tokens` (POST returns `{token}` once). The rendered
  commands use the workspace's public URL from `HUB_PUBLIC_URL`.
- Role preview: "This token can do what you can, by your roles in each project (D27). Never through a token: source secrets, your own tokens and profile."
- Acceptance: token appears in the list with its prefix; the full value is not retrievable later;
  revoking makes the next MCP call 401 (API test).

### 18.6 `system`

Health panel: API/worker version + uptime, Postgres/Redis OK, each source's lag (seconds since
`lastSuccessAt`, warning > 3 × interval), notification outbox backlog, SSE connections, last backup
time (from `infra/scripts/backup.sh` marker file read by the API), disk usage of `repos/` volume,
queue depths. `GET /api/v1/workspaces/{ws}/system` (owner/pm). Acceptance: a stopped worker shows
"worker heartbeat stale" within 60 s.

### 18.7 `audit`

Table of `audit_log` (`GET /api/v1/workspaces/{ws}/audit?actor&action&from&to&cursor`): time,
actor (chip), via, action, target (card chip when applicable), summary. Filters in URL. Export CSV
(`?format=csv`). Acceptance: deciding a decision writes an `cards.decide` row with the actor.

---

## 19. Shared dialogs

| Dialog | Where | Fields / behaviour |
| --- | --- | --- |
| `NewCardDialog` | `+ New` everywhere, `n` shortcuts | type tabs (task / decision / need / handoff); fields per §6–§9; "Create and open" (default) / "Create" (its toast carries "Open it"). Creator becomes watcher. A press outside a dialog with typed text does not close it (`Modal dirty`); `Esc`, × and Cancel still do. |
| `CardPicker` | links, blocks, include lists | search by key/title (`/search?scope=cards`), type filter, multi-select chips. |
| `DocPicker` | related docs, onboarding paths | tree + search; returns doc card keys. |
| `ConfirmDialog` | destructive/irreversible actions (reject, cancel, revoke, delete, dismiss, withdraw) | reason field when required; destructive button style. |
| `Lightbox` | screenshots | arrows, captions (file name), download. |

## 20. Page-level acceptance summary (critical e2e flows, Playwright, ar + en, light + dark)

1. Invite → accept → onboarding → Today shows the role's blocks.
2. Decision routed to `accountant`: Inbox item → Decide dialog → decided → ADR block → blocked task
   unblocked.
3. Need: create → deliver (secret rejected, then location accepted) → verify → leaves the board.
4. Handoff from an oasdiff fixture: appears with breaking badge → acknowledge → apply with task
   creation → task on the board with the prompt.
5. Redesign: version in review → compare dialog → approve → front-matter changed on disk + port task
   created + timeline event.
Plus: Timeline live pill (SSE), Tasks claim + `/hub:next` toast, Tokens create + command render,
Ask search with Arabic query. Each flow also runs `axe-core` with no serious/critical violations.
