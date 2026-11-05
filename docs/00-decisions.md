# 00 — Decisions

Fixed decisions agreed with the product owner on 2026-11-03 (idea phase, `../idea.html`) and in the
planning Q&A that followed. An executing agent must not re-open any item in §2 without an ADR
(`adr/` in this folder, same format as `F:\Goteav\backend\docs\adr`). Items in §5 are open and
must be asked before the phase that needs them.

## 1. What Hub is

**Hub** is an internal "project operations room" for a small team (6–12 people) that builds
software with AI agents (Claude Code). It replaces oral updates with a shared, append-only
**timeline of cards** that is written mostly by machines (Git, the OpenAPI contract, Claude Code
sessions, the redesign lab) and read by both people and every teammate's AI agent through **MCP**.

The first workspace is **Goteav** (backend `F:\Goteav\backend`, public site `F:\Goteav\web`,
admin dashboard `F:\Goteav\Goteav-Dashboard`, redesign lab `F:\Goteav\redesign`). Hub is built
so that a second project is a new workspace, not a new deployment.

### Glossary

| Term | Meaning |
| --- | --- |
| Workspace | One project (e.g. Goteav). Owns members, roles, sources, cards, docs, settings. Data never crosses workspaces. |
| Card | The single unit of the timeline. Has a **type** (below), a status machine, an owner role, links, comments and an append-only event history. |
| Card types | `task`, `decision`, `need`, `change`, `handoff`, `redesign`, `doc`, `release`, `idea`, `plan` (ten; `handoff` was promoted from a page to a type because it has its own lifecycle, and D29 added `idea` and `plan`). |
| Event | One immutable row describing what happened to a card (created, status changed, claimed, commented, decided …). The timeline is the event stream, grouped by card. |
| Role | A workspace-scoped label a member holds: `owner`, `pm`, `accountant`, `backend`, `frontend`, `designer`, `qa`. A member can hold several. Decisions and needs are routed to **roles**, never to a person. |
| Source | Something Hub captures from: a GitHub repository, an OpenAPI file in a repository, the lab folder, Claude Code sessions, a docs folder. |
| Capture adapter | The worker code that turns a source into cards and events, idempotently. |
| Handoff | A card that says "team A changed something team B must act on", with a diff summary and a ready prompt. |
| Need | A card for something required from outside the code: a token, an account, a signed contract, a value the accountant must verify. Hub stores **status and location only, never the secret**. |
| Team pack | The Claude Code plugin every teammate installs: skill, hooks, MCP config, CLAUDE.md snippet. |
| Host | The dedicated mini PC on the office LAN that runs Hub with Docker Compose. |
| Agent-side AI | Every piece of AI-written text (session summaries, narrated briefs, answers about the project, ADR drafts) is produced by a member's **own** Claude Code through Hub's MCP prompts and tools, and written back through MCP. Hub itself never calls a model. |
| Digest | A deterministic, template-rendered summary Hub produces on its own (morning brief sections, weekly summary, release notes skeleton, fallback session summary). Digests are what non-agent users (e.g. the accountant) see; agents can enrich them. |

## 2. Fixed decisions

