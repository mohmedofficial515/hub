# 03 — Data model

PostgreSQL 16, Prisma 7 with the multi-file schema folder (`apps/api/prisma/schema/`), driver
adapter `@prisma/adapter-pg`, connection URL in `prisma.config.ts` (`DATABASE_URL`). The executor
confirms the exact Prisma 7 config syntax with context7 before scaffolding; the model below is
normative.

Conventions (same as the Goteav backend): UUID v7 primary keys generated in Postgres
(`uuid_generate_v7()` from migration `0000_init`), `snake_case` table and column names through
`@@map`/`@map`, `timestamptz` everywhere (`@db.Timestamptz(3)`), `created_at`/`updated_at` on
mutable rows, soft state via `*_at` timestamps, no hard deletes on workspace data (D17).

Migration `0000_init` also runs:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;          -- pgvector, reserved for H5
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS uuid AS $$ … $$ LANGUAGE plpgsql;   -- copy from backend 0000_init
CREATE TEXT SEARCH CONFIGURATION hub_simple ( COPY = simple );
ALTER TEXT SEARCH CONFIGURATION hub_simple ALTER MAPPING FOR asciiword, word, hword, hword_part WITH unaccent, simple;
```

## 1. Entity map

```
Workspace 1─* Membership *─1 User              User 1─* Session, ApiToken, PasswordReset, PushSubscription, TelegramLink
Workspace 1─* Invite, WorkspaceSetting, Source, Card, Brief, Notification, AuditLog, SessionLog, GithubIdentity
Card 1─1 (TaskDetail | DecisionDetail | NeedDetail | ChangeDetail | HandoffDetail | RedesignDetail | DocDetail | ReleaseDetail | IdeaDetail | PlanDetail)
Card 1─* CardEvent, CardComment, CardWatcher, CardAttachment, CardLink(from/to), DocChunk (doc cards only)
DocChunk 1─0..1 DocChunkEmbedding
Source 1─* CaptureRun
Notification 1─* NotificationJob (outbox)
```

## 2. identity.prisma

```prisma
model User {
  id            String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  email         String    @unique                       // stored lower-cased; validated by Zod
  passwordHash  String    @map("password_hash")         // argon2id
  displayName   String    @map("display_name")
  locale        String    @default("ar")                // "ar" | "en"
  avatarColor   String    @map("avatar_color")          // one of 12 token names, assigned at creation
  totpSecretEnc String?   @map("totp_secret_enc")       // AES-256-GCM with HUB_SECRET_KEY, base64
  totpEnabledAt DateTime? @map("totp_enabled_at") @db.Timestamptz(3)
  totpRecoveryCodes String[] @default([]) @map("totp_recovery_codes") // sha256 of each unused code
  status        String    @default("active")            // active | disabled
  lastSeenAt    DateTime? @map("last_seen_at") @db.Timestamptz(3)
  defaultWorkspaceId String? @map("default_workspace_id") @db.Uuid // the default project, which switch_project sets (15 §5)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  memberships   Membership[]
  sessions      Session[]
  apiTokens     ApiToken[]
  @@map("users")
}

model Invite {
  id            String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId   String    @map("workspace_id") @db.Uuid
  email         String
  roles         String[]                                // role keys (§4.1)
  tokenHash     String    @unique @map("token_hash")    // sha256 of the 32-byte url token
  createdById   String    @map("created_by_id") @db.Uuid
  expiresAt     DateTime  @map("expires_at") @db.Timestamptz(3)   // 7 days
  acceptedAt    DateTime? @map("accepted_at") @db.Timestamptz(3)
  acceptedUserId String?  @map("accepted_user_id") @db.Uuid
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([workspaceId, email])
  @@map("invites")
}

model Session {                                          // refresh-token family, one row per refresh token
  id           String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  userId       String    @map("user_id") @db.Uuid
  familyId     String    @map("family_id") @db.Uuid
  tokenHash    String    @unique @map("token_hash")
  userAgent    String?   @map("user_agent")
  ip           String?
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  expiresAt    DateTime  @map("expires_at") @db.Timestamptz(3)       // 30 days
  revokedAt    DateTime? @map("revoked_at") @db.Timestamptz(3)
  replacedById String?   @map("replaced_by_id") @db.Uuid
  user         User      @relation(fields: [userId], references: [id])
  @@index([userId, familyId])
  @@map("sessions")
}

model ApiToken {
  id          String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  userId      String    @map("user_id") @db.Uuid       // belongs to the member, not to a workspace (15 §5)
  name        String                                     // "Claude Code — laptop"
  kind        String    @default("mcp")                  // mcp | hook  (hook tokens may only call /capture/*, /me and /me/context)
  prefix      String    @unique                          // "hub_" + 8 chars, part of the shown token, used for lookup
  tokenHash   String    @map("token_hash")               // sha256 of the full token
  lastUsedAt  DateTime? @map("last_used_at") @db.Timestamptz(3)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  revokedAt   DateTime? @map("revoked_at") @db.Timestamptz(3)
  user        User      @relation(fields: [userId], references: [id])
  @@index([userId])
  @@map("api_tokens")
}

model PasswordReset { id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid; userId String @map("user_id") @db.Uuid; tokenHash String @unique @map("token_hash"); expiresAt DateTime @map("expires_at") @db.Timestamptz(3); usedAt DateTime? @map("used_at") @db.Timestamptz(3); createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3); @@map("password_resets") }

