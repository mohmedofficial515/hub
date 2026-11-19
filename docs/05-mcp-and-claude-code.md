# 05 — MCP and Claude Code integration

How every teammate's Claude Code talks to Hub, as built. Read after `15-first-release.md`, which holds the owner's scope.
**§9 is the one-step connect (docs/16 §5), which replaces §1's "once" and "folder" lines and §3.2's token handling for a device connected that way.** §3 stays as the fallback.
Facts about Claude Code below were checked against `code.claude.com/docs` on 2026-11-05 and, where marked **tested**, against
Claude Code 2.1.202 on the owner's Windows machine. §8 records those runs.

D06 stands: Hub makes **no model calls**. Everything AI-written is produced by a member's own Claude Code, through the tools
here, and written back. D27 stands too: whatever a member may do on the web, their Claude Code may do with their token,
including decide, verify, approve, reject and delete. Permissions depend on role only. The actor kind is recorded, never used
to refuse.

## 1. The loop

```
once      hub-team-pack init --token hub_…   → token in user scope, plugin, MCP server, doctor
folder    hub-team-pack link goteav          → this folder's chats are on that project
daily     /hub:start   → what's new, what awaits me, sessions without a summary
          /hub:next    → claim a ready task, read what it links to, start
          (work)       → search_docs before guessing · request_decision when a rule is missing
                         create_need when something external is missing · create_handoff when another role must act
          /hub:plan    → think a topic through, then save a plan · plan_to_tasks
          /hub:done    → log_session (summary, handoffs, follow-ups), then move the task on
always    SessionStart hook injects the context, naming the active project, and the session id
          SessionEnd hook posts Git facts, as a fallback when log_session never happened
```

## 2. The MCP server

### 2.1 Transport

`modules/mcp`, stateless **Streamable HTTP** at `/mcp` on the API port, outside the `/api/v1` prefix, on
`@modelcontextprotocol/sdk` 1.32 (the `/server/mcp.js` and `/server/streamableHttp.js` entry points). One `McpServer` and one
`StreamableHTTPServerTransport` per POST, with no session id and plain JSON answers (`enableJsonResponse`), so restarting the
API drops nothing. GET and DELETE answer `405`. Request bodies may reach 1 MB, because a plan's body may be 100 000 characters.

### 2.2 Authentication

`ActorGuard` resolves the bearer token as on any route. Then `McpController` admits only `kind: agent`: a session cookie or a
hook token answers `403 hub.identity.token_scope`, and no credentials answers `401` with `WWW-Authenticate: Bearer
error="invalid_token"`. `RateLimitGuard` applies the agent limit, 120 a minute per token. There is no Host check to guard
against DNS rebinding, because a browser page has no token and cookies are refused here.

Tokens belong to the member, not to a project (15 §5):

1. The tool's `project` argument (slug), which every tool accepts.
2. The `X-Hub-Project` header, which `hub-team-pack link` writes into a folder's `.mcp.json`.
3. The member's default project, which `switch_project` sets.

A project the member is not in answers `hub.workspaces.not_found`. Roles are read live on every call. The TOTP rule applies, as
on REST: an owner, pm or accountant must have enrolled, or tools answer `hub.identity.totp_setup_required`.

### 2.3 Conventions of every tool

| Rule | Detail |
| --- | --- |
| Output | Markdown: a headline stating what changed, the status, the project, the event, then the card's URL. Cards appear as `KEY — title`. At most 12 000 characters, or 60 000 for `get_card`, `get_plan` and `get_doc`. |
| Language | English. The agent speaks to the user in the user's language. |
| Errors | `isError: true`, text `ERROR <code>: <message>`, details, and a `Hint:` line. Codes are the API catalogue, the same as REST. |
| Same path as the web | Card tools call `CardService.apply` with the action the REST route uses. Others call the owning service, after the route-level role check (`ToolContext.allowed`) that `ActorGuard` does for REST. |
| Secrets | The secret filter runs over every input before anything else, naming the pattern and never the value. No tool takes a secret: `add_source` and `update_source` refuse a `secret` field, there is no token tool, and `invite_member` keeps the link out of the answer (15 §2). |
| Sensitive tools | `destructive: true` in the table sets `destructiveHint` and adds "confirm with the user in the chat before calling this" to the description. Hub does not enforce the confirmation. The event records `via: mcp` and the agent actor. |
| Idempotency | A tool that creates cards runs in `IdempotencyService.run`, keyed by `_meta["claudecode/toolUseId"]`, which Claude Code sends (**tested**). JSON-RPC ids are not used: they restart with each client and could replay another chat's call. With no id the call simply runs. `log_session` is idempotent per `sessionId`. |
| Actor | `created_by_kind = agent`, `created_by_id = member`, `via = mcp`, and an audit row. |