| # | Topic | Decision | Why |
| --- | --- | --- | --- |
| D01 | Name | **Hub**. Repository `hub`, npm scope `@hub/*`, CLI `hub`, MCP server name `hub`, slash prefix `/hub:*`, hostname `hub.goteav.lan`. The workspace carries the project name. | Generic, short, reusable for other projects. |
| D02 | Build vs buy | Custom application. Plane / Huly / OpenProject / Outline / Backstage were evaluated (`../idea.html` §11) and rejected: none has a role-routed decision room, needs tracking, a unified cross-source timeline or capture from AI sessions. | The differentiating features are exactly what they lack. |
| D03 | Stack | Node 22 LTS · pnpm 10 · TypeScript strict · **NestJS 11** (API + worker + MCP) · **Next.js 15 App Router** (same major as the dashboard, 15.5.x) · React 19 · **Tailwind v4** · shadcn/ui `new-york` · **Prisma 7 + PostgreSQL 16** (`pg_trgm`, `unaccent`, `pgvector` installed from day one) · **Redis 7 + BullMQ** · Zod 4 via `nestjs-zod` · `@modelcontextprotocol/sdk` · Vite 8 for the lab. | Same stack as Goteav so the team's skills, agents and patterns transfer. |
| D04 | Source of truth | **Hybrid.** Markdown docs and ADRs stay in Git (read-only mirrors in Hub, indexed for search). Tasks, decisions, needs, handoffs, comments, events live in Postgres. The lab version status lives in the version's `README.md` front-matter and Hub writes it there (Git-backed). | Docs are reviewed in PRs; operational state changes hourly. |
| D05 | Hosting | A **dedicated small machine on the office LAN** (recommended OS: Ubuntu Server 24.04 LTS; Windows 11 + Docker Desktop is the documented fallback). Docker Compose. Static IP. Hostname `hub.goteav.lan` via router DNS (fallback: hosts file entries written by the team-pack installer). HTTPS by Caddy with its internal CA; the root certificate is trusted on each team machine by the installer. No inbound connection from the internet. Moving to a VPS later changes only the Caddyfile, DNS and the GitHub polling → webhooks (see `13-operations.md`). | Team is on one network now; the owner wants the option to move later. |
| D06 | AI inside Hub | **Hub makes no model calls and holds no AI credential.** All AI-generated text is produced **agent-side**: each member's own Claude Code (their own subscription, ordinary use) runs Hub's MCP prompts (`/hub:start`, `/hub:done`, `/hub:ask`, `/hub:adr` …) which read Hub data through MCP tools/resources and write results back through MCP tools (`log_session`, `save_brief`, `draft_adr`). For everything a human must see without an agent, Hub renders **deterministic digests from templates** (morning brief sections, weekly summary, release-notes skeleton, fallback session summary from Git facts, ADR skeleton). An optional `ANTHROPIC_API_KEY`-backed "server digest polish" is explicitly **out of scope** for H0–H5 (would be a later ADR). Reason for the change from the idea page: the Claude Code docs restrict routing requests through a subscription login on behalf of other users (`05-mcp-and-claude-code.md` §6). | Owner's decision 2026-11-03 after the restriction was found. |
| D07 | Capture sources | Four, all pull-based from inside the LAN: (1) **Claude Code session summaries** — primary: the agent calls `hub.log_session`; fallback: a `SessionEnd` hook posts Git facts; (2) **GitHub commits and pull requests** of the registered repositories, polled every 2 minutes; (3) **OpenAPI contract changes** — `oasdiff` between consecutive versions of `openapi/openapi.json` in the backend repo → a `handoff` card to `frontend`; (4) **Redesign lab versions** — new folders and front-matter status changes → `redesign` cards. | Chosen by the owner. |
| D08 | Roles | Seven roles (glossary). The owner currently holds `owner` + `pm` + `accountant`; the model supports several roles per member and several members per role from day one. Routing targets are roles. | Owner answer; people will be added later. |
| D09 | Authentication | Email + password (argon2id), **invite links** created by the owner/pm with the roles pre-set, httpOnly cookie sessions (access 15 min + refresh 30 days, rotation), optional **TOTP**, enforced only for the roles a project names in `security.totp_required_roles`, by default none (note, owner 2026-11-05, docs/15 §2: Hub runs locally, so neither sign-in nor MCP waits on enrolment). **Personal API tokens** (hashed, scoped to the member's roles, revocable) for MCP and the hooks. No OAuth provider. | Works offline on the LAN; same libraries as the backend (`argon2`, `jose`, `otplib`). |
| D10 | Secrets | Hub **never stores a secret value**. A `need` records state (`requested → in_progress → delivered → verified`), *where* the value was put (free text such as `backend .env on prod`, `1Password › Goteav › Moyasar`) and who verified it. An inbound **secret filter** (regex set for API keys, JWTs, private keys, long hex/base64 tokens) rejects any card body, comment or session log containing a likely secret with a clear error. No external vault now; Infisical can be added later behind the same `location` field. | Owner's choice; lowest risk. |
| D11 | Notifications | In-app inbox + **browser web push** (VAPID) + **Telegram** bot (long polling, so no inbound port; inline buttons for approve/acknowledge) + **email** (SMTP/Resend, outbound only, daily digest + immediate for deadlines). Per-member channel preferences. | Owner's choice. |
| D12 | Team size | Designed for 6–12 members: filters by role/type/repo/module, grouped commits, digest batching, per-role inbox. | Owner answer. |
| D13 | Search | **Postgres full-text first** (`tsvector` with the `simple` configuration + `unaccent` + `pg_trgm` trigram fallback; works for Arabic and English without stemming). `pgvector` is installed and a `doc_chunk_embeddings` table is created empty in H0; semantic search is H5 and must not require a migration of the chunks table. | Cheap and offline; upgrade path kept open. |
| D14 | Lab | The redesign lab moves **into the Hub monorepo** as `apps/lab` and is served by Hub at `/lab`. Its three paths (`web`, `dashboard` live sources) are satisfied on the host by cloning `Goteav` and `Goteav-Dashboard` next to the lab and pointing the Vite aliases at them. The current `F:\Goteav\redesign` content is imported: every version becomes a `redesign` card; **front-matter status is reset to `draft`** except versions already `ported` (they keep `ported`). The owner re-approves from Hub. | Owner's answer: reuse inside the tool, publish on GitHub, bring the current versions over as drafts. |
| D15 | Languages | UI: **Arabic (RTL) default + English**, per-member preference. Code, docs, commit messages, API and MCP tool descriptions: **English**. Card content is free text in either language. Workspace timezone is a setting (default `Europe/Istanbul`; see §5). Gregorian dates, 24-hour time. | Owner's standing rule; Goteav is registered in Turkey. |
| D16 | Multi-workspace | Workspaces, roles, sources and settings are first-class from H0. One deployment hosts many projects; a member may belong to several. | Owner wants to reuse Hub on other projects. |
| D17 | Immutability | Cards are **never hard-deleted** (archive flag only). Events, comments and audit rows are append-only. A comment can be redacted (body replaced, event kept). | The timeline must be trustworthy history. |
| D18 | Ports | Caddy `80` (redirect + `/ca.crt`) and `443` only on the host. Internally: web `7300`, api `7310`, lab dev server `7320`, Postgres `5432`, Redis `6379` (not published). Never use `6001`, `6200` or `6071–6170` (Goteav apps and Windows reserved range). | Avoid collisions on developer machines. |
| D19 | Monitored repositories | `mohmedofficial515/Goteav-backend` (default branch + `feat/*`), `Alremaal-Co/Goteav` (web), `Alremaal-Co/Goteav-Dashboard`, and `hub` itself. Registered per workspace in Settings › Sources; each source stores `{ read, write? }` GitHub fine-grained tokens (`03-data-model.md` Source.secretEnc). `read` (contents, pull requests, metadata) exists on every source. `write` (contents + pull requests) exists only on (a) the **ADR target repository** — `Goteav-backend` by default, used solely to push `adr/<key>-<slug>` branches and open pull requests, never to push to `main` — and (b) the **`hub` repository**, used solely for lab front-matter write-backs by the `hub-bot` identity (`10-lab-integration.md`). `Goteav` (web) and `Goteav-Dashboard` stay read-only. Branch protection on `main` of every repository is the owner's responsibility. | Owner's repositories; writes are limited to ADR PRs and Hub's own repository. |
| D20 | Plan format and executor | This `docs/` folder is the plan **and** the permanent product documentation. The executor is a Claude Code agent following `14-agent-execution-guide.md`. Phases H0–H6 in `12-roadmap.md`; each task has acceptance criteria and tests. | Owner's choice. |
| D21 | Git workflow for Hub | Trunk `main`, branch per roadmap task `feat/h<phase>-<slug>`, Conventional Commits, PR per task with CI green (lint, typecheck, unit, e2e, build). The executing agent **asks the owner before creating any branch or remote** (owner's standing rule). | Owner's standing rule. |
| D22 | Quality bar | TDD where logic is non-trivial; Testcontainers for Postgres/Redis in e2e; Playwright for the five critical UI flows; dependency-cruiser boundaries; `pnpm check` must be green before every PR. | Same bar as the backend. |
| D23 | Arabic word for Handoff | The Handoff card type is **«إحالة»**, plural **«إحالات»**, page **«الإحالات»**. **«تسليم» / «سلّم»** are kept for delivering a Need. English stays Handoff, and the route and type id stay `handoffs` / `handoff`. | Owner, 2026-11-04: one word named two things on the same screen. |
| D24 | Verifying your own delivery | Someone who delivered a Need may verify it, but must write a note. The event records it as self-verified, History shows «تحقق ذاتي», and the button is not the page's filled button. Overrides 09 §8 and 04 where they differ. | Owner, 2026-11-04: the owner holds three roles, so a hard ban would stall work. |
| D25 | Acknowledging a Handoff | Owner and pm may acknowledge any Handoff, with their name shown. Apply stays with the receiving role only. Overrides 09 §9 and 04 where they differ. | Owner, 2026-11-04: an absent member must not leave a Handoff stuck, and Apply is real work. |
| D26 | `/hub:ask` is a skill | `/hub:ask <question>` is a skill in the team pack (`plugin/skills/ask/SKILL.md`), which receives the whole question, not an MCP prompt. See 05 §2.6. | Owner, 2026-11-04: Claude Code docs say MCP prompt arguments split on whitespace, so a question could be cut to its first word. Not yet tested; H2-06's acceptance covers it. |
| D27–D33 | First release | Full MCP control by member permissions, recoverable delete, Idea and Plan card types, projects, approved design, branch and local hosting. See `15-first-release.md`, which wins over other documents. | Owner, 2026-11-05. |

## 3. Non-goals (first release, H0–H5)

- No chat, no video, no wiki editor. Docs are edited in Git.
- No time tracking, no sprints/velocity reports. Priorities and deadlines only.
- No mobile app. The web app is responsive (phone width works for inbox, decisions, needs).
- No GitHub write access except: opening a PR that adds an ADR file (D-flow) and writing lab front-matter + screenshots in `apps/lab` (same repo as Hub).
- No secrets management.
- No public internet exposure.
- No support for AI tools other than Claude Code (the REST API is there for anything else).

## 4. Constraints the executor must respect

- Runs on a small machine: target ≤ 2 GB RAM for all Hub containers at idle, Postgres included.
- Everything works with the internet down except GitHub polling, Telegram, email and the AI runner; those fail soft and retry.
- Arabic and English text everywhere in the UI through message catalogs; no hard-coded UI strings.
- Accessibility: WCAG 2.1 AA contrast, full keyboard operation, visible focus, RTL/LTR correctness.
- No raw palette classes or literal sizes in the web app; tokens only (same ESLint rule as the dashboard).
- The executor never pastes a secret into Hub, a commit or a doc; `.env` files are gitignored, `.env.example` is complete.

## 5. Open items (ask the owner before the phase that needs them)

| # | Item | Needed by | Default if the owner does not care |
| --- | --- | --- | --- |
| O1 | GitHub organisation for the `hub` repository and for the exported lab | H0 | `Alremaal-Co/hub` |
| O2 | Host machine OS | H0 (ops) | Ubuntu Server 24.04 LTS |
| O3 | Workspace timezone | H0 | `Europe/Istanbul` |
| O4 | SMTP provider for email notifications (Resend is already used by the backend) | H3 | Resend |
| O5 | Telegram bot token (owner creates it with @BotFather) | H3 | Telegram channel disabled until provided |
| O6 | Names and emails of the first members and their roles | H0 seed | owner only |
| O7 | Whether imported lab versions keep `ported` status (D14 interpretation) | H2 | keep `ported` |
| O8 | GitHub fine-grained token (read-only contents, pull requests, metadata) for the three Goteav repositories and `hub` | H2 | GitHub capture disabled until provided |
