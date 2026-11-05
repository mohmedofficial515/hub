# 15 — First release (owner's scope, 2026-11-05)

This document is the scope of the first real build. **Where it differs from another document, this
one wins** and that document must be corrected in the same commit that implements the change. Read it
straight after `14-agent-execution-guide.md`.

## 1. What the owner asked for

A real, running Hub: the approved design moved into the project, every sidebar page live on real data
and updated in real time, and full control from any Claude Code chat through MCP: create, edit and
delete tasks, think and plan, manage decisions and everything else, and create projects with their
details.

Done means the owner can do this on their own machine:

1. `docker compose` and `pnpm dev` (or one documented command) start Hub locally.
2. Sign in, see the Goteav project with its imported history, on all 14 pages plus Planning.
3. Add Hub to Claude Code with one command. In any chat in a connected project, say "create a task
   for X" or "decide GTV-231 for option A" or "start a new project called Y".
4. **The change appears on the open page within one second, without a reload.** The reverse also
   holds: a change on the page is visible to Claude's next tool call.

## 2. Owner decisions

| # | Decision |
|---|---|
| D27 | **Full control through MCP, by the member's permissions.** Whatever a member may do in the web UI, their Claude Code may do with their token, including decide, verify, approve, reject and delete. `human_only` as a concept is removed: permissions depend on role only, and the actor kind is recorded, not used to refuse. |
| D28 | **Delete is recoverable.** Delete hides a card from every page, count and search result, and it can be restored from a Deleted view. It maps onto the existing archive flag and D17 stands: no hard delete, and events and audit rows stay. In Arabic the action is «حذف» and the view «المحذوفات». |
| D29 | **Two new card types: Idea and Plan.** See §4. There are now 10 card types. |
| D30 | **Projects are workspaces, and creating them moves from H6 to this release.** See §5. The UI word is «مشروع» / Project. Routes and code keep `workspace`. |
| D31 | **Approved design:** `F:/Goteav/redesign/hub/today/v5-peacock-app`, with one change: the coloured band rules beside "Overdue" and "Due in 24 h" on Decisions become neutral. Coloured side or top edges on any card or panel are forbidden everywhere. |
| D32 | **Repository:** private `mohmedofficial515/hub`. This release works on one branch, `feat/first-release`, off `main`, with a commit per logical change, and the owner merges at the end. This overrides D21 for this release only. |
| D33 | **Hosting for this release:** the owner's Windows machine, over plain `http://localhost`. Caddy, the internal CA and LAN hosting (D05) stay in the plan but are not required yet. |

D06 is unchanged: **Hub itself makes no model calls.** "Thinking and planning" is done by the member's
own Claude Code, which reads and writes through MCP.

Limits on D27, for security, which stay even for the owner:
- Secret values never pass through MCP. Source tokens and passwords are set in the web UI only, and API tokens cannot be created through MCP. The secret filter applies to everything.
- Sensitive and destructive tools carry `destructiveHint` and a description telling Claude to confirm with the user in the chat first. Hub does not enforce the confirmation; the event records `via: mcp` and the agent actor.

## 3. In scope and deferred

**In scope:**
- H0-01 to H0-09. H0-10 only as far as `infra/compose.yaml` running web, api, worker, postgres and redis on `localhost`.
- All of H1. The team pack must work on Windows with `http://localhost:7310/mcp`.
- H3-01 (notifications core and inbox) and H3-05 (deadline engine and escalation), in-app only.
- H1-06 and H4-01 Today, as in-app only. H4-02 tasks and prompts. H4-03 weekly summary and releases. H4-04. H4-05.
- H2-05 and H2-06 in **local path mode**, described below. H2-07 system page.
- H5-01 onboarding, H5-03, H5-04 audit.
- H6-01 create project wizard (§5).
- Idea and Plan (§4), full MCP control (§6).

