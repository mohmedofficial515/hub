---
app: hub
page: workbench
route: every page of /[locale]/[ws]/ (the panel lives in the shell)
live-url:
sources:
  - F:/Goteav/hub/docs/16-workbench.md §1, §7, §8, §9, D36 to D48, S1 findings
  - apps/lab/hub/today/v5-peacock-app/ (approved shell, kit and pages)
  - apps/web/src/components/shell/shell.tsx, apps/web/src/components/cards/card-sheet.tsx
status: designing
---

# Hub — Claude Code panel

## Purpose
Hub is the owner's workbench, and the owner spends all day in it. The panel lets them talk to the official Claude Code on their own machine, through the local bridge, from any page: discuss and explain tasks, add tasks, plan, redesign and execute, with real permissions. D48: three clearly different directions as working prototypes, and the owner picks one before the port.

## Problems this page must solve
- Work happens in Hub, and the conversation about it happens somewhere else, without the card or the page in view.
- A run that waits for an approval is invisible until someone looks for it.
- Sending a task to Claude means retyping what Hub already knows.

## Goals
- The chat sits beside the work and the card sheet, and neither covers the other.
- "Explain this", "plan this" and "redesign this" work from where the owner is, without retyping.
- An approval shows the exact command, and reaches the owner wherever the panel is.
- Queued and scheduled runs connect to the chat they belong to.
- Every state is honest: bridge offline, Claude signed out, usage limit, turn stopped, empty.

## What the engine can really do (docs/16 S1)
- The first reply on a new process can take 8 to 10 s with approvals on, then about 1 s. The panel says so.
- Thinking is a state, with no text to show. Tool activity, approvals and stop are real events.
- The VS Code link only pre-fills, and the owner presses Enter. Hub can say "sent to VS Code", not "opened".
- A VS Code handoff is a new chat from a Hub summary and the card key, not this session.
- Sessions live on the device, so changing device starts a new chat from a Hub summary.
- `update_project` on `repoPaths` always pauses for approval (D46).

## Constraints
- RTL (Arabic default) + LTR, light + dark, 390 / 768 / 1440. Keys, commands and paths stay LTR. WCAG AA.
- v5's tokens, Cairo for Arabic, spacing, focus, keyboard and Undo. No coloured side or top edge on anything.
- Mock data only. The prototype's menu (flask icon in the panel header) switches states and starts the sensitive examples.

## Versions
| Version | Bet | Status |
|---|---|---|
| v1-edge-strip | The work stays the page. The chat is a companion pane that closes into a strip which never hides what waits for you | review |
| v2-floor-console | The chat takes height, never width. A console under the work, with chats as tabs and runs always beside them | review |
| v3-conversation-desk | The conversation is the page. The work comes to it, on a stage it controls | review |
| v4-edge-strip-pro | v1 extended with docs/16 §7.1: three depths of detail, strong tooltips, both protocols. Independent review scored 6.2 with 5 blockers | review |
| v5-edge-strip-final | The version to approve. v4 with its review fixed: one focal point with a card open, structured results from §7.2 with verified against claimed, and tooltips that behave | review |
| v6-edge-strip-port | v5 with its review fixed and D54's rule: the page's fate follows the page. Ported directly under D55 | approved |