### 2.4 Tools

The table is `packages/contracts/src/mcp/tools.ts`: one row per tool with its Zod input, the permission actions it performs, the
REST routes it stands for, and its hints. Inputs reuse the REST schemas, with `detail` flattened for a model.

Two tests hold it to the code. `packages/contracts/src/permissions.spec.ts` requires a tool for every mutating action with
surface `any`, and no tool for a `web_only` one. `apps/api/test/arch/mcp-parity.spec.ts` walks the compiled controllers and
requires every mutating route to be in a tool's `routes`, or in `MCP_EXCLUDED_ROUTES` with its reason, unless it is public or
`@SessionOnly()`. A missing handler is a compile error.

| Group | Tools |
| --- | --- |
| Orientation | `get_project_brief`, `whats_new`, `search_docs`, `get_doc`, `get_card`, `list_cards`, `list_deleted` |
| Tasks | `list_tasks`, `create_task`, `update_task` (every field, and `move`), `claim_task`, `unclaim_task`, `start_task`, `submit_task`, `complete_task`, `reopen_task`, `cancel_task` |
| Decisions | `list_decisions`, `request_decision`, `get_decision`, `update_decision`, `decide`, `withdraw_decision`, `supersede_decision`, `draft_adr`, `open_adr_pr` |
| Needs | `list_needs`, `create_need`, `start_need`, `deliver_need`, `verify_need` (D24), `reject_need_delivery`, `cancel_need` |
| Handoffs | `list_handoffs`, `create_handoff`, `acknowledge_handoff`, `apply_handoff` (D25), `dismiss_handoff` |
| Redesign | `list_redesigns`, `send_redesign_to_review`, `approve_redesign`, `reject_redesign`, `request_redesign_changes`, `mark_redesign_ported`, `rescan_lab` |
| Releases | `list_releases`, `create_release`, `update_release`, `release` |
| Ideas and plans | `list_ideas`, `create_idea`, `update_idea`, `idea_to_plan`, `list_plans`, `get_plan`, `create_plan`, `update_plan`, `plan_to_tasks` |
| Any card | `update_card`, `move_card`, `comment`, `redact_comment`, `link_cards`, `watch_card`, `delete_card`, `restore_card` |
| Sessions, briefs | `log_session`, `list_my_sessions_without_summary`, `save_brief` |
| Projects | `list_projects`, `get_project`, `create_project`, `update_project`, `switch_project` |
| Devices | `list_devices`, `check_device`, `fix_device`, `revoke_device`. No pairing tool and no Link tool (§9) |
| Administration | `list_members`, `invite_member`, `list_invites`, `resend_invite`, `revoke_invite`, `change_member_roles`, `disable_member`, `enable_member`, `set_github_identity`, `get_settings`, `update_settings`, `list_sources`, `add_source`, `update_source`, `enable_source`, `disable_source`, `delete_source`, `test_source`, `run_source`, `reindex_docs`, `read_audit`, `list_notifications`, `read_notification`, `get_onboarding`, `tick_onboarding_item` |

`open_adr_pr` answers `hub.common.unavailable` until a GitHub connection exists (H3-06, deferred by 15 §3). It is there so that
the answer is honest rather than "no such tool".

**Structured results (`docs/16` §7.2).** `report_work` and `propose_doc` take no field for what only the server can know: `verified`, a check's real runs, and duplicates are the server's. They read which panel turn a call belongs to from `_meta["claudecode/toolUseId"]`, so a call outside a panel chat is `outside_panel`, its checks stay claimed, and a task never moves. `report_work` replaces the Markdown comment as `/hub:work`'s evidence. `propose_plan` and `propose_doc` write only a turn's event and a draft, so they are on the read list in Ask and Plan. `save_doc` takes `draft`, and refuses while a flag has no answer. In a panel chat only the owner answers a flag.

