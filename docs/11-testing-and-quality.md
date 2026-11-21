# 11 — Testing and quality

Same bar as the Goteav backend (D22): tests first where logic is non-trivial, architecture
fitness tests that fail the build when a boundary is crossed, Testcontainers for anything that
touches Postgres/Redis, Playwright for the flows people actually run, and one `pnpm check` gate
that CI and the executing agent both use.

## 1. Test pyramid per app

### 1.1 `apps/api` (NestJS)

| Level | Tool | Scope | Location |
| --- | --- | --- | --- |
| Unit | Jest 29 + `@swc/jest`, `fast-check` for state machines | domain transitions, services with fakes, template renderers (`digests`), secret filter, oasdiff mapper, commit grouping, MCP tool shaping | `src/**/*.spec.ts` next to the code |
| Architecture fitness | Jest (`test/arch/*.spec.ts`) + `dependency-cruiser` (`pnpm arch:check`) | reflection over Nest metadata and Prisma usage (§2) | `test/arch/` |
| e2e | Jest (`test/jest-e2e.config.cjs`) + `supertest` + Testcontainers (`postgres:16` with `pg_trgm`, `unaccent`, `vector`; `redis:7`) | every REST endpoint, the MCP endpoint, the capture adapters against fixture repos, the outbox, reminders/escalations with a fake clock | `test/e2e/<module>.e2e-spec.ts` |
| Chaos (H6) | Toxiproxy via Testcontainers | GitHub API latency/timeouts, Redis loss during SSE | `test/chaos/` |

e2e setup (`test/setup/global-setup.ts`): start containers once per run, run
`prisma migrate deploy`, expose `DATABASE_URL`/`REDIS_URL`; each spec file gets a fresh schema
state via `truncate-all` in `beforeEach`; the worker processors run **inline** (`QUEUE_MODE=inline`
makes `BaseProcessor` execute jobs synchronously in the same process) so adapter and reminder tests
are deterministic. A `FakeClock` is injected through the `Clock` token.

### 1.2 `apps/web` (Next.js)

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest + `@testing-library/react` + `jsdom` | pure components (badges, timeline item renderers per type, relative time in ar/en, RTL-sensitive layouts), hooks (`useTimelineFilters` URL state), i18n catalog completeness (every key in `ar.json` exists in `en.json`) |
| Contract | `pnpm api:check` | generated client is in sync with `apps/api` OpenAPI snapshot |
| e2e | Playwright 1.6x (chromium; `ar` RTL default project + `en` LTR project; viewports 1440 and 390) against a **real stack** (`apps/web/e2e/support/stack.ts`: Testcontainers Postgres and Redis, the built API and web on 7319 and 7359, never the local database; the people and projects made by `global-setup.ts`) | the five critical flows (§1.5) + smoke per page (renders without console errors, no horizontal overflow at 390 px) |
| Accessibility | `@axe-core/playwright` inside the e2e smoke | zero `serious`/`critical` violations on every page, both locales, both themes |

### 1.3 `apps/lab` (Vite)

| What | How |
| --- | --- |
| Build | `vite build --base=/lab/` succeeds with the pinned source checkouts |
| Registry | Vitest over `lab/src/core/registry.ts` and `frontmatter.ts` with a fixture tree (`test/fixtures/lab-tree/`): statuses, version numbering, baseline detection, screenshots discovery |
| Front-matter round trip | `redesign` module (api) reads/writes `README.md` front-matter: write `status: approved` and read it back without touching the body — tested in api unit tests with the same fixture tree |

### 1.4 `packages/team-pack` and `packages/contracts`

| What | How |
| --- | --- |
| Contracts | Vitest: every Zod schema accepts its fixture and rejects the listed invalid cases; `secret-patterns` table test (true positives: AWS key, GitHub PAT `ghp_…`, JWT, PEM header, 32+ hex or base64 after `token=`, `secret=`, `key=`, because a bare 40-hex is a commit sha; true negatives: UUIDs, commit shas, URLs, Arabic text, file paths) |
| CLI | Vitest with a temp `HOME`, `claude` mocked on `PATH` (shell script that records args); asserts config file mode 600, idempotent env markers, doctor table output |
| Hooks | spawn the real scripts with fixture stdin and a local `node:http` mock Hub; assert JSON output, payload validity, outbox fallback on 503, parent exit < 300 ms |
| Plugin | `claude plugin validate ./packages/team-pack/plugin --strict` (skipped locally when `claude` is absent, required in CI) |

