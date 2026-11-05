# 12 — Roadmap

Seven phases. Each phase ends with something the team uses the next day. Tasks are ordered;
a task may start when the tasks it lists under **after** are merged. Durations are estimates for
one executing agent with sub-agents (`14-agent-execution-guide.md` §5); the owner re-plans at
every phase gate.

Task record format:

```
H<phase>-<nn>  Title                                    after: <task ids>
  Reads:        documents/sections to re-read before starting
  Deliverables: files/modules/pages produced
  Acceptance:   checklist the owner (or a reviewer agent) verifies
  Tests:        what must exist and be green
```

Branch naming (ask before creating, D21): `feat/h0-01-monorepo-scaffold`. PR title = task id +
title. Commit scope = module or app (`feat(cards): …`, `feat(web): …`, `chore(infra): …`).

## Phase gates

| Gate | Phase | The team can … |
| --- | --- | --- |
| G0 | H0 Foundation | sign in on the LAN, read the whole Goteav history as cards, claim tasks, decide decisions, deliver needs — all in the browser. |
| G1 | H1 MCP + Claude Code | run `/hub:start`, `/hub:next`, `/hub:done` in Claude Code; every session becomes a card; agents open decisions and needs. |
| G2 | H2 Capture | see commits, PRs, contract handoffs, lab versions and docs appear by themselves; approve a redesign from Hub; search docs. |
| G3 | H3 Decisions + notifications | get reminded and escalated; receive Telegram/push/email; ADR PRs open automatically. |
| G4 | H4 Today + tasks + digests | start the day from the morning brief; pick ready tasks per role; weekly summary; releases. |
| G5 | H5 Knowledge + onboarding | onboard a new member by role; semantic search; audit export. |
| G6 | H6 Generalisation + VPS | add a second workspace in minutes; move to a VPS. |

Estimated calendar: H0 2 weeks · H1 1 week · H2 1.5 weeks · H3 1 week · H4 1 week · H5 1 week ·
H6 later. The owner uses Hub from G1 on; all later phases are built while it runs (dogfooding).

---

## H0 — Foundation (≈ 2 weeks)

Goal: repository, API with identity + workspaces + card core, web app with the core pages, the
Goteav import, and a Compose stack that runs on a developer machine. No capture, no MCP yet.

Before H0: ask O1, O2, O3, O6 (`00-decisions.md` §5) in one question.