model LoginAttempt { id BigInt @id @default(autoincrement()); email String; ip String; succeeded Boolean; createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3); @@index([email, createdAt]); @@index([ip, createdAt]); @@map("login_attempts") }
```

Lockout rule (code, not schema): 10 failed attempts per email **or** per IP in 15 minutes →
`423 hub.identity.locked` for 15 minutes, counted from the failure that completed the ten. Wrong TOTP and
recovery codes count as failures. Attempts refused by a lock are not recorded, so a locked account opens on time.

## 3. workspaces.prisma

```prisma
model Workspace {
  id            String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  slug          String    @unique                       // "goteav" — URL segment
  name          String                                  // "Goteav"
  keyPrefix     String    @unique @map("key_prefix")    // "GTV" — card keys GTV-1, GTV-2 …
  cardSeq       Int       @default(0) @map("card_seq")  // bumped with UPDATE … RETURNING inside the create transaction
  timezone      String    @default("Europe/Istanbul")
  defaultLocale String    @default("ar") @map("default_locale")
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  description   String?                                 // markdown (15 §5)
  goals         String?                                 // markdown
  links         Json      @default("[]")                // { label, url }[]
  repoPaths     String[]  @default([]) @map("repo_paths") // local folders
  status        String    @default("active")            // active | paused | closed; closing is reversible, projects are never deleted
  closedAt      DateTime? @map("closed_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  memberships   Membership[]
  @@map("workspaces")
}

model Membership {
  id          String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  roles       String[]                                  // ≥1 role keys; validated against §4.1
  status      String    @default("active")              // active | removed
  joinedAt    DateTime  @default(now()) @map("joined_at") @db.Timestamptz(3)
  removedAt   DateTime? @map("removed_at") @db.Timestamptz(3)
  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  @@unique([workspaceId, userId])
  @@map("memberships")
}

model WorkspaceSetting {
  workspaceId String   @map("workspace_id") @db.Uuid
  key         String                                    // catalogue §4.2
  value       Json
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  updatedById String?  @map("updated_by_id") @db.Uuid
  @@id([workspaceId, key])
  @@map("workspace_settings")
}

model Source {
  id            String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId   String    @map("workspace_id") @db.Uuid
  kind          String                                  // github_repo | openapi | lab | docs_folder | local_path
  name          String                                  // "backend", "web", "dashboard", "lab", "backend docs"
  config        Json                                    // per kind, §4.3
  secretEnc     String?   @map("secret_enc")            // AES-256-GCM of JSON { read: string, write?: string } — GitHub tokens, Hub's own operational credential (D19); `write` only on the ADR target repo and the hub repo
  enabled       Boolean   @default(true)
  cursor        Json      @default("{}")                // adapter progress, §4.3
  lastRunAt     DateTime? @map("last_run_at") @db.Timestamptz(3)
  lastSuccessAt DateTime? @map("last_success_at") @db.Timestamptz(3)
  lastError     String?   @map("last_error")
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)
  runs          CaptureRun[]
  @@unique([workspaceId, name])
  @@map("sources")
}

model GithubIdentity {                                   // maps commit authors to members
  workspaceId String @map("workspace_id") @db.Uuid
  login       String                                    // GitHub login, lower-cased
  userId      String @map("user_id") @db.Uuid
  @@id([workspaceId, login])
  @@map("github_identities")
}

