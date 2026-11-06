# Hub

An internal project operations room for small teams that build software with AI agents. A shared, append-only timeline
of cards, written mostly by machines and read by people and by every teammate's Claude Code through MCP. Hub itself makes
no model calls.

The plan and product documentation are in [`docs/`](docs/README.md). The scope of this release is
[`docs/15-first-release.md`](docs/15-first-release.md), which wins over the other documents.

The workbench release is [`docs/16-workbench.md`](docs/16-workbench.md). On every project page, a side panel holds a Claude Code chat that runs the official binary on your own device through the bridge, and any card or chat can go to VS Code with its prompt written in and unsent.

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

**5. Claude Code is already connected.** On its first run, `pnpm start:local` pairs this machine and installs the bridge, the `hub` MCP server at user scope and the plugin. It says what it changed, with no token to copy and no new terminal. `HUB_SKIP_CONNECT=1` leaves your Claude Code alone. Settings › Devices shows this machine, with health checks and a Fix button.

**6. Link a folder.** Settings › General › Link a folder, for each project folder. A chat there lands on that project, with no dialog. This press, and only this press, writes that folder's trust to `~/.claude.json` and keeps a backup (D44).

**Another device.** Settings › Devices shows one command for any terminal. It opens your browser, you approve, and it sets up the rest. It needs Node 22 and Hub's address, and it is safe to run again. The same page has the command that removes everything.

**The older way still works**, for a machine that will not run the bridge: an `mcp` token with `node packages/team-pack/bin/hub.mjs init`, `doctor` and `link`. See [`packages/team-pack/README.md`](packages/team-pack/README.md).

### While developing

`pnpm dev` runs everything with reloads, once `pnpm compose:up` and `pnpm db:deploy` have run. `curl http://localhost:7310/api/v1/health/ready` answers 200 when everything is up.

## Layout

| Path                 | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `apps/api`           | NestJS: REST, MCP and workers. [How to extend it](apps/api/README.md). |
| `apps/web`           | Next.js 15                                                             |
| `packages/contracts` | Status machines, permission table, errors, secret patterns, tool table |
| `packages/team-pack` | Claude Code plugin and `hub` CLI                                       |
| `packages/bridge`    | `hub-bridge`: connects a device out to Hub. No dependencies            |
| `infra`              | Compose files and host scripts                                         |

## Checks

`pnpm check` is the gate: lint, typecheck, architecture rules, unit tests, OpenAPI snapshot. `pnpm test:e2e` runs against
real Postgres and Redis through Testcontainers. `pnpm test:e2e:web` runs the browser flows and the live-update test on their own
containers, and never touches the local database.