```
H0-01  Monorepo scaffold                                            after: —
  Reads:        02-repo-structure.md (all), 11-testing-and-quality.md (CI, code style)
  Deliverables: root package.json + pnpm-workspace.yaml + tsconfig.base.json + eslint flat config (+ hub/no-raw-palette rule stub)
                + prettier + commitlint + husky + .nvmrc/.npmrc + .github/workflows/ci.yml skeleton + .github/actions/setup
                + packages/contracts skeleton (tsup build, roles.ts, errors.ts, secret-patterns.ts, cards/* status enums + transitions tables)
                + empty apps/api, apps/web, apps/lab placeholders that build
  Acceptance:   `pnpm install && pnpm check` green on a clean clone (Windows + Linux CI); CI runs lint/typecheck/unit on PRs
                contracts exports every card type's status enum and transitions table from 01-architecture §4.1 (including reopen/unclaim/send_to_review/request_changes)
                secret-patterns detects: AWS keys, GitHub tokens (ghp_/github_pat_), JWTs, PEM private keys, Stripe sk_live, 32+ hex/base64 "token/secret/key=" assignments; false-positive list (UUIDs, card keys, commit SHAs) passes
  Tests:        contracts unit tests for transitions (every listed transition allowed, every other pair rejected) and secret patterns (positive + negative fixtures)

H0-02  API skeleton and database                                    after: H0-01
  Reads:        01 §2, §9, §10 · 02 (apps/api) · 03 (header, 0000_init, §2–§3) · 04 §1 (conventions, error catalogue) · 11 (api pyramid)
  Deliverables: NestJS 11 app: config/env.schema.ts (Zod; every var from 13-operations env catalogue), app.setup.ts (prefix /api/v1, helmet, cookies, pipes, envelope interceptor, exception filter, i18n en/ar), pino logger, health/live + ready, swagger + scripts/export-openapi.ts (no DB)
                Prisma 7 multi-file schema with ALL models from 03 (empty detail tables are fine to add now), migration 0000_init (extensions, uuid_generate_v7, hub_simple text search config, search triggers), workspace-scope client extension, nestjs-cls transactional
                BullMQ root + PROCESS_ROLE gate (no processors yet), Redis module, outbox table access
                test harness: Testcontainers Postgres 16 (with extensions) + Redis, truncate-all, create-test-app, FakeClock
                infra/compose.dev.yaml (postgres, redis, mailpit)
  Acceptance:   `pnpm --filter @hub/api dev` serves /api/v1/health/ready = 200 with compose.dev up; `pnpm openapi:export` writes openapi/openapi.json without a database
                `prisma migrate dev` applies 0000_init on a fresh DB; `pnpm migrations:check` (copy of backend script) passes
                error envelope and codes match 04 §1; Accept-Language: ar returns Arabic messages
  Tests:        e2e: health, envelope on 404/400/500, i18n of one error; unit: env schema accepts .env.example and rejects a missing HUB_SECRET_KEY; arch: workspace-scope assertion fails a deliberately unscoped query in test mode

H0-03  Identity                                                     after: H0-02
  Reads:        00 D09 · 03 §2 · 04 (identity/auth endpoints, permission matrix) · 11
  Deliverables: modules/identity: sign-in (argon2id), refresh rotation with family revocation, sign-out, invites (create/accept/resend/revoke), password forgot/reset (email via mailer stub that logs in dev), TOTP setup/confirm/verify/recover with enforcement for roles in security.totp_required_roles, personal API tokens (create once-shown, list, revoke, last-used), lockout (03 §2), guards: SessionGuard, ApiTokenGuard (hook kind restricted to /capture/*, /me, /me/context), RolesGuard, @Actor decorator; GET /me; seed: first owner from HUB_OWNER_EMAIL/PASSWORD
  Acceptance:   all identity endpoints in 04 implemented with the documented codes; cookies Secure+HttpOnly+SameSite=Lax; refresh reuse revokes the family; 10 failed logins lock for 15 min; an api token of kind hook cannot call /cards; token roles resolve live (removing a role from a member immediately affects its tokens)
  Tests:        e2e for every flow above incl. TOTP with otplib; unit for lockout and token hashing; arch: every controller route declares a permission or is marked public

H0-04  Workspaces, roles, settings, sources                         after: H0-03
  Reads:        00 D08, D15, D16 · 03 §3–§4 · 04 (workspaces, members, settings, sources)
  Deliverables: modules/workspaces: create workspace (slug, keyPrefix, timezone, locale), memberships with roles (≥1 owner invariant), settings catalogue (Zod per key from 03 §4.2, defaults, PATCH with validation), sources CRUD (config per kind from 03 §4.3, secretEnc with AES-256-GCM, enable/disable), GithubIdentity mapping on members, OnboardingProgress endpoints
  Acceptance:   removing the last owner answers 409; settings reject unknown keys with 404 and wrong types with 400 + path (04 §3.6); source secrets never appear in any response (arch test scans DTOs); workspace slug is in every app URL
  Tests:        e2e per endpoint; unit for the settings catalogue (every key has a default and a schema); arch: no DTO contains secretEnc/passwordHash/tokenHash

H0-05  Card core, timeline, realtime                                after: H0-04
  Reads:        01 §4, §5.1 · 03 §5, §12 · 04 (cards, timeline, SSE) · 08 (none) · 09 (Timeline, card page — data needs only)
  Deliverables: modules/cards: CardService.apply (single mutation path: permission + human_only + transition + event + audit + outbox + search refresh + redis publish), card keys (UPDATE … RETURNING on workspace.card_seq), CardQuery (filters from 04), links (blocks/blocked_by/relates/parent/duplicates with cycle check), comments (secret filter, mentions, redaction), watchers (auto reasons), archive/restore, timeline query over card_events with the 30-minute collapse hint, generic endpoints, modules/audit (interceptor + list), modules/realtime (Redis pub/sub → SSE per member, heartbeat, Last-Event-ID resume for 10 minutes)
  Acceptance:   every mutation produces exactly one card_event with seq n+1 and one audit row in the same transaction (arch test); invalid transitions answer 409 hub.cards.invalid_transition; agent actors are refused on human_only actions with 403 hub.cards.human_only; timeline for 50k seeded events answers < 100 ms (seed script in 11); SSE delivers an event within 500 ms of commit
  Tests:        unit: transitions per type, link cycle detection, secret filter integration, collapse grouping; e2e: create → comment → link → archive flow for each type; load test script committed

H0-06  Type modules (actions)                                       after: H0-05
  Reads:        01 §4.1–4.2, §5.3 (without ADR PR) · 03 §6 · 04 (tasks, decisions, needs, handoffs, redesign, docs, releases actions and permission matrix)
  Deliverables: modules/tasks (claim/unclaim/start/submit_review/complete/reopen/cancel, branch binding, ready-for-role list with tasks.ready_limit_per_role), modules/decisions (create with options + decider role + due default, decide with rationale → unblock linked cards, withdraw/supersede; ADR fields persisted, adrStatus=drafted on draft; no GitHub yet), modules/needs (create, start, deliver with location through the secret filter, verify, cancel), modules/handoffs (create manual, acknowledge, apply with optional task creation, dismiss human-only), modules/redesign + docs + releases: entities, create/read, status transitions only (no lab or Git behaviour yet), digests: handoff prompt + ADR skeleton + task prompt render (templates from 07)
  Acceptance:   permission matrix of 04 §2 is implemented as a table and the arch test checks every (action × role × actorKind) cell against it; decide by a user without the decider role → 403; decide via MCP token → 403 human_only; deliver with a value that looks like a token → 400 hub.security.secret_detected naming the pattern; a decided decision emits unblocked on every card it blocked
  Tests:        e2e per action; unit for template renderers with golden files (ar + en)

H0-07  Web skeleton, auth pages, shell                              after: H0-03 (can run in parallel with H0-05/06)
  Reads:        01 §6 · 02 (apps/web) · 08 (all) · 09 (auth pages, workspaces picker, app shell) · 04 §5 (client generation)
  Deliverables: Next.js 15 app on 7300: globals.css with the full token set from 08 (light/dark, per-type colours) + contrast check script in CI, shadcn new-york setup, next-intl (ar default, en), fonts, middleware (locale + auth redirect), generated API client (hey-api) + ky wrapper + api:sync/api:check scripts, TanStack Query provider, SSE provider, shell (sidebar with counters placeholders, topbar, workspace switcher, locale/theme toggles, command palette skeleton), pages: sign-in, invite/[token], reset/[token], totp, workspaces picker; common components (EmptyState, ErrorState, Skeletons, Markdown, RelativeTime, CopyButton, Toasts)
  Acceptance:   sign-in → TOTP (when required) → workspace picker → /ar/goteav/today placeholder, in Arabic RTL and English LTR, light and dark; axe has no serious violations; no raw palette class passes ESLint; Lighthouse performance ≥ 90 on sign-in
  Tests:        vitest for shell components (RTL/LTR snapshot), Playwright F1 (invite → sign-in) in ar and en

H0-08  Web pages: timeline, card, tasks, decisions, needs, handoffs, members, settings (core) after: H0-06, H0-07
  Reads:        08 (components) · 09 (Timeline, cards/[key], Tasks, Decisions, Needs, Handoffs, Members, Settings general/roles/tokens/sources) · 04
  Deliverables: the listed pages with every region, filter, action, state and shortcut in 09; CardSheet with per-type sections; decide dialog; deliver dialog with secret-filter error; claim/unclaim; handoff acknowledge/apply; members (roles, github login); settings general/roles/sources (CRUD only; "test connection" arrives in H2)/tokens (create → one-time display with the rendered `claude mcp add` command — the MCP endpoint exists from H1, the page can ship now)
  Acceptance:   acceptance checklists of those pages in 09 pass; Playwright F2 (claim a task), F3 (decide a decision), F4 (deliver a need) in ar + en; phone width works for Decisions and Needs
  Tests:        vitest per component state; Playwright F2–F4; axe on each page

H0-09  Goteav importer and seed                                     after: H0-06
  Reads:        06 (importer section) · 03 §4.2 (onboarding.paths, modules.catalogue), §5.1 import keys · the source files under F:\Goteav\backend\docs\map\data, docs\status, F:\Goteav\.goteav-ops\contract-changes.md
  Deliverables: modules/capture importer + scripts/import-goteav.ts (`pnpm import:goteav --workspace goteav --root F:\Goteav`): decisions YAML → decision cards, suggestions YAML → task cards with prompts, status notes → doc cards (kind status) + the release card, contract-changes bullets → applied handoff cards dated from the bullet, modules catalogue, onboarding paths per role; idempotent on re-run; scripts/seed-dev.ts for a demo workspace
  Acceptance:   running the importer twice creates no duplicates; counts reported (created/updated/skipped); every imported card links back to its source path in body; the Goteav workspace shows 67 tasks from suggestions with their priority/effort and the decisions with options
  Tests:        unit with fixture copies of the YAML/MD files; e2e import on Testcontainers

H0-10  Compose stack, images, Caddy, host script (first cut)        after: H0-08, H0-09
  Reads:        13 (host setup, Caddyfile, compose.yaml, Dockerfiles api/web, env catalogue, first run) · 00 D05, D18
  Deliverables: infra/docker/api.Dockerfile, web.Dockerfile, entrypoint.sh, infra/compose.yaml (caddy, web, api, worker, migrate, postgres, redis; lab service as a placeholder static dir), Caddyfile with tls internal + /ca.crt + routes, .env.example complete, infra/scripts/install-host.sh, backup.sh, restore.sh, update.sh; CI builds both images
  Acceptance:   `docker compose up -d` on a developer machine serves https://localhost (internal CA) with the full G0 flow; migrate one-shot runs before api; health checks green; RAM at idle ≤ 2 GB (document the measurement); backup.sh produces a restorable dump (restore drill executed and recorded)
  Tests:        CI job builds images; smoke script (curl health, sign-in) run against the compose stack in CI (ubuntu runner)

Gate G0 demo: fresh host-like compose on the owner's machine → invite → sign-in → timeline with Goteav history → claim GTV-task → decide a GTV-decision → deliver a need (secret filter demo) → status note (Arabic).
```