### 2.5 Resources

| URI | Returns |
| --- | --- |
| `hub://brief/today` | the member's brief, the same text as the Today page, narrative first |
| `hub://card/{key}` | the card's sheet with its comments |
| `hub://decisions/open` | open decisions, by deadline |
| `hub://handoffs/pending` | handoffs pending for the member's roles |

### 2.6 Prompts and skills

Prompts are in `packages/contracts/src/mcp/prompts.ts`, and every text keeps the no-secrets rule, which a test enforces. Claude Code in
VS Code and in the Hub panel offers no MCP prompt as a command (an interactive terminal may), so the commands a member types are
skills (see below).

| Prompt | Args | What |
| --- | --- | --- |
| `start` | | says which project is active, what is new, what awaits me, what to do next |
| `next` | `key?` | picks or takes a task, reads what it links to, claims it |
| `done` | | writes the session summary with `log_session` |
| `decision` | | drafts options with me and opens a decision |
| `need` | | records something needed from outside the code |
| `adr` | `key` | writes the ADR of a decided decision. This release saves it on the card and opens no PR |
| `weekly` | | writes the week's summary |
| `release-notes` | `key` | writes notes for each audience |

**`ask` and `plan` are skills, not prompts (D26).** Claude Code splits MCP prompt arguments on whitespace, so a prompt could
receive only the first word of a question. The team pack ships them with the whole text in `$ARGUMENTS`:
`plugin/skills/ask/SKILL.md` is `/hub:ask <question>`, and `plugin/skills/plan/SKILL.md` is `/hub:plan <topic>`, which reads the
project through Hub, drafts, asks the user, and then saves the plan (15 §4).

**`start`, `next` and `done` are also skills (2026-11-16).** As prompts they never ran where members work. Claude Code as the VS
Code extension, and as the bridge runs it for the Hub panel (`-p`), lists no MCP prompt as a command. It also reads the first
message before the `hub` server has connected. Every use answered "no command with that name is available in this session"
(2026-11-05 in VS Code, 2026-11-10 and 2026-11-16 in the panel). `plugin/skills/{start,next,done}/SKILL.md` carry the same steps,
and `/hub:next <key>` takes the key from `$ARGUMENTS`. A skill is read from the plugin on the device, so it runs before `hub`
connects, and it calls Hub's tools once they are there. The prompts above stay for other MCP clients. In an interactive terminal
the same command may appear twice, as the skill and as the prompt, and both do the same. `packages/contracts/src/mcp/prompts.spec.ts`
keeps each skill naming the same Hub tools as its prompt, so the two texts cannot drift. All three are in `HUB_CORE_SKILLS`, so no
owner skill can take their names, and in `HUB_SKILLS`, the panel's slash menu.

## 3. The team pack

### 3.1 Layout: `packages/team-pack`

```
.claude-plugin/marketplace.json      the package is its own local marketplace, so npx and a checkout work the same
bin/hub.mjs                          hub-team-pack init | doctor | link <slug> | uninstall
bin/validate-plugin.mjs              claude plugin validate --strict, when the CLI is there
lib/commands.mjs                     the commands, with everything from outside arriving as one `system` object
plugin/.claude-plugin/plugin.json    name: hub
plugin/skills/{ask,plan,guide,work,doc,idea,suggest,start,next,done}/SKILL.md
plugin/hooks/hooks.json              session-start, mark-summary, session-end, session-end-send, lib
plugin/CLAUDE.md.snippet
```

**Names.** The plugin is `hub`, so skills are `/hub:ask` and `/hub:plan`. It bundles no MCP server, because a plugin's server
would be `plugin:hub:hub` with tools `mcp__plugin_hub_hub__*`, and a per-folder header could not reach it. The server is
registered separately as `hub`, so tools are `mcp__hub__*` and the hook matcher `mcp__hub__log_session` holds.

### 3.2 Where the token lives

No token is ever in a file meant for Git.

