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
  with `createTask`, `/redesign/{key}/approve`) accept `Idempotency-Key: <≤128 chars>`. The key is
  stored with the actor id and a SHA-256 of the body for 24 h (Redis). Same key + same body →
  the original response replayed (`meta.idempotentReplay: true`); same key + different body →
  `422 hub.common.idempotency_key_reused`.
- Adapters never go through HTTP; they rely on `Card.externalKey` (03 §5.1).
- MCP tool calls pass the key automatically (`toolCallId`).

### 1.5 Localisation

- `Accept-Language: ar | en` selects error messages and **server-rendered text** (notification
  titles, digests). Falls back to the member's `User.locale`, then the workspace
  `defaultLocale`, then `en`.
- All timestamps are ISO-8601 UTC strings. The client formats with the workspace timezone
  (`Workspace.timezone`, returned on `GET /workspaces/{ws}`).

### 1.6 Actor resolution and authentication

Every request resolves to an `Actor`:

```ts
type Actor =
  | { kind: 'user';  userId: string; via: 'web';  workspaceId?: string; roles: Role[] }   // cookie session
  | { kind: 'agent'; userId: string; via: 'mcp';  workspaceId: string;  roles: Role[]; tokenId: string }  // api token kind=mcp
  | { kind: 'hook';  userId: string; via: 'hook'; workspaceId: string;  roles: Role[]; tokenId: string }  // api token kind=hook
```

| Mechanism | How | Notes |
| --- | --- | --- |
| Cookie session | `hub_access` (JWT, 15 min, `jose` HS256 with `HUB_JWT_SECRET`), `hub_refresh` (opaque, 30 days, `Path=/api/v1/auth/refresh`) — both `HttpOnly; Secure; SameSite=Lax` | Refresh rotation per family; reuse of a rotated token revokes the family (`401 hub.identity.refresh_invalid`). |
| API token | `Authorization: Bearer hub_<prefix8>_<secret>` | Lookup by `prefix`, compare SHA-256. `ApiToken.workspaceId` **must equal** the `{ws}` in the path → else `403 hub.identity.token_scope`. `kind=hook` tokens may only call `/capture/*`, `/me` and `/me/context` → else `403 hub.identity.token_scope`. Roles are resolved live from `Membership.roles` on every call. `lastUsedAt` updated at most once per minute. |
| CSRF | Cookie requests to mutating methods must send `X-Requested-With: hub` (custom header → CORS preflight). Same-origin only (`CORS` allows `https://hub.goteav.lan` and the configured `HUB_PUBLIC_URL`). | |
| TOTP | Members holding a role in `security.totp_required_roles` must have TOTP enabled; otherwise every workspace route answers `403 hub.identity.totp_setup_required` until they enrol. Sign-in returns `totpRequired` when enabled. | |

`actor.kind === 'user'` is required by **human-only** actions (§2) regardless of roles.

### 1.7 Rate limits (`@nestjs/throttler`, Redis store)

| Scope | Limit | Code |
| --- | --- | --- |
| `/auth/sign-in`, `/auth/password/*`, `/auth/totp/verify` | 10 / min / IP | `429 hub.common.rate_limited` |
| API token (`mcp`) | 120 / min / token | |
| API token (`hook`) | 60 / min / token | |
| Cookie session, other routes | 600 / min / user | |
| `GET /search`, `/docs/search` | 60 / min / actor | |

Response carries `Retry-After` seconds.

### 1.8 Common types