model OnboardingProgress {                               // which reading-path items a member has ticked
  workspaceId String   @map("workspace_id") @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  itemId      String   @map("item_id")                  // id from settings `onboarding.paths`
  doneAt      DateTime @default(now()) @map("done_at") @db.Timestamptz(3)
  @@id([workspaceId, userId, itemId])
  @@map("onboarding_progress")
}
```

### 4.1 Roles catalogue (code constant in `@hub/contracts/roles.ts`)

| key | label ar / en | notes |
| --- | --- | --- |
| `owner` | المالك / Owner | can do everything in the workspace; the only role that approves redesigns; required to exist (≥1 active) |
| `pm` | مدير المشروع / Project manager | escalation target; members, sources, settings, priorities |
| `accountant` | المحاسب / Accountant | financial decisions and `value_check` needs; UI-only user by default |
| `backend` | الباك إند / Backend | |
| `frontend` | الفرونت إند / Frontend | web + dashboard |
| `designer` | التصميم / Designer | lab versions, design handoffs |
| `qa` | الاختبار / QA | review tasks |

### 4.2 Workspace settings catalogue (`@hub/contracts/settings.ts`, Zod-validated per key)

| key | type | default | used by |
| --- | --- | --- | --- |
| `decisions.reminder_offsets_hours` | `number[]` | `[24, 2]` | reminders before `due_at` |
| `decisions.escalation_hours` | `number` | `24` | hours after `due_at` before escalation to `pm` |
| `decisions.default_due_days` | `number` | `3` | default deadline when none given |
| `handoffs.stale_hours` | `number` | `48` | "pending too long" highlight + reminder |
| `needs.stale_days` | `number` | `5` | reminder to the responsible role |
| `tasks.ready_limit_per_role` | `number` | `20` | size of "ready for you" lists |
| `capture.github.interval_sec` | `number` | `120` | poll period |
| `capture.github.branch_patterns` | `string[]` | `["main", "feat/*", "fix/*", "chore/*"]` | which branches to follow |
| `capture.commit_group_minutes` | `number` | `90` | commit grouping window |
| `capture.lab.interval_sec` | `number` | `60` | lab scanner period (chokidar in dev makes it immediate) |
| `capture.docs.interval_sec` | `number` | `300` | docs indexer period (also triggered by commits touching the docs path) |
| `capture.openapi.path` | `string` | `openapi/openapi.json` | file to diff in the backend repo |
| `capture.session.hook_grace_minutes` | `number` | `10` | wait for `log_session` before creating a facts-only card |
| `digest.morning_time` | `string` | `"07:30"` | local time of the brief |
| `digest.weekly_day_time` | `string` | `"SUN 08:00"` | weekly summary |
| `notifications.quiet_hours` | `{from,to}` | `{"from":"22:00","to":"07:00"}` | push/telegram batching window |
| `security.totp_required_roles` | `string[]` | `[]` | roles that must enrol before using the project (D34) |
| `security.session_refresh_days` | `number` | `30` | |
| `lab.enabled` | `boolean` | `true` | show Redesign pages |
| `lab.port_task_specialty` | `string` | `"frontend"` | specialty of the auto-created port task |
| `timeline.commit_card_min_commits` | `number` | `1` | ignore nothing by default |
| `onboarding.paths` | `Record<role, { id, title, kind: "doc" \| "card" \| "url", ref }[]>` | seeded per workspace from the importer (Goteav: docs 01, 03, 11, map README per role) | Onboarding page reading path per role |
| `modules.catalogue` | `string[]` | `[]` (Goteav import seeds the 18 backend modules) | allowed values of `Card.module` |

### 4.3 Source `config` and `cursor` shapes

```ts
// kind: github_repo
config: { owner: "Alremaal-Co", repo: "Goteav-Dashboard", defaultBranch: "main", app: "dashboard" | "web" | "backend" | "hub", clonePath: "repos/goteav-dashboard" }
cursor: { branches: { [name: string]: { lastSha: string, lastSeenAt: string } }, prs: { lastUpdatedAt: string } }
// kind: openapi  (depends on a github_repo source)
config: { repoSourceId: string, path: "openapi/openapi.json", toRole: "frontend", fromRole: "backend" }
cursor: { lastDiffedSha: string }
// kind: lab
config: { root: "apps/lab" /* relative to the hub checkout mounted at /repos/hub */, apps: ["web","dashboard"], publicBase: "/lab/" }
cursor: { versions: { ["web/wallet/v2-flight-path"]: { status: "draft", readmeHash: string } } }
// kind: docs_folder
config: { repoSourceId: string, path: "docs", include: ["**/*.md"], exclude: ["map/**", "handover/**"], kinds: { "adr/*": "adr", "status/*": "status" } }
cursor: { lastIndexedSha: string }
// kind: local_path  (15 §3: an absolute folder read directly, with no clone or token)
config: { path: "F:/Goteav/backend/docs", purpose: "docs" | "lab", include?: string[], exclude?: string[], kinds?: Record<string, string> }
cursor: { files: { [path: string]: { hash: string } } }
```

## 5. cards.prisma (core)

```prisma
model Card {
  id            String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId   String    @map("workspace_id") @db.Uuid
  seq           Int                                     // per-workspace sequence
  key           String                                  // "GTV-123" (denormalised for search and display)
  type          String                                  // task | decision | need | change | handoff | redesign | doc | release | idea | plan
  title         String                                  // ≤ 200 chars
  body          String?                                 // markdown, ≤ 20 000 chars (a plan ≤ 100 000), secret-filtered
  status        String                                  // per-type machine (01-architecture §4.1)
  priority      String    @default("P2")                // P0 | P1 | P2 | P3
  ownerRole     String?   @map("owner_role")            // routed role (decider / responsible / to-role / specialty-role)
  assigneeId    String?   @map("assignee_id") @db.Uuid  // user (tasks: claimer; others: optional)
  createdByKind String    @map("created_by_kind")       // user | agent | system
  createdById   String?   @map("created_by_id") @db.Uuid // the member (also for agent)
  createdVia    String    @map("created_via")           // web | mcp | hook | adapter | import | telegram
  source        String    @default("manual")            // manual | github | openapi | session | lab | docs | import
  externalKey   String?   @map("external_key")          // idempotency key for adapters, §5.1
  module        String?                                 // free tag from a controlled list per workspace (e.g. payments)
  repo          String?                                 // "backend" | "web" | "dashboard" | "hub" (source name)
  branch        String?
  commitSha     String?   @map("commit_sha")
  dueAt         DateTime? @map("due_at") @db.Timestamptz(3)
  closedAt      DateTime? @map("closed_at") @db.Timestamptz(3)   // terminal status reached
  archivedAt    DateTime? @map("archived_at") @db.Timestamptz(3)
  tags          String[]  @default([])
  commentCount  Int       @default(0) @map("comment_count")
  eventSeq      Int       @default(0) @map("event_seq")  // last card_events.seq, bumped by CardService.apply, so seq is n+1 under the row lock
  lastEventAt   DateTime  @default(now()) @map("last_event_at") @db.Timestamptz(3)
  searchVector  Unsupported("tsvector")? @map("search_vector")  // maintained by trigger: title (A) + key (A) + body (B) + tags (C)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  events        CardEvent[]
  comments      CardComment[]
  watchers      CardWatcher[]
  attachments   CardAttachment[]
  linksFrom     CardLink[] @relation("from")
  linksTo       CardLink[] @relation("to")
  task          TaskDetail?
  decision      DecisionDetail?
  need          NeedDetail?
  change        ChangeDetail?
  handoff       HandoffDetail?
  redesign      RedesignDetail?
  doc           DocDetail?
  release       ReleaseDetail?
  idea          IdeaDetail?
  plan          PlanDetail?

  @@unique([workspaceId, seq])
  @@unique([workspaceId, key])
  @@unique([workspaceId, externalKey])
  @@index([workspaceId, lastEventAt(sort: Desc)])
  @@index([workspaceId, type, status])
  @@index([workspaceId, ownerRole, status])
  @@index([workspaceId, assigneeId, status])
  @@index([workspaceId, dueAt])
  @@index([searchVector], type: Gin)
  @@index([tags], type: Gin)
  @@index([title(ops: raw("gin_trgm_ops"))], type: Gin, map: "cards_title_trgm_idx")
  @@map("cards")
}