- `~/.hub/config.json` (`{ url, token, packVersion }`, mode 600) for the hooks.
- The user environment variable `HUB_MCP_BEARER` for Claude Code: `setx` on Windows, a marked block in shell profiles on Unix.
- `~/.claude.json` (the user-scope server) and each folder's `.mcp.json` hold only `Bearer ${HUB_MCP_BEARER}`. Claude Code expands
  it when connecting, in `url` and `headers` (**tested** for both scopes; the token is not in `.claude.json`).

The name has no `TOKEN` in it on purpose. The docs read some credential-looking names as empty for remote servers, and strip names
containing `TOKEN` from helper processes. `HUB_TOKEN` did expand in the 2.1.202 test, but the neutral name cannot be caught by a
later version. `setx` reaches new processes only, so `init` tells the member to open a new terminal.

A folder's `.mcp.json`:

```json
{
  "mcpServers": {
    "hub": {
      "type": "http",
      "url": "http://localhost:7310/mcp",
      "headers": { "Authorization": "Bearer ${HUB_MCP_BEARER}", "X-Hub-Project": "goteav" }
    }
  }
}
```

A project-scope server asks for approval once in an interactive session. `claude -p` loads it without asking.

### 3.3 Installer

```bash
node packages/team-pack/bin/hub.mjs init [--url http://localhost:7310] --token hub_…   # or HUB_PACK_TOKEN
node packages/team-pack/bin/hub.mjs doctor [--flush]
node packages/team-pack/bin/hub.mjs link goteav     # in the project's folder
node packages/team-pack/bin/hub.mjs uninstall
```

The package is private and unpublished, so `npx @hub/team-pack` works once it is published or linked, and these are the same
commands. `init` checks the token against `GET /me/context` before it writes anything, saves the config, sets the variable, runs
`claude plugin marketplace add`, `claude plugin install hub@hub --scope user` and `claude mcp add --transport http --scope user hub
… --header "Authorization: Bearer ${HUB_MCP_BEARER}"`. `link` checks membership, merges into `.mcp.json` keeping other servers, and
refuses to keep a file that holds the token. `doctor` makes no model call: config, Hub reachable, token, the MCP endpoint, the
variable in this terminal, Claude Code, plugin, registered server, outbox. `uninstall` removes all of it, and linked folders keep
their `.mcp.json`.

CA trust, hosts entries and the HTTPS marketplace (the earlier plan) return with LAN hosting: this release is `http://localhost`
(D33).

### 3.4 Hooks

`hooks/lib.mjs`: no dependencies. Token from `~/.hub/config.json`, else the env var. Project from the nearest `.mcp.json`, so hooks
and tools agree. A hook never breaks a session: anything wrong is one line on stderr and exit 0.

**`session-start.mjs`** writes `~/.hub/sessions/<id>.json` (`startedAt`, `cwd`, `branch`, `headSha`, `remote`; a resume keeps the
original), retries any outbox file with a detached sender, and calls `GET /api/v1/me/context?cwd=…` with a 2.5 s limit. It prints
`hookSpecificOutput.additionalContext`: the context, naming the active project, plus `Hub session id: <id>`, cut to 9 500 characters.
If Hub cannot be reached, the context says so and names `doctor`.

**`mark-summary.mjs`** (PostToolUse on `mcp__hub__log_session`) notes that a summary was written.

**`session-end.mjs`** collects Git facts (commits since the start, shortstat, dirty files), writes `~/.hub/outbox/<id>.json`, and
spawns the detached `session-end-send.mjs`. SessionEnd hooks have 1.5 seconds, and a plugin's own `timeout` does not raise that
budget, so the parent never touches the network. The sender retries three times. A 4xx other than 429 is final: the file goes, and
a line goes to stderr. Otherwise it stays for the next session or `doctor --flush`.

### 3.5 `GET /me/context` and `POST /capture/session`

`modules/capture`. Both take an API token of kind `hook` or `mcp`, and refuse a cookie. The project comes from `X-Hub-Project`, then
the project whose `repoPaths` hold `cwd` (case and slash direction do not count), then the member's default.