```ts
type Role = 'owner' | 'pm' | 'accountant' | 'backend' | 'frontend' | 'designer' | 'qa';
type CardType = 'task' | 'decision' | 'need' | 'change' | 'handoff' | 'redesign' | 'doc' | 'release';
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
};
type CardFull = CardSummary & {
  body: Markdown | null;
  detail: TaskDetail | DecisionDetail | NeedDetail | ChangeDetail | HandoffDetail | RedesignDetail | DocDetail | ReleaseDetail;
  links: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates'; card: CardSummary }[];
  watchers: { userId: string; displayName: string; reason: string }[];
  attachments: { id: string; kind: string; name: string; url: string; width: number | null; height: number | null }[];
  watching: boolean;                                // for the current actor
  allowedActions: string[];                         // computed from §2 for the current actor, e.g. ["claim","comment","link"]
};
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
| `hub.identity.token_revoked` | 401 | API token revoked |
| `hub.identity.token_scope` | 403 | token workspace ≠ path workspace, or hook token outside `/capture/*` |
| `hub.identity.account_disabled` | 403 | `User.status=disabled` |
| `hub.identity.invite_invalid` | 404 | token unknown |
| `hub.identity.invite_expired` | 410 | past `expiresAt` |
| `hub.identity.invite_accepted` | 409 | already accepted |
| `hub.identity.email_taken` | 409 | sign-up with existing email |
| `hub.identity.password_weak` | 400 | < 12 chars or in the 10k common list |
| `hub.identity.reset_invalid` | 404 | reset token unknown/used/expired |
| `hub.workspaces.slug_taken` / `key_prefix_taken` | 409 | create workspace |
| `hub.workspaces.not_member` | 403 | actor not an active member of `{ws}` |
| `hub.workspaces.archived` | 409 | mutation on an archived workspace |
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
| `hub.cards.human_only` | 403 | actor is `agent`/`hook` on a human-only action |
| `hub.cards.archived` | 409 | mutation on an archived card |
| `hub.cards.link_self` | 400 | |
| `hub.cards.link_exists` | 409 | |
| `hub.cards.link_cycle` | 409 | `blocks`/`parent` would form a cycle |
| `hub.cards.comment_not_found` | 404 | |
| `hub.cards.comment_not_author` | 403 | edit by someone else |
| `hub.cards.external_key_exists` | 409 | adapter/import duplicate (internal) |
| `hub.tasks.already_claimed` | 409 | `details.claimedBy` |
| `hub.tasks.not_claimer` | 403 | start/submit/done by someone else (owner/pm exempt) |
| `hub.tasks.specialty_role_mismatch` | 403 | claiming outside own specialty (owner/pm exempt) |
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
| `hub.handoffs.not_recipient` | 403 | actor lacks `toRole` |
| `hub.handoffs.already_acknowledged` | 409 | |
| `hub.redesign.owner_only` | 403 | approve/reject by non-owner |
| `hub.redesign.not_in_review` | 409 | approve/reject while not `review` |
| `hub.redesign.lab_unavailable` | 503 | lab source disabled or folder missing |
| `hub.redesign.write_failed` | 500 | front-matter write/commit failed; `details.reason` |
| `hub.docs.not_found` | 404 | |
| `hub.docs.reindex_running` | 409 | |
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
| `hub.security.secret_detected` | 422 | `details.pattern`, `details.field` |

## 2. Permission matrix

Legend: `✓` allowed · `R` allowed when the card's routed role (`ownerRole` / `deciderRole` /
`responsibleRole` / `toRole`) is one of the actor's roles · `S` allowed when the task's
`specialty` maps to the actor's role (`backend→backend`, `frontend→frontend`, `design→designer`,
`qa→qa`, `ops`/`docs`→`backend|frontend`) · `A` assignee/claimer only · `C` creator only ·
`✗` not allowed. Column **HO** = human-only (`actor.kind === 'user'` required). Column **MCP** =
reachable through an `mcp` token (same role rules apply, `HO` wins). `owner` implies every `pm`
right.

| Action | owner | pm | accountant | backend | frontend | designer | qa | HO | MCP |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create task | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Create decision | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Create need | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Create handoff | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Create release | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✗ |
| Create change / redesign / doc | system only (adapters, `log_session`) | | | | | | | | `log_session` only |
| Edit title/body/tags/module | ✓ | ✓ | C | C | C | C | C | | ✓ |
| Edit priority / dueAt / ownerRole / assignee | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✓ (pm/owner tokens) |
| Task: claim / unclaim | ✓ | ✓ | ✗ | S | S | S | S | | ✓ |
| Task: start / submit-review / done | ✓ | ✓ | ✗ | A | A | A | A | | ✓ |
| Task: cancel / reopen | ✓ | ✓ | ✗ | C | C | C | C | | ✓ |
| Task: edit specialty/effort/acceptance/prompt | ✓ | ✓ | ✗ | S | S | S | S | | ✓ |
| Decision: edit options (while open) | ✓ | ✓ | C | C | C | C | C | | ✓ |
| Decision: decide | ✓ | R | R | R | R | R | R | ✓ | ✗ |
| Decision: withdraw | ✓ | ✓ | C | C | C | C | C | ✓ | ✗ |
| Decision: supersede | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Decision: draft ADR body | ✓ | ✓ | R | R | R | R | R | | ✓ |
| Decision: open ADR PR | ✓ | ✓ | R | R | R | R | R | ✓ | ✗ |
| Need: start / deliver | ✓ | ✓ | R | R | R | R | R | | ✓ |
| Need: verify | ✓ | ✓ | R | R | R | R | R | ✓ | ✗ |
| Need: cancel | ✓ | ✓ | C | C | C | C | C | | ✓ |
| Handoff: acknowledge / apply / dismiss | ✓ | ✓ | R | R | R | R | R | | ✓ |
| Redesign: submit for review | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | | ✓ |
| Redesign: approve / reject | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Redesign: request changes | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Redesign: mark ported | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | | ✓ |
| Release: edit included / notes / mark released | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✓ |
| Archive / restore card | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Comment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Edit own comment (15 min) | C | C | C | C | C | C | C | | ✓ |
| Redact comment | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Link / unlink | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Watch / unwatch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Read any non-archived card, timeline, docs, search | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Read archived cards | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✓ |
| Members: invite, change roles, remove, GitHub identity | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Workspace: rename, timezone, archive | ✓ | rename/timezone | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Settings: read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Settings: write | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Sources: manage, run-now, import | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Own API tokens: create/revoke | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Own profile, channels, push, Telegram | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✗ |
| Briefs: read own; save narrative | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ (own) |
| Audit log: read | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✗ |
| Docs: reindex now | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | | ✗ |

`CardFull.allowedActions` is computed from this table so the UI never guesses.

## 3. Endpoints

Format of each entry:

```
METHOD /path                                   auth: session | token | hook | public   role: …   HO: yes|no
body: …          200|201: …          errors: …          effects: …
```

`token` means an `mcp` API token is accepted in addition to a session. Unless stated, every
workspace route requires an active membership (`403 hub.workspaces.not_member`) and refuses
mutations on an archived workspace (`409 hub.workspaces.archived`).

### 3.1 Health and metrics

```
GET /health/live                                auth: public
200: { data: { status: 'ok', version: string, uptimeSec: number } }

GET /health/ready                               auth: public
200: { data: { status: 'ok', checks: { postgres: 'ok', redis: 'ok', reposVolume: 'ok' } } }
503: hub.common.unavailable with details.checks

GET /metrics                                    auth: public, internal network only (Caddy denies from LAN)
200: text/plain Prometheus exposition
```

### 3.2 Auth

```
POST /auth/sign-in                              auth: public   rate: 10/min/IP
body: { email: string; password: string }
200: { data: { user: Me; totpRequired: false } }                      // sets hub_access + hub_refresh
200: { data: { totpRequired: true; challenge: string } }              // no cookies yet; challenge valid 5 min
errors: identity.invalid_credentials 401 · identity.locked 423 · identity.account_disabled 403
effects: LoginAttempt row; audit identity.sign_in

POST /auth/totp/verify                          auth: public   rate: 10/min/IP
body: { challenge: string; code: string /* 6 digits */ }
200: { data: { user: Me; totpRequired: false } }                      // sets cookies
errors: identity.totp_invalid 401