## H1 — MCP and Claude Code (≈ 1 week)

Goal: every member's Claude Code talks to Hub; sessions become cards; agents open decisions,
needs and handoffs; Today page v1.

```
H1-01  MCP server and core tools                                     after: H0-06
  Reads:        01 §7 · 05 (server, conventions, tools: get_project_brief, whats_new, get_card, list_cards, list_tasks, claim_task, update_task, create_task, update_card, comment, link_cards) · 04 §2 (agent column)
  Deliverables: modules/mcp with @modelcontextprotocol/sdk Streamable HTTP mounted at /mcp (stateless), bearer → actor, rate limit, the listed tools with Zod schemas and Markdown outputs exactly as 05, error mapping to MCP tool errors (isError + code)
  Acceptance:   `claude mcp add --transport http hub https://localhost/mcp --header "Authorization: Bearer <token>"` works from a developer machine; tools/list shows the catalogue with descriptions; claim_task from Claude Code produces the same events as the web; human_only tools are absent from the catalogue (not merely refused)
  Tests:        unit with the SDK in-memory client per tool (happy + permission + validation); e2e over HTTP with a real token; arch: every tool name exists in @hub/contracts/mcp/tools.ts

H1-02  Session logging and reconciliation                            after: H1-01
  Reads:        01 §5.5 · 03 §8 (SessionLog) · 05 (log_session, hooks, reconciliation, /me/context) · 06 (sessions adapter)
  Deliverables: log_session + list_my_sessions_without_summary tools, POST /api/v1/capture/session (hook token), GET /me/context (≤ 10 000 chars), SessionLog upsert by session_id, change cards kind=session (summary or facts-only + no_summary flag), follow-ups → task cards, handoffs → handoff cards, card-key extraction from text, grace timer (capture.session.hook_grace_minutes) as a delayed BullMQ job, session_fallback digest template
  Acceptance:   hook first then log_session → one card upgraded; log_session first then hook → one card, facts merged; hook only → facts-only card after the grace period and it is listed for the member; a secret in the summary is rejected and the agent gets a clear error
  Tests:        unit for the reconciliation matrix in 05; e2e for the three orders