**Local path mode.** A source may be `kind: local_path` with an absolute path instead of a GitHub clone:
- Docs indexer reads `F:/Goteav/backend/docs`, `F:/Goteav/Goteav-Dashboard/docs`, and `hub/docs`.
- Lab scanner reads `F:/Goteav/redesign` through the env var `LAB_ROOT`. Screenshots are served through the API from that root, with path traversal blocked. The lab stays where it is and is linked by env var `LAB_URL=http://localhost:6200`. **The move in H2-04 is deferred**, because it edits global agent files.
- Approve and reject write the status into the version's `README.md` front-matter on disk, with no commit. `redesign/` is not a Git repository. Only the owner may do it, by the same permission as the web.

**Deferred until the owner supplies tokens or asks:** GitHub polling (H2-01 to H2-03), web push, Telegram, email sending (H3-02 to H3-04, Mailpit is fine for invites in dev), ADR pull requests (H3-06), semantic search (H5-02), VPS (H6-03), LAN hosting. Their settings UI still exists, showing an honest "not connected" state with what is needed. Never fake data on a page: when no source feeds a section, show its empty state.

## 4. Idea and Plan

Both are full card types: keys, events, comments, links, watchers, delete and restore, secret filter, search, timeline, inbox routing, and MCP tools.

**Idea** (`idea`, «فكرة»): something worth thinking about.
- Status: `open → exploring → accepted | parked | rejected`. `parked` and `rejected` may reopen.
- Fields: problem, notes in Markdown, optional role.
- "Turn into a plan" creates a linked Plan and moves the idea to `accepted`.

**Plan** (`plan`, «خطة»): a written approach that becomes work.
- Status: `draft → in_review → approved → in_progress → done`, and `abandoned` from any state. `approved` is for owner or pm.
- Fields: full Markdown `body`, and ordered `steps`: `{ id, title, role?, taskKey?, done }`.
- Every save of `body` adds a `plan_revised` event with the previous text kept, so history shows revisions and can restore one.
- "Create tasks from steps" creates one task per step without a `taskKey`, links each with `parent`, and writes `taskKey` back. A step is done when its task completes. The plan moves to `in_progress` on the first task and offers `done` when all are finished.

**Page `/[locale]/[ws]/planning`** («التخطيط»), first item in the Work sidebar group, `g p` shortcut:
- It answers "what are we thinking about, and what is planned next?": ideas by status, and plans with a step progress count.
- It has no v5 design. Design it from `kit/README.md` with the same rules and quality bar, then have it reviewed.
- Plan and idea sheets follow the existing `kit/sheet-sections/*` pattern. The plan's Markdown is editable in the sheet.

**MCP:** `create_idea`, `update_idea`, `list_ideas`, `create_plan`, `update_plan` (body, steps, status), `get_plan`, `list_plans`, `plan_to_tasks`. New team pack skill `/hub:plan <topic>`: Claude reads the project through Hub, drafts, asks the user, then saves the plan.

## 5. Projects

A project is a workspace with extra details.
- **New fields:** `description` (Markdown), `goals`, `links` (`{ label, url }[]`), `repoPaths` (local folders), `status` (`active | paused | closed`). Key prefix and slug as in H0-04.
- **Web:** `/workspaces` lists projects with awaiting counts and a New project wizard: name, slug, key prefix, timezone, description, role template, optional local docs path. The sidebar's workspace switcher lists projects and has "New project". Settings › General edits the details. Closing a project is reversible; projects are never deleted.
- **Permissions:** any signed-in member can create a project and becomes its owner.
- **MCP:** `list_projects`, `get_project`, `create_project`, `update_project`, `switch_project`.

**How a chat knows its project.** A personal API token belongs to the member, not to one workspace.
1. Every tool accepts an optional `project` argument (slug).
2. Otherwise the `X-Hub-Project` header decides, which `hub link <slug>` writes into that folder's `.mcp.json`. So a chat opened in a connected folder is on its project automatically.
3. Otherwise the member's default project, which `switch_project` sets.
4. A project the member does not belong to answers not found.

