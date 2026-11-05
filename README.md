# Hub

An internal project operations room for small teams that build software with AI agents. A shared, append-only timeline
of cards, written mostly by machines and read by people and by every teammate's Claude Code through MCP. Hub itself makes
no model calls.

The plan and product documentation are in [`docs/`](docs/README.md). The scope of this release is
[`docs/15-first-release.md`](docs/15-first-release.md), which wins over the other documents.

## Local run

Needs Node 22, pnpm 10 and Docker.

```bash
pnpm install
pnpm setup:env          # writes .env with random secrets; prints the owner password once
pnpm compose:up         # Postgres 7340, Redis 7341, Mailpit 7342/7343 (project name `hub`)
pnpm db:deploy
pnpm dev                # api on 7310, web on 7300
```

`curl http://localhost:7310/api/v1/health/ready` answers 200 when everything is up.

## Layout

| Path                 | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `apps/api`           | NestJS: REST, MCP and workers. [How to extend it](apps/api/README.md). |
| `apps/web`           | Next.js 15                                                             |
| `packages/contracts` | Status machines, permission table, errors, secret patterns, tool table |
| `packages/team-pack` | Claude Code plugin and `hub` CLI                                       |
| `infra`              | Compose files and host scripts                                         |

## Checks

`pnpm check` is the gate: lint, typecheck, architecture rules, unit tests, OpenAPI snapshot. `pnpm test:e2e` runs against
real Postgres and Redis through Testcontainers.