`GET /me/context?cwd=` answers `{ project, text }`: member, roles, **active project**, what awaits them, ready tasks, sessions without
a summary, latest changes, at most 8 500 characters. `POST /capture/session` takes `hookSessionPayloadSchema`
(`@hub/contracts/capture`) and answers `202 { sessionLogId, cardKey, project }`.

## 4. Tokens

Created in **Settings › Tokens**, web only (D27 limits), of kind `mcp` or `hook`, shown once as `hub_<prefix8>_<secret>`, stored as
`prefix` and `sha256`. One token serves every project the member is in. A hook token reaches only `/capture/*`, `/me` and
`/me/context`. Revocation takes effect at once.

## 5. Session reconciliation

`SessionLog` is unique per project and session id. One card has `externalKey = session:<id>`.

| Event | What Hub does |
| --- | --- |
| `log_session` first | creates the `change` card (`kind: session`) and writes the summary; handoffs and follow-up tasks in the same transaction |
| hook first | records the facts and schedules `session.reconcile` after `capture.session.hook_grace_minutes` (10), on its own queue |
| job runs, summary came meanwhile | nothing |
| job runs early: a newer hook | nothing; that hook has its own job |
| job runs, no Git facts at all | marks it idle: no card, as reading-only sessions do not clutter the timeline |
| job runs, still no summary | a facts-only card by the system actor, `session.noSummary = true`, a notification to the member; it shows in `list_my_sessions_without_summary` and the next context |
| `log_session` after that | **upgrades** the same card: `noSummary = false`, event `session_logged { hasSummary: true, upgraded: true }` |
| hook after the summary | merges the facts into the card, event `field_changed { field: 'facts' }`; the same facts again do nothing |
| `log_session` repeated | updates the card; a handoff or follow-up already created, matched by title, is not created again |

`change.create` is a `system` row held by nobody. A session's card is the exception: its action asks for `session.log`, held by every
member. Keys named in the summary text are linked `relates` when they exist; keys in `cardKeys` must exist. A secret in a summary or a
commit message refuses the whole call with `422 hub.security.secret_detected`, and nothing is stored.

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

| Layer | What | Where |
| --- | --- | --- |
| Parity | every web mutation has a tool, every route a tool names exists, every tool has a handler and `project`, sensitive tools say to confirm, no secret input, no token tool, prompts keep the rule | `apps/api/test/arch/mcp-parity.spec.ts`, `packages/contracts/src/permissions.spec.ts` |
| Live proof | a real SDK HTTP client over a real token: create, edit, decide, delete, restore, plan to tasks, create project, each reaching a real SSE listener within 1 s; project choice; refusals; idempotency | `apps/api/test/e2e/mcp.e2e-spec.ts` |
| Reconciliation | hook first, summary first, hook only, idle, repeats, secrets, HTTP routes | `apps/api/test/e2e/sessions.e2e-spec.ts`, `modules/capture/domain/session.spec.ts` |
| Installer | temp home, recorded `claude`, fake Hub: the token never in output or `.mcp.json` | `packages/team-pack/test/commands.spec.mjs` |
| Hooks | the real scripts with fixture stdin and a mock Hub: output JSON, payload shape, outbox, exit 0 on failure, parent under 1.5 s | `packages/team-pack/test/hooks.spec.mjs` |
| Plugin | `claude plugin validate --strict` on the plugin and the marketplace | `pnpm --filter @hub/team-pack plugin:validate`, CI job `plugin` |

## 8. Real Claude Code run (2026-11-05)

Claude Code 2.1.202 on the owner's Windows machine, in ordinary use of the owner's own account, against a local API on port 7311 with
a throwaway database and a temporary token. Tokens are masked here.

```bash
# The installer, for real, with an isolated CLAUDE_CONFIG_DIR and HOME and setx skipped: no model call.
init --url http://localhost:7311 --token <token>      # plugin installed, `hub` server added
doctor                                                 # every check green
claude mcp list                                        # hub: http://localhost:7311/mcp (HTTP) - ✔ Connected
# token literally in .claude.json: false. uninstall leaves no server and no plugin.

# A chat, in a folder with the .mcp.json of §3.2 (X-Hub-Project: hub).
HUB_MCP_BEARER=<token> claude -p "<prompt>" --plugin-dir packages/team-pack/plugin \
  --mcp-config .mcp.json --strict-mcp-config --allowedTools "mcp__hub__*" \
  --max-turns 6 --output-format stream-json --verbose --include-hook-events
```