POST /auth/refresh                              auth: hub_refresh cookie
200: { data: { expiresAt: string } }                                  // rotates both cookies
errors: identity.refresh_invalid 401
effects: Session row replaced (replacedById); reuse detection revokes the family

POST /auth/sign-out                             auth: session
204
effects: current refresh family revoked; cookies cleared

GET /auth/me                                    auth: session | token
200: { data: Me }
type Me = { id; email; displayName; locale; avatarColor; totpEnabled: boolean; createdAt;
            workspaces: { id; slug; name; keyPrefix; roles: Role[]; timezone; defaultLocale; totpRequired: boolean }[] }

POST /auth/password/forgot                      auth: public   rate: 10/min/IP
body: { email: string }
202 always (no enumeration)
effects: PasswordReset row (1 h) + email if the user exists

POST /auth/password/reset                       auth: public
body: { token: string; password: string }
204
errors: identity.reset_invalid 404 · identity.password_weak 400
effects: all sessions revoked; audit

POST /auth/password/change                      auth: session   HO: yes
body: { current: string; next: string }
204
errors: identity.invalid_credentials 401 · identity.password_weak 400
effects: other refresh families revoked

POST /auth/totp/setup                           auth: session   HO: yes
201: { data: { secret: string; otpauthUrl: string; qrDataUrl: string } }   // secret stored encrypted, not yet enabled
errors: identity.totp_already_enabled 409

POST /auth/totp/confirm                         auth: session   HO: yes
body: { code: string }
200: { data: { recoveryCodes: string[] /* 8, shown once, stored hashed */ } }
errors: identity.totp_invalid 401
effects: totpEnabledAt set; audit

DELETE /auth/totp                               auth: session   HO: yes
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

GET /me/tokens                                   auth: session
200: { data: { id; workspace: { slug; name }; name; kind: 'mcp' | 'hook'; prefix; lastUsedAt; createdAt; revokedAt }[] }

POST /me/tokens                                  auth: session   HO: yes
body: { workspace: string /* slug */; name: string; kind: 'mcp' | 'hook' }
201: { data: { id; token: string /* full, shown once */; prefix; name; kind } }
errors: workspaces.not_member 403
effects: audit identity.token.create

DELETE /me/tokens/{id}                           auth: session   HO: yes
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
200: { data: Me['workspaces'] }

POST /workspaces                                 auth: session   HO: yes
body: { slug: string /* ^[a-z0-9-]{2,32}$ */; name: string; keyPrefix: string /* ^[A-Z]{2,6}$ */; timezone?: string; defaultLocale?: 'ar' | 'en' }
201: { data: Workspace }
errors: workspaces.slug_taken 409 · workspaces.key_prefix_taken 409
effects: Membership(owner) for the creator; default settings; audit

GET /workspaces/{ws}                             auth: session | token
200: { data: Workspace & { myRoles: Role[]; counts: { openDecisions; pendingHandoffs; openNeeds; readyTasks } } }

PATCH /workspaces/{ws}                           auth: session   role: owner|pm (archive: owner)   HO: yes
body: { name?: string; timezone?: string; defaultLocale?: 'ar' | 'en' }
200: { data: Workspace }

POST /workspaces/{ws}/archive                    auth: session   role: owner   HO: yes   204
```

### 3.5 Members, invites, GitHub identities

Implemented in `workspaces` (memberships, GitHub identities) and `identity` (invites) modules;
routed under the workspace.

```
GET /workspaces/{ws}/members                     auth: session | token
200: { data: { userId; email; displayName; avatarColor; roles: Role[]; status; joinedAt; lastSeenAt; githubLogins: string[]; totpEnabled: boolean }[] }

PATCH /workspaces/{ws}/members/{userId}          auth: session   role: owner|pm   HO: yes
body: { roles: Role[] /* ≥1 */ }
200: member row
errors: workspaces.role_invalid 400 · workspaces.last_owner 409 · workspaces.member_removed 409
effects: audit; the member's open MCP tokens pick up the new roles on the next call

POST /workspaces/{ws}/members/{userId}/remove    auth: session   role: owner|pm   HO: yes
204    errors: workspaces.last_owner 409
effects: status=removed; member's API tokens for this workspace revoked; their claimed tasks → unclaimed (event unclaimed, reason member_removed); audit