model CardLink {
  id          String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  fromCardId  String   @map("from_card_id") @db.Uuid
  toCardId    String   @map("to_card_id") @db.Uuid
  kind        String                                    // blocks | relates | parent | duplicates   (blocked_by = inverse view of blocks)
  createdById String?  @map("created_by_id") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  from        Card     @relation("from", fields: [fromCardId], references: [id])
  to          Card     @relation("to", fields: [toCardId], references: [id])
  @@unique([fromCardId, toCardId, kind])
  @@index([toCardId, kind])
  @@map("card_links")
}

model CardEvent {                                        // append-only; the timeline
  id          String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  cardId      String   @map("card_id") @db.Uuid
  seq         Int                                       // per card, 1..n
  kind        String                                    // §5.2
  actorKind   String   @map("actor_kind")               // user | agent | system
  actorId     String?  @map("actor_id") @db.Uuid
  via         String                                    // web | mcp | hook | adapter | import | scheduler | telegram
  data        Json     @default("{}")                   // kind-specific payload, §5.2
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  card        Card     @relation(fields: [cardId], references: [id])
  @@unique([cardId, seq])
  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([workspaceId, kind, createdAt(sort: Desc)])
  @@map("card_events")
}

model CardComment {
  id             String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId    String    @map("workspace_id") @db.Uuid
  cardId         String    @map("card_id") @db.Uuid
  authorKind     String    @map("author_kind")          // user | agent
  authorId       String    @map("author_id") @db.Uuid
  via            String
  body           String                                 // markdown ≤ 10 000, secret-filtered; @mentions as @user:<id>, cards as GTV-123
  bodyRedactedAt DateTime? @map("body_redacted_at") @db.Timestamptz(3)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  editedAt       DateTime? @map("edited_at") @db.Timestamptz(3)
  card           Card      @relation(fields: [cardId], references: [id])
  @@index([cardId, createdAt])
  @@map("card_comments")
}

