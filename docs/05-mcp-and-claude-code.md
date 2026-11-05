# 05 — MCP and Claude Code integration

How every teammate's Claude Code talks to Hub. Read after `01-architecture.md` (§7–§8) and
`03-data-model.md`. Facts about Claude Code below were verified against
`code.claude.com/docs` on 2026-11-03; each item the executor must re-verify before relying on it is
marked **VERIFY**.

Reminder of D06: Hub makes **no model calls**. Everything AI-written is produced by a member's
own Claude Code through the prompts and tools in this document and written back through MCP.

## 1. The loop

```
once      npx @hub/team-pack init  → token, plugin, CA trust, doctor
daily     /hub:start   → whats_new + today's brief + sessions without summary
          /hub:next    → claim a ready task, read what it links to, start on a branch
          (work)       → search_docs before guessing · request_decision when a rule is missing
                         create_need when something external is missing · create_handoff when another team must act
          /hub:done    → log_session (summary, handoffs, follow-ups) · update_task
always    SessionStart hook injects "what's new for me" + the session id
          SessionEnd hook posts Git facts as a fallback if log_session never happened
```

What the agent sees at session start (injected by the hook, ≤ 9 000 chars):

```
# Hub — context for Mohmed (roles: owner, pm, accountant) · workspace Goteav
Hub session id: 7f3c…   (pass this as session_id to hub.log_session)
Awaiting you: 2 decisions (GTV-142 due in 5h, GTV-150 overdue), 1 need (GTV-131), 0 handoffs
Ready for your specialties: GTV-160 P1 M "Sync refund contract in dashboard" · GTV-158 P2 S …
Sessions without summary: 1 (started 2026-11-02 17:10, branch feat/refunds, 4 commits) → offer hub.log_session
Changes since your last session (5): …
Use /hub:start for the full brief, /hub:next to claim a task, /hub:done before you finish.
```

## 2. The MCP server

> **docs/15 wins over this chapter.** Tools are the table in `@hub/contracts/mcp/tools.ts`. Tokens belong to the member,
> not a workspace, and nothing is refused for being an agent (D27). H1-01 finishes this rewrite.

### 2.1 Transport and mounting

- Protocol: MCP **Streamable HTTP**, **stateless** (a new `McpServer` + transport per request,
  `sessionIdGenerator: undefined`). No server-side session state; every call carries the bearer
  token. GET on `/mcp` (standalone SSE stream) answers `405`; DELETE answers `405`. This is the
  simplest mode to run behind Caddy and to restart without dropping anything.
- Mounted on the Nest Express adapter at `/mcp` (Caddy proxies `/mcp` → `api:7310`).
- SDK: `@modelcontextprotocol/sdk` (D03). The current docs split it into `@modelcontextprotocol/server`
  + `@modelcontextprotocol/node` (`McpServer`, `NodeStreamableHTTPServerTransport`); the v1 line
  exposes the same classes as `@modelcontextprotocol/sdk/server/mcp.js` and
  `…/server/streamableHttp.js` (`StreamableHTTPServerTransport`). **VERIFY** the current package
  names with context7 and pin exact versions; the pattern is identical:

```ts
// apps/api/src/modules/mcp/presentation/mcp.controller.ts
@Controller('mcp')
export class McpController {
  constructor(
    private readonly tokens: ApiTokenService,          // identity module
    private readonly factory: HubMcpServerFactory,     // builds a McpServer bound to an actor
  ) {}

  @All()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method === 'GET' || req.method === 'DELETE') { res.status(405).end(); return; }
    const actor = await this.tokens.resolveBearer(req.header('authorization'), { via: 'mcp' });
    // throws AppException 401 hub.identity.token_invalid → filter writes JSON + WWW-Authenticate: Bearer error="invalid_token"
    const server = this.factory.build(actor);          // registers tools / prompts / resources for THIS actor
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,                   // stateless
      allowedHosts: this.config.mcp.allowedHosts,      // ['hub.goteav.lan', '<static-ip>'] — DNS-rebinding guard
    });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body); // Nest already parsed JSON; pass it to avoid re-reading the stream
  }
}
```

`HubMcpServerFactory.build(actor)` creates `new McpServer({ name: 'hub', version: pkg.version })`
and calls one `register*(server, actor)` function per module (`tasks.tools.ts`,
`decisions.tools.ts`, …). Tools receive the actor through closure and call application services;
the MCP layer never touches Prisma.

### 2.2 Authentication

`ApiTokenService.resolveBearer`:

1. Expect `Bearer hub_<8-char prefix><rest>`; look up `api_tokens.prefix`; compare
   `sha256(token)` with `token_hash` in constant time.
2. Reject if `revoked_at` set, user `disabled`, membership `removed`, or (kind `hook`) the route is
   not `/api/v1/capture/*` or `/api/v1/me/context`.
3. Resolve **live** roles from the membership (never frozen in the token).
4. Update `last_used_at` at most once per minute (Redis debounce).
5. Return a `Principal { kind: 'agent', userId, tokenId, via }`. `ActorService.forProject(principal, { argument, header })`
   then picks the project (the tool's `project`, else `X-Hub-Project`, else the member's default) and reads live roles.

HTTP-level failure → `401` (`hub.identity.token_invalid`) or `403` (`hub.identity.token_scope`)
before any JSON-RPC parsing, so Claude Code reports a clear connection/auth error. Rate limit
120 requests/min per token (`429 hub.common.rate_limited`).

### 2.3 Conventions shared by all tools

| Rule | Detail |
| --- | --- |
| Output | `content: [{ type: 'text', text }]`, Markdown shaped for a model: a one-line headline, then compact tables or bullets; **every card as `KEY — title`**; ≤ 12 000 chars, truncated with `… (+n more; pass cursor="…")`. |
| Language | English. The agent speaks to the user in the user's language. |
| Times | ISO 8601 with the workspace offset, plus relative hints (`due in 5h`, `3d ago`). |
| Errors | `isError: true`, text `ERROR <code>: <message>` + one `Hint:` line. Codes are the API catalogue (`hub.cards.invalid_transition`, `hub.cards.not_found`, `hub.identity.forbidden`, `hub.security.secret_detected`, `hub.validation.invalid` with field list). |
| Full control | Every web mutation has a tool, including decide, verify, approve, reject and delete (D27). Sensitive and destructive tools carry `destructiveHint` and tell Claude to confirm with the user first. Secret values never pass through MCP. |
| Project | Every tool accepts an optional `project` (slug); see 15 §5. |
| Secret filter | Every free-text input passes `assertNoSecrets()` (patterns in `@hub/contracts/secret-patterns.ts`). Rejection names the pattern (`aws_access_key`, `jwt`, `generic_token_32+`), never the value. |
| Idempotency | Stated per tool. Creates without an idempotency key are not retried by the SDK; the agent must not call them twice. |
| Pagination | `limit` (default 25, max 100) + opaque `cursor`. |
| Actor | Every write records `created_by_kind = 'agent'`, `created_by_id = member`, `via = 'mcp'`, and an audit row. |

