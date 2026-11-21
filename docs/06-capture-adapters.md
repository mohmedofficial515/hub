# 06 — Capture adapters

How Hub turns outside facts into cards and events without anyone typing. All adapters live in
`apps/api/src/modules/capture` (plus `github`, `redesign`, `docs` for their domain parts) and run
in the **worker** process (`PROCESS_ROLE=worker`). Every adapter is idempotent (03 §5.1), writes
through `CardService.apply` with `actor = { kind: 'system', via: 'adapter' }`, records a
`CaptureRun`, and never blocks the API.

## 1. Common machinery

### 1.1 Queues and jobs (BullMQ 5)

| Queue | Job name | Kind | Schedule / trigger | Options |
| --- | --- | --- | --- | --- |
| `capture` | `github.poll` | repeatable per `github_repo` source | every `capture.github.interval_sec` (default 120 s) | `jobId: github.poll:<sourceId>`, `attempts: 1` (next tick retries), `removeOnComplete: 50`, `removeOnFail: 50` |
| `capture` | `openapi.diff` | on demand | enqueued by `github.poll` when a followed branch touched `capture.openapi.path`; also by "run now" on the `openapi` source (full re-diff of default branch head vs cursor) | `jobId: openapi.diff:<repo>:<from>..<to>`, `attempts: 3`, backoff exponential 30 s |
| `capture` | `lab.scan` | repeatable per `lab` source | every 60 s (fixed) · dev: chokidar on the lab folder enqueues the same job | `jobId: lab.scan:<sourceId>` |
| `capture` | `docs.index` | repeatable per `docs_folder` source | every 5 min; also enqueued by `github.poll` when commits touched `config.path` | `jobId: docs.index:<sourceId>` |
| `capture` | `session.reconcile` | delayed | hook ingestion (§4) | `jobId: session.reconcile:<sessionLogId>`, `delay = capture.session.hook_grace_minutes × 60 000` |
| `capture` | `import.goteav` | on demand | `POST /capture/import/goteav` | `jobId: import.goteav:<workspaceId>` (one at a time) |
| `capture` | `github.backfill-authors` | on demand | `PUT /members/{id}/github-logins` | |

Repeatable jobs are registered with `queue.upsertJobScheduler(schedulerId, { every }, { name, data })`
on worker boot (for every enabled source) and re-registered when a source or a `capture.*`
setting changes (the API publishes `sources.changed` on Redis; the worker re-syncs schedulers).
Disabled sources have their scheduler removed.

Worker concurrency for `capture` is 2. A per-source Redis lock `capture:lock:<sourceId>` (TTL
30 min, released in `finally`) prevents overlapping runs of the same source; a job that finds the
lock held exits immediately with `CaptureRun.status = 'skipped'`-equivalent (logged, no run row).

### 1.2 Local clone manager (`infra/git`)

All Git reads use **local mirrors** in the `repos/` volume (`/repos` inside containers); the GitHub
REST API is used only where Git cannot answer (author logins, pull requests, creating PRs).

```
/repos/
  goteav-backend.git/      bare mirror  (git clone --mirror)   read-only use: log, show, ls-tree, for-each-ref
  goteav-web.git/          bare mirror
  goteav-dashboard.git/    bare mirror
  hub/                     working tree on `main`  (lab front-matter writes, §5.6)
  goteav-web/              working tree (shallow, default branch) — for the lab build only (13-operations §5)
  goteav-dashboard/        working tree (shallow)
```

- `RepoClone.ensure(source)`: if `<clonePath>` missing → `git clone --mirror <url>`; else
  `git fetch --prune --prune-tags origin`. Timeout 120 s. Failures → `hub.github.clone_failed`
  with stderr tail (token redacted) in `CaptureRun.error`.
- Authentication never touches the on-disk config: the remote URL is stored without credentials;
  each command runs with `GIT_ASKPASS=/app/infra/git/askpass.sh` and `HUB_GIT_TOKEN` in the
  child env (read from the decrypted `Source.secretEnc`). `GIT_TERMINAL_PROMPT=0`.
- Reads: `git log <range> --format=%H%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%b%x1e --reverse`,
  `git show <sha>:<path>`, `git ls-tree -r <sha> -- <path>`, `git for-each-ref --format='%(refname:short) %(objectname)' refs/heads`,
  `git merge-base --is-ancestor <a> <b>`, `git diff-tree --no-commit-id --name-status -r <sha>`.
- Mirrors are shared by `github_repo`, `openapi` and `docs_folder` sources of the same repo; the
  `github.poll` run fetches, the others only read (they still call `ensure`, which fetches if the
  last fetch is older than 10 min).

### 1.3 GitHub API access and token permissions (`modules/github`)

Octokit (`@octokit/rest`) with the source token, `userAgent: hub/<version>`, retry plugin (3
attempts), throttling plugin (respects `Retry-After`; secondary limits → `hub.github.rate_limited`,
run marked failed, next tick retries). Each call logs `x-ratelimit-remaining`; metric
`hub_github_rate_remaining{source}`.

Permissions required per repository (fine-grained token, **state them in Settings › Sources**):

