# 07 — Notifications and digests

Who hears about what, through which channel, and the exact text Hub renders on its own. Hub
never calls a model (D06): every text here is a deterministic template filled from cards and
events, available in English and Arabic through `nestjs-i18n` keys
(`apps/api/src/i18n/{en,ar}/notifications.json`, `digests.json`, `adr.json`). English strings
below are the `en` catalogue; the executor writes the `ar` catalogue with the same keys (owner
reviews the Arabic). Code lives in `modules/notifications` and `modules/digests`.

## 1. Routing rules

A **notification** is created for a *user* when an event concerns them. Recipients are computed
in `NotificationRouter.route(event, card)` and deduplicated per user (one item per user per
event, highest-priority kind wins). The actor who caused the event never receives their own
notification.

| Trigger (event kind × card type) | Recipients | Notification `kind` | `data.action` |
| --- | --- | --- | --- |
| `created` decision | holders of `deciderRole`; `owner` (if not decider) | `routed_decision` | `decide` |
| `created` need | holders of `responsibleRole` | `routed_need` | `deliver` |
| `created` handoff | holders of `toRole` | `routed_handoff` | `acknowledge` |
| `created` task with status `ready` · `status_changed` → `ready` | holders of the specialty role (`backend`, `frontend`, `designer`, `qa`; `ops`/`docs` → `backend`+`frontend`) | `task_ready` | `claim` |
| `status_changed` task → `in_review` | holders of `qa`; watchers | `review_requested` (qa) / `watch_update` (watchers) | `review` |
| `status_changed` redesign → `review` (file or action) | holders of `owner`; `qa` | `routed_review` | `review` |
| `field_changed` `ownerRole` | holders of the new role | `routed_*` by type | as above |
| `commented` | mentioned users (`@user:<id>`), holders of mentioned roles (`@role:<r>`), watchers | `mention` (mentioned) / `watch_update` (watchers) | — |
| `decided` | watchers; creator; assignees of cards `blocked_by` this decision | `watch_update`; blocked → `unblocked` | — / `claim` |
| `delivered` need | creator (requester); holders of `owner` | `watch_update` with `data.action = 'verify'` | `verify` |
| `verified` need | creator; watchers; assignees of blocked cards | `watch_update`; `unblocked` | — |
| `acknowledged` / `applied` / `dismissed` handoff | creator; watchers | `watch_update` | — |
| `approved` / `rejected` / `changes_requested` redesign | creator; holders of `designer`; watchers | `watch_update` | — |
| `ported` redesign | holders of `owner`; watchers | `watch_update` | — |
| `done` task (`status_changed` → done) | watchers; assignees of blocked cards | `watch_update`; `unblocked` | — |
| `pr_merged` on a change linked to a task | watchers of the task | `watch_update` | — |
| `reminder_sent` (scheduler) | holders of the routed role; watchers (decisions only) | `deadline_reminder` | per type |
| `escalated` (scheduler) | holders of `pm` and `owner` | `escalation` | `decide` |
| `session_logged` with `hasSummary: false` | the session's member | `system` (`notifications.session_no_summary`) | — |
| `created` release / `status_changed` → released | all active members | `system` | — |
| member joined; API token created from a new device; invite created | holders of `owner`/`pm` (join); the user (token) | `system` | — |
| Brief stored (morning/weekly) | the member | `brief` | — |

Rules:
- `watch_update` is suppressed for `field_changed` on `tags`, `module`, `readme`, `content`,
  `facts`, `branches` and for `commit`/`watch` events.
- A user who is both a role holder and a watcher gets the routed kind only.
- Removed members receive nothing; `User.status = disabled` receives nothing.

## 2. Creation pipeline, grouping, dedupe