Permission matrix (agent actor = the member's roles, same as the web):

| Tool | Requirement |
| --- | --- |
| read tools (`get_*`, `list_*`, `search_docs`, `whats_new`) | any active member |
| `claim_task` | task specialty ∈ member roles, or member holds `pm`/`owner`, or member created the task |
| `update_task` | claimant, creator, or `pm`/`owner`; `done` only claimant or `pm`/`owner` |
| `create_*`, `log_session`, `comment`, `link_cards`, `save_brief(morning)` | any active member |
| `acknowledge_handoff` | `to_role` ∈ member roles or `pm`/`owner` |
| `draft_adr` | decision already `decided`; member holds the decider role or `pm`/`owner` |
| `save_brief(weekly)` | `pm`/`owner` |
| `update_card` | creator, assignee, routed-role holder, or `pm`/`owner`; `owner_role` change needs `pm`/`owner` |

### 2.4 Tool catalogue

Schemas are Zod v4 (`@hub/contracts/mcp/tools.ts`), shared with the REST DTOs. `key` means
`z.string().regex(/^[A-Z]{2,6}-\d{1,7}$/)`. `md(n)` means `z.string().min(1).max(n)` filtered for
secrets. Role = `z.enum(['owner','pm','accountant','backend','frontend','designer','qa'])`.

#### `get_project_brief`

- Purpose: orient an agent in a workspace: what the project is, the fixed decisions, the sources,
  where the docs are, the member's roles.
- Input: `z.object({})`.
- Service: `WorkspaceFacade.brief(actor)` + `DocsQuery.listByKind(ws, 'adr')` +
  `DocsQuery.find(ws, ['README.md', '00-decisions.md'])`.
- Output:

```
# Goteav — project brief (for Mohmed · roles: owner, pm, accountant)
Key prefix GTV · timezone Europe/Istanbul · 7 members · sources: backend (GitHub), web, dashboard, lab, backend docs
## Read first
- backend/docs/README.md → hub.get_doc(source="backend docs", path="README.md")
- backend/docs/00-decisions.md (fixed stack decisions)
## Accepted ADRs (14)
| # | title | path |
| 0001 | Modular monolith with DDD bounded contexts | adr/0001-modular-monolith-ddd.md |
…
## Open right now
3 decisions open (1 overdue) · 2 needs requested · 4 handoffs pending · 18 tasks ready
Next: hub.whats_new, hub.list_tasks
```

- Idempotent (read). Errors: none specific.

#### `whats_new`

- Purpose: what changed since the member's last session, with what is routed to them first.
- Input:

```ts
z.object({
  since: z.iso.datetime().optional(),          // default: actor's previous MCP activity, else 24h ago
  types: z.array(CardType).max(8).optional(), // filter event stream by card type
  limit: z.number().int().min(1).max(100).default(40),
  cursor: z.string().max(200).optional(),
})
```

- Service: `TimelineQuery.forMember(actor, since, …)` + `InboxQuery.unread(actor)` +
  `SessionsQuery.withoutSummary(actor)`.
- Output sections in fixed order: `## Awaiting you` (decisions due/overdue, needs, handoffs
  pending to your roles), `## Your sessions without summary`, `## Decided since`, `## Handoffs
  created for others`, `## Changes` (commit groups, PRs, session logs by others, grouped by repo),
  `## Redesign`, `## Docs updated`. Each line: `GTV-142 — Moyasar fee on customer or platform? · decision · due in 5h · decider: accountant`.
- Idempotent (read). Side effect: records `last_mcp_seen_at` for the member (used as the next default `since`).

#### `search_docs`

- Purpose: full-text search over mirrored Markdown docs, ADRs and status reports.
- Input:

```ts
z.object({
  query: z.string().min(2).max(200),
  kind: z.enum(['doc','adr','status','readme','any']).default('any'),
  source: z.string().max(80).optional(),      // source name, e.g. "backend docs"
  limit: z.number().int().min(1).max(20).default(8),
})
```

- Service: `DocsSearch.search(ws, query, { kind, source, limit })` (tsvector `hub_simple`,
  trigram fallback, `ts_headline` excerpts, best 2 chunks per doc).
- Output:

```
8 results for "refund idempotency" (backend docs)
1. docs/18-post-booking-services-admin.md § 4.2 Refunds — score 0.81
   …the Idempotency-Key is derived from the header, caller and target (**durableIdempotencyKey**, sha256)…
   → hub.get_doc(source="backend docs", path="docs/18-post-booking-services-admin.md", section="4-2-refunds")
2. docs/adr/0007-transactional-outbox.md § Decision — score 0.62
…
```

- Idempotent. Errors: `hub.docs.no_sources` when the workspace has no docs source.

#### `get_doc`

- Purpose: read a doc (or one section) exactly as committed.
- Input:

```ts
z.object({
  source: z.string().min(1).max(80),
  path: z.string().min(1).max(300),            // repo-relative, as returned by search_docs
  section: z.string().max(120).optional(),     // heading anchor; returns that heading's subtree
  maxChars: z.number().int().min(500).max(60_000).default(20_000),
})
```

- Service: `DocsService.read(ws, source, path, { section, maxChars })` — reads from the local clone
  at the doc's `last_commit_sha`.
- Output: header line `docs/18-….md @ 7e55750 (indexed 2h ago) · 2 340 words` then the Markdown.
  Truncation note lists the remaining headings so the agent can ask for a section.
- Errors: `hub.docs.not_found`.

#### `get_card`

- Input:

```ts
z.object({
  key,
  includeComments: z.boolean().default(true),
  includeEvents: z.boolean().default(false),   // last 20 events
})
```

- Service: `CardQuery.getByKey(actor, key, opts)`.
- Output: a card sheet:

```
GTV-142 — Moyasar fee: on the customer or on the platform?
decision · open · P1 · decider: accountant · due 2026-11-04 12:00 (+03, in 5h) · created by agent(Ahmed) via mcp 2026-11-03 11:00
module: payments · repo: backend · tags: fees
## Question
…
## Options
A. On the customer (+fee line) — pros: … cons: …
B. On the platform up to 2 % (recommended) — pros: … cons: …
## Links
blocks GTV-139 — Enable Moyasar live payments (task, claimed by Ahmed)
relates docs/05-flights-and-payments.md
## Comments (2)
- 2026-11-03 11:20 Mohmed: …
```

- Errors: `hub.cards.not_found` (also for other workspaces — never leaks existence).

#### `list_cards`

- Input:

```ts
z.object({
  type: CardType.optional(),
  status: z.array(z.string().max(30)).max(10).optional(),
  ownerRole: Role.optional(),
  assignee: z.union([z.literal('me'), z.string().uuid()]).optional(),
  module: z.string().max(60).optional(),
  repo: z.string().max(60).optional(),
  q: z.string().max(200).optional(),          // full-text over title/body/key
  dueBefore: z.iso.datetime().optional(),
  updatedSince: z.iso.datetime().optional(),
  includeArchived: z.boolean().default(false),
  sort: z.enum(['updated','created','due','priority']).default('updated'),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().max(200).optional(),
})
```

- Service: `CardQuery.list(actor, filters)`.
- Output: table `| key | type | status | P | role | assignee | due | updated | title |`.

#### `list_tasks`

- Input:

```ts
z.object({
  specialty: z.enum(['backend','frontend','design','qa','ops','docs']).optional(), // default: all of the member's specialties
  status: z.array(TaskStatus).max(7).default(['ready']),
  mine: z.boolean().default(false),           // claimed by me
  limit: z.number().int().min(1).max(50).default(10),
})
```

- Service: `TasksService.list(actor, …)` ranked by priority (P0 first), then blocked-last, then
  oldest `created_at`. Blocked tasks show `⛔ blocked by GTV-142`.
- Output: table `| key | P | effort | specialty | status | blocked | title |` + line
  `Claim with hub.claim_task(key, branch)`.

#### `claim_task`

- Input: `z.object({ key, branch: z.string().max(120).regex(/^[\w./-]+$/).optional() })`.
- Rules: from `ready` → `claimed`; from `backlog` → `claimed` only if the member holds `pm`/`owner`
  or created the task. Specialty must be in the member's roles unless `pm`/`owner`
  (`403 hub.tasks.specialty_mismatch`). If already claimed by the same member → returns the card
  (idempotent). If claimed by someone else → `409 hub.tasks.already_claimed` with the claimant.
  Open `blocked_by` links do not prevent claiming but are listed with a warning.
- Service: `TasksService.claim(actor, key, branch)` → `CardService.apply(..., 'claim')` →
  events `claimed` + `status_changed`; watcher added; notification to the creator.
- Output: the card sheet (as `get_card`) + `Next: read linked cards/docs; hub.update_task(status="in_progress") when you start.`

#### `update_task`

- Input:

```ts
z.object({
  key,
  status: z.enum(['ready','in_progress','in_review','done','cancelled']).optional(),
  note: md(2_000).optional(),                  // becomes a comment
  branch: z.string().max(120).optional(),
  prUrl: z.url().max(300).optional(),
  acceptanceChecked: z.boolean().optional(),   // marks acceptance checklist reviewed
})
```

- Rules: transitions per `01-architecture §4.1`; `done` requires `in_review` or `in_progress`
  and (claimant or `pm`/`owner`); `cancelled` requires a `note`. Unclaim = `status: 'ready'` by
  the claimant.
- Service: `TasksService.update`. Idempotent for same values (no duplicate events).
- Output: `GTV-160 → in_review (was in_progress) · PR https://… · 1 comment added`.

#### `create_task`

- Input:

```ts
z.object({
  title: z.string().min(3).max(200),
  body: md(20_000).optional(),
  specialty: z.enum(['backend','frontend','design','qa','ops','docs']),
  priority: z.enum(['P0','P1','P2','P3']).default('P2'),
  effort: z.enum(['S','M','L','XL']).optional(),
  acceptance: md(4_000).optional(),
  prompt: md(8_000).optional(),
  module: z.string().max(60).optional(),
  repo: z.string().max(60).optional(),
  dueAt: z.iso.datetime().optional(),
  tags: z.array(z.string().max(30)).max(10).default([]),
  links: z.array(z.object({ key, kind: z.enum(['blocks','blocked_by','relates','parent']) })).max(10).default([]),
})
```

- Rules: agent-created tasks start in `backlog` (a human promotes to `ready` from the Tasks page);
  `pm`/`owner` members' agents may pass `status: 'ready'` — not in the schema on purpose; they
  promote in the UI.
- Service: `TasksService.create(actor, dto)` → key.
- Output: `Created GTV-171 — <title> (backlog, P2, frontend). A pm/owner promotes it to ready.`
- Not idempotent: never call twice for the same intent.

#### `log_session`

- Purpose: the primary session summary (see §5).
- Input:

```ts
z.object({
  session_id: z.string().min(8).max(128),
  repo: z.string().max(60).optional(),         // source name: backend | web | dashboard | hub
  branch: z.string().max(120).optional(),
  changed: md(4_000),                           // bullets: what changed, with file paths / endpoints
  remaining: md(4_000).optional(),
  handoffs: z.array(z.object({
    toRole: Role, kind: z.enum(['contract','component','design','data','other']),
    severity: z.enum(['breaking','notable','info']).default('info'),
    title: z.string().min(3).max(200), summary: md(2_000), prompt: md(4_000).optional(),
  })).max(10).default([]),
  follow_ups: z.array(z.object({
    title: z.string().min(3).max(200), specialty: z.enum(['backend','frontend','design','qa','ops','docs']),
    priority: z.enum(['P0','P1','P2','P3']).default('P2'), body: md(4_000).optional(),
  })).max(10).default([]),
  cards: z.array(key).max(20).default([]),    // keys worked on → linked `relates`
  commits: z.array(z.string().regex(/^[0-9a-f]{7,40}$/)).max(100).default([]),
  duration_min: z.number().int().min(0).max(1440).optional(),
})
```

- Rules: **idempotent per `session_id`** — a second call updates the same change card
  (`kind: session`) and the `session_logs` row, clears `no_summary`; handoffs/follow-ups already
  created for this session are not duplicated (matched by title). Keys in `cards` must exist in the
  workspace. Keys mentioned in `changed`/`remaining` text (`GTV-\d+`) are auto-linked `relates`.
- Service: `SessionsService.logSummary(actor, dto)` → change card, handoff cards, task cards
  (`origin: session_followup`, `backlog`), links, watchers, notifications to `to_role` holders.
- Output:

```
Session logged → GTV-172 (session · feat/refunds · 4 commits · 2h10)
Handoffs: GTV-173 → frontend (contract, breaking)
Follow-ups: GTV-174 (backend, P2) "e2e for concurrent refund"
Linked: GTV-160, GTV-139
```

#### `create_handoff`

- Input:

```ts
z.object({
  toRole: Role, kind: z.enum(['contract','component','design','data','other']),
  severity: z.enum(['breaking','notable','info']).default('info'),
  title: z.string().min(3).max(200), summary: md(4_000), prompt: md(8_000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),   // ≤ 64 KB JSON
  sourceKey: key.optional(),                                // the change card that caused it
  links: z.array(z.object({ key, kind: z.enum(['blocks','relates']) })).max(10).default([]),
})
```

- `fromRole` = the member's first role matching the handoff kind (`backend` for contract, else
  the first role). Status `pending`; notifications to every holder of `toRole`.