| Repository | Read | Write | Why write |
| --- | --- | --- | --- |
| backend (`Goteav-backend`) | contents, metadata, pull requests | contents + pull requests **only if** it is the ADR target (`DecisionDetail.adrRepoSourceId`) | push branch `hub/adr-<key>` and open the ADR PR (04 §3.11) |
| web, dashboard | contents, metadata, pull requests | — | |
| hub | contents, metadata, pull requests | contents | commit + push lab front-matter changes (§5.6) |

> Note for `00-decisions.md` D19: it describes the token as read-only; the ADR PR flow and the
> lab front-matter push require write on two repositories. A source may carry a second token
> (`config.writeTokenRef`) so the read token stays read-only; both are stored in `secretEnc` as
> `{ read, write? }` JSON.

### 1.4 Idempotency

- Cards: `Card.externalKey` unique per workspace (03 §5.1). Adapters **upsert by externalKey**:
  create when absent, otherwise update detail fields and append events only for *new* facts.
- Events: adapters never append an event twice for the same fact. Commits are deduplicated by
  sha against `ChangeDetail.commits[].sha`; PR state events by comparing `prState`; lab status
  events by comparing stored `labStatus`/`readmeHash`; doc content events by blob OID.
- Jobs: deterministic `jobId`s (table above) so a crash + restart cannot double-enqueue.
- Cursors are written **after** the transaction that persisted the facts; a crash in between
  re-processes the same range on the next run, which the upserts absorb.

### 1.5 Runs, failures, retries, metrics

- Every execution creates a `CaptureRun` (`running` → `ok | failed`, `created`, `updated`,
  `cursorBefore/After`, `error`). Last 500 per source are kept.
- `Source.lastRunAt` always; `lastSuccessAt` on `ok`; `lastError` on `failed` (cleared on next
  `ok`). The UI shows `lagSec = now − lastSuccessAt`.
- Failures inside one item (e.g. one malformed commit message) are caught per item, logged with
  the item id, counted in `CaptureRun.error` as `"3 item errors: …"` and do not fail the run.
  Failures of the whole run (clone, auth, DB) mark it `failed`; repeatable jobs simply run again
  at the next tick; on-demand jobs use their `attempts`.
- Metrics (prom-client): `hub_capture_lag_seconds{source,kind}`, `hub_capture_run_duration_seconds`,
  `hub_capture_items_total{source,kind,result=created|updated|skipped|error}`,
  `hub_capture_runs_total{source,status}`.
- SSE `source.run` events (04 §4) to owner/pm.

### 1.6 Testing approach (all adapters)

- **Unit**: pure functions take parsed inputs (fixtures in `apps/api/test/fixtures/capture/`) and
  return "intents" (`{ upserts: CardUpsert[], events: EventIntent[], cursor }`); the processor
  applies intents through `CardService`. Fixtures: `git-log.txt` (20 commits, 3 authors, 2 branches,
  one force-push scenario), `oasdiff-changelog.json` (breaking + warn + info entries),
  `lab/web/wallet/v2-flight-path/README.md` + `review.md`, `docs/sample.md` (Arabic + English,
  nested headings), `_decisions.yaml` / `_suggestions.yaml` excerpts, `contract-changes.md`.
- **e2e** (Testcontainers Postgres + Redis): the test creates a **local bare git repository** in a
  temp dir with `simple-git`, commits fixture files, points a `github_repo` source at
  `file:///tmp/…` (the clone manager accepts `file://` URLs in test env), runs the processor
  directly (no BullMQ scheduler), and asserts cards/events; GitHub API calls are stubbed with
  `nock`/`msw` recordings in `test/fixtures/github/`.
- **Idempotency test** for every adapter: run twice on the same input → second run creates 0,
  updates 0, no new events.

## 2. GitHub adapter — commits, branches, pull requests

**Purpose**: every push to a followed branch and every pull request becomes a `change` card
(`kind: commits | pull_request`) with `commit`/`pr_*` events; task cards learn their branch and PR.

**Inputs**: source `github_repo` (`config.owner/repo/defaultBranch/app/clonePath`,
`cursor.branches[name].lastSha`, `cursor.prs.lastUpdatedAt`, `cursor.seenShas` ring buffer ≤ 5 000,
`cursor.emailToLogin` map), settings `capture.github.branch_patterns`, `capture.commit_group_minutes`,
`timeline.commit_card_min_commits`, `GithubIdentity` rows.

**Algorithm** (`GithubPollProcessor`):

1. `RepoClone.ensure(source)` (fetch). Read all heads; keep branches matching any pattern in
   `capture.github.branch_patterns` (minimatch, e.g. `feat/*`). Deleted branches: drop their cursor
   entry (cards remain).
2. For each followed branch, in name order:
   - `lastSha = cursor.branches[branch]?.lastSha`.
   - **Bootstrap** (no cursor): range = commits on the branch not reachable from any *other already
     cursored* branch head, limited to `--since=7.days` and 200 commits (`git rev-list --no-merges
     --since … --max-count 200 <head> --not <otherHeads>`). This avoids re-importing `main`'s
     history for every new feature branch.
   - **Normal**: if `git merge-base --is-ancestor lastSha head` → range `lastSha..head`
     (`--no-merges` excluded? **Merges are included** but produce no `commit` event of their own
     when they introduce no diff; a merge commit with files is treated like a normal commit).
   - **Force-push / rewritten** (`lastSha` not an ancestor): log a warning, use the bootstrap rule
     for the last 7 days; shas already in `cursor.seenShas` are skipped.
   - Materialise commits (`git log` format §1.2 + `git diff-tree --name-status`,
     `git show --shortstat` for additions/deletions). Skip shas in `seenShas`.