PUT /workspaces/{ws}/members/{userId}/github-logins      auth: session   role: owner|pm   HO: yes
body: { logins: string[] }
200: { data: { logins: string[] } }
effects: GithubIdentity rows replaced; existing change cards with matching authorLogin get authorUserId backfilled (job)

GET /workspaces/{ws}/invites                     auth: session   role: owner|pm
200: { data: { id; email; roles; createdBy; expiresAt; acceptedAt }[] }

POST /workspaces/{ws}/invites                    auth: session   role: owner|pm   HO: yes
body: { email: string; roles: Role[] }
201: { data: { id; email; roles; expiresAt; url: string /* https://hub…/ar/invite/<token>, shown once */ } }
errors: workspaces.role_invalid 400 · common.conflict 409 (active invite for the same email)
effects: email sent if SMTP configured; audit

POST /workspaces/{ws}/invites/{id}/resend        auth: session   role: owner|pm   HO: yes   200: { data: { url } } (new token, old revoked)
DELETE /workspaces/{ws}/invites/{id}             auth: session   role: owner|pm   HO: yes   204
```

### 3.6 Settings

```
GET /workspaces/{ws}/settings                    auth: session | token
200: { data: { key: string; value: unknown; default: unknown; isDefault: boolean; updatedAt: string | null; updatedBy: string | null }[] }

GET /workspaces/{ws}/settings/catalogue          auth: session | token
200: { data: { key; type: 'number' | 'string' | 'boolean' | 'string[]' | 'number[]' | 'object'; schema: JsonSchema; description: { ar; en }; group: string }[] }

PUT /workspaces/{ws}/settings/{key}              auth: session   role: owner|pm   HO: yes
body: { value: unknown }
200: setting row
errors: workspaces.setting_unknown 404 · workspaces.setting_invalid 400
effects: audit settings.update; repeatable jobs re-scheduled when `capture.*`/`digest.*` keys change

DELETE /workspaces/{ws}/settings/{key}           auth: session   role: owner|pm   HO: yes   200: setting row (back to default)
```

### 3.7 Sources

```
type SourceDto = { id; kind: 'github_repo' | 'openapi' | 'lab' | 'docs_folder'; name; config: Record<string, unknown>; hasSecret: boolean;
                   enabled; cursor; lastRunAt; lastSuccessAt; lastError; lagSec: number | null; createdAt }

GET /workspaces/{ws}/sources                     auth: session | token   200: { data: SourceDto[] }

POST /workspaces/{ws}/sources                    auth: session   role: owner|pm   HO: yes
body: { kind; name: string /* ^[a-z0-9-]{2,32}$ */; config: Record<string, unknown> /* validated per kind, 03 §4.3 */; secret?: string /* GitHub token; filtered from logs */ }
201: { data: SourceDto }
errors: workspaces.source_kind_invalid 400 · workspaces.source_dependency_missing 422 · common.conflict 409 (name)
effects: repeatable job registered (06); audit (secret never logged)

PATCH /workspaces/{ws}/sources/{id}              auth: session   role: owner|pm   HO: yes
body: { name?; config?; secret?: string | null /* null clears */; enabled?: boolean }
200: { data: SourceDto }

POST /workspaces/{ws}/sources/{id}/test          auth: session   role: owner|pm   HO: yes
200: { data: { ok: true; details: { repo?: string; defaultBranch?: string; permissions?: string[]; filesFound?: number } } }
errors: workspaces.source_connection_failed 422 (details.reason) · github.auth_failed 502

POST /workspaces/{ws}/sources/{id}/run           auth: session   role: owner|pm   HO: yes
202: { data: { runId: string } }
errors: workspaces.source_run_in_progress 409 · capture.source_disabled 409

GET /workspaces/{ws}/sources/{id}/runs?cursor&limit        auth: session   role: owner|pm
200: { data: CaptureRun[] } (03 §8, newest first)

DELETE /workspaces/{ws}/sources/{id}             auth: session   role: owner   HO: yes
204   (soft: enabled=false + `deletedAt` in config; cards keep their `repo` name)
```

### 3.8 Cards (generic)

```
GET /workspaces/{ws}/cards                       auth: session | token
query: { type?: CardType[]; status?: string[]; role?: Role[]; assignee?: string | 'me'; createdBy?: string | 'me'; repo?: string[]; module?: string[];
         tag?: string[]; q?: string; dueBefore?: string; archived?: boolean (owner/pm only); flags?: ('blocked'|'overdue'|'escalated'|'stale'|'noSummary')[];
         sort?: 'lastEvent' | 'created' | 'due' | 'priority' (default lastEvent desc); cursor?; limit? }
200: { data: CardSummary[], meta: { pagination } }