- Service: `HandoffsService.create`. Not idempotent.
- Output: `Created GTV-175 → frontend (contract, breaking) · pending`.

#### `list_handoffs`

- Input: `z.object({ direction: z.enum(['to_me','from_me','all']).default('to_me'), status: z.array(HandoffStatus).default(['pending']), limit: … })`.
- Output: table `| key | from → to | kind | severity | age | status | title |` sorted oldest-pending first; stale ones (> `handoffs.stale_hours`) marked `⚠`.

#### `acknowledge_handoff`

- Input:

```ts
z.object({
  key,
  action: z.enum(['acknowledge','apply','dismiss']).default('acknowledge'),
  note: md(2_000).optional(),                  // required for dismiss
  taskKey: key.optional(),                     // for apply: the task that applied it (links applied_task_id)
  createTask: z.boolean().default(false),      // for acknowledge: create a ready task in my specialty from the handoff prompt
})
```

- Transitions: `pending → acknowledged → applied`; `dismissed` from pending/acknowledged with a
  note. Idempotent for the same target state.
- Service: `HandoffsService.act`. Output: `GTV-175 → acknowledged · task GTV-176 created (ready, frontend)`.

#### `request_decision`

- Input:

```ts
z.object({
  title: z.string().min(3).max(200),
  question: md(4_000),
  kind: z.enum(['product','technical','financial','design']),
  deciderRole: Role,
  options: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,20}$/).optional(),   // default a, b, c…
    title: z.string().min(1).max(120),
    pros: z.array(z.string().max(300)).max(6).default([]),
    cons: z.array(z.string().max(300)).max(6).default([]),
    cost: z.string().max(200).optional(),
    recommended: z.boolean().default(false),
  })).min(2).max(6),
  dueAt: z.iso.datetime().optional(),          // default now + decisions.default_due_days
  blocks: z.array(key).max(10).default([]),   // cards that must wait for this decision
  module: z.string().max(60).optional(),
  priority: z.enum(['P0','P1','P2','P3']).default('P1'),
})
```