| Prompt | Result |
| --- | --- |
| "Use hub to create a P1 task titled 'Fix the login page' with specialty frontend…" | `SessionStart` hook injected the context naming project Hub; 99 tools; `hub:ask`, `hub:plan` listed; `create_task` → `HUB-1`, P1, backlog, the project from the header; Claude named the active project in its reply |
| "I confirm: delete HUB-1 in hub, then restore it. Then create a plan… turn its steps into tasks. Then create a project called Test…" | `delete_card`, `restore_card`, `create_plan` → `HUB-2`, `plan_to_tasks` → `HUB-3`, `HUB-4`, `create_project` → `test-demo`. The run ended on `--max-turns` after its last tool call, which is that flag's limit |
| "/hub:plan a small notes page. Do not ask me anything…" | the skill ran: `get_project_brief`, `list_plans`, then `create_plan` → `HUB-5` |

The database shows `created_via = mcp`, `created_by_kind = agent`. `session_logs` has a row per run with `hook_received_at` set, so
SessionEnd reached the API. Redis has `idem:*` keys per create, so Claude Code does send a tool use id. Both `HUB_TOKEN` and
`HUB_MCP_BEARER` connected in a first run with both servers.

**Not run, for the owner, on an interactive chat in a real folder:**

1. In a new terminal after `init`, `doctor` is all green. (The test set the variable in the process, not with `setx`.)
2. `link goteav` in `F:/Goteav/backend`. Open `claude` there: it asks to approve `hub` once.
3. The first reply says the active project. `/hub:start` appears in the slash list, from the team pack's skill (§2.6).
4. With Hub open on Tasks, say "create a P1 task": it appears within a second. "Delete it": it goes. Restore it from the page.
5. `/hub:plan <topic>`, answer its questions, then "turn the steps into tasks": the board updates.
6. "Create a project called Test": it appears in the switcher.
7. Claude asks you to confirm before `decide` or `delete_card`. Hub does not enforce this: it is the description telling Claude.
8. End the chat: the session appears on the Timeline after 10 minutes, or at once if `/hub:done` ran.

## 9. One-step connect (docs/16 §5, D42)

### 9.1 What a device holds

`packages/bridge`, plain Node 22 with no dependencies, so Hub can serve it. Everything is under `~/.hub`.

| File | Holds | Read by |
| --- | --- | --- |
| `device.json` | the device credential (`api_tokens.kind = device`) | the `headersHelper`, the bridge |
| `config.json` | the hook token (`kind = hook`), `device: true` | the plugin's hooks |
| `links.json` | the folders linked here, no secret | `uninstall` |
| `app/bridge`, `app/team-pack` | the bridge, and the plugin's marketplace | Claude Code, the login start |

Both tokens have `device_id`, stay out of Settings › Tokens, and are revoked with the device. **The device credential reaches only `/mcp`, the socket and `DELETE /bridge/self`** (`deviceTokenMayCall`). The hook token keeps its existing reach. Neither is printed, logged, or passed in an argument. Hub never sees a Claude credential: sign-in is asked of `claude auth status`, and only `loggedIn` is read.

### 9.2 The MCP server

**User scope, with `headersHelper`:** `{ "type": "http", "url": "<api>/mcp", "headersHelper": "\"<abs node>\" \"<abs>/hub-mcp-headers.mjs\"" }`. There is no variable and so no new terminal. The helper reads `device.json` and always prints clean JSON (S1 Q9).

**A linked folder: local scope, through the CLI**, adding `"headers": { "X-Hub-Project": "<slug>" }`. Local scope lives in the user's own `~/.claude.json`, so nothing is written to the repository, a machine's absolute paths stay on that machine, and Claude Code's precedence (local over project over user) makes it win over an older `.mcp.json`. **Tested on 2.1.318:** at local scope the helper runs only once the folder is trusted, so D44 is what makes this work.

