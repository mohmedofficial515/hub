# 02 — Repository structure

One monorepo `hub` (pnpm workspaces, no Turborepo; root scripts fan out with `pnpm -r`). Node 22
(`.nvmrc`), pnpm 10 (`packageManager`), TypeScript 5.x strict, ESLint flat config + Prettier
shared from the root.

```
hub/
├── .github/
│   ├── workflows/ci.yml                 # lint · typecheck · unit · e2e (Testcontainers) · build images · openapi artifact · lab build
│   └── actions/setup/action.yml         # Node 22 + pnpm with cached store + install (copy of backend's)
├── .husky/                              # pre-commit lint-staged · commit-msg commitlint
├── .nvmrc  .npmrc  .editorconfig  .gitignore  .prettierrc  eslint.config.mjs  commitlint.config.cjs
├── package.json                         # root scripts (below)  ·  pnpm-workspace.yaml  ·  tsconfig.base.json
├── README.md                            # what Hub is, 10-minute local run, link to docs/
├── docs/                                # THIS PLAN = product docs (00…14, adr/, status/)
├── apps/
│   ├── api/                             # NestJS: REST + MCP + worker (one image, PROCESS_ROLE)
│   ├── web/                             # Next.js 15 app
│   └── lab/                             # The redesign lab: Vite, versions and screenshots, served by Hub at /lab (docs/16 §6)
├── packages/
│   ├── contracts/                       # @hub/contracts — Zod schemas + TS types shared by api, web, team-pack
│   └── team-pack/                       # @hub/team-pack — Claude Code plugin + `hub` CLI installer
├── infra/
│   ├── compose.yaml                     # production-on-LAN: caddy, web, api, worker, migrate, postgres, redis
│   ├── compose.dev.yaml                 # developer machine: postgres, redis, mailpit only (apps run with pnpm dev)
│   ├── caddy/Caddyfile  caddy/Caddyfile.vps
│   ├── docker/api.Dockerfile  docker/web.Dockerfile  docker/lab.Dockerfile  docker/entrypoint.sh
│   ├── postgres/init/01-extensions.sql  # CREATE EXTENSION pg_trgm, unaccent, vector
│   └── scripts/                         # host scripts: install-host.sh, backup.sh, restore.sh, update.sh
└── scripts/
    ├── import-goteav.ts                 # one-time import of F:\Goteav docs/map YAML + status/ + contract-changes.md (wraps api importer)
    └── seed-dev.ts                      # demo workspace + members + cards for local development
```

Root `package.json` scripts:

```
dev            pnpm -r --parallel --filter ./apps/* dev       (api on 7310, web on 7300, lab on 7320)
build          pnpm -r build
typecheck      pnpm -r typecheck
lint           eslint . && prettier --check .
test           pnpm -r test
test:e2e       pnpm --filter @hub/api test:e2e && pnpm --filter @hub/web test:e2e
check          pnpm lint && pnpm typecheck && arch:check && pnpm test && openapi:export && pnpm --filter @hub/web api:check
api:sync       pnpm --filter @hub/api openapi:export && pnpm --filter @hub/web api:sync
db:migrate     pnpm --filter @hub/api prisma:migrate
compose:up     docker compose -f infra/compose.dev.yaml up -d
```

## apps/api

**How to add a card type, an action, an endpoint or an MCP tool: `apps/api/README.md`.** Reality differs
from the tree below in three small ways: `prisma.config.ts` sits at `apps/api/`; ESLint is one root config
(`eslint.config.mjs` with `tools/eslint/`), so `apps/web` has no config of its own; and modules gain their
folders as they gain code.

