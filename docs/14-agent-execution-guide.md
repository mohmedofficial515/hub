# 14 — Agent execution guide

You are the Claude Code agent that builds Hub from this plan. This document tells you how to work;
the other documents tell you what to build. Read this first, then `README.md` for the reading
order.

## 1. Who you work for and how to talk to them

- The product owner is the person in the chat. They read **Arabic**; all code, docs, commit
  messages, API text and UI message keys are **English**; UI strings exist in both `ar` and `en`.
- The owner decides. You never assume a product, stack or design choice that this plan leaves open.
  When you need a decision, use the `AskUserQuestion` tool, **fully in Arabic** (question, header,
  option labels, descriptions), with the recommended option first and marked "(موصى به)", and with
  each option's meaning, consequence and trade-off stated in short sentences.
- Never create a Git branch, worktree or remote without asking first and explaining why, the name,
  and what it branches from. Never delete a branch as a side effect of anything.
- Status notes for the owner (`docs/status/YYYY-MM-DD-<topic>.ar.md`) are written in Arabic;
  everything else in `docs/` is English.
- Report outcomes faithfully: failing tests are reported with their output; skipped steps are
  named as skipped.

## 2. What to read, in order

1. `00-decisions.md` — fixed decisions (D01–D22), glossary, open items (O1–O8).
2. `01-architecture.md` — processes, modules, flows, state machines, security.
3. `02-repo-structure.md` — where every file goes.
4. `03-data-model.md` — the schema; it is the truth when documents disagree.
5. `04-api-reference.md` — the REST contract (web and MCP are built against it).
6. `05-mcp-and-claude-code.md` — MCP tools, prompts, team pack.
7. `06-capture-adapters.md`, `07-notifications-and-digests.md` — worker behaviour.
8. `08-ux-and-design.md`, `09-pages.md`, `10-lab-integration.md` — the web app and the lab.
9. `11-testing-and-quality.md` — the quality gate; `13-operations.md` — host and deployment.
10. `12-roadmap.md` — the ordered tasks you execute, phase by phase.

Read the whole plan once before H0. Afterwards, before each task, re-read the sections the task
lists under "Reads".

## 3. Before you start (H0 prerequisites)

Ask the owner the open items the first phase needs (O1, O2, O3, O6 from `00-decisions.md` §5) in
one `AskUserQuestion` call. Then:

1. Create the repository locally at `F:\Goteav\hub` (ask before creating the GitHub remote; D21).
2. Developer machine: Windows 11, Node 22 (`nvm`), pnpm 10, Docker Desktop (needed by
   Testcontainers and `infra/compose.dev.yaml`), Git. Verify `docker info` works before writing
   any e2e test.
3. Ports: web 7300, api 7310, lab 7320; Postgres 5432 and Redis 6379 from `compose.dev.yaml`
   (change the published ports in that file if the developer machine already uses them, never the
   container ports).
4. Install the reference checkouts you will read from (read-only): `F:\Goteav\backend`,
   `F:\Goteav\web`, `F:\Goteav\Goteav-Dashboard`, `F:\Goteav\redesign`. Copy patterns from them
   (envelope, error catalogue, Prisma setup, swc config, CI composite action, shadcn config, ESLint
   token rule) instead of inventing new ones — cite the source path in the file header comment when
   you copy.

## 4. How to execute a roadmap task

Each task in `12-roadmap.md` has: id (`H1-03`), title, reads, deliverables, acceptance criteria,
tests. Work like this:

1. **Read** the listed sections. If a referenced section is missing or contradicts another
   document, stop and ask (do not guess). The data model wins over prose; the API reference wins
   over page descriptions.
2. **Plan in one message**: files you will create/change, the tests you will write first, any
   library whose current docs you need. Fetch current docs through `context7` for Prisma 7,
   NestJS 11, Next.js 15, `@modelcontextprotocol/sdk`, BullMQ, grammY, web-push, oasdiff — do not
   rely on memory for their APIs.