POST /workspaces/{ws}/cards                      auth: session | token   Idempotency-Key supported
body: {
  type: 'task' | 'decision' | 'need' | 'handoff' | 'release';          // change/redesign/doc: system only → 409 cards.type_mismatch
  title: string; body?: Markdown; priority?: Priority; ownerRole?: Role; dueAt?: string; tags?: string[]; module?: string; repo?: string;
  links?: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent'; key: CardKey }[];
  detail:
    | { specialty: Specialty; effort?: Effort; acceptance?: Markdown; prompt?: Markdown }                                     // task  (ownerRole defaults from specialty)
    | { kind: 'product' | 'technical' | 'financial' | 'design'; question: string; options: DecisionOptionInput[]; deciderRole: Role; adrRepoSourceId?: string }   // decision (dueAt defaults to now + decisions.default_due_days)
    | { kind: 'token' | 'account' | 'contract' | 'value_check' | 'file' | 'access' | 'other'; responsibleRole: Role }        // need
    | { kind: 'contract' | 'component' | 'design' | 'data' | 'other'; fromRole: Role; toRole: Role; severity?: 'breaking' | 'notable' | 'info'; summary: string; prompt?: Markdown; payload?: object; sourceKey?: CardKey }   // handoff
    | { version: string; repo?: string; tag?: string; includedKeys?: CardKey[] }                                              // release
}
type DecisionOptionInput = { id?: string /* slug, default from title */; title: string; pros?: string[]; cons?: string[]; cost?: string; recommended?: boolean };
201: { data: CardFull }
errors: common.validation 400 · security.secret_detected 422 · decisions.options_min 400 · cards.not_found 404 (link target) · cards.link_cycle 409 · cards.human_only 403 (release by agent)
effects: Card + detail; event created; watchers: creator (+ assignee); notifications: routed_* to holders of ownerRole (decision/need/handoff), task_ready to the specialty role when status=ready; SSE card.created
initial status: task → `backlog` (or `ready` when `prompt` or `acceptance` given); decision → `open`; need → `requested`; handoff → `pending`; release → `planned`

GET /workspaces/{ws}/cards/{key}                 auth: session | token
200: { data: CardFull }     errors: cards.not_found 404 (archived cards 404 for non-owner/pm)

PATCH /workspaces/{ws}/cards/{key}               auth: session | token   (field permissions per §2)
body: { title?; body?; priority?; ownerRole?; dueAt?: string | null; tags?; module?: string | null; assignee?: string | null; repo?; branch? }
200: { data: CardFull }
errors: cards.archived 409 · common.forbidden 403 (field not allowed for role) · security.secret_detected 422
effects: one field_changed event per changed field; watchers notified (watch_update, grouped); ownerRole change → routed_* to the new role

POST /workspaces/{ws}/cards/{key}/transition     auth: session | token
body: { to: string; reason?: string }
200: { data: CardFull }
errors: cards.invalid_transition 409 · cards.human_only 403 · cards.type_mismatch 409 (transitions with dedicated endpoints — decide, deliver, verify, acknowledge, approve … — are refused here and must use their endpoint)
allowed here: task backlog↔ready, in_progress→in_review, in_review→in_progress, *→cancelled (task/need), need requested→in_progress, release planned→released (owner/pm), handoff pending→dismissed is NOT here (use /dismiss)
effects: status_changed; closedAt set on terminal; blockers resolved → `unblocked` on dependants

POST /workspaces/{ws}/cards/{key}/archive        auth: session   role: owner|pm   HO: yes   200: CardFull   effects: archived event; removed from lists/search
POST /workspaces/{ws}/cards/{key}/restore        auth: session   role: owner|pm   HO: yes   200: CardFull

GET /workspaces/{ws}/cards/{key}/events?cursor&limit         auth: session | token   200: { data: Event[] } (seq asc)

GET /workspaces/{ws}/cards/{key}/comments?cursor&limit       auth: session | token   200: { data: Comment[] } (createdAt asc)
POST /workspaces/{ws}/cards/{key}/comments                   auth: session | token
body: { body: Markdown }
201: { data: Comment }
errors: security.secret_detected 422 · cards.archived 409
effects: commented event; commentCount++; mentions (`@user:<id>` and `@role:<role>`) → notifications mention; watchers → watch_update; author auto-watches
PATCH /workspaces/{ws}/cards/{key}/comments/{id}             auth: session | token   (author, within 15 min)   body: { body }   200: Comment   errors: cards.comment_not_author 403
POST /workspaces/{ws}/cards/{key}/comments/{id}/redact       auth: session   role: owner|pm   HO: yes   200: Comment (body null, redacted true)   effects: redacted event

POST /workspaces/{ws}/cards/{key}/links          auth: session | token
body: { kind: 'blocks' | 'blocked_by' | 'relates' | 'parent' | 'child' | 'duplicates'; key: CardKey }    // blocked_by/child are stored as the inverse row
201: { data: CardFull }      errors: cards.link_self 400 · cards.link_exists 409 · cards.link_cycle 409 · cards.not_found 404
effects: linked event on both cards; `blocked` flag recomputed; watchers notified
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
200: { data: TimelineRow[], meta: { pagination; dayCounts?: { date: string; count: number }[] /* only when from/to given */ } }
type TimelineRow = { event: Event; card: CardSummary; collapsed: number; collapsedKinds: string[] }

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
200: CardFull     effects: field_changed per field

POST /workspaces/{ws}/tasks/{key}/claim          auth: session | token   Idempotency: natural (claim by same user is a no-op 200)
body: { branch?: string }
200: CardFull
errors: tasks.already_claimed 409 · tasks.specialty_role_mismatch 403 · cards.invalid_transition 409 (not backlog/ready) · cards.archived 409
effects: status → claimed; assignee = actor; TaskDetail.claimedBy/At/branch; events claimed + status_changed; watcher(assignee); SSE

POST /workspaces/{ws}/tasks/{key}/unclaim        auth: session | token   200: CardFull   errors: tasks.not_claimer 403   effects: status → ready; assignee null; event unclaimed

