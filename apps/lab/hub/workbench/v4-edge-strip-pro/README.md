---
version: v4-edge-strip-pro
title: Edge strip pro
status: review
base: v1-edge-strip
created: 2026-11-06
tokens: inherit
touches-components: [apps/web/src/components/shell/shell.tsx, apps/web/src/components/shell/header.tsx, apps/web/src/components/shell/shortcuts-dialog.tsx, apps/web/src/components/cards/card-sheet.tsx (non-modal, docked, evidence), apps/web/src/components/common/toast.tsx (position), docs page (doc bar, revisions, width from the page not the window), new components/workbench/*]
ported:
---

# Edge strip pro

**The bet:** everything the owner asked for in docs/16 §7.1 can live in the panel without it feeling busier than v1, because it all sits one press away. At rest a turn is a reply and one quiet line. Pressing that line opens the turn's facts, and pressing a step opens its exact input and result.

**What it gives up:** it asks more of the tooltips. A folded panel only works if every control can explain itself, so the tooltips are load-bearing rather than decoration.

## Idea
v1's layout is unchanged: page, card sheet, panel, strip, with the strip always there. Three depths organise the rest.

| Depth | What shows | Examples |
|---|---|---|
| Rest | The conversation and the one thing that wants the owner | Reply, approval, draft, plan, the composer |
| One press | The facts behind a line | Steps, turn details, chat facts, changed files, revisions |
| Two presses | The evidence itself | Exact input, result and error, a file's diff, a check's output |

There is one strong focal point at a time. An open approval, draft or plan is the only bordered card that asks for something. Suggestions go away while a turn runs, while an approval, plan, draft or question waits on the owner, and as soon as the owner starts typing.

## Key decisions
- **One tooltip.** `core/tips.tsx` with all text in `core/tips-copy.ts`. Hover waits 450 ms, then neighbours open at once. Keyboard focus opens it at once. Esc closes it and focus never enters it. A click or Esc that returns focus to a control does not reopen it.
- **The text field's tooltip is hover only, and never while focused or holding text.** It would otherwise cover what is being typed. The same text is its `aria-describedby` hint.
- **Touch.** An info button in the panel header turns on Explain mode: a tap then explains a control instead of pressing it, including menu triggers. A disabled control explains itself on any tap, with no mode needed. Nothing else on the phone grows an extra icon.
- **Menu items carry a second line, not a tooltip.** A tooltip on top of an open menu fights with it, so items that need explaining say so in place, including why a device or an effort level is unavailable.
- **Modes never fold.** Ask, Plan and Execute are in view under the composer on every width, with `Alt+1` to `Alt+3`. Model and effort share one control. Device, folder and role share another, because they rarely change, and its tooltip names all three.
- **Disabled means reachable.** A disabled control stays in the Tab order and its tooltip says why and how to fix it.
- **The context chip names one thing:** the open card, else the open doc, else the page. It replaces v1's three chips, and the tooltip has the rest.
- **Claude's report goes on the card, folded,** under "Evidence from Claude". The card's own filled button stays the card's. The status does not move.
- **A failed check opens itself.** The step's exact output is unfolded, because that is the thing to read. Everything else stays folded.
- **Doc diffs wrap instead of scrolling sideways.** A 340 px column with horizontal scroll is unreadable for prose. "Open wider" gives a large view for a code diff.
- **Docs read the page's width, not the window's.** Behind the panel the tree moves above the reader, as it does on a phone. v5's page reads the viewport and could not do this, so this version carries a copy of the page and viewer in `parts/`.
- **No cost in dollars.** `total_cost_usd` is a client estimate, cumulative across `--resume` per S1, and means little on a subscription. Token counts are shown instead.

## Fixed from v1
- **1280 laptop:** the page no longer steps aside. The sheet gives way first, from 460 to 380 px, so 1280 keeps page 340, sheet 380, panel 429. Under about 1150 px the page still steps aside, because three readable columns do not fit.
- **`Ctrl+/` is in the shortcuts dialog,** in a new Claude panel group with the other panel keys. On a Mac `Ctrl` reads `⌘` and `Alt` reads `⌥`, in the dialog and in tooltips.
- **"Two at a time" is gone.** The mock and every string now match the real default of 1 from §9. The seeded refund run waits in line and starts by itself once PayTR's approval is answered.

## Try it
The flask icon in the panel header is prototype only. Its Scenarios section runs each case: a task that passes, a task whose check fails, a Plan turn, improve a doc, document a task with the duplicate warning, find gaps, a conflict on save, and a turn with no usage. In the address, `?wb=offline|signed_out|limit|unknown|empty|stopped` sets a state and `?wb=c-plan` or `?wb=c-scan` opens a seeded chat. Suggestions show on any idle chat, so use `?wb=empty` to see them change with the card and page.

## Honesty about the engine
Each value below is shown only if the engine reports it. **Assumption** marks what S1 did not prove, and the slice 3 engine has to meet or drop it.

| Shown | Source | Status |
|---|---|---|
| Steps, exact input, result, error | `tool_use`, `tool_result`, `is_error` | From S1 |
| Who allowed a step | `tool_result_meta[].permission_decision` | From S1 |
| Turn status, model, session, version, MCP and skills counts | `result`, `system/init` | From S1 |
| Turn usage in tokens | `result.usage` | From S1, but only when a `result` arrives |
| Usage percentage and reset time | `rate_limit_info` | From S1. A rejected event was never provoked |
| **Step duration** | The bridge timing `tool_use` to `tool_result` | **Assumption.** Not an engine field. Left out if not measured, and `c-scan` shows that |
| **Turn duration** | The bridge's clock, or a field in `result` S1's mapping does not name | **Assumption** |
| **Changed files and diffs per turn** | `tool_use_result`, or `git diff` from the bridge | **Assumption.** Edits made through Bash would be missed by the first. Hidden if unavailable |
| **Branch** | The bridge reading the folder | **Assumption.** Left out when the folder is not a repository, as in `c-scan` |
| **Usage on a stopped turn** | S1 saw `result/error_during_execution` but not whether it carries usage | **Assumption, designed for missing.** Shown here with none |
| **Per-step usage** | The engine does not report this | **Not shown anywhere.** |
| **Mode flags** | Plan as `--permission-mode plan`, Ask as read-only tools | **Assumption.** Not tested in S1 |
| **Ending a Plan turn in a plan** | The plan tool's input, or the reply's text | **Assumption.** How the bridge recognises a plan is not settled |
| **Effort selector** | A CLI flag S1 did not exercise | **Assumption.** §7.1 says "where the installed Claude Code supports them", so it can be disabled with a reason, as it is for Haiku here |
| **Model and mode change on a live process** | A restart with `--resume`, by S1's one-model-per-process flags | **Assumption.** The tooltip warns of the delay |
| **Stage reporting** | A Hub skill calling an MCP tool or emitting a known marker | **Assumption.** Nothing exists yet |
| **Follow the chat** | Seeing `mcp__hub__get_card` in the stream | **Assumption.** It only follows cards Claude reads through Hub |
| **Branch from a message** | A new chat from Hub's own copy and a summary, not a session fork | Design choice. S1 did not test forking |
| **Attaching a file** | The path is sent and Claude reads it | **Assumption.** Picks from the chosen folder, so nothing crosses devices |

## What the prototype fakes
- Every reply, tool call, output, diff, session id, version number and token count. Timings are shortened. A cold start here takes about a second, and S1 measured 8 to 10 s, which the panel still says.
- Tool names `search_docs`, `save_doc`, `get_doc` and `add_evidence` are illustrative. §10 names `save_doc`. The others do not exist yet.
- The Hub skills `/hub:do-task`, `/hub:write-doc` and `/hub:find-gaps` do not exist yet.
- Saving a doc updates this page's copy of the text only. Revisions and templates live in memory and reset on reload. Templates are meant to be stored per project on Hub.
- The gap report is fixed. "Write it" on any gap opens the same draft on doc 21.
- A doc's draft is in the doc's own language, so doc 21 stays English in the Arabic interface. An Arabic doc's diff has not been exercised.
- Model names and the list of models are a fixed list: `--model` takes aliases, and nothing in S1 lists what is installed.
- `v5`'s page grids read the viewport, so `core/workbench.css` overrides them under the panel. A real port needs container queries.
- `core/workbench.css` also holds stand-ins for a few utilities the running dev server had not compiled. They mean exactly what the utility means.

## Open questions
- Should the default mode for a new chat be Execute (as here, because D41 already pauses on anything risky) or Ask?
- Should a report from the task protocol also move the task to "in review", or stay exactly where it is, as here?
- Is one context chip enough, or does the owner want project and page visible as v1 had them?
- Explain mode on touch or a long press: is one info button enough to discover this?
