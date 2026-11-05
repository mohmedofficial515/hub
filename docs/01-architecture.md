# 01 — Architecture

Read after `00-decisions.md`. This document fixes the shape of the system: processes, modules,
data flows, state machines, security and network topology. Details of each part live in the
numbered documents it points to.

## 1. System overview

```
                         office LAN (no inbound internet)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  teammate machines                        host: hub.goteav.lan (Docker Compose)│
 │ ┌───────────────────┐                     ┌──────────────────────────────────┐│
 │ │ browser ──────────┼── https://hub… ───▶ │ caddy :443  (internal CA)        ││
 │ │                   │                     │  /         → web  :7300 (Next.js)││
 │ │ Claude Code ──────┼── MCP /mcp ───────▶ │  /api/*    → api  :7310 (NestJS) ││
 │ │   team pack:      │                     │  /mcp      → api  :7310          ││
 │ │   skill + hooks   │                     │  /lab/*    → lab dist volume     ││
 │ └───────────────────┘                     │  /api/v1/workspaces/{ws}/events/stream → api SSE
 │                                           ├──────────────────────────────────┤│
 │                                           │ api (NestJS, PROCESS_ROLE=api)   ││
 │                                           │ worker (NestJS, PROCESS_ROLE=    ││
 │                                           │   worker): BullMQ processors,    ││
 │                                           │   capture adapters, digests,     ││
 │                                           │   reminders, outbox publisher    ││
 │                                           │ postgres 16 · redis 7            ││
 │                                           │ volumes: pgdata, redisdata,      ││
 │                                           │   repos/ (git clones)            ││
 │                                           └───────────┬──────────────────────┘│
 └───────────────────────────────────────────────────────┼───────────────────────┘
                              outbound only              ▼
                 GitHub API (poll) · Telegram Bot API (long poll) · SMTP

AI placement: no model call happens on the host. Each teammate's Claude Code (their own
subscription) talks to Hub over MCP and produces every AI-written text (§8).
```

Five containers: `caddy`, `web`, `api`, `worker`, `postgres`, `redis` (six with the one-shot
`migrate`). `api` and `worker` are the same image with a different `PROCESS_ROLE`, exactly like the
Goteav backend (`workers.module.ts` gate). The lab is a static Vite build: the `lab` image builds
`apps/lab` (cloning the two Goteav front-end repositories at pinned refs) and copies `dist/` into a
volume that Caddy serves at `/lab/` (`13-operations.md` §5); during lab development the Vite dev
server runs on `7320` on a developer machine.

## 2. Architectural style

A **modular monolith** in one NestJS application, following the Goteav backend conventions
(`F:\Goteav\backend\docs\01-architecture.md`) but lighter:

- One Nest module per bounded context (§3). Each has `application/` (services, use-case
  functions), `domain/` (entities, state machines, pure rules — only where there is real logic),
  `infrastructure/` (Prisma repositories, external clients), `presentation/` (REST controllers,
  MCP tool registrations, BullMQ processors).
- **No CQRS library.** Plain application services with explicit methods. Commands mutate through a
  single `CardService.apply(...)` path so every mutation emits an event (§5).
- **Zod everywhere** (`nestjs-zod`): DTOs, env schema, MCP tool input schemas, card payload
  schemas shared with the web app through `packages/contracts`.
- **One HTTP envelope**, identical to the backend's: `{ data, meta }` on success,
  `{ error: { code, message, details } }` on failure. Error codes are a catalogue
  (`hub.<context>.<name>`), translated `en`/`ar` through `nestjs-i18n`.
- **Boundary rules** enforced by `dependency-cruiser`: `modules/*` never import another module's
  internals, only its `index.ts`; `infra/*` never imports `modules/*`; `domain/` imports nothing
  from Nest or Prisma.
- **Idempotent capture**: every adapter writes with a deterministic `external_key`
  (e.g. `github:commit:<sha>`, `oasdiff:<repo>:<fromSha>..<toSha>`, `lab:<app>/<page>/<version>`)
  under a unique index, so re-runs never duplicate cards or events.
- **Transactional outbox** for notifications: a card event row and its `notification_jobs` are
  written in the same transaction; a BullMQ publisher drains the outbox. Same pattern as backend
  ADR-0007, simplified (one table, one publisher).

## 3. Bounded contexts (Nest modules)