```
apps/api/
├── package.json                          # @hub/api · nest build (swc) · scripts: dev start typecheck lint test test:e2e prisma:* openapi:export
├── nest-cli.json  tsconfig.json  tsconfig.build.json  jest.config.cjs  .dependency-cruiser.cjs
├── prisma/
│   ├── schema/                           # multi-file (prismaSchemaFolder) — see 03-data-model.md
│   │   ├── schema.prisma                 # generator + datasource
│   │   ├── identity.prisma  workspaces.prisma  cards.prisma  decisions.prisma  needs.prisma
│   │   ├── handoffs.prisma  redesign.prisma  docs.prisma  capture.prisma  notifications.prisma
│   │   ├── digests.prisma  audit.prisma
│   ├── migrations/                       # 0000_init creates extensions + uuid_generate_v7()
│   └── seed.ts                           # roles catalogue, default settings, first owner from env (HUB_OWNER_EMAIL / HUB_OWNER_PASSWORD)
├── openapi/openapi.json                  # exported (gitignored; CI artifact; web generates its client from it)
├── scripts/export-openapi.ts  scripts/swc-register.cjs
├── src/
│   ├── main.ts  app.module.ts  app.setup.ts  swagger.ts  instrument.ts (optional Sentry)
│   ├── config/env.schema.ts  app-config.ts  config.module.ts
│   ├── i18n/{en,ar}/errors.json  common.json  notifications.json  digests.json  adr.json
│   ├── shared/
│   │   ├── errors/        # error catalogue, AppException, Prisma error mapper (copied pattern from backend)
│   │   ├── http/          # envelope interceptor, exception filter, pagination, idempotency, actor decorator
│   │   ├── security/      # secret-filter.ts (uses @hub/contracts patterns), hashing
│   │   ├── zod/           # shared schemas (cardKey, locale, cursor)
│   │   └── utils/         # clock, ids (uuid v7), markdown, slug
│   ├── infra/
│   │   ├── prisma/        # PrismaModule, PrismaService, workspace-scope extension, transactional (nestjs-cls)
│   │   ├── redis/         # clients, lock, pub/sub
│   │   ├── queue/         # BullMQ root, QUEUES, typed jobs, BaseProcessor, PROCESS_ROLE gate
│   │   ├── outbox/        # notification outbox publisher
│   │   ├── git/           # local clone manager over the repos/ volume (simple-git)
│   │   ├── mail/  telegram/  push/        # transports
│   │   └── logger/  i18n/  clock/  throttler/
│   └── modules/
│       ├── identity/      workspaces/     cards/        tasks/         decisions/     needs/
│       ├── handoffs/      redesign/       docs/         capture/       github/        notifications/
│       ├── digests/       today/          search/       scheduler/     system/  (system runs local sources and answers /system and /metrics)
│       ├── digests/       mcp/            audit/        realtime/      health/
│       └── <module>/
│           ├── index.ts                   # PUBLIC API of the module (facade + types)
│           ├── <module>.module.ts  <module>.errors.ts  <module>.permissions.ts
│           ├── domain/                    # transitions.ts, rules, value objects
│           ├── application/               # services (use cases), dto/, ports/
│           ├── infrastructure/            # prisma repositories, adapters
│           ├── presentation/              # http/*.controller.ts, mcp/*.tools.ts, jobs/*.processor.ts
│           └── testing/                   # fakes + builders used by other modules' specs and e2e
└── test/
    ├── jest-e2e.config.cjs  setup/ (Testcontainers postgres+redis, migrate, truncate)  factories/  helpers/
    ├── arch/                              # fitness tests: every controller has permissions, every card action emits an event, workspace scope present
    └── e2e/<module>.e2e-spec.ts
```

## apps/web