model CardWatcher {
  cardId    String   @map("card_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  reason    String                                      // creator | assignee | role | mention | commenter | manual
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  card      Card     @relation(fields: [cardId], references: [id])
  @@id([cardId, userId])
  @@map("card_watchers")
}

model CardAttachment {                                   // lab screenshots and review files; no user uploads in v1
  id        String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  cardId    String   @map("card_id") @db.Uuid
  kind      String                                      // screenshot | review | file
  name      String                                      // "desktop-ar-light.png"
  url       String                                      // "/lab/web/wallet/v2-flight-path/shots/desktop-ar-light.png"
  mime      String?
  width     Int?
  height    Int?
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  card      Card     @relation(fields: [cardId], references: [id])
  @@index([cardId])
  @@map("card_attachments")
}
```

### 5.1 `externalKey` formats

| source | format |
| --- | --- |
| github commit group | `gh:commits:<repo>:<branch>:<firstSha>` |
| github PR | `gh:pr:<repo>:<number>` |
| openapi diff | `oas:<repo>:<fromSha>..<toSha>` |
| session (hook or log) | `session:<claude session_id>` |
| lab version | `lab:<app>/<page>/<version>` |
| doc | `doc:<sourceName>:<path>` |
| import (Goteav map) | `import:decision:<id>` · `import:suggestion:<id>` · `import:status:<file>` · `import:contract:<line-hash>` |

### 5.2 Event kinds and `data`

**One `CardService.apply` writes exactly one event and one audit row per card touched.** A status move inside
an action is part of its event: `from` and `to` are added to `data` (so `claimed` carries `{ userId, branch?,
from, to }`, with no separate `status_changed`). An edit of several fields is one `field_changed` with a list.

| kind | data | emitted by |
| --- | --- | --- |
| `created` | `{ snapshot: { title, status, priority, ownerRole } }` | all |
| `status_changed` | `{ from, to, reason? }` | all |
| `field_changed` | `{ changes: [{ field, from, to }] }` (title, body(hash), priority, ownerRole, dueAt, module, tags, assignee) | all |
| `claimed` / `unclaimed` | `{ userId, branch? }` | tasks |
| `commented` | `{ commentId, excerpt }` | all |
| `linked` / `unlinked` | `{ kind, otherCardKey }` | all |
| `decided` | `{ optionId, optionTitle, rationale }` | decisions |
| `reminder_sent` | `{ offsetHours, channels[] }` | decisions, needs, handoffs |
| `escalated` | `{ toRole, afterHours }` | decisions |
| `delivered` / `verified` | `{ location? , note? }` | needs |
| `acknowledged` / `applied` / `dismissed` | `{ note?, taskCardKey? }` | handoffs |
| `commit` | `{ sha, message, authorLogin, at, files: number, additions, deletions }` | change (commits) |
| `pr_opened` / `pr_merged` / `pr_closed` | `{ number, title, url, base, head }` | change (pr) |
| `session_logged` | `{ sessionId, hasSummary }` | change (session) |
| `approved` / `rejected` / `changes_requested` / `ported` | `{ note?, ref? }` | redesign |
| `unblocked` | `{ byCardKey }` | any blocked card when a blocker closes |
| `archived` / `restored` | `{ reason? }` | owner, pm and the card's creator. This is delete and restore (D28). |
| `plan_revised` | `{ revision, previousBody, restoredFrom? }` | plan: every save of the body, keeping the previous text. `revision` is the new number, so `previousBody` is revision - 1 |
| `plan_steps_changed` | `{ steps }` | plan |
| `idea_to_plan` | `{ planKey }` | idea, moving it to accepted |
| `plan_to_tasks` | `{ taskKeys[] }` | plan |
| `changes_requested` | `{ reason, from: in_review, to: draft }` | plan: Request changes sends a plan in review back to draft, owner or pm, reason required (owner decision 9b, 2026-11-19) |
| `redacted` | `{ commentId }` | owner/pm |
| `watch` / `unwatch` | `{ userId, reason }` | all (not shown in the timeline, only in card history) |

The **timeline query** reads `card_events` (joined to cards for header fields), not cards, so
one card appears each time something happened to it; the UI collapses consecutive events of the
same card within 30 minutes into one row with "+n".

## 6. Per-type detail tables

```prisma
model TaskDetail {
  cardId       String    @id @map("card_id") @db.Uuid
  specialty    String                                   // backend | frontend | design | qa | ops | docs
  effort       String?                                  // S | M | L | XL
  acceptance   String?                                  // markdown checklist
  prompt       String?                                  // markdown, the ready-to-run prompt (rendered by digests when empty and source=import)
  origin       String    @default("manual")             // manual | import_suggestion | session_followup | redesign_port | decision | handoff | plan
  claimedById  String?   @map("claimed_by_id") @db.Uuid
  claimedAt    DateTime? @map("claimed_at") @db.Timestamptz(3)
  branch       String?
  prUrl        String?   @map("pr_url")
  startedAt    DateTime? @map("started_at") @db.Timestamptz(3)
  doneAt       DateTime? @map("done_at") @db.Timestamptz(3)
  card         Card      @relation(fields: [cardId], references: [id])
  @@map("task_details")
}

model DecisionDetail {
  cardId          String    @id @map("card_id") @db.Uuid
  kind            String                                // product | technical | financial | design
  question        String
  options         Json                                  // [{ id, title, pros: string[], cons: string[], cost?: string, recommended?: boolean }]
  deciderRole     String    @map("decider_role")        // == card.ownerRole
  chosenOptionId  String?   @map("chosen_option_id")
  rationale       String?
  decidedById     String?   @map("decided_by_id") @db.Uuid
  decidedAt       DateTime? @map("decided_at") @db.Timestamptz(3)
  remindersSent   Json      @default("[]") @map("reminders_sent")   // [24, 2]
  escalatedAt     DateTime? @map("escalated_at") @db.Timestamptz(3)
  escalatedToRole String?   @map("escalated_to_role")
  adrRepoSourceId String?   @map("adr_repo_source_id") @db.Uuid     // where the ADR PR goes (default: backend docs source)
  adrPath         String?   @map("adr_path")            // docs/adr/0017-….md
  adrPrUrl        String?   @map("adr_pr_url")
  adrStatus       String    @default("none") @map("adr_status")      // none | drafted | pr_opened | merged | failed
  adrBody         String?   @map("adr_body")            // markdown drafted by agent or skeleton
  card            Card      @relation(fields: [cardId], references: [id])
  @@map("decision_details")
}

model NeedDetail {
  cardId           String    @id @map("card_id") @db.Uuid
  kind             String                               // token | account | contract | value_check | file | access | other
  responsibleRole  String    @map("responsible_role")   // == card.ownerRole
  location         String?                              // where the value was put (never the value); secret-filtered
  deliveredById    String?   @map("delivered_by_id") @db.Uuid
  deliveredAt      DateTime? @map("delivered_at") @db.Timestamptz(3)
  verifiedById     String?   @map("verified_by_id") @db.Uuid
  verifiedAt       DateTime? @map("verified_at") @db.Timestamptz(3)
  verificationNote String?   @map("verification_note")
  card             Card      @relation(fields: [cardId], references: [id])
  @@map("need_details")
}

model ChangeDetail {
  cardId        String    @id @map("card_id") @db.Uuid
  kind          String                                  // commits | pull_request | session
  repoSourceId  String?   @map("repo_source_id") @db.Uuid
  authorLogin   String?   @map("author_login")
  authorUserId  String?   @map("author_user_id") @db.Uuid
  commits       Json      @default("[]")                // [{ sha, message, at, files, additions, deletions }] (≤ 200)
  commitCount   Int       @default(0) @map("commit_count")
  filesChanged  Int       @default(0) @map("files_changed")
  additions     Int       @default(0)
  deletions     Int       @default(0)
  windowStart   DateTime? @map("window_start") @db.Timestamptz(3)
  windowEnd     DateTime? @map("window_end") @db.Timestamptz(3)
  prNumber      Int?      @map("pr_number")
  prState       String?   @map("pr_state")              // open | merged | closed
  prUrl         String?   @map("pr_url")
  session       Json?                                   // { sessionId, changed, remaining, durationSec, noSummary, toolSummary? }
  card          Card      @relation(fields: [cardId], references: [id])
  @@map("change_details")
}

model HandoffDetail {
  cardId          String    @id @map("card_id") @db.Uuid
  fromRole        String    @map("from_role")
  toRole          String    @map("to_role")             // == card.ownerRole
  kind            String                                // contract | component | design | data | other
  severity        String    @default("info")            // breaking | notable | info
  summary         String                                // one paragraph, template or agent
  prompt          String?                               // ready prompt for the receiving agent
  payload         Json      @default("{}")              // contract: oasdiff changelog json; component: list of files
  sourceCardId    String?   @map("source_card_id") @db.Uuid   // the change card that caused it
  acknowledgedById String?  @map("acknowledged_by_id") @db.Uuid
  acknowledgedAt  DateTime? @map("acknowledged_at") @db.Timestamptz(3)
  appliedById     String?   @map("applied_by_id") @db.Uuid
  appliedAt       DateTime? @map("applied_at") @db.Timestamptz(3)
  appliedTaskId   String?   @map("applied_task_id") @db.Uuid
  card            Card      @relation(fields: [cardId], references: [id])
  @@map("handoff_details")
}

model RedesignDetail {
  cardId            String    @id @map("card_id") @db.Uuid
  app               String                              // web | dashboard
  page              String                              // "wallet"
  version           String                              // "v2-flight-path"
  labPath           String    @map("lab_path")          // "web/wallet/v2-flight-path"
  labUrl            String    @map("lab_url")           // "/lab/#/web/wallet/v2-flight-path"
  base              String?                             // "v1-baseline"
  touchesComponents String[]  @default([]) @map("touches_components")
  reviewScore       Int?      @map("review_score")      // from review.md "score: 86"
  reviewSummary     String?   @map("review_summary")
  frontMatter       Json      @default("{}") @map("front_matter")
  readmeHash        String    @map("readme_hash")
  approvedById      String?   @map("approved_by_id") @db.Uuid
  approvedAt        DateTime? @map("approved_at") @db.Timestamptz(3)
  rejectedById      String?   @map("rejected_by_id") @db.Uuid
  rejectedAt        DateTime? @map("rejected_at") @db.Timestamptz(3)
  decisionNote      String?   @map("decision_note")
  portTaskId        String?   @map("port_task_id") @db.Uuid
  portedRef         String?   @map("ported_ref")        // "feat/x@abc123 (Goteav-Dashboard)"
  card              Card      @relation(fields: [cardId], references: [id])
  @@map("redesign_details")
}

model DocDetail {
  cardId        String    @id @map("card_id") @db.Uuid
  sourceId      String    @map("source_id") @db.Uuid
  path          String                                  // "docs/21-confirmation-safety.md"
  kind          String                                  // doc | adr | status | readme | other
  lang          String    @default("en")                // en | ar (from suffix ".ar.md" or detection)
  headings      Json      @default("[]")                // [{ level, text, anchor }]
  wordCount     Int       @default(0) @map("word_count")
  lastCommitSha String?   @map("last_commit_sha")      // null for local_path sources
  contentHash   String?   @map("content_hash")         // sha256 of the file, how local_path detects a change
  lastIndexedAt DateTime  @map("last_indexed_at") @db.Timestamptz(3)
  card          Card      @relation(fields: [cardId], references: [id])
  chunks        DocChunk[]
  @@unique([sourceId, path])
  @@map("doc_details")
}

model ReleaseDetail {
  cardId      String    @id @map("card_id") @db.Uuid
  version     String                                    // "2026-10-30" or "1.4.0"
  repo        String?
  tag         String?
  releasedAt  DateTime? @map("released_at") @db.Timestamptz(3)
  includedIds String[]  @default([]) @map("included_ids")   // card ids included
  notes       Json      @default("{}")                  // { team: md, owner: md, accountant: md }
  card        Card      @relation(fields: [cardId], references: [id])
  @@map("release_details")
}

model IdeaDetail {                                       // D29, 15 §4
  cardId          String  @id @map("card_id") @db.Uuid
  problem         String?                                // markdown
  notes           String?                                // markdown
  role            String?                                // optional role the idea concerns
  planCardId      String? @map("plan_card_id") @db.Uuid  // set by "turn into a plan"
  sourceChatId    String? @map("source_chat_id") @db.Uuid    // the Idea Studio chat it was accepted from (owner decision 9c)
  sourceMessageId String? @map("source_message_id") @db.Uuid // the report it holds
  card            Card    @relation(fields: [cardId], references: [id])
  @@index([sourceChatId])
  @@map("idea_details")
}

model PlanDetail {                                       // D29, 15 §4. The body is cards.body.
  cardId          String    @id @map("card_id") @db.Uuid
  steps           Json      @default("[]")               // ordered PlanStep[], below
  revision        Int       @default(1)                  // bumped by each body save; history is in plan_revised events
  sourceIdeaId    String?   @map("source_idea_id") @db.Uuid
  approvedById    String?   @map("approved_by_id") @db.Uuid
  approvedAt      DateTime? @map("approved_at") @db.Timestamptz(3)
  sourceChatId    String?   @map("source_chat_id") @db.Uuid    // the Plan Studio chat it was saved from (owner decision 9c)
  sourceMessageId String?   @map("source_message_id") @db.Uuid // the reply whose plan it holds
  card            Card      @relation(fields: [cardId], references: [id])
  @@index([sourceChatId])
  @@map("plan_details")
}
```

A plan step (`PlanDetail.steps[]`, owner decision 9a, 2026-11-19): `{ id, title, role?, taskKey?, done, why?, size?: 'S' | 'M' | 'L', after?: id[],
acceptance? }`. `why`, `size`, `after` and `acceptance` are what the Plan Studio proposed; the studio's saves write them, so no page parses the plan's
text for them (an older plan's text is still read as a fallback). `after` names earlier steps of the same plan by id: Hub follows an id it changed while
saving and drops any that is not an earlier step. "Create tasks from steps" copies a step's `acceptance` into its task's `acceptance`.

`sourceChatId` and `sourceMessageId` (migration `0014_studio_source_chat`) are written by the Idea Studio's Accept and the Plan Studio's Save, and by
Save to Planning from a chat reply; `GET /ideas?sourceChat=` and `GET /plans?sourceChat=|sourceMessage=` find them. They replace the browser's
`hub:idea-studio:accepted` and `hub:plan-studio:saved` records, which the web now only reads, once, to give an older card its chat.

## 7. docs.prisma

```prisma
model DocChunk {
  id           String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId  String   @map("workspace_id") @db.Uuid
  docCardId    String   @map("doc_card_id") @db.Uuid
  ordinal      Int
  heading      String?                                  // nearest heading path "## 5 › ### 5.3"
  anchor       String?
  content      String                                   // ≤ ~1 500 chars, split on headings then paragraphs
  searchVector Unsupported("tsvector")? @map("search_vector")   // trigger: heading (A) + content (B), config hub_simple
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  doc          DocDetail @relation(fields: [docCardId], references: [cardId])
  embedding    DocChunkEmbedding?
  @@unique([docCardId, ordinal])
  @@index([searchVector], type: Gin)
  @@map("doc_chunks")
}

model DocChunkEmbedding {                                // empty until H5
  chunkId   String   @id @map("chunk_id") @db.Uuid
  model     String
  embedding Unsupported("vector(1024)")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  chunk     DocChunk @relation(fields: [chunkId], references: [id])
  @@map("doc_chunk_embeddings")
}
```

Re-indexing replaces a doc's chunks in one transaction (delete + insert) and keeps the doc card id
stable, so links from other cards survive.

## 8. capture.prisma

```prisma
model CaptureRun {
  id           String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  sourceId     String    @map("source_id") @db.Uuid
  kind         String                                   // github_poll | openapi_diff | lab_scan | docs_index | import
  startedAt    DateTime  @default(now()) @map("started_at") @db.Timestamptz(3)
  finishedAt   DateTime? @map("finished_at") @db.Timestamptz(3)
  status       String    @default("running")            // running | ok | failed
  created      Int       @default(0)
  updated      Int       @default(0)
  error        String?
  cursorBefore Json?     @map("cursor_before")
  cursorAfter  Json?     @map("cursor_after")
  source       Source    @relation(fields: [sourceId], references: [id])
  @@index([sourceId, startedAt(sort: Desc)])
  @@map("capture_runs")
}

model SessionLog {                                       // one row per Claude Code session seen by hook or MCP
  id                String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId       String    @map("workspace_id") @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  sessionId         String    @map("session_id")        // Claude Code session_id
  repo              String?
  branch            String?
  cwd               String?
  hookReceivedAt    DateTime? @map("hook_received_at") @db.Timestamptz(3)
  hookPayload       Json?     @map("hook_payload")      // 05-mcp-and-claude-code §3.2 shape
  summaryReceivedAt DateTime? @map("summary_received_at") @db.Timestamptz(3)
  summaryPayload    Json?     @map("summary_payload")   // log_session input
  cardId            String?   @map("card_id") @db.Uuid  // the change card (kind=session)
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  @@unique([workspaceId, sessionId])
  @@index([userId, createdAt(sort: Desc)])
  @@map("session_logs")
}
```

## 9. notifications.prisma

```prisma
model Notification {                                     // inbox item (in-app); channels fan out through jobs
  id          String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  kind        String                                    // routed_decision | routed_need | routed_handoff | mention | watch_update | deadline_reminder | escalation | unblocked | task_ready | brief | system
  cardId      String?   @map("card_id") @db.Uuid
  groupKey    String?   @map("group_key")               // "card:<id>" — later items with the same key within 30 min merge in the UI
  title       String                                    // rendered at creation in the member's locale (immutable); `data.i18n` keeps { key, params } for re-rendering in the other locale
  body        String?
  data        Json      @default("{}")                  // { cardKey, action?: "decide" | "acknowledge" | "deliver" | "claim", i18n: { key, params } }
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  readAt      DateTime? @map("read_at") @db.Timestamptz(3)
  archivedAt  DateTime? @map("archived_at") @db.Timestamptz(3)
  jobs        NotificationJob[]
  @@index([userId, workspaceId, readAt, createdAt(sort: Desc)])
  @@map("notifications")
}

model NotificationJob {                                  // outbox row per channel
  id             String    @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  notificationId String    @map("notification_id") @db.Uuid
  channel        String                                 // push | telegram | email
  status         String    @default("pending")          // pending | sent | failed | skipped
  attempts       Int       @default(0)
  nextAttemptAt  DateTime  @default(now()) @map("next_attempt_at") @db.Timestamptz(3)
  sentAt         DateTime? @map("sent_at") @db.Timestamptz(3)
  error          String?
  notification   Notification @relation(fields: [notificationId], references: [id])
  @@index([status, nextAttemptAt])
  @@map("notification_jobs")
}

model ChannelPreference {
  userId      String @map("user_id") @db.Uuid
  workspaceId String @map("workspace_id") @db.Uuid
  channel     String                                    // push | telegram | email
  mode        String @default("immediate")              // off | immediate | digest   (digest = batched into the morning brief)
  kinds       String[] @default([])                     // empty = all kinds; else only these
  @@id([userId, workspaceId, channel])
  @@map("channel_preferences")
}

model PushSubscription { id String @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid; userId String @map("user_id") @db.Uuid; endpoint String @unique; keys Json; userAgent String? @map("user_agent"); createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3); failedAt DateTime? @map("failed_at") @db.Timestamptz(3); @@index([userId]); @@map("push_subscriptions") }