| Module | Owns | Exposes |
| --- | --- | --- |
| `identity` | users, invites, sessions, refresh tokens, TOTP, personal API tokens, password reset, `/me/*` | `AuthController`, `MeController`, `InvitesController`, guards (`SessionGuard`, `ApiTokenGuard`, `RolesGuard`), `IdentityFacade.resolveActor(req)` |
| `workspaces` | workspaces, memberships + roles (`MembersController`), GitHub identities, onboarding progress, workspace settings (timezone, locale, escalation hours, capture intervals, onboarding paths), sources (repos, lab, docs folders), sequence counters for card keys | `WorkspacesController`, `MembersController`, `SettingsController`, `SourcesController`, `OnboardingController`, `WorkspaceFacade` |
| `cards` | the card table, per-type payload tables, events, comments, links, watchers, attachments (lab screenshots only), archive, search index triggers, card keys (`GTV-123`) | `CardsController`, `TimelineController`, `CardService` (the only writer), `CardQuery` (reads) |
| `tasks` | task-specific rules: claim/unclaim, branch binding, prompt rendering, "ready for role" lists | `TasksController`, used by `mcp` |
| `decisions` | decision rules: options, decider role, deadline, reminders, escalation to `pm`, decide + rationale, ADR markdown generation, PR creation through `github` | `DecisionsController`, `DecisionDeadlineProcessor` |
| `needs` | need rules: requester, responsible role, status flow, blocked cards release, secret filter on `location` text | `NeedsController` |
| `handoffs` | create (manual or from capture), acknowledge, apply; from-role/to-role; pending-age metrics | `HandoffsController` |
| `redesign` | bridge to `apps/lab`: scan versions, read/write front-matter, screenshot listing, approve/reject/request-changes → front-matter + `port` task | `RedesignController`, `LabScanProcessor` |
| `docs` | mirrors of Markdown files from registered docs folders in cloned repos, chunking, `tsvector` indexing, search API, ADR/status detection | `DocsController`, `DocsIndexProcessor`, `DocsSearch` |
| `capture` | adapters: `github` (commits, PRs, branches), `openapi` (oasdiff), `sessions` (Claude Code log + hook fallback), `lab` (delegates to `redesign`), `importer` (one-time Goteav YAML/status import) | processors + `CaptureController` (hook ingestion endpoint) |
| `github` | GitHub REST client (Octokit) with token per source, rate-limit aware; local clone management (`git fetch` into `repos/` volume) | `GithubClient`, `RepoClone` |
| `notifications` | inbox items, read state, channels (in-app, push, telegram, email), member preferences, outbox publisher, digest builders (morning brief, weekly), deadline reminders | `InboxController`, `PushController`, `TelegramBot`, `Mailer`, `DigestProcessor` |
| `digests` | deterministic template renderers: morning brief (per member), weekly summary (per workspace), release-notes skeleton (per audience), fallback session summary (from Git facts), ADR skeleton, handoff prompt; stored briefs; no model calls | `DigestsController`, `DigestProcessor`, `DigestFacade.render(kind, input)` |
| `mcp` | the MCP server (`@modelcontextprotocol/sdk`) mounted at `/mcp`: tools, prompts, resources; maps the API token to an actor; calls application services of the other modules — never Prisma directly | `McpController` |
| `audit` | append-only audit log of every mutation (actor, via `web`/`mcp`/`hook`/`system`, before/after summary) | `AuditInterceptor`, `AuditController` |
| `realtime` | Redis pub/sub → SSE stream per member (`/api/v1/workspaces/{ws}/events/stream`) for live timeline, inbox and counters | `EventsController` |
| `health` | `/health/live`, `/health/ready` (Postgres, Redis, repos volume writable) | `HealthController` |

Dependency direction: `mcp`, `realtime`, `notifications`, `digests`, `capture` depend on the core
(`cards`, `tasks`, `decisions`, `needs`, `handoffs`, `redesign`, `docs`); the core depends only
on `identity`, `workspaces`, `github` (for ADR PR) and `infra`.

## 4. The card model (conceptual)

Every card has the common header; the type adds a payload table (full schema in
`03-data-model.md`).

```
Card
  id (uuid v7)          key "GTV-123" (workspace prefix + sequence)
  workspace_id          type: task|decision|need|change|handoff|redesign|doc|release|idea|plan
  title                 body (markdown)       status (per-type machine)   priority P0..P3
  owner_role            assignee_user_id?     created_by: user | agent(user) | system(adapter)
  source: manual|github|openapi|session|lab|docs|import      external_key? (unique per ws)
  due_at?  decided_at?  archived_at?          tags[]           module? (e.g. payments)
  repo? branch? commit?                       links[] (blocks / blocked_by / relates / parent)
  watchers[]            comments[]            events[] (append-only)
```