- Rules: `financial` → deciderRole must be `accountant` or `owner`; at most one `recommended`.
  Creates `blocks` links (decision blocks those cards), notifies every holder of `deciderRole`
  (in-app + push + Telegram immediately), schedules reminders.
- Service: `DecisionsService.open`. Not idempotent (the agent should `list_cards(type=decision, q=…)` first if unsure).
- Output: `Opened GTV-177 — <title> · decider: accountant · due 2026-11-04 12:00 (+03) · blocks GTV-139. Continue with other work; the decision is human-only.`

#### `get_decision`

- Input: `z.object({ key })`. Output: question, options table (`id | title | recommended | pros | cons | cost`), status, chosen option + rationale + decided by/at, ADR status/path/PR, blocked cards and whether they were released. Errors: `hub.cards.not_found`, `hub.cards.wrong_type`.

#### `draft_adr`

- Purpose: after a human decided, the agent writes the ADR text; Hub opens the PR.
- Input:

```ts
z.object({
  key,
  body: md(30_000),                            // full ADR markdown (template in prompt /hub:adr)
  path: z.string().max(200).regex(/^docs\/adr\/\d{4}-[a-z0-9-]+\.md$/).optional(), // default: next number in the docs source
  repoSource: z.string().max(60).optional(),   // default: the workspace's docs source repo (backend)
})
```

- Rules: decision must be `decided` (`409 hub.decisions.not_decided`); if `adr_status` is
  `pr_opened` or `merged` → `409 hub.decisions.adr_already_opened`. Saves `adr_body`,
  `adr_path`, `adr_status = drafted`, event `field_changed(adrStatus)`, enqueues
  `decisions.adr.open_pr` (worker: commit on branch `adr/<key-lower>-<slug>` in the local clone,
  push, open PR titled `docs(adr): <title> (<key>)` via Octokit, store `adr_pr_url`,
  `adr_status = pr_opened`; failure → `failed` + notification to `pm`).
- Idempotent while `drafted`: a new call overwrites the draft before the PR job runs (job is
  debounced 60 s).
- Output: `ADR saved for GTV-142 → docs/adr/0017-moyasar-fee-on-platform.md · PR will open within a minute; check hub.get_decision.`

#### `create_need`

- Input:

```ts
z.object({
  title: z.string().min(3).max(200),
  kind: z.enum(['token','account','contract','value_check','file','access','other']),
  responsibleRole: Role,
  body: md(4_000).optional(),                  // what, why, where it will be used; NEVER the value
  blocks: z.array(key).max(10).default([]),
  dueAt: z.iso.datetime().optional(),
  priority: z.enum(['P0','P1','P2','P3']).default('P1'),
})
```

- Rules: strict secret filter (`token`/`access` kinds also reject any string ≥ 24 chars with no
  spaces inside `body`). Status `requested`; notifies holders of `responsibleRole`.
- Output: `Created GTV-178 — Moyasar live token · need (token) · responsible: owner · blocks GTV-139. The value must go to the vault/.env, never to Hub.`

#### `list_needs`

- Input: `z.object({ status: z.array(NeedStatus).default(['requested','in_progress']), responsibleRole: Role.optional(), blockingKey: key.optional(), limit })`.
- Output: table `| key | kind | responsible | status | age | blocks | title |`.

#### `comment`

- Input: `z.object({ key, body: md(10_000) })`. Mentions: `@user:<uuid>` or `@role:<role>`
  (the agent gets ids from `get_card`/member lists; `@role:` is enough in practice). Creates the
  comment, event `commented`, watcher for the author, notifications to mentioned users/roles and
  watchers. Not idempotent.
- Output: `Comment added to GTV-142 (c#3).`

#### `link_cards`

- Input: `z.object({ from: key, to: key, kind: z.enum(['blocks','blocked_by','relates','parent','duplicates']) })`.
  `blocked_by` is stored as the inverse `blocks`. Idempotent (unique index). Self-links and cycles
  of `blocks` are rejected (`422 hub.cards.link_cycle`).
- Output: `GTV-142 blocks GTV-139.`

#### `update_card`

- Generic edits on non-terminal cards (title, body, priority, due, module, tags, owner role) plus
  a few type-specific fields agents legitimately refine.
- Input:

```ts
z.object({
  key,
  title: z.string().min(3).max(200).optional(),
  body: md(20_000).optional(),
  priority: z.enum(['P0','P1','P2','P3']).optional(),
  dueAt: z.iso.datetime().nullable().optional(),
  module: z.string().max(60).nullable().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  ownerRole: Role.optional(),                  // pm/owner only
  detail: z.union([
    z.object({ type: z.literal('handoff'), summary: md(4_000).optional(), prompt: md(8_000).optional() }),
    z.object({ type: z.literal('task'), prompt: md(8_000).optional(), acceptance: md(4_000).optional(), effort: z.enum(['S','M','L','XL']).optional() }),
    z.object({ type: z.literal('release'), notes: z.object({ team: md(8_000).optional(), owner: md(8_000).optional(), accountant: md(8_000).optional() }) }),
  ]).optional(),
})
```

- Each changed field → `field_changed` event. Idempotent for equal values.
- Output: `GTV-175 updated: prompt, summary.`

#### `save_brief`

- Input:

```ts
z.object({
  kind: z.enum(['morning','weekly']).default('morning'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^\d{4}-W\d{2}$/).optional(),  // default: today / current ISO week in workspace tz
  narrative: md(8_000),
})
```

- Rules: `morning` upserts `briefs.narrative` for the member; `weekly` for the workspace
  (`pm`/`owner`). Upsert → idempotent.
- Output: `Brief saved for 2026-11-04 (morning). It is shown on your Today page.`

#### `list_my_sessions_without_summary`

- Input: `z.object({ sinceDays: z.number().int().min(1).max(30).default(7), limit: z.number().int().min(1).max(20).default(10) })`.
- Service: `SessionsQuery.withoutSummary(actor)`.
- Output:

```
2 sessions without summary
| session_id | started | repo/branch | commits | files |
| 7f3c…a1 | 2026-11-02 17:10 | backend/feat/refunds | 4 | 11 |
Write them with hub.log_session(session_id=…, changed=…). Git facts: hub.get_card(GTV-169).
```

### 2.5 Resources

| URI | Returns | Notes |
| --- | --- | --- |
| `hub://brief/today` | the member's morning brief sections (template) + narrative if saved | same text as the Today page |
| `hub://card/{key}` | card sheet (as `get_card` with comments) | |
| `hub://doc/{source}/{path}` | doc content (as `get_doc`) | `source` URL-encoded |
| `hub://decisions/open` | open decisions table, overdue first | all roles |
| `hub://handoffs/pending` | handoffs pending for the member's roles | |