1. `CardService.apply` runs its registered hooks inside the **same transaction** as the card event
   (`modules/notifications` registers through `CardEventHooks`, so the dependency points one way). The hook routes the event and
   inserts `Notification` rows (title/body rendered in the recipient's locale — immutable) plus one
   `NotificationJob` per enabled channel of that recipient (§4 preferences decide `channel` set and
   `nextAttemptAt`). In-app needs no job: the row itself is the inbox item.
2. After commit, the API publishes `inbox.new` on Redis (`audience: { userIds }`) → SSE.
3. `groupKey = card:<cardId>`; the UI merges items with the same `groupKey` created within 30
   minutes into one row ("GTV-123 · 3 updates"). The server also **suppresses** a new
   `watch_update` for the same `(user, cardId)` when an unread `watch_update` for it exists from the
   last 30 minutes (the existing row's `data.count` is incremented and `createdAt` is not changed).
4. The outbox publisher (`notify` queue, job `outbox.publish`, every 10 s, batch 200) selects
   `NotificationJob` rows `status = pending AND nextAttemptAt <= now` with
   `FOR UPDATE SKIP LOCKED`, dispatches per channel (`push.send`, `telegram.send`, `email.send`),
   marks `sent`, or `failed` with exponential backoff (`attempts` 1→5: 1 min, 5 min, 30 min, 2 h,
   24 h; after 5 → `failed` terminal). `skipped` when the channel became unavailable (unsubscribed,
   unlinked, preference off) between creation and send.
5. Dedupe across devices: one job per channel per notification, not per subscription; the push
   sender fans out to all of the user's subscriptions.

## 3. Channels

### 3.1 In-app inbox

- `GET /inbox`, `/inbox/count`, read/read-all/archive (04 §3.17). Unread count also in the
  SSE `inbox.*` events and in the HTML `<title>` badge.
- Clicking an item marks it read and opens the card sheet with the `data.action` button focused
  (Decide / Acknowledge / Deliver / Claim / Verify / Review).
- "Awaiting me" counters (`awaitingMe`) are computed from cards, not notifications, so they stay
  correct even if items are archived.

### 3.2 Web push

- Env: `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT=mailto:<owner email>`
  (generated once by `pnpm --filter @hub/api push:keygen`). Library `web-push`.
- Service worker `apps/web/public/sw.js` (plain JS, no bundler): handles `push` (shows
  `self.registration.showNotification(title, { body, icon: '/icons/hub-192.png', badge, dir, lang,
  tag: groupKey, renotify: true, data: { url } })`) and `notificationclick` (focuses an open Hub tab
  and navigates to `data.url`, else opens it).
- Payload (≤ 2 KB): `{ title, body, url: "/<locale>/<ws>/cards/<key>?action=<action>", tag: groupKey, lang, dir }`.
- Subscription lifecycle: the web app asks for permission from the Settings › Notifications page
  or the first time the user opens Inbox (never on sign-in); `POST /me/push/subscriptions`;
  re-sent on `pushsubscriptionchange`. Send errors `404/410` → `PushSubscription.failedAt`, row
  deleted after 3 consecutive failures; other errors → job retry.
- Requires HTTPS with a trusted certificate — the team-pack installer trusts the Caddy CA
  (13-operations).

### 3.3 Telegram

- Library `grammY`, **long polling** in the worker (single instance; the API never polls). Env
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`. If unset, the channel is `available: false` and
  jobs for it are `skipped`.
- **Linking**: `POST /me/telegram/link-code` → `TelegramLinkCode { code, userId, expiresAt +10 min }`
  and a deep link `https://t.me/<bot>?start=<code>`. The bot handles `/start <code>`: valid →
  `TelegramLink { userId, chatId, username }` (replaces an older link for that user; a chat already
  linked to another user → `hub.notifications.telegram_already_linked` message), reply
  `telegram.linked`. Invalid/expired → `telegram.code_invalid`.
- Commands: `/inbox` (5 newest unread, with buttons), `/unlink`, `/help`. Everything else →
  `telegram.unknown_command`.
- Message template (MarkdownV2, escaped):
  ```
  *{kindLabel}* · {cardKey}
  {title}
  {body?}
  _{workspaceName} · {relativeTime}_
  ```
  Inline keyboard per `data.action`:
  - `acknowledge` → `[✅ Acknowledge] [🔗 Open]`
  - `deliver` → `[📦 Deliver] [🔗 Open]` — pressing asks "Reply with where you put it (never the value)"; the next text message within 10 min (state in Redis `tg:await:<chatId>`) becomes `location`; the secret filter rejects a likely secret with `telegram.secret_rejected` and the message is **not** stored.
  - `claim` → `[🙋 Claim] [🔗 Open]`
  - `decide`, `verify`, `review` → `[🔗 Open in Hub]` only (human-only actions stay in the web UI; the URL carries `?action=decide`).
  - everything else → `[🔗 Open]`.
- Callback data: `<action>:<notificationId>` (≤ 64 bytes). Handler: resolve user by `chatId`,
  notification → card; call the same application service as REST with
  `actor = { kind: 'user', via: 'telegram' }`; answer with `answerCallbackQuery` and edit the message
  to append `✓ done by you` or the error message. Idempotent: a repeated callback on an already
  acknowledged/claimed card answers `telegram.already_done` without error.
- Quiet hours (§4) delay sends; `escalation` and `deadline_reminder` for `P0` cards bypass them.

### 3.4 Email

- `MAIL_PROVIDER=smtp|resend`, `MAIL_FROM="Hub <hub@<domain>>"`, `SMTP_URL` or `RESEND_API_KEY`.
  Library `nodemailer` (SMTP) or `resend`. Unset → channel unavailable.
- **Immediate** emails (if the member's email mode is `immediate`): `routed_decision`,
  `deadline_reminder`, `escalation`, `routed_handoff` with `severity = breaking`, plus system mails
  independent of preferences: invite, password reset, new API token created, TOTP enabled/disabled.
- **Digest** mode (default): everything else is listed in the morning brief email at
  `digest.morning_time` (one email per member per day, only if there is at least one item or an
  awaiting action).
- Templates: Handlebars in `apps/api/src/modules/notifications/templates/{en,ar}/*.hbs`, inline
  CSS, table layout, `<html lang="ar" dir="rtl">` for Arabic, system font stack, no images except
  the icon; every card line links to the card URL; footer with "Manage notifications" link.
  Subjects: `notifications.email.subject.<kind>` e.g. `[Hub] Decision awaiting you: {{title}}`.

## 4. Preferences and quiet hours

- `ChannelPreference` per `(user, workspace, channel)`: `mode off | immediate | digest`, `kinds[]`
  (empty = all). Defaults: push `immediate`, telegram `immediate` (when linked), email `digest`.
  `available` is computed (subscription exists / link exists / provider configured).
- UI contract (Settings › Notifications): a table channel × mode, a multi-select of kinds per
  channel, "Test" button per channel (`POST /me/channels/{channel}/test` sends
  `notifications.test` — add to 04 if missing), quiet hours display (workspace setting, read-only
  for members).
- **Quiet hours** (`notifications.quiet_hours`, workspace local time): push/telegram jobs created
  inside the window get `nextAttemptAt = window end`; email immediate mails are not delayed.
  Exceptions: `escalation`, and `deadline_reminder` on `P0` cards.
- `digest` mode never sends per-event messages on that channel; the morning brief itself goes out
  on every channel whose mode is not `off` (push: one summary notification "Your brief is ready";
  telegram: the brief text; email: the brief email).

## 5. Scheduler — deadlines, reminders, escalation, stale items

Repeatable job `scheduler.tick` on queue `scheduler`, **every 5 minutes per workspace**
(`jobId: scheduler.tick:<workspaceId>`), idempotent by construction (every rule records what it
did on the card).

```sql
-- 5.1 decision reminders (per offset h in decisions.reminder_offsets_hours)
SELECT c.id FROM cards c JOIN decision_details d ON d.card_id = c.id
WHERE c.workspace_id = $ws AND c.type = 'decision' AND c.status = 'open' AND c.archived_at IS NULL
  AND c.due_at IS NOT NULL AND c.due_at - make_interval(hours => $h) <= now()
  AND NOT (d.reminders_sent @> to_jsonb(ARRAY[$h]));
-- for each: notification deadline_reminder (recipients §1), event reminder_sent {offsetHours, channels}, d.reminders_sent += h

-- 5.2 decision escalation
... WHERE c.status = 'open' AND c.due_at + make_interval(hours => $escalation_hours) <= now() AND d.escalated_at IS NULL;
-- for each: d.escalated_at = now(), d.escalated_to_role = 'pm'; event escalated {toRole:'pm', afterHours}; notification escalation to pm+owner.
-- Effect on permissions: after escalation, holders of escalated_to_role may `decide` in addition to the decider role (04 §2 row "decide" R includes escalatedToRole).

-- 5.3 stale handoffs (handoffs.stale_hours)
SELECT c.id FROM cards c JOIN handoff_details h ON h.card_id = c.id
WHERE c.type = 'handoff' AND c.status = 'pending' AND c.created_at + make_interval(hours => $stale) <= now()
  AND (h.payload->>'lastStaleReminderAt' IS NULL OR (h.payload->>'lastStaleReminderAt')::timestamptz + interval '24 hours' <= now());
-- for each: notification deadline_reminder {reason:'stale'} to toRole holders; event reminder_sent; payload.lastStaleReminderAt = now()

-- 5.4 stale needs (needs.stale_days) — same pattern on need_details with status in (requested, in_progress); reminder every 48 h; recipients responsibleRole holders + creator

-- 5.5 overdue flag — computed at read time (due_at < now and open); no job
-- 5.6 orphaned claims — tasks claimed > 14 days without any event: notification watch_update to assignee ("still working on it?"), event reminder_sent, once per 14 days
```

The digest jobs (`digest.morning` daily at `digest.morning_time`, `digest.weekly` at
`digest.weekly_day_time`, both in workspace timezone, registered per workspace with cron
expressions recomputed on setting change) run on the same queue.

## 6. Digests and templates

The templates below are written in Handlebars notation to show their shape. Those the card types own are typed functions in
their module, each with golden files in `apps/api/test/golden`, and hold their `ar` and `en` strings beside the code: `adr.template.ts`
(decisions), `task-prompt.template.ts` (tasks), `handoff-contract.template.ts` (handoffs), `port-task.template.ts` (redesign),
`release-notes.template.ts` (releases). A plain function needs no asset copying at build and fails the type check when a
field goes missing. Briefs and weekly summaries belong to `modules/digests`. Dates are formatted
in the workspace timezone; card references are rendered as `GTV-123 · title` with links in HTML
contexts and as plain `GTV-123` in Markdown for agents.

### 6.1 Morning brief (per member)

Stored as `Brief.sections` JSON (04 §3.19) and rendered to Markdown/HTML/Telegram text from the
same sections. Sections, in this order; a section is omitted when empty except `awaitingMe` and
`readyTasks` which show their empty-state line.

| # | key | content | limit | empty state key |
| --- | --- | --- | --- | --- |
| 1 | `awaitingMe` | cards routed to my roles that need my action: open decisions (by dueAt), needs `requested/in_progress` for my roles, needs `delivered` that I requested, handoffs `pending` for my roles, redesigns `review` (owner), tasks `in_review` (qa) | 10 per sub-list | `digests.brief.awaiting.empty` = "Nothing is waiting for you." |
| 2 | `deadlines` | decisions due within 48 h or overdue; escalated decisions; stale handoffs/needs for my roles | 10 | — |
| 3 | `changes` | since my last brief (or 24 h): per repo → commit groups (count, authors), PRs opened/merged, sessions logged by others (title + author), contract handoffs created | 15 | — |
| 4 | `decided` | decisions decided since last brief: chosen option + one-line rationale | 10 | — |
| 5 | `readyTasks` | ready, unblocked tasks for my specialties, priority then age | 5 | `digests.brief.ready.empty` = "No ready tasks for your specialty." |
| 6 | `mySessions` | my sessions flagged `noSummary` | 5 | — |
| 7 | `blocked` | my claimed tasks that are blocked, with the blocking card and its owner role | 5 | — |
| 8 | `releases` | releases released since last brief | 5 | — |

Template (`morning.md.hbs`, English catalogue values shown):

```
# {{t "digests.brief.title"}} — {{date}}            → "Your morning brief — Tue 4 Nov 2026"
{{#if narrative}}{{narrative}}

---
{{/if}}
## {{t "digests.brief.awaiting"}}                      → "Awaiting you"
{{#each awaitingMe.decisions}}- 🟠 {{t "digests.brief.decide"}} {{key}} · {{title}} — {{t "digests.brief.due"}} {{due}}{{/each}}
{{#each awaitingMe.needs}}- 🟣 {{t "digests.brief.need"}} {{key}} · {{title}} ({{kindLabel}}){{/each}}
{{#each awaitingMe.handoffs}}- 🔵 {{t "digests.brief.handoff"}} {{key}} · {{title}} — {{severityLabel}}, {{pendingHours}}h{{/each}}
{{#each awaitingMe.reviews}}- 🟤 {{t "digests.brief.review"}} {{key}} · {{title}}{{/each}}
{{#unless awaitingMe.any}}{{t "digests.brief.awaiting.empty"}}{{/unless}}

## {{t "digests.brief.deadlines"}}                     → "Deadlines"
{{#each deadlines}}- {{#if overdue}}⏰ {{t "digests.brief.overdue"}}{{else}}⏳{{/if}} {{key}} · {{title}} — {{due}}{{#if escalated}} ({{t "digests.brief.escalated"}}){{/if}}{{/each}}

## {{t "digests.brief.changes"}}                       → "What changed since your last brief"
{{#each changes.repos}}
**{{name}}** — {{commitCount}} {{t "digests.brief.commits"}} {{t "digests.brief.by"}} {{authors}}{{#if prs}}; {{t "digests.brief.prs"}}: {{#each prs}}#{{number}} {{state}} {{/each}}{{/if}}
{{#each sessions}}  - 🧠 {{author}}: {{title}}{{/each}}
{{#each handoffs}}  - 📨 {{key}} · {{title}}{{/each}}
{{/each}}

## {{t "digests.brief.decided"}}                       → "Decided"
{{#each decided}}- ✅ {{key}} · {{title}} → **{{option}}** — {{rationale}}{{/each}}

## {{t "digests.brief.ready"}}                         → "Ready for you"
{{#each readyTasks}}- [{{priority}}] {{key}} · {{title}} ({{effort}}){{/each}}
{{#unless readyTasks.length}}{{t "digests.brief.ready.empty"}}{{/unless}}

## {{t "digests.brief.mySessions"}}                    → "Your sessions without a summary"
{{#each mySessions}}- {{key}} · {{title}} — {{t "digests.brief.runDone"}}{{/each}}   → "run /hub:done to add it"

## {{t "digests.brief.blocked"}}                       → "Blocked"
{{#each blocked}}- {{key}} · {{title}} ⛔ {{blockerKey}} ({{blockerRole}}){{/each}}

## {{t "digests.brief.releases"}}                      → "Released"
{{#each releases}}- 🚀 {{version}} — {{title}}{{/each}}
```

Delivery: stored at `digest.morning_time`; SSE `brief.ready`; push summary
`digests.brief.push` = "Your brief is ready: {{awaitingCount}} awaiting, {{readyCount}} ready tasks";
Telegram text (sections 1, 2, 5 only, ≤ 3 500 chars); email with all sections.

### 6.2 Weekly summary (workspace, Sunday 08:00)

Sections (`weekly.md.hbs`): `counts` (events by card type and kind, commits, PRs merged, sessions
logged with/without summary) · `decided` (all decisions decided this week) · `released` · `merged`
(PRs) · `handoffs` (created / applied / still pending with age) · `needs` (delivered, verified,
still open) · `redesign` (approved, ported, in review) · `overdue` (open decisions past due, stale
handoffs) · `nextWeek` (deadlines in the next 7 days) · `topRepos` (commits per repo) ·
`contributors` (members by events, humans and their agents merged). Header:
`{{t "digests.weekly.title"}} — {{isoWeek}} ({{from}} → {{to}})`. Stored as `Brief { kind: 'weekly',
userId: null }`; `/hub:weekly` may add a narrative.

### 6.3 Release notes skeleton (per audience)

`POST /releases/{key}/generate-notes` fills only `null` audiences from `included` cards:

- `team` (`release.team.md.hbs`): grouped by type → `### Tasks done` (key · title · PR link),
  `### Handoffs applied`, `### Decisions`, `### Redesigns ported`, `### Pull requests merged`
  (from change cards), `### Needs verified`. Every line carries the key.
- `owner` (`release.owner.md.hbs`): plain language, no keys in headings: `### What is new`
  (tasks done with priority P0/P1 and redesigns ported, title only), `### Decisions taken`
  (title → chosen option), `### What still needs you` (open decisions/needs routed to owner).
- `accountant` (`release.accountant.md.hbs`): `### Financial decisions` (kind financial),
  `### Values verified` (needs of kind `value_check` verified), `### Payment / wallet / invoicing
  changes` (tasks done or handoffs applied whose `module` ∈ {payments, wallet, invoicing, pricing,
  loyalty} or tag `finance`), `### Pending verification` (needs `delivered` for accountant).
  Empty sections are omitted; an empty audience renders `{{t "digests.release.nothing"}}` =
  "Nothing in this release concerns this audience."

### 6.4 Session fallback summary (`session_fallback.md.hbs`)

```
{{t "digests.session.noSummary"}}                      → "This session has no summary yet. Facts from Git:"

**{{t "digests.session.branch"}}:** `{{branch}}` {{t "digests.session.in"}} {{repo}} · **{{t "digests.session.duration"}}:** {{durationHuman}}
**{{t "digests.session.commits"}} ({{commits.length}}):**
{{#each commits}}- `{{shortSha}}` {{subject}}{{/each}}
**{{t "digests.session.files"}} ({{files.length}}):** {{#each topFiles}}`{{path}}`{{#unless @last}}, {{/unless}}{{/each}}{{#if moreFiles}} +{{moreFiles}}{{/if}}

_{{t "digests.session.howToFix"}}_                     → "Run /hub:done in Claude Code, or /hub:start lists it, to add what changed and what remains."
```

### 6.5 ADR skeleton (`adr.md.hbs`, rendered on `decide`; matches `backend/docs/adr` format)

```
# ADR-{{number}}: {{title}}

- **Status:** Proposed (opened from Hub {{key}})
- **Date:** {{decidedDate}}
- **Deciders:** {{deciderRole}} ({{decidedBy}})
- **Hub card:** {{hubUrl}}

## Context

{{question}}

{{#if body}}{{bodyExcerpt}}{{/if}}

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
{{#each options}}| {{#if chosen}}**{{title}}** (chosen){{else}}{{title}}{{/if}} | {{pros}} | {{cons}} |
{{/each}}

## Decision

{{chosenTitle}}.

{{rationale}}

## Consequences

- {{t "adr.consequences.todo"}}                        → "To be completed by the decider's agent (/hub:adr {{key}}) before the PR is opened."
{{#each unblocked}}- Unblocks {{key}} · {{title}}{{/each}}
```

`number` = next free ADR number in the target repo's `docs/adr/` (`git ls-tree` of the default
branch, max + 1, zero-padded to 4) computed when the PR is opened; the path is
`docs/adr/<number>-<slug>.md` (slug from the English title if given, else transliteration-free
`hub-<key-lower>`). `/hub:adr` replaces this skeleton through `PUT /decisions/{key}/adr`.

### 6.6 Contract handoff summary and prompt (`handoff_contract.md.hbs`)

Summary (`HandoffDetail.summary`, ≤ 1 000 chars):

```
{{t "digests.contract.summary"}}: {{breaking}} breaking, {{notable}} notable, {{info}} informational changes in `{{path}}` on `{{branch}}` ({{shortFrom}}..{{shortTo}}).
{{#each breakingOps}}- ⛔ `{{method}} {{path}}`: {{text}}{{/each}}
{{#each notableOps}}- ⚠️ `{{method}} {{path}}`: {{text}}{{/each}}
{{#if schemaChanges}}- Schemas: {{schemaChanges}}{{/if}}
```

Prompt (`HandoffDetail.prompt`), English only (agents read it):

```
# Contract change {{key}} — {{severity}} ({{breaking}} breaking, {{notable}} notable, {{info}} info)

The backend OpenAPI contract changed on branch `{{branch}}` ({{repoUrl}}/compare/{{fromSha}}...{{toSha}}).
Source commits: {{sourceCardKey}}.

## Changes
{{#each entries}}
- [{{levelLabel}}] `{{operation}} {{path}}` — {{text}}{{#if comment}} ({{comment}}){{/if}}
{{/each}}

## What to do
1. In `Goteav-Dashboard`: run `pnpm api:sync` (regenerates the client from the backend's `openapi.json`), then `pnpm typecheck` and fix every type error the regeneration surfaces.
2. In `web`: run `pnpm api:sync` and `pnpm typecheck`; fix the affected features.
3. For each **breaking** entry above, find every call site of the operation (search the generated client's operationId) and update request/response handling; add or adjust tests.
4. Run `pnpm check` in both projects.
5. When done, call `hub.acknowledge_handoff`/`hub.apply_handoff` for {{key}} (or mark it applied in Hub) and log your session with `hub.log_session`, listing the files changed.
Do not change the backend. If a change cannot be applied without a backend fix, open a handoff back to `backend` with `hub.create_handoff` describing it.
```

### 6.7 Port task prompt (`port_task.md.hbs`, created on redesign approve)

```
# Port approved redesign {{labPath}} ({{redesignKey}})

The owner approved version `{{version}}` of `{{app}}/{{page}}` in the lab ({{labUrl}}). Decision note: {{decisionNote}}.
Touches shared components: {{#each touchesComponents}}`{{this}}`{{#unless @last}}, {{/unless}}{{/each}}

## What to do
1. Read the version README and review.md in `apps/lab/{{labPath}}`.
2. Use the `redesign-porter` agent workflow: produce the impact map of every shared component this version changes and every page that uses them, then implement on a feature branch in `{{targetRepo}}` (ask the owner before creating the branch).
3. Keep i18n (ar/en), RTL, light/dark; wire real data; typecheck; tests; side-by-side screenshots against the lab version.
4. When merged, call `hub.mark_redesign_ported` with the branch@commit reference and log your session.
```

### 6.8 Task prompt render (`task_prompt.md.hbs`, `GET /tasks/{key}/prompt`)

```
# {{key}} — {{title}}  [{{priority}} · {{specialty}}{{#if effort}} · {{effort}}{{/if}}]
{{#if repo}}Repo: `{{repo}}`{{#if branch}} · branch `{{branch}}`{{/if}}{{/if}}

{{body}}

{{#if prompt}}## Instructions
{{prompt}}{{/if}}

{{#if acceptance}}## Acceptance
{{acceptance}}{{/if}}

{{#if decisions.length}}## Decisions that apply
{{#each decisions}}- {{key}} · {{title}} → **{{option}}** — {{rationale}}{{/each}}{{/if}}
{{#if handoffs.length}}## Related handoffs
{{#each handoffs}}- {{key}} · {{summary}}{{/each}}{{/if}}
{{#if docs.length}}## Docs to read first
{{#each docs}}- `{{path}}`{{#if heading}} › {{heading}}{{/if}}{{/each}}{{/if}}
{{#if blockedBy.length}}## Blocked by (do not start until these close)
{{#each blockedBy}}- {{key}} · {{title}} ({{status}}){{/each}}{{/if}}

When finished: run `pnpm check` in the repo, call `hub.update_task` to mark {{key}} done (or in_review), and `hub.log_session` with what changed, what remains and any handoff for another team.
```

For imported suggestions without a YAML prompt, `prompt` is rendered as: the suggestion summary,
`## Evidence` (paths as code), and "Implement this inside the module(s) `{{modules}}` following
`docs/01-architecture.md` and the module anatomy; tests first."

### 6.9 Session-context text (`GET /me/context`, plain text ≤ 8 000 chars)

```
[Hub · {{workspaceName}} · {{now}}] What's new for {{displayName}} ({{roles}})
Awaiting you: {{awaitingCount}} ({{decisionsCount}} decisions, {{needsCount}} needs, {{handoffsCount}} handoffs)
{{#each awaitingTop}}  - {{kindLabel}} {{key}} · {{title}}{{#if due}} — due {{due}}{{/if}}{{/each}}
Ready tasks for you: {{#each readyTop}}{{key}}{{#unless @last}}, {{/unless}}{{/each}}
{{#if noSummaryCount}}You have {{noSummaryCount}} session(s) without a summary — call hub.log_session with their session ids: {{noSummaryIds}}{{/if}}
Recently decided: {{#each decidedTop}}{{key}} → {{option}}; {{/each}}
Last activity: {{#each timelineTop}}{{when}} {{actor}} {{kind}} {{key}}; {{/each}}
Use hub.whats_new for details, hub.search_docs before assuming any business rule, hub.request_decision when you need a choice you do not own, hub.create_need for anything required from outside, hub.log_session before you finish.
```

## 7. i18n key inventory (both catalogues must contain every key; CI parity test)

`notifications.json`: `kind.<kind>` labels (`routed_decision`, `routed_need`, `routed_handoff`,
`task_ready`, `review_requested`, `routed_review`, `mention`, `watch_update`, `deadline_reminder`,
`escalation`, `unblocked`, `brief`, `system`), `title.<kind>` with params `{key, title, role,
option, due, hours}`, `body.<kind>`, `email.subject.<kind>`, `session_no_summary`,
`commit_mentions_close`, `test`, `telegram.*` (`linked`, `code_invalid`, `unknown_command`,
`already_done`, `secret_rejected`, `ask_location`, `buttons.<action>`).

`digests.json`: every `digests.brief.*`, `digests.weekly.*`, `digests.release.*`,
`digests.session.*`, `digests.contract.*` key used above; `adr.json`: `adr.*`.

Arabic rendering rules: numbers stay Latin digits; card keys and code are wrapped with
`⁦…⁩` (LTR isolate) in text channels (Telegram, plain text) so `GTV-123` and paths read
correctly inside RTL sentences; HTML uses `<bdi>`.

## 8. Tests

- Router: table-driven test for every row of §1 (event × type → recipients × kind), actor
  exclusion, role+watcher dedupe, suppression list.
- Grouping: `watch_update` suppression within 30 min increments `data.count`; `groupKey` set.
- Outbox: `SKIP LOCKED` batch, backoff sequence, terminal failure after 5, `skipped` when channel
  unavailable, quiet-hours `nextAttemptAt`, bypass for escalation/P0.
- Push: payload ≤ 2 KB, pruning after 3 `410`s, multi-subscription fan-out.
- Telegram (grammY test harness): `/start` link flow incl. expired code and already-linked chat;
  callback acknowledge/claim idempotency; deliver conversation with secret rejection; MarkdownV2
  escaping of titles containing `_*[]()~>#+-=|{}.!`.
- Email: template snapshots en/ar (RTL attributes present), immediate vs digest routing.
- Scheduler: reminders at each offset exactly once (`reminders_sent`), escalation once, stale
  handoff reminder cadence 24 h, orphaned-claim nudge; all with a fake clock.
- Digests: snapshot tests for every template in en and ar with a fixture workspace (sections
  order, limits, empty states); `briefs` uniqueness per member/day; weekly covers the ISO week
  in the workspace timezone (DST-safe); session-context length cap; ADR number computation from a
  fixture `docs/adr` tree; contract prompt lists every entry.
- i18n parity test: same key set in `en` and `ar` for all three catalogues.