3. Resolve the author login: (a) noreply email `<id>+<login>@users.noreply.github.com` → login;
   (b) `cursor.emailToLogin[email]`; (c) GitHub API `GET /repos/{o}/{r}/commits/{sha}` → `author.login`
   (one call per unknown email, cached); (d) fallback `login = null`, keep `authorName`. Map login →
   member via `GithubIdentity` (lower-cased).
4. **Group** commits into cards. For each commit in chronological order:
   - Candidate = the open group for `(repo, branch, authorLogin ?? authorEmail)` kept in memory for
     this run, or loaded from DB: the newest `change` card with `kind=commits`, same repo/branch/
     author, whose `windowEnd ≥ commit.at − capture.commit_group_minutes`.
   - If found → append: push into `ChangeDetail.commits` (cap 200; beyond that keep counts only),
     `commitCount++`, sums, `windowEnd = commit.at`, title recomputed
     `"<n> commits on <branch>: <first subject>"`, one `commit` event (03 §5.2), `lastEventAt`.
   - Else → create card `change/commits`, `externalKey = gh:commits:<repo>:<branch>:<firstSha>`,
     `status recorded`, `repo`, `branch`, `commitSha = firstSha`, `windowStart = windowEnd = commit.at`,
     `authorLogin`, `authorUserId`, `createdBy = system`, title `"1 commit on <branch>: <subject>"`,
     body = empty (the events carry the messages), events `created` + `commit`.
   - **Worked example** (`capture.commit_group_minutes = 90`, author ali, branch `feat/refunds`):
     commits at 09:00, 09:40, 11:00, 13:30 → group A = {09:00, 09:40, 11:00} (each within 90 min of
     the previous `windowEnd`), group B = {13:30} (150 min after 11:00). A second author's 10:00
     commit on the same branch is its own group.
   - **Card keys in messages**: `/\b([A-Z]{2,6}-\d+)\b/g` → for each existing card in this
     workspace: link `relates` (if absent, event `linked`); if the card is a task with empty
     `TaskDetail.branch` and status `claimed|in_progress` → set `branch` (event `field_changed`).
     `closes|fixes|resolves GTV-123` additionally posts a comment
     (`notifications.commit_mentions_close`) on the task — it never changes task status.
5. **Pull requests** (API): `GET /repos/{o}/{r}/pulls?state=all&sort=updated&direction=desc&per_page=50`,
   paginate while `updated_at > cursor.prs.lastUpdatedAt` (bootstrap: last 30 days). For each PR:
   - Upsert card `change/pull_request`, `externalKey = gh:pr:<repo>:<number>`, title
     `"PR #<n>: <title>"`, body = PR body (secret-filtered; a detected secret replaces the body with
     `[body withheld: <pattern>]`), `branch = head.ref`, `prNumber/prUrl`, `authorLogin`, `additions/
     deletions/filesChanged` from the PR payload, `prState = open | merged (merged_at) | closed`.
   - Events on state change only: `pr_opened` (first seen as open), `pr_merged`, `pr_closed`.
   - Links: card keys in title/body/branch name (`feat/gtv-123-…` matches case-insensitively) →
     `relates`; a linked task with empty `prUrl` gets it (`field_changed`).
   - **ADR PR**: `head.ref` matches `^hub/adr-([a-z]+-\d+)$` → the decision card with that key:
     on merge → `DecisionDetail.adrStatus = merged` + event `field_changed(adrStatus)` +
     `doc` card link created by the docs indexer later; on close without merge → `adrStatus = failed`.
   - Commit group cards whose branch equals the PR head and whose `windowEnd ≥ PR.created_at − 7d`
     get a `relates` link to the PR card (once).
6. **Dependants**: if any processed commit touched `capture.openapi.path` and an `openapi` source
   depends on this repo → enqueue `openapi.diff` `{ openapiSourceId, branch, fromSha: <parent of
   first touching commit or cursor.lastSha>, toSha: <branch head> }` (one per branch per run).
   If any commit touched a `docs_folder` source's `config.path` → enqueue `docs.index` for it.
7. Update `cursor` (branch heads, seenShas, emailToLogin, prs.lastUpdatedAt), finish the run.

**Events emitted**: `created`, `commit`, `pr_opened`, `pr_merged`, `pr_closed`, `linked`,
`field_changed` (branch/prUrl/adrStatus), `commented` (close mentions).

**Notifications**: none for commits (too noisy); `pr_merged` → `watch_update` to watchers of linked
tasks; ADR merged → `system` to the decider.

**Failure handling**: clone/fetch failure → run `failed`; API 401 → `hub.github.auth_failed`,
source `lastError`, SSE to owner/pm, run `failed`; rate limit → run `failed` with `retryAfter`;
per-commit parse errors → item errors.

**Tests**: grouping windows (boundary at exactly 90 min → same group), force-push handling,
bootstrap exclusion of other branches' commits, key extraction (`GTV-12` inside `GTV-123` must not
match), PR state transitions (open→merged, open→closed, reopened), ADR branch recognition,
author mapping chain, idempotent re-run, openapi/docs job enqueueing conditions.

