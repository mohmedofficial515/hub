# 04 — API reference

The HTTP contract of `apps/api`. `apps/web` is generated from it (§5); `modules/mcp` calls the
same application services, so every MCP tool in `05-mcp-and-claude-code.md` maps to an endpoint
here. Shapes are written as TypeScript; the Zod schemas live in `@hub/contracts` and
`apps/api/src/modules/<module>/application/dto`. Data model names refer to `03-data-model.md`.

## 1. Conventions

### 1.1 Base path and versioning

- All routes under `/api/v1`. Workspace-scoped routes take the workspace **slug**:
  `/api/v1/workspaces/{ws}/…` (`ws` = `Workspace.slug`, e.g. `goteav`).
- Breaking changes bump `/v2`; additive changes do not. The web client is regenerated on every
  API change (§5), so additive changes are safe.
- JSON only (`Content-Type: application/json; charset=utf-8`), except SSE (§4) and the
  `text/plain` hook context endpoint (§3.16).

### 1.2 Envelope

```ts
// success
{ data: T, meta?: { pagination?: Pagination, [k: string]: unknown } }
// failure
{ error: { code: `hub.${string}`, message: string /* localised */, details?: Record<string, unknown>, requestId: string } }
```

`message` is translated with `nestjs-i18n` from `i18n/{en,ar}/errors.json`; `code` is stable
and is what clients branch on. `details` carries machine-readable context (field paths for
validation, `from`/`to` for transitions, `pattern` for secret detection — never the secret).

### 1.3 Pagination

Cursor-based on every list: `?cursor=<opaque>&limit=<1..100, default 25>`.

```ts
type Pagination = { nextCursor: string | null; limit: number; total?: number /* only when cheap: inbox count, members */ }
```

Cursors encode `(sortKey, id)` base64url; lists are stable under inserts. Sort is fixed per
endpoint (documented inline). `?cursor` from another endpoint → `400 hub.common.validation`.

### 1.4 Idempotency

- `POST` routes that **create cards** (`POST /cards`, `/capture/session`, `/handoffs/{key}/apply`
  with `createTask`, `/redesign/{key}/approve`, `/ideas/{key}/to-plan`, `/plans/{key}/to-tasks`) accept `Idempotency-Key: <≤128 chars>`. The key is
  stored with the actor id and a SHA-256 of the body for 24 h (Redis). Same key + same body →
  the original response replayed (header `Idempotent-Replay: true`); same key + different body →
  `422 hub.common.idempotency_key_reused`.
- Adapters never go through HTTP; they rely on `Card.externalKey` (03 §5.1).
- An MCP tool has no route, so it calls `IdempotencyService.run(userId, toolName, toolCallId, input, work)` itself, the
  same rule and store. A failed call stores nothing and may be retried.

### 1.5 Localisation

- `Accept-Language: ar | en` selects error messages and **server-rendered text** (notification
  titles, digests). Falls back to the member's `User.locale`, then the workspace
  `defaultLocale`, then `en`.
- All timestamps are ISO-8601 UTC strings. The client formats with the workspace timezone
  (`Workspace.timezone`, returned on `GET /workspaces/{ws}`).

### 1.6 Actor resolution and authentication

Every request resolves to an `Actor`:

```ts
// packages/contracts/src/actor.ts. Credentials give a Principal, which belongs to no project.
type Principal =
  | { kind: 'user';  userId: string; via: 'web' }                       // cookie session
  | { kind: 'agent'; userId: string; via: 'mcp';  tokenId: string }     // api token kind=mcp
  | { kind: 'hook';  userId: string; via: 'hook'; tokenId: string };    // api token kind=hook
// Choosing a project and reading live roles gives an Actor, which every mutation takes.
type Actor = (Principal & { workspaceId: string; roles: Role[] })
  | { kind: 'system'; userId: null; via: 'adapter' | 'import' | 'scheduler'; workspaceId: string; roles: [] };
```

