# Hub — Plan and documentation

> **Live plan:** `15-first-release.md` is the current scope and wins over the other documents.

Hub is the team's project operations room: one append-only timeline of cards (tasks, decisions,
needs, changes, handoffs, redesigns, docs, releases) written mostly by machines (Git, the OpenAPI
contract, Claude Code sessions, the redesign lab) and read by people and by every teammate's Claude
Code through MCP. The idea and its rationale are in [`../idea.html`](../idea.html) (Arabic).

This folder is the implementation plan for an executing agent **and** the product's permanent
documentation. Written 2026-11-03; status: **approved for execution pending the open items in
`00-decisions.md` §5**.

**Executing agent: start with [`14-agent-execution-guide.md`](14-agent-execution-guide.md).**

| # | Document | What it fixes |
| --- | --- | --- |
| 00 | [Decisions](00-decisions.md) | Owner decisions D01–D22, glossary, non-goals, open items O1–O8. Not re-opened without an ADR. |
| 01 | [Architecture](01-architecture.md) | Processes, modules, card model and status machines, data flows, agent-side AI, security, LAN → VPS. |
| 02 | [Repository structure](02-repo-structure.md) | The monorepo tree: `apps/api`, `apps/web`, `apps/lab`, `packages/contracts`, `packages/team-pack`, `infra`. |
| 03 | [Data model](03-data-model.md) | Prisma schema file by file, settings catalogue, source configs, event kinds, search, retention. **Wins over prose.** |
| 04 | [API reference](04-api-reference.md) | REST conventions, error catalogue, permission matrix, every endpoint, SSE, client generation. |
| 05 | [MCP and Claude Code](05-mcp-and-claude-code.md) | MCP tools/resources/prompts, the team-pack plugin (skill, hooks, installer), session reconciliation, compliance. |
| 06 | [Capture adapters](06-capture-adapters.md) | GitHub, OpenAPI diff, sessions, lab scanner, docs indexer, Goteav importer — algorithms, idempotency, tests. |
| 07 | [Notifications and digests](07-notifications-and-digests.md) | Routing, channels (in-app, push, Telegram, email), deadline engine, digest templates. |
| 08 | [UX and design](08-ux-and-design.md) | Principles, IA, tokens, typography, RTL, components, states, accessibility, i18n, performance. |
| 09 | [Pages](09-pages.md) | Every route with wireframe, data, actions, states, per-role behaviour, acceptance criteria. |
| 10 | [Lab integration](10-lab-integration.md) | Moving `F:\Goteav\redesign` into `apps/lab`, status write-back, port tasks, serving at `/lab`. |
| 11 | [Testing and quality](11-testing-and-quality.md) | Test pyramid, arch fitness tests, CI, code style, definition of done. |
| 12 | [Roadmap](12-roadmap.md) | Phases H0–H6 with ordered tasks, reads, deliverables, acceptance criteria, tests. |
| 13 | [Operations](13-operations.md) | Host setup, Caddy, Compose, env catalogue, Dockerfiles, first run, updates, backups, runbook, VPS move. |
| 14 | [Agent execution guide](14-agent-execution-guide.md) | How the executing agent works with the owner and this plan. |
| — | `adr/` | Architecture decision records written during execution (same format as `F:\Goteav\backend\docs\adr`). |
| — | `status/` | Dated progress notes for the owner (Arabic). |

## Reading paths

- **Owner / PM**: `00` → `01` §1–5 → `09` (Today, Decisions, Needs) → `12`.
- **Backend developer**: `00` → `01` → `02` → `03` → `04` → `05` → `06` → `07` → `11`.
- **Web developer**: `00` → `01` §6 → `02` (apps/web) → `04` → `08` → `09` → `11`.
- **Designer**: `08` → `09` → `10`.
- **Ops**: `13` → `01` §9–12.

## Conventions used across the plan

- Card keys look like `GTV-123` (workspace prefix + sequence). Hub's own workspace uses `HUB`.
- Roles: `owner`, `pm`, `accountant`, `backend`, `frontend`, `designer`, `qa`.
- Card types: `task`, `decision`, `need`, `change`, `handoff`, `redesign`, `doc`, `release`.
- Error codes: `hub.<module>.<name>`; i18n keys: `<namespace>.<key>`; settings keys: `<area>.<name>`.
- "Human-only" marks actions an agent (MCP/hook token) can never perform: decide, verify a need,
  approve/reject a redesign, archive, manage members/sources/settings/tokens.