3. **Tests first** for anything with logic (state machines, adapters, grouping, routing, secret
   filter, permissions). UI components: a vitest render test for each state. Pages: Playwright for
   the critical flows named in `11-testing-and-quality.md`.
4. **Implement** following `02-repo-structure.md` exactly. New file = header comment
   (`@file`, `@description`) like the dashboard. No `any`, no `console.log`, no TODO without a card
   key once Hub is live.
5. **Run the gate**: `pnpm check` (lint, typecheck, unit, api:check) and the e2e suite the task
   names. Fix everything; never weaken a rule to pass.
6. **Docs**: if the implementation deviates from the plan, update the plan document in the same
   PR and say so in the PR description. If the deviation touches a fixed decision, write an ADR
   in `docs/adr/` first and ask the owner to approve it.
7. **Commit** with Conventional Commits (`feat(cards): add claim transition`), one logical change
   per commit, and end every commit message with the attribution line the harness gives you.
8. **PR** per task (after asking about the branch, D21): description = what, why, how tested,
   screenshots for UI, checklist from `11-testing-and-quality.md` §"Definition of done".
9. **Status note** at the end of each phase (Arabic): what works, what is deferred, how to try it,
   open questions. From H1 on, also log your own sessions into Hub (`hub.log_session`) — Hub is
   its own first workspace (`HUB` key prefix) besides `GTV`.

## 5. Parallel work

You may run up to six role-based sub-agents in parallel for independent work (backend developer,
backend tester, API + docs, web developer, UX critic, clean-code reviewer), as the owner has allowed
before. Rules: restructure/scaffold first, then fan out; each sub-agent gets one task id and its
"Reads"; you review every result against the acceptance criteria before merging; never let two
agents edit the same file. Prefer sequential work inside one module.

## 6. When to stop and ask

- Any open item (O1–O8) whose phase has come.
- Any choice between two reasonable designs not settled by the plan (ask with options).
- Anything that would write to the three Goteav repositories (ADR PR flow is tested against a
  sandbox repository the owner creates; never against the real repos without explicit approval).
- Anything that costs money or creates an external account (GitHub token, Telegram bot, SMTP).
- Acceptance criteria you cannot verify on your machine (e.g. host-only behaviour): say so and
  provide the manual check list instead of claiming it passed.

## 7. Things you must never do

- Store, log or echo a secret (tokens, passwords, VAPID private key, GitHub token). The secret
  filter is a product feature; your own behaviour follows the same rule.
- Delete workspace data or write a hard delete for cards/events/comments/audit.
- Add an AI model call, an API key or a `claude` CLI to the host (D06).
- Introduce a dependency outside the stack in D03 without an ADR (small utilities are fine; new
  frameworks, ORMs, UI kits, state libraries are not).
- Change the visual tokens or layout of Goteav apps; Hub is a separate product.
- Skip hooks (`--no-verify`), weaken ESLint/TS strictness, or mark tests as skipped to pass CI.

## 8. Quality bar reminders

- Every mutation goes through `CardService.apply` and emits an event — the arch test enforces it.
- Every query is workspace-scoped — the Prisma extension asserts it in dev/test.
- Every UI string has `ar` and `en`; every date is formatted with the member's locale and the
  workspace timezone; keys like `GTV-123` and code stay LTR.
- Every page has loading, empty, error and no-permission states.
- Every endpoint is in the OpenAPI export with request/response schemas and error codes.

## 9. Phase exit checklist (copy into the status note)

```
- [ ] All tasks of the phase merged to main, CI green
- [ ] `pnpm check` and e2e green locally
- [ ] docs/ updated for every deviation; ADRs for decision changes
- [ ] Demo script executed (what to click / which MCP prompt to run) and screenshots attached
- [ ] Status note in Arabic written to docs/status/
- [ ] Open questions for the next phase listed and asked
```
