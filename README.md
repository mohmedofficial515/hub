# Hub

An internal project operations room for small teams that build software with AI agents. A shared, append-only timeline
of cards, written mostly by machines and read by people and by every teammate's Claude Code through MCP. Hub itself makes
no model calls.

The plan and product documentation are in [`docs/`](docs/README.md). The scope of this release is
[`docs/15-first-release.md`](docs/15-first-release.md), which wins over the other documents.

## Quick start

Needs Node 22, pnpm 10 and Docker running. Hub runs on this machine over plain `http://localhost` (web 7300, API 7310).

**1. First time only.**

```bash
pnpm install
pnpm setup:env                 # writes .env with random secrets, and HUB_OWNER_PASSWORD
```

Set `HUB_OWNER_EMAIL` in `.env`. It is the address you sign in with, and `.env` is never committed.

**2. Start.** One command: services, migrations, the owner and the projects `goteav` and `hub`, a build of what changed, then the API with its workers and the web.

```bash
pnpm start:local               # stays in this terminal. Ctrl+C stops the API and the web
```

`pnpm stop:local` stops a run whose terminal is gone. The containers stay up; `pnpm compose:down` stops them. Logs are in `.tmp/logs`.

**3. Fill Goteav, once.** The folders of `docs/15` §3 and Goteav's history. Both are safe to run again, and only read those folders.

```bash
pnpm seed:sources
pnpm import:goteav --workspace goteav --root F:/Goteav
```

**4. Sign in** at <http://localhost:7300> with `HUB_OWNER_EMAIL` and `HUB_OWNER_PASSWORD` from `.env`. Two-step sign-in is optional (D34).

**5. Get a token.** Your avatar › Access tokens › New token, kind `mcp`. It is shown once.

**6. Connect Claude Code.** Once per machine, from this repository:

```bash
node packages/team-pack/bin/hub.mjs init --url http://localhost:7310 --token hub_...
```

Then open a **new terminal**, because the token is kept in the user variable `HUB_MCP_BEARER`, and in any folder you work in:

```bash
node packages/team-pack/bin/hub.mjs doctor                      # every check green, with no model call
cd F:/Goteav/backend
node F:/Goteav/hub/packages/team-pack/bin/hub.mjs link goteav   # writes .mcp.json, which holds no token
claude                                                          # approve `hub` once, then: "create a P1 task for ..."
```

The change is on the open page within a second. More in [`packages/team-pack/README.md`](packages/team-pack/README.md).

### While developing

`pnpm dev` runs everything with reloads, once `pnpm compose:up` and `pnpm db:deploy` have run. `curl http://localhost:7310/api/v1/health/ready` answers 200 when everything is up.

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
real Postgres and Redis through Testcontainers. `pnpm test:e2e:web` runs the browser flows and the live-update test on their own
containers, and never touches the local database.