Resources are read-only and workspace-scoped by the token. `resources/list` returns the two static
ones (`brief/today`, `decisions/open`, `handoffs/pending`) and templates for the parametrised ones.

### 2.6 Prompts (appear in Claude Code as `/hub:<name>`)

Registered with `server.registerPrompt(name, { title, description, argsSchema }, handler)`. The
handler fills `{{…}}` placeholders from the actor and returns one `user` message. Exact texts:

**`start`** (no args)

```
You are starting a work session for {{displayName}} (roles: {{roles}}) in Hub workspace "{{workspace}}".
Do this now:
1. Call hub.whats_new (omit `since` to use my last session) and hub.list_my_sessions_without_summary.
2. Read resource hub://brief/today.
3. Report in my language, in this order and briefly:
   (a) decisions and needs awaiting my roles, with deadlines (overdue first);
   (b) handoffs pending for my roles;
   (c) my sessions without summary — offer to write them now with hub.log_session (ask me what I did, then call it);
   (d) up to 5 ready tasks for my specialties, with keys;
   (e) notable changes by others since my last session.
4. Ask whether to save a short narrative (≤ 12 lines) with hub.save_brief so it shows on my Today page; do it if I agree.
5. End by asking which task to start, or suggest /hub:next.
Rules: refer to cards by key (e.g. GTV-123); never paste secrets into Hub; keep the report under 40 lines.
```

**`next`** (args: `key` optional)

```
Start the next task{{#key}} {{key}}{{/key}}.
1. {{#key}}Call hub.get_card("{{key}}").{{/key}}{{^key}}Call hub.list_tasks (status ready) for my specialties, show the top 3 (priority, then oldest) and ask me to confirm one.{{/key}}
2. Read what it links to: hub.get_card for linked cards, hub.get_decision for decisions it depends on, hub.get_doc for referenced docs. If an open `blocked by` link exists, stop and tell me what blocks it.
3. Call hub.claim_task with the key and the branch name you will use (`feat/<key-lower>-<slug>`). Follow the project's rule about asking before creating branches.
4. Call hub.update_task(status="in_progress") when you begin editing code.
5. While working: unclear business rule → hub.search_docs first, then hub.request_decision (never guess). Missing external thing (token, account, value) → hub.create_need (describe it, never the value). Your change affects another team → hub.create_handoff with a ready prompt for them.
6. Put the key in commit messages: "feat(scope): message (KEY)".
Run /hub:done when the task is complete or when you stop for the day.
```

**`done`** (no args)

```
Finish this session properly before you stop.
1. Collect from git: repo, branch, commits made since the session started (git log), files changed.
2. Write the summary: what changed (bullets with file paths / endpoints / schema changes), what remains, what another team must do (handoffs with a ready prompt), follow-up tasks you noticed.
3. Call hub.log_session with session_id = "{{sessionId}}" (from the Hub session context; if absent, ask me), repo, branch, changed, remaining, handoffs[], follow_ups[], cards[] (keys you worked on), commits[] (shas), duration_min.
4. For the task you claimed: hub.update_task(status="in_review") — or "done" if I tell you it is merged — with prUrl when a PR exists.
5. Reply with the keys Hub returned (session card, handoffs, follow-ups).
Rules: be specific; no secrets in any field; do not skip step 3 even if the session was short.
```

**`ask` is a skill, not a prompt (D26).** Claude Code splits MCP prompt arguments on whitespace, so
a prompt could receive only the first word of a question. Do not register an `ask` prompt. The team
pack ships `plugin/skills/ask/SKILL.md`, invoked as `/hub:ask <question>`, with the whole question in
`$ARGUMENTS`:

```markdown
---
name: ask
description: Answer a question about the project using Hub as the only source, with citations.
user-invocable: true
argument-hint: "<question>"
---

Answer my question using Hub as the only source.
1. hub.search_docs with the question and 1–2 rephrasings (try English and Arabic keywords; kind "any").
2. hub.get_doc for the best 1–3 results (use `section` to keep it small); hub.list_cards(q=…) for related decisions, tasks and needs.
3. Answer in my language with citations in the form (path § heading) or card keys. Quote exact values (names, limits, error codes) rather than paraphrasing them.
4. If the docs do not answer, say so clearly and offer to open a decision with hub.request_decision.
Question: $ARGUMENTS
```

**`decision`** (no args)

```
Help me open a decision in Hub.
1. Ask me (in one message) for: the question, the kind (product / technical / financial / design), who decides (role), the deadline, and the cards it blocks.
2. Draft 2–4 options with pros, cons and cost; mark at most one as recommended; check hub.search_docs for existing rules or ADRs that already answer it and tell me if one does.
3. Show the draft and ask for confirmation, then call hub.request_decision.
4. Reply with the key and the due date. Deciding is human-only: I will decide from the Hub page.
```

**`need`** (no args)

```
Help me record something we need from outside the code (token, account, contract, a value the accountant must verify, a file, access).
1. Ask me for: what it is, the kind, who is responsible (role), why we need it, and which cards wait on it.
2. Call hub.create_need. Never include the value itself anywhere; describe where it should be stored (e.g. "backend .env on prod as MOYASAR_SECRET").
3. Reply with the key. The responsible person will mark it delivered and verified from Hub.
```

**`adr`** (args: `key`)

```
Write the ADR for decision {{key}}.
1. hub.get_decision("{{key}}"). If it is not decided, stop and say so.
2. hub.search_docs for the affected area and read the related docs so the ADR cites the right files.
3. Write the ADR in English with this structure (same as the backend's docs/adr):
   # NNNN — <title>
   Status: Accepted · Date: <decided date> · Hub: {{key}}
   ## Context  (the question, the facts, the options considered with their trade-offs)
   ## Decision (the chosen option and the rationale recorded in Hub)
   ## Consequences (what changes in code, docs, settings; what becomes forbidden; follow-ups)
4. Call hub.draft_adr("{{key}}", body). Hub commits it on a branch and opens a pull request; report the PR URL from hub.get_decision when it appears.
```

**`weekly`** (no args; intended for pm/owner)

```
Write this week's summary for the workspace.
1. hub.whats_new(since = 7 days ago, limit 100) and hub.list_cards for decisions decided, handoffs applied, tasks done, needs verified, redesigns approved this week.
2. Write ≤ 25 lines in my language: shipped, decided, blocked (with who must act), risks, next week.
3. Call hub.save_brief(kind="weekly", narrative). It appears on the Today page of every member.
```

**`release-notes`** (args: `key`)

```
Write release notes for release card {{key}}.
1. hub.get_card("{{key}}") and hub.get_card for each included card (listed on the release).
2. Write three versions: team (technical, with keys), owner (what customers/operations gain), accountant (anything touching money: fees, refunds, currencies, ledger). Each ≤ 15 lines.
3. Call hub.update_card("{{key}}", detail={ type: "release", notes: { team, owner, accountant } }).
```

## 3. The team pack (Claude Code plugin)

### 3.1 Layout (`packages/team-pack/plugin/`)

```
plugin/
├── .claude-plugin/plugin.json
├── .mcp.json
├── skills/hub/SKILL.md
├── skills/ask/SKILL.md          (text in §2.6, D26)
├── hooks/hooks.json
├── hooks/session-start.mjs      hooks/session-end.mjs      hooks/session-end-send.mjs      hooks/lib.mjs
└── CLAUDE.md.snippet
```