## 3. OpenAPI contract adapter — `oasdiff` → handoff

**Purpose**: a change to `openapi/openapi.json` in the backend becomes a `handoff` card from
`backend` to `frontend` with a classified diff and a ready prompt. Replaces
`.goteav-ops/contract-changes.md`.

**Inputs**: source `openapi` (`config.repoSourceId`, `config.path`, `fromRole`, `toRole`;
`cursor.branches[branch].lastDiffedSha`), job data `{ branch, fromSha, toSha }`, the repo mirror.

**Algorithm** (`OpenapiDiffProcessor`):

1. `RepoClone.ensure(repoSource)` (no fetch if fresh). If `fromSha` is missing (bootstrap of a
   branch) → set `cursor.branches[branch].lastDiffedSha = toSha` and exit (no retroactive handoffs;
   the importer covers history).
2. Extract both versions to a temp dir: `git show <fromSha>:<path> > base.json`,
   `git show <toSha>:<path> > rev.json`. Missing in `fromSha` (file added) → treat `base` as empty
   spec `{ "openapi": "3.0.0", "paths": {} }`.
3. Run `oasdiff changelog base.json rev.json --format json` (binary pinned in the worker image,
   e.g. `oasdiff v1.11.x`; the executor verifies the current release). Timeout 60 s. Exit code
   ≠ 0 or invalid JSON → create the handoff anyway with `severity: notable`, `summary =
   "Contract file changed; automatic diff failed (<reason>)"`, payload `{ error }`.
4. Parse entries: `{ id, text, level, operation, path, source, section, comment? }`. Classification:
   `level 3 (ERR)` → breaking, `level 2 (WARN)` → notable, else info. Severity of the handoff =
   highest class present. **No entries** → nothing created (formatting-only change); cursor advances.
5. Normalise and hash: `diffHash = sha256(JSON.stringify(entries.map(e => [e.id, e.operation, e.path, e.text]).sort()))`.
   If a handoff with `payload.diffHash === diffHash` exists in the last 30 days (typically the same
   change reaching `main` after the feature branch) → add a `relates` link between the existing
   handoff and the new commit group card, append event `field_changed { field: 'branches', to: [...] }`,
   update cursor, exit.
6. Build the summary and prompt with the digests templates (07 §6.6) from the grouped entries:
   by operation `METHOD /path` → list of texts; schemas section for `components` changes.
7. Upsert handoff: `externalKey = oas:<repo>:<fromSha>..<toSha>`, `type handoff`, `status pending`,
   `title = "Contract change on <branch>: <b> breaking, <n> notable, <i> info"`, `priority = P1` if
   breaking else `P2`, `ownerRole = toRole`, `repo`, `branch`, `commitSha = toSha`,
   `HandoffDetail { fromRole, toRole, kind: 'contract', severity, summary, prompt, payload: { entries, diffHash, fromSha, toSha, counts }, sourceCardId = commit group card containing toSha }`.
   Events `created`; link `relates` to the commit group card.
8. `cursor.branches[branch].lastDiffedSha = toSha`; run ok.

**Notifications**: `routed_handoff` to every holder of `toRole` (immediate on all channels when
`severity = breaking`, otherwise per preference); watchers of linked tasks `watch_update`.

**Failure handling**: `oasdiff` missing → run failed with a clear error (`oasdiff binary not found`)
and an SSE to owner/pm; temp dir always removed.

**Tests**: fixture `oasdiff-changelog.json` → severity and counts; empty diff → no card; failed
binary → notable card with error; duplicate-on-main dedupe by `diffHash`; prompt rendering
snapshot (en); externalKey idempotency.

## 4. Claude Code sessions — hook ingestion + `log_session` reconciliation

**Purpose**: every teammate session leaves a `change/session` card: a summary written by the
agent (primary) or, failing that, a facts-only card from Git (fallback), so no work goes
unrecorded.

**Inputs**: `POST /capture/session` (hook or mcp token; 04 §3.16), MCP
`hub.log_session` (05), setting `capture.session.hook_grace_minutes`, `SessionLog` rows.

**Algorithm**:

*4.1 Hook ingestion (API process, `CaptureController`)*
1. Validate the payload (`capture.payload_invalid`); resolve `repo`: the hook sends the git remote
   URL; the API matches it against the workspace's `github_repo` sources (`owner/repo`
   case-insensitive) → source name, else `null`.
2. Upsert `SessionLog (workspaceId, sessionId)`: `userId = actor.userId`, `repo`, `branch`, `cwd`,
   `hookReceivedAt = now`, `hookPayload`. Secret filter on commit messages and file paths (a hit
   rejects the whole payload with `422 hub.security.secret_detected`).
3. If `cardId` already set (summary arrived first) → merge facts into `ChangeDetail`
   (`commits`, `filesChanged`, `durationSec`), event `field_changed { field: 'facts' }`; respond
   `cardKey`.
4. Else enqueue `session.reconcile` delayed by the grace period (deterministic `jobId`, so a
   second hook call for the same session — `reason: resume` then `other` — does not duplicate).
5. Respond `202 { sessionLogId, cardKey: null }`.