H1-03  Decision, need, handoff, brief and ADR-draft tools            after: H1-01
  Reads:        05 (request_decision, get_decision, create_need, list_needs, create_handoff, list_handoffs, acknowledge_handoff, save_brief, draft_adr) · 03 §10 (Brief)
  Deliverables: the listed tools; Brief table + save_brief; draft_adr stores adrBody and sets adrStatus=drafted (PR comes in H3-06)
  Acceptance:   an agent can open a decision routed to accountant with a deadline and the card shows "opened by agent (member)"; decide remains impossible via MCP; acknowledge_handoff via MCP allowed, dismiss not
  Tests:        unit per tool; e2e: request_decision → web decide → get_decision returns rationale

H1-04  Prompts and resources                                         after: H1-02, H1-03
  Reads:        05 (prompts /hub:start, /hub:next, /hub:done, /hub:decision, /hub:need; resources hub://brief/today, hub://card/{key}, hub://decisions/open, hub://handoffs/pending) — /hub:ask and hub://doc arrive in H2-06
  Deliverables: registerPrompt/registerResource implementations with the exact texts in 05
  Acceptance:   `/hub:start` in Claude Code narrates today's sections and lists no-summary sessions; `/hub:done` ends with a log_session call (verified in the SessionLog); prompt texts contain the no-secrets rule
  Tests:        unit: prompt text golden files; manual checklist recorded in the status note

H1-05  Team pack plugin and installer                                after: H1-04
  Reads:        05 (team pack: plugin.json, .mcp.json, SKILL.md, hooks.json, scripts, CLAUDE.md snippet, marketplace, installer, doctor) · 13 (CA export)
  Deliverables: packages/team-pack with the plugin, marketplace.json at the repo root, `npx @hub/team-pack init|doctor|uninstall`, CA trust per OS, hosts-entry instructions, SessionStart context injection, SessionEnd sender within the timeout (detached child + outbox), `claude plugin validate` in CI
  Acceptance:   a teammate on Windows installs in < 5 minutes with one command and `hub doctor` is all green; SPIKE recorded: Claude Code's MCP client trusts the internal CA via NODE_EXTRA_CA_CERTS (or the documented alternative) — if it does not, stop and ask the owner (ADR)
  Tests:        CLI unit tests; hook scripts with fixture stdin; plugin validate --strict

H1-06  Today v1 and morning brief (template)                         after: H1-03, H0-08
  Reads:        07 (morning brief sections, scheduler) · 09 (Today) · 03 §10
  Deliverables: modules/digests morning brief renderer (sections: narrative if saved, awaiting me, ready for my roles, changes since last visit, deadlines, no-summary sessions), BullMQ repeatable per workspace at digest.morning_time, GET …/today, Today page with all sections and empty states, Settings › Tokens page wired to the live MCP endpoint
  Acceptance:   Today renders in both languages with real data; a narrative saved by `/hub:start` appears above the sections; brief generation for 12 members runs < 2 s
  Tests:        unit golden files for sections; e2e brief job; vitest Today states

H1-07  Dogfooding switch-on                                           after: H1-05, H1-06
  Deliverables: HUB workspace created (key prefix HUB), the executing agent and the owner install the pack, this plan's docs folder registered later as a docs source (H2); status note
  Acceptance:   from now on every build session of Hub appears in the HUB timeline

Gate G1 demo: two members run /hub:start → /hub:next GTV-… → work → /hub:done; timeline shows both sessions; an agent-requested decision appears to the owner who decides it in the browser.
```

## H2 — Capture (≈ 1.5 weeks)

```
H2-01  GitHub client, local clones, sources UI                       after: H0-10
  Reads:        06 (github adapter: clone management, polling, rate limits) · 03 §3 Source/CaptureRun · 09 (Settings › Sources)
  Deliverables: modules/github (Octokit per source token, rate-limit aware), infra/git clone manager over the repos/ volume (`git fetch --prune` per source), CaptureRun records, sources UI: test connection, run now, last runs with status/error, enable/disable; metrics adapter_lag_seconds
  Acceptance:   a source with a bad token shows the error in the UI within one run; clones survive container restarts; lag metric exposed
  Tests:        unit with recorded GitHub responses; e2e against a local bare repository created by the test

H2-02  GitHub commits and PRs adapter                                after: H2-01
  Reads:        06 (commit grouping with worked example, PR tracking, author mapping, branch→task binding) · 03 §5.1, §6 ChangeDetail
  Deliverables: github.poll repeatable job (capture.github.interval_sec), commit groups as change cards with commit events, PR cards with pr_opened/merged/closed, author → member via GithubIdentity, branch names containing a card key bind the task (branch + relates link), timeline renderers for commits/PRs in the web
  Acceptance:   a push to the backend repo appears within 2 polling intervals; 5 commits in 20 minutes by one author on one branch = 1 card with 5 events; a PR merge updates the existing PR card; re-running never duplicates
  Tests:        unit grouping fixtures (window edge cases: 89/91 minutes, author change, branch change); e2e with the local bare repo

H2-03  OpenAPI contract handoffs                                     after: H2-02
  Reads:        01 §5.4 · 06 (openapi adapter) · 07 (handoff prompt template) · 03 §6 HandoffDetail
  Deliverables: oasdiff binary in the api/worker image, openapi.diff job after each github.poll that touched the configured path, handoff cards (breaking/notable/info) with payload + rendered summary + prompt, Handoffs page renderers (HandoffDiffList), in-app notification stub to the frontend role (full channels in H3)
  Acceptance:   changing a response schema in openapi.json creates a `breaking` handoff listing the endpoint and the schema; a description-only change creates `info`; the prompt tells the receiving agent to run `pnpm api:sync` in both front-end repos
  Tests:        unit with fixture pairs of openapi.json and the expected classification; e2e end-to-end from commit to card

H2-04  Lab move, publication and serving                             after: H0-10
  Reads:        00 D14 · 10 (move steps, vite config, serving, agent path updates) · 13 (lab Dockerfile)
  Deliverables: apps/lab (moved content, env-driven source roots, port 7320, base /lab/, gitignore), lab image + dist volume served by Caddy, CI job `lab build`, updated path strings in ~/.claude agents/skills (list in 10, applied with the owner's approval since they are global files)
  Acceptance:   `pnpm --filter @hub/lab dev` works on a developer machine with the Goteav checkouts next to hub/; https://localhost/lab/ serves the gallery from the compose stack; screenshots load
  Tests:        vite build in CI; registry fixture tests

H2-05  Lab scanner, redesign cards, approvals                        after: H2-04, H0-08
  Reads:        06 (lab scanner) · 10 (front-matter contract, import, write-back, port task) · 09 (Redesign pages) · 03 §6 RedesignDetail
  Deliverables: lab.scan job (front-matter + screenshots + review score), redesign cards with externalKey lab:…, import of current versions with status reset per D14 (ask O7 first), Redesign pages (gallery per page, compare with device/lang/theme, approve/reject/request changes/send to review/mark ported), write-back to README.md front-matter committed by hub-bot (lock, rebase, retry), auto port task with the prompt template
  Acceptance:   approving in Hub changes the file in the repo within one minute and creates a port task for lab.port_task_specialty; editing status in the file changes the card (file is the truth); only owner can approve/reject; Playwright F5 (approve a version) green
  Tests:        scanner fixtures; e2e write-back against a local clone; F5

H2-06  Docs indexer, docs pages, search, ask                         after: H2-01, H0-08
  Reads:        06 (docs indexer, chunking) · 03 §7, §12 · 09 (Docs, Ask) · 05 (search_docs, get_doc, /hub:ask, hub://doc)
  Deliverables: docs.index job per docs_folder source (kinds doc/adr/status/readme), doc cards + chunks + tsvector, GET …/search (cards + docs, hub_simple + trigram fallback), Docs tree/viewer with anchors + "open in GitHub", Ask page (grouped excerpts + "ask in Claude Code" hint), MCP search_docs/get_doc tools, /hub:ask skill (D26) and hub://doc resource; register F:\Goteav\backend\docs and this plan's docs/ as sources
  Acceptance:   Arabic and English queries return the expected documents from a fixture corpus (10 golden queries); re-index after a commit keeps card ids; `/hub:ask` answers cite paths and headings; a multi-word Arabic question reaches the skill whole, tested in a real Claude Code session
  Tests:        unit chunking; e2e index + search golden set; vitest Docs/Ask

H2-07  System page and metrics                                       after: H2-02
  Reads:        01 §11 · 09 (Settings › System) · 13 (monitoring)
  Deliverables: /metrics (prom-client, bearer METRICS_TOKEN), Settings › System (source lag, outbox backlog, last backup, versions), in-app alert when a source has failed 3 runs
  Acceptance:   values update live; a stopped worker is visible within 5 minutes
  Tests:        e2e metrics endpoint; vitest System page states

Gate G2 demo: a commit in backend → change card; an openapi.json change → breaking handoff with prompt → frontend member acknowledges from Claude Code; a new lab version → card → owner approves → port task; search "refund" in Arabic and English.
```

## H3 — Decisions room, needs, notifications (≈ 1 week)

```
H3-01  Notifications core and inbox                                   after: H0-06, H1-06
  Reads:        07 (routing table, grouping, outbox) · 03 §9 · 09 (Inbox) · 04 (inbox endpoints)
  Deliverables: modules/notifications: routing from card events to Notification rows (role holders, watchers, assignee, mentions), groupKey merge, outbox NotificationJob rows in the same transaction, publisher job, inbox endpoints (list, read, read-all, archive), unread counters in the shell, SSE inbox.new, Inbox page
  Acceptance:   a decision routed to accountant lands in every accountant's inbox once; comment mention notifies once even with two mentions; counters update live
  Tests:        unit routing table (every event kind × recipient rule); e2e inbox flow

H3-02  Web push                                                       after: H3-01
  Reads:        07 (push) · 13 (VAPID env)
  Deliverables: service worker, subscribe/unsubscribe UI, push channel sender, failure pruning, click → card URL
  Acceptance:   push received on Chrome/Edge on the LAN under the internal CA; expired subscriptions pruned after 410
  Tests:        unit sender; manual checklist in the status note

H3-03  Telegram                                                       after: H3-01
  Reads:        07 (Telegram) · ask O5 for the bot token
  Deliverables: grammY bot in the worker (long polling, single instance lock), /start <code> linking, ar/en templates, inline buttons Acknowledge/Open/Deliver (Decide → opens the browser), callback idempotency, preferences
  Acceptance:   linking in < 1 minute; acknowledging from Telegram emits the same event as the web with via=telegram; two workers do not double-poll
  Tests:        unit handlers with a fake bot API; e2e link code

H3-04  Email                                                          after: H3-01
  Reads:        07 (email) · ask O4 for the provider
  Deliverables: nodemailer SMTP + Resend transports, Handlebars RTL-safe templates ar/en (immediate: deadline, escalation, invite, reset; digest: daily), mailpit in dev
  Acceptance:   templates render correctly RTL in Gmail/Outlook web (screenshots); digest groups by card
  Tests:        unit template golden HTML; e2e via mailpit API

H3-05  Deadline engine, decisions room and needs board polish        after: H3-01
  Reads:        01 §5.3 · 07 (scheduler.tick queries) · 09 (Decisions, Needs, Handoffs) · 03 §4.2 (decisions.*, handoffs.stale_hours, needs.stale_days)
  Deliverables: scheduler.tick every 5 min: reminders at offsets (remindersSent), overdue flag, escalation to pm after escalation_hours, stale handoffs/needs reminders; Decisions room bands (overdue/escalated/due soon), Needs board swimlanes + "blocks N", Handoffs pending-age; channel preferences page with quiet hours batching
  Acceptance:   with FakeClock: a decision due in 30 h gets the 24 h and 2 h reminders exactly once, becomes overdue, escalates once; quiet hours delay push/telegram but never email for escalation
  Tests:        unit with FakeClock for every rule; e2e tick

H3-06  ADR pull requests and /hub:adr                                 after: H2-01, H1-03
  Reads:        01 §5.3 · 05 (draft_adr, /hub:adr) · 07 (ADR skeleton) · 00 D19 (write token) · 06 (github client write)
  Deliverables: open_adr_pr action (human) creating `docs/adr/NNNN-<slug>.md` on a branch `adr/<key>-<slug>` in the configured repo and opening a PR with the decision summary; adrStatus pr_opened → merged via polling; /hub:adr prompt drafts text with draft_adr; a sandbox repository is used for all tests (owner creates it)
  Acceptance:   decided decision → PR opened in the sandbox with the ADR file in backend/docs/adr format and numbering continuing from the highest existing number; merge detected within one poll
  Tests:        unit ADR renderer golden; e2e against the sandbox repo (gated by env, skipped in CI without token)

Gate G3 demo: an agent opens a financial decision → owner (as accountant) gets Telegram + push → decides in the browser → ADR PR opens → blocked task unblocks and its owner is notified.
```

## H4 — Today, tasks, digests, timeline polish (≈ 1 week)

```
H4-01  Morning brief delivery and Today final                         after: H3-04, H1-06
  Reads:        07 (brief delivery per preference) · 09 (Today final)
  Deliverables: brief delivery by email/Telegram per channel preference (digest mode), Today narrative controls, "mark all seen"
  Acceptance:   07:30 workspace time brief arrives on the chosen channel; Today loads < 1 s
  Tests:        e2e scheduler with FakeClock; vitest Today

H4-02  Tasks: prompts, ready lists, run-with-AI                       after: H1-04, H0-08
  Reads:        09 (Tasks) · 07 (task prompt template) · 05 (/hub:next)
  Deliverables: prompt rendering for imported suggestions and manual tasks (render_prompt action), copy prompt, `/hub:next GTV-…` hint, specialty tabs, task_ready notifications to the specialty role when a task becomes ready, follow-up tasks from sessions shown with origin badges
  Acceptance:   every imported suggestion has a prompt with links to its evidence paths; ready list per role respects the limit setting
  Tests:        unit prompt golden; vitest Tasks

H4-03  Weekly summary, releases                                       after: H3-01
  Reads:        07 (weekly, release notes) · 09 (Releases) · 05 (/hub:weekly, /hub:release-notes) · 03 §6 ReleaseDetail
  Deliverables: weekly digest job (digest.weekly_day_time) + Brief kind=weekly, Releases page (create from a date range or tag, included cards, notes per audience skeleton), the two prompts
  Acceptance:   release notes skeleton lists included changes/handoffs/decisions by audience; weekly brief stored and shown on Today on the configured day
  Tests:        unit golden; e2e release creation

H4-04  Timeline polish and performance                                after: H2-02
  Reads:        09 (Timeline) · 08 (performance budgets) · 11 (load seed)
  Deliverables: collapsing, "n new events" pill with SSE, filter persistence in URL, virtualised list, cursor pagination, deep links
  Acceptance:   60 fps scroll with 5k rendered events on a mid laptop; filters shareable; p95 API < 150 ms at 50k events
  Tests:        Playwright perf check; vitest filters

H4-05  Command palette, shortcuts, accessibility, phone pass          after: H0-08
  Reads:        08 (CommandPalette, shortcuts, accessibility, breakpoints) · 09 (phone notes)
  Deliverables: Ctrl/Cmd+K palette (cards by key/title, pages, actions), shortcut sheet, axe pass on every page, phone layouts for Today/Inbox/Decisions/Needs verified
  Acceptance:   no serious axe violations; all actions keyboard-reachable; phone screenshots in the status note
  Tests:        Playwright axe suite; vitest palette

Gate G4 demo: a member starts the day from the Telegram brief, opens Today, runs /hub:next on a ready task, finishes with /hub:done; the weekly summary shows on Sunday.
```

## H5 — Knowledge and onboarding (≈ 1 week)

```
H5-01  Onboarding by role                                             after: H2-06
  Reads:        09 (Onboarding) · 03 §4.2 onboarding.paths, OnboardingProgress
  Deliverables: Onboarding page with reading path per role, progress ticks, settings editor for paths, seeded Goteav paths
  Acceptance:   a new frontend member sees a 10-item path and completes it; progress persists
  Tests:        e2e progress; vitest page

H5-02  Semantic search (hybrid)                                       after: H2-06 · ask the owner first: embedding provider (local bge-m3 via Ollama on the host vs a hosted API) — write an ADR
  Reads:        00 D13 · 03 §7 DocChunkEmbedding, §12
  Deliverables: embedding job filling doc_chunk_embeddings, hybrid ranking (FTS + cosine), search API flag, Ask page "semantic" toggle
  Acceptance:   golden queries improve recall on paraphrased Arabic questions (measure before/after)
  Tests:        unit ranking; e2e with a fake embedder

H5-03  Docs ↔ cards linking and viewer polish                         after: H2-06
  Deliverables: doc path mentions in cards become links; "cards referencing this doc" panel; heading anchors; copy path
  Acceptance:   a card body mentioning docs/21-confirmation-safety.md shows the chip and the doc shows the card
  Tests:        unit mention parser; vitest

H5-04  Audit page, member management polish                           after: H0-08
  Deliverables: Settings › Audit with filters + CSV export; members disable/enable/password-reset-link; GithubIdentity editor
  Acceptance:   every mutation of the last day is listed with actor and via; export matches filters
  Tests:        e2e audit list/export

Gate G5 demo: onboard a new member end-to-end; semantic ask in Arabic; audit export.
```

## H6 — Generalisation and VPS (later, on request)

```
H6-01  Workspace creation UI and templates                            after: G5
  Deliverables: create workspace wizard (slug, prefix, timezone, roles template, settings template, sources), per-workspace lab root, second workspace trial (e.g. Bitaqaty)
H6-02  Adapter interface documentation                                after: H6-01
  Deliverables: docs/15-adapters-howto.md: how to add a capture adapter (interface, idempotency, tests); GitLab adapter skeleton as the example
H6-03  VPS migration                                                  after: H6-01
  Reads:        13 (VPS checklist) · 01 §12
  Deliverables: Caddyfile.vps, GitHub webhook endpoint enabled with secret, vps-forge + secure-deploy runs, off-site backups
```

## Cross-phase rules

- Every task updates the plan documents it deviates from, in the same PR.
- Every phase ends with the exit checklist of `14-agent-execution-guide.md` §9 and an Arabic status note.
- Owner questions are batched per phase start; mid-phase questions only for blockers.
- `pnpm check` + the task's e2e suite are the merge gate; CI must be green on `main` at every gate.
