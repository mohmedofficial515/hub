# 16 — Workbench release (owner's scope, 2026-11-06)

Status: **approved by the owner on 2026-11-06.** This document wins over the others where they differ, as `15-first-release.md` does. Work continues on branch `feat/first-release`.

## 1. What the owner asked for

Hub becomes the place the owner works from, not only where they record work:

1. Connecting Claude Code takes one step.
2. The redesign lab is a core module inside Hub, with the same interface and features.
3. A resizable, closable side panel holds a Claude Code chat for tasks, explanations, planning, redesign and execution.
4. Tasks go straight to the Claude Code extension in VS Code, and chats open there easily.
5. Tasks can run now or across the week in an orderly way, with smart suggestions, and skills and projects can be added.
6. Docs are usable on any device, without loss or rewriting, while the knowledge stays on one device.

**The owner is one person** working through several devices and role personas. There is no real team. This release does not add multi-user machinery.

## 2. Owner decisions

| # | Decision |
|---|---|
| D36 | **Solo owner.** Members and roles are the owner's personas. Design for one person on several devices. |
| D37 | **One source of knowledge.** Hub on the main machine holds the knowledge. Other devices connect to it and keep no copies. |
| D38 | **Chat engine:** the official Claude Code on the owner's own device, on the owner's own subscription sign-in. Hub never reads, stores or relays Claude credentials. D06 stands: the Hub server makes no model calls. |
| D39 | **The lab moves into Hub** as `apps/lab`, and appears inside Hub's shell, merged with the Redesign page. |
| D40 | **Agent queue with schedules** on the main machine, with limits. A missed run starts when the machine is back. |
| D41 | **Default agent permission:** read and edit inside the project folder freely. Pause for approval on delete, commit, push, deploy, creating a branch or worktree, and `docker`. **Owner's choice on C1:** the owner's 259 global allow rules stay loaded, so a command they allow and this list does not name runs without asking; any other unknown command pauses. |
| D44 | **Folder trust (owner's choice on C2):** when the owner presses Link on a folder, Hub writes that folder's trust acceptance into `~/.claude.json`, so no trust dialog appears. Only on that explicit press, only for that folder, atomically, keeping every other key, with a backup. If the file's shape is not as expected, Hub changes nothing and says to accept the dialog once. This file is internal to Claude Code and can change with updates. |
| D45 | **VS Code handoff confirmed by the owner:** the spike's folder window opened with the prompt pre-filled and not sent. |
| D46 | **`repoPaths` stays editable through MCP, with approval (owner's choice).** A change to `repoPaths` widens the bridge's folder allowlist, so `update_project` must pause for the owner's approval in bridge runs: its permission rules must put that tool on the `ask` list. Slice 3 must test this. |
| D47 | **Uninstall keeps folder trust (owner's choice).** Removing Hub from a device removes the `hub` servers and the bridge, and leaves folders trusted, as if the owner had accepted the dialog. |
| D48 | **Panel design:** three clearly different directions as working prototypes in the lab. The owner picks one before the port. |
| D42 | **Connect:** automatic on the main machine, and one command with browser approval on any other. Linking a folder is a button in Hub. No token copying and no new terminal. |
| D43 | **Devices reach Hub through Tailscale.** Hub is never open to the public internet. This amends D33 for those devices. |

## 3. Facts from the Claude Code docs (read 2026-11-06)

These shape the design. Source pages are under `code.claude.com/docs/en/`.

| Fact | Source | Effect |
|---|---|---|
| An end user may sign in to the unmodified binary with their own subscription. Third-party products must not offer Claude login or route plan credentials on behalf of their users. | `legal-and-compliance` | The docs do not name a personal local tool. Solo use with the owner's own sign-in fits D38. Any real team use must be rechecked first. |
| The Agent SDK's documented auth is an API key. The docs do not say it uses a `/login` subscription. | `agent-sdk/overview`, `authentication` | Prefer spawning the `claude` binary, unless spike S1 shows otherwise. |
| `claude -p` runs in Manual mode since v2.1.302. A call needing approval is refused unless a hook or `--permission-prompt-tool` approves it. | `headless` | D41 needs a permission tool or hook. |
| `--input-format stream-json` message shape is not documented in the pages read. | `cli-reference` | Use one process per turn with `--resume` unless S1 proves more. |
| `vscode://anthropic.claude-code/open` takes `prompt` and `session`. The prompt is pre-filled, **not sent**. There is no folder parameter: it opens in the focused window. | `vs-code` | The owner presses Enter. The bridge opens the right folder first. |
| Sessions from `-p` and the SDK appear in the VS Code list only with `claudeProcessWrapper`, extension v2.1.304 or later. An unknown `session` starts a fresh chat. | `vs-code`, `sessions` | A handoff carries the card key in the prompt, so it never depends on session sharing. |
| Resuming one session in two windows mixes messages. | `sessions` | One writer per chat. |
| Session files are local and their format is internal, kept 30 days by default. | `sessions` | Do not parse them. Hub stores its own copy of each chat as it streams. |
| Remote MCP headers do not expand credential variables such as `ANTHROPIC_API_KEY`. `headersHelper` runs a command that prints headers. | `mcp` | Replace `setx HUB_MCP_BEARER` with `headersHelper`, which removes the new-terminal step. |
| Plugins carry skills and MCP config. `claude plugin install` works from the CLI. | `plugins/install`, `plugins/components` | Connect installs one plugin. |

## 4. Architecture

```
 Browser, any device ──HTTPS over Tailscale──> Hub web + API (main machine) ──> Postgres, Redis, docs, lab
                                                 ^
                       outbound WebSocket, paired│
                                                 │
                     hub-bridge (each device) ──spawn──> official `claude` binary
                                                 └─────> `code <folder>`, vscode:// link
```

**`hub-bridge`** is a small local service in `packages/bridge`. It connects **out** to Hub, so a browser on any device can drive a chat on any paired device, with no browser-to-localhost calls.

Bridge rules:
- It pairs with Hub through the browser approval in §5, and each device can be revoked in Settings.
- It runs only in folders registered on the project (`repoPaths`). Hub cannot send it an arbitrary command or path: the only actions are start turn, answer approval, stop, open in VS Code, plus the health checks, the closed list of fixes and Link a folder that §5 needs (`BRIDGE_ACTIONS`).
- It starts with the machine through a user-level scheduled task, with no admin rights.
- It never reads `~/.claude/.credentials.json`.

**New data:** `devices`, `chats`, `chat_messages`, `agent_runs`. The secret filter applies to anything stored from a chat. Chats and runs follow D28: recoverable delete.

## 5. Slice 1: one-step connect

- **Main machine:** `pnpm start:local` installs the bridge and plugin, adds the MCP server at user scope and pairs itself. The first run needs nothing else.
- **Another device:** Settings › Devices shows one command. It opens the browser, the owner approves, and it installs the bridge, MCP and plugin.
- **Link a folder:** a button on the project. No `hub link` needed, though the command stays.
- **Project selection:** the current argument, header and default order stays (docs/15 §5).
- `hub doctor` becomes a health panel in Settings › Devices, with a Fix button.

The first-release flow keeps working as a fallback until this ships.

**As built, in docs/05 §9.** Three choices the plan left open, none of which changes a decision:
- A linked folder's `hub` server is at **local scope**, not in `.mcp.json`, so nothing lands in the repository and each device keeps its own paths. D44's trust is what makes its helper run.
- **`~/.claude.json`'s `projects` keys are case-sensitive on Windows** (tested on 2.1.318), so Link writes each spelling of the one folder, drive letter included, or VS Code could miss what a terminal sees.
- Pairing issues **two tokens**: the device credential, limited to MCP and the bridge channel, and a `hook` token for the plugin's hooks, which the credential cannot serve under that limit. Both are revoked with the device.

## 6. Slice 2: lab as a module

1. **Before moving:** confirm no other session is working in `F:/Goteav/redesign`. It is not a Git repository, so back it up first.
2. Move it to `apps/lab`, without `node_modules`. Commit the versions and screenshots to the private repo (about 140 MB). Keep the `@web/*` and `@dash/*` aliases, pointing at the sibling projects by env.
3. **Same interface and features:** gallery, side-by-side compare, device sizes, AR and EN, light and dark, status and notes. The gallery moves into Hub's shell as tabs on the Redesign page. Each version still renders in its own iframe, because the projects' stylesheets collide.
4. `start:local` runs the lab and Hub proxies it at `/lab`, so it needs no separate command.
5. Set `LAB_ROOT` to the new folder. **Existing redesign cards must keep their keys:** prove on a copy of the database that a rescan creates no duplicates.
6. Update `redesign-director`, `redesign-porter` and `redesign-workflow`, which are global files outside the repo, to the new path. Show the owner the diff first.
7. Keep the old folder until the owner has checked the new one. Deleting it is a separate request.

### Slice 2 as built (2026-11-06)

- **Serving.** `pnpm start:local` runs the lab's dev server on 127.0.0.1:7320 (`LAB_PORT`), with its log, and stops it on Ctrl+C. `next.config.ts` rewrites `/lab` to it (`HUB_LAB_ORIGIN`, fixed at build). Rewrites also carry the HMR WebSocket. A Next rewrite turns `?import&raw` into `?import=&raw=`, so the lab puts the bare flags back before Vite reads them.
- **Guards.** `middleware.ts` answers 404 to any `..`, backslash, NUL or dot-folder in the path, however often it was encoded, and 401 or a redirect to sign-in without a session. Vite's `server.fs.allow` lists the lab, the two `src` trees and the packages they load. Nothing else of Hub or the sibling projects is reachable. A version runs on Hub's origin, so it is trusted code, as the owner's own designs are.
- **A broken version.** The lab compiles on demand, so one version failing shows its error in its own frame only. `pnpm lab:check` names broken versions, and `start:local` runs it once in the background. If the lab stops, Hub stays up and Redesign says so.
- **The page.** Redesign has two views: Review (as before) and Gallery (`?view=gallery`). Links that used to leave Hub open the gallery. The lab's own gallery stays at `/lab/` for agents that drive a browser.
- **Scanner.** `LAB_ROOT` defaults to `apps/lab`. `externalKey` was always relative, so only `source.config.path` and the stored `lab_url` held the old place: `pnpm lab:repoint` moves both.
- **Commits.** Approve and reject write the README and commit nothing, so `apps/lab` shows those files in `git status` until the owner commits them.

### Cut-over on the owner's instance

Owner-run, after checking the gallery. The old folder stays until a separate request.

1. Stop Hub: Ctrl+C, or `pnpm stop:local`.
2. Copy edits made in the old folder since the move. `robocopy F:\Goteav\redesign F:\Goteav\hub\apps\lab /E /XO /FFT /XD node_modules dist .vite /XF pnpm-lock.yaml /L` lists files newer in the old folder, and copies nothing. If it names `package.json`, `tsconfig.json`, `vite.config.ts` or `lab\src\`, merge those by hand, because the new copies were changed on purpose. Run it without `/L` to copy, then `git status apps/lab` shows what changed. It does not copy deletions.
3. In `.env`, delete the `LAB_ROOT` and `LAB_URL` lines.
4. `pnpm start:local`, then in a second terminal `pnpm lab:repoint --rescan`. It must print `created 0, updated 0`, unless step 2 changed a README, which then counts as updated.
5. Check: Redesign › Gallery in `ar` and `en`; Settings › System shows the lab as running; `SELECT count(*), count(DISTINCT external_key) FROM cards WHERE type = 'redesign'` gives two equal numbers.
6. Apply the diff to the global files (§6 item 6), and commit `apps/lab` if step 2 changed it.

**To go back:** restore `LAB_ROOT` in `.env` and run `pnpm lab:repoint`. That puts the source back, and scanning from there changes no card.

## 7. Slice 3: chat panel

**Design first.** The panel has no approved design. Build it as a new lab version, `hub/today/v6-workbench` based on `v5-peacock-app`, run `ux-critic`, and get the owner's approval before porting. No coloured side or top edges.

Behaviour to design:
- Docked at the page edge, on every page, pushing the content. Drag to resize, one key to close, width remembered per device. Full screen on a phone.
- It coexists with the card sheet, and the two must not cover each other.
- **Context chips:** it knows the current project, page and open card. "Explain this", "plan this" and "redesign this" work without retyping.
- Streamed replies, tool activity folded by default, created cards shown as Hub cards that update live.
- **Approval prompts inline:** Allow once, Deny, with the exact command shown. They reach any device the owner has open.
- **Slash menu:** the same skills as Claude Code, plus Hub's.
- **Picker for device and folder**, and chat history by project.
- **Persona:** "working as" a role, which sets the focus and whose work is shown.
- Honest states: bridge offline, Claude signed out, usage limit reached, the turn stopped.

Each message spawns or resumes the official binary in the chosen folder. It loads that folder's `CLAUDE.md`, skills and MCP. Only one turn runs per chat.

## 8. Slice 4: send to VS Code

A button on any card and in the panel: **Open in VS Code**.
1. Hub asks the bridge on the owner's current device.
2. The bridge runs `code <folder>`, so the right window has focus.
3. It opens `vscode://anthropic.claude-code/open?prompt=…` with a short prompt carrying the card key. Claude reads the rest through MCP.
4. **The owner presses Enter.** Claude Code does not support auto-send on this link, and Hub says so on the button.

The same button appears on a panel chat to continue the topic there. It starts a new VS Code chat from a Hub summary and the card key, so it does not depend on session sharing. If S1 shows `session=` works reliably, a real resume can replace this.

If the device has no bridge, the button copies the prompt instead.

## 9. Slice 5: agent queue

- **Run now, schedule a time, or repeat weekly** on any task, plan step or chat prompt, with a target folder.
- **Agent queue page** in the Work group: running, waiting for approval, next, recent. Reorder by dragging, with pause and cancel.
- **Limits in Settings:** runs at the same time (default 1), runs per day (default 5), quiet hours, and pause all. Reaching the subscription's usage limit pauses the queue and says so, with no retry loop.
- **One run per folder.** Runs work in the current checkout. Creating a branch or worktree, committing and pushing all need approval (D41), which follows the owner's standing Git rules.
- **Results go on the card:** summary, changed files and the chat link. The task does not complete itself: the owner confirms unless they set otherwise.
- **Missed runs** start when the main machine is back, oldest first. A run that was cut off is marked interrupted and is not restarted automatically.
- A run waiting for approval goes to the inbox and the panel, and it holds the queue's slot for its folder.

## 10. Slice 6: devices and docs

- `tailscale serve` publishes Hub over HTTPS inside the owner's private network. `Secure` cookies turn on from the public URL. Web and API stay bound to localhost otherwise. The owner installs Tailscale on each device; that part cannot be automated.
- **Docs live on the main machine.** Other devices read and search them through pages and MCP, and keep no copy.
- **Writing docs from any device:** a new tool `save_doc` writes through Hub to the file on the main machine, keeps the earlier text as a revision that can be restored, and refuses a save based on an older version. This replaces "docs are read-only" from docs/15 §6 for local-path docs. Git commits stay a separate, owner-approved step.
- **No rewriting:** the plugin's session-start hook gives Claude the project brief and doc index, and a skill rule tells it to search Hub's docs before writing a new one. `save_doc` warns when a similar document exists.
- **Limit:** if the main machine is off, other devices cannot reach the knowledge. This follows from D37. A nightly backup to another drive is included, because one machine is now the only copy.

## 11. Slice 7: suggestions, skills and projects

- **Suggestions, without AI:** Today shows a ranked "do next" from real state: overdue, blocking others, ready and small, plan steps next in line. Each item says why, with "Run now" and "Schedule".
- **Suggestions, with AI:** `/hub:suggest` runs in the owner's Claude through the panel, reads the project through MCP, and proposes tasks, skills or plans. Nothing is created until the owner accepts.
- **Skills page:** lists the skills Hub's plugin installs on every device. Create or edit one through the panel, and each device picks it up on the bridge's next sync. Existing personal skills in `~/.claude` are shown as read-only.
- **Projects:** "New project" in the panel uses the existing `create_project` tool, and links a folder in the same flow.

## 12. Order and gates

| Step | Work | Gate |
|---|---|---|
| S1 | **Spike:** spawn `claude -p` with a permission tool, resume, MCP, stream; SDK on `/login` or not; `vscode://` from the bridge; `session=` | Findings recorded here. Changes to this design go back to the owner. |
| 1 | One-step connect | Owner connects with no token copied |
| 2 | Lab module | No duplicate cards; owner checks gallery parity |
| 3 | Panel design, then port and bridge | **Owner approves the design in the lab before the port** |
| 4 | Send to VS Code | Real extension on the owner's machine |
| 5 | Agent queue | A scheduled run survives a restart; an approval pauses it |
| 6 | Devices and docs | A second real device, by the owner |
| 7 | Suggestions, skills | Critic review of the whole release |

Every slice needs `pnpm check`, its tests and a browser check in `ar` and `en`. A final independent review runs at the end. What an agent cannot run goes on the owner's checklist.

## 13. Risks

- **Terms:** if Anthropic's position on local wrappers changes or turns out stricter, the panel switches to an API key in the bridge's settings. The design keeps that one switch.
- **Internal behaviour:** stream event shapes can change between Claude Code versions. The bridge pins a tested range and shows a clear message outside it, and the panel falls back to "Open in VS Code".
- **Remote execution:** a paired bridge runs an agent on that device, so a taken-over Hub session could direct it. That is why Hub stays inside Tailscale, the bridge limits folders and actions, D41 approvals stay on, and TOTP (D34) is **recommended on** once other devices connect.
- **Usage:** queued runs spend the same subscription limits as interactive work. The default limits stay low for that reason.
- **Moving the lab** while another session works there could lose work. The move waits for a clear check.

## 14. Out of scope

Real multi-user features, cloud scheduling, public internet exposure, a VPS, GitHub, Telegram, email and web push (these still wait for tokens).

## S1 findings (2026-11-06)

Run on the owner's Windows 11 machine with Node 22.17. Unless a line says otherwise, tests used the official binary 2.1.318 (from the VS Code extension folder) with `--model haiku`, a clean environment (no `CLAUDE*` or `ANTHROPIC*` variables) and a throwaway folder. Scripts and raw event logs are listed at the end. "Docs" means `code.claude.com/docs/en/`, read on this date.

**Verdict:** spawning the binary works for everything the panel needs, on the owner's sign-in, with no API key. The design holds, with the corrections under "Contradictions with the approved design". Two of those need the owner.

### Q1. Spawn and stream: works, spawn `claude.exe` directly

| How Node starts it | Result |
|---|---|
| `spawn('claude')`, no shell | `ENOENT` |
| `spawn('claude.cmd')`, no shell | `EINVAL` |
| `spawn('claude.cmd', { shell: true })` | Starts, but is unsafe. A test argument through a shim of the same shape was cut at `&`, and the injected `echo PWNED > pwned.txt` really ran |
| `spawn('<path>\\claude.exe', args)` | Works. Tested with `node.exe` as the stand-in for argument passing: quotes, `&`, `|`, `%PATH%`, `^` and Arabic arrived intact |

- The npm shim only forwards to `node_modules\@anthropic-ai\claude-code\bin\claude.exe`, so the bridge can resolve the `.exe` and never use a shell.
- **Two versions are installed.** `claude` on PATH is **2.1.202**. The extension's copy is **2.1.318**. §3 states Manual mode for 2.1.302 and later.
- Send the prompt through stdin, not argv. This avoids quoting and the command-line length limit. Arabic comes back correctly as UTF-8.
- Event shapes are in "Event mapping" below. 2.1.202 and 2.1.318 emit the same core events; 2.1.318 adds fields such as `capabilities`, `first_content_frame_ms` and `tool_result_meta`.

**Effect:** the bridge resolves the binary itself, checks `--version` against a tested range, and never uses `shell: true`.

### Q2. Resume: context is kept, but a per-turn start is slow with approvals on

- `--resume <id>` kept context (the "teal" door was recalled with no tools) and the same `session_id`, including when resumed from another folder.
- An unknown id gives `result/error_during_execution`, `errors: ["No conversation found with session ID: …"]`, exit 1, no model call.

| Run | Time to first stream event or token |
|---|---|
| New session, no `--mcp-config` | first event 3.9 s (2.8 s of it before `init`) |
| `--resume`, no `--mcp-config` | first token 4.0 s and 4.2 s |
| **With `--mcp-config` and the permission tool** | **first event 7.6 s alone, 9.8 to 10.3 s with other runs going** |
| Second turn in a live process (Q3) | **first token 1.1 s** |
| The API's own part, from `ttft_ms` | 1.0 to 1.4 s, one sample 2.6 s |

The cause is visible in `init`. Without `--mcp-config`, MCP servers are `pending` and the turn starts at once. With it, `init` arrives after every server is `connected` (docs: `headless`, `cli-reference`). This machine loads 5 MCP servers, 7 plugins and 117 skills, and each process tree holds about 25 child processes.

**Effect:** one process per turn with approvals on means 8 to 10 s before anything appears. It works, but it is slow for a chat. See the recommendation in Q3.

### Q3. Interactive input: works, and it is the better default

- Message shape, found by trying: `{"type":"user","message":{"role":"user","content":"…"}}`, one JSON object per line on stdin, with `-p --input-format stream-json --output-format stream-json --verbose`. Omitting `parent_tool_use_id` and `session_id` is accepted.
- Two turns ran in one process with context kept ("PLUM"), one `result` per turn, same `session_id`. `system/init` is emitted again per turn. Closing stdin exits with code 0.
- An unknown line (`{"type":"nonsense"}`) was ignored with no error.
- Stop also goes through this channel (Q7).
- **Is it safe to depend on?** Yes, with the version pin in §13. §3 said the shape is undocumented, which is true of `cli-reference` and `headless`. It is documented as `SDKUserMessage` in `agent-sdk/typescript`, the same page mentions clients that drive "the CLI's control protocol directly", and the SDK uses this path itself. It is not promised as a public CLI contract, so the bridge keeps per-turn `--resume` as its fallback.

**Recommendation, replacing "one process per turn":** keep one live process per chat while it is in use, and close stdin after an idle period (start with 10 minutes). The next message after that uses `--resume`. Keep the number of live processes low, because each one holds its MCP children. Only one turn per chat stays as designed.

**Not run together:** the permission tool with stream-json input, and `--resume` with stream-json input, were each proven separately. Prove both combined first in slice 3.

### Q4. Approvals: proven, with an exact contract

**`--permission-prompt-tool mcp__hubperm__approve`**, stub in `stub-perm-mcp.mjs`:
- A Write inside the folder was allowed and the file was created. `git push origin main` was paused for 8 s, then denied. It never ran. The model received the message and stopped.
- **Input the tool receives** (observed; the docs do not specify it):
  ```json
  { "name": "approve",
    "arguments": { "tool_name": "Bash", "input": { "command": "git push origin main", "description": "…" }, "tool_use_id": "toolu_…" },
    "_meta": { "claudecode/toolUseId": "toolu_…", "progressToken": 3 } }
  ```
- **Output it returns:** one text content block holding JSON, as a normal MCP tool result:
  - Allow: `{"behavior":"allow","updatedInput":{…the input…}}`
  - Deny: `{"behavior":"deny","message":"…"}`
- A denial appears as a `tool_result` with `is_error: true` and the message as content, and in `result.permission_denials` as `tool_name`, `tool_use_id`, `tool_input`.
- `tool_result_meta[].permission_decision` shows who decided: `user_temporary` or `user_reject` for the tool, `config` for rules and modes.
- The stub saw stdin close when Claude exited, so the bridge can clear a stale approval at that moment.

**Waiting:**
- **A pause of 6 minutes (360 s) worked.** The Write then went through and the run ended normally.
- The limit is an idle timer. With `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT=60000`, the call aborted at 60 s with `MCP server "hubperm" tool "approve" sent no response or progress for 60s; aborting`. The model sees a **tool error, not a denial**, and carries on.
- Docs: the default idle limit is **30 minutes for stdio** and 5 minutes for network servers, and the wall limit is about 28 hours. An HTTP server also has a 60 s per-request timer. Long calls are not moved to the background in `-p`.
- Not tested: sending `notifications/progress` on the supplied `progressToken` to reset the idle timer.

**Effect:** make the prompt tool a small **stdio** shim that talks to the bridge, not an HTTP server. The bridge sets `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` well above the queue's approval window, and answers a deny itself when that window ends, so a run never fails by accident. The prompt cache in usage is `ephemeral_1h`, so a pause over an hour should be expected to cost a cache rebuild.

The tool is visible to the model as an ordinary MCP tool. A direct call grants nothing, because the result is only text. The shim should refuse a call whose `tool_use_id` it cannot match to a tool use in the stream.

**`canUseTool` in the SDK:** also works. It received `(toolName, input, { toolUseID, requestId, decisionReason, suggestions, … })`, allow and deny both behaved, and it was held for 3 s only. The SDK turns this on by passing `--permission-prompt-tool=stdio`, an internal mode the CLI docs do not list.

**D41 as flags:** `--permission-mode acceptEdits` plus `--settings <file>` with `ask` rules. Evidence from one parallel run with the stub denying everything:

| Command | Outcome |
|---|---|
| Write inside the folder, `mkdir made-dir` | Ran with no approval |
| `git status`, `node --version` | Ran with no approval |
| `rm target.txt`, `rmdir emptydir` | Paused |
| `git commit -m x`, `git push origin main`, `git branch feature-x`, `git checkout -b feature-y`, `git worktree add ../wt` | Paused |
| `./deploy.sh` (unknown) | Paused |
| `FOO=bar rm target.txt`, `ls && rm target.txt`, `bash -c "rm target.txt"`, `git -C . push origin main` | Paused |

Control run with no Bash `ask` rule: **`rm` and `mv` ran with no approval and the file was gone**, so `acceptEdits` alone breaks D41. PowerShell is a second route on this machine (`init.tools` includes `PowerShell`). `Remove-Item` and `git push` through it paused under `PowerShell(...)` rules, and `Get-Date` ran.

`git commit` and `git checkout` paused **even though the owner's `~/.claude/settings.json` allows `Bash(git commit *)` and `Bash(git checkout *)`**, which confirms ask beats allow. Those allow rules are loaded into every bridge run; see C1.

Limits: rules match command text, and docs (`permissions`) say they are not a security boundary around a program. The real protection is that a command with no matching allow rule falls through to the prompt. Project `permissions.allow` is ignored in `-p` until the folder is trusted (Q6), so the rules belong in `--settings`, never in the repo.

### Q5. SDK sign-in: runs on `/login` with no key; still recommend the binary

- With no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `CLAUDE_CODE_OAUTH_TOKEN` in the environment, `@anthropic-ai/claude-agent-sdk` 0.3.318 ran a full turn on the existing sign-in.
- `init.apiKeySource` is `"none"`, the same as the CLI. `accountInfo()` returned `apiProvider: "firstParty"` and a subscription plan name. `rate_limit_event` arrived as with the CLI. No credential file was read by these scripts.
- **Recommendation: spawn the binary.**
  1. Docs state the SDK's route as API keys, and that third-party products on it may not offer claude.ai login (`agent-sdk/overview`). `legal-and-compliance` says the rule does not "prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription". That sentence fits D38; working SDK behaviour is not a promise.
  2. The SDK adds nothing we need. It spawns the same binary and drives it over the same stream.
  3. The binary keeps the API-key switch in §13 simple, and keeps the bridge free of a large dependency that ships its own copy of `claude.exe`.
- This updates §3 in one way: the SDK does work on `/login` today, but that does not change the choice.

### Q6. Folder config: all loaded, with limits

In a temp folder with no trust, and no `--bare`:
- `CLAUDE.md`: yes. The code word came back with no tool use.
- `.claude/skills/*`: yes, listed in `init.skills`.
- User plugins: yes, all 7 in `init.plugins`.
- `.mcp.json`: connected **with no prompt**. The stub logged `initialize` and `tools/list`, and the tool was reachable through `ToolSearch`. It shows `pending` in `init` and was missing from `init.tools`, so `init.tools` is not a health check.
- User-level hooks also ran (3 `SessionStart`), and `PreToolUse` and `PostToolUse` hooks are configured, so they apply to bridge runs.
- Project `permissions.allow` is **ignored**, with this on stderr: `Ignoring 1 permissions.allow entry from .claude/settings.json: this workspace has not been trusted`. Docs add that project hooks and `.mcp.json` do run untrusted, which is why the bridge must keep its registered-folders rule.

**`--bare` is not in effect today, and the planned default change is serious.** `headless` says: "`--bare` is the recommended mode for scripted and SDK calls, and will become the default for `-p` in a future release." Run explicitly on the real home, `--bare` gave `Not logged in · Please run /login`, because it reads only `ANTHROPIC_API_KEY` or `apiKeyHelper`. It also skips `CLAUDE.md`, skills, plugins and `.mcp.json`. So on the day that default flips, subscription chat through `-p` stops and the folder's config is gone. **`claude --help` lists no opt-out flag today.** The pinned version range in §13 gives warning. Test each new version for this before widening the range.

### Q7. Stop: clean with the control message, and kill leaves orphans

| Method | Result | Children | Resume after |
|---|---|---|---|
| `{"type":"control_request","request_id":"…","request":{"subtype":"interrupt"}}` on stdin | `control_response` at once, `result/error_during_execution` in **34 ms**, exit 1 after stdin closed | **None survive**, `ping` included | Works, context kept |
| `child.kill()` | Immediate, no `result` | **`bash.exe`, `PING.EXE`, `cut.exe` and a `conhost.exe` survive.** MCP servers exit | Works, context kept |
| `taskkill /PID <pid> /T /F` | 332 ms, exit 1, no `result` | None survive | Not run |

Node's `kill()` ended the process at once with no `result`, so the graceful signal paths in `headless` were not reached on Windows.

**Effect:** Stop sends the interrupt, which needs `--input-format stream-json`. If no `result` arrives within a few seconds, use `taskkill /T /F`. Never use `child.kill()` alone. Sending another message to the same process after an interrupt was not tested, so the bridge should let it exit and use `--resume` until that is proven.

### Q8. Usage limit and signed-out: signed-out tested, limit from docs only

**Signed out, tested** through an empty `CLAUDE_CONFIG_DIR`, which leaves the real sign-in alone:
- Exit code 1, empty stderr, `result` in under 1 s.
- `assistant` with `"error": "authentication_failed"` and text `Not logged in · Please run /login`.
- `result` with **`subtype: "success"` and `is_error: true`**, the same text. So check `is_error`, never `subtype` alone.
- `system/init` still arrives first, with `apiKeySource: "none"`, the same as a signed-in subscription run. So `init` cannot show the signed-in state.

**Usage limit, not provoked:**
- Observed on turns: `rate_limit_event` with `rate_limit_info: { status: "allowed", resetsAt, rateLimitType: "seven_day", overageStatus, isUsingOverage, unifiedWindows: { seven_day: { utilization, resetsAt, status } } }`.
- Docs: `status` can be `allowed`, `allowed_warning` or `rejected`, and `errorCode: "credits_required"` means included usage has run out. `assistant.error` can be `rate_limit`, `billing_error`, `overloaded`, `authentication_failed` and others (`agent-sdk/typescript`). Messages read `You've hit your session limit · resets 3:45pm`, with `weekly`, `Opus` and `Sonnet` variants (`errors`). Waiting for a reset is described for interactive sessions. Retryable failures emit `system/api_retry` with `attempt`, `max_retries`, `retry_delay_ms`, `error_status`, `error` (`headless`).

**Effect:**
- Pause the queue on `rate_limit_info.status == "rejected"` or `assistant.error == "rate_limit"`, and use `resetsAt` for "resumes at".
- The panel can show `utilization` as a quiet warning before the limit.
- Signed out: `assistant.error == "authentication_failed"`. Show "Claude signed out", and do not retry.
- **Could not test:** the real shape of a rejected event, and `Login expired`. Match on `error` fields first and message text last, and keep an honest unknown-error state.

### Q9. `headersHelper`: works with no env var, except in an untrusted project `.mcp.json`

Local HTTP echo server, `-p` runs, sandbox `CLAUDE_CONFIG_DIR` with no sign-in (so no model turns, and the real `~/.claude.json` was not edited):

| Where the server is declared | Helper ran? | Header arrived? | Helper's cwd |
|---|---|---|---|
| User scope | Yes, no trust needed | Yes | Config directory |
| `--mcp-config` flag | Yes, no trust needed | Yes | Session folder |
| Plugin (`--plugin-dir`) | Yes, no trust needed | Yes | Plugin root |
| Project `.mcp.json`, **untrusted** | **No** | No. Server still `connected`, no header | |
| Project `.mcp.json`, `hasTrustDialogAccepted: true` | Yes | Yes | Project folder |

- The untrusted case prints `headersHelper not run — this workspace has no persisted trust…` on stderr.
- Credential-named variables reach the helper for user scope and `--mcp-config`, and are removed for project and plugin (`S1_FAKE_TOKEN` tested). So the helper must read a file, not an env var.
- **Windows shell:** with `SHELL` and `MSYSTEM` removed, as under a scheduled task, the helper ran in **`cmd.exe`**: `%OS%` expanded, and `$BASH_VERSION` did not. A bash-style `echo '{…}'` gave no usable header and **the server connected with no error**.
- **Effect:** the command is `"<abs node.exe>" "<abs helper.mjs>"`. It must always print clean JSON, read its token from a file, and finish within 10 s. Not tested with a real signed-in session or with `claude plugin install` (no plugins were installed, by rule); `--plugin-dir` stood in for it.

### Q10. VS Code link: exit codes clean, owner must confirm what appeared

- VS Code 1.145.0, extension `anthropic.claude-code@2.1.318` installed.
- **`code` on PATH is broken on this machine.** It resolves to a Cursor shim first, and `Cursor.exe` no longer exists: `code --version` exits **9009**. The right file is `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd`. The registry handler for `vscode://` points at the real `Code.exe`.
- `code.cmd` needs `cmd.exe /d /s /c` with verbatim arguments, because spawning it directly gives `EINVAL`. Paths with spaces worked.
- Once only: `code "<temp folder>"` exit **0**, and after 5 s `cmd /c start "" "vscode://anthropic.claude-code/open?prompt=Hub%20spike%20test%3A%20ignore%20this"` exit **0**. Nothing was sent into the chat. No other folder was opened and no window was closed.
- Exit 0 only proves the handover to Windows. **The owner must confirm:** a window for `q10 vscode folder` opened, and a Claude tab there has the text pre-filled and unsent. That window can then be closed.

**Effect:** the bridge finds VS Code from the `vscode://` registry entry, not PATH. Its success message says "sent to VS Code", not "opened".

### Q11. `session=`: **unverified**, keep the design

- Docs (`vs-code`): `session` is an ID "from the folder open in VS Code", and if it is not found "a fresh conversation starts". The `claudeProcessWrapper` note says `-p` and SDK sessions join the session list with the wrapper set on extension 2.1.304 or later, and does not say whether they appear without it.
- No page read says `session=` can resume a `-p` session. `sessions` says each surface keeps its own list. It may work, but that needs a visual check, and no more windows were opened.
- **Effect:** §8 stands. The handoff is a new chat from a Hub summary plus the card key. A later owner test can open a spike folder and use `session=` with a known `-p` id; if the chat shows its history, a real resume can be added.

### Recommended commands

**Resolve the binary:** the highest `--version` among the npm `bin\claude.exe`, a native install and the newest `%USERPROFILE%\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe`. Refuse anything outside the tested range, which starts at 2.1.318.

**Environment:** start from the bridge's own environment, with `CLAUDE*` and `ANTHROPIC*` removed. Add `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT=<above the approval window>`. Removing those variables was a precaution here because the tests ran inside a Claude session; the effect of leaving them in was not tested.

```text
<claude.exe> -p
  --output-format stream-json --verbose --include-partial-messages
  --input-format stream-json
  --model <model>
  --permission-mode acceptEdits
  --settings <bridge>\d41-settings.json
  --mcp-config <bridge>\approval-shim.json
  --permission-prompt-tool mcp__hubperm__approve
  [--resume <sessionId>]
cwd = the registered folder, shell = false, stdio = pipe, windowsHide = true
stdin, one line per message:  {"type":"user","message":{"role":"user","content":"<prompt>"}}
stop:  {"type":"control_request","request_id":"<id>","request":{"subtype":"interrupt"}}
```

Do not pass `--strict-mcp-config` (it would drop the folder's servers), `--bare`, or `--dangerously-skip-permissions`. Docs say `--permission-prompts none` denies instead of waiting, so it fits only a run the owner wants never to wait.

`d41-settings.json`, starting list:

```json
{ "permissions": { "ask": [
  "Bash(rm *)", "Bash(rmdir *)", "Bash(git rm *)", "Bash(git clean *)",
  "Bash(git commit *)", "Bash(git push *)", "Bash(git merge *)", "Bash(git rebase *)", "Bash(git reset *)",
  "Bash(git branch *)", "Bash(git switch *)", "Bash(git checkout *)", "Bash(git worktree *)",
  "Bash(docker *)", "Bash(psync *)",
  "PowerShell(Remove-Item *)", "PowerShell(rm *)", "PowerShell(del *)", "PowerShell(rd *)", "PowerShell(ri *)",
  "PowerShell(git *)", "PowerShell(docker *)", "PowerShell(psync *)"
] } }
```

Only the rules for `rm`, `rmdir`, `git commit`, `git push`, `git branch`, `git checkout`, `git worktree`, `PowerShell(Remove-Item *)` and `PowerShell(git *)` were exercised. The others follow the same form and need a test in slice 3. `Bash(git checkout *)` also pauses harmless switches.

**VS Code:**
```text
cmd.exe /d /s /c ""<...>\Microsoft VS Code\bin\code.cmd" "<folder>""      (windowsVerbatimArguments)
cmd.exe /d /s /c "start "" "vscode://anthropic.claude-code/open?prompt=<URL-encoded>""
```

**`headersHelper`:** `"C:\Program Files\nodejs\node.exe" "<abs>\hub-mcp-headers.mjs"`

### Event mapping for the panel

| Panel needs | Event |
|---|---|
| Session id, model, version, plugins, servers | `system/init`: `session_id`, `model`, `claude_code_version`, `plugins`, `mcp_servers[{name,status,source}]`, `skills`, `capabilities`, `permissionMode`, `cwd`. Docs add `plugin_errors` and `mcp_server_errors` when present. Other events also carry `session_id` |
| "Waiting for Claude" | `system/status` with `status: "requesting"`, then `stream_event/message_start` (has `ttft_ms`) |
| Text delta | `stream_event`, `event.type == content_block_delta`, `event.delta.type == text_delta`, `event.delta.text` |
| "Thinking" | `content_block_start` with `thinking`, `system/thinking_tokens`. Thinking text arrived empty in these runs, so show a state, not content |
| Tool start | `stream_event`, `content_block_start`, `content_block.type == tool_use`, `.id`, `.name`. Input builds through `input_json_delta.partial_json` |
| Tool input, final | `assistant`, `message.content[]` with `type: tool_use`. **One `assistant` event per content block**, with a shared `message.id`, so do not treat it as one per reply or append it to deltas |
| Tool result | `user`, `message.content[]` with `type: tool_result`, `tool_use_id`, `is_error`, `content`. Also `tool_use_result` (structured) and `tool_result_meta[].permission_decision` |
| Subagent work | `parent_tool_use_id` non-null on `assistant` and `user` (docs) |
| Approval pending | From the shim, not the stream. Match on `tool_use_id` |
| End of turn | `result`, last for a turn: `result`, `is_error`, `subtype`, `stop_reason`, `session_id`, `permission_denials`, `errors` |
| Usage | `result.usage`, `result.modelUsage`, `result.total_cost_usd` (a client estimate, cumulative across `--resume` per docs). `num_turns` counted 17 for 2 API calls with 16 parallel tools, so do not show it as "turns" |
| Limits | `rate_limit_event.rate_limit_info` |
| Retry | `system/api_retry` (docs) |
| Errors | `assistant.error`; `result.is_error`; process exit with no `result` means cut off |
| Interrupted | `control_response` then `result/error_during_execution` |
| Hooks | `system/hook_started`, `system/hook_response`. Ignore in the UI |

Exit codes are not enough: signed-out exits 1 with `subtype: "success"`, and an interrupt exits 1.

### Contradictions with the approved design

**Needs the owner:**

- **C1: "unknown commands pause" (D41) does not fully hold while the owner's user settings load.** `~/.claude/settings.json` has 259 allow rules and they apply to bridge runs. The `ask` list overrides the ones it names (proven for `git commit` and `git checkout`). But wildcard rules outside it still run freely, such as `Bash(npm run *)`, `Bash(pnpm exec *)`, `Bash(npx tsx *)`, `Bash(node -e ' *)` and `Bash(npm install *)`.
  - *Option A, recommended:* keep the allow rules, and the ask list covers D41's named classes (delete, commit, push, deploy, branch, worktree) plus `docker`. Code run through those wildcards stays approved, as it already is in the owner's VS Code chats.
  - *Option B:* run with `--setting-sources project,local`, so only Hub's rules apply. This probably also drops user plugins and hooks, and was not tested.
- **C2: linking a folder and `headersHelper` (§3, §5, D42, docs/15 §5).** `hub link` writes the server into the folder's `.mcp.json`. There, a helper does not run until the folder is trusted (Q9), so the Authorization header would silently go missing.
  - For bridge runs, this is solvable without the owner: the bridge passes the server through `--mcp-config`. Whether that entry wins over a same-named project entry was not tested.
  - For the owner's own VS Code chats, one choice remains. *Option A, recommended:* accept the normal trust dialog once per folder. It is one click, adds no token or terminal step, and needs no edit to global config. *Option B:* the Link button sets `projects["<path>"].hasTrustDialogAccepted` in `~/.claude.json`, which docs allow. It removes the click, but Hub then edits a global file and opens that folder's other trust-gated settings.

**Owner action, no design change:**

- **C3: the PATH `claude` is 2.1.202, below the 2.1.302 in §3.** The bridge can use the extension's 2.1.318, so nothing is blocked on this machine. A device without the extension needs a current install. The owner may also want to update the npm copy. It was not changed in this spike.

**Technical corrections, no owner decision:**

- **C4: §3 and §7 "one process per turn".** S1 proved more: use a live process per chat in use, falling back to `--resume` (Q2, Q3).
- **C5: §3 "message shape not documented".** It is documented in `agent-sdk/typescript`, though not in the CLI pages (Q3).
- **C6: §3 on the SDK and `/login`.** It works in practice, and the choice of binary stands (Q5).
- **C7: D41 and `acceptEdits`.** `rm` and `rmdir` are auto-approved in the folder, so `ask` rules for Bash and PowerShell are mandatory (Q4). `headless` names only `mkdir`, `touch`, `mv`, `cp` for this mode, while `permission-modes` has the full list, which the control run confirmed for `rm` and `mv`.
- **C8: §8 step 2 "runs `code <folder>`".** PATH `code` is broken here, so resolve VS Code from the registry (Q10).
- **C9: §7 honest states.** Signed-out cannot be detected from `init` or from `subtype` (Q8).
- **C10: §9 "holds the queue's slot".** A wait past the idle limit becomes a tool error and the run continues. The bridge must extend the limit and own the timeout (Q4).
- **C11: §13 gains a risk.** `--bare` becoming the default for `-p` would end subscription use and folder loading together, with no opt-out flag today (Q6). The API-key switch in §13 is the fallback, and it would still lose folder config unless explicit flags are added.

### Not tested

A real usage limit; `Login expired`; the visual result of Q10; `session=` with a `-p` id; `claude plugin install`; the permission tool and `--resume` combined with stream-json input; a same-named `--mcp-config` entry against a project entry; MCP progress notifications as keep-alive; waits beyond 6 minutes; `canUseTool` beyond 3 s; a stop during a pending approval; a new message after an interrupt; the machine sleeping during a wait; `--setting-sources project,local`; another device or a machine without Git Bash.

### Spike notes

- Model turns used: 26 to 28, counted from API messages (24 in CLI logs, 2 or 3 in the SDK run, and up to 1 in a harness crash that left no log). This is slightly over the budget of about 25. `result.total_cost_usd`, an estimate, totals about $0.11.
- `~/.claude/settings.json` hash unchanged. No user-scope MCP server added, no `~/.claude.json` project entry for spike folders, no plugins installed. Running `claude` did write session transcripts for the spike folders into `~/.claude/projects`, where they age out by normal retention.
- Scripts for the bridge author are in `C:\Users\MOHMED~1\AppData\Local\Temp\claude\b4558443fa0fb976\8321ad0c-531e-486e-8e1a-71bcfdf0f2e3\scratchpad\s1\`, which is temporary, so copy them before cleaning up: `harness.mjs`, `stub-perm-mcp.mjs`, `q1a-spawn-matrix.mjs`, `q1b-q2-stream-resume.mjs`, `q3-input-stream.mjs`, `q4-approvals.mjs` (`flow`, `wait`, `idle`, `matrix`), `q4b-q6b-control.mjs`, `q5-sdk.mjs`, `q6-folder-config.mjs`, `q6-q8-zero-cost.mjs`, `q7-stop.mjs` (`A`, `B`, `C`), `q9-headers-helper.mjs`, `q9b-helper-shell.mjs`, `q10-vscode.mjs`, `show.mjs`. Raw events are in `results\*.ndjson`.