*4.2 `log_session` (MCP → `SessionsService.logSummary`)*
1. Input (05): `{ sessionId, repo?, branch?, changed: string, remaining?: string, handoffs?: { toRole, kind, summary, severity? }[], followUps?: { title, specialty, priority?, acceptance? }[], commits?: string[], cardKeys?: CardKey[], durationSec? }`.
2. Upsert `SessionLog`; `summaryReceivedAt = now`, `summaryPayload`.
3. Card: if `SessionLog.cardId` exists (facts-only card created by reconcile) → **upgrade**: body =
   rendered summary (`### Changed` / `### Remaining`), `ChangeDetail.session.noSummary = false`,
   event `session_logged { sessionId, hasSummary: true }`, flag cleared. Else **create**
   `change/session`: `externalKey = session:<sessionId>`, `status recorded`, title
   `"Session: <first line of changed, ≤ 100 chars>"`, `createdByKind = agent`, `createdById = member`,
   `createdVia = mcp`, `repo/branch`, `ChangeDetail { kind: 'session', commits (from hook facts if
   present, else shas listed), session: { sessionId, changed, remaining, durationSec, noSummary: false } }`,
   events `created`, `session_logged`.
4. For each `handoffs[i]` → handoff card (04 §3.8 shape) `fromRole = member's first role matching
   the specialty of the repo (backend repo → backend, web/dashboard → frontend) else first role`,
   `sourceCardId = session card`, link `relates`; `externalKey = session:<sessionId>:handoff:<i>`.
5. For each `followUps[i]` → task card `status backlog`, `origin session_followup`,
   `ownerRole` from specialty, link `relates`; `externalKey = session:<sessionId>:task:<i>`.
6. Every key in `cardKeys` and every `GTV-n` found in `changed`/`remaining` → `relates` link.
7. If the session's commit shas intersect an existing commits group card → `relates` link.
8. Delete the pending `session.reconcile` job if any (`queue.remove(jobId)`; harmless if it already ran).

*4.3 `session.reconcile` (worker)*
1. Load `SessionLog`. If `summaryReceivedAt` → exit.
2. If `hookPayload.commits.length === 0 && files.length === 0` → mark `summaryPayload = { idle: true }`
   (no card: reading-only sessions do not clutter the timeline) and exit.
3. Create the **facts-only** card: as 4.2.3 but `createdByKind = system`, `createdVia = hook`,
   title `"Session on <branch>: <n> commits, <m> files"`, body = 07 §6.4 template,
   `session.noSummary = true`, event `session_logged { hasSummary: false }`. Set `SessionLog.cardId`.
4. Notification `system` to the member (`notifications.session_no_summary`, grouped per day,
   in-app only) telling them to run `/hub:done` or that `/hub:start` will list it.

**Events**: `created`, `session_logged`, `linked`, `field_changed(facts)`.

**Failure handling**: hook payload too large (> 1 MB) → 413; API down when the hook fires → the
hook script writes the payload to `~/.hub/outbox/<sessionId>.json` and the `SessionStart` hook of
the next session re-posts pending files (05 §3). Reconcile job failure → BullMQ retry ×3.

**Tests**: hook-then-summary within grace → one card upgraded, no duplicate; summary-then-hook →
facts merged; hook only → facts card after grace; idle session → no card; handoff/follow-up
creation with deterministic keys (re-logging the same session updates instead of duplicating);
secret in a commit message → 422; repo resolution from remote URL variants (`git@github.com:`,
`https://github.com/…/x.git`).

## 5. Lab scanner — redesign versions

**Purpose**: every version folder in `apps/lab` is a `redesign` card whose status mirrors the
version `README.md` front-matter; Hub's approve/reject/submit actions write the front-matter back.
**The file is the source of truth; the database follows it.**

**Local path mode (first release, docs/15 §3):** the source is `kind: local_path`, `purpose: lab`, with `config.path` inside `LAB_ROOT` when that is set. `pnpm seed:sources` points it at `apps/lab` by default, and `pnpm lab:repoint` moves an existing source there (docs/16 §6). `externalKey` and attachments are relative to the lab root, so a move changes no card. The cursor also says which versions have a `page.tsx`.
It reads the folder and writes front-matter by a line edit, with no gray-matter and no commit, so comments and key order stay. Apps are the
root's folders except `_templates`, `lab`, `shared`; a version folder matches `^v\d+-`. A version unchanged by README hash, review and
screenshot names is skipped. A status from the file bypasses the machine through `plan.status`. Screenshots are served by `GET /lab/file`.

**Inputs**: source `lab` (`config.root` — absolute path of the lab folder inside the hub working
tree, `config.apps`, `config.publicBase`, `config.pushEnabled`; `cursor.versions[path] = { status, readmeHash }`,
`cursor.pages[app/page] = { meta, brief, liveUrl }`), the lab folder on disk.

**Algorithm** (`LabScanProcessor`, in `modules/redesign`):

1. If `pushEnabled`: `git -C /repos/hub pull --ff-only` (10 s timeout; failure → use the working
   tree as is, warn).
2. Glob pages `{web,dashboard}/*/README.md` → parse with `gray-matter`; cache
   `{ app, page, route, liveUrl, status, sources, brief (markdown body) }` in `cursor.pages`.