### 1.5 The five critical Playwright flows (must stay green from the phase that introduces them)

`pnpm test:e2e:web`, `apps/web/e2e/specs/flows.spec.ts`. First release (`15` §3): F1 lands on Onboarding, F3 ends on `drafted` since there is no GitHub, and F5 reads a temp local lab with no iframe gallery. `live-update.spec.ts` is the acceptance test of `15` §7, and `busy-session.spec.ts` measures the per-user limit.

| # | Flow | Steps | Asserts |
| --- | --- | --- | --- |
| F1 | Sign-in via invite (H0) | owner creates invite (API) → open `/ar/invite/<token>` → set password + name → land on Today | membership roles shown; cookie set; audit row `identity.invite.accept` |
| F2 | Claim a task (H4) | Tasks page → filter specialty → "احجز" → sheet shows me as assignee | card status `claimed`; event row; inbox item for creator |
| F3 | Decide a decision and see ADR status (H3) | Decisions page → open overdue card → choose option B → rationale → confirm (TOTP if enabled) | status `decided`; blocked task shows "unblocked"; ADR status `none` → after `draft_adr` (API) `drafted` → job inline → `pr_opened` with the fake GitHub URL |
| F4 | Deliver a need (H3) | Needs page → "سلّمته" → location text → verify by accountant | status `delivered` → `verified`; secret filter blocks a pasted token with the error toast |
| F5 | Approve a redesign (H2) | Redesign page → version card → gallery iframe loads `/lab/#/…` → "وافِق" | front-matter in the fixture lab tree becomes `approved`; a port task exists in `ready` with specialty frontend |

## 2. Architecture fitness tests (`apps/api/test/arch/`)

Each is a Jest spec that reflects over the compiled Nest app (`createTestApp()` without DB) or
scans source with `ts-morph`:

| Spec | Rule | Failure message |
| --- | --- | --- |
| `events.spec.ts` | every method of `CardService` that writes (name matches `/^(apply|create|…)/`) is covered by a table in `transitions.ts` and every applied action has an `EventKind` | "action X emits no event kind" |
| `permissions.spec.ts` | every controller route has `@Permissions(...)` or `@Public()`; every `@Permissions` key is a row of `@hub/contracts/permissions.ts` | "route X has no permission declaration" |
| `workspace-scope.spec.ts` | every Prisma call inside `modules/**/infrastructure/**` on a table that has `workspace_id` goes through `WorkspaceScoped` (the dev/test Prisma extension throws on a missing `workspaceId` predicate; the spec runs each repository method with a fake and asserts the predicate) | "query on cards without workspace scope" |
| `boundaries` (dependency-cruiser) | `modules/<a>/**` may import `modules/<b>/index.ts` only; `infra/**` never imports `modules/**`; `domain/**` imports no `@nestjs/*`, `@prisma/*`, `bullmq`; `presentation/mcp/**` imports application services only (never `infrastructure/**`) | cruiser report |
| `error-catalogue.spec.ts` | every `AppException` code thrown in `src/**` exists in `shared/errors/error-codes.ts` and has `en` + `ar` messages in `i18n/*/errors.json` | |
| `settings-catalogue.spec.ts` | every `settings.get('x')` key exists in `@hub/contracts/settings.ts` with a default | |
| `mcp-tools.spec.ts` | every registered MCP tool name is in `@hub/contracts/mcp/tools.ts` with the same input schema; no tool name > 60 chars; every mutating action with surface `any` has a tool and none is `web_only` (D27) | |
| `external-key.spec.ts` | every adapter `upsert` passes `externalKey` matching the formats in `03-data-model §5.1` | |

