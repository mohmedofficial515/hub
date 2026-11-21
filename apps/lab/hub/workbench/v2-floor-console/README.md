---
version: v2-floor-console
title: Floor console
status: review
base: today/v5-peacock-app
created: 2026-11-06
tokens: inherit
touches-components: [apps/web/src/components/shell/shell.tsx, apps/web/src/components/shell/header.tsx, apps/web/src/components/cards/card-sheet.tsx (non-modal, height follows the console), apps/web/src/components/cards/card-row.tsx (drag), apps/web/src/components/common/toast.tsx (position), new components/workbench/*]
ported:
---

# Floor console

**The bet:** the chat takes height, never width. Pages keep their full layout, and chats and runs sit together under the work, like VS Code's panel.

**What it gives up:** vertical room. At 1440 x 900 the page keeps about 520 px, and the conversation shows about 250 px at a time, so a long reply or an approval prompt means scrolling. A short laptop screen feels this most.

## Idea
The console lies on the floor of the page, under both the page and the card sheet, and pushes the content up. It has three columns: a tray with what travels with the next message, the conversation at reading width, and runs beside it. Chats are tabs along the top, each with its state, so several running chats read at a glance. When it closes, it becomes a status bar: approvals waiting, what is running, what is next.

**The signature:** drag any card from the page onto the console, and it joins the next message. "Add a card" does the same from the keyboard, with the kit's card picker.

## Key decisions
- **Size.** Drag the top edge for height, and the column grip for the runs width. **This differs from your brief:** the console has a remembered height, not a remembered panel width, and the runs column has the remembered width. Both are per device.
- **Key.** `Ctrl+/` (`Cmd+/`) closes to the status bar and reopens, even while typing.
- **Beside the sheet.** The sheet stops at the console's top edge, so neither covers the other, at every height.
- **Phone.** Full screen, with tabs for chat, runs, next and history. Closed, the status bar sits at the bottom, within reach of a thumb.
- **Narrower than 1180 px.** The tray folds into the conversation column, and pickers move to the composer.
- **Runs always visible.** There is no separate queue view to open: the third column is the queue's short form. A chat tab, its run row and the status bar all show the same waiting state.
- **Approval, context, states:** the same as the other directions. Allow once and Deny carry equal weight.

## Try it
The flask icon in the console's tab bar is prototype-only. It switches states and starts the examples. `?wb=offline|signed_out|limit|unknown|empty|stopped` also works. To test the signature: Tasks page, drag a card onto the console.

## Built on
`core/` is the same in the three directions, copied so each stays self-contained. v5's kit and pages are imported through `core/kit.ts`, and v5 is unchanged. This direction's own layout is in `parts/layout.tsx`.

## What the prototype fakes
- **Timing.** A cold start takes about a second here. S1 measured 8 to 10 s with approvals on.
- **Signed out.** Shown at once here. A real panel may only know after a message fails (S1 Q8).
- **Usage limit.** The rejected event was never provoked in S1.
- **Approvals on other devices.** Stated, not real. Stop during a pending approval was not tested in S1.
- **Slash menu.** A fixed list. The real one arrives with `init.skills`, after a process starts.
- **Persona.** Only filters "Next" and records on the chat.
- **Dragging.** It reads the card key from the row's link, and that link only drags with a mouse. Touch has only "Add a card".
- **Tool names.** Some `mcp__hub__*` names are illustrative.

## Open questions
- Is the conversation tall enough on your real screen? This is the question that decides this direction.
- Should pinned cards clear after one message, as here, or stay until removed?
- Should tabs be all recent chats, as here, or only the ones you opened?
