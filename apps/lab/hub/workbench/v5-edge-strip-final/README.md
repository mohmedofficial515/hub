---
version: v5-edge-strip-final
title: Edge strip final
status: review
base: v4-edge-strip-pro
created: 2026-11-06
tokens: inherit
touches-components: [apps/web/src/components/shell/shell.tsx, apps/web/src/components/shell/header.tsx, apps/web/src/components/shell/shortcuts-dialog.tsx (F6, panel keys), apps/web/src/components/cards/card-sheet.tsx (a plain region when docked, title focus, evidence, primary steps down while the panel owes an answer), apps/web/src/components/common/toast.tsx (position), docs page (doc bar, revisions, width from the page not the window), new components/workbench/*]
ported:
---

# Edge strip final

**The bet:** v4's richness was right and its noise was not. With a card open, one thing on screen asks for something, everything else folds, and every result says whether Hub verified it or Claude only claimed it.

This is the version D49 names for the owner's final approval. `review.md` in `v4-edge-strip-pro` is the brief, and §7.2 of `docs/16-workbench.md` is the data contract.

## Idea
The layout is still v1's: page, card sheet, panel, strip. Three things changed the feel.

**One focal point with a card open.** Under about 520 px the page is residue: a board shows 1.5 clipped columns. So at 1280 and 1440 with a card open the page steps aside, with a labelled **Back to Tasks** where Close was, and the sheet takes the room. It stays at 1600 and wider. The strip and the rail stay.

**A composer that never moves.** Three rows inside one box, with nothing outside it: what goes with the message, the text, then `+`, the modes and Send. Follow moved to the chat menu, Attach and Templates folded into `+`, and suggestions moved out of the composer altogether, into the empty chat. Its height is the same at rest, starting, running, waiting and at a turn's end.

**Truth in results.** A report's checks read **Verified by Hub** or **Claimed by Claude**, linked to the real step, and a check keeps every run it had. A report that says a failed step passed is refused and reaches nothing. The card moves by itself only under D52's rule, and the report says plainly that it moved, or why it did not.

## Key decisions

### Calm
| Item | What happens now |
|---|---|
| Filled buttons | At most one on screen with a card open. The sheet's primary steps down to outline while the panel owes an answer, and the page's row buttons are outline while a card is open |
| Finished protocol | One line, "5 of 5 stages", opening on a press |
| "The task does not complete itself" | Once, in the report's move line |
| Report summary | In the panel. The sheet's evidence row is one line of counts: "3 of 3 verified by Hub, 2 files" |
| Checks all verified on the first run | Fold to that line. A failure that was fixed keeps its list open, because it is the part to read |
| "Open GTV-288" | Gone while GTV-288 is open beside it |
| `…` on a message or turn | On hover or focus on desktop. Always there on touch, which has no hover |
| Suggestions | Only in an empty chat, as its body. Never after a turn |
| Do next | In Runs only. It repeated Today's own list beside it |
| Engine notice | One line with Details on a phone, open on a wider screen |

### Phone
Closed on first visit, so a phone lands on the page. The sheet's top bar is always **To the chat**, with the pending count when an approval waits, because a phone has no strip and the sheet covers the page's header. To the chat goes straight to the approval. To the card sits in the tabs row. The page behind is `inert`.

### Keyboard
The docked sheet is a plain `<section>`, not a Radix non-modal dialog, which still loops focus. Tab runs straight through page, sheet, panel and strip. `F6` moves between the regions, and is in the shortcuts dialog. A second skip link goes to the panel. A deep link focuses the card's title and not an action, so Enter claims nothing, and the ring on the title shows only when moving by keyboard. Esc closes the sheet only while focus is inside it.

### Approvals
- **The effect line and the pause reason are looked up from the D41 `category`** (§7.2), never model text. "Sends 4 commits" is gone.
- **Allow and Deny have no tooltip.** A tooltip there covers the command at the moment that matters. What it would say is a sentence in the card.
- **The act is named:** "Allow this push". Equal weight, and presses in the first 400 ms are ignored.
- **The strip's pending button and the live run reveal and focus the approval,** on a chat already open and from a closed panel. Focus lands on the card, never on Allow, and Enter on the card answers nothing. A **pill** appears when Allow and Deny are outside the thread.
- **A dropped bridge kills the approval,** as the engine does: Allow is gone, and the card says the turn ended and the command never ran. Stop is gone too. Any other turn failure does the same.
- **A long command** is capped at about 8 lines with inner scroll starting at the top, plus Show all. `--force`, `rm -rf`, `&&`, `sudo` and `docker compose` are underlined and bold.

### Tooltips
`disableHoverableContent` on the provider, because a tip holds no links, so a neighbour always shows its own text. Keyboard focus waits 150 ms so fast Tabbing flashes nothing. **On touch a tooltip never opens by itself:** only Explain mode, a long press, or a tap on a disabled control opens one, so a dialog returning focus cannot pop one up. A control that is off shows only why and how to fix it. `then` holds only what a press does, `needs` only a dependency, and a new `detail` holds anything else. Ask and Plan say shells and other servers' tools are refused.

Touch has four routes to the same text: a one-time hint, **Explain** with a visible label, the chat menu's Explain controls, and long press. A long press on a menu trigger opens the menu instead, because Radix opens it on pointer down; its items carry their own second line.

Touch targets follow `pointer: coarse`, not the width, so 768 on a tablet gets 44 px.

### Arabic diff
Each line has its own `dir` from its first strong letter, with its sign at the line's start. A prose doc (`.md`, `.mdx`, `.markdown`, `.txt`) uses the body font and Cairo for Arabic, a code file stays mono, and a hunk header stays LTR and mono. The **Improve an Arabic doc** scenario shows Arabic and English lines side by side.

### Modes and defaults (D51, D53)
A new chat is Execute. Anything that would run in Execute or Plan fills the box and sets its mode, and waits for Send. A read-only suggestion runs on a press, and its row says "Runs now, Ask", as the contract's `onPress` allows. The sheet's **Run it in steps** says plainly that it runs. A mode, model or effort change restarts Claude, with a Starting line that gives the reason and counts seconds, at S1's realistic 8.5 s.

## Try it
The flask icon in the panel header is prototype only. **States** covers all 13 engine states. **Try** starts a push, a repo change, a card, a long reply, a long command and a retry. **Scenarios:** a task that passes, fails, has an unverified claim, or files a report Hub refuses; a plan with and without structure; a timed-out approval; Ask refusing the tests; improve, document (the duplicate warning), gaps, conflict, and an Arabic doc.

In the address: `?wb=offline|signed_out|limit|unknown|version_new|version_old|claude_missing|billing|overloaded|session_missing|folder_not_allowed|folder_missing|unreadable|empty|stopped`, or a seeded chat: `?wb=c-plan|c-plan-text|c-expired|c-invite|c-scan`. `?wbfast=1` shortens the start to about a second, for walking the flows.

## Data contract
Field names follow `packages/contracts/src/chat.ts` as committed on 2026-11-06 (`c48c2b1`, `f852c3d`), read again near the end of this work, and "§7.2 as built" in docs/16. The store does what the server does with `report_work`: a check's `command` finds its runs, the last run decides, and a contradiction refuses the report. So a claim cannot verify itself even in the mock. Strings the contract types as `string` are `{ ar, en }` here only because the prototype renders both languages.

| Shown | Field | Source |
|---|---|---|
| Report | `workReportSchema`: `id`, `cardKey`, `origin`, `chatId`, `summary`, `checks`, `changedFiles`, `filesFrom`, `notChecked`, `droppedChecks`, `counts`, `move`, `reportedAt` | Contract. `messageId` is left out |
| Check | `reportedCheckSchema`: `name`, `command`, `stepId`, `outcome`, `note`, `verified`, `basis`, `runs` | Contract |
| A check's runs | `checkRunSchema`: `stepId`, `status`, `startedAt`, `endedAt`, `excerpt` | Contract. A failure stays after a later pass. No exit code exists, so the words are Passed and Failed |
| Why it moved or stayed | `move.reason`, each of `REPORT_MOVE_REASONS` has its own sentence | Contract. Only `all_verified` moves |
| Refused report | `report.refused`: `cardKey`, `checks[{ name, stepId }]` | Contract. Nothing reaches the card |
| Plan | `plan.proposed`: `plan` (text) and `structured` (`title`, `steps[{ title, role?, why? }]`, `checks?`, `risks?`) | Contract. With no `structured`, the text shows and can still be run |
| Questions | `question.asked`: `header`, `text`, `multiSelect`, `options[{ label, description? }]`, and `status` | Contract. **Assumption:** which option is filled. A real question has no recommended option |
| Question's extras | `variant`, `diff`, `changedOn` | **Assumption.** The panel's own, from Hub's data. The conflict's diff and "changed on disk" have no field yet |
| Draft | `chatDocDraftSchema`: `docKey`, `source`, `path`, `title`, `reason`, `baseVersion`, `duplicates`, `claims`, `status`, `refusedCode`, `savedVersion` | Contract. `lines` is the computed diff, and `saving` is the panel's moment between pressing Save and the new status |
| Flag answers | `confirm`, `remove`, `keep_flagged`, with `> Unverified: ` written on its own line, in the preview too | Contract. Save is Allow on `save_doc`, and refuses with a flag open |
| Duplicates | `docDuplicateSchema`: `key`, `title`, `source`, `path`, `url`, `overlap`, on the draft | Contract. The server finds them, so the warning is on the draft and not on an earlier question |
| Effect line | `APPROVAL_EFFECTS` by `category`, word for word in English, translated in Arabic | Contract |
| Pause and Allow's verb | Looked up from `category` | **This version's wording** |
| Approval | `approvalId`, `toolName`, `command`, `category`, `expiresAt`, `status` | Contract |
| Allowed by | `decision`: `config`, `user_temporary`, `user_reject` | Contract |
| Blocked note | `tool.blocked`: `name`, `command`, `mode` | Contract |
| Starting line | `turn.starting`: `reason` of `new`, `resume`, `mode`, `model`, `effort`, `folder` | Contract. `folder` has no path in the prototype |
| Retrying line | `turn.status` with `retrying`, `attempt`, `retryInMs` | Contract. The shown numbers are fixed here |
| Engine states | `TURN_FAILURES`, `engine.warning`, D53, S1 Q8 | Contract. `unreadable_event` offers Open in VS Code |
| Check again | `GET chats/engine?fresh=true`, `honestStateOf` | Contract and docs/16. A check clears a signed-out block and says sign-in shows with the next message |
| Suggestions | `ChatSuggestion`: `mode` and `onPress` | Contract's shape. **Assumption:** the rule here is simply Ask runs and the rest fill, and these labels are not its ids |
| Project on the chip | The chat's project against the page's | §7.1 |

Values kept from v4 with no new source: step and turn durations, changed files from the bridge, branch, usage. See v4's README for their status. Effort labels stay Low, Medium, High, though the contract also allows `xhigh` and `max`.

## What the prototype fakes
- Every reply, tool call, output, diff, session id, version number and token count. Only the start's 8.5 s is realistic, and the other timings are shortened.
- **`Check again`:** the first press finds the same state, and the second clears it, so both answers can be seen. A real limit clears at `resetsAt` with no press.
- **Answers to flags** change this page's copy of the text only. Revisions and templates live in memory.
- **The Arabic doc's scenario** has no card, so it saves nothing to a page.
- **"Write it" on a gap** starts a canned draft on a named doc: the gap's text is not used.
- **A card's move** uses the v5 card store. Its event is marked as the agent's through a patch after the action, because the store only writes user events.
- **Page row buttons going outline** while a card is open is a CSS override of v5's pages, which this version must not edit. A real port passes the variant as a prop. v5's pages also read the viewport, as in v4.
- Model names are a fixed list, and the persona, device and folder lists are mock.

## At the port (review L4)
The strip's run icons, Runs, Schedule, Do next and the VS Code dialog depend on slices 4, 5 and 7, which come after the panel. Hide them until their engines exist.

## Left from the review, and why
| Item | Why |
|---|---|
| B2's option, as a whole | Decided: D50 chose to give the cards real sources, and §7.2 specifies them. The engine work is another agent's. Every row above says where each value comes from |
| N10: a Tab stop on a run's status icon | Removed rather than made roving. Its facts ride on the run's action, which is a Tab stop. Hover still shows them on the icon |
| L5: real screen reader behaviour | Done in code: the log no longer announces streaming, and a live region announces finished blocks. Not tested with a real screen reader |

## Open questions
- **Should a report that moved a task offer Undo?** D52 says the owner completes the task. Send back is on the card as Hub's existing action, so this version adds no Undo.
- **A question has no recommended option in the contract.** Here the first answer is filled. The port needs a rule, or both stay outline.