## 3. Coverage thresholds

| Package | Lines | Branches | Enforced where |
| --- | --- | --- | --- |
| `apps/api` `modules/**/domain`, `shared/security`, `digests/templates` | 95 % | 90 % | Jest `coverageThreshold` per glob |
| `apps/api` overall | 80 % | 70 % | CI `test:cov` |
| `packages/contracts` | 95 % | 90 % | Vitest |
| `packages/team-pack` | 85 % | 75 % | Vitest |
| `apps/web` components/hooks | 70 % | 60 % | Vitest (e2e carries the rest) |

## 4. Fixtures and factories

`apps/api/test/factories/` (object mothers, deterministic with `@faker-js/faker` seeded 42):

`workspace()`, `user({ roles })`, `membership()`, `apiToken({ kind })`, `source.githubRepo()`,
`source.openapi()`, `source.lab()`, `source.docsFolder()`, `card.task()`, `card.decision({ due,
options })`, `card.need()`, `card.change.commits()`, `card.change.session()`, `card.handoff()`,
`card.redesign()`, `card.doc()`, `card.release()`, `event()`, `comment()`, `notification()`,
`brief()`.

`apps/api/test/fixtures/`:

| Fixture | Used by |
| --- | --- |
| `git/backend-repo.bundle` — a tiny Git bundle with 3 branches, 25 commits, two versions of `openapi/openapi.json` (one breaking change on `POST /admin/payments/{id}/refund`, one additive) and a `docs/` folder with 4 docs + 2 ADRs | github adapter, openapi adapter, docs indexer, ADR PR job (pushes to a local bare repo) |
| `github/*.json` — recorded REST responses (commits, pulls, rate-limit headers) served by a `nock`/`msw` mock | github client |
| `oasdiff/*.json` — recorded `oasdiff changelog --format json` outputs (breaking, additive, none) | oasdiff mapper + handoff template |
| `lab-tree/` — `web/wallet/{v1-baseline,v2-flight-path}` and `dashboard/finance-currencies/v2-rich-table-panel` with README front-matter, `review.md` with `score: 86`, two PNGs | lab scanner, redesign approve flow, web e2e |
| `sessions/*.json` — hook payloads and `log_session` inputs for the reconciliation matrix | sessions |
| `goteav-import/` — trimmed copies of `_decisions.yaml`, `_suggestions.yaml`, two `status/*.md`, `contract-changes.md` | importer |
| `secrets.txt` / `not-secrets.txt` | secret filter |

`apps/web/e2e/fixtures/seed.ts` calls `scripts/seed-dev.ts --e2e`, which creates the demo
workspace `GTV` with 7 members (one per role) and ~60 cards covering every type/status.

## 5. CI pipeline (`.github/workflows/ci.yml`)