**Spellings (tested on 2.1.318):** `projects` keys are case-sensitive. A trusted `C:/x` does not hold for a process whose working directory is `c:\x`, and VS Code and a terminal can differ in the drive letter. So the button writes the server and the trust for each spelling of the one folder (`folderKeys`). That stays within D44's "only that folder".

### 9.3 Pairing

```
device: POST /pairing/start {name, platform}  → deviceCode (secret), userCode, approveUrl
owner:  opens <web>/connect?code=ABCD-EFGH, compares the code, POST /pairing/:code/approve   (session only)
device: POST /pairing/poll {deviceCode} every 3 s → pending | denied | expired | claimed + credentials, once
```

A code lasts ten minutes. Only the hash of `deviceCode` is stored. Credentials are minted at the claim and are never stored raw. `pnpm start:local` uses `PairingService.pairDirect` through `apps/api/scripts/pair-main-machine.ts`, because whoever runs it already holds the database. Those credentials go from that child's stdout to the bridge's stdin.

### 9.4 The socket

`/bridge` on the API port (`BridgeGateway`, `BridgeHub`). A bridge sends `Authorization: Bearer <device credential>`. An `Origin` header is refused, because a browser page always has one. A bad credential completes the handshake and closes `4401`, so the bridge knows to stop rather than retry. `4409` means another bridge took over for this device. The credential is rechecked once a minute, and revoking closes the socket at once.

Frames, all JSON, validated by `bridgeFrameSchema`:

| From | Frame |
| --- | --- |
| Bridge | `hello { protocol, status, actions }`, `heartbeat { status }` every 25 s |
| Hub | `welcome { deviceId, folders }`, `allowlist { folders }` before every action |
| Hub | `action { id, action, args }`, only from `BRIDGE_ACTIONS` |
| Bridge | `event { id, seq, kind, data }`, any number, then one `result { id, ok, data \| error }` |

The bridge refuses a `folder` not at or under a `repoPaths` entry of a project its member belongs to, after resolving links. There is no action that takes a command.

### 9.5 The Link button

`POST /workspaces/:ws/devices/:id/link { folder }`, session only, **because D44 allows the trust write only on the owner's press, so no agent may do it**. It registers the folder in `repoPaths`, then asks the bridge on that device (`folder.link`), which:

1. Checks the shape of `~/.claude.json`. If it is unexpected, it changes nothing and answers `shape_unexpected`, and the page says to accept the dialog once. The folder stays registered, as that much is Hub's own data.
2. Takes a backup, keeping its own newest five.
3. Adds the local-scope `hub` through `claude mcp add-json`.
4. Writes `hasTrustDialogAccepted: true` for this folder's keys only: temp file, compare the original to catch a concurrent writer, then rename. Every other key stays.

If the folder does not exist on the device, the registration is undone. A second press changes nothing.

### 9.6 Health

`hub doctor` as data: `claude_found`, `claude_version` (S1 C3: at least 2.1.318), `claude_path_version` (a warning, with its update command), `claude_signed_in`, `mcp_server`, `plugin`, `login_start`, `vscode`. A Fix button appears for `mcp_server`, `plugin` and `login_start`, a closed list. Updating Claude Code is only ever shown as a command. `doctor`, `link` and `init` stay as the fallback; on a device connected this way `link` and `uninstall` point to the button and the command.

### 9.7 Starting at login

Windows: a scheduled task whose trigger and principal are this one user, which is what a standard user may create, as XML through `schtasks /Create /XML`. If that is refused, the per-user `Run` key. `conhost --headless` keeps a window from appearing. macOS: a LaunchAgent. Linux: `systemd --user`.

### 9.8 Testing without touching anything real

`apps/web/e2e/specs/connect.spec.ts` (`E2E_PACK=1`) runs the real binary in a temp `HOME`, `USERPROFILE` and `CLAUDE_CONFIG_DIR`. That home has no sign-in, so `ANTHROPIC_BASE_URL` points the binary at `e2e/support/fake-model.ts`, which answers with a scripted `tool_use`. The MCP connection, the helper and the `tools/call` are the real binary's own, and **no model call happens**. `HUB_BRIDGE_SKIP_LOGIN_START=1` and `HUB_BRIDGE_NO_BROWSER=1` cover the two things a home cannot isolate.
