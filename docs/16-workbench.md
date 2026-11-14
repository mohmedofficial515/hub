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
| D39 | **The lab moves into Hub** as `apps/lab`, and appears as a page of Hub, reached from the Redesign page. Amended 2026-11-06 by the owner: it opens in a new tab with no sidebar or header, and keeps the lab's own interface. |
| D40 | **Agent queue with schedules** on the main machine, with limits. A missed run starts when the machine is back. |
| D41 | **Default agent permission:** read and edit inside the project folder freely. Pause for approval on delete, commit, push, deploy, creating a branch or worktree, and `docker`. **Owner's choice on C1:** the owner's 259 global allow rules stay loaded, so a command they allow and this list does not name runs without asking; any other unknown command pauses. |
| D44 | **Folder trust (owner's choice on C2):** when the owner presses Link on a folder, Hub writes that folder's trust acceptance into `~/.claude.json`, so no trust dialog appears. Only on that explicit press, only for that folder, atomically, keeping every other key, with a backup. If the file's shape is not as expected, Hub changes nothing and says to accept the dialog once. This file is internal to Claude Code and can change with updates. |
| D45 | **VS Code handoff confirmed by the owner:** the spike's folder window opened with the prompt pre-filled and not sent. |
| D46 | **`repoPaths` stays editable through MCP, with approval (owner's choice).** A change to `repoPaths` widens the bridge's folder allowlist, so `update_project` must pause for the owner's approval in bridge runs: its permission rules must put that tool on the `ask` list. Slice 3 must test this. |
| D47 | **Uninstall keeps folder trust (owner's choice).** Removing Hub from a device removes the `hub` servers and the bridge, and leaves folders trusted, as if the owner had accepted the dialog. |
| D48 | **Panel design:** three clearly different directions as working prototypes in the lab. The owner picks one before the port. |
| D49 | **Direction chosen, in principle (2026-11-06):** `hub/workbench/v1-edge-strip`, extended as §7.1 describes into `hub/workbench/v4-edge-strip-pro`. The owner gives the final approval on v4 in the lab. Two ideas come from the other directions: drag a card into the chat, and "follow the chat". Review of v4 scored 6.2 with 5 blockers, so the final version to approve is `v5-edge-strip-final`. |
| D50 | **Strengthen the engine (owner's choice):** the rich cards stay and get real sources, as §7.2 specifies. |
| D51 | **A new chat defaults to Execute (owner's choice).** A suggestion never runs in Execute by itself: pressing one fills the composer or states plainly that it will run. |
| D52 | **After a report, a task moves to In review by itself (owner's choice), under a server rule (§7.2):** only if it has at least one check and every check is verified against a real step that succeeded. Otherwise it stays, and the card's primary action stays Submit for review. The owner still completes it. |
| D53 | **Newer Claude Code: work with a warning (owner's choice).** A version above the tested one runs and shows a visible warning. Permission rules stay active. Older than the minimum stays refused. An unreadable event stops the turn with a clear message and offers Open in VS Code. |
| D54 | **The page's fate follows the page (owner's choice).** At 1440 and up, the page stays beside the sheet and panel as long as it works at that width: list-like pages down to about 400 px, and Tasks shows its List in place of the Board when under 520 px. At 1280 and below it steps aside, with Previous and Next card on the sheet. It steps aside only while the panel is open, and never because of Follow. |
| D55 | **Port directly (owner's choice):** after the blockers and majors of `v5-edge-strip-final/review.md` are fixed in `v6-edge-strip-port`, port with no further lab approval. The owner judges it live on the real app, after an independent review of the running app. |
| D56 | **The queue page is built in Hub's own style (owner, 2026-11-08):** the kit and the patterns of the Tasks and Inbox pages, with no lab round. An independent critic reviews it afterwards. Calm and consistent: neutral cards, never a coloured side or top edge, coloured icons or small badges only, in `ar` (RTL, default) and `en`, light and dark. |
| D57 | **A queued run follows D52 exactly (owner, 2026-11-08):** a task moves to In review only when Hub itself verified at least one check and every check passed. A run never completes anything by itself. |
| D58 | **Run mode, chosen per run (owner, 2026-11-08):** *With my approval* (the default, today's behaviour) or *Automatic*. Automatic never waits for the owner: a question takes its recommended option, and every call that would pause under D41 (delete, move, commit, push, deploy, branch, worktree, docker, Hub's sensitive tools and any command not allowed) is refused at once, never run, with a message telling the model to carry on, and kept as a pending item (the exact command, its folder, and why). The run ends with a decisions summary. A pending item runs later only on the owner's press, in a chat on that folder, where D41 asks as usual. With my approval, a queued run waits for an approval with no time limit, holds its folders and stays in the inbox; the panel's own chats keep 30 minutes. **Reading of D41:** commit is on D41's pause list, so Automatic skips it like push. |
| D59 | **Multi-folder runs (owner, 2026-11-08):** a run has a main folder and optional extra folders registered on the same project, passed to Claude Code as `--add-dir`. Every folder must be a registered `repoPath` of that project, checked by the API and again by the bridge's allowlist. All of a run's folders are held for "one turn per folder". |
| D60 | **Multi-role runs (owner, 2026-11-08):** a run carries one or more roles. Each role's line (`ROLE_BRIEFS`), its specialties and its reading path (`onboarding.paths`) go into the run's context. With none chosen, a task brings its own role and a plan step its step's role. |
| D61 | **Backups stay on the main machine's drive (owner, 2026-11-08).** By default in `HubBackups` at the root of the drive Hub runs from (`F:\HubBackups` on the owner's machine), outside every Git checkout. The owner frees space on that drive; another drive is not used by default. The folder is a setting. A backup holds a `pg_dump` of Hub's database (doc revisions included), the current text of each document Hub wrote through `save_doc`, and a manifest. It never holds `.env`, a device credential, the Claude sign-in or any secret: Hub stores none. |
| D62 | **A visible backup history, retention by setting (owner, 2026-11-08).** Settings › Backups (the owner's alone) lists every backup with its time, size and state, with Back up now, Keep (pin) and Delete. Delete is the owner's press after a confirmation; the folder goes and the line stays. Nightly at 03:00 machine time by default, run by the API process, with a missed night caught up once at boot. **Retention:** the newest 14 unpinned backups are kept, kept (pinned) ones forever; both the number and the time are settings. A failed night shows in the history and in the owner's inbox. Low free space on the backup drive is a warning in the history. Restoring is `pnpm hub:restore`, run by the owner with Hub stopped; there is no restore button. |
| D63 | **HubServer, Hub as a logon task (owner, 2026-11-08).** Like HubBridge: a Windows scheduled task at the owner's logon, no admin rights, that runs Hub in production mode from what is already built, restarts a part that stops, and logs to `.tmp/logs`. It never builds: `pnpm hub:service build` is the explicit step. `start:local` starts no second copy while it runs; `stop:local` stops it. `pnpm hub:service install` is the owner's step. |
| D64 | **Skills page and Move to Hub (owner, 2026-11-08).** Hub's own skills, which the plugin installs on every device, are listed, created and edited in Hub, and each device takes them on the bridge's next sync. The owner's personal skills in `~/.claude/skills` are shown read only, each with **Move to Hub**, which copies the skill into Hub's skills so it reaches every device: it asks first, never deletes or changes the personal original, and refuses a name Hub already has, offering another. **As built:** Hub's skills are the folders of `packages/team-pack/plugin/skills` in the main machine's checkout, where the plugin's files already came from. A save from the panel writes through Hub to that file and keeps the earlier text as a revision, as `save_doc` does; nothing is committed to Git, which stays the owner's step. |
| D65 | **Hub's protocols are read only on the Skills page (agent's choice, for the owner to confirm).** `ask`, `doc`, `guide`, `plan`, `suggest` and `work` (`HUB_CORE_SKILLS`) are listed and readable, marked "Part of Hub", and never written from the panel: Hub's code and tests depend on their words (`/hub:work`'s report and D52, `/hub:doc`'s draft, `/hub:suggest`'s proposals), so they change with Hub's code. Their names cannot be taken by another skill. |
| D66 | **Suggestions with AI create nothing until the owner's Accept (agent's reading of §11).** `/hub:suggest` runs in **Ask** (read only; by D51 a complete read-only prompt runs on the press) and proposes with `propose_suggestions`, a read tool that only stores the proposals on the turn. Each proposal has Accept and Dismiss in the panel; Accept is the owner's press, web only and session only, and the server makes it through the normal path: `task.create` or `plan.create` through `CardService.apply`, or a Hub skill, which only the owner may accept. No agent can accept its own proposal. |
| D67 | **The plugin sync (agent's choice).** A device takes Hub's plugin from Hub, never from Git: the bridge action `plugin.sync` carries the plugin's files and a version made of the package's own and the start of the files' hash, and the bridge has Claude Code update to it. Claude Code updates an installed plugin only when its version changes (checked on 2.1.319), which is why the hash is in the version. It runs when a device connects with an older plugin and after every skill change; a test stack syncs only on Sync now. Only the plugin syncs, not the bridge's own code, and a chat already open keeps its skills until it starts again. |
| D42 | **Connect:** automatic on the main machine, and one command with browser approval on any other. Linking a folder is a button in Hub. No token copying and no new terminal. |
| D43 | **Devices reach Hub through Tailscale.** Hub is never open to the public internet. This amends D33 for those devices. |
| D68 | **Invites reach a friend two ways (owner, 2026-11-09):** the owner sends the link himself, and Hub also emails it through real SMTP. After Create invite or New link the link, shown once, has Copy, the browser's share sheet, WhatsApp and a mail draft, in ar and en, and says where the email went. Real email is Gmail SMTP from `.env` (`smtp.gmail.com`, 465, TLS, an app password); Hub never stores, logs or returns the password. Settings › System, the owner's alone, says "real email", "local test inbox only (Mailpit)" or "not set up", and sends a test email to the owner's own address. A revoked invite keeps its row, so every list shows pending, accepted, expired or revoked (agent's reading of "consistently" with Hub's no-delete rule). |
| D69 | **A friend reaches Hub by Tailscale machine sharing (owner, 2026-11-09).** The friend installs Tailscale with their own account; the owner shares only this machine from the Tailscale admin console. Never `tailscale funnel`. A friend who cannot reach Hub cannot see its invite page, so the guidance is in the invite email, the share text and docs/13 §17, and the owner sees "Share this machine with them in Tailscale" with the machine's name when inviting. |
| D70 | **Each device keeps its own sign-in limit behind the proxies (agent's choice, for the owner to confirm).** When the API listens on loopback only (published, D43), Express trusts loopback proxies by default, so the sign-in limit, the lockout and audit rows see each tailnet device's address from `x-forwarded-for` instead of 127.0.0.1 for everyone. `TRUST_PROXY` still wins. A published Hub also never builds a device address from the request, whose host is the bind address there. |

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
3. **Same interface and features:** gallery, side-by-side compare, device sizes, AR and EN, light and dark, status and notes. The gallery is Hub's own page at `/<locale>/<ws>/gallery`, opened in a new tab from Redesign. Each version still renders in its own iframe, because the projects' stylesheets collide.
4. `start:local` runs the lab and Hub proxies it at `/lab`, so it needs no separate command.
5. Set `LAB_ROOT` to the new folder. **Existing redesign cards must keep their keys:** prove on a copy of the database that a rescan creates no duplicates.
6. Update `redesign-director`, `redesign-porter` and `redesign-workflow`, which are global files outside the repo, to the new path. Show the owner the diff first.
7. Keep the old folder until the owner has checked the new one. Deleting it is a separate request.

### Slice 2 as built (2026-11-06)

- **Serving.** `pnpm start:local` runs the lab's dev server on 127.0.0.1:7320 (`LAB_PORT`), with its log, and stops it on Ctrl+C. `next.config.ts` rewrites `/lab` to it (`HUB_LAB_ORIGIN`, fixed at build). Rewrites also carry the HMR WebSocket. A Next rewrite turns `?import&raw` into `?import=&raw=`, so the lab puts the bare flags back before Vite reads them.
- **Guards.** `middleware.ts` answers 404 to any `..`, backslash, NUL or dot-folder in the path, however often it was encoded, and 401 or a redirect to sign-in without a session. Vite's `server.fs.allow` lists the lab, the two `src` trees and the packages they load. Nothing else of Hub or the sibling projects is reachable. A version runs on Hub's origin, so it is trusted code, as the owner's own designs are.
- **A broken version.** The lab compiles on demand, so one version failing shows its error in its own frame only. `pnpm lab:check` names broken versions, and `start:local` runs it once in the background. If the lab stops, Hub stays up and Redesign says so.
- **The page.** The first build put the gallery in Hub's shell as a tab of Redesign, in Hub's design system. The owner preferred the lab's own interface, stable and familiar, so since 2026-11-06 it is the view `gallery`: a new tab with no sidebar or header, dark, left to right and in English in every locale (`features/redesign/lab-words.ts`), in the lab's shape (`apps/lab/lab/src/shell`). It stays part of Hub: the shell still mounts the live stream, the card's sheet, the palette, the keys, the toasts and the session around it, so statuses change live and the owner's verdict opens over the frame. Every link to a version opens it in a new tab. The old `redesign?view=gallery` redirects there. The lab's own gallery stays at `/lab/` for agents that drive a browser.
- **Scanner.** `LAB_ROOT` defaults to `apps/lab`. `externalKey` was always relative, so only `source.config.path` and the stored `lab_url` held the old place: `pnpm lab:repoint` moves both.
- **Commits.** Approve and reject write the README and commit nothing, so `apps/lab` shows those files in `git status` until the owner commits them.

### Cut-over on the owner's instance

Owner-run, after checking the gallery. The old folder stays until a separate request.

1. Stop Hub: Ctrl+C, or `pnpm stop:local`.
2. Copy edits made in the old folder since the move. `robocopy F:\Goteav\redesign F:\Goteav\hub\apps\lab /E /XO /FFT /XD node_modules dist .vite /XF pnpm-lock.yaml /L` lists files newer in the old folder, and copies nothing. If it names `package.json`, `tsconfig.json`, `vite.config.ts` or `lab\src\`, merge those by hand, because the new copies were changed on purpose. Run it without `/L` to copy, then `git status apps/lab` shows what changed. It does not copy deletions.
3. In `.env`, delete the `LAB_ROOT` and `LAB_URL` lines.
4. `pnpm start:local`, then in a second terminal `pnpm lab:repoint --rescan`. It must print `created 0, updated 0`, unless step 2 changed a README, which then counts as updated.
5. Check: Redesign › Open the lab in `ar` and `en`; Settings › System shows the lab as running; `SELECT count(*), count(DISTINCT external_key) FROM cards WHERE type = 'redesign'` gives two equal numbers.
6. Apply the diff to the global files (§6 item 6), and commit `apps/lab` if step 2 changed it.

**To go back:** restore `LAB_ROOT` in `.env` and run `pnpm lab:repoint`. That puts the source back, and scanning from there changes no card.

## 7. Slice 3: chat panel

**Design first.** The design lives at `hub/workbench/` in the lab (D48, D49). Run `ux-critic` on `v4-edge-strip-pro` and get the owner's final approval before porting it. No coloured side or top edges. The engine does not depend on the look, so it is built alongside the design.

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

Each chat runs the official binary in the chosen folder, as "S1 findings" specify. It loads that folder's `CLAUDE.md`, skills and MCP. Only one turn runs per chat.

### 7.1 What the owner added (2026-11-06)

The owner asked for more detail, strong info tooltips, and a panel that is smart, flexible, and serves document development and task execution professionally.

**Info tooltips.** Every control and status in the panel has a rich tooltip, shown on hover and keyboard focus, with touch access through a tap or an info button. Each says: what it does, its shortcut, what will happen, what it depends on, and, when disabled, exactly why and how to fix it. Status tooltips carry real values: for example, which device, Claude version, folder, and since when. A tooltip never holds the only copy of something essential.

**More detail, all from real data.**
- Each turn: steps with status, duration, model, and usage when the engine reports it.
- Each tool step, opened: exact input, result, error.
- Changed files for a turn with counts, opening a diff.
- For the chat: folder, device, branch, session, mode, and when it started.
- Nothing is invented: a value the engine does not report is left out.

**Modes, always visible and switchable.** Ask (read only), Plan (read only, ends in a proposed plan), Execute (D41 permissions). Model and effort selectors where the installed Claude Code supports them. Each mode's tooltip states what it can and cannot do.

**Smart context.**
- Suggested prompts change with the page and the open card's type and state, such as Decide on a decision and Deliver on a need.
- Attach cards, docs and files as chips. Drag a card in. "Follow the chat" brings the discussed card to the sheet, and can be turned off.
- "Do next" with its reason (§11).

**Task execution protocol**, a Hub skill the panel starts from a card, also usable in any Claude Code chat. Stages: Understand (read the card, its links and docs through Hub) → Plan (steps and acceptance checks) → Execute → Verify (run the checks, and show the real output) → Report. The stages show as a live checklist on the turn. The report goes on the card as evidence: what changed, files, checks run with results, what was not checked. The task does not complete itself (§9). A failed check stops at Verify and says so.

**Document development protocol**, a Hub skill. Stages: Search (existing docs through Hub, §10) → Propose (update or new, and why, with no duplicates) → Draft (shown as a diff against the current text) → Save through `save_doc` on approval, keeping the earlier revision → Link (the doc to its related cards). Writing follows the project's rules for language and audience. Starts from "Improve this doc", "Document this task" or "Find gaps". A gap report compares what cards and code mention against the docs. Nothing is invented: a claim Claude cannot verify from the project is flagged instead of written as fact.

**Flexibility.** Pin a chat. Branch from a message into a new chat. Export a chat as Markdown. Retry a turn. Stop at any time. Templates for frequent prompts, saved per project. Panel width, default mode and the tooltip level (full or compact) are remembered per device.

### 7.2 Structured results (D50, D52)

This is the shared contract between the engine and the panel design. It lives in `packages/contracts/src/chat.ts`. Models are unreliable narrators, so the server separates what was **verified** from what was **claimed**, and the UI shows the difference.

- **`report_work` (MCP):** `{ card, summary, checks: [{ name, command?, stepId?, outcome: passed|failed|skipped, note? }], changedFiles?, notChecked: string[] }`. It replaces the Markdown comment as `/hub:work`'s report and is stored as evidence on the card with its event. The server sets each check's `verified` itself: true only when `stepId` is a step in this chat whose command matches and whose real result succeeded. A failed real step cannot be reported as passed: the server refuses or marks a conflict. `changedFiles` comes from the bridge's facts when available.
- **Auto-move (D52):** after `report_work`, if there is at least one check and all are `passed` and `verified`, the task goes to In review through `CardService.apply`, recorded as the agent's action with the reason. Otherwise it stays, and the report says why. Outside a panel chat (a VS Code chat) no step can be verified, so checks are `claimed` and it never moves by itself.
- **`propose_plan`:** `{ title, steps: [{ title, role?, why? }], checks?, risks? }`, an event `plan.proposed` with a structured plan, leading to "Run this plan". Plan mode's skill and system prompt use it; text in the reply stays the fallback.
- **Questions:** `AskUserQuestion` from the engine becomes a `question` event with choice cards, answered through the same path as approvals.
- **`propose_doc`:** `{ doc?, title, reason, baseVersion?, draft, duplicates: [], claims: [{ text, status: verified|unverified, source? }] }`, an event `doc.draft`, shown as a diff with flagged claims. The owner's edits and flag answers go back with the save. The server computes the duplicate check against real docs with links, instead of trusting Claude. `save_doc` refuses when a flag is unanswered, and a refused save never shows as sent.
- **Approval effect line:** a deterministic line per D41 category from the bridge (for example, "Pushes to a remote"), never model text.
- **Blocked note:** when Ask or Plan refuses a tool, an event says what was refused and offers to switch to Execute.
- **Engine honesty rules for the UI:** Ask and Plan refuse shells and other servers' tools. A mode or model change restarts the process, with a visible Starting line.

### Slice 3 engine as built (2026-11-06)

No final UI yet. The API and hooks are in `apps/api/README.md` § Chats and `apps/web/README.md` § The chat panel's engine.

**Corrections to S1, from the real binary with a scripted model:**

- **The permission tool, `--resume` and stream-json input work together.** That was the one combination S1 left unproven. Tested in `chats-real-binary.e2e-spec.ts`.
- **A tool on the `deny` list disappears.** The model gets `No such tool available`, and it never reaches the permission tool.
- **Rules cannot make Ask and Plan read only on their own.** A tool of another MCP server the owner allows ran in Ask. So those modes also get a `PreToolUse` hook (`bin/hub-read-only-guard.mjs`) that refuses every MCP tool except Hub's reads. It cannot tell a read from a write on another server, so other servers are off in those modes. Shells are off too, for the same reason.
- **`ExitPlanMode` reaches the permission tool**, and its input may not hold the plan. In the real haiku smoke the model first wrote the plan to `~/.claude/plans/…` with Write, which Plan mode denies, then gave it in its reply. The bridge records the plan from `input.plan`, or from that refused Write, and tells the model to put it in the reply.
- **Hub's MCP tools are deferred**, so they are not in the request's tool list, and they still run by name.
- A folder's short 8.3 spelling is not "inside the folder" for `acceptEdits`, so a Write there pauses. It pauses safely, and it only shows in temp paths.

**Choices the plan left open, none of which changes a decision:**

- **Starting chats through MCP: no.** `chat.run` and `chat.answer` are web only and session only, as Link is. An agent starting agents would get round the queue's limits, and one reaching `answer` could approve itself. Slice 5's queue is how an agent run gets scheduled. Reading and tidying chats do have tools.
- **Hub's tools in Execute.** `mcp__hub` is allowed, so `/hub:work` can write evidence without a prompt on each call. The table's `destructive` tools pause, which covers D46's `update_project`, and so do `save_doc` and `restore_doc_revision`. A test holds the bridge's lists to the table. The lists live in the bridge, so a taken-over Hub session cannot widen them.
- **D41's list grew a little past S1's start:** `mv` and `Move-Item`, as S1 found them unguarded, and `git revert`, `git stash`, `git restore`, `git tag`, `rsync`, `scp`, `ssh`, `gh`, `kubectl`, `vercel`, `netlify`, publish commands and `sudo`.
- **A dropped socket stops the turn.** Nobody could answer an approval or see the reply, so the bridge stops and the API marks it `interrupted`. A restart of the API does the same.
- **The approval window is 30 minutes**, owned by the bridge, then denied. `HUB_BRIDGE_APPROVAL_TIMEOUT_MS` changes it. The engine's own idle limit is set 10 minutes above it.
- **The tested version is exactly 2.1.318**, as S1 asked (§13). D53 changed what happens around it: see "§7.2 as built". `HUB_CLAUDE_MAX_VERSION` on the bridge declares a newer one tested.
- **Branching copies words, not the session.** The first turn in a branch is told the earlier words as a prefix, up to 20,000 characters.
- **An approval's "device"** in the audit row is the device running the turn. The row's ip and user agent say which browser answered, since a browser has no paired identity.
- **Streaming secrets.** Up to the last three words of streamed text wait for the next piece or the next tool, so a secret split across pieces is caught. Stored text can be shown a moment late, and never holds the value. A file that holds a secret cannot be saved over with `save_doc`, because its old text would become a stored revision. The owner removes the value by hand.
- **New tables** beyond §4: `chat_steps`, `chat_approvals`, `chat_prompt_templates`, `doc_revisions`.
- **`/hub:work`** took the `work` skill's name, so the plugin's background guide is now the `guide` skill.

**Event schema** (`TurnEvent` in `packages/contracts/src/chat.ts`): `turn.session`, `turn.status`, `text.delta`, `tool.started`, `tool.input`, `tool.result`, `approval.requested`, `approval.resolved`, `stage`, `plan.proposed`, `turn.starting`, `engine.warning`, `tool.blocked`, `question.asked`, `question.resolved`, `work.reported`, `report.refused`, `doc.draft`, `doc.draft.updated`, `limit`, `turn.ended`.

### §7.2 as built (2026-11-06)

The API is in `apps/api/README.md` § Chats, and the hooks in `apps/web/README.md` § The chat panel's engine. Everything here ran with the real binary and a scripted model (`chats-real-binary.e2e-spec.ts`).

**How a call proves it came from a panel chat.** Claude Code gives every MCP call its tool use id in `_meta`, and the stream gives the recorder the same id. A step with that id, in a running turn of this member's chat in this project, is the proof (`TurnRegistry`). Nothing is passed by the model. A chat outside the panel has no such step, so it is `outside_panel`: its checks stay claimed and the task never moves. A chat whose `hub` server resolves to another project also reads as outside the panel, which fails the safe way.

**Choices the plan left open, none of which changes a decision:**

- **`stepId` is optional, and `command` is what normally matches.** A model usually cannot see a tool use id. So a check's `command` finds every step that ran it, the last run decides, and the server stores that step's id. A named `stepId` must hold the same command. Comparison ignores spacing only. The skill tells Claude to run each check word for word.
- **`verified` is true only for `passed` agreeing with the last real run.** A failed check reported as failed agrees with the step (`basis: matched`), and stays unverified, as §7.2 says.
- **A contradiction refuses the whole report.** Nothing lands on the card, and the turn gets `report.refused`. Naming an earlier good run does not hide a later failure.
- **Leaving a check out does not earn the move.** A check an earlier report in this chat named and this one drops is `droppedChecks`, and the task stays, with reason `check_dropped`. Otherwise dropping a failed check would move the task. A failing step the model never reported at all cannot be caught: nothing says that command was a check.
- **Failure history (M3).** Every run of a check's command is in `runs`, oldest first, capped at 20, with the end of its real output. Each report is its own card event, so an earlier one is never overwritten. `counts.failedRuns` counts real failures, including those a later run fixed.
- **The move happens in the report's own transaction**, through `CardService.apply`: `card.report_work` writes the `work_reported` event, then a `task.submit_review` follow-up whose `status_changed` event carries the reason, by the same actor, via `mcp`. It moves only `in_progress` to `in_review`. A task not started stays, with reason `wrong_status`, and nothing here can complete one.
- **`changedFiles`** come from a new closed action, `turn.files`, which answers the current turn's facts so far. The list covers this turn only. If the device cannot answer, Claude's list is stored with `source: 'claimed'` and `filesFrom: 'claimed'`.
- **`propose_doc` needs a target.** §7.2's shape has `doc?`, and a new file also needs `source` and `path`. Duplicates are not an input at all. An unverified claim's text must appear in the draft word for word, or it is refused, so the owner's answer can act on it. The search is by title, and it never counts the document as its own duplicate.
- **Flag answers are `confirm`, `remove` and `keep_flagged`.** `keep_flagged` writes `> Unverified: <claim>` on its own line. The panel and the save share `applyClaimAnswers`, so the preview is what gets saved.
- **Save is Allow on `save_doc`, with the answers.** Claude calls `save_doc({ draft })`, it pauses as any `save_doc` does, and the approval carries `draftId`. The answer route takes `doc: { content?, claims? }`. Allow with a flag open is refused with `hub.docs.draft_flags_open` and stays pending. `save_doc` itself refuses too, for the case with no approval. A refusal is written on the draft and sent as `doc.draft.updated`.
- **A redraft replaces the open draft of that document in this chat.** The old one becomes `dropped` and cannot be saved. An answer carries over while the claim's words are the same (M5), and a deny's `note` tells Claude what to change.
- **In a panel chat a model cannot answer its own flags.** `save_doc`'s `answers` counts only outside the panel, where the only way to hear the owner is the chat. Plain `save_doc` with `content` cannot get round an open draft of the same document in this chat.
- **Questions share the approval table and route.** `chat_approvals.kind` is `question`, and `POST approvals/:id` takes `answers` keyed by question text. They work in Ask and Plan, because they run nothing. `AskUserQuestion` reaches the permission tool with `-p`, and `updatedInput: { ...input, answers }` is what the engine takes (tested).
- **The blocked note covers every way of refusing.** In Ask or Plan, an error result on a writing tool or another server's tool is `tool.blocked`. Plan mode's own plan file is left out, because it is refused on purpose. A failed read is not a refusal.
- **`turn.starting`** carries why: `new`, `resume`, `mode`, `model`, `effort` or `folder`. A process that had already closed is a `resume`, since nothing remembers what it was.
- **The panel's system prompt goes to every mode, not only Plan.** Tested on 2.1.318: `--system-prompt-snapshot` is on by default, so the first launch's prompt is recorded and every resume reuses it, whatever a later launch passes. A chat that began in Execute would never see a prompt added on moving to Plan.
- **A slash command goes first.** The context prefix would stop `/hub:work` being a command, so `turnPrompt` puts it after, and the skill reads it as part of its arguments (tested).
- **D53.** The newest copy in the tested range is used, and otherwise the newest above the minimum, with `engine.warning` on each turn and `warning` in `engineStatus`. Below the minimum is `version_out_of_range`, and nothing runs. `HUB_CLAUDE_MIN_VERSION` can only raise the floor, which is how the refusal is tested. An event is unreadable when a line is not JSON, or a known type lacks what it must hold. An event type the mapper does not know is ignored, because new ones appear with no harm and treating them as fatal would stop every chat at each Claude Code update.
- **M9.** `GET chats/engine?fresh=true` is Check again. `honestStateOf` in `features/chat/live.ts` is the one rule: signed out clears only through a re-check made after the failure, and a limit clears by itself at `resetsAt`. No engine call can read a limit, so its re-check only re-evaluates. With no `resetsAt`, a send may try. With the device offline, an answer is refused with `hub.chats.approval_device_offline`, which says the turn stopped as cut off, and no `allow` is recorded.
- **D51.** A new chat defaults to `execute`. A suggestion carries `mode` and `onPress`. Complete read-only prompts `run`. Unfinished words, and anything else in Execute, `fill`. `/hub:work` and `/hub:doc` from a card `run` in Execute, and their words are `suggestions.<id>.runs`. The review suggestion was never reachable on a task, because it looked for verbs tasks do not have: it is now offered on `in_review`, in Execute, and fills the composer (M10).
- **`/hub:work` still starts the task**, since the machine has no way from `claimed` to `in_review`. It now says so first, in the skill's own opening and at stage 2.
- **New tables and columns:** `doc_drafts`; `chat_steps.command`; `chat_messages.structured_plan`, `reports`, `notices`; `chat_approvals.kind`, `effect`, `draft_id`, `questions`, `answers` (migration `0004`). New tools: `report_work`, `list_work_reports`, `propose_plan`, `propose_doc`. New action: `card.report_work`. New event kind: `work_reported`. `save_doc` gains `draft` and `answers`, and `content` is optional only with `draft`.
- **Real smoke (`E2E_REAL_MODEL_WORK=1`), 2026-11-06.** `/hub:work` on haiku, on a temp folder and a test card: the card moved to In review with its one check verified, and `changedFiles` came from the device. Haiku reported `verify` as a stage and skipped `report`'s, so a model can skip a stage line, and nothing depends on it. It runs on the owner's real config, the only place their sign-in is, so a folder `.mcp.json` and a session plugin with no hooks (`HUB_BRIDGE_PLUGIN_DIR`) keep it away from their Hub. A model-free test proves both.
- **Not caught by the server:** a passing check whose command is not the one that proves anything. Hub proves a command ran and succeeded, not that it was the right command, and a check run before later edits still counts.
- **A stale save shows what moved.** `chatDocDraftSchema.conflict` is `{ version, text }`: the file as read at the refusal, in the same form as `baseText` (no front matter), filtered and capped at `draftChars`. It is set only with `refusedCode: 'hub.docs.stale_base'`, and cleared by a save or a redraft. `version` is null and `text` is empty when the file is gone. The whole field is null when the file cannot be read at that moment, as with its device offline, and the refusal still stands. A file holding a secret never gets here: `save_doc` refuses it earlier, for that reason.
- **Engine facts.** `turn.session` carries `skills` and `mcpServers`, names only (500 and 100, 200 characters each), and `chatMessage.engineFacts` stores them. Null means the engine did not say, never that there are none. A server's status is left out, because `init` says `pending` for one that connects later (S1 Q6).
- **`HUB_SKILLS`** lists `/hub:ask`, `/hub:doc`, `/hub:plan` and `/hub:work`, and a test holds it to the plugin folder. `guide` is not user-invocable. There is no `/hub:suggest` yet: §11 names it, and the plugin has no such skill. **Since Slice 7** it also lists `/hub:suggest`, and the test holds it to Hub's core skills (`HUB_CORE_SKILLS`), since the owner's own skills live in the same folder (D64).
- **New columns:** `doc_drafts.conflict`, `chat_messages.engine_facts` (migration `0005`).
- **A 401 is retried for minutes (new, not in S1).** With a key that stopped working, 2.1.318 emits `system/api_retry` with `error: "authentication_failed"` and backs off to over 30 s between attempts, so the turn reads `retrying` long before it ends `signed_out`. `CLAUDE_CODE_MAX_RETRIES=0` makes it fail at once, with `assistant.error: "authentication_failed"`. The bridge lets the binary finish, so this is what the owner would see. Only the scripted engine sets the variable, to `1`.

### Panel as built (2026-11-06)

The approved `v6-edge-strip-port` (D55) on the real shell, real API, real bridge and binary. Code: `components/workbench/`, `components/ui/rich-tip.tsx`, `features/chat/thread-items.ts`, `components/cards/card-sheet.tsx`. Words: `messages/{ar,en}/chat.json`, under `panel` and `tips`. How to extend it: `apps/web/README.md` § The chat panel.

**§7.1, item by item.**

| §7.1 | As built |
|---|---|
| Info tooltips | `Tip` in the kit: what, then, needs, detail, keys, real values, why off and how to fix. Full and compact, remembered per device. Touch: Explain mode, long press, a tap on a disabled control. Allow and Deny have none, the recorded exception |
| Each turn | One line that opens: status, failure, model, duration, steps, usage, each only as the engine reported it |
| Each step | Exact input, result, error, who allowed it |
| Changed files | Counts, then the real diff from `chat.diff`, read when opened |
| Chat facts | Project, folder, device, branch, session, mode, model, started, working as, version, MCP servers and skills from `turn.session` |
| Modes | Ask, Plan, Execute, always in view, `Alt 1` to `Alt 3`. Model and effort follow `engineStatus` |
| Smart context | `suggestedPrompts` from the page and card, attachments as chips, cards dragged in, Follow the chat, which never makes the page step aside |
| Do next | `doNext` in contracts, with its reason, in Runs |
| `/hub:work`, `/hub:doc` | From the sheet's With Claude row, the docs page's bar, suggestions and the slash menu, with the live checklist |
| Flexibility | Pin, branch, export, retry, stop, templates per project. Width, default mode, tooltip level and Follow per device |

**D54 on real pages.** `#main`, the sheet and the panel are inline-size containers, and `--container-page-*` in `globals.css` holds the page's width at each viewport step with the panel closed. So `lg:@page-lg:grid-cols-12` is exactly `lg:grid-cols-12` with the panel closed, and falls back beside the panel. `usePageWide(px)` is the same for `useMedia`. Tasks reads `usePageRoom().boardTight`, so its List stands in for the Board under 520 px with the URL and the chosen view untouched. `QuietPrimary` takes the place of the design's CSS override: a page's filled button is outline while a card is open, and a dialog puts it back.

**The sheet** is a plain `<section>` on every page, including the lab's own, where it lies over the page. Focus lands on the title, Esc closes only from inside, and with the panel open it stays open after an action. Previous and Next walk the page's own `useKeyboardList` rows, with its filters.

**The lab's own page has no panel.** `gallery` has no sidebar or header (D39 as amended), and the panel stays out with them.

**Runs entry.** Only what is real: chats waiting on the owner, chats with a turn running, and Do next. The queue, Run now and Schedule are slice 5, so they are not shown at all.

**What changed from v6, and why.**

| In v6 | Here | Why |
|---|---|---|
| Strip's run icons, Schedule, Run now, pause and cancel | Gone | Slice 5 has no engine. Review L4 and the brief |
| The usage value at rest | Shown only once a turn has reported a limit | The engine reports it only then |
| Connected since | Last seen | `DeviceDto` has no connected-since |
| A question's `variant`, `diff`, `changedOn` | Gone from questions. The stale save's text is on the draft: `conflict`, shown as a diff | The real flow is a refused save, not a question |
| `stoppedBy` | Derived from the turn's failure | The engine has no such field |
| Turn detail's mode and effort | Gone | No message stores them |
| A step's one-word result | Gone | The engine reports none |
| Links card, Gaps card | Gone | No event carries them. Linking is a step, and a gap report is Claude's reply |
| Saved's revision names | "The earlier text" | A version here is a hash, which reads as nothing |
| Personal and folder groups in the slash menu | Hub's, then "From this folder and yours" | `init.skills` gives names with no source, and only after a first turn |
| File picker with a list | A path the owner types | No bridge action lists a folder |
| Strip's project groups in History | One list | A chat belongs to the project on screen |
| A project chip | Gone | Chats belong to the project on screen, so it can never differ |
| Models fixed at three | The three, plus Default | Default passes no model, which is the real choice |
| Pending label "approvals" | "answers" | The count holds questions too |

**After the panel review (2026-11-08).** The review is `docs/status/2026-11-08-panel-review.md`, and each finding's outcome is marked there.

| Finding | Now |
|---|---|
| B1 mode tips empty | The key is `mode:${mode}` typed with `as const`, no cast. `tip-keys.spec.ts` holds every tip key the panel and the sheet name, template keys included, to both catalogs |
| M1 bridge tip | "Last seen" for `lastSeenAt` (the code had kept "Connected since"), and State is one word: Connected or Offline |
| M2 empty History | Two lines: no chats yet in this project, or none that match the search |
| M3 offline sheet | The sheet hides its Claude actions only while the empty chat shows them, which it does only when the engine is not blocked. Offline they stay, disabled, with their reasons |
| M4 phone focus | The panel is `inert` while the card covers it. To the chat puts focus in the panel (on touch, not in the message box), To the card on the sheet title |
| M5 tablet | A first visit opens the panel only where its 440 px default leaves the page D54's 400 px (`opensByDefault`): closed at 768 and 820, open from 900 px of content width. The remembered choice wins after that |
| M6 sheet header | The key and the chips never break inside themselves, and under 448 px of sheet the way back is its arrow, with its name kept for screen readers |
| Minors | Settings returns focus to Chat options, an off tip names the control first, phone tabs use the strip's words, one header row on touch with no state, the where chip names the device with no folder, Timeline is list-like, Back after Previous and Next returns to the last card's row, the sidebar folds before paint |

**The bridge, after the same day.** A credential check that fails (the database down) is no longer read as a revocation: only a refused credential closes with `BRIDGE_CLOSE.revoked`, and a check that cannot run closes with `unavailable` (1013), which the bridge retries. Node's own `WebSocket` fires `error` and never `close` when the connection is refused, so the bridge's loop now ends an attempt on that `error`, and gives up on a socket still connecting after 20 s. `pnpm start:local` asks `GET /api/v1/bridge/self` whether Hub holds the device's socket, in the one request it already made, and restarts a bridge that is alive but not seen.

## 8. Slice 4: send to VS Code

A button on any card and in the panel: **Open in VS Code**.
1. Hub asks the bridge on the owner's current device.
2. The bridge runs `code <folder>`, so the right window has focus.
3. It opens `vscode://anthropic.claude-code/open?prompt=…` with a short prompt carrying the card key. Claude reads the rest through MCP.
4. **The owner presses Enter.** Claude Code does not support auto-send on this link, and Hub says so on the button.

The same button appears on a panel chat to continue the topic there. It starts a new VS Code chat from a Hub summary and the card key, so it does not depend on session sharing. If S1 shows `session=` works reliably, a real resume can replace this.

If the device has no bridge, the button copies the prompt instead.

### Slice 4 as built (2026-11-06)

`POST workspaces/:ws/chats/vscode` is in `apps/api/README.md` § Chats, and `useOpenInVsCode()` in `apps/web/README.md`. `vscodePrompt` and `vscodeLink` are in `@hub/contracts`, so the client shows the same text the server builds.

- **No shell, in place of S1's `cmd.exe` commands.** `code.cmd` needs `cmd.exe`, so the bridge runs what it points at. On Windows `resolveVsCode` now also answers `program`, the real `Code.exe` from the registry. Elsewhere that is the resolved `code`.
- **Detached.** A `Code.exe` that is the first window keeps running until the owner closes it, so waiting on it would hang, and killing it at a timeout would close their editor. The cost is that no exit code comes back, and a start only proves the handover, which is what S1 Q10 said anyway. The answer is `sent`, never "opened".
- **The link's arguments are the registry entry's own:** `--open-url -- <link>`. The bridge builds the link itself from `VSCODE_LINK_PREFIX`, and the prompt is only ever encoded into it. A test holds the bridge's copy of the prefix and the 500 character cap to the contract.
- **A three second wait** between the folder and the link, so the link lands in the right window. It is a guess until the owner's smoke: S1 waited five.
- **`ELECTRON_RUN_AS_NODE` is removed** from what the bridge passes on, since inherited from an editor it would make `Code.exe` read a folder as a script.
- **No extension is not refused.** With VS Code there and the extension missing, the link still goes, and VS Code says what it says. The health panel already shows the extension's state.
- **Not checked here:** the real window. Tests inject the spawn, so nothing has opened from this code yet. The single real smoke and the owner's eye are step 4's gate (§12).

## 9. Slice 5: agent queue

- **Run now, schedule a time, or repeat weekly** on any task, plan step or chat prompt, with a target folder.
- **Agent queue page** in the Work group: running, waiting for approval, next, recent. Reorder by dragging, with pause and cancel.
- **Limits in Settings:** runs at the same time (default 1), runs per day (default 5), quiet hours, and pause all. Reaching the subscription's usage limit pauses the queue and says so, with no retry loop.
- **One run per folder.** Runs work in the current checkout. Creating a branch or worktree, committing and pushing all need approval (D41), which follows the owner's standing Git rules.
- **Results go on the card:** summary, changed files and the chat link. The task does not complete itself: the owner confirms unless they set otherwise.
- **Missed runs** start when the main machine is back, oldest first. A run that was cut off is marked interrupted and is not restarted automatically.
- A run waiting for approval goes to the inbox and the panel, and it holds the queue's slot for its folder.

### Slice 5 as built (2026-11-08)

The API is in `apps/api/README.md` § The agent queue, the page and hooks in `apps/web/README.md` § The agent queue. Tests: `agent-queue.e2e-spec.ts` (API, scripted device, fake clock) and `e2e/specs/agent-queue.spec.ts` (browser, real bridge and binary, scripted model).

**The gate (§12 step 5), proven with the scripted engine.** A prompt run is scheduled for the next whole minute at least 20 s away. The test stops the throwaway API before that time and starts it again after it, on the same database (`e2e/support/api-restart.ts`). With no one touching anything, the run starts as a missed run when the bridge reconnects, pauses on `git push origin main` for the owner, shows in the inbox (`run_waiting`) and under Waiting for your approval, holds its folder against a second run, and ends `done` only after Allow. It runs in `ar` and `en`, with screenshots of both. The API spec proves the same restart with a fake clock, plus a running run cut off by a restart, which is `interrupted` and never started again.

**How it works.**

- **Postgres is the truth.** `agent_runs` holds every run, its time and its weekly repeat; `agent_queue_settings` the owner's limits (migration `0006`, additive). `position` orders what has not started, and starts as the due time, so missed runs go oldest first and the owner's drag only changes `position`.
- **No BullMQ for this.** A run is a chat turn, which needs the process holding the bridge's socket, and BullMQ's delayed jobs would be a second copy of the schedule that a worker without sockets could pick up. The dispatcher ticks every 15 s in the API process, when a device becomes ready (`BridgeHub.onReady`), when any turn ends, and after each owner change, one tick per member at a time. A run claims its slot in one statement (`queued` to `running`).
- **A run is a normal panel turn.** `ChatsService.startForQueue` opens an Execute chat (D51) owned by the member and sends through the same path as Send, so D41's approvals, the recorder, the secret filter and `TurnRegistry`'s proof for `report_work` all apply. A task runs `/hub:work KEY`, so stages and the report land on the card, and D52 decides the move (D57). A plan step that already became a task runs as that task; one that did not runs "Carry out step N of plan KEY". Turn facts reach the queue through `ChatTurnEvents`, after commit.
- **Limits** are the member's, across projects, since one plan pays for every run: runs at once (1), runs per day (5, counted from local midnight), quiet hours (off by default, so "Today 22:00" works), pause all. The timezone is the queue setting, else the machine's (`Intl` in the API process). `holdFor` (`domain/queue-rules.ts`) is the one rule, read by the dispatcher and the page, so the page's reason is the dispatcher's.
- **One turn per folder**, counting panel chats too: a run waits while any turn works in that checkout, and a run waiting for approval keeps it.
- **Usage limit:** a `rejected` limit or a turn ending `rate_limited` pauses the queue with `resumesAt` from the engine. It continues once at that time; with no time it waits for the owner. The run that hit it is `failed` and never retried. The owner's own pause is never overwritten by a limit.
- **Signed out:** the run goes back in line with nothing spent, and the queue waits, checking `engine.status` past the cache at most once a minute (no model call). Offline: the run waits and says so.
- **Restarts:** running runs become `interrupted` (`cut_off`) at boot and are never restarted by themselves; Run again is the owner's press. A weekly run leaves next week's copy as it starts, so weeks missed while the machine was off are one run, not several.
- **Results on the card:** summary (the last report's, else the reply's start), changed files from the bridge, Hub's move decision, and Open chat, on the run and in the card sheet's Runs.

**MCP.** Agents get `list_queue` only (`queue.read`, on the bridge's read list). Adding, ordering, pausing, resuming and cancelling runs and changing limits are `queue.manage`, web only and session only: an agent that could add a run would be starting an agent, and one that could resume a paused run or lift a limit would be approving itself. Reading the queue lets `/hub:plan` and the owner's chats see what is booked without changing it.

**Do next** feeds Run now and Schedule on its task items; a suggestion never runs by itself (D51). Pressing Run now is the owner's act.

**Back from v6** ("Panel as built" listed them as gone): the strip's live run icons, Run now and Schedule (Do next, the task sheet, a plan step's menu, a proposed plan's Schedule it), and pause and cancel in each run's menu. The panel's Runs adds the queue's next runs and last results, with the limits and a link to the page.

**Choices the plan left open, none of which changes a decision:**

- **Pause on a running run** stops its turn now and holds it; Resume sends the same prompt again in the same chat, so its session and context carry on. Pause all leaves running runs to finish.
- **Cancel ends a weekly repeat** with that run.
- **The schedule dialog** keeps v6's three choices and adds "Choose a time" (a date, a time, and "repeat every week on this day"), since the spec asks for any time. "Now" is offered only in the page's New run, where a typed prompt is the chat-prompt source.
- **Where a run goes:** the panel's device and the folder chosen in the dialog, from the project's linked folders. There is no "main machine" field: a missed run starts when its own device is back.
- **The queue page** is list-like for D54 (400 px), and `g q` reaches it.

**For the owner to check with a real model:** a real `/hub:work` run from the queue, its card moving to In review only with verified checks; a real usage limit's `resetsAt`; a run left waiting on an approval past 30 minutes (since D58 a queued run waits with no time limit; the panel's chats keep the window).

### D58 to D60 as built (2026-11-08)

- **Where it lives.** Contracts: `RUN_MODES`, `createRunSchema` (`mode`, `extraFolders`, `roles`), `runDecisionSchema`, the turn event `auto.decision`, `turnStartArgsSchema` (`addDirs`, `runMode`, `untimed`), `ROLE_BRIEFS`. Migration `0007` adds `mode`, `extra_folders`, `roles` and `followups` to `agent_runs` (additive). Bridge: `skipForOwner` and `answerForOwner` in `lib/turns.mjs`, `--add-dir` per folder, and the allowlist check of `addDirs` against the main folder's project in `lib/actions.mjs`. API and web: the two READMEs, § The agent queue.
- **Only the owner sets these.** `runMode`, `untimed` and `addDirs` reach the bridge only from `ChatsService.startForQueue` and `sendForQueue`, fed by the run row. Changing a run's mode is `POST runs/:id/mode`, `queue.manage`, session only; agents keep `list_queue` alone. Automatic only narrows what runs: nothing is allowed in it that would not be allowed with the owner present.
- **The recommended option** is the one whose label says "Recommended" (or «موصى به»), else the first. The context of an automatic run tells the model nobody will answer, so it rarely asks.
- **No time limit** is a timer 20 days ahead (Node caps a timer near 24.8 days), with `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` above it, because `expiresAt` must stay a date. Anything more than two days away reads as "no time limit" in the panel (`hasNoTimeLimit`).
- **Roles had no instructions of their own in Hub before this**: a role was a name, its specialties and its reading path. D60 adds one fixed line per role and reuses the other two. The run's roles go into the Hub context block of each turn's prompt, not the engine's system prompt, because the engine keeps the first launch's system prompt for good.
- **Run now** stays one press in With my approval. Automatic, extra folders and roles are in the schedule dialog, which now offers Now everywhere, and in a run's menu for a run not started. Run again keeps them.
- **Choices left open:** a pending item of a run still going cannot be run yet (it would contend for the same folder); changed files are still read from the main folder only; a panel chat has no extra folders (the API takes them only from a run).
- **Queue review (`docs/status/2026-11-08-queue-review.md`).** A passed time is never run silently (M1): "Today 22:00" reads "Tomorrow 22:00" once 22:00 has passed and books tomorrow, as Hub's quick choices name the real day, and a custom time in the past says it would start at once and the button reads Add now.

**For the owner to check with a real model:** an Automatic run whose model calls `git push` (refused, kept, the run carries on and ends with the push pending); a real `AskUserQuestion` in Automatic; a queued run left waiting on an approval for more than 30 minutes (it must still be answerable); `--add-dir` with real folders, and the model editing in an extra folder.

## 10. Slice 6: devices and docs

- `tailscale serve` publishes Hub over HTTPS inside the owner's private network. `Secure` cookies turn on from the public URL. Web and API stay bound to localhost otherwise. The owner installs Tailscale on each device; that part cannot be automated.
- **Docs live on the main machine.** Other devices read and search them through pages and MCP, and keep no copy.
- **Writing docs from any device:** a new tool `save_doc` writes through Hub to the file on the main machine, keeps the earlier text as a revision that can be restored, and refuses a save based on an older version. This replaces "docs are read-only" from docs/15 §6 for local-path docs. Git commits stay a separate, owner-approved step.
- **No rewriting:** the plugin's session-start hook gives Claude the project brief and doc index, and a skill rule tells it to search Hub's docs before writing a new one. `save_doc` warns when a similar document exists.
- **Limit:** if the main machine is off, other devices cannot reach the knowledge. This follows from D37. A nightly backup is included, because one machine is now the only copy. **Amended by D61:** it stays on the main machine's own drive, by the owner's choice, not another drive.

### Slice 6 as built (2026-11-08)

The API is in `apps/api/README.md` § Backups and § Reaching Hub from other devices, the page in `apps/web/README.md` § Settings › Backups, the owner's steps in `docs/13-operations.md` §14 and §15. Decisions D61 to D63 above.

**What already existed and was checked, not rebuilt.**

- **Docs from any device.** Pages read the file on the main machine on each view (`DocsReadService`), MCP reads and searches it (`get_doc`, `search_docs`), and no device keeps a copy. `save_doc` (Slice 3) writes through Hub to the file, on the API's machine or through the bridge for a source with `config.deviceId`, keeps the earlier text as a `doc_revisions` row that `restore_doc_revision` brings back, refuses a stale `baseHash` (`hub.docs.stale_base`) and warns with real similar documents. `docs-save.e2e-spec.ts` proves all of it.
- **The skill rule.** `/hub:doc` searches first and "never starts a new document before searching"; `/hub:guide` and the CLAUDE.md snippet say the same.
- **Secure cookies and CORS** already followed `HUB_PUBLIC_URL` (`baseCookieOptions`, `enableCors`), and `HUB_API_PUBLIC_URL` already told a new device where the API is.

**What was missing and is built.**

- **The session-start brief.** `GET /me/context`, which the plugin's SessionStart hook injects, now ends with the project's brief (description and goals) and its document index (the 40 latest, each with its path), with the rule to search before writing. They come after the lists, so the 8 500-character cut drops them first (`sessions.e2e-spec.ts`).
- **Publishing over Tailscale (D43).** `pnpm hub:tailscale serve` runs `tailscale serve --bg --https=443`: `/` to the web, `/mcp` and `/bridge` to the API (another device's Claude Code and bridge need those two; `/api/v1` already goes through the web's proxy). It never uses `funnel`, so only the owner's tailnet reaches it. It prints the two `.env` lines (`HUB_PUBLIC_URL` and `HUB_API_PUBLIC_URL`, both `https://<machine>.<tailnet>.ts.net`), since Hub does not edit `.env`. With an https `HUB_PUBLIC_URL`, cookies are Secure and the API and web listen on 127.0.0.1 only (`bindHostOf`; `HUB_BIND_HOST` overrides), so the tailnet address is the one way in. Settings › Devices › Reaching Hub from other devices reads `GET me/devices/publishing`: the address, Secure cookies, where Hub listens, and what `tailscale status` and `tailscale serve status` say, then the steps for a second device.
- **Nightly backups (D61, D62).** `modules/backups`, migration `0009` (additive: `backups`, `backup_settings`), Settings › Backups, `pnpm hub:restore`.
- **HubServer (D63).** `pnpm hub:service install|uninstall|status|start|stop|build`, `scripts/hub-server.mjs`, the task's XML in `packages/bridge/lib/hub-server-task.mjs`.

**How the backup works.**

- **One folder per backup**, `hub-YYYYMMDD-HHMMSS-<id>`: `hub.dump` (`pg_dump --format=custom --no-owner`), `docs/<project>/<source>/<path>` and `manifest.json`. It is written as `<name>.partial` and renamed when whole, so a folder without the suffix is complete; a failure removes the partial folder.
- **The dump runs inside Hub's own Postgres container**, found by the port DATABASE_URL publishes (`docker ps --filter publish=<port>`), so its version is the server's and the machine needs no Postgres tools. A `goteav-*` container is refused by name whatever the settings say (`HUB_BACKUP_PG_CONTAINER` names another). No shell, no password on a command line.
- **The documents copied** are those with at least one revision: the ones Hub wrote, whose current text may not be committed yet. Their earlier texts are already in the dump. A source on another device (`config.deviceId`) is skipped: the bridge is not asked for a backup.
- **One at a time**, under an advisory lock (`hub.backups.running`). A backup the API never finished (a restart) becomes `failed`, "Cut off by a restart of Hub", at boot.
- **The night:** each minute, and 20 s after boot, the scheduler asks whether the latest nightly time already has its run, whatever its outcome. If not, it runs one: `scheduled` on time, `catch_up` more than 15 minutes late. Three nights off make one backup when the machine is back. A failed night is not retried by itself. The timer is off in a worker, in `QUEUE_MODE=inline` and with `HUB_BACKUP_SCHEDULE=off`.
- **Retention** runs after each backup, when the number to keep goes down and when a backup is unpinned. It removes the folders of the finished, unpinned backups past the newest N and marks their rows `retention`. Hub removes only a folder its own naming rule matches, so a changed path in the database cannot reach anything else.
- **Rows are never removed.** A deleted backup keeps its line, with who removed it and when. A finished backup whose folder vanished outside Hub reads as "Folder missing".
- **Low space:** under 5 GB free, or under 10 % of the drive (`isLowDisk`). The owner's drive F had 16 GB free of 117 GB on 2026-11-08, which is not low by this rule.
- **A failed night** writes a `system` inbox item, `backup_failed`, to every owner in their first project, linking to Settings › Backups.
- **Permissions:** `backup.manage` is the owner's alone and `web_only`, and every route is `@SessionOnly`: no token or agent can start, keep or delete a backup or move the folder. There is no MCP tool.
- **Restore:** `pnpm hub:restore <folder | hub.dump>` refuses while the API answers or HubServer is alive (`--force` skips that), asks for the database's name (`--yes` skips that), and runs `pg_restore --clean --if-exists --single-transaction` in the same container, so all comes back or nothing changes. It prints where the copied documents are and does not write them back by itself.

**How HubServer works.** The task (logon trigger with a one-minute delay for Docker Desktop, `LeastPrivilege`, `IgnoreNew`, no time limit, hidden, `conhost --headless`, working folder the repository) runs `scripts/hub-server.mjs`. It waits up to ten minutes for `docker compose up --wait`, applies migrations, then starts the API, web and lab from their builds, restarting any that stops with a wait from 5 s to 60 s. Task Scheduler's "restart on failure" only covers a task that could not launch, so this loop is what keeps Hub up; the task keeps that setting for the launch case. A missing build is logged with the command that makes it, and the runner stops. If Hub's ports are taken (a `start:local` is running), it leaves that Hub alone. `.tmp/hub-server.json` holds its pid for `start:local`, `stop:local` and `hub:service`.

**Choices the plan left open, none of which changes a decision:**

- **The default folder** is `HubBackups` at the root of the drive the API runs from, `HUB_BACKUP_DIR` when set. On the owner's machine that is `F:\HubBackups`, which is not in a Git checkout (checked: `F:\` has no `.git`).
- **The nightly time** is read in the machine's timezone, not the queue's or a project's: backups belong to the machine.
- **The first start after this update makes one backup at once**, as the catch-up for that night, since there is none yet.
- **Listening on 127.0.0.1** turns on only with an https public URL. Before publishing, Hub listens as the first release did, so a device that already reaches it on the LAN keeps working until the owner switches to Tailscale.
- **The backups tab is the owner's alone**, so a pm sees nine tabs and the owner ten.

**Tests.** `backups.e2e-spec.ts` (API, the throwaway database, a real `pg_dump` into a temp folder, the fake clock): Back up now with the documents and a manifest with no secret, owner-only and no token, one at a time, the night and its catch-up, a failed night in the inbox, retention with pinning and the owner's delete, a missing folder, low space, the folder rules, a restart cutting a backup off, and `hub:restore` refusing while an API answers and restoring into a second throwaway database. Unit: `backup-rules.spec.ts`, `bind-host.spec.ts`, `tailscale.spec.ts`, `publishing.service.spec.ts`, `packages/bridge/test/hub-server-task.spec.mjs` (the task's XML and arguments, install, state, uninstall, on a fake system), and the web's `backups.spec.tsx` and `devices.spec.tsx`. Browser: `e2e/specs/backups.spec.ts`, in `ar` and `en` with screenshots. The browser stack backs up to a temp folder with the night off.

**For the owner (an agent cannot do these):**

1. **Free space on drive F** for the backups, then open Settings › Backups once Hub runs this version: the first backup runs on its own.
2. **Tailscale:** install it on the main machine and sign in, turn on HTTPS certificates for the tailnet in its admin console if asked, run `pnpm hub:tailscale serve`, put the two printed lines in `.env`, restart Hub. Then turn on two-step sign-in in your profile (§13, D34).
3. **A second real device** (§12 gate for step 6): install Tailscale, sign in with the same account, open Hub's https address, sign in, and pair its bridge with the command in Settings › Devices. Steps in `docs/13-operations.md` §14.
4. **HubServer:** when you want Hub to start at logon, stop `start:local`, run `pnpm hub:service build` and `pnpm hub:service install`, then `pnpm hub:service start` (or log off and on). `pnpm hub:service status` says what runs. Not installed by an agent: the live Hub and another session were running on this machine.
5. **A restore drill**, once: `pnpm hub:restore <backup folder>` against a copy, or with Hub stopped, to see it work on your machine.

## 11. Slice 7: suggestions, skills and projects

- **Suggestions, without AI:** Today shows a ranked "do next" from real state: overdue, blocking others, ready and small, plan steps next in line. Each item says why, with "Run now" and "Schedule".
- **Suggestions, with AI:** `/hub:suggest` runs in the owner's Claude through the panel, reads the project through MCP, and proposes tasks, skills or plans. Nothing is created until the owner accepts.
- **Skills page:** lists the skills Hub's plugin installs on every device. Create or edit one through the panel, and each device picks it up on the bridge's next sync. Existing personal skills in `~/.claude` are shown as read-only.
- **Projects:** "New project" in the panel uses the existing `create_project` tool, and links a folder in the same flow.

### Slice 7 as built (2026-11-08)

The API is in `apps/api/README.md` § Do next, § Skills and the plugin sync and § Suggestions with AI; the pages and hooks in `apps/web/README.md` § Do next, suggestions with AI and New project and § Skills; the plugin in `packages/team-pack/README.md`. Decisions D64 to D67 above. Built in Hub's own style with the existing components, with no lab round, as the owner asked; an independent review of the running app follows (§12 step 7).

**What already existed and was reused, not rebuilt.**

- **Start with these** (`DoNext`, the panel's Runs) and `doNext` in contracts, ranking overdue, blocking and priority, with Run now and Schedule (Slice 5). Slice 7 extends that one list instead of making a second.
- **The queue's entry points** (`RunButtons`, `useRunPlace`, `ScheduleDialog`), so D58 to D60 apply to a run started from Do next.
- **`POST /workspaces`**, the route `create_project` stands for, the Projects page's `NewProjectWizard`, and the Link button (`folder.link`, D44).
- **The propose pattern** of `propose_plan` and `propose_doc`: a read tool that stores a structured result on the panel turn (`TurnRegistry`), and a card in the thread.

**What was missing and is built.**

- **Do next, ranked by the server.** `GET today/next` runs `doNext` with what a card list has no room for: each task's effort, so a ready `S` task is "small", and `nextPlanSteps`, the first step not done of each approved or running plan. A step that became a task is offered as that task ("Next step of KEY"), only while it waits to start; a step with no task yet is its own item, run as a `plan_step`. The score adds 15 for a plan's next step and 8 for small to Slice 5's (overdue 100, each blocked card 30, P0 25, P1 12), so overdue still leads. The panel's list now reads this route, and Today shows the same list in its first lane, five items, after the deadlines.
- **Ask Claude for more** on that list, and **Suggest what to do next** among the empty chat's suggestions on Today, Planning and the default pages, run `/hub:suggest` in a new chat in Ask. The new `suggest` skill reads through Hub's read tools only (brief, what's new, tasks, decisions, needs, ideas, plans, the queue, `list_skills`, docs), checks what exists first, and proposes up to six tasks, plans or skills with `propose_suggestions`, every `why` naming what it read. The thread shows one card per turn with each proposal's kind, why, steps or the skill's full text, and Accept and Dismiss (`ProposalsCard`).
- **The Skills page** (`/[ws]/skills`, Knowledge group). Hub's skills first, owner-made ones before Hub's protocols, each with when Claude uses it, how a person types it (`/hub:<name>`), its files and **On N of M devices**, with the device names in its tip. The owner creates and edits them (name, when to use it, typed or not, Markdown), reads every earlier text and brings one back. Then the owner's personal skills, read only, each with Move to Hub. A card at the top shows the plugin each device took (current, older, never, or the last failure in the bridge's words) and **Sync devices now**.
- **The plugin sync** (D67): `PluginBundleService` builds the plugin with its version, `PluginSyncService` sends `plugin.sync`, and `packages/bridge/lib/plugin-sync.mjs` writes the marketplace folder whole and runs `claude plugin marketplace update hub` and `claude plugin update hub@hub --scope user`, or the normal install where there is none. `ConnectBundleService` serves the same files, so a new device starts current. **This also mends a gap from Slice 1:** Claude Code installed the plugin once at version `0.1.0`, and no later change reached a device. On the owner's machine the installed plugin had `ask`, `plan` and `work` only, without `doc` and `guide` (seen 2026-11-08 in the plugin cache).
- **New project from the panel.** The panel's menu has New project, which opens the Projects page's wizard with a third, optional step: a folder on a connected device. It creates through `POST /workspaces`, then presses Link on the new project with that folder, which is D44's explicit press, said in the step before it is made. A link that fails leaves the project made and says so; with no device connected the step says to link later in Settings › General. Hub then opens the new project's Today.
- **Migration `0010`** (additive): `devices.plugin_version`, `plugin_skills`, `plugin_synced_at`, `plugin_sync_error`; `chat_messages.suggestions`; the table `skill_revisions` (no project: one Hub, one plugin; rows are never removed).
- **New permissions, tools and action:** `skill.read` (everyone) and `skill.manage` (the owner, web only); `list_skills` and `propose_suggestions`, both read tools on the bridge's read list; the bridge action `plugin.sync`; the turn event `suggestions.proposed`.

**Choices the plan left open, none of which changes a decision:**

- **"Through the panel"** is read as Hub's own interface: the Skills page writes skills, and the chat panel feeds it (an accepted skill proposal, a link from it to the page). No agent can write a skill: a skill steers every later chat on every device.
- **Only `SKILL.md` is edited from the page.** A moved skill's other files (references, scripts) are copied and named on the page, and change only in the checkout.
- **Move to Hub copies text files only.** Up to 200 files, 500 KB each and 2 MB in all; a binary file, a secret in any file, or more than that refuses the whole copy, and dot entries (`.git`) are left out. Only the `name` line of the copy's `SKILL.md` changes. A name outside Hub's naming (`Odd_Name`) needs another one, as a clash does.
- **On the main machine both copies load** after Move to Hub, `/name` and `/hub:name`, until the owner removes the personal one by hand. The dialog says so.
- **Personal skills are the main machine's.** Another device's `~/.claude/skills` is not listed: no bridge action reads it.
- **No delete or rename of a Hub skill.** Hub never hard-deletes, and removing a folder from the checkout is a Git change the owner makes. Not asked for.
- **"Devices synced"** compares each skill's folder hash with the hashes the device took at its last good sync, so an edit reads "not on this device" until the next sync lands.
- **A personal skill is shown with any secret-looking value masked**, and one holding a secret cannot be moved.

**Tests.** API e2e: `today.e2e-spec.ts` (the ranking with every reason, a role and the default length), `skills.e2e-spec.ts` (15: the lists, a pm's view, writes with revisions, a stale save, Hub's protocols, session only, Move to Hub with a clash, a binary, a secret and too many files, the sync on connect, after a change, on failure and in manual mode, and the connect bundle), `chats-structured.e2e-spec.ts` (`propose_suggestions` in and outside the panel, Accept once, Dismiss, a pm refused a skill, no token, `list_skills`), `devices.e2e-spec.ts` (a new project then Link with a real bridge). Unit: `do-next.spec.ts`, `skill-file.spec.ts`, `plugin-bundle.spec.ts`, the bridge's `plugin-sync.spec.mjs`, the team pack's `/hub:suggest` checks, the web's `skills-page.spec.tsx`, `layout.spec.tsx` (Do next, proposals, New project) and `new-project-wizard.spec.tsx`. Browser: `e2e/specs/suggestions-skills.spec.ts`, in `ar` and `en` with screenshots: Today's list and Run now, `/hub:suggest` with a scripted `propose_suggestions` and Accept, the Skills page with Move to Hub and a clash, New project with its folder linked on the scripted engine's device (D44's trust written in its isolated home), and **Sync devices now through the real binary** (2.1.319), which installs the plugin in the engine's isolated home and turns the device current.

**For the owner (an agent cannot do these):**

1. **Apply migration `0010`** with `pnpm db:deploy`, then restart Hub. The rebuilt `apps/api/dist` already holds Slice 7, and the live database does not have its columns yet.
2. **The plugin reaches your machine:** after the restart the main machine's bridge takes the new plugin by itself. `claude plugin list` should show `hub@hub` at `0.1.0-sync.…`, a new Claude Code session should offer `/hub:suggest` and `/hub:doc`, and the Skills page's device card should read "Has the current plugin".
3. **A real `/hub:suggest`** from Today's Ask Claude for more, on your real project: the proposals should rest on real cards, nothing should be created until you press Accept, and an accepted task or plan should appear as a card.
4. **Move one real personal skill to Hub**, then check it on a second device after its bridge reconnects, and remove the personal copy on the main machine if you no longer want both.
5. **Commit the Hub skills you add** (`git status packages/team-pack/plugin/skills`) when you want them in Git.
6. **New project from the panel** on your machine, with a real folder: the folder should open in VS Code with no trust dialog, and a chat there should land on the new project.
7. **The independent review of the whole release** (§12 step 7).

## 11a. Invites that reach a friend (owner's report, 2026-11-09)

The owner reported that an invite email never reached the friend, and that the link opened but registration failed. Decisions D68 to D70 above. The API is in
`apps/api/README.md` § Mail and invites, the pages in `apps/web/README.md` § Invites and mail, the owner's and the friend's steps in `docs/13-operations.md` §16 and §17.

**What was found, reproduced through an HTTPS stand-in for `tailscale serve`** (a `*.ts.net` name, `Host` the bind address, `x-forwarded-host` and `x-forwarded-proto` set),
with HUB_PUBLIC_URL at that address, before any change:

1. **The email never left the machine.** `.env` sends mail to Mailpit on `localhost:7342`, a test inbox nobody else reads. The invite and the MCP answer still said "the link
   went by mail".
2. **The page's password rule was not the API's.** The join page said "at least 10 characters"; the API refuses under 12 (docs/04 §1.9). A friend who followed the hint with
   10 or 11 characters got "That password is weak" and could not register (`password_weak`, 400, seen in the run).
3. **The owner trying the link in his own browser** got a bare "You don't have permission" (403 `hub.common.forbidden`), because accepting with a session belongs to that
   session's account. Worse, once his 15-minute access cookie had expired, the same press created the friend's account and put the friend's session in the owner's browser.
4. **Every device shared one address.** Behind `tailscale serve` and the web's proxy, every request reached the API from 127.0.0.1, so the owner and a friend shared one
   10-a-minute sign-in limit and one lockout (10 failures in 15 minutes locked everyone out).

**What was checked and is not a cause:** the link is built from HUB_PUBLIC_URL (the tailnet address), the token is URL-safe and survives the trip, the cookies are `Secure`,
`HttpOnly` and `SameSite=Lax` and are kept over https, the redirects keep the browser's address (commit `1754563`), CORS and the CSRF header pass, and a fresh device with a
12-character password joined and landed in the project. No route builds a link from the request's host, except the device API address before Hub is published (now never once
it is, D70).

**What is built.**

- **Invite page** (`invite-form.tsx`): the API's 12-character rule in both languages. When the browser has a session cookie the page asks who is signed in: another account
  sees whose invite it is and **Sign out and continue**; the invited account joins with one press; a revoked link says it was withdrawn. The API answers
  `hub.identity.invite_other_account` (409) instead of the bare 403 and creates nothing.
- **The link, shown once** (`invite-link.tsx`): Copy, Share (Web Share API where the browser has it), WhatsApp (`wa.me`), a mail draft (`mailto:`), the text in the owner's
  language with the link on its own line and, on a tailnet, how to reach Hub; where the email went (`mail`: `real`, `local` or `off`, from the API); and on a tailnet the step
  "Share this machine with them in Tailscale" with the machine's name (from `GET me/devices/publishing`) and a link to `https://login.tailscale.com/admin/machines`.
- **Statuses** (migration `0011`, additive: `invites.revoked_at`, `revoked_by_id`): one rule, `inviteStatusOf`, for the list, the pending counter and `list_invites`.
  Revoke keeps the row; a revoked link answers `hub.identity.invite_revoked` (410). **New link** (resend) gives seven more days, renews an expired invite, and refuses an
  accepted or revoked one. Members shows waiting and expired invites with New link and Revoke, and joined and revoked ones below the team as earlier invites.
- **Mail** (`mail-config.ts`, `MailService`, `GET` and `POST test` under `/workspaces/:ws/mail`, `mail.manage`: owner only, web only, session only): the state from `.env`
  (real, local, off; host, port, TLS, whether a login is set, the sender) and a test email to the owner's own address that answers sent or why not (`auth`, `connection`, `tls`,
  `rejected`, `not_configured`, `unknown`), which Settings › System words in ar and en with the `.env` line to check. The mailer already took `SMTP_USER` and `SMTP_PASS`; it
  now defaults the port to 465 with `SMTP_SECURE=true`, the sender to the login, short timeouts, and nodemailer's logger stays off.
- **The invite email** (`invite-mail.ts`): plain text in the project's language, the inviter's name, the link on its own line, the date it ends, and on a `*.ts.net` address
  the three Tailscale steps.
- **MCP**: `invite_member` and `resend_invite` say where the mail went; `list_invites` shows each status.

**Tests.** API e2e: `invite-journey.e2e-spec.ts` (the journey as the web's proxy passes it behind `tailscale serve`: https link, accept with Secure cookies, the project, refresh,
sign out and in again, with TOTP required too; the 12-character rule; the owner's own browser; a new link, expired, revoked and used with every status and the counter; one
sign-in limit per device), `mail.e2e-spec.ts` (authenticated SMTP to a local test server with AUTH PLAIN and LOGIN, a refused app password, a server that is not there, no mail
server, owner only and no token, the invite email with the Tailscale steps), and `invites-and-seed.e2e-spec.ts` updated. Unit: `mail-config.spec.ts`, `invite-mail.spec.ts`,
`invite-status.spec.ts`, `bind-host.spec.ts`, `public-url.spec.ts`; web `invite-form.spec.tsx`, `invite-link.spec.tsx`, `invite-share.spec.ts`, `mail.spec.tsx`,
`members-page.spec.tsx`. Browser: `e2e/specs/invite-journey.spec.ts`, in `ar` and `en`, through `support/tailnet-proxy.ts` (HTTPS with a certificate made for the run) and
`support/smtp-server.ts` (the API restarted with the tailnet address and an SMTP login inside that file only). The browser stack no longer sends to the owner's Mailpit (7342).

**For the owner (an agent cannot do these):**

1. **Gmail:** create an app password (2-Step Verification must be on), put the lines of docs/13 §16 in `.env`, restart Hub, then press **Send test email** in
   Settings › System. Never paste the password into Hub, a card or a chat.
2. **A friend:** invite from Members, then share this machine with them in the Tailscale admin console (docs/13 §17). They install Tailscale with their own account, accept
   the share, and open the link.
3. **Migration `0011`** is applied by `start:local` and HubServer on start (`pnpm db:deploy` by hand otherwise).
4. **Confirm D70**, or set `TRUST_PROXY` to what you prefer.

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