```
apps/web/
├── package.json                           # @hub/web · next dev -p 7300 · api:sync (hey-api) · test (vitest) · test:e2e (playwright)
├── next.config.ts  postcss.config.mjs  components.json (shadcn new-york, neutral, cssVariables)  eslint.config.mjs  playwright.config.ts  vitest.config.ts
├── messages/ar.json  messages/en.json      # next-intl catalogs (namespaces: common, nav, timeline, cards, decisions, needs, handoffs, redesign, docs, inbox, settings, auth, errors)
├── public/  (icons, manifest.webmanifest, sw.js for push)
├── openapi/openapi.json                   # snapshot used by api:check
├── scripts/api/sync.ts  scripts/api/watch.ts
└── src/
    ├── middleware.ts                       # locale + auth redirect
    ├── app/
    │   ├── layout.tsx  globals.css (tokens, 08-ux-and-design.md)
    │   ├── [locale]/
    │   │   ├── (auth)/sign-in  invite/[token]  reset/[token]  totp
    │   │   ├── (app)/[workspace]/
    │   │   │   ├── layout.tsx              # shell: sidebar, topbar, command palette, SSE provider
    │   │   │   ├── today/  timeline/  tasks/  decisions/  needs/  handoffs/  redesign/  docs/  releases/
    │   │   │   ├── inbox/  ask/  onboarding/  cards/[key]/  members/  settings/(general|sources|roles|notifications|tokens|system|audit)
    │   │   └── (app)/workspaces/           # pick / create workspace
    │   └── api/push/  (route handlers only for the service worker registration helper)
    ├── components/
    │   ├── ui/                             # shadcn primitives (generated)
    │   ├── shell/                          # Sidebar, Topbar, CommandPalette, WorkspaceSwitcher, LocaleSwitcher, ThemeToggle
    │   ├── cards/                          # CardChip, CardHeader, StatusBadge, PriorityBadge, RoleBadge, CardLinks, CardComments, CardEvents, CardSheet (drawer)
    │   ├── timeline/                       # TimelineList, TimelineItem (per type renderers), TimelineFilters, DayDivider
    │   ├── decisions/ needs/ handoffs/ tasks/ redesign/ docs/ inbox/ today/   # feature components
    │   └── common/                         # EmptyState, ErrorState, Skeletons, Markdown, RelativeTime, KeyboardHint, CopyButton
    ├── features/<name>/                    # hooks + queries per feature (useTimeline, useInbox …)
    ├── lib/api/ (generated client + ky wrapper)  lib/sse.ts  lib/i18n.ts  lib/utils.ts  lib/push.ts
    ├── stores/ui.ts
    └── test/  e2e/
```

## apps/lab

The lab tree, copied from `F:\Goteav\redesign` in the Workbench release (docs/16 §6), unchanged except paths:

```
apps/lab/
├── package.json  vite.config.ts  tsconfig.json  README.md  PLAN.md
├── lab/  shared/  _templates/  web/<page>/…  dashboard/<page>/…      # as today
```

`vite.config.ts` reads the two source roots from `LAB_WEB_SRC` and `LAB_DASH_SRC`, by default
`../../../web/src` and `../../../Goteav-Dashboard/src`, so a machine with the Goteav checkouts next to
`hub/` needs nothing. Base path `/lab/`, on the dev server too, because Hub's proxy serves it there. The lab
only reads those projects. Version folders keep their exact bytes (`.gitattributes`), and ESLint and Prettier skip
`apps/lab`. Its `typecheck` covers the gallery core; `typecheck:versions` is the slow one over every version and the
sibling projects, and is not part of `pnpm check`. `build:static` is not part of `pnpm build`.

## packages/contracts

```
packages/contracts/src/
├── index.ts
├── cards/  card.ts  machine.ts  task.ts  decision.ts  need.ts  change.ts  handoff.ts  redesign.ts  doc.ts  release.ts  idea.ts  plan.ts   # Zod payload schemas + status enums + machines (CARD_MACHINES)
├── roles.ts  actor.ts (Principal, Actor)  permissions.ts (matrix as data)  projects.ts  events.ts (event kinds, realtime message)  errors.ts (codes)  secret-patterns.ts
├── mcp/ tools.ts (the tool table; input schemas arrive with H1-01)  prompts.ts (H1-01)
└── capture/ session-log.ts  hook-payload.ts  oasdiff.ts
```

Consumed by `apps/api` (validation), `apps/web` (types + status labels), `packages/team-pack`
(hook payload shape). Built with `tsup` to ESM + CJS.

## packages/team-pack

```
packages/team-pack/
├── package.json                            # @hub/team-pack · bin: hub
├── src/cli/  (init, login, doctor, uninstall)  # npx @hub/team-pack init  → asks hub URL + token → writes config, installs plugin, trusts CA, writes hosts entry if needed
├── plugin/                                 # the Claude Code plugin (05-mcp-and-claude-code.md §4)
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json                           # hub server, http, Authorization from ${HUB_TOKEN}
│   ├── skills/hub/SKILL.md                 # how to work with Hub (start / next / done / ask / decision / need)
│   ├── hooks/hooks.json  hooks/session-end.mjs  hooks/session-start.mjs
│   └── CLAUDE.md.snippet                   # appended to the project CLAUDE.md by `hub init --claude-md`
└── README.md
```

## docs (this folder, after the build)

```
docs/
├── README.md  00…14 (plan)  adr/  status/ (dated progress notes written by the executing agent)
```