model TelegramLink { userId String @id @map("user_id") @db.Uuid; chatId String @unique @map("chat_id"); username String?; linkedAt DateTime @default(now()) @map("linked_at") @db.Timestamptz(3); @@map("telegram_links") }
model TelegramLinkCode { code String @id; userId String @map("user_id") @db.Uuid; expiresAt DateTime @map("expires_at") @db.Timestamptz(3); @@map("telegram_link_codes") }
```

## 10. digests.prisma

```prisma
model Brief {
  id          String   @id @default(dbgenerated("uuid_generate_v7()")) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  userId      String?  @map("user_id") @db.Uuid         // null for workspace-wide weekly summary
  kind        String                                    // morning | weekly
  date        String                                    // "2026-11-04" (workspace local date) or ISO week "2026-W45"
  sections    Json                                      // template output: { awaitingMe: [...], readyTasks: [...], changes: [...], deadlines: [...], noSummarySessions: [...] }
  narrative   String?                                   // agent-written markdown saved through hub.save_brief
  narrativeBy String?  @map("narrative_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)
  @@unique([workspaceId, userId, kind, date])
  @@map("briefs")
}
```

## 11. audit.prisma

```prisma
model AuditLog {
  id          BigInt   @id @default(autoincrement())
  workspaceId String?  @map("workspace_id") @db.Uuid
  actorKind   String   @map("actor_kind")               // user | agent | system
  actorId     String?  @map("actor_id") @db.Uuid
  via         String                                    // web | mcp | hook | adapter | import | scheduler | telegram
  tokenId     String?  @map("token_id") @db.Uuid        // the API token behind an mcp or hook call
  action      String                                    // "cards.decide", "identity.token.create", "settings.update" …
  targetType  String   @map("target_type")
  targetId    String?  @map("target_id")
  summary     String                                    // one line, no secrets
  ip          String?
  userAgent   String?  @map("user_agent")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
  @@map("audit_log")
}
```

## 12. Search

- `cards.search_vector` trigger (`BEFORE INSERT OR UPDATE OF title, body, tags, key`):
  `setweight(to_tsvector('hub_simple', key || ' ' || title), 'A') || setweight(to_tsvector('hub_simple', coalesce(body,'')), 'B') || setweight(to_tsvector('hub_simple', array_to_string(tags,' ')), 'C')`.
- Query: `websearch_to_tsquery('hub_simple', $q)` ranked by `ts_rank_cd`; if fewer than 3 hits, any word instead of all, with the
  common Arabic spellings of each (`ال`, alef forms, final `ة`/`ه` and `ى`/`ي`: `modules/search/domain/query.ts`), because `hub_simple` has no
  stemmer; if still fewer than 3 for cards,
  fall back to trigram similarity on `title` (`similarity(title, $q) > 0.3`) — covers Arabic
  spelling variants and partial English identifiers.
- Doc search = same over `doc_chunks`, grouped by doc with the best 2 chunks each; result carries
  `path`, heading anchor, excerpt with `ts_headline`.
- Both searches are always scoped by `workspace_id` and exclude archived cards unless asked.

## 13. Retention and size

- Events, comments, audit: kept forever (small; estimate < 50 MB/year at this team size).
- `login_attempts`: purge rows older than 30 days (nightly job).
- `notification_jobs` sent/skipped: purge after 30 days; `notifications` archived > 180 days: purge.
- `capture_runs`: keep last 500 per source.
- `briefs`: keep 90 days of morning briefs; weekly forever.
- Lab screenshots live in the lab folder (Git), not in Postgres.