3. Glob versions `{web,dashboard}/*/*/README.md` (exclude `_templates`, `research`, `node_modules`).
   For each: `readmeHash = sha256(file)`. If `cursor.versions[path].readmeHash === readmeHash` and
   the card exists → skip.
4. Parse front-matter: `version, title, status, base, created, tokens, touches-components, ported`.
   Validation: `status ∈ draft|review|approved|rejected|ported`; a `v1-baseline` folder maps to
   status `reference`. Unknown status → treat as `draft`, item error reported.
5. Screenshots: files `*.png|jpg|webp` in the version folder and `shots/` → attachments with
   `url = <publicBase><path>/<file>`; replaced on every change (delete + insert, keyed by name).
6. `review.md` if present: `reviewScore` = first match of `/\b(\d{1,3})\s*\/\s*100\b/` or a
   front-matter `score:`; `reviewSummary` = first paragraph after `## Summary` (≤ 500 chars).
7. Upsert card `redesign`: `externalKey = lab:<app>/<page>/<version>`, title
   `"<app>/<page> · <version> — <title>"`, `ownerRole = owner`, `RedesignDetail { app, page, version,
   labPath, labUrl = <publicBase>#/<app>/<page>/<version>, base, touchesComponents, reviewScore,
   reviewSummary, frontMatter, readmeHash, portedRef }`, body = README markdown body.
   - New → `status = front-matter status`, events `created`.
   - Existing and front-matter status ≠ card status → `status_changed { from, to, reason: 'lab_file' }`
     (the transition table is bypassed for adapter-driven changes, but `approved/rejected/ported`
     from a file do **not** set `approvedBy` — only the API actions do).
   - Existing and only content changed → `field_changed { field: 'readme' }` (not shown in the
     timeline unless filtered to `redesign`).
8. Versions present in `cursor.versions` but missing on disk → tag `missing-in-lab`, event
   `field_changed { field: 'presence', to: 'missing' }`; status untouched.
9. Update cursor; run ok. Notifications: new version in `review` → `routed_review` to `owner`
   (and `qa`); new version in `draft` → nothing.

*5.6 Writes from Hub (approve / reject / request-changes / submit-review / mark-ported)*

Executed synchronously in the API request (so the user sees failures), with a Redis lock
`lab:write:<workspaceId>`:

1. Read the version `README.md`, parse, set `status` (and `ported: <ref>` for mark-ported;
   `decided: <date> by <displayName>` plus `decision-note:` for approve/reject), write back with
   `gray-matter.stringify` preserving the body byte-for-byte.
2. If `pushEnabled`: `git add <file> && git commit -m "chore(lab): <app>/<page>/<version> → <status>" --author="Hub <hub@goteav.lan>" && git push origin main`.
   Non-fast-forward → `git pull --rebase` and push once more; still failing → restore the file
   (`git checkout -- <file>`) and answer `500 hub.redesign.write_failed`. **No DB change happens
   if the file write fails.**
3. Then the DB transaction: status, `approvedBy/At` etc., events, port task, notifications.
   If the DB step fails after a successful push, the next `lab.scan` reconciles the status from
   the file (the file wins), and the `approvedBy` is recovered from the `decided:` line.

**Tests**: front-matter parsing of the real templates; status mapping incl. `v1-baseline`;
hash-based skip; screenshot attachment refresh; review score extraction; file→DB status change
event; write-back preserves body and unknown front-matter keys; push failure restores the file;
missing-folder tagging; idempotent re-scan.

## 6. Docs indexer

**Purpose**: every Markdown file in a registered docs folder is a `doc` card with searchable
chunks, so people and agents find the design docs, ADRs and status notes from Hub.

**Local path mode (first release, docs/15 §3):** the source is `kind: local_path`, `purpose: docs`. The file's sha256 replaces the blob oid,
`externalKey = doc:<sourceId>:<path>`, and `lastCommitSha` stays null. A file the secret filter refuses is left out and counted on the run. Each
source runs every `capture.docs.interval_sec` from the worker's tick, or now by `POST /sources/{id}/run`. Doc events stay out of the default
timeline and of "since last visit", and publish no per-card message.

**Inputs**: source `docs_folder` (`config.repoSourceId`, `path`, `include`, `exclude`, `kinds`;
`cursor.lastIndexedSha`, `cursor.files[path] = blobOid`), the repo mirror, default branch.

**Algorithm** (`DocsIndexProcessor`):

1. `RepoClone.ensure(repoSource)`; `head = rev-parse origin/<defaultBranch>`. If
   `head === cursor.lastIndexedSha` → exit (run ok, 0 items).
2. `git ls-tree -r <head> -- <path>` → `(blobOid, filePath)` for files matching `include` and not
   `exclude` (minimatch, relative to the repo root). The lab folder, `map/**` (generated) and
   `handover/**` are excluded by the Goteav source config (03 §4.3).