POST /workspaces/{ws}/tasks/{key}/start          auth: session | token   200: CardFull   claimed → in_progress; startedAt; errors: tasks.not_claimer 403
POST /workspaces/{ws}/tasks/{key}/submit-review  auth: session | token   body: { prUrl?: string; note?: string }   200   in_progress → in_review; notification task_review to `qa` + pm (kind routed via ownerRole=qa? No: notification kind `watch_update` to watchers + `task_ready`-style `review_requested` to qa holders)
POST /workspaces/{ws}/tasks/{key}/done           auth: session | token   body: { note?: string }   200   claimed|in_progress|in_review → done; doneAt; closedAt; dependants `unblocked`; watchers notified
POST /workspaces/{ws}/tasks/{key}/cancel         auth: session | token   body: { reason: string }   200   any non-done → cancelled
POST /workspaces/{ws}/tasks/{key}/reopen         auth: session   role: owner|pm   200   done|cancelled → ready
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

POST /workspaces/{ws}/decisions/{key}/decide     auth: session   role: R(deciderRole)|owner   HO: yes
body: { optionId: string; rationale: string /* 1..2000 */ }
200: CardFull
errors: decisions.not_decider 403 · decisions.already_decided 409 · decisions.option_not_found 404 · cards.human_only 403
effects: status open → decided; decidedAt/By; events decided + status_changed; ADR skeleton rendered into adrBody when adrBody is null (adrStatus=drafted); cards linked `blocked_by` this decision → `unblocked` + notification unblocked to their assignees/watchers; notification `watch_update` to watchers and `system` to the requester; audit

POST /workspaces/{ws}/decisions/{key}/withdraw   auth: session   HO: yes   body: { reason: string }   200   open → withdrawn
POST /workspaces/{ws}/decisions/{key}/supersede  auth: session   role: owner|pm   HO: yes   body: { byKey: CardKey /* another decision */ }   200   decided → superseded; link relates both ways

PUT /workspaces/{ws}/decisions/{key}/adr         auth: session | token   (§2 "draft ADR body")
body: { body: Markdown /* full ADR markdown, 07 §6.5 format */; path?: string /* default docs/adr/<next-number>-<slug>.md */ }
200: CardFull     errors: decisions.already_decided? no — allowed before and after decide; adrStatus → drafted   effects: field_changed(adrBody)

POST /workspaces/{ws}/decisions/{key}/adr/open-pr   auth: session   role: R|owner|pm   HO: yes
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

POST /workspaces/{ws}/needs/{key}/verify         auth: session   role: R|owner|pm   HO: yes
body: { note?: string }
200: CardFull   delivered → verified; closedAt; blocked cards `unblocked`; audit
POST /workspaces/{ws}/needs/{key}/reject-delivery  auth: session   role: R|owner|pm   HO: yes   body: { reason: string }   200   delivered → in_progress (event status_changed with reason)
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

POST /workspaces/{ws}/handoffs/{key}/apply       auth: session | token   role: R|owner|pm   Idempotency-Key supported
body: { taskKey?: CardKey /* existing task */; createTask?: { title?: string; specialty?: Specialty } /* creates a task linked `relates`, prompt = handoff prompt */; note?: string }
200: CardFull (with appliedTask)
effects: pending|acknowledged → applied; closedAt; event applied; optional task created (origin handoff, status ready, assignee = actor) with event created

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

GET /workspaces/{ws}/redesign/{key}/readme       auth: session | token   200: { data: { markdown: Markdown; review: Markdown | null } }   (raw files from the lab folder)

POST /workspaces/{ws}/redesign/{key}/submit-review   auth: session | token   role: designer|frontend|owner|pm
200: CardFull   errors: cards.invalid_transition 409 (not draft)   effects: draft → review (front-matter written: `status: review`); event status_changed; notification routed_review to owner

POST /workspaces/{ws}/redesign/{key}/approve     auth: session   role: owner   HO: yes   Idempotency-Key supported
body: { note?: string; createPortTask?: boolean (default true) }
200: CardFull
errors: redesign.owner_only 403 · redesign.not_in_review 409 · redesign.lab_unavailable 503 · redesign.write_failed 500
effects: review → approved; front-matter `status: approved`; commit + push to the hub repo (06 §5.6); event approved; port task created (specialty = lab.port_task_specialty, origin redesign_port, prompt = port template 07 §6.7) linked `relates`; notification task_ready to that role; audit

POST /workspaces/{ws}/redesign/{key}/reject      auth: session   role: owner   HO: yes   body: { note: string }   200   review → rejected; front-matter; event rejected
POST /workspaces/{ws}/redesign/{key}/request-changes   auth: session   role: owner|pm|qa   HO: yes   body: { note: string }   200   review → draft; event changes_requested; comment created with the note; notification to designer role
POST /workspaces/{ws}/redesign/{key}/mark-ported auth: session | token   role: frontend|owner|pm   body: { ref: string /* "feat/x@abc123 (Goteav-Dashboard)" */ }   200   approved → ported; front-matter `status: ported`, `ported: <ref>`; event ported; linked port task → done if still open (event status_changed reason ported)
POST /workspaces/{ws}/redesign/rescan            auth: session   role: owner|pm   HO: yes   202: { data: { runId } }
```

### 3.15 Docs

```
type DocDetail = { source: { id; name }; path; kind: 'doc' | 'adr' | 'status' | 'readme' | 'other'; lang; headings: { level; text; anchor }[]; wordCount; lastCommitSha; lastIndexedAt; url: string /* GitHub blob URL */ }