### 4.1 Status machines

```
task      backlog → ready → claimed → in_progress → in_review → done
                                 ↘ cancelled (from any non-done state)       flag: blocked (derived from open blocked_by links)
          reopen: done | cancelled → ready (owner/pm/assignee; emits status_changed with reason "reopened")
          unclaim: claimed | in_progress → ready
decision  open → decided | withdrawn | superseded          flags: overdue (due_at < now), escalated
need      requested → in_progress (start) → delivered → verified   | cancelled
handoff   pending → acknowledged → applied                 | dismissed
redesign  draft → review (send_to_review) → approved → ported      | rejected   (mirrors lab front-matter; `reference` for v1-baseline)
          request_changes: review → review (note appended; event changes_requested)
change    recorded (terminal; commits/PRs/session logs are facts)         PR sub-state: open|merged|closed
doc       current | stale | removed                        (stale = source file changed since last index — transient)
release   planned → released
idea      open → exploring → accepted | parked | rejected      reopen: parked | rejected → open   (accepted also directly from open)
plan      draft → in_review → approved → in_progress → done    abandoned from any state; approved is for owner or pm
```

Transitions are a table per card type in `@hub/contracts` (`cards/<type>.ts`, `CARD_MACHINES`), read by
`CardService.apply`; any other transition answers `409 hub.cards.invalid_transition`.

### 4.2 Who may do what (summary; full matrix in `04-api-reference.md` §2)

- Any member: create task/need/handoff/decision, comment, watch, claim a task of their role.
- Role holders: act on cards routed to their role (acknowledge handoff, deliver need, decide).
  After a decision escalates, holders of `escalatedToRole` (`pm`) may decide as well as the
  original decider role.
- `owner`/`pm`: edit priorities, reassign, archive, manage members and sources, approve/reject
  redesigns (owner only for redesigns).
- Agents (API tokens): everything the token's member may do, including decide, verify, approve, reject
  and delete (D27). Permissions depend on role only. The actor kind is recorded, never used to refuse.
  The one limit: secret values never pass through MCP, so API tokens, passwords and source tokens are
  set in the web UI only (`surface: web_only` in the permission table).
- Delete maps onto the archive flag and is recoverable (D28): a deleted card leaves every page, count
  and search result, and can be restored from the Deleted view.

## 5. Core data flows

### 5.1 Mutation path (everything goes through it)

```
REST controller | MCP tool | adapter
        └─► CardService.apply(actor, target, action, payload)
                ├─ validate payload, secret filter, project open
                ├─ lock card, check permission (role only, D27)
                ├─ status machine, then the action's plan (apps/api/README.md)
                ├─ in ONE transaction:
                │     update card + payload · insert card_event · insert audit_log
                │     · insert notification_jobs (outbox) for watchers / routed role
                │     · refresh search document
                └─ publish redis `ws:<id>:events` (after commit) → SSE
```

### 5.2 Capture → cards

```
BullMQ repeatable jobs (worker)
  github.poll (every 2 min, per source)   → change cards (commit groups, PRs), branch facts on tasks
  openapi.diff (after github.poll, backend repo) → handoff card to frontend when openapi.json changed
  lab.scan (every 1 min, apps/lab folder; also chokidar in dev) → redesign cards + status events
  docs.index (every 5 min, per docs folder; also on commit touching docs/) → doc cards + chunks
Hook / MCP (api)
  POST /api/v1/capture/session (hook, fallback)  → change card kind=session (facts only)
  hub.log_session (MCP, primary)                 → change card kind=session (summary + handoffs + follow-ups)
```

Commit grouping rule: consecutive commits by the same author on the same branch within 90 minutes
form one `change` card (`kind: commits`), updated in place until the window closes; each commit is a
`card_event` of kind `commit` so the timeline can expand it.

### 5.3 Decision lifecycle

```
open ──(reminder at due-24h, due-2h)──▶ overdue ──(after escalation_hours)──▶ escalated to pm
  │ decide(option, rationale) by a member holding the decider role, from the web or their Claude Code
  ▼
decided ─► ADR markdown generated (template) ─► github.createAdrPr(repo, path, content)
         ─► blocked_by links on other cards resolved → those cards get `unblocked` events + notifications
```