The Hub repository root also carries `.claude-plugin/marketplace.json` so the repo is a
marketplace with one plugin (§3.7).

### 3.2 `plugin.json`

```json
{
  "name": "team-pack",
  "description": "Hub team pack: skill, session hooks and MCP connection for the team's Hub.",
  "version": "0.1.0",
  "author": { "name": "Alremaal Co" }
}
```

(`name` is required and must not contain spaces; the skill is then invokable as
`/team-pack:hub`; the MCP prompts stay `/hub:*` because the MCP server name is `hub`.)

### 3.3 `.mcp.json` (inside the plugin)

```json
{
  "mcpServers": {
    "hub": {
      "type": "http",
      "url": "${HUB_URL:-https://hub.goteav.lan}/mcp",
      "headers": { "Authorization": "Bearer ${HUB_TOKEN}" }
    }
  }
}
```

Facts: `${VAR}` and `${VAR:-default}` are expanded in `url` and `headers`; an unset variable
without default loads the server anyway, prints a warning and sends the literal text. Some
credential-looking names (`ANTHROPIC_API_KEY`, `NPM_TOKEN`, … "and others") are read as empty for
remote servers — **VERIFY** that `HUB_TOKEN` expands (`hub doctor` does this by calling
`claude mcp get hub` and a one-shot `claude -p "call hub.get_project_brief" --allowedTools mcp__hub__get_project_brief`);
if it does not, the installer falls back to `claude mcp add --transport http --scope user hub
"$HUB_URL/mcp" --header "Authorization: Bearer $HUB_TOKEN"` (literal token in `~/.claude.json`,
file permissions 600) and the plugin ships without `.mcp.json`.

Tool names in Claude Code are `mcp__hub__<tool>`; all Hub tool names are < 40 chars (limit 128).

### 3.4 `skills/hub/SKILL.md` (full text)

```markdown
---
name: hub
description: Work with the team's Hub — the shared timeline of tasks, decisions, needs, handoffs and docs. Use at the start of a session, when choosing a task, when a business rule is unclear, when something external is missing, when a change affects another team, and before finishing.
user-invocable: true
argument-hint: "[start|next|done|ask <question>]"
---

# Hub

Hub is the team's operations room. Every teammate's Claude Code is connected to it through the
`hub` MCP server. Cards are referenced by key (`GTV-123`). Hub holds no secrets and must never
receive one.

## When to call what

| Situation | Call |
| --- | --- |
| Session starts (or the context was injected by the hook) | `/hub:start` — or `hub.whats_new` + `hub://brief/today` |
| Choosing work | `/hub:next` — `hub.list_tasks` → `hub.claim_task(key, branch)` |
| You start editing code for a task | `hub.update_task(key, status="in_progress")` |
| A business rule, limit, name or flow is unclear | `hub.search_docs` → `hub.get_doc`; still unclear → `hub.request_decision` (never guess, never "assume") |
| A token, account, contract, value or access is missing | `hub.create_need` — describe it, never paste the value |
| Your change affects another team (API contract, shared component, data shape, design) | `hub.create_handoff(toRole, kind, severity, title, summary, prompt)` |
| You see work that should be done later | `hub.create_task` (lands in backlog) or put it in `follow_ups` of `log_session` |
| You want context on a card someone mentioned | `hub.get_card(key)` / `hub.get_decision(key)` |
| You stop (task done, end of day, context nearly full) | `/hub:done` — `hub.log_session` is mandatory, then `hub.update_task` |

## Conventions

- Branch names: `feat/<key-lower>-<slug>` (e.g. `feat/gtv-160-refund-contract-sync`). Ask the user before creating a branch if the project rules say so.
- Commit messages: Conventional Commits with the key at the end of the subject: `fix(payments): hold payment row during refund (GTV-139)`.
- Mention keys in PR titles and in handoff prompts.
- Hub's `session_id` for `log_session` comes from the "Hub session id" line injected at session start. If it is missing, ask the user to run `hub doctor` and pass what they give you.
- Human-only actions (decide, verify a need, approve a redesign, archive) are not available to you; tell the user to do them in Hub.
- Write Hub content in the language the team uses for that field: titles/summaries may be Arabic or English; keep file paths, endpoints and code identifiers verbatim.

## Before you finish — checklist

1. `hub.log_session` called with `changed`, `remaining`, `handoffs`, `follow_ups`, `cards`, `commits`.
2. Claimed task moved to `in_review`/`done`, `prUrl` set if a PR exists.
3. Any open question turned into `hub.request_decision`; any missing external item into `hub.create_need`.
4. No secret anywhere in what you sent.
```

### 3.5 Hooks

`hooks/hooks.json` (top-level `hooks` key, same shape as settings):

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\"", "timeout": 5 } ] }
    ],
    "PostToolUse": [
      { "matcher": "mcp__hub__log_session", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/mark-summary.mjs\"", "timeout": 3 } ] }
    ],
    "SessionEnd": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-end.mjs\"", "timeout": 10 } ] }
    ]
  }
}
```

Shared behaviour (`hooks/lib.mjs`): read stdin JSON; load `~/.hub/config.json`
(`{ url, token, workspace, caPath }`, fallback to env `HUB_URL`/`HUB_TOKEN`); never throw — on any
error write one line to stderr and exit 0 (hooks must not break the session); `fetch` with
`AbortSignal.timeout(ms)`; honour `NODE_EXTRA_CA_CERTS` for the internal CA.

**`session-start.mjs`** (stdin: `session_id`, `transcript_path`, `cwd`, `source` =
`startup | resume | clear | compact | fork`, …):

1. Write `~/.hub/sessions/<session_id>.json` = `{ startedAt, cwd, branch, headSha, remote }`
   (`git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`, `git remote get-url origin`, each
   with a 500 ms timeout; absent outside a repo). On `resume`/`compact`/`fork` keep the existing
   file (do not reset `headSha`).
2. `GET {url}/api/v1/me/context?cwd=<urlencoded cwd>` with the token, 2.5 s timeout. Hub answers
   `{ text }`: ≤ 8 500 chars of Markdown (member, roles, workspace, awaiting counts with keys,
   sessions without summary, top 5 ready tasks, last 5 changes, one-line usage hint).
3. Print exactly one JSON object:

```json
{ "hookSpecificOutput": { "hookEventName": "SessionStart", "additionalContext": "# Hub — context …\nHub session id: <session_id>\n…" } }
```

   (`additionalContext` is capped at 10 000 chars by Claude Code; the script trims to 9 500.)
4. If Hub is unreachable: `additionalContext` = `"Hub (https://hub.goteav.lan) is unreachable from this machine. Hub session id: <id>. Call hub.whats_new when it is back; run `hub doctor` to diagnose."`.

**`mark-summary.mjs`** (PostToolUse on `mcp__hub__log_session`): sets `summaryLogged: true`
and the returned card key in `~/.hub/sessions/<session_id>.json`. The SessionEnd script then
sends `has_summary: true`, so Hub never creates a facts-only card for this session.

**`session-end.mjs`** (stdin: `session_id`, `cwd`, `reason` = `clear | resume | logout |
prompt_input_exit | other`):