3. For each file: if `cursor.files[filePath] === blobOid` → skip. Else `git show <head>:<filePath>`:
   - **Title**: first `# ` heading, else filename without extension.
   - **Kind**: first matching `config.kinds` glob (`adr/*` → `adr`, `status/*` → `status`),
     `README.md` → `readme`, else `doc`.
   - **Lang**: `.ar.md` → `ar`; else `ar` if Arabic letters ≥ 30 % of letters, else `en`.
   - **Headings**: `#`–`####` with GitHub-style anchors (`github-slugger`), front-matter stripped.
   - **Chunks**: split at `#`–`###` headings; inside a section split on blank lines so that a chunk
     is ≤ 1 500 characters; a chunk under 100 characters merges into the previous one; fenced code
     blocks are never split; tables are kept whole (a table longer than 1 500 chars becomes its own
     chunk). Each chunk records `heading` (path `## 5 › ### 5.3`) and `anchor`.
   - **Card**: upsert `doc` with `externalKey = doc:<sourceName>:<filePath>`, `status current`,
     title, `body = null` (content is read from the clone on demand, 04 §3.15),
     `DocDetail { sourceId, path, kind, lang, headings, wordCount, lastCommitSha = head, lastIndexedAt }`,
     `repo = source name`. Event `created` for new docs, `field_changed { field: 'content' }` for
     changed ones (the timeline shows doc events only when filtered to type `doc` or in the Docs page
     "recently updated" list).
   - Replace `DocChunk` rows for the card in one transaction.
   - **ADR link**: kind `adr` whose path equals a `DecisionDetail.adrPath` → link `relates` and
     set `adrStatus = merged` if the ADR status line says `Accepted`.
   - **Status docs**: kind `status` with a date in the filename `^\d{4}-\d{2}-\d{2}` → tag
     `status:<date>`; the importer backdates these (§7).
4. Files in `cursor.files` no longer in the tree → card `status removed` (event `status_changed`),
   chunks deleted.
5. `cursor.lastIndexedSha = head`, `cursor.files` replaced; run ok. Metric
   `hub_docs_chunks_total{source}`.

**Search** is 03 §12; the indexer only guarantees the `search_vector` trigger has text to work on.

**Tests**: chunker rules (sizes, code fences, tables, tiny-chunk merge) on `docs/sample.md`;
title/kind/lang detection; unchanged blob skip; removal handling; ADR linking; Arabic FTS query
returning the Arabic chunk (e2e).

## 7. One-time Goteav importer

**Purpose**: seed the Goteav workspace with its existing history so day one of Hub shows the
project as it is, not an empty timeline. Re-runnable and idempotent.

**What is read from where** (by `apps/api/scripts/import-goteav.ts`, `pnpm import:goteav --workspace goteav --root F:/Goteav
[--dry-run]`, on the owner's machine. The script reads the files and calls `GoteavImportService` in its own process; there is no
route, and the service never reads a path):

| Input | Path | Becomes |
| --- | --- | --- |
| Decisions | `F:\Goteav\backend\docs\map\data\_decisions.yaml` | `decision` cards |
| Suggestions | `F:\Goteav\backend\docs\map\data\_suggestions.yaml` | `task` cards |
| Status notes | `F:\Goteav\backend\docs\status\*.md` | `doc` cards of kind `status`, **backdated**; `release-2026-09-30.ar.md` additionally → one `release` card |
| Contract changes | `F:\Goteav\.goteav-ops\contract-changes.md` | `handoff` cards already `applied`, backdated |

The importer is the **only** writer allowed to set `createdAt`, `lastEventAt`, `closedAt` and
the `created` event's `createdAt` in the past (`actor.via = 'import'`), so the timeline shows real
dates. So it writes through `CardRepository`, one transaction per card, with the secret filter, its events and one audit row for
the run; `CardService.apply` always uses the clock. A card holding something like a secret is not imported and is listed as a problem.
On the real files (2026-11-05): 2 decisions, 76 tasks, 13 status docs, 1 release, 87 handoffs; a second run creates nothing. The
same run seeds `modules.catalogue`, `onboarding.paths` and the project's `repoPaths`, only where still empty.

**Re-run rule**: a card whose last event was written by `via: import` is updated in place; a card
that has any later human/agent/adapter event is left untouched and listed in the run report
(`"skipped (edited since import): GTV-45"`). `dryRun: true` reports counts and problems only.

### 7.1 `_decisions.yaml` → decisions

YAML shape (observed): `decisions[]` with `id, titleAr, status, modules[], lastVerifiedAt, reviewBy,
questionAr, contextAr[], summaryAr, recommendationAr, planAr[], rules[] { titleAr, bodyAr, impactAr,
confidence, sources[] }, options[] { id, name, verdict, prosAr[], consAr[], pricingAr }, openQuestions[], sources{}`.

