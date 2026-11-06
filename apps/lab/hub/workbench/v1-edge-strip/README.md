---
version: v1-edge-strip
title: Edge strip
status: review
base: today/v5-peacock-app
created: 2026-11-06
tokens: inherit
touches-components: [apps/web/src/components/shell/shell.tsx, apps/web/src/components/shell/header.tsx, apps/web/src/components/cards/card-sheet.tsx (non-modal, docked), apps/web/src/components/common/toast.tsx (position), new components/workbench/*]
ported:
---

# Edge strip

**The bet:** the work stays the page, and the chat is a companion you can always get to. It closes into a strip that never hides what waits for you.

**What it gives up:** width. At 1440 with a card open the page keeps about 400 px, and Hub's lanes stack to one column. Long replies and code read in a column of 340 to 720 px.

## Idea
This is the panel docs/16 §7 describes, with one idea added. The panel docks at the inline end of the page (left in Arabic, right in English) and pushes the content. When it closes, a 52 px strip stays at the edge. The strip is also the panel's own toolbar: chat, history and runs, then one icon per live run, then a count of approvals waiting. Closing the panel never costs you an approval.

The order at the edge is always page, card sheet, panel, strip. The sheet is the approved one, made non-modal, so nothing covers anything.

## Key decisions
- **Size.** Drag the grip, or arrows on it when focused. Home and End go to the limits, and Enter or double-click resets. 340 to 720 px by default, and never so wide that the page drops under 340 px. Remembered per device in `localStorage`.
- **Key.** `Ctrl+/` (`Cmd+/`) closes and reopens from anywhere, even while typing, and on an Arabic layout. A single letter would not work inside the composer.
- **Both panes open.** The sidebar folds to icons and returns afterwards. Below about 1300 px at the default panel width the page steps aside, and the sheet and panel share the width.
- **Phone.** The panel is full screen, opened from a header button with the count. A card is full screen too, with "To the chat" and "To the card" between them.
- **Approval.** Allow once and Deny carry equal weight, and neither takes focus by itself. A sensitive action should not have a pre-chosen answer. Enter in the composer can never approve.
- **Context.** Chips say project, page and card, and they follow the route. "This" means the open card, otherwise the page. The same actions are on the card sheet. Each starts a new chat, because a chat runs one turn at a time.
- **Runs.** Live runs are in the strip. The runs view lists needs you, running, next, scheduled and recent, with Pause, Cancel and Undo. Run now and Schedule are on "Next" suggestions.

## Try it
The flask icon in the panel header is prototype-only. It switches states (offline, signed out, limit, unknown error, empty) and starts the examples (`git push`, a change to the allowed folders, a created card, a long reply to stop). `?wb=offline|signed_out|limit|unknown|empty|stopped` also works in the address.

## Built on
`core/` is the same in the three directions, copied so each stays self-contained: the mock engine, thread, composer, pickers, runs, history, the docked sheet and the shell's plumbing. v5's kit and pages are imported through `core/kit.ts`. v5 itself is unchanged. This direction's own layout is in `parts/layout.tsx`.

## What the prototype fakes
- **Timing.** A cold start takes about a second here. S1 measured 8 to 10 s with approvals on, and the panel says so while starting.
- **Signed out.** Shown at once here. S1 found `init` cannot show it, so a real panel may only know after a message fails.
- **Usage limit.** The rejected event was never provoked in S1, so the wording and reset time are from the docs.
- **Approvals on other devices.** The text says so, and nothing crosses devices here. The expiry time is fixed. Stop during a pending approval was not tested in S1.
- **Slash menu.** A fixed list. The real one comes from `init.skills`, which only arrives once a process has started, so the first menu in a folder needs a cached list.
- **Persona.** Here it only filters "Next" and records on the chat.
- **Page fit.** v5's pages read the viewport, so `core/workbench.css` overrides their grids under the panel. A real port needs container queries in those pages.
- **Tool names.** Some `mcp__hub__*` names in the transcript are illustrative.

## Open questions
- Is about 400 px of page enough with a card open, or should the sheet replace the page at that point?
- Should "Run now" ask for the folder, or trust the card's repository as it does here?
- `Ctrl+/` is not in the shortcuts dialog yet, because that dialog belongs to v5.