Roles resolve per project, live. Add this to `03`, `04` and `05`, replacing token-per-workspace wherever they assume it. `hub.get_project_brief` and the session context state which project is active, so Claude can say it.

## 6. Full MCP parity

Every web mutation must have an MCP tool, and an arch test enforces it from a table in `@hub/contracts/mcp/tools.ts`: tasks (create, update every field, claim, unclaim, start, submit, complete, reopen, cancel), decisions (create, update, decide, withdraw, supersede), needs (create, start, deliver, verify with D24, cancel), handoffs (create, acknowledge, apply, dismiss, D25), redesign (send to review, approve, reject, request changes, mark ported), releases (create, update, release), docs (read and search only, because docs live in Git), comments, links, watchers, `delete_card`, `restore_card`, `list_deleted`, notifications (list, read), members (list, invite, change roles, disable), settings (read, change), sources (list, add without secrets, enable, disable, run now), onboarding, audit (read). All of them go through `CardService.apply` or the owning service, the same as the web, so REST and MCP can never behave differently. A generic Markdown result states what changed and the card's URL.

## 7. Live updates

- One SSE stream per member (H0-05). Every card event publishes after commit. The web updates its TanStack Query caches from the stream: rows, counts, sidebar badges and an open sheet, on every page.
- Acceptance: an e2e test opens a page in Playwright, creates a card through a real MCP HTTP call, and asserts the row and sidebar count change within 1 s with no navigation. Repeat for edit, delete and decide.
- A reconnect catches up with `Last-Event-ID`. The header's live indicator tells the truth.

## 8. Moving the design

Port `F:/Goteav/redesign/hub/today/v5-peacock-app` into `apps/web`. It is a React and Tailwind v4 version on mock data; `README.md` there lists components under `touches-components`, and `kit/README.md` is the component contract.

- **Same look, same layout, same behaviour:** tokens, Cairo, spacing, sheet edge, keyboard, focus, undo, states. Compare with the lab side by side. Read `review.md` and the "Review answered" section so that fixes are not lost.
- Mock imports become real API calls through the generated client. Lab-only things go away: `?scenario=`, the fake clock and `kit/card-store.ts` as a store. Its *rules* (`actionsFor`, awaiting derived from state) move to shared code, and the API is the authority.
- **Sparklines and trend words are not real data:** remove them unless a real counter history exists. Do not fake data anywhere.
- Hash router becomes Next.js routes per `09-pages.md`. `next-intl` holds the strings, moved from each `i18n.ts`. All strings stay `ar` and `en`.
- Auth pages (sign-in, TOTP, invite, reset) and `/workspaces` have no v5 design. Build them in the same visual system.

## 9. Local run

Ports: web 7300, api 7310. Docker publishes Postgres on **7340** and Redis on **7341**, because Goteav's containers hold 5433 and 6379. Never touch containers named `goteav-*`. Mailpit if needed on 7342 and 7343. The first-run script generates `.env` with a random `HUB_SECRET_KEY` and owner password, printing the password once. `HUB_OWNER_EMAIL` comes from the owner's env, never from a committed file. Owner roles: owner, pm, accountant. Timezone `Europe/Istanbul`. Seed two projects: `goteav` (key `GTV`, from the importer) and `hub` (key `HUB`).

## 10. Definition of done

- `pnpm check` and the e2e suite are green, and Playwright flows F1 to F5 plus the live-update test pass in `ar` and `en`.
- A real Claude Code session on the owner's machine connects and runs the demo below. An agent cannot fully simulate this, so its result is recorded honestly, and whatever could not be run is listed for the owner as a checklist.
- Independent `ux-critic` review of the running app against the lab version.

Demo: sign in → open Tasks → in Claude Code "create a P1 task" → it appears live → "delete it" → it disappears → restore it from the page → `/hub:plan` writes a plan → "turn the steps into tasks" → board updates → "create a project called Test" → it appears in the switcher.