| Card field | From |
| --- | --- |
| `externalKey` | `import:decision:<id>` |
| `title` | `titleAr` (≤ 200; longer → truncated with `…`, full title in body) |
| `body` | Markdown: `## الملخص` summaryAr · `## السياق` bullets contextAr · `## التوصية` recommendationAr · `## الخطة` numbered planAr · `## القواعد` one `###` per rule with body, impact, `confidence` badge and source ids · `## المصادر` from `sources` (name, url, type, reachability, checkedAt) |
| `DecisionDetail.kind` | `financial` if `modules` ∩ {payments, wallet, invoicing, pricing, loyalty} ≠ ∅, else `product` |
| `question` | `questionAr` |
| `options` | the YAML's `options` when present (`recommended` from `verdict`). When there are none, two are synthesised: `{ id: 'recommended', title: first sentence of recommendationAr (≤ 120), pros: [], cons: [], recommended: true }` and `{ id: 'defer', title: 'Defer — revisit before <reviewBy>' }`. The body keeps the full recommendation. |
| `deciderRole` / `ownerRole` | `owner` |
| `status` / dates | `proposed` → `open`, `dueAt = importedAt + 14 d` · `approved`, `done` → `decided`, `chosenOptionId = recommended`, `rationale = summaryAr` (≤ 2 000), `decidedAt = lastVerifiedAt`, `decidedById = owner` · `deferred` → `open`, `dueAt = reviewBy` · `rejected` → `withdrawn` · unknown → `open` + problem |
| `createdAt` | `lastVerifiedAt` if present else import time |
| `module` / `tags` | `modules[0]` / `modules` + `imported` + `research` |
| `priority` | `P1` |

Events: `created` (backdated) and `decided` (backdated to `decidedAt`) when decided.

### 7.2 `_suggestions.yaml` → tasks

YAML shape: `suggestions[]` with `id, titleAr, summaryAr, problemAr?, target (backend | dashboard |
web | both | mobile), modules[], category, priority (P0–P3), effort (S–XL), status, evidence[],
prompt?` (the map renders a prompt when absent).

| Card field | From |
| --- | --- |
| `externalKey` | `import:suggestion:<id>` |
| `title` | `titleAr` |
| `body` | `summaryAr` · `## المشكلة` problemAr · `## المقترح` proposalAr · `## الفوائد` benefitsAr · `## الحالة` statusNoteAr · `## الأدلة` evidence paths as code |
| `TaskDetail.specialty` | `backend` → `backend`; `dashboard`, `web` → `frontend`; `both` → `backend` + tag `needs-frontend` (a follow-up frontend task is created only when the owner asks); `mobile` → `backend` + tag `mobile` |
| `ownerRole` | from specialty |
| `effort`, `priority` | as given (`priority` default `P2`) |
| `prompt` | YAML `prompt` if present; else rendered by digests (07 §6.8) from title/body/evidence |
| `acceptance` | `acceptanceAr` as bullets, else `null` |
| `origin` | `import_suggestion` |
| `status` | `proposed` → `backlog` · `approved` → `ready` · `in_progress` → `ready` + tag `was-in-progress` (no claimer known) · `done` → `done`, `closedAt = importedAt`, `doneAt` same · `deferred` → `backlog`, priority `P3`, tag `deferred` · `rejected` → `cancelled` |
| `module` / `tags` | `modules[0]` / `modules` + `category` + `imported` |

### 7.3 `docs/status/*.md` → backdated status docs and one release

- For each file: upsert the `doc` card with the **same externalKey the indexer uses**
  (`doc:backend-docs:docs/status/<file>`, on a `local_path` source named `backend-docs`), `kind status`, `lang` from `.ar.md`,
  `createdAt` = the leading date in the filename (`2026-09-20-m7-progress-ar.md` → 2026-09-20)
  or, for undated files (`integration-gaps.md`, `integration-review.md`), the file's first commit
  date supplied by the script (`git log --diff-filter=A --format=%aI -- <file>`). The indexer later
  fills chunks and `lastCommitSha`; it must not reset `createdAt` (upsert keeps it).
- `release-2026-09-30.ar.md` → `release` card: `externalKey = import:release:2026-09-30`,
  `version = 2026-09-30`, `repo = backend`, `status = released`, `releasedAt = 2026-09-30`,
  `notes.team` = the file body, `createdAt` backdated; link `relates` to the status doc card.

### 7.4 `contract-changes.md` → applied handoffs

Line format (observed): `- YYYY-MM-DD \`branch\` \`sha\`[, \`sha\`…] (actor): text …` where text
may contain `**breaking**` and often ends with `(IR-xxx)`.

| Card field | From |
| --- | --- |
| `externalKey` | `import:contract:<sha256(line)[0:16]>` |
| `title` | `"Contract change <date>: "` + first sentence of text (≤ 160) |
| `HandoffDetail` | `fromRole backend`, `toRole frontend`, `kind contract`, `severity`: `**breaking**` → `breaking`; `Not breaking` / `not breaking` → `info`; else `notable`; `summary = text`; `payload = { shas, actorLabel, issueRefs: ['IR-020'…] }` |
| `status` | `applied`; `appliedAt = date`; `closedAt = date`; `acknowledgedAt = date` |
| `createdAt` | `date` |
| `repo`, `branch`, `commitSha` | `backend`, branch, first sha |
| `ownerRole` | `frontend` |
| `tags` | `imported`, `contract` |

Linking these to commit cards waits for the GitHub adapter (H2-02, deferred by 15 §3).

### 7.5 Run report

`CaptureRun.kind = import`, `cursorAfter = { decisions: n, tasks: n, docs: n, releases: n,
handoffs: n, skippedEdited: [...keys], problems: [...] }`; the CLI prints it and exits non-zero
when `problems` is non-empty.

**Tests**: YAML fixtures (2 decisions with every status, 3 suggestions, one `both` target),
status filename date parsing, contract line parser (multi-sha, breaking detection, IR refs),
backdating of `createdAt`/events, re-run idempotency, "edited since import" skip.