1. Read the session file; if none, exit 0 (nothing to report).
2. Collect Git facts (each command ≤ 500 ms, total budget 1 000 ms; skip on timeout):
   `git log --format=%H%x1f%s%x1f%aI <startSha>..HEAD`, `git diff --shortstat <startSha>..HEAD`,
   `git status --porcelain | count`, `git rev-parse HEAD`.
3. Write the payload to `~/.hub/outbox/<session_id>.json`, then **spawn a detached child**
   `node session-end-send.mjs <file>` (`detached: true, stdio: 'ignore', unref()`) and exit
   immediately. The parent finishes well under 1.5 s regardless of network.
4. `session-end-send.mjs`: `POST {url}/api/v1/capture/session` (10 s timeout, 3 attempts with
   2/5/10 s backoff); on success delete the outbox file; on failure keep it — `hub doctor --flush`
   and the next `session-start.mjs` retry pending outbox files.

Payload (`@hub/contracts/capture/hook-payload.ts`):

```ts
z.object({
  session_id: z.string().min(8).max(128),
  reason: z.enum(['clear','resume','logout','prompt_input_exit','other']).optional(),
  cwd: z.string().max(500),
  repo: z.object({ remote: z.string().max(300).optional(), name: z.string().max(100).optional() }).optional(),
  branch: z.string().max(120).optional(),
  start_sha: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  head_sha: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  commits: z.array(z.object({ sha: z.string(), subject: z.string().max(200), at: z.iso.datetime() })).max(200).default([]),
  dirty_files: z.number().int().min(0).optional(),
  files_changed: z.number().int().min(0).optional(),
  additions: z.number().int().min(0).optional(),
  deletions: z.number().int().min(0).optional(),
  started_at: z.iso.datetime(), ended_at: z.iso.datetime(), duration_sec: z.number().int().min(0),
  has_summary: z.boolean().default(false),
  client: z.object({ os: z.string().max(40), pack_version: z.string().max(20) }),
})
```

Timeout facts: SessionEnd hooks share a **1.5 s default timeout**; the docs describe two ways to
extend it (the per-hook `timeout` field above is one; the other was not captured) — **VERIFY** in
`hooks.md` § SessionEnd. The detached-child design makes the hook correct even at 1.5 s.
SessionEnd also fires on SIGTERM in `-p` runs; the script handles that identically.

### 3.6 `CLAUDE.md.snippet`

Appended by `hub init --claude-md` to the project's `CLAUDE.md` (or `.claude/CLAUDE.md`) between
`<!-- hub:start -->` / `<!-- hub:end -->` markers so it can be updated in place; files are
concatenated by Claude Code, so this is additive:

```markdown
<!-- hub:start -->
# Hub (team operations room)
- At session start read the injected "Hub — context" block, or call `hub.whats_new`.
- Never assume a business rule: `hub.search_docs` first; if still unclear, `hub.request_decision`.
- Something external missing (token, account, value, access): `hub.create_need` — describe it, never paste the value.
- Your change affects another team (API contract, shared component, data, design): `hub.create_handoff` with a ready prompt.
- Before finishing: `hub.log_session` (changed, remaining, handoffs, follow_ups, cards, commits), then `hub.update_task`.
- Card keys (GTV-123) go in branch names and commit subjects. Decide / verify / approve are human-only; ask the user to do them in Hub.
<!-- hub:end -->
```

The Goteav repositories (`backend`, `web`, `Goteav-Dashboard`) receive this snippet once (owner
PR); `hub` itself ships it in its own `CLAUDE.md`.

### 3.7 Marketplace and installation

`hub/.claude-plugin/marketplace.json` (repo root):

```json
{
  "name": "hub",
  "owner": { "name": "Alremaal Co" },
  "plugins": [
    { "name": "team-pack", "source": "./packages/team-pack/plugin", "description": "Hub team pack", "version": "0.1.0" }
  ]
}
```

Install commands (what `hub init` runs; shown so a teammate can do it by hand):

```bash
# private repo: the machine needs git credentials that do not prompt (gh auth login && gh auth setup-git)
claude plugin marketplace add Alremaal-Co/hub           # or a local clone path: claude plugin marketplace add ./hub
claude plugin install team-pack@hub --scope user
# one step on recent versions: claude plugin install team-pack --marketplace Alremaal-Co/hub
# later: claude plugin update team-pack@hub
```

Project-level enablement (optional, committed in each Goteav repo's `.claude/settings.json` so
new clones get the pack after the folder is trusted):

```json
{
  "extraKnownMarketplaces": { "hub": { "source": { "source": "github", "repo": "Alremaal-Co/hub" }, "autoUpdate": true } },
  "enabledPlugins": { "team-pack@hub": true }
}
```

Because the plugin source is a relative path inside the marketplace, enabling it this way installs
it after trust is accepted; if it is ever moved to an external source, each teammate runs the
`claude plugin install` line once. Auto-update is off by default for custom marketplaces;
`hub doctor` warns when the installed version is behind the Hub server's `GET /api/v1/team-pack/version`.

Fallback for a teammate without GitHub access to `hub`: Hub serves
`https://hub.goteav.lan/team-pack/marketplace.json` whose entry uses an `archive` source
(`{ "source": "archive", "url": "https://hub.goteav.lan/team-pack/team-pack-0.1.0.zip", "sha256": "…" }`,
built by CI from `packages/team-pack/plugin`); `claude plugin marketplace add https://hub.goteav.lan/team-pack/marketplace.json`.
**VERIFY** that an https marketplace URL with an archive source installs on the team's Claude Code
version; otherwise the installer copies the plugin folder from the zip into `~/.hub/plugin` and
adds a local-path marketplace.

### 3.8 Installer CLI — `npx @hub/team-pack init`

Published to the GitHub Packages npm registry of the org (or installed from the repo:
`pnpm --filter @hub/team-pack build && npm link`). Steps, each printed with ✓/✗:

1. **Ask** for `HUB_URL` (default `https://hub.goteav.lan`) and the personal token (pasted,
   hidden). Validate with `GET {url}/api/v1/me` (prints name, roles, workspace).