| Mechanism | How | Notes |
| --- | --- | --- |
| Cookie session | `hub_access` (JWT, 15 min, `jose` HS256 with `HUB_JWT_SECRET`), `hub_refresh` (opaque, 30 days, `Path=/api/v1/auth/refresh`), `hub_session` (`1`, no secret, 30 days, `Path=/`, tells the web middleware a session may be alive once `hub_access` has gone) — all `HttpOnly; SameSite=Lax`, and `Secure` when `HUB_PUBLIC_URL` is https (15 D33 runs on plain http://localhost). Signing out, ending a session and disabling a member take effect on the next request, because the session row is read each time. | Refresh rotation per family; reuse of a rotated token revokes the family (`401 hub.identity.refresh_invalid`). |
| API token | `Authorization: Bearer hub_<prefix8>_<secret>` | Lookup by `prefix`, compare SHA-256. The token belongs to the member. The project is the `{ws}` in the path; on MCP it is the `project` argument, else the `X-Hub-Project` header, else the member's default project (15 §5). A project the member is not in → `404 hub.workspaces.not_found`. `kind=hook` tokens may only call `/capture/*`, `/me` and `/me/context` → else `403 hub.identity.token_scope`. Roles are resolved live from `Membership.roles` on every call. `lastUsedAt` updated at most once per minute. |
| CSRF | Cookie requests to mutating methods must send `X-Requested-With: hub` (custom header → CORS preflight). Same-origin only (`CORS` allows `https://hub.goteav.lan` and the configured `HUB_PUBLIC_URL`). | |
| TOTP | Members holding a role in `security.totp_required_roles` must have TOTP enabled; otherwise every workspace route answers `403 hub.identity.totp_setup_required` until they enrol. Sign-in returns `totpRequired` when enabled. | |

The actor kind is recorded, never used to refuse (D27).

### 1.7 Rate limits (`infra/throttler/rate-limit.guard.ts`, one fixed window per scope in Redis)

| Scope | Limit | Code |
| --- | --- | --- |
| `/auth/sign-in`, `/auth/password/*`, `/auth/totp/verify`, `/auth/totp/recover`, `/auth/invites/*` | 10 / min / IP, per route | `429 hub.common.rate_limited` |
| API token (`mcp`) | 120 / min / token | |
| API token (`hook`) | 60 / min / token | |
| Cookie session, other routes | 600 / min / user | |
| `GET /search`, `/docs/search` | 60 / min / actor | |

Response carries `Retry-After` seconds.

### 1.8 Common types

```ts
type Role = 'owner' | 'pm' | 'accountant' | 'backend' | 'frontend' | 'designer' | 'qa';
type CardType = 'task' | 'decision' | 'need' | 'change' | 'handoff' | 'redesign' | 'doc' | 'release' | 'idea' | 'plan';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';
type CardKey = `${string}-${number}`;              // "GTV-123"; regex ^[A-Z]{2,6}-\d+$
type Markdown = string;                           // secret-filtered on input; limits per field
type Specialty = 'backend' | 'frontend' | 'design' | 'qa' | 'ops' | 'docs';
type Effort = 'S' | 'M' | 'L' | 'XL';
type ActorRef = { kind: 'user' | 'agent' | 'system'; userId: string | null; displayName: string | null; via: 'web' | 'mcp' | 'hook' | 'adapter' | 'import' | 'scheduler' };

type CardSummary = {
  id: string; key: CardKey; type: CardType; title: string; status: string; priority: Priority;
  ownerRole: Role | null; assignee: { id: string; displayName: string; avatarColor: string } | null;
  module: string | null; repo: string | null; branch: string | null; tags: string[];
  dueAt: string | null; closedAt: string | null; archivedAt: string | null;
  commentCount: number; lastEventAt: string; createdAt: string; createdBy: ActorRef; source: string;
  flags: { blocked: boolean; overdue: boolean; escalated: boolean; stale: boolean; noSummary: boolean };
  blocksCount: number;                              // open cards waiting on this one
  awaiting: string | null;                          // the verb waiting on the current member (`awaitedAction` in @hub/contracts)
};
type CardFull = CardSummary & {
  body: Markdown | null;
  detail: TaskDetail | DecisionDetail | NeedDetail | ChangeDetail | HandoffDetail | RedesignDetail | DocDetail | ReleaseDetail | IdeaDetail | PlanDetail;
  links: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates'; card: CardSummary }[];
  watchers: { userId: string; displayName: string; reason: string }[];
  attachments: { id: string; kind: string; name: string; url: string; width: number | null; height: number | null }[];
  watching: boolean;                                // for the current actor
  allowedActions: string[];                         // the §2 rows the current actor holds on this card, whatever its status
  actions: AvailableAction[];                       // what the card offers now, in display order: `actionsFor` in @hub/contracts
  awaitedAction: AvailableAction | null;            // the action that keeps it waiting on this member (review B2)
};
// Reads and buttons share one rule, derived from state: a card waits on me while I have an enabled, awaited action in my role.
type AvailableAction = { action: string /* verb */; permission: string /* §2 row */; enabled: boolean; needsRole?: Role;
  mode: 'form' | 'confirm' | 'now'; destructive?: boolean; reason?: boolean; selfVerify?: boolean; targetKey?: CardKey /* a redesign's port task */ };
// A write answers CardFull plus `event: { id, seq, kind }`, the event it produced.
// detail DTOs mirror 03 §6 column-for-column (camelCase), with user ids expanded to { id, displayName } where *ById exists.
type Event = { id: string; seq: number; kind: string; actor: ActorRef; via: string; data: Record<string, unknown>; createdAt: string };
type Comment = { id: string; author: ActorRef; via: string; body: Markdown | null; redacted: boolean; createdAt: string; editedAt: string | null };
```

Validation limits: `title` 1–200; `body` ≤ 20 000; `comment.body` 1–10 000; `tags` ≤ 20 items of
1–40 chars `[a-z0-9-]`; `module` ≤ 40; `options` 2–8 items. Any free-text field passes the secret
filter (`422 hub.security.secret_detected`, `details.pattern`, `details.field`).

### 1.9 Error catalogue

| Code | HTTP | When |
| --- | --- | --- |
| `hub.common.validation` | 400 | Zod failure; `details.issues[] = { path, message }` |
| `hub.common.unauthorized` | 401 | no/invalid credentials |
| `hub.common.forbidden` | 403 | role or ownership check failed (generic) |
| `hub.common.not_found` | 404 | route or resource |
| `hub.common.conflict` | 409 | unique violation (P2002) not covered by a specific code |
| `hub.common.payload_too_large` | 413 | body > 1 MB |
| `hub.common.idempotency_key_reused` | 422 | same key, different body |
| `hub.common.rate_limited` | 429 | §1.7 |
| `hub.common.internal` | 500 | unexpected; `requestId` for logs |
| `hub.common.unavailable` | 503 | Postgres/Redis down, readiness failing |
| `hub.identity.invalid_credentials` | 401 | wrong email/password (same message for unknown email) |
| `hub.identity.locked` | 423 | lockout (03 §2); `details.retryAfterSec` |
| `hub.identity.totp_required` | 401 | password ok, TOTP enabled; `details.challenge` |
| `hub.identity.totp_invalid` | 401 | wrong/expired TOTP code |
| `hub.identity.totp_setup_required` | 403 | role requires TOTP, not enrolled |
| `hub.identity.totp_already_enabled` / `totp_not_enabled` | 409 | enrolment state |
| `hub.identity.session_expired` | 401 | access JWT expired/invalid → client calls refresh |
| `hub.identity.refresh_invalid` | 401 | refresh revoked, expired, or reused |
| `hub.identity.token_invalid` | 401 | bearer token malformed or unknown |
| `hub.identity.token_revoked` | 401 | API token revoked |
| `hub.identity.token_scope` | 403 | hook token outside `/capture/*`, `/me`, `/me/context` |
| `hub.identity.account_disabled` | 403 | `User.status=disabled` |
| `hub.identity.invite_invalid` | 404 | token unknown |
| `hub.identity.invite_expired` | 410 | past `expiresAt` |
| `hub.identity.invite_accepted` | 409 | already accepted |
| `hub.identity.email_taken` | 409 | sign-up with existing email |
| `hub.identity.password_weak` | 400 | < 12 chars or in the 10k common list |
| `hub.identity.reset_invalid` | 404 | reset token unknown/used/expired |
| `hub.workspaces.slug_taken` / `key_prefix_taken` | 409 | create workspace |
| `hub.workspaces.not_found` | 404 | no such project, or the actor is not an active member of it (15 §5) |
| `hub.workspaces.no_project` | 400 | MCP call with no argument, header or default project |
| `hub.workspaces.closed` | 409 | mutation on a closed project |
| `hub.workspaces.last_owner` | 409 | removing/demoting the last active owner |
| `hub.workspaces.role_invalid` | 400 | unknown role key |
| `hub.workspaces.member_removed` | 409 | acting on a removed membership |
| `hub.workspaces.setting_unknown` | 404 | key not in catalogue |
| `hub.workspaces.setting_invalid` | 400 | value fails the key's schema |
| `hub.workspaces.source_kind_invalid` | 400 | |
| `hub.workspaces.source_dependency_missing` | 422 | `openapi`/`docs_folder` without a valid `repoSourceId` |
| `hub.workspaces.source_connection_failed` | 422 | test-connection failed; `details.reason` |
| `hub.workspaces.source_run_in_progress` | 409 | run-now while a run is active |
| `hub.cards.not_found` | 404 | key unknown in this workspace |
| `hub.cards.type_mismatch` | 409 | action not valid for the card's type |
| `hub.cards.invalid_transition` | 409 | `details.from`, `details.to` |
| `hub.cards.archived` | 409 | mutation on a deleted card; restore it first |
| `hub.cards.link_self` | 400 | |
| `hub.cards.link_exists` | 409 | |
| `hub.cards.link_cycle` | 409 | `blocks`/`parent` would form a cycle |
| `hub.cards.comment_not_found` | 404 | |
| `hub.cards.comment_not_author` | 403 | edit by someone else |
| `hub.cards.external_key_exists` | 409 | adapter/import duplicate (internal) |
| `hub.tasks.already_claimed` | 409 | `details.claimedBy` |
| `hub.tasks.not_claimer` | 403 | start/submit/done by someone else (owner/pm exempt) |
| `hub.tasks.specialty_role_mismatch` | 403 | claiming outside own specialty (owner/pm exempt) |
| `hub.tasks.blocked` | 409 | claiming a task an open card blocks |
| `hub.decisions.not_decider` | 403 | actor lacks `deciderRole` |
| `hub.decisions.already_decided` | 409 | |
| `hub.decisions.option_not_found` | 404 | |
| `hub.decisions.options_min` | 400 | fewer than 2 options |
| `hub.decisions.adr_source_missing` | 422 | no `docs_folder`/`github_repo` to open the PR in |
| `hub.decisions.adr_not_drafted` | 409 | open-pr before a draft exists |
| `hub.decisions.adr_already_open` | 409 | PR already opened |
| `hub.decisions.adr_pr_failed` | 502 | GitHub refused; `details.reason` |
| `hub.needs.not_responsible` | 403 | |
| `hub.needs.location_required` | 400 | deliver without `location` |
| `hub.needs.self_verify_note_required` | 400 | verifying your own delivery without a note (D24) |
| `hub.handoffs.not_recipient` | 403 | actor lacks `toRole` |
| `hub.handoffs.already_acknowledged` | 409 | |
| `hub.redesign.owner_only` | 403 | approve/reject by non-owner |
| `hub.redesign.not_in_review` | 409 | approve/reject while not `review` |
| `hub.redesign.lab_unavailable` | 503 | lab source disabled or folder missing |
| `hub.redesign.write_failed` | 500 | front-matter write/commit failed; `details.reason` |
| `hub.docs.not_found` | 404 | |
| `hub.docs.reindex_running` | 409 | |
| `hub.docs.image_not_found` | 404 | the image is missing, in a folder the source leaves out (`.git`, `node_modules`, its `exclude`), behind a link out of the source, or on a paired device |
| `hub.docs.image_too_large` | 413 | over 10 MB; `details.maxBytes` |
| `hub.docs.image_type_refused` | 415 | not png, jpg, jpeg, gif, webp or svg |
| `hub.docs.image_bad_path` | 422 | absolute, a scheme or any `:`, a backslash, a NUL, or a `..` above the source |
| `hub.capture.payload_invalid` | 400 | hook body fails `HookSessionPayload` |
| `hub.capture.import_running` | 409 | |
| `hub.capture.source_disabled` | 409 | |
| `hub.notifications.push_invalid_subscription` | 400 | |
| `hub.notifications.telegram_code_invalid` | 404 | |
| `hub.notifications.telegram_already_linked` | 409 | |
| `hub.notifications.channel_invalid` | 400 | |
| `hub.github.auth_failed` | 502 | token rejected |
| `hub.github.rate_limited` | 503 | secondary rate limit; `Retry-After` |
| `hub.github.repo_not_found` | 502 | |
| `hub.github.clone_failed` | 500 | |
| `hub.plans.step_not_found` | 404 | |
| `hub.plans.revision_not_found` | 404 | |
| `hub.security.secret_detected` | 422 | `details.pattern`, `details.field` |

## 2. Permission matrix

The executable table is `packages/contracts/src/permissions.ts`. This one explains it, and the code wins.

Legend: `✓` allowed · `R` allowed when the card's routed role (`ownerRole` / `deciderRole` /
`responsibleRole` / `toRole`) is one of the actor's roles · `S` allowed when the task's
`specialty` maps to the actor's role (`backend→backend`, `frontend→frontend`, `design→designer`,
`qa→qa`, `ops`/`docs`→`backend|frontend`) · `A` assignee/claimer only · `C` creator only ·
`V` the need's routed role, its requester, or whoever delivered it (D24) · `✗` not allowed. `owner` implies every `pm` right, except where a row says otherwise.

