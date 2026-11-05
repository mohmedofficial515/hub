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
| D41 | **Default agent permission:** read and edit inside the project folder freely. Pause for approval on unknown commands, delete, commit, push, deploy and creating a branch or worktree. |
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
- It runs only in folders registered on the project (`repoPaths`). Hub cannot send it an arbitrary command or path: the only actions are start turn, answer approval, stop, open in VS Code.
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

## 6. Slice 2: lab as a module

1. **Before moving:** confirm no other session is working in `F:/Goteav/redesign`. It is not a Git repository, so back it up first.
2. Move it to `apps/lab`, without `node_modules`. Commit the versions and screenshots to the private repo (about 140 MB). Keep the `@web/*` and `@dash/*` aliases, pointing at the sibling projects by env.
3. **Same interface and features:** gallery, side-by-side compare, device sizes, AR and EN, light and dark, status and notes. The gallery moves into Hub's shell as tabs on the Redesign page. Each version still renders in its own iframe, because the projects' stylesheets collide.
4. `start:local` runs the lab and Hub proxies it at `/lab`, so it needs no separate command.
5. Set `LAB_ROOT` to the new folder. **Existing redesign cards must keep their keys:** prove on a copy of the database that a rescan creates no duplicates.
6. Update `redesign-director`, `redesign-porter` and `redesign-workflow`, which are global files outside the repo, to the new path. Show the owner the diff first.
7. Keep the old folder until the owner has checked the new one. Deleting it is a separate request.

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