GET /workspaces/{ws}/docs                        auth: session | token
query: { source?: string[]; kind?: string[]; q?: string /* title filter */; cursor?; limit? }
sort: path asc
200: { data: (CardSummary & { detail: DocDetail })[] }

GET /workspaces/{ws}/docs/{key}                  auth: session | token
200: { data: CardFull & { content: Markdown /* raw file from the clone */; toc: DocDetail['headings'] } }
errors: docs.not_found 404

GET /workspaces/{ws}/docs/by-path?source=&path=  auth: session | token   200: same as above   (used by MCP get_doc)

GET /workspaces/{ws}/docs/search?q=&kinds=&limit= auth: session | token   rate: 60/min   200: { data: DocHit[] }

POST /workspaces/{ws}/docs/reindex               auth: session   role: owner|pm   HO: yes   body: { source?: string }   202: { data: { runId } }   errors: docs.reindex_running 409
```

### 3.16 Capture

```
POST /workspaces/{ws}/capture/session            auth: hook token (kind=hook) | mcp token   rate: 60/min/token
body: HookSessionPayload  (05 §3.2; summarised)
  { sessionId: string; reason: 'clear' | 'resume' | 'logout' | 'prompt_input_exit' | 'other' | 'sigterm'; cwd: string; repo: string | null /* source name resolved from git remote */;
    branch: string | null; headSha: string | null; startedAt: string | null; endedAt: string; durationSec: number | null;
    commits: { sha: string; message: string; at: string }[] /* since session start, ≤ 100 */;
    files: { path: string; status: 'A' | 'M' | 'D' | 'R' }[] /* ≤ 300, from git status + diff --name-status */;
    tool?: { version: string } }
202: { data: { sessionLogId: string; cardKey: CardKey | null /* set when a card already exists for this session */ } }
errors: capture.payload_invalid 400 · identity.token_scope 403
effects: SessionLog upsert (hookReceivedAt/hookPayload); delayed job `session.reconcile` at +capture.session.hook_grace_minutes (06 §3)

