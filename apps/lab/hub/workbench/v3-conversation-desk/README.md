---
version: v3-conversation-desk
title: Conversation desk
status: review
base: today/v5-peacock-app
created: 2026-11-06
tokens: inherit
touches-components: [apps/web/src/components/shell/shell.tsx, apps/web/src/components/shell/header.tsx, apps/web/src/components/shell/sidebar.tsx, apps/web/src/components/cards/card-sheet.tsx (non-modal, inside the stage), every page under components/* (must fit a pane of 340 px and up), new components/workbench/*]
ported:
---

# Conversation desk

**The bet:** when Claude does much of the work, the conversation is the page, and Hub's pages and cards come to it.

**What it gives up:** Hub as you know it, while you are on the desk. The sidebar stays at icons, the header goes, and every page lives in a pane of about 560 px. Overviews such as the Tasks board lose the most. It is also a mode you enter and leave, not something simply there.

## Idea
The desk has three zones. **The river** at the start is runs and chats in one list, ordered by what wants you: what needs approval first, then what is running, then chats by project. There is no queue to visit. **The conversation** is the centre, at reading width. **The stage** at the end holds the real Hub page or card, chosen by its own menu or by the chat.

**The signature:** the stage follows the conversation. Open a chat about a card and the card comes to the stage. "Follow the chat" turns that off.

`Ctrl+/` leaves the desk for normal Hub, keeping your page and card, and comes back. Normal Hub then shows "To the desk" in the header, with the approval count.

## Key decisions
- **Size.** Drag the grip between the conversation and the stage, or arrows on it. **This differs from your brief:** what you resize and what is remembered is the stage's width, because the conversation takes the rest. A button hides the stage entirely for a full-width conversation, and that is remembered too.
- **"Close".** Here closing means leaving the desk. The chat is not hidden beside the page, so there is no chat beside a page in normal Hub. Asking Claude from the card sheet brings you back to the desk.
- **The sheet.** A card sits in the stage. When the stage is 920 px or wider, the page and card sit side by side. Narrower, they are two tabs. Neither covers the conversation.
- **Phone.** Three tabs at the bottom: chat, what is going on, and work. The work tab is named after the open card.
- **768 px.** Conversation and stage side by side, and the river takes the conversation's place through a switch.
- **Approval, context, states:** the same as the other directions. The context chips read from the stage.

## Try it
The flask icon in the conversation's header is prototype-only. It switches states and starts the examples. `?wb=offline|signed_out|limit|unknown|empty|stopped` also works. To test the signature: click "Explain Moyasar fees" in the river.

## Built on
`core/` is the same in the three directions, copied so each stays self-contained. v5's kit and pages are imported through `core/kit.ts`, and v5 is unchanged. This direction's own layout is in `parts/layout.tsx` and `parts/river.tsx`.

## What the prototype fakes
- **Page fit.** The biggest gap here. v5's pages read the viewport, and `core/workbench.css` overrides their grids for the stage. Some pages still keep desktop rules at this width. A real build needs every page moved to container queries, the largest port of the three.
- **Timing.** A cold start takes about a second here. S1 measured 8 to 10 s with approvals on, and it is more noticeable when the conversation is the whole focus.
- **Signed out.** Shown at once here. A real panel may only know after a message fails (S1 Q8).
- **Usage limit.** The rejected event was never provoked in S1.
- **Approvals on other devices.** Stated, not real. Stop during a pending approval was not tested in S1.
- **Slash menu.** A fixed list. The real one arrives with `init.skills`, after a process starts.
- **Persona.** Only filters "Next" and records on the chat.
- **Follow.** It reads the card from the chat's first message. A chat that moves between cards would need a rule for which one wins.
- **Tool names.** Some `mcp__hub__*` names are illustrative.

## Open questions
- How much of your day is talking to Claude, compared with reading Hub's pages? This decides this direction.
- Should the desk replace the sidebar's pages with the stage menu, as here, or keep them?
- Should a reply that mentions a card move the stage as well, or only opening a chat?