2. **Trust the CA**: download `http://hub.goteav.lan/ca.crt` (plain HTTP, bootstrap only), print
   its SHA-256 fingerprint and ask the user to compare it with Settings › System in Hub (or the
   owner's message), save to `~/.hub/hub-root-ca.crt`, then:
   - Windows: `certutil -user -addstore Root "%USERPROFILE%\.hub\hub-root-ca.crt"` (no admin;
     machine store `certutil -addstore Root …` needs an admin shell — printed as alternative)
   - macOS: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.hub/hub-root-ca.crt`
   - Linux (Debian/Ubuntu): `sudo cp ~/.hub/hub-root-ca.crt /usr/local/share/ca-certificates/hub-root-ca.crt && sudo update-ca-certificates`
   - For Claude Code / Node itself: user env var `NODE_EXTRA_CA_CERTS=<home>/.hub/hub-root-ca.crt`
     (Windows `setx NODE_EXTRA_CA_CERTS …`; Unix: appended to `~/.zshrc`/`~/.bashrc`/`~/.profile`
     between `# hub:start/end` markers). **VERIFY** that the team's Claude Code build honours
     `NODE_EXTRA_CA_CERTS` for MCP http servers; `hub doctor` tests it. If it does not, the owner
     decides between a public-CA certificate on the LAN name (DNS challenge) or an http-only MCP
     listener restricted to the LAN — both are an ADR, not an installer default.
3. **DNS**: resolve `hub.goteav.lan`; if it fails, print the hosts-file line
   (`<ip>  hub.goteav.lan`) and the exact command per OS (`notepad C:\Windows\System32\drivers\etc\hosts` as admin; `sudo sh -c 'echo "<ip> hub.goteav.lan" >> /etc/hosts'`). Never edit it silently (needs admin).
4. **Config**: write `~/.hub/config.json` (`{ url, token, workspace, caPath, packVersion }`, mode
   600) and set user env vars `HUB_URL`, `HUB_TOKEN` (Windows `setx`; Unix profile markers). Tell
   the user to open a new terminal.
5. **Plugin**: run the marketplace add + install commands (§3.7); `claude plugin validate` on the
   installed path.
6. **CLAUDE.md** (optional `--claude-md <repoPath>`): insert the snippet.
7. **Doctor** (§3.9).

Other commands: `hub doctor [--flush]`, `hub token` (rotate: revokes the stored token via
`DELETE /api/v1/me/tokens/current` and asks for a new one), `hub uninstall` (removes plugin, env
vars, config; leaves the CA unless `--ca`).

### 3.9 `hub doctor`

| Check | How | Pass criterion |
| --- | --- | --- |
| DNS | resolve `HUB_URL` host | resolves to the LAN IP |
| TLS | `fetch(HUB_URL + '/health/live')` with `NODE_EXTRA_CA_CERTS` | 200, certificate chain valid |
| Token | `GET /api/v1/me` | 200, prints member + roles + token last-used |
| Plugin | `claude plugin list` contains `team-pack@hub` | yes, version matches server's `GET /api/v1/team-pack/version` |
| MCP registration | `claude mcp get hub` | url and header present (token masked) |
| MCP round-trip | `claude -p "Call the tool hub.get_project_brief and print its first line" --allowedTools mcp__hub__get_project_brief --max-turns 2 --output-format json` | result contains the workspace name (also proves `${HUB_TOKEN}` expansion and the CA) |
| Hooks | `claude --debug` not required: run `node session-start.mjs` with a fixture stdin | prints valid JSON with `additionalContext` |
| Outbox | `~/.hub/outbox/*.json` | empty, or `--flush` re-sends them |

## 4. Tokens

- Created in **Settings › Tokens** (web only): name, kind (`mcp` default; `hook` = restricted to
  `/capture/*` and `/me/context`), belonging to the member and not to a project (15 §5). Shown **once** as
  `hub_<prefix8><32 random chars>`; stored `prefix` + `sha256`. Columns: last used, created,
  revoke button; `pm`/`owner` can revoke any member's tokens from Members.
- One token serves every project the member is in. `hub link <slug>` writes `X-Hub-Project` into a folder's
  `.mcp.json`, so a chat opened there is on that project.
- Roles are resolved live on every call (membership edit takes effect immediately); revocation
  takes effect immediately (no caching of token validity beyond the request).
- Audit: every MCP call that mutates writes `audit_log` with `via = 'mcp'` and the token id;
  Settings › Audit filters by token.

## 5. Session reconciliation (hook ↔ `log_session`)

| Event | Hub action |
| --- | --- |
| `log_session` arrives first | upsert `session_logs` (summary), create change card `kind=session`, handoffs, follow-ups; `external_key = session:<id>` |
| hook arrives first (`has_summary=false`) | upsert `session_logs` (hook payload); schedule job `sessions.reconcile(session_id)` at `+hook_grace_minutes` (10) |
| job runs, still no summary | create change card from Git facts, body = `DigestFacade.render('session_fallback')`, flag `session.noSummary = true`, event `session_logged { hasSummary: false }`; it appears in `list_my_sessions_without_summary` and in the next SessionStart context |
| `log_session` arrives later for the same `session_id` | **upgrade** the same card: body = summary, `noSummary = false`, new event `session_logged { hasSummary: true, upgraded: true }`; handoffs/follow-ups created now |
| hook arrives after the summary | merge Git facts into `change_details` (commits, diff numbers); no new card |
| hook with `has_summary=true` but no summary row (mark-summary raced) | wait 2 min then reconcile as above |
| duplicate hook (SessionEnd on `clear` then exit) | idempotent upsert; `ended_at` = latest |

Matching is strictly by `session_id` + workspace of the token. Commits reported by the hook are
also matched to GitHub commit cards (by sha) when the GitHub adapter sees them, linking the session
card to the commit-group card (`relates`).

## 6. Compliance notes

Verbatim from `code.claude.com/docs/en/legal-and-compliance` ("Authentication and credential use")
as read on 2026-11-03:

> "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Ultra,
> Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code
> and other native Anthropic applications."

> "Developers building products or services that interact with Claude's capabilities, including
> those using the Agent SDK, should use API key authentication through Claude Console or a
> supported cloud provider."

> "Anthropic does not permit third-party developers to offer Claude.ai login into their own
> applications, or to route requests through Free, Pro, Max, or Ultra plan credentials on behalf
> of their users."

Why Hub's design is the ordinary case: each member runs Claude Code on their own machine with
their own subscription; Hub is an MCP server that gives that agent data and receives its results,
exactly like any other MCP integration. Hub never holds an Anthropic credential, never spawns
`claude`, never routes a request for another person.

If server-side generation is ever wanted (e.g. polishing briefs for members without Claude Code):
an ADR; an API key from Claude Console in the worker env (`ANTHROPIC_API_KEY`), a budget cap
(`--max-budget-usd` or SDK equivalent), a `digests.ai_polish` setting, and `claude -p --bare
--mcp-config …` or the SDK — never a subscription login or `claude setup-token` on the host.

## 7. Tests

| Layer | What | How |
| --- | --- | --- |
| Tool unit | each tool's schema, permission rule, output shaping | SDK in-memory transport: `Client` + `InMemoryTransport.createLinkedPair()` against `HubMcpServerFactory.build(fakeActor)` with fake services; snapshot the Markdown output per fixture |
| Prompt unit | every prompt renders with/without args, placeholders filled | same harness, `prompts/get` |
| Resource unit | templates resolve, unknown key → not found | same harness |
| Tool e2e | `POST /mcp` over Streamable HTTP with a real token through Testcontainers DB | `apps/api/test/e2e/mcp.e2e-spec.ts`: initialize → tools/list → claim_task → log_session → assert cards/events/notifications rows; 401 without token; 403 human-only via REST with an agent token |
| Secret filter | tool inputs containing fixture secrets are rejected with the pattern name | table-driven |
| Plugin | `claude plugin validate ./packages/team-pack/plugin --strict` in CI | exit 0 |
| Hooks | `session-start.mjs`, `session-end.mjs`, `mark-summary.mjs` with fixture stdin + a local mock Hub (`node:http`) | asserts JSON output, payload shape (`hook-payload.ts`), outbox fallback, exit 0 on all failures, parent exit < 300 ms |
| Installer | `hub init` in a temp HOME with `claude` mocked on PATH | config written 600, env markers idempotent, doctor table |
| Reconciliation | hook-first / summary-first / upgrade / duplicate sequences | `SessionsService` unit + e2e with the reconcile job run inline |