### 5.4 Handoff from a contract change

```
github.poll sees commit touching openapi/openapi.json on backend default/feature branch
  → fetch the file at previous and new sha (git show in local clone)
  → oasdiff changelog --format json  (breaking + non-breaking)
  → handoff card: from backend → to frontend, severity breaking|info, payload {endpoints[], schemas[], raw}
  → prompt rendered from template ("run pnpm api:sync in Goteav-Dashboard and web, fix types …")
  → notification to frontend role; pending-age shown on Handoffs page
```

### 5.5 Session log (primary path)

```
Claude Code (teammate) ── hub.log_session({ changed, remaining, handoffs[], follow_ups[], repo, branch, commits[] })
   → change card kind=session, author = agent(member)
   → each handoffs[i] → handoff card (from member's role → named role)
   → each follow_ups[i] → task card status backlog, owner_role = member's role
   → links to task cards mentioned by key (GTV-123) in the text
Fallback: SessionEnd hook → POST /api/v1/capture/session with {repo, branch, commits, files, duration}
   → if no hub.log_session for that session_id within 10 min → change card kind=session (facts only), flagged `no_summary`
   → body = DigestFacade.render('session_fallback') → "N commits on <branch>: <first lines>; files: …"
   → the member's next `/hub:start` lists their `no_summary` sessions and offers to write the summary
     (`hub.log_session` with the same `session_id` upgrades the card and clears the flag)
```

### 5.6 Morning brief

```
worker 07:30 workspace local time, per member
  → collect: unread inbox, cards routed to my roles (decisions due, needs, handoffs pending), tasks ready for my roles, changes since my last_seen_at
  → DigestFacade.render('morning_brief', …) → structured sections (deterministic, both languages)
  → store brief (per member/day) · shown on "Today" · optional email/Telegram per preference
Agent enrichment (optional, per member):
  `/hub:start` in Claude Code reads `hub://brief/today` + `whats_new`, narrates it, and may call
  `hub.save_brief({ date, narrative })` → the narrative is shown above the sections on "Today"
```

## 6. Frontend architecture (`apps/web`)

- Next.js 15 App Router, React 19, TypeScript. Routes under `app/[locale]/(app)/...`
  (`ar` default, `en`), `app/[locale]/(auth)/...` for sign-in/invite.
- Data: **TanStack Query** against the Hub API via a generated client (`@hey-api/openapi-ts` from
  `apps/api` OpenAPI; script `pnpm api:sync`, identical to the dashboard's workflow). Same-origin
  cookies through Caddy; no BFF.
- Live updates: an `EventSource` on `/api/v1/workspaces/{ws}/events/stream` invalidates queries by card id /
  inbox; optimistic updates for claim/acknowledge/read.
- UI kit: shadcn/ui `new-york` + Tailwind v4 tokens (`08-ux-and-design.md`), `lucide-react`,
  `sonner`, `cmdk` (command palette), `react-hook-form` + Zod, `date-fns` with `ar`/`en` locales,
  `next-themes`, `next-intl` for messages.
- State: URL is the state for filters (shareable timeline/inbox links); `zustand` only for UI
  preferences (density, sidebar).
- Pages and components: `09-pages.md`.

## 7. MCP architecture (`modules/mcp`)

- `@modelcontextprotocol/sdk` server with **Streamable HTTP** transport mounted on the Nest Express
  adapter at `POST/GET/DELETE /mcp`. Stateless mode (new server + transport per request) — simplest
  to scale and restart; tools are cheap.
- Auth: `Authorization: Bearer <personal api token>` → a Principal (the member). The token belongs to the
  member, not to a workspace (docs/15 §5). Each call picks its project: the tool's `project` argument,
  else the `X-Hub-Project` header `hub link <slug>` writes, else the member's default project.
  `ActorService.forProject` then reads the live roles. A project the member is not in answers not found.
- Tools call the same application services as REST; no logic in the MCP layer besides shaping
  text output for the model (compact Markdown tables, card keys, next-step hints).
- Prompts (`/hub:start`, `/hub:next`, `/hub:done`, `/hub:decision`, `/hub:need`), the `/hub:ask` skill (D26) and
  resources (`hub://brief`, `hub://doc/<path>`, `hub://card/<key>`) — full list in
  `05-mcp-and-claude-code.md`.