**Actor kind plays no part (D27):** a member's Claude Code may do whatever the member may do. The only
actions refused to MCP are those that carry a secret value (own API tokens, own profile and channels, a
source's secret); they have `surface: web_only` and no tool. Hook tokens stay limited to `/capture/*`, `/me`
and `/me/context`.

| Action | owner | pm | accountant | backend | frontend | designer | qa |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create task | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create decision | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create need | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create handoff | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create release | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create change / redesign / doc | system only (adapters, `log_session`) | | | | | | |
| Edit title/body/tags/module | ✓ | ✓ | C | C | C | C | C |
| Edit priority / dueAt / ownerRole / assignee | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Task: claim / unclaim | ✓ | ✓ | ✗ | S | S | S | S |
| Task: start / submit-review / done | ✓ | ✓ | ✗ | A | A | A | A |
| Task: complete or resume from review | ✓ | ✓ | ✗ | A | A | A | ✓ |
| Task: cancel / reopen | ✓ | ✓ | ✗ | C | C | C | C |
| Task: edit specialty/effort/acceptance/prompt | ✓ | ✓ | ✗ | S | S | S | S |
| Decision: edit options (while open) | ✓ | ✓ | C | C | C | C | C |
| Decision: decide | ✓ | R | R | R | R | R | R |
| Decision: withdraw | ✓ | ✓ | C | C | C | C | C |
| Decision: supersede | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Decision: draft ADR body | ✓ | ✓ | R | R | R | R | R |
| Decision: open ADR PR | ✓ | ✓ | R | R | R | R | R |
| Need: start / deliver | ✓ | ✓ | R | R | R | R | R |
| Need: verify / reject delivery (D24) | ✓ | ✓ | V | V | V | V | V |
| Need: cancel | ✓ | ✓ | C | C | C | C | C |
| Handoff: acknowledge / dismiss | ✓ | ✓ | R | R | R | R | R |
| Handoff: apply (D25) | R | R | R | R | R | R | R |
| Redesign: submit for review | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Redesign: approve / reject | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Redesign: request changes | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Redesign: mark ported | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Release: edit included / notes / mark released | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Delete / restore card (D28) | ✓ | ✓ | C | C | C | C | C |
| Comment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report work (docs/16 §7.2) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit own comment (15 min) | C | C | C | C | C | C | C |
| Redact comment | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Link / unlink | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Watch / unwatch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read any non-archived card, timeline, docs, search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read deleted cards | ✓ | ✓ | C | C | C | C | C |
| Idea: create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Idea: edit / explore / accept / park / reject / reopen / turn into a plan | ✓ | ✓ | C | C | C | C | C |
| Plan: create | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Plan: edit / submit for review / start / finish / abandon / create tasks from steps | ✓ | ✓ | C | C | C | C | C |
| Plan: approve | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Plan: request changes | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Plan: add evidence to a step | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Plan: remove a step's evidence | ✓ | ✓ | C | C | C | C | C |
| Plan: remove evidence you added | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Project: create (D30) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Members: invite, change roles, remove, GitHub identity (only an owner grants, takes or removes the owner role, or gets an owner's reset link) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Project: edit details | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Project: close, reopen | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Settings: read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Settings: write | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Sources: manage, run-now, import | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Own API tokens: create/revoke | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Own profile, channels, push, Telegram | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Briefs: read own; save narrative | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit log: read | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Docs: reindex now | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

`CardFull.allowedActions`, `actions` and `awaitedAction` are computed from this table, so the UI never guesses.
Rows of `surface: system` (`card.unblock`, `plan.sync_step`, `task.close_as_ported`, `redesign.create`, `doc.create`,
`change.create`) belong to nobody: adapters run them, or they follow from an action already permitted.

## 3. Endpoints

Format of each entry:

```
METHOD /path                                   auth: session | token | hook | public   role: …
body: …          200|201: …          errors: …          effects: …
```

`token` means an `mcp` API token is accepted in addition to a session. Unless stated, every
workspace route requires an active membership (else `404 hub.workspaces.not_found`) and refuses
mutations on a closed project (`409 hub.workspaces.closed`). One apply writes one event per card touched (03 §5.2), so the entries below name that one event.

### 3.1 Health and metrics

```
GET /health/live                                auth: public
200: { data: { status: 'ok', version: string, uptimeSec: number } }

GET /health/ready                               auth: public
200: { data: { status: 'ok', checks: { postgres: 'ok', redis: 'ok', reposVolume: 'ok' } } }
503: hub.common.unavailable with details.checks

GET /metrics                                    auth: `Authorization: Bearer <METRICS_TOKEN>`; no token set or a wrong one answers 404. No /api/v1 prefix.
200: text/plain Prometheus exposition
```

### 3.2 Auth

```
POST /auth/sign-in                              auth: public   rate: 10/min/IP
body: { email: string; password: string }
200: { data: { user: Me; totpRequired: false } }                      // sets hub_access + hub_refresh + hub_session
200: { data: { totpRequired: true; challenge: string } }              // no cookies yet; challenge valid 5 min
errors: identity.invalid_credentials 401 · identity.locked 423 · identity.account_disabled 403
effects: LoginAttempt row; audit identity.sign_in

POST /auth/totp/verify                          auth: public   rate: 10/min/IP
body: { challenge: string; code: string /* 6 digits */ }
200: { data: { user: Me; totpRequired: false } }                      // sets cookies
errors: identity.totp_invalid 401

POST /auth/totp/recover                         auth: public   rate: 10/min/IP
body: { challenge: string; recoveryCode: string }
200: { data: { user: Me; totpRequired: false } }                      // sets cookies; the code is spent
errors: identity.totp_invalid 401

POST /auth/refresh                              auth: hub_refresh cookie
200: { data: { expiresAt: string } }                                  // rotates both cookies
errors: identity.refresh_invalid 401
effects: Session row replaced (replacedById); reuse detection revokes the family. A replaced token still rotates for 30 s after its first replacement while its family is alive (D35)

POST /auth/sign-out                             auth: session
204
effects: current refresh family revoked; cookies cleared

GET /auth/me                                    auth: session | token
200: { data: Me }
type Me = { id; email; displayName; locale; avatarColor; totpEnabled: boolean; createdAt; defaultProject: string | null;
            workspaces: { id; slug; name; keyPrefix; status; roles: Role[]; timezone; defaultLocale; totpRequired: boolean }[] }

POST /auth/password/forgot                      auth: public   rate: 10/min/IP
body: { email: string }
202 always (no enumeration)
effects: PasswordReset row (1 h) + email if the user exists

POST /auth/password/reset                       auth: public
body: { token: string; password: string }
204
errors: identity.reset_invalid 404 · identity.password_weak 400
effects: all sessions revoked; audit

POST /auth/password/change                      auth: session
body: { current: string; next: string }
204
errors: identity.invalid_credentials 401 · identity.password_weak 400
effects: other refresh families revoked

POST /auth/totp/setup                           auth: session
201: { data: { secret: string; otpauthUrl: string; qrDataUrl: string } }   // secret stored encrypted, not yet enabled
errors: identity.totp_already_enabled 409

POST /auth/totp/confirm                         auth: session
body: { code: string }
200: { data: { recoveryCodes: string[] /* 8, shown once, stored hashed */ } }
errors: identity.totp_invalid 401
effects: totpEnabledAt set; audit

DELETE /auth/totp                               auth: session
body: { code: string }
204     errors: identity.totp_not_enabled 409 · identity.totp_invalid 401 · identity.totp_setup_required 403 (if a role requires it)

GET /auth/sessions                              auth: session
200: { data: { familyId; userAgent; ip; createdAt; lastUsedAt; current: boolean }[] }
DELETE /auth/sessions/{familyId}                auth: session   204
POST /auth/sessions/revoke-all                  auth: session   204   (keeps the current family)

GET /auth/invites/{token}                       auth: public
200: { data: { email; workspace: { slug; name }; roles: Role[]; expiresAt; invitedBy: string } }
errors: identity.invite_invalid 404 · identity.invite_expired 410 · identity.invite_accepted 409

POST /auth/invites/{token}/accept               auth: public | session (existing user joining another workspace)
body: { displayName?: string; password?: string; locale?: 'ar' | 'en' }   // required when no session
201: { data: { user: Me; workspace: { slug } } }                     // sets cookies when created
errors: as above · identity.email_taken 409 (email exists and no session) · identity.password_weak 400
effects: User (if new) + Membership(roles from invite); invite accepted; audit; notification `system` to owner/pm "X joined"
```

### 3.3 Me — profile, tokens, preferences

```
PATCH /me                                        auth: session
body: { displayName?: string; locale?: 'ar' | 'en'; avatarColor?: string }
200: { data: Me }

PUT /me/default-project                          auth: session | token   (switch_project, 15 §5)
body: { slug: string }
200: { data: Me }
errors: workspaces.not_found 404

GET /me/tokens                                   auth: session
200: { data: { id; name; kind: 'mcp' | 'hook'; prefix; lastUsedAt; createdAt; revokedAt }[] }

POST /me/tokens                                  auth: session
body: { name: string; kind: 'mcp' | 'hook' }                          // a token belongs to the member, not a project (15 §5)
201: { data: { id; token: string /* full, shown once */; prefix; name; kind } }
effects: audit identity.token.create

DELETE /me/tokens/{id}                           auth: session
204    effects: revokedAt; audit

GET /workspaces/{ws}/me/channels                 auth: session
200: { data: { channel: 'push' | 'telegram' | 'email'; mode: 'off' | 'immediate' | 'digest'; kinds: string[]; available: boolean }[] }
PUT /workspaces/{ws}/me/channels/{channel}       auth: session
body: { mode: 'off' | 'immediate' | 'digest'; kinds?: string[] }
200: same row    errors: notifications.channel_invalid 400
```

### 3.4 Workspaces

```
GET /workspaces                                  auth: session | token
200: { data: (Me['workspaces'][number] & { isDefault: boolean; counts: { openDecisions; pendingHandoffs; openNeeds; readyTasks } })[] }

POST /workspaces                                 auth: session | token
body: { slug: string /* ^[a-z0-9-]{2,32}$ */; name: string; keyPrefix: string /* ^[A-Z]{2,6}$ */; timezone?: string; defaultLocale?: 'ar' | 'en';
        description?: Markdown; goals?: Markdown; links?: { label; url }[]; repoPaths?: string[]; docsPath?: string /* adds a local_path source named docs */ }
201: { data: Workspace }
errors: workspaces.slug_taken 409 · workspaces.key_prefix_taken 409
effects: Membership(owner) for the creator; becomes their default project when they have none; settings start at their defaults (no rows); audit

GET /workspaces/{ws}                             auth: session | token
200: { data: Workspace & { myRoles: Role[]; counts: { openDecisions; pendingHandoffs; openNeeds; readyTasks } } }

PATCH /workspaces/{ws}                           auth: session | token   role: owner|pm
body: { name?; timezone?; defaultLocale?; description?: Markdown | null; goals?: Markdown | null; links?; repoPaths?; status?: 'active' | 'paused' }
200: { data: Workspace }

POST /workspaces/{ws}/close                      auth: session | token   role: owner   200: { data: Workspace }   errors: workspaces.closed 409
POST /workspaces/{ws}/reopen                     auth: session | token   role: owner   200: { data: Workspace }   errors: common.conflict 409 (not closed)
// A project is never deleted (D30).
```

### 3.5 Members, invites, GitHub identities

Implemented in `workspaces` (memberships, GitHub identities) and `identity` (invites) modules;
routed under the workspace.

```
GET /workspaces/{ws}/members                     auth: session | token
200: { data: { userId; email; displayName; avatarColor; roles: Role[]; status; joinedAt; lastSeenAt; githubLogins: string[]; totpEnabled: boolean }[] }

PATCH /workspaces/{ws}/members/{userId}          auth: session   role: owner|pm
body: { roles: Role[] /* ≥1 */ }
200: member row
errors: workspaces.role_invalid 400 · workspaces.last_owner 409 · workspaces.member_removed 409
effects: audit; the member's open MCP tokens pick up the new roles on the next call

POST /workspaces/{ws}/members/{userId}/remove    auth: session   role: owner|pm
204    errors: workspaces.last_owner 409
effects: status=removed, which ends the member's access here at once (a token belongs to the member, 15 §5, so it stays valid for their other projects); no longer their default project; their claimed tasks → unclaimed by whoever removed them (event unclaimed); audit

PUT /workspaces/{ws}/members/{userId}/github-logins      auth: session   role: owner|pm
body: { logins: string[] }
200: { data: { logins: string[] } }
effects: GithubIdentity rows replaced; existing change cards with matching authorLogin get authorUserId backfilled (job)

GET /workspaces/{ws}/invites                     auth: session   role: owner|pm
200: { data: { id; email; roles; createdBy; expiresAt; acceptedAt }[] }

POST /workspaces/{ws}/invites                    auth: session   role: owner|pm
body: { email: string; roles: Role[] }
201: { data: { id; email; roles; expiresAt; url: string /* https://hub…/ar/invite/<token>, shown once */ } }
errors: workspaces.role_invalid 400 · common.conflict 409 (active invite for the same email)
effects: email sent if SMTP configured; audit

POST /workspaces/{ws}/invites/{id}/resend        auth: session   role: owner|pm   200: { data: { url } } (new token, old revoked)
DELETE /workspaces/{ws}/invites/{id}             auth: session   role: owner|pm   204
```

### 3.6 Settings

```
GET /workspaces/{ws}/settings                    auth: session | token
200: { data: { key: string; value: unknown; default: unknown; isDefault: boolean; updatedAt: string | null; updatedBy: string | null }[] }

GET /workspaces/{ws}/settings/catalogue          auth: session | token
200: { data: { key; type: 'number' | 'string' | 'boolean' | 'string[]' | 'number[]' | 'object'; schema: JsonSchema; description: { ar; en }; group: string }[] }

PUT /workspaces/{ws}/settings/{key}              auth: session   role: owner|pm
body: { value: unknown }
200: setting row
errors: workspaces.setting_unknown 404 · workspaces.setting_invalid 400
effects: audit settings.update; repeatable jobs re-scheduled when `capture.*`/`digest.*` keys change

DELETE /workspaces/{ws}/settings/{key}           auth: session   role: owner|pm   200: setting row (back to default)
```

### 3.7 Sources

```
type SourceDto = { id; kind: 'github_repo' | 'openapi' | 'lab' | 'docs_folder' | 'local_path'; name; config: Record<string, unknown>; hasSecret: boolean;
                   enabled; cursor; lastRunAt; lastSuccessAt; lastError; lagSec: number | null; createdAt }

GET /workspaces/{ws}/sources                     auth: session | token   200: { data: SourceDto[] }

POST /workspaces/{ws}/sources                    auth: session   role: owner|pm
body: { kind; name: string /* ^[a-z0-9-]{2,32}$ */; config: Record<string, unknown> /* validated per kind, 03 §4.3 */; secret?: string /* GitHub token; filtered from logs */ }
201: { data: SourceDto }
errors: workspaces.source_kind_invalid 400 · workspaces.source_dependency_missing 422 · common.conflict 409 (name) · identity.token_scope 403 (`secret` sent with an API token, 15 §2)
effects: repeatable job registered (06); audit (secret never logged)

PATCH /workspaces/{ws}/sources/{id}              auth: session   role: owner|pm
body: { name?; config?; secret?: string | null /* null clears */; enabled?: boolean }
200: { data: SourceDto }

POST /workspaces/{ws}/sources/{id}/test          auth: session   role: owner|pm
200: { data: { ok: true; details: { repo?: string; defaultBranch?: string; permissions?: string[]; filesFound?: number } } }
errors: workspaces.source_connection_failed 422 (details.reason) · github.auth_failed 502

POST /workspaces/{ws}/sources/{id}/run           auth: session   role: owner|pm
202: { data: { runId: string } }
errors: workspaces.source_run_in_progress 409 · capture.source_disabled 409

GET /workspaces/{ws}/sources/{id}/runs?cursor&limit        auth: session   role: owner|pm
200: { data: CaptureRun[] } (03 §8, newest first)

GET /workspaces/{ws}/sources/{id}                auth: session | token   200: { data: SourceDto }

DELETE /workspaces/{ws}/sources/{id}             auth: session | token   role: owner|pm
204   (soft: enabled=false, secret cleared, `deletedAt` in config, the row is renamed so the name is free again; cards keep their `repo` name)
```

### 3.8 Cards (generic)

```
GET /workspaces/{ws}/cards                       auth: session | token
query: { type?: CardType[]; status?: string[]; role?: Role[]; assignee?: string | 'me'; createdBy?: string | 'me'; repo?: string[]; module?: string[];
         tag?: string[]; q?: string; dueBefore?: string; flags?: ('blocked'|'overdue'|'escalated'|'stale'|'noSummary')[]; awaiting?: 'me' /* no paging: the whole stack, soonest first */;
         sort?: 'lastEvent' | 'created' | 'due' | 'priority' (default lastEvent desc); cursor?; limit? }
200: { data: CardSummary[], meta: { pagination } }

GET /workspaces/{ws}/cards/deleted?cursor&limit  auth: session | token   role: §2 "Read deleted cards" (D28: all for owner/pm, your own otherwise)
200: { data: CardSummary[] } (newest activity first)

POST /workspaces/{ws}/cards                      auth: session | token   Idempotency-Key supported
body: {
  type: 'task' | 'decision' | 'need' | 'handoff' | 'release' | 'idea' | 'plan';   // change/redesign/doc: system only → 409 cards.type_mismatch
  title: string; body?: Markdown; priority?: Priority; ownerRole?: Role; dueAt?: string; tags?: string[]; module?: string; repo?: string;
  links?: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates'; key: CardKey }[];   // ≤ 10; a bad one undoes the card
  detail:
    | { specialty: Specialty; effort?: Effort; acceptance?: Markdown; prompt?: Markdown }                                     // task  (ownerRole defaults from specialty)
    | { kind: 'product' | 'technical' | 'financial' | 'design'; question: string; options: DecisionOptionInput[]; deciderRole: Role; adrRepoSourceId?: string }   // decision (dueAt defaults to now + decisions.default_due_days)
    | { kind: 'token' | 'account' | 'contract' | 'value_check' | 'file' | 'access' | 'other'; responsibleRole: Role }        // need
    | { kind: 'contract' | 'component' | 'design' | 'data' | 'other'; fromRole: Role; toRole: Role; severity?: 'breaking' | 'notable' | 'info'; summary: string; prompt?: Markdown; payload?: object; sourceKey?: CardKey }   // handoff
    | { version: string; repo?: string; tag?: string; includedKeys?: CardKey[] }                                              // release
    | { problem?: Markdown; notes?: Markdown; role?: Role }                                                                   // idea
    | { steps?: { id?: string; title: string; role?: Role }[]; sourceIdeaKey?: CardKey }                                      // plan
}
type DecisionOptionInput = { id?: string /* slug, default from title */; title: string; pros?: string[]; cons?: string[]; cost?: string; recommended?: boolean };
201: { data: CardFull }
errors: common.validation 400 · security.secret_detected 422 · decisions.options_min 400 · cards.not_found 404 (link target) · cards.link_cycle 409
effects: Card + detail; event created; watchers: creator (+ assignee); notifications: routed_* to holders of ownerRole (decision/need/handoff), task_ready to the specialty role when status=ready; SSE card.created
initial status: task → `backlog` (or `ready` when `prompt` or `acceptance` given); decision → `open`; need → `requested`; handoff → `pending`; release → `planned`; idea → `open`; plan → `draft`

GET /workspaces/{ws}/cards/{key}                 auth: session | token
200: { data: CardFull }     errors: cards.not_found 404 (a deleted card answers 404, except to owner, pm and its creator)

PATCH /workspaces/{ws}/cards/{key}               auth: session | token   (field permissions per §2)
body: { title?; body?; priority?; ownerRole?; dueAt?: string | null; tags?; module?: string | null; assignee?: string | null; repo?; branch? }
200: { data: CardFull }
errors: cards.archived 409 · common.forbidden 403 (field not allowed for role) · security.secret_detected 422
effects: one field_changed event listing the changed fields, none when nothing changed; a plan's body adds plan_revised instead; ownerRole also updates the detail's copy; watchers notified (watch_update, grouped, H3-01); ownerRole change → routed_* to the new role (H3-01)

POST /workspaces/{ws}/cards/{key}/transition     auth: session | token
body: { to: string; reason?: string }
200: { data: CardFull }
errors: cards.invalid_transition 409 · common.forbidden 403 · cards.type_mismatch 409 (transitions with dedicated endpoints — decide, deliver, verify, acknowledge, approve … — are refused here and must use their endpoint)
allowed here: task backlog↔ready, in_progress→in_review, in_review→in_progress, *→cancelled (task/need), need requested→in_progress, release planned→released (owner/pm), handoff pending→dismissed is NOT here (use /dismiss)
effects: status_changed; closedAt set on terminal; blockers resolved → `unblocked` on dependants

POST /workspaces/{ws}/cards/{key}/delete         auth: session | token   role: owner|pm|creator   body: { reason?: string }   200: CardFull   effects: event archived; archivedAt set; gone from every page, count and search; dependants get unblocked (D28)
POST /workspaces/{ws}/cards/{key}/restore        auth: session | token   role: owner|pm|creator   200: CardFull   effects: event restored

GET /workspaces/{ws}/cards/{key}/events?cursor&limit         auth: session | token   200: { data: Event[] } (seq asc)

GET /workspaces/{ws}/cards/{key}/comments?cursor&limit       auth: session | token   200: { data: Comment[] } (createdAt asc)
POST /workspaces/{ws}/cards/{key}/comments                   auth: session | token
body: { body: Markdown }
201: { data: Comment }
errors: security.secret_detected 422 · cards.archived 409
effects: commented event; commentCount++; mentions (`@user:<id>` and `@role:<role>`) → notifications mention, and mentioned members watch (reason mention); watchers → watch_update (H3-01); author watches (reason commenter)
PATCH /workspaces/{ws}/cards/{key}/comments/{id}             auth: session | token   (author, within 15 min)   body: { body }   200: Comment   errors: cards.comment_not_author 403
POST /workspaces/{ws}/cards/{key}/comments/{id}/redact       auth: session | token   role: owner|pm   200: Comment (body null, redacted true)   effects: redacted event; the excerpt on the comment's event is removed too

POST /workspaces/{ws}/cards/{key}/links          auth: session | token
body: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates'; key: CardKey }    // blocked_by/child are stored as the inverse row
201: { data: CardFull }      errors: cards.link_self 400 · cards.link_exists 409 · cards.link_cycle 409 · cards.not_found 404
effects: one row; a linked event on each card, naming the link as that card sees it; `blocked` flag follows; watchers notified (H3-01)
DELETE /workspaces/{ws}/cards/{key}/links        auth: session | token   body: same   200: CardFull   effects: unlinked on both

POST /workspaces/{ws}/cards/{key}/watch          auth: session | token   204   effects: watcher(manual), event watch
DELETE /workspaces/{ws}/cards/{key}/watch        auth: session | token   204

GET /workspaces/{ws}/cards/{key}/attachments     auth: session | token   200: { data: CardFull['attachments'] }
```

### 3.9 Timeline and search

```
GET /workspaces/{ws}/timeline                    auth: session | token
query: { from?: string; to?: string; types?: CardType[]; roles?: Role[] /* cards whose ownerRole ∈ roles OR events by actors holding those roles */;
         repos?: string[]; modules?: string[]; actors?: string[] /* user ids */; kinds?: string[] /* event kinds */; q?: string;
         mine?: boolean /* events on cards I watch/own/claimed */; cursor?; limit? (default 50) }
sort: createdAt desc, collapsed: consecutive events of the same card within 30 min → one row with `collapsed: n`
200: { data: TimelineRow[], meta: { pagination; dayCounts?: { date: string; count: number }[] /* only when both from and to given */ } }
type TimelineRow = { event: Event /* the newest of the row */; card: CardSummary & { detail }; collapsed: number /* how many more it folds: the "+n" */; collapsedKinds: string[] /* their distinct kinds */ }
// watch/unwatch and deleted cards are left out unless `kinds` asks for them; a plan's previousBody is not in `data` (see /plans/{key}/revisions).

GET /workspaces/{ws}/timeline/summary            auth: session | token
query: { period: 'day' | 'week'; date?: string /* anchor, default today */ }
200: { data: { from; to; byType: Record<CardType, number>; byKind: Record<string, number>; decided: CardSummary[]; released: CardSummary[]; merged: CardSummary[]; newHandoffs: CardSummary[]; newNeeds: CardSummary[]; topActors: { user: ActorRef; events: number }[] } }

GET /workspaces/{ws}/search                      auth: session | token   rate: 60/min
query: { q: string /* 2..200 */; types?: CardType[]; includeDocs?: boolean (default true); limit? (≤ 50) }
200: { data: { cards: (CardSummary & { rank: number; highlight: string })[]; docs: DocHit[] } }
type DocHit = { card: CardSummary; path: string; chunks: { heading: string | null; anchor: string | null; excerpt: string /* ts_headline, <mark> */; rank: number }[] }
```

### 3.10 Tasks

```
type TaskDetail = { specialty: Specialty; effort: Effort | null; acceptance: Markdown | null; prompt: Markdown | null; origin: string;
                    claimedBy: { id; displayName } | null; claimedAt; branch; prUrl; startedAt; doneAt }

GET /workspaces/{ws}/tasks                       auth: session | token
query: { status?: TaskStatus[]; q?; cursor?; limit? (≤ 100) }
200: (CardSummary & { detail: TaskDetail; blockedBy: string[] })[]   the board and the list; `blockedBy` holds the keys of the open cards blocking each task

GET /workspaces/{ws}/tasks/ready                 auth: session | token
query: { specialty?: Specialty /* default: all specialties mapped to my roles */; limit? (≤ tasks.ready_limit_per_role) }
200: { data: (CardSummary & { detail: TaskDetail })[] }   // status=ready, not blocked, priority asc then createdAt asc

GET /workspaces/{ws}/tasks/mine                  auth: session | token
200: { data: { claimed: CardSummary[]; inReview: CardSummary[]; blocked: CardSummary[] } }

GET /workspaces/{ws}/tasks/{key}/prompt          auth: session | token
200: { data: { markdown: Markdown } }
// Rendered by digests: title, key, acceptance, prompt body, linked decisions (decided option + rationale), linked handoffs (summary), linked docs (paths), repo/branch hint, "when done call hub.log_session and mark GTV-123 done".

PATCH /workspaces/{ws}/tasks/{key}               auth: session | token   (§2 row "edit specialty…")
body: { specialty?; effort?; acceptance?; prompt?; branch?; prUrl? }
200: CardFull     effects: one field_changed listing the fields

POST /workspaces/{ws}/tasks/{key}/claim          auth: session | token   Idempotency: natural (claim by same user is a no-op 200)
body: { branch?: string }
200: CardFull
errors: tasks.already_claimed 409 · tasks.specialty_role_mismatch 403 · cards.invalid_transition 409 (not backlog/ready) · cards.archived 409
errors also: tasks.blocked 409
effects: status → claimed; assignee = actor; TaskDetail.claimedBy/At/branch; event claimed (with from, to); watcher(assignee); SSE

POST /workspaces/{ws}/tasks/{key}/unclaim        auth: session | token   200: CardFull   errors: tasks.not_claimer 403   effects: status → ready; assignee null; event unclaimed

POST /workspaces/{ws}/tasks/{key}/start          auth: session | token   200: CardFull   claimed → in_progress; startedAt; errors: tasks.not_claimer 403
POST /workspaces/{ws}/tasks/{key}/submit-review  auth: session | token   body: { prUrl?: string; note?: string }   200   in_progress → in_review; notification `review_requested` to qa holders
POST /workspaces/{ws}/tasks/{key}/resume         auth: session | token   role: reviewers (§2)   body: { reason?: string }   200   in_review → in_progress
POST /workspaces/{ws}/tasks/{key}/done           auth: session | token   body: { note?: string }   200   claimed|in_progress|in_review → done; doneAt; closedAt; dependants `unblocked`; a plan's step follows; from in_review the §2 row is "complete from review"
POST /workspaces/{ws}/tasks/{key}/mark-ready     auth: session | token   200   backlog → ready; notification task_ready
POST /workspaces/{ws}/tasks/{key}/mark-backlog   auth: session | token   200   ready → backlog
POST /workspaces/{ws}/tasks/{key}/cancel         auth: session | token   body: { reason: string }   200   any non-done → cancelled
POST /workspaces/{ws}/tasks/{key}/reopen         auth: session | token   role: §2   body: { reason?: string }   200   done|cancelled → ready; assignee cleared; a plan's step follows
```

### 3.11 Decisions

```
type DecisionOption = { id: string; title: string; pros: string[]; cons: string[]; cost: string | null; recommended: boolean };
type DecisionDetail = { kind; question; options: DecisionOption[]; deciderRole: Role; chosenOptionId; rationale; decidedBy: { id; displayName } | null; decidedAt;
                        remindersSent: number[]; escalatedAt; escalatedToRole; adrRepoSourceId; adrPath; adrPrUrl; adrStatus; adrBody: Markdown | null }

GET /workspaces/{ws}/decisions                   auth: session | token
query: { status?: ('open'|'decided'|'withdrawn'|'superseded')[] (default open); deciderRole?: Role[]; mine?: boolean /* routed to my roles */; overdue?: boolean; cursor?; limit? }
sort: open → dueAt asc nulls last; others → decidedAt desc
200: { data: (CardSummary & { detail: DecisionDetail; blocks: CardSummary[] })[] }

PATCH /workspaces/{ws}/decisions/{key}/options   auth: session | token   (while open; §2)
body: { options: DecisionOptionInput[] }      // full replacement; ids preserved when given
200: CardFull   errors: decisions.already_decided 409 · decisions.options_min 400   effects: field_changed(options)

POST /workspaces/{ws}/decisions/{key}/decide     auth: session | token   role: R(deciderRole)|owner
body: { optionId: string; rationale: string /* 1..2000 */ }
200: CardFull
errors: decisions.not_decider 403 · decisions.already_decided 409 · decisions.option_not_found 404
effects: status open → decided; decidedAt/By; event decided (with from, to); ADR skeleton rendered into adrBody when adrBody is null (adrStatus=drafted); cards linked `blocked_by` this decision → one `unblocked` event each, and notification unblocked to the assignee and watchers of those no longer blocked by anything; notification `watch_update` to watchers and `system` to the requester (H3-01); audit

POST /workspaces/{ws}/decisions/{key}/withdraw   auth: session | token   body: { reason: string }   200   open → withdrawn
POST /workspaces/{ws}/decisions/{key}/supersede  auth: session | token   role: owner|pm   body: { byKey: CardKey /* another decision */ }   200   open|decided → superseded; one `relates` row, with a linked event on each

PUT /workspaces/{ws}/decisions/{key}/adr         auth: session | token   (§2 "draft ADR body")
body: { body: Markdown /* full ADR markdown, 07 §6.5 format */; path?: string /* default docs/adr/<next-number>-<slug>.md */ }
200: CardFull     errors: decisions.already_decided? no — allowed before and after decide; adrStatus → drafted   effects: field_changed(adrBody)

POST /workspaces/{ws}/decisions/{key}/adr/open-pr   auth: session | token   role: R|owner|pm   (H3-06: not built yet)
200: { data: { prUrl: string; branch: string; path: string } }
errors: decisions.adr_not_drafted 409 · decisions.adr_source_missing 422 · decisions.adr_already_open 409 · github.auth_failed 502 · decisions.adr_pr_failed 502
effects: branch `hub/adr-<key-lower>` pushed to the ADR repo (needs a token with contents+pull_requests write — see 06 §1.3), PR titled `docs(adr): <title>`; adrStatus pr_opened; event field_changed(adrStatus); later the github adapter sets `merged` when the PR merges
```

### 3.12 Needs

```
type NeedDetail = { kind; responsibleRole: Role; location: string | null; deliveredBy; deliveredAt; verifiedBy; verifiedAt; verificationNote }

GET /workspaces/{ws}/needs                       auth: session | token
query: { status?: string[] (default requested,in_progress,delivered); responsibleRole?: Role[]; mine?: boolean; stale?: boolean; cursor?; limit? }
sort: priority asc, createdAt asc
200: { data: (CardSummary & { detail: NeedDetail; blocks: CardSummary[] })[] }

POST /workspaces/{ws}/needs/{key}/start          auth: session | token   role: R|owner|pm   200   requested → in_progress
POST /workspaces/{ws}/needs/{key}/deliver        auth: session | token   role: R|owner|pm
body: { location: string /* 1..500, secret-filtered */; note?: string }
200: CardFull   errors: needs.location_required 400 · security.secret_detected 422 · needs.not_responsible 403
effects: requested|in_progress → delivered; event delivered; notification `watch_update` + `system` to the requester ("ready to verify") routed to the requester's roles? No: to the requester user and to `owner`

POST /workspaces/{ws}/needs/{key}/verify         auth: session | token   role: §2 (V)
body: { note?: string /* required when verifying your own delivery (D24) */ }
200: CardFull   delivered → verified; closedAt; blocked cards `unblocked`; audit   errors: needs.self_verify_note_required 400   event verified records selfVerified
POST /workspaces/{ws}/needs/{key}/reject-delivery  auth: session | token   role: §2 (V)   body: { reason: string }   200   delivered → in_progress (event status_changed with reason); deliveredBy cleared
POST /workspaces/{ws}/needs/{key}/cancel         auth: session | token   body: { reason: string }   200   → cancelled
```

### 3.13 Handoffs

```
type HandoffDetail = { fromRole; toRole; kind; severity; summary; prompt; payload; sourceCard: CardSummary | null; acknowledgedBy; acknowledgedAt; appliedBy; appliedAt; appliedTask: CardSummary | null }

GET /workspaces/{ws}/handoffs                    auth: session | token
query: { status?: ('pending'|'acknowledged'|'applied'|'dismissed')[] (default pending,acknowledged); toRole?: Role[]; fromRole?: Role[]; mine?: boolean; severity?: string[]; stale?: boolean; cursor?; limit? }
sort: severity (breaking first), createdAt asc
200: { data: (CardSummary & { detail: HandoffDetail; pendingHours: number })[] }

POST /workspaces/{ws}/handoffs/{key}/acknowledge auth: session | token   role: R(toRole)|owner|pm
200: CardFull   errors: handoffs.not_recipient 403 · handoffs.already_acknowledged 409   effects: pending → acknowledged; event acknowledged; notification `watch_update` to the creator/from-role watchers

POST /workspaces/{ws}/handoffs/{key}/apply       auth: session | token   role: R (D25: not owner or pm unless they hold the role)   Idempotency-Key supported
body: { taskKey?: CardKey /* existing task */; createTask?: { title?: string; specialty?: Specialty } /* creates a task linked `relates`, prompt = handoff prompt */; note?: string }
200: CardFull (with appliedTask)
effects: pending|acknowledged → applied; closedAt; event applied; optional task created (origin handoff, status ready, assignee = actor, linked `relates`) with its own event created

POST /workspaces/{ws}/handoffs/{key}/dismiss     auth: session | token   role: R|owner|pm   body: { reason: string }   200   → dismissed; closedAt
```

### 3.14 Redesign

```
type RedesignDetail = { app: 'web' | 'dashboard'; page; version; labPath; labUrl; base; touchesComponents: string[]; reviewScore; reviewSummary; frontMatter;
                        approvedBy; approvedAt; rejectedBy; rejectedAt; decisionNote; portTask: CardSummary | null; portedRef }

GET /workspaces/{ws}/redesign/pages              auth: session | token
200: { data: { app; page; title; route; brief: Markdown; status: string /* page front-matter */; liveUrl; versions: (CardSummary & { detail: RedesignDetail })[] }[] }

GET /workspaces/{ws}/redesign/versions           auth: session | token
query: { app?; page?; status?: string[]; cursor?; limit? }
200: { data: (CardSummary & { detail: RedesignDetail })[] }

GET /workspaces/{ws}/redesign/{key}/readme       auth: session | token   200: { data: { markdown: Markdown | null; review: Markdown | null } }   (raw files from the lab folder, front-matter removed)

GET /workspaces/{ws}/redesign/compare?a=KEY&b=KEY   auth: session | token
200: { data: { a: Side; b: Side; commonShots: string[] /* shot names both have */ } }
type Side = { card: CardWithDetail; shots: { name; url; width; height }[]; frameUrl: string | null /* `/lab/frame-<app>.html#/<page>/<version>`; null when LAB_URL is unset */ }

GET /workspaces/{ws}/lab/file?path=<lab-relative path>   auth: session | token   200: the image (png, jpg, webp); anything else, or any way out of the root: 404
// Attachments of kind `screenshot` carry this URL. Local path mode (15 §3).

POST /workspaces/{ws}/redesign/{key}/submit-review   auth: session | token   role: designer|frontend|owner|pm
200: CardFull   errors: cards.invalid_transition 409 (not draft)   effects: draft → review (front-matter written: `status: review`); event status_changed; notification routed_review to owner

POST /workspaces/{ws}/redesign/{key}/approve     auth: session | token   role: owner   Idempotency-Key supported
body: { note?: string; createPortTask?: boolean (default true) }
200: CardFull
errors: redesign.owner_only 403 · redesign.not_in_review 409 · redesign.lab_unavailable 503 · redesign.write_failed 500
effects: review → approved; front-matter `status: approved` (H2-05, local path mode: no commit, docs/15 §3); event approved; port task created (specialty = lab.port_task_specialty, origin redesign_port, prompt = port template 07 §6.7) linked `relates`; notification task_ready to that role; audit

POST /workspaces/{ws}/redesign/{key}/reject      auth: session | token   role: owner   body: { note: string }   200   review → rejected; front-matter; event rejected
POST /workspaces/{ws}/redesign/{key}/request-changes   auth: session | token   role: owner|pm|qa   body: { note: string }   200   review → review (status stays, 01 §4.1 and 10); event changes_requested; comment created with the note; notification to designer role
POST /workspaces/{ws}/redesign/{key}/mark-ported auth: session | token   role: frontend|owner|pm   body: { ref: string /* "feat/x@abc123 (Goteav-Dashboard)" */ }   200   approved → ported; front-matter `status: ported`, `ported: <ref>`; event ported; linked port task → done from whatever open status (event status_changed reason ported)
POST /workspaces/{ws}/redesign/rescan            auth: session | token   role: owner|pm   202: { data: { runId } }
```

### 3.14a Ideas and plans (15 §4)

```
type IdeaDetail = { problem; notes; role; planCardId; sourceChatId: Uuid | null; sourceMessageId: Uuid | null }
GET /workspaces/{ws}/ideas?status=&q=&sourceChat=&cursor&limit       auth: session | token   200: { data: (CardSummary & { detail: IdeaDetail })[] }   sourceChat: the Idea Studio chat an idea was accepted from (owner decision 9c), a uuid, else 400 common.validation
POST /workspaces/{ws}/cards (type idea)          detail also takes { sourceChatId?: Uuid; sourceMessageId?: Uuid }, written by the Idea Studio's Accept
PATCH /workspaces/{ws}/ideas/{key}               auth: session | token   body: { title?; body?; priority?; tags?; problem?; notes?; role?; sourceChatId?; sourceMessageId? }   200: CardFull   effects: one field_changed (the source fields named in `changes` too); role routes the card
POST /workspaces/{ws}/ideas/{key}/explore|accept|reopen   auth: session | token   200: CardFull
POST /workspaces/{ws}/ideas/{key}/park|reject    auth: session | token   body: { reason?: string }   200: CardFull
POST /workspaces/{ws}/ideas/{key}/to-plan        auth: session | token   body: { title?: string; body?: Markdown; sourceChatId?: Uuid; sourceMessageId?: Uuid }   200: CardFull   the source fields go to the new plan
effects: open|exploring → accepted; event idea_to_plan { planKey }; a draft plan created with the idea's title, tags, priority and text, linked `relates`, with its own event created

type PlanStep = { id; title; role?; taskKey?; done; why?: string; size?: 'S' | 'M' | 'L'; after?: string[] /* ids of earlier steps */; acceptance?: string }   // owner decision 9a
type PlanDetail = { steps: PlanStep[]; revision: number; sourceIdeaId; approvedBy; approvedAt; sourceChatId: Uuid | null; sourceMessageId: Uuid | null }
GET /workspaces/{ws}/plans?status=&q=&sourceChat=&sourceMessage=&cursor&limit       auth: session | token   200: { data: (CardSummary & { detail: PlanDetail })[] }   sourceChat / sourceMessage: the Plan Studio chat, or the chat reply, a plan was saved from (owner decision 9c), uuids, else 400 common.validation
POST /workspaces/{ws}/cards (type plan)          detail: { steps: PlanStepInput[]; sourceIdeaKey?; sourceChatId?: Uuid; sourceMessageId?: Uuid }   a step's id is optional; after names ids in the same request, and Hub drops any that is not an earlier step
// sourceChatId / sourceMessageId (ideas, plans, to-plan): only the writer's own chat in this project, and a message of that chat, else chats.not_found 404 / chats.message_not_found 404; a chat is its member's own, and the studio's next save overwrites the card that names it.
GET /workspaces/{ws}/plans/{key}/revisions       auth: session | token   200: { data: { revision; body; savedAt; actor; current: boolean }[] } (newest first)
PATCH /workspaces/{ws}/plans/{key}               auth: session | token   body: { title?; body?; priority?; tags?; steps?: { id?; title; role?; done?; why?; size?; after?; acceptance? }[]; sourceChatId?; sourceMessageId? }   200: CardFull
effects: a new body adds plan_revised { revision, previousBody } and bumps revision; steps alone plan_steps_changed; a step with a task keeps its taskKey and done, because they follow the task
POST /workspaces/{ws}/plans/{key}/restore        auth: session | token   body: { revision: number }   200: CardFull   errors: plans.revision_not_found 404   effects: the old text comes back as a new revision, plan_revised { restoredFrom }
POST /workspaces/{ws}/plans/{key}/submit-review|approve|start|finish   auth: session | token   200: CardFull   approve is owner|pm
POST /workspaces/{ws}/plans/{key}/request-changes   auth: session | token   role: owner|pm   body: { reason: string }   200: CardFull   errors: common.validation 400 (no reason), cards.invalid_transition 409 (not in review), common.forbidden 403
effects: in_review → draft; event changes_requested { reason, from, to } (owner decision 9b, 2026-11-19)
POST /workspaces/{ws}/plans/{key}/abandon        auth: session | token   body: { reason?: string }   200: CardFull
POST /workspaces/{ws}/plans/{key}/to-tasks       auth: session | token   body: { defaultSpecialty?: Specialty }   200: CardFull
effects: draft|in_review|approved|in_progress → in_progress; one task per step with no taskKey (origin plan, ready, its own event created, the step's acceptance as its acceptance), linked `parent` to the plan, keys written back; event plan_to_tasks { taskKeys }. Completing or reopening such a task adds plan_steps_changed. `finish` is offered once every step is done.
```

### 3.15 Docs

```
type DocDetail = { source: { id; name }; path; kind: 'doc' | 'adr' | 'status' | 'readme' | 'other'; lang; headings: { level; text; anchor }[]; wordCount; lastCommitSha; lastIndexedAt; url: string /* GitHub blob URL */ }

GET /workspaces/{ws}/docs                        auth: session | token
query: { source?: string[]; kind?: string[]; q?: string /* title filter */; cursor?; limit? }
sort: path asc
200: { data: (CardSummary & { detail: DocDetail })[] }

GET /workspaces/{ws}/docs/{key}                  auth: session | token
200: { data: CardWithDetail & { content: Markdown | null; unavailable: 'missing' | 'secret' | null; docSource: { id; name }; toc: DocDetail['headings']; mentionedBy: CardSummary[] } }
errors: docs.not_found 404
// `content` is the file now, front-matter removed. `url` of a GitHub blob does not exist in local path mode (15 §3).

GET /workspaces/{ws}/docs/by-path?source=&path=  auth: session | token   200: same as above   (used by MCP get_doc)

GET /workspaces/{ws}/docs/{key}/image?src=<address as written>   auth: session | token   permission: docs.read
200: the image bytes (image/png | jpeg | gif | webp | svg+xml, ≤ 10 MB) · Cache-Control: private, max-age=300 · ETag (304 on If-None-Match) · X-Content-Type-Options: nosniff · Content-Security-Policy: default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox · Cross-Origin-Resource-Policy: same-origin
errors: docs.not_found 404 · docs.image_not_found 404 · docs.image_too_large 413 · docs.image_type_refused 415 · docs.image_bad_path 422
// Decision 13b. `src` is resolved against the document's folder inside a `local_path` source's folder; the real path after links must stay inside it and outside what the indexer leaves out. SVG passes the secret filter. A remote `https:` image never reaches this route: the viewer shows its alt text with a link.

GET /workspaces/{ws}/docs/search?q=&kinds=&limit= auth: session | token   rate: 60/min   200: { data: DocHit[] }

POST /workspaces/{ws}/docs/reindex               auth: session | token   role: owner|pm   body: { source?: string }   202: { data: { runId } }   errors: docs.reindex_running 409
POST /workspaces/{ws}/sources/{id}/run            auth: session | token   role: owner|pm   202: { data: { runId } }   errors: docs.reindex_running 409 · workspaces.source_connection_failed 400 (a kind that waits for its token)
GET /workspaces/{ws}/capture/runs?source=&limit=  auth: session | token   role: owner|pm   200: { data: { id; sourceId; sourceName; kind; startedAt; finishedAt; status; created; updated; error }[] }
// The stream says how a run went: `source.run` to owner and pm, and `docs.indexed` { sourceId, created, updated, removed } to everyone. A docs run publishes no per-card messages (`quiet`).
```

### 3.16 Capture

```
POST /capture/session                            auth: hook token (kind=hook) | mcp token   rate: 60/min/token
project: `X-Hub-Project`, else the project whose repoPaths hold `cwd`, else the member's default (15 §5)
body: hookSessionPayloadSchema in @hub/contracts/capture, as below
  { sessionId: string; reason: 'clear' | 'resume' | 'logout' | 'prompt_input_exit' | 'other' | 'sigterm'; cwd: string; repo: string | null /* source name resolved from git remote */;
    branch: string | null; headSha: string | null; startedAt: string | null; endedAt: string; durationSec: number | null;
    commits: { sha: string; message: string; at: string }[] /* since session start, ≤ 100 */;
    files: { path: string; status: 'A' | 'M' | 'D' | 'R' }[] /* ≤ 300, from git status + diff --name-status */;
    tool?: { version: string } }
202: { data: { sessionLogId: string; cardKey: CardKey | null /* set when a card already exists for this session */; project: string } }
errors: capture.payload_invalid 400 · identity.token_scope 403
effects: SessionLog upsert (hookReceivedAt/hookPayload); delayed job `session.reconcile` at +capture.session.hook_grace_minutes (06 §3)

GET /me/context?cwd=<urlencoded cwd>             auth: hook token | mcp token   (project chosen as for /capture/session; no {ws} in the path, so the hook needs only the URL and token)
200: { data: { project: string | null; text: string } }  — ≤ 8 500 chars for SessionStart: the active project, what awaits me, ready tasks, my no-summary sessions, latest changes
errors: identity.token_scope 403 (session cookie not accepted here)
```

```
GET /workspaces/{ws}/capture/runs?source=&kind=&cursor&limit   auth: session   role: owner|pm   200: { data: CaptureRun[] }

// The Goteav import has no route: `pnpm import:goteav` runs it in its own process on the owner's machine (06 §7).
```

### 3.17 Inbox and notifications

```
type InboxItem = { id; kind; title; body: string | null; card: CardSummary | null; data: { cardKey?; action?: 'decide' | 'acknowledge' | 'deliver' | 'claim' | 'verify' | 'review'; count?: number; link?: { view: string; query?: Record<string, string> } /* where an item with no card leads */; i18nKey?: string; params?: Record<string, string | number> /* what `title` was rendered from, so a page says it in its own language with the card's title as it is now */ }; groupKey; createdAt; readAt; archivedAt }

GET /workspaces/{ws}/inbox                       auth: session | token
query: { unread?: boolean; archived?: boolean /* true is the archive */; kinds?: string[]; cursor?; limit? }   sort: createdAt desc; grouped client-side by groupKey within 30 min
200: { data: InboxItem[], meta: { pagination: { …; total: number /* unread count */ } } }

GET /workspaces/{ws}/inbox/count                 auth: session | token   200: { data: { unread: number; awaitingMe: { decisions: number; needs: number; handoffs: number; reviews: number } } }
POST /workspaces/{ws}/inbox/{id}/read            auth: session | token   204
POST /workspaces/{ws}/inbox/read-all             auth: session | token   body: { before?: string }   204
POST /workspaces/{ws}/inbox/{id}/archive         auth: session | token   204
POST /workspaces/{ws}/inbox/{id}/unread          auth: session | token   204   (Undo of read)
POST /workspaces/{ws}/inbox/{id}/unarchive       auth: session | token   204   (Undo of archive)
// An item on a deleted card hides with the card, from the list and the count (D28), and comes back with it.
// Acting on a card marks that card's items read for the one who acted, from any surface. The inverse of the act (unclaim after
// claim, restore after delete, and so on: `notifications/domain/acts.ts`) restores exactly those, so Undo needs no inbox call (review M1).
```

### 3.18 Push and Telegram

```
GET /push/vapid-public-key                       auth: session   200: { data: { key: string } }
POST /me/push/subscriptions                      auth: session   body: { subscription: PushSubscriptionJSON; userAgent?: string }   201   errors: notifications.push_invalid_subscription 400
DELETE /me/push/subscriptions                    auth: session   body: { endpoint: string }   204

POST /me/telegram/link-code                      auth: session   201: { data: { code: string /* 8 chars, 10 min */; botUsername: string; deepLink: string /* https://t.me/<bot>?start=<code> */ } }
GET /me/telegram                                 auth: session   200: { data: { linked: boolean; username: string | null; linkedAt: string | null } }
DELETE /me/telegram                              auth: session   204
```

### 3.19 Briefs

```
type Brief = { id; kind: 'morning' | 'weekly'; date: string; sections: BriefSections (07 §6.1); narrative: Markdown | null; narrativeBy: ActorRef | null; createdAt; updatedAt }

GET /workspaces/{ws}/briefs/today                auth: session | token   200: { data: Brief }   (rendered on demand if the 07:30 job has not run yet; cached per member/day)
GET /workspaces/{ws}/briefs?kind=&date=&cursor&limit   auth: session | token   200: { data: Brief[] }   (own morning briefs; weekly for all)
PUT /workspaces/{ws}/briefs/{kind}/{date}/narrative   auth: session | token   body: { narrative: Markdown /* ≤ 6 000 */ }   200: Brief   effects: narrativeBy = actor (MCP save_brief)
GET /workspaces/{ws}/briefs/weekly/{isoWeek}     auth: session | token   200: { data: Brief }
```

### 3.20 Releases

```
type ReleaseDetail = { version; repo; tag; releasedAt; includedIds: Uuid[]; included: CardSummary[]; notes: { team: Markdown | null; owner: Markdown | null; accountant: Markdown | null } }

GET /workspaces/{ws}/releases?status=&cursor&limit        auth: session | token   200: { data: (CardSummary & { detail: ReleaseDetail })[] }
PATCH /workspaces/{ws}/releases/{key}            auth: session | token   role: owner|pm   body: { version?; repo?; tag?; includedKeys?: CardKey[]; notes?: Partial<ReleaseDetail['notes']> }   200: CardFull
POST /workspaces/{ws}/releases/{key}/generate-notes   auth: session | token   role: owner|pm   200: CardFull   effects: notes skeleton rendered from included cards (07 §6.3) only for audiences still null
POST /workspaces/{ws}/releases/{key}/release     auth: session   role: owner|pm   body: { releasedAt?: string }   200   planned → released; notification `system` to all members ("Release X"). `CardFull.actions` offers it with `mode: confirm` and no `destructive` (owner decision 6): the web asks first, naming the version and how many cards it ships
```

### 3.21 Audit

```
GET /workspaces/{ws}/audit                       auth: session | token   role: owner|pm
query: { actor?: string; action?: string /* prefix match */; targetType?; from?; to?; cursor?; limit? }
200: { data: { id; actor: ActorRef; via; action; targetType; targetId; summary; ip; userAgent; createdAt }[] }
```

### 3.22 Events (SSE)

```
GET /workspaces/{ws}/events/stream               auth: session | token   Accept: text/event-stream
headers: Last-Event-ID supported (replays from Redis stream buffer of the last 500 events, 10 min)
a cursor too old to resume answers `event: resync` (no id): refetch everything
keep-alive: `: ping` every 25 s; server closes after 55 min → client reconnects
```

### 3.23 Endpoints added in reconciliation with `09-pages.md`

These are required by the pages and were not in §3.1–3.22. They follow the same conventions.

```
GET /workspaces/{ws}/today                       auth: session | token
200: { data: Today }   // the exact shape is `todaySchema` in @hub/contracts/today.ts
type Today = { date; timezone; now; brief: Brief & { generatedNow: boolean }; awaitingMe: CardWithDetail[]; readyTasks: CardWithDetail[]; deadlines: CardSummary[];
               noSummarySessions: { sessionLogId; sessionId; repo; branch; at; durationMin; commits; files; cardKey }[];
               changesSince: { since: string; events: TimelineRow[] /* at most 50 rows, my own left out */; total: number /* events */ };
               counters: Counters; team: TeamStats; sources: SourceHealth[] /* enabled, problems first */; weekly: Brief | null /* this week's, once stored */ }
type TeamStats = { week: { iso; from; to }; totals: { key: 'sessions'|'commits'|'prsMerged'|'decided'|'handoffs'|'closed'; value; prev /* the whole previous ISO week */; available: boolean /* false: no source feeds it */ }[];
                   flow: { type; created; closed }[]; days: string[] /* 14 local dates */; members: { userId; displayName; avatarColor; roles; lastActiveAt; sessions; commits; cardsClosed; handoffsSent; activity: number[]; focus: { key; title; type } | null }[] }
type SourceHealth = { id; name; kind; status: 'ok'|'lagging'|'failing'|'never_run'; lagSec; lastSuccessAt; lastError; target; runs24h; cards24h }
// Composite for the Today page (09 §4). Reading it clears nothing. `since` is the previous visit, kept per project in Redis `seen:<ws>:<user>`.
// There is no sparkline or trend data and no "online" flag: nothing real feeds them (15 §8).

POST /workspaces/{ws}/today/seen                 auth: session | token   204   effects: the visit: clears `counters.newEvents`. The web calls it on visiting Today or Timeline (review M4). Publishes `inbox.read` to the member's other tabs.

GET /workspaces/{ws}/counters                    auth: session | token
200: { data: Counters }
type Counters = { inboxUnread; awaitingMe; decisionsOpen; decisionsMine; decisionsOverdue /* of mine */; needsOpen /* requested, in progress, delivered */; needsMine;
                  handoffsPending /* pending, acknowledged */; handoffsMine; tasksReadyForMe; redesignInReview; noSummarySessions; newEvents; onboardingLeft;
                  invitesPending /* owner, pm */; sourceProblems /* owner, pm */; planningOpen /* ideas open or exploring, plans not finished */ }
// Derived from state on every read, so a badge cannot drift. Not pushed: every card event and `inbox.*` message makes the web refetch it.

GET /workspaces/{ws}/docs/tree?source=           auth: session | token
200: { data: { source: { id; name }; total: number; root: Folder }[] }
// recursive Folder = { name; path; docs: CardWithDetail[]; folders: Folder[] }; `root` has name and path ''; folders sorted by name, docs by path

GET /workspaces/{ws}/docs/mentions/{cardKey}      auth: session | token   (H5-03)
200: { data: { mention: string /* as the card wrote it */; key; path; source; title }[] }   // chips on a card. `docs/x.md` matches a doc indexed as `x.md`.

GET /workspaces/{ws}/onboarding                  auth: session | token
200: { data: { role: Role; items: { id; kind: 'doc' | 'card' | 'url' | 'action'; title; ref: string /* doc path | card key | url | action id */; done: boolean; doneAt }[] }[] }
// one group per role the member holds; items from settings `onboarding.paths`; `action` items (e.g. "install the team pack") auto-complete when the matching event exists (first api token used)
// each item also has `cardKey`: a doc item's card once indexed, else null (show "not indexed yet")
POST /workspaces/{ws}/onboarding/{itemId}/done   auth: session | token   204   effects: OnboardingProgress upsert
DELETE /workspaces/{ws}/onboarding/{itemId}/done auth: session           204   (undo)

GET /workspaces/{ws}/system                      auth: session   role: owner|pm
200: { data: { version: { api; web; lab }; sources: { id; name; kind; enabled; lagSec; lastError; lastSuccessAt; consecutiveFailures }[];
               queues: { name; waiting; active; failed; delayed }[]; outbox: { pending; failed; oldestPendingAgeSec };
               sse: { connections: number }; backup: { lastAt: string | null; sizeBytes: number | null } /* null in this release: no backup job runs (15 §3) */;
               db: { sizeBytes; cards; events }; worker: { alive: boolean; lastHeartbeatAt } } }

GET /workspaces/{ws}/audit/export.csv?…          auth: session | token   role: owner|pm
200: text/csv (same filters as 3.21; UTF-8 with BOM; columns id,createdAt,actorKind,actorId,actorName,via,action,targetType,targetId,summary,ip; a cell that looks like a formula is prefixed with ')   max 50 000 rows → else 400 audit.export_too_large

POST /workspaces/{ws}/members/{userId}/disable   auth: session | token   role: owner|pm   204
effects: User.status=disabled when the user has no other active workspace; otherwise Membership.status=removed (same effects as /remove); sessions + tokens revoked; audit
POST /workspaces/{ws}/members/{userId}/enable    auth: session   role: owner   204
POST /workspaces/{ws}/members/{userId}/password-reset-link   auth: session   role: owner|pm
201: { data: { url: string /* shown once, 24 h */ } }   effects: PasswordReset row; audit (url never logged)

POST /me/channels/{channel}/test                 auth: session   (channel ∈ push | telegram | email)
202   errors: notifications.channel_unavailable 409 (not linked / not configured)   effects: one test notification through that channel only (not stored in the inbox)
```

Naming reconciled with `09-pages.md` (doc 04 is authoritative; the page text uses these):

| `09-pages.md` wrote | use instead |
| --- | --- |
| `POST …/sources/{id}/disable` / `enable` | `PATCH …/sources/{id} { enabled: false | true }` |
| `GET …/redesign/{key}/review` | `GET …/redesign/{key}/readme` (returns `{ markdown, review }`) |
| `POST /push/subscribe` | `POST /me/push/subscriptions` |
| `POST /telegram/link-code` | `POST /me/telegram/link-code` |
| `POST /notifications/test { channel }` | `POST /me/channels/{channel}/test` |
| `POST …/import/goteav` | `POST …/capture/import/goteav` |
| `PATCH …/members/{id} { githubLogin }` | `PUT …/members/{id}/github-logins { logins[] }` |
| `GET /api/v1/events/stream` (docs 01/05/13) | `GET /api/v1/workspaces/{ws}/events/stream` |
| `GET …/capture/session-context` | `GET /me/context` |
| "send_to_review" transition | endpoint `POST …/redesign/{key}/submit-review` (transition name in contracts stays `send_to_review`) |

## 4. SSE message shapes

Every message: `id: <redis stream id>`, `event: <name>`, `data: <json>`.

| event | data | emitted when |
| --- | --- | --- |
| `card.created` | `{ key, type, status, kind, lastEventAt, actor: { kind, userId, via } }` | a card's `created` event |
| `card.updated` | same | any other event of a card |
| `card.event` | `{ key, event: { id, seq, kind, actor, via, createdAt } }` | each `card_event` row (the timeline consumes this) |
| `comment.created` | `{ key, eventId }` | a comment. These messages carry no text: a page refetches through the API, where the member's permissions apply |
| `resync` | `{ reason }` | `Last-Event-ID` too old to resume |
| `inbox.new` | `{ id, kind, cardKey, action, unread }`, no text: the page reads the item through the API | notification for **this** member |
| `inbox.read` | `{ ids: string[], unread: number }` | read, restored, archived or read-all elsewhere (another tab or device, or acting on the card) |
| `brief.ready` | `{ kind, date }` | morning/weekly brief stored for this member |
| `source.run` | `{ sourceId, status: 'running' | 'ok' | 'failed', created, updated, lagSec }` | owner/pm only |
| `workspace.updated` | `{ counts: Workspace['counts'] }` | throttled to 1/5 s |
| `project.updated` | `{ scope: 'members' \| 'invites' \| 'settings' \| 'sources' \| 'project' }` | after any change to them, from REST or MCP; open pages reread |

Routing: the worker/API publishes to Redis channel `ws:<workspaceId>:events` through `RealtimePublisher`. A card event is
for every member. Anything else uses `publishEnvelope` with `{ event, data, audience: 'all' | { userIds: string[] } | { roles: Role[] } }`;
the SSE controller filters per connection. Each message also joins the stream `ws:<workspaceId>:stream`, whose id is the SSE `id:`. The client invalidates TanStack Query keys: `['card', key]`,
`['timeline']`, `['inbox']`, `['counts']`.

## 5. OpenAPI export and client generation

- `apps/api` builds its OpenAPI 3.0 document from the Zod DTOs (`nestjs-zod` + `@nestjs/swagger`),
  with the same conventions as the backend ADR-0009: every route declares its envelope, errors
  (`x-errors: [codes]`), tags = module names, `operationId = <module>_<verb><Noun>` (e.g.
  `tasks_claimTask`). Arabic descriptions are **not** maintained for Hub (English only).
- `pnpm --filter @hub/api openapi:export` (`scripts/export-openapi.ts`) boots the Nest app with
  `OPENAPI_EXPORT=1` — **no database, no Redis** (Prisma/Redis providers are replaced by stubs under
  this flag, same technique as the backend's `export-openapi.ts`) — and writes
  `apps/api/openapi/openapi.json`. CI uploads it as an artifact and fails if it differs from the
  committed `apps/web/openapi/openapi.json` snapshot (`api:check`).
- `pnpm --filter @hub/web api:sync` copies the fresh document into `apps/web/openapi/` and runs
  `@hey-api/openapi-ts` → `apps/web/src/lib/api/generated/` (client `@hey-api/client-fetch` wrapped
  in `apps/web/src/lib/api/client.ts` to add `X-Requested-With`, locale, 401→refresh retry,
  error unwrapping to `HubError { code, message, details }`). Generated code is committed.
- `scripts/api/watch.ts` re-runs the sync when `apps/api/src/**` changes during `pnpm dev`.
- The MCP tool schemas in `@hub/contracts/mcp/tools.ts` reuse the same Zod DTOs so REST, MCP
  and the generated client never drift.