GET /me/context?cwd=<urlencoded cwd>             auth: hook token | mcp token   (workspace = the token's workspace; no {ws} in the path so the hook needs only HUB_URL + token)
200: text/plain; charset=utf-8  — compact "what's new for you" (≤ 8 000 chars) rendered by digests for SessionStart injection: unread routed items, ready tasks for my roles, my no-summary sessions, last 10 timeline rows; `cwd` lets Hub add the repo/branch hints of the source whose clonePath/app matches
errors: identity.token_scope 403 (session cookie not accepted here)
```

```
GET /workspaces/{ws}/capture/runs?source=&kind=&cursor&limit   auth: session   role: owner|pm   200: { data: CaptureRun[] }

POST /workspaces/{ws}/capture/import/goteav      auth: session   role: owner   HO: yes
body: { decisionsYaml: string /* contents */; suggestionsYaml: string; statusFiles: { name: string; content: string }[]; contractChangesMd: string | null; dryRun?: boolean }
202: { data: { runId } } · dryRun → 200: { data: { wouldCreate: Record<CardType, number>; wouldUpdate: Record<CardType, number>; problems: string[] } }
errors: capture.import_running 409
// The CLI wrapper `scripts/import-goteav.ts` reads the files from F:\Goteav and calls this endpoint; see 06 §7.
```

### 3.17 Inbox and notifications

```
type InboxItem = { id; kind; title; body: string | null; card: CardSummary | null; data: { cardKey?; action?: 'decide' | 'acknowledge' | 'deliver' | 'claim' | 'verify' | 'review' }; groupKey; createdAt; readAt; archivedAt }

GET /workspaces/{ws}/inbox                       auth: session | token
query: { unread?: boolean; kinds?: string[]; cursor?; limit? }   sort: createdAt desc; grouped client-side by groupKey within 30 min
200: { data: InboxItem[], meta: { pagination: { …; total: number /* unread count */ } } }

GET /workspaces/{ws}/inbox/count                 auth: session | token   200: { data: { unread: number; awaitingMe: { decisions: number; needs: number; handoffs: number; reviews: number } } }
POST /workspaces/{ws}/inbox/{id}/read            auth: session | token   204
POST /workspaces/{ws}/inbox/read-all             auth: session | token   body: { before?: string }   204
POST /workspaces/{ws}/inbox/{id}/archive         auth: session | token   204
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
type ReleaseDetail = { version; repo; tag; releasedAt; included: CardSummary[]; notes: { team: Markdown | null; owner: Markdown | null; accountant: Markdown | null } }

GET /workspaces/{ws}/releases?status=&cursor&limit        auth: session | token   200: { data: (CardSummary & { detail: ReleaseDetail })[] }
PATCH /workspaces/{ws}/releases/{key}            auth: session | token   role: owner|pm   body: { version?; repo?; tag?; includedKeys?: CardKey[]; notes?: Partial<ReleaseDetail['notes']> }   200: CardFull
POST /workspaces/{ws}/releases/{key}/generate-notes   auth: session | token   role: owner|pm   200: CardFull   effects: notes skeleton rendered from included cards (07 §6.3) only for audiences still null
POST /workspaces/{ws}/releases/{key}/release     auth: session   role: owner|pm   HO: no   body: { releasedAt?: string }   200   planned → released; notification `system` to all members ("Release X")
```

### 3.21 Audit

```
GET /workspaces/{ws}/audit                       auth: session   role: owner|pm
query: { actor?: string; action?: string /* prefix match */; targetType?; from?; to?; cursor?; limit? }
200: { data: { id; actor: ActorRef; via; action; targetType; targetId; summary; ip; userAgent; createdAt }[] }
```

### 3.22 Events (SSE)

```
GET /workspaces/{ws}/events/stream               auth: session (cookie)   Accept: text/event-stream
headers: Last-Event-ID supported (replays from Redis stream buffer of the last 500 events, 10 min)
keep-alive: `: ping` every 25 s; server closes after 55 min → client reconnects
```

### 3.23 Endpoints added in reconciliation with `09-pages.md`

These are required by the pages and were not in §3.1–3.22. They follow the same conventions.

```
GET /workspaces/{ws}/today                       auth: session | token
200: { data: { brief: Brief & { generatedNow: boolean }; awaitingMe: CardSummary[]; readyTasks: CardSummary[]; deadlines: CardSummary[];
               noSummarySessions: { sessionLogId; sessionId; repo; branch; hookReceivedAt; cardKey }[];
               changesSince: { since: string; events: TimelineRow[]; total: number }; counters: Counters } }
// composite for the Today page (09 §4); `brief` is the same object as /briefs/today; `since` = member.lastSeenAt of the previous visit
// (stored per workspace in Redis `seen:<ws>:<user>` and moved forward by POST /workspaces/{ws}/today/seen)

POST /workspaces/{ws}/today/seen                 auth: session   204   effects: lastSeenAt for this workspace = now

GET /workspaces/{ws}/counters                    auth: session | token
200: { data: Counters }
type Counters = { inboxUnread: number; awaitingMe: number; decisionsOpen: number; decisionsOverdue: number; needsOpen: number;
                  handoffsPending: number; tasksReadyForMe: number; redesignInReview: number; noSummarySessions: number }
// also pushed on the SSE stream as `counters` (§4) after every change that affects the member

GET /workspaces/{ws}/docs/tree                   auth: session | token
200: { data: { source: { id; name }; folders: { path: string; docs: (CardSummary & { detail: DocDetail })[]; folders: Folder[] }[] }[] }
// recursive Folder = { path, docs, folders }; sorted path asc; kinds adr/status grouped under their folder

GET /workspaces/{ws}/onboarding                  auth: session | token
200: { data: { role: Role; items: { id; kind: 'doc' | 'card' | 'url' | 'action'; title; ref: string /* doc path | card key | url | action id */; done: boolean; doneAt }[] }[] }
// one group per role the member holds; items from settings `onboarding.paths`; `action` items (e.g. "install the team pack") auto-complete when the matching event exists (first api token used)
POST /workspaces/{ws}/onboarding/{itemId}/done   auth: session | token   204   effects: OnboardingProgress upsert
DELETE /workspaces/{ws}/onboarding/{itemId}/done auth: session           204   (undo)

GET /workspaces/{ws}/system                      auth: session   role: owner|pm
200: { data: { version: { api; web; lab }; sources: { id; name; kind; enabled; lagSec; lastError; lastSuccessAt }[];
               queues: { name; waiting; active; failed; delayed }[]; outbox: { pending; failed; oldestPendingAgeSec };
               sse: { connections: number }; backup: { lastAt: string | null; sizeBytes: number | null } /* from infra/scripts/backup.sh status file */;
               db: { sizeBytes; cards; events }; worker: { alive: boolean; lastHeartbeatAt } } }

GET /workspaces/{ws}/audit?…&format=csv          auth: session   role: owner|pm
200: text/csv (same filters as 3.21; UTF-8 with BOM; columns id,createdAt,actorKind,actorId,actorName,via,action,targetType,targetId,summary,ip)   max 50 000 rows → else 400 audit.export_too_large

POST /workspaces/{ws}/members/{userId}/disable   auth: session   role: owner   HO: yes   204
effects: User.status=disabled when the user has no other active workspace; otherwise Membership.status=removed (same effects as /remove); sessions + tokens revoked; audit
POST /workspaces/{ws}/members/{userId}/enable    auth: session   role: owner   HO: yes   204
POST /workspaces/{ws}/members/{userId}/password-reset-link   auth: session   role: owner|pm   HO: yes
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
| `card.created` | `{ key, type, status, ownerRole, createdBy: ActorRef }` | any card created |
| `card.updated` | `{ key, type, status, changed: string[] /* field names or 'status' */, lastEventAt }` | any card mutation (one per transaction) |
| `card.event` | `{ key, event: Event }` | each `card_event` row (the timeline consumes this) |
| `comment.created` | `{ key, comment: Comment }` | |
| `inbox.new` | `{ item: InboxItem, unread: number }` | notification for **this** member |
| `inbox.read` | `{ ids: string[], unread: number }` | read elsewhere (another tab/device) |
| `brief.ready` | `{ kind, date }` | morning/weekly brief stored for this member |
| `source.run` | `{ sourceId, status: 'running' | 'ok' | 'failed', created, updated, lagSec }` | owner/pm only |
| `workspace.updated` | `{ counts: Workspace['counts'] }` | throttled to 1/5 s |

Routing: the worker/API publishes to Redis channel `ws:<workspaceId>` with an envelope
`{ event, data, audience: 'all' | { userIds: string[] } | { roles: Role[] } }`; the SSE controller
filters per connection. The client invalidates TanStack Query keys: `['card', key]`,
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