## 8. AI placement (agent-side only)

| Need | Who produces it | How it reaches Hub |
| --- | --- | --- |
| Session summary | the member's Claude Code at the end of a task (`/hub:done` or the skill rule) | `hub.log_session` |
| Narrated morning brief | the member's Claude Code (`/hub:start`) | `hub.save_brief` (optional) |
| Answer about the project | the member's Claude Code (`/hub:ask`) over `hub.search_docs` + `hub.get_doc`; in the web UI "Ask" is full-text search with excerpts and source links (no generation) | — |
| ADR text | the decider's Claude Code (`/hub:adr GTV-123`) | `hub.draft_adr` → Hub opens the PR |
| Handoff prompt | Hub template (`digests`) from the oasdiff output; an agent may refine it | `hub.update_card` |
| Release notes | Hub skeleton from included cards; `/hub:release-notes` polishes per audience | `hub.update_card` |
| Weekly summary | Hub template; `/hub:weekly` narrates | `hub.save_brief({kind:'weekly'})` |

Rules: Hub stores who wrote what (`actor.kind = agent`, with the member behind it); there is no queue, no credential and no model name anywhere
in Hub's configuration.

## 9. Security model

| Concern | Mechanism |
| --- | --- |
| Network | Only the host's 80/443 are reachable on the LAN; containers talk on an internal Docker network; Postgres/Redis unpublished. Caddy `allowedHosts` = `hub.goteav.lan`, `<static-ip>`. |
| Transport | TLS from Caddy's internal CA; root cert installed by the team-pack installer; HSTS on. |
| Sessions | httpOnly, `Secure`, `SameSite=Lax` cookies; refresh rotation with family revocation on reuse (same as backend identity). |
| API tokens | 40-byte random, shown once, stored as SHA-256; prefix `hub_` + 8-char id for lookup; last-used-at; revoke; belongs to the member, with the project chosen per call and roles resolved live, not frozen (docs/15 §5). |
| Actor kind | Recorded, never used to refuse (D27). An owner's Claude Code may do what the owner may do. Sensitive and destructive tools carry `destructiveHint` and tell Claude to confirm in the chat first; Hub does not enforce that, and the event records `via: mcp`. API tokens, passwords and source tokens are web only. Hook tokens stay limited to `/capture/*`, `/me` and `/me/context`. |
| Secret filter | Applied to every free-text input (REST, MCP, hooks) before persistence; patterns in `packages/contracts/src/secret-patterns.ts`; rejection code `hub.security.secret_detected` with the matched pattern name (never the value). |
| Audit | Every mutation → `audit_log` (actor, kind, via, card, summary, ip, user-agent). Read-only page for owner/pm. |
| Rate limits | `@nestjs/throttler` over Redis: auth endpoints 10/min/IP, MCP 120/min/token, hooks 60/min/token. |
| Backups | Nightly `pg_dump` to a second disk/USB + weekly copy off-host (`13-operations.md`). |
| Supply chain | `pnpm audit` in CI, lockfile committed, Dockerfiles pin base images by digest, non-root `node` user, read-only root FS where possible. |

## 10. Multi-workspace isolation

- Every table that holds workspace data has `workspace_id` and every query goes through a
  `WorkspaceScoped` repository base that adds the predicate; a Prisma client extension asserts the
  predicate is present in dev/test (fails fast on a missing scope).
- Sources, settings, roles, card keys, docs and the lab are per workspace. The lab folder root is a
  source setting (`lab.root`), so a second workspace can have its own lab folder.
- The URL carries the workspace slug: `/ar/goteav/timeline`. The member's "current workspace" is
  only a redirect default.

## 11. Observability

- `pino` JSON logs (request id, actor id, workspace); Caddy access logs.
- `/metrics` (prom-client): queue depth, adapter lag (seconds since last successful poll per
  source), notification outbox backlog, SSE connections, HTTP latency histogram. Optional Grafana later.
- Health page in the UI (Settings › System) shows source lag, outbox backlog, last backup time.

## 12. From LAN to VPS (later)

Unchanged: images, schema, code. Changes: Caddyfile (`tls` from Let's Encrypt, real hostname),
DNS, `GITHUB_WEBHOOK_SECRET` + `POST /api/v1/capture/github-webhook` enabled (polling stays as a
backup at 15 min), firewall (`vps-forge` skill), `secure-deploy` skill for the release procedure.