Trigger: pull requests and pushes to `main`. `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.
Runner `ubuntu-latest` (Docker available for Testcontainers). Composite action
`.github/actions/setup` = Node 22 (`.nvmrc`) + pnpm with store cache + `pnpm install --frozen-lockfile`.

| # | Job | Needs | Runs | Cache |
| --- | --- | --- | --- | --- |
| 1 | `lint` | — | `pnpm lint` (eslint + prettier check), `commitlint --from origin/main` on PRs | pnpm store |
| 2 | `typecheck` | — | `pnpm --filter @hub/api prisma:generate && pnpm typecheck` | pnpm store |
| 3 | `arch` | 2 | `pnpm --filter @hub/api arch:check && pnpm --filter @hub/api test:arch` | |
| 4 | `unit` | 2 | `pnpm --filter @hub/contracts test`, `pnpm --filter @hub/team-pack test`, `pnpm --filter @hub/api test:cov`, `pnpm --filter @hub/web test` | upload `coverage/` artifact |
| 5 | `e2e-api` | 2 | `pnpm --filter @hub/api test:e2e` (Testcontainers) | Docker layer cache for `postgres:16`/`redis:7` via `docker pull` step |
| 6 | `openapi` | 2 | `pnpm --filter @hub/api openapi:export` → artifact `openapi.json`; `pnpm --filter @hub/web api:check` against it | |
| 7 | `e2e-web` | 6 | `pnpm --filter @hub/web exec playwright install --with-deps chromium`, start compose.dev + api + web, `pnpm --filter @hub/web test:e2e` (both locale projects, axe) | Playwright browsers cache; upload `playwright-report/` on failure |
| 8 | `plugin` | — | `npm i -g @anthropic-ai/claude-code && claude plugin validate ./packages/team-pack/plugin --strict`; build the team-pack zip + sha256 → artifact | |
| 9 | `lab` | — | `pnpm --filter @hub/lab typecheck && pnpm --filter @hub/lab build` with `LAB_WEB_SRC`/`LAB_DASH_SRC` pointing at shallow clones at the pinned refs (`infra/lab-sources.json`), using `secrets.GOTEAV_READ_TOKEN` | |
| 10 | `images` | 3,4,5 | `docker build` for `api`, `web`, `lab` targets (GHA cache); push only on `main` with tags `sha-<short>` and `main` to `ghcr.io/<org>/hub-{api,web,lab}` | GHA buildx cache |
| 11 | `audit` | — | `pnpm audit --audit-level high` (fails on high/critical), `pnpm licenses list` artifact | |

Required status checks on `main`: 1–9 and 11. `pnpm check` locally runs 1, 2, 3, 4, 6 (fast
gate, < 3 min); e2e jobs run in CI and on demand.

## 6. Code style

| Area | Rule |
| --- | --- |
| TypeScript | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; no `any` (eslint `@typescript-eslint/no-explicit-any: error`); `import type` for types |
| ESLint (root flat config) | `@typescript-eslint` recommended-type-checked, `eslint-plugin-simple-import-sort`, `eslint-plugin-unused-imports`, `eslint-config-prettier` last |
| ESLint web extras | `tailwindcss/no-custom-classname` off, **custom rule `hub/no-raw-palette`**: forbids `bg-red-500`-style palette classes, `text-[13px]`-style literal sizes and hex colours in `className`/`style`; only token utilities (`bg-primary`, `text-muted-foreground`, `text-sm`) — same intent as the dashboard's rule; `react-hooks` recommended; `@next/eslint-plugin-next` |
| ESLint api extras | `@darraghor/eslint-plugin-nestjs-typed` recommended; `no-restricted-imports` mirrors dependency-cruiser for fast feedback |
| Prettier | `printWidth 110`, `singleQuote`, `trailingComma all`, `semi true`; `prettier-plugin-tailwindcss` in web |
| Commits | Conventional Commits via commitlint (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`); scope = module or app; subject ends with the Hub key once Hub tracks its own build (`(HUB-12)`) |
| Branches | `feat/h<phase>-<slug>` for roadmap tasks, `fix/<slug>`, `chore/<slug>`; never commit to `main` directly |
| Files | one Nest provider per file; `kebab-case.ts`; specs next to code; `index.ts` is the only public surface of a module |
| i18n | no literal UI strings in TSX (`eslint-plugin-i18next/no-literal-string` on `apps/web/src/**` excluding tests); catalogs are flat `namespace.key` |

## 7. Definition of done for a roadmap task

A task in `12-roadmap.md` is done when **all** of these hold:

- [ ] Acceptance criteria of the task are demonstrably met (the PR description lists each with how it was verified).
- [ ] Tests exist at the right level: unit for rules, e2e for endpoints/jobs, Playwright when a UI flow is listed; new arch rules added when a new convention was introduced.
- [ ] `pnpm check` green locally; CI green (all required jobs).
- [ ] OpenAPI exported and web client regenerated when the API changed (`pnpm api:sync`), snapshot committed.
- [ ] Migrations are forward-only, named `NNNN_<slug>`, reviewed for locks on big tables; `prisma migrate diff` shows no drift.
- [ ] Both locales: every new UI string in `ar.json` and `en.json`; RTL and LTR screenshots attached for new pages/components (Playwright `toHaveScreenshot` baselines in both).
- [ ] Dark and light checked (screenshots in both).
- [ ] No secrets in code, fixtures, logs or docs; `.env.example` updated for any new variable; `13-operations.md` env table updated.
- [ ] Docs updated: the numbered doc that owns the behaviour, plus a dated entry in `docs/status/` describing what shipped.
- [ ] Audit + event coverage: every new mutation emits an event and an audit row (arch test passes).
- [ ] Accessibility: axe clean on touched pages; keyboard path works for any new interactive element.
- [ ] Performance budgets (§8) still met when the task touches the timeline, search or capture.
- [ ] Owner approval on anything visual that changes layout (owner's standing rule).

## 8. Performance checks

| Budget | How it is measured |
| --- | --- |
| Timeline page query ≤ 100 ms p95 at 50 000 `card_events` / 5 000 cards (one workspace) | `scripts/seed-load.ts --events 50000` then `pnpm --filter @hub/api perf:timeline` (k6 or autocannon, 20 VUs, 30 s) — run in H4 and whenever the timeline query changes; results committed to `docs/status/perf-<date>.md` |
| Full-text search ≤ 150 ms p95 over 20 000 chunks | same harness, `perf:search` |
| GitHub poll cycle for 4 sources ≤ 20 s with 200 new commits | adapter test with the recorded fixtures, timed |
| SSE fan-out: 50 connected clients receive an event ≤ 500 ms after commit | e2e with 50 `EventSource` clients |
| Web: Today and Timeline LCP ≤ 2.0 s on the host over LAN, bundle ≤ 350 KB gz first load | Lighthouse in Playwright (`lighthouse_audit` MCP locally; `@lhci/cli` in CI as a non-blocking job) |
| Containers ≤ 2 GB RAM idle total | `docker stats` snapshot in the ops smoke test |

Indexes that guarantee the first two budgets are listed in `03-data-model.md`; any new timeline
filter must be backed by an index or a documented decision not to.

## 9. Accessibility checks

- `@axe-core/playwright` on every page in the smoke suite (ar + en, light + dark); `serious`/`critical` fail the build.
- Keyboard: a Playwright test tabs through Today, Timeline filters, a card sheet, the decision
  dialog and the command palette, asserting focus order and visible focus ring (`:focus-visible`
  outline token).
- Contrast is enforced by tokens (`08-ux-and-design.md`); a Vitest test computes WCAG contrast
  for every foreground/background token pair used by status badges in both themes (≥ 4.5:1 text,
  ≥ 3:1 UI).
- RTL: Playwright asserts `dir="rtl"` layout mirrors (sidebar on the right, chevrons flipped) and
  that bidi-isolated code spans (`unicode-bidi: isolate`) keep paths/keys readable.
- Reduced motion respected (`prefers-reduced-motion` disables framer-motion transitions).

## 10. Security checks

| Check | Where |
| --- | --- |
| `pnpm audit --audit-level high` | CI job 11, also pre-push hook (advisory) |
| Secret filter table tests (true/false positives) | contracts unit |
| Secret scanning of the repo: `gitleaks` in CI (`gitleaks detect --no-git` on the tree + on the PR diff) | CI job 1 |
| `dependency-cruiser` boundaries | CI job 3 |
| Auth e2e: lockout after 10 failures, refresh rotation and family revocation on reuse, TOTP enforcement for `owner`/`pm`/`accountant`, token revocation effective immediately, hook-kind token rejected outside `/capture/*` | `identity.e2e-spec.ts` |
| Same result for a user and an agent with the same roles, on every action (D27) | e2e |
| Workspace isolation: a member of workspace A cannot read/write any card, doc, token or setting of workspace B (every endpoint, 404 not 403) | `isolation.e2e-spec.ts` (generated from the OpenAPI route list) |
| Headers: Caddy security headers present in the ops smoke test (`infra/scripts/smoke.sh`) | ops |
| Images: `trivy image` on the three images (high/critical fail) on `main` | CI job 10 |
| Rate limits: throttler e2e on `/auth/*`, `/mcp`, `/capture/*` | `throttling.e2e-spec.ts` |
