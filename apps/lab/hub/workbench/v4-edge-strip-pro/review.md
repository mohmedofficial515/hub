# Review — hub/workbench/v4-edge-strip-pro   (2026-11-06)

**Overall: 6.2 / 10. Do not port yet.** The visual language is good and the folding idea works when the panel stands alone. Five things stop approval: a keyboard trap in the sheet, rich cards the real engine cannot feed, tooltips that show the wrong control's text, an approval tooltip that covers the command, and an Arabic diff that cannot be reviewed.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 6 | Calm alone or beside Today. With a card open: six vertical zones, up to three filled buttons, and no single focal point. |
| Task flow & speed | 6.5 | Both protocols are easy to follow. The evidence is thinner than it looks, and a fixed failure erases its own history. |
| Layout & responsiveness | 7 | No overflow at any width and the sheet gives way as designed. A 340 to 409 px board is residue, and the phone's chrome takes half the screen. |
| RTL / bilingual | 7 | Chrome, keys, commands and paths are right. An Arabic document's diff is the exception, and it is bad. |
| Accessibility | 5.5 | Contrast and phone targets pass. Tab cannot leave the sheet. Tablet touch targets are 20 to 28 px. |
| Visual craft & originality | 8 | Belongs beside v5: same tokens, cards and mono keys. No coloured edges anywhere. |
| Motion & feedback | 7 | Reduced motion is honoured and there are no console errors. The composer jumps by up to 72 px at turn boundaries. |
| *Tooltips (owner's request)* | 6 | Copy is often strong. Behaviour between neighbours is broken, on touch they pop up uninvited, and some fields are misused. |
| *Honesty against the engine* | 4.5 | Most of what makes the flows look professional has no source in `TurnEvent` or the skills as built. |

Severity counts: **5 blockers, 11 major, 11 medium, 6 minor.**

---

## Blocking issues (must fix before approval)

### B1. Tab cannot leave the docked sheet (keyboard trap)
- **Where:** `core/sheet.tsx:534-546`, `Dialog.Root modal={false}` with `Dialog.Content`. Any width with sheet and panel side by side.
- **Measured:** from load at 1440, 70 presses of Tab and 22 of Shift+Tab all stayed in the sheet, looping from Close back to Claim. Page, panel and strip were never reached. Only Esc (which closes the card) or `Ctrl+/` twice (which reaches the composer) gets out, and neither is announced.
- **Why it matters:** the promise is that sheet and panel sit side by side. A keyboard user with a card open cannot Tab to an approval. Radix's non-modal dialog still loops focus.
- **Fix:** stop using `Dialog.Content` when docked. Use a plain `<section aria-label>`, or a `FocusScope` with `loop={false}`. Add `F6` to cycle page, sheet, panel and strip, and list it in the shortcuts dialog. Do not auto-focus Claim on a deep link (see M11).

### B2. The rich cards have no source in the real engine
- **Where:** `core/protocol.tsx` (all cards), `core/scripts.ts`, `core/mock.ts:303`, against `packages/contracts/src/chat.ts:134-213` and `packages/team-pack/plugin/skills/{work,doc}/SKILL.md`.
- **What is wrong:** `TurnEvent` carries text, steps, approvals, stages, a plan as a **string**, limits and the turn's end. Nothing else exists. The README's honesty table does not list the gaps below, and the owner would be approving behaviour nothing can feed.

| The prototype shows | What exists as built | Gap |
|---|---|---|
| Choice cards with buttons: proposal, duplicate, failed check, conflict | The model's reply text. The skill says "wait for my answer" | No event, so no buttons |
| Draft card with a line-by-line diff and Save | Text, then `save_doc`'s `approval.requested` holding the whole `content` | Save is really an Allow. The diff must be computed, and it has a 30 minute window the card never mentions |
| Flags with Confirm and Take out | A literal `> Unverified: …` line in the text. `answerApprovalSchema` takes only `decision` | Neither button can change what is saved |
| "Evidence from Claude", with each check's exact output | `/hub:work` writes a Markdown `hub.comment`, with "the line that shows it" | It lands in Comments, not a structured block |
| A failed check stops, then asks "Fix or note?" | The skill says to "go straight to stage 5" and write "stopped at Verify" | The report and the question are in a different order, and no event carries the question |
| "The status does not move" | The skill calls `hub.start_task` at stage 2 | The card does move, to started |
| Plan card with numbered steps and check chips | `plan.proposed { plan: string }` | No structure to render |
| Approval's effect line, "Sends 4 commits to…" (`thread.tsx:438`) | `command`, `category`, `input` | No source for the count |
| Blocked note with "Switch to Execute" | A model reply, with the tool refused | No event to attach the button to |
| Gap report, link picker | Text, then `hub.link_cards` | No event |

- **Fix, owner's choice:** (a) add one small tool in the style of `report_stage`, such as `hub.report_item`, which the skills call with `choice`, `draft`, `gaps` or `report`, and map the cards to it. Check first that a model reliably calls it. Or (b) redesign these cards as well-styled Markdown plus the real approval and a reply box. Approving v4 as it stands implies (a). Whichever is chosen, add every row to the honesty table.

### B3. Hovering a neighbour shows the wrong tooltip
- **Where:** `core/tips.tsx:228`, in the mode switch and composer row. Radix's grace area treats the pointer as travelling towards the open tooltip.
- **Measured at 1280 with the pointer resting on the control:**
  - Pointer on Plan for over a second: **Ask's text still showing**, in en at every speed tested.
  - Then on Execute: no tooltip at all (en, 1 and 6 steps).
  - Pointer on Attach, coming from Execute: Execute's text (25 steps).
  - Pointer on Templates: **Attach's text**.
  - In ar with 6 or 25 steps: Plan shows nothing.
  - The strip works, because its tips sit to the side.
- **The last fix:** there is no empty frame between neighbours, but only because the tip often does not change. "Neighbours open at once" is not true in these rows.
- **Why it matters:** the owner named tooltips, and the modes are where a wrong sentence does harm. Plan with Ask's explanation is false information.
- **Fix:** `disableHoverableContent` on the provider. A tooltip with no links does not need to stay open under the pointer. Re-test at 1, 6 and 25 steps in both directions.

### B4. In the risk moment the tooltip hides the command, and the strip does not lead to it
- **Where:** `core/thread.tsx:448-457`, `parts/layout.tsx:136-147`.
- **Measured:**
  - Hovering Allow at 1280 places an 82 px tooltip over the command. "git push origin feat/pay" disappears behind it, leaving only "tr-live", exactly as the owner is about to press.
  - With the thread scrolled up, pressing the strip's pending button or the live run does not reveal the approval (`allowVisible: false` after both). The strip's tooltip says the approval "never goes out of sight".
- **Fix:**
  - Open Allow's and Deny's tooltips below the buttons, or give them no tooltip and move the sentence ("Once only. A similar request pauses again.") into the card.
  - Pressing pending scrolls to the approval and focuses the card, and does the same on a chat that is already open.
  - Add a "Jump to approval" pill above the composer whenever a pending approval is outside the scroller.

### B5. An Arabic document's diff cannot be reviewed
- **Where:** `core/thread.tsx:40-44`, `core/protocol.tsx:273` and `:313` (`dir` is never passed). Tested by putting Arabic text into the diff in my own headless page.
- **Measured:** computed `direction: ltr`, JetBrains Mono at 14 px. Arabic is left-aligned in widely spaced monospace fallback, and a sentence's full stop lands on the wrong side.
- **Why it matters:** Hub's docs have an Arabic version, and the doc protocol says the writing follows the project's language.
- **Fix:** give each diff line `dir="auto"`. Use the body font for prose docs and mono for code files, chosen by file extension. Keep the sign column on the line's start. Keep hunk headers LTR.

---

## Calm under richness: the answer

**At rest it holds, in one case.** With no card open, the panel beside Today or Docs at 1280 is calm. Its 340 px minimum is not the problem.

**With a card open at 1280 and 1440 it does not hold.** Measured:
- Six vertical zones: sidebar rail, page, sheet, panel, strip, plus a grip.
- 27 to 33 interactive controls in the panel's viewport (v1: 16).
- Filled buttons on screen: Claim, Claim, Run this plan.
- The composer block is 179 px at rest and 251 px at a turn's end, 28% of a 900 px panel. With facts and one turn open at 800 px, the thread is 291 px.

**Fold, move or remove:**

| Item | Action |
|---|---|
| Follow, visible in every composer | **Move** to the chat menu. Show it only as a small icon when on and a card opened by itself |
| Model, Where | **Keep** one row and never wrap: truncate `Goteav-Dashboard` (this wrap alone adds 34 px) |
| Attach and Templates | **Fold** into one `+` menu |
| Suggestions | **Remove** after any turn except an empty chat's first. They add 38 px and repeat the sheet's own buttons |
| `…` on each user line and turn line | **Fold**: show on hover or focus on desktop |
| Finished protocol card | **Fold** to one line, "5 of 5 stages", opening on press. Today it stays 5 rows with notes above the report |
| "The task does not complete itself" | **Keep once.** It appears three times on screen: report footer, sheet evidence, closing reply |
| Report summary | **Remove** from either the panel or the sheet when both show the same card |
| "Open GTV-288" while GTV-288 is open beside it | **Remove**: pressing it does nothing visible |
| Page under about 520 px | **Change**: the board shows 1.5 clipped columns. Show its list, or let the page step aside with a one-press way back. v1 stepped aside at 1280 and gave the sheet 709 px, and that was calmer. Keeping the page was the v1 note's fix, but a 340 px board is not a working page |
| Do next on Today's empty panel | **Remove**: it repeats Today's own list directly beside it |

---

## Improvements

### Major

| # | Where | What is wrong and why it matters | Fix |
|---|---|---|---|
| M1 | `core/composer.tsx:639-643`, `:543` | Composer height changes 179 to 251 px between states, so the thread and every button above it jump at each turn's end. | Fixed height for the control row (see the table above), and no suggestions after a turn. |
| M2 | `core/smart.ts:53`, `core/composer.tsx:314` | The first chip after a finished report is **"Do it with the task steps"**. One press re-runs the finished task in Execute, in a new chat, directly above where the owner reaches to type. | After a report, offer "What changed?" or nothing. A suggestion that would run in Execute fills the composer rather than sending. |
| M3 | `core/scripts.ts:181`, `:187-191`, `protocol.tsx:36-59` | **Fixing a failure erases it.** After "Fix and check again" the Verify row reads "3 of 3 checks passed after the fix" and the report lists `pnpm test` Passed with no trace of the failure. The script ran only `test` and `lint`, while the tooltip promises "all three", and `typecheck` still shows its older pass. | Keep attempts: "Verify: failed once, passed on the 2nd run". The report shows each check's run, time and exit status, and links to its real step. A check not re-run says so. Correct the mock. |
| M4 | `core/protocol.tsx:159-181` | A report's Passed and its output are the model's own words, with nothing separating them from a tool result. A professional would ask "did it really run?" | Link each check to its `tool.result` step and show that step's `isError`. If no matching step exists, mark it "Reported by Claude, no matching step". |
| M5 | `core/protocol.tsx:342-358`, `scripts.ts:287`, `:297`, `:298-305`, `store.ts` draft | **Draft and conflict:** (a) Save keeps the same label with a flag unanswered, and only a tooltip says it will be saved "not verified", which breaks "a tooltip never holds the only copy". (b) A refused save still shows a check mark and "Sent to save." (c) After "Redraft", the claim the owner removed comes back open (measured: `left_out` to `open`), yet the stage says "Nothing was lost". (d) `save_doc` says "Allowed by: Your rules", though it pauses for the owner. (e) "Someone saved", in a solo product (D36). (f) Retry sits beside Redraft on the same failure. | (a) Label it "Save with 1 unverified mark" and add a line above it. (b) State "Save refused". (c) Carry decisions over when the claim's text is unchanged. (d) "Allowed by: You". (e) Name the device or source. (f) Hide Retry while a choice is open. |
| M6 | `core/scripts.ts:390-401`, `protocol.tsx:270` | **Duplicates are discouraged, but the owner cannot check the claim.** `docs/21` on the duplicate card is plain text, not a link. Nothing shows what overlaps. The similarity score (0.82) and the "3 nearby docs" sit in a folded step. Only flagged claims are visible: the other sentences show no source, so **invention is discouraged only for what Claude chooses to flag.** | Make the path a link that opens the doc. List nearby docs by name, with one line of overlap, on the Propose card. Add a "Checked against" list under the diff. |
| M7 | `core/tips.tsx:183` | **On touch, a tooltip opens by itself after any menu or dialog returns focus**, and stays. Measured on Model. The Flask tip covers the tabs in `phone-fail-end`. The `justPressed` guard exists only on the hover path. | Apply the same guard on touch, or on touch open only through Explain or a disabled tap. |
| M8 | `parts/layout.tsx:361-368`, `:394-400` | **Explain mode is not discoverable on a phone.** It is a bare ⓘ among five header icons, with no label and no hint. Once found, it works well: a tap explains, neighbours replace each other, empty space dismisses, Done restores, and a disabled tap explains without it. Same header: title and state truncate to "Waiting for your …" at 390, hiding the one state that must be read. | Show a one-time line on first panel open: "Tap ⓘ, then anything, to see what it does." Add "Explain controls" to the chat menu. Add long press as a second route. Give the state its own full-width line. |
| M9 | `core/panels.tsx:21-56`, `:45` | **Dead ends.** `signed_out` and `limit` have no action at all, and the composer is disabled, so after `claude /login` nothing lets the owner re-check. S1 says only a turn reveals signed-out, so the state cannot clear itself. With the bridge offline, **Allow stays pressable** and Stop stays shown. | Add "Check again" (`engineStatus`). Disable or re-word approvals when the bridge is gone: per "Slice 3 engine as built", a dropped socket stops the turn as `interrupted`, so that approval is dead. A `limit` clears at `resetsAt` with no press. |
| M10 | `tips-copy.ts:160-163`, `smart.ts:39`, `store.ts:416` | **Modes say less than the engine does.** Ask and Plan tips do not say that shells and other servers' tools are refused, although that is the most useful fact in them. The `in_review` suggestion is Ask yet "runs its checks", **which Ask cannot do.** No refused-step state exists. A model change says "a few seconds" against S1's 8 to 10, a mode change says nothing, and a restart after a mode change shows no Starting line (`cold` is false). | Ask: "Reads files and Hub only. No terminal, and no tools from other servers, so it cannot run tests." Move "does it meet its items?" to Execute. Design a refused step. Say "about 10 seconds", and show the Starting line on any restart. |
| M11 | `sheet.tsx:539-546`, `sheet.tsx` actions, page row | **Filled buttons.** Measured: Claim, Claim, Run this plan at once. The kit allows one per page. Focus lands on Claim on a deep link, so Enter claims. After a passing report, the card still says Ready, "Not claimed yet", filled Claim and Cancel task, beside "every check passes". | While the sheet is open, the page's row action for that card is outline. The sheet's primary follows the work: after a report, "Submit for review". Focus the sheet's title, not an action. |

### Medium

| # | Where | What is wrong | Fix |
|---|---|---|---|
| N1 | `core/composer.tsx:56`, `:246`, `:15`, `thread.tsx:83` | Sizes follow `md:`, not the pointer. Touch at 768 measured Ask 43×28, Attach 28×28, chip × 20×20, while ⓘ is shown because the device is touch. | Use `pointer: coarse` for 44 px. |
| N2 | `core/composer.tsx:246` | Chip × is 20×20 on desktop, under WCAG 2.5.8's 24 px. | 24 px. |
| N3 | `parts/layout.tsx:456` | Panel defaults open, so a phone's first visit lands on full-screen chat over the page (390×844). | Default closed on phones. |
| N4 | `parts/layout.tsx:372`, `:640`, `composer` | Phone chrome: header, tabs and the "To the card" row take about 165 px, composer 265. Thread 407 of 844, and **219** with the unknown-error notice. | Put "To the card" in the tabs row. Engine notices fold to one line with "Details". |
| N5 | `core/thread.tsx:392-395` | A long command has no limit (`commandChars` is 4000). A 300-character command is 408 of 552 px, and pinned to the bottom its **start is out of view**. Tested by injecting text. | Cap at about 8 lines with inner scroll starting at the top, plus "Show all". Highlight `--force`, `rm -rf` and `&&`. |
| N6 | `core/thread.tsx:448-457` | Allow vs Deny: identical style, 8 px apart, 36 px high (44 on phone). The words are clear and neither is pre-chosen. Enter in the composer does not answer it and focus is not taken, which is right. A stray click allows a push with no undo. | Name the act: "Allow this push". Ignore presses for 400 ms after it appears. Keep equal weight. |
| N7 | `thread.tsx:442`, contract `:87` | `timed_out` falls through to "Cancelled when the turn stopped". Other failures have no design: `version_out_of_range`, `billing`, `overloaded`, `claude_missing`, `session_missing`, `folder_not_allowed`, `folder_missing`, and `turn.status: retrying`. S3 says a version outside the range **stops the panel with a clear message**. | Add these states, reusing `failures.<code>`. Add "Denied: no answer in 30 minutes". |
| N8 | `core/tips-copy.ts` | **Weak copy, repeating the label:** `runs.state`, `strip.chat`, `turn.line` ("The turn in one line"), `tools.step` ("One step"), `stage`, whose "Depends on" is for engineers. **Fields misused:** `then` holds what is not a result (`strip.usage`, `ctx.followOn`), `needs` holds a tip (`attach`, `facts.copy`), and the fact label "Why" holds a command or chat title (`strip.run`, `strip.pending`). | Rewrite these. For a stage, give what it does and what would fail it. Add a "Detail" field. |
| N9 | `core/tips.tsx:82-130`, `composer.tsx:630` | A disabled Send's tooltip has six lines, and tells what happens on a send that cannot happen. Tallest tips are 232 px at the 320 px cap (`where`, `resize`, `strip.bridge`). Average 23 words in en and 17 in ar, with no off-screen tip and no scrolling tip. | When off, show why and fix only. Trim `resize` and `where` to two lines plus facts. Delay is good at 450 ms; delay keyboard focus by 150 ms so fast Tabbing does not flash a tip at each stop. |
| N10 | `protocol.tsx:41`, `composer.tsx:252`, `:275`, `layout.tsx:151`, `:157` | Non-interactive divs and spans are Tab stops only to carry a tip: 5 stages per protocol, chips, statuses. They have no role. Skip link goes only to main; reaching an approval from page start took 77 Tabs. | One roving stop per checklist, with a role, and add "Skip to Claude panel". |
| N11 | `strings.ts:552-553`, `:627`, `tips-copy.ts:140`, `:226` | Contradiction in one card: the queue "retries nothing by itself", then what is in line "starts after the reset". `branchNote` says "a summary", while the engine copies the words, up to 20,000 characters. | "Paused until 15:45, then it continues, oldest first." "A new chat with a copy of the earlier words." |

### Minor

| # | Where | What is wrong | Fix |
|---|---|---|---|
| L1 | `parts/layout.tsx:178` | Facts show `sonnet`, everywhere else `Sonnet`. | Capitalise. |
| L2 | `parts/layout.tsx:184` | Usage in facts repeats the strip. | Remove. |
| L3 | `core/mock.ts`, `store.ts:579`, `:591` | `/hub:do-task`, `/hub:write-doc`, `/hub:find-gaps`, `add_evidence` and `base` differ from the real `/hub:work`, `/hub:doc`, `hub.comment` and `baseHash`. | Align, so the prototype's evidence reads true. |
| L4 | Strip, Runs, Schedule, Do next, VS Code | Slices 4, 5 and 7 come after the panel. | Hide them at the port until their engine exists. |
| L5 | `core/thread.tsx:621` | `role="log"` wraps streaming text, likely chatty for a screen reader (not tested). | Announce on block completion. |
| L6 | `core/tips.tsx:78` | `navigator.platform` is deprecated. | `userAgentData` with fallback. |

---

## Flows, walked to the end

**Task, passing:** clear. The checklist updates live, the header names the stage, and "Not checked" is the most trust-building line in the design. Keep it.

**Task, failed check:** the best moment in the design. The failing step opens by itself, the exact output shows, the header says "Stopped at: Verify", and the reply does not claim success. Weakness: M3 after a fix, and B2's order against the real skill.

**Doc, improve:** propose, draft, flag, save, link all make sense, and the draft card fills the thread as one focal point. Saving with a flag open really does write "Not verified" into the page, which is right, but the label does not say so (M5).

**Doc, conflict:** refuses safely and shows exactly what changed (48 to 72). The diff of the other change is good. Weak in M5's (b), (c), (e) and (f).

**Doc, duplicate:** "Update the existing doc" is filled and "Write a new doc anyway" is outline, with the word *anyway*. Good. The warning stays in the stage note. Weak in M6.

**Gaps:** "Write it" on any gap opens the same doc (a known fake). "I did not read the rest of `src/`" is excellent, and it should be above the list.

---

## The last fixes, re-measured

| Fix | Result |
|---|---|
| 44 px: mode buttons at 390 | **Pass.** Ask 44×44, Plan 47×44, Execute 70×44 |
| 44 px: Follow at 390 | **Pass.** 44×44 |
| 44 px: title at 390 | **Pass.** 144×45 |
| 44 px: Do next rows at 390 | **Pass.** All 44 high |
| Same targets on touch at 768 | **Fail**, N1 |
| Empty frame between neighbouring tooltips | **Not the real problem.** No empty frame, because the tip stays stale. B3 |
| Follow takes no focus into the sheet | **Pass.** Sheet opened, focus and typed text stayed in the composer |

## Rules checked

| Rule | Result |
|---|---|
| No coloured side or top edge | **Pass.** Computed-style scan in four language and theme pairs on the failed flow found only v5's tab underline. No matching class in source |
| Keys, commands, paths LTR | **Pass** in the chats scanned, except B5, which concerns prose |
| Contrast | **Pass.** Lowest panel text 5.14:1 (Error, light). Lowest in dark 5.23:1. Strip 5.37:1 |
| Horizontal overflow | **Pass** at 390, 768, 1280, 1366, 1440 |
| Console errors | **None** in any run |
| Layout shift | CLS 0.025 in the longest flow. Fine, though M1 is visible |
| Reduced motion | **Pass.** No running animation with the preference set |
| Tooltip keyboard | Opens on focus, focus never enters, Esc closes |

## Open questions

- **New chat default: Execute.** Keep it. Ask refuses the terminal, so it cannot do most real work, and changing mode later costs a restart of about 10 seconds. D41 already pauses on what is risky. The Mode row keeps it in view. Explain on a card still starts in Ask. Condition: M2, so no suggestion fires in Execute.
- **Report moves the task to In review: no, leave it.** The skill allows `submit_task` only when asked, and the owner confirms the work. But the card must react: after a passing report its filled button becomes "Submit for review" (M11). Correct the README: the skill does move it to started.
- **One context chip: enough.** Add project to the chip only when the chat's project differs from the page's, and add a Project row to chat facts, because the tooltip must not be the only copy.
- **Two filled buttons beside Today: acceptable, in one case only.** The panel may be filled only while it owes the owner an answer, because Today's Decide and Run this plan answer different questions in different panes. Never three, and never the same action twice (M11).
- **One info button for Explain: not enough** (M8).

## What is better than baseline (v1)

- The turn line and two-press evidence give much more detail with the thread still dominant at rest (556 px in v1 and about 568 px here at 800 px high).
- Modes are always visible and each has a key. v1 had nothing like it.
- Failed-check flow, "Not checked" and flags are a real step up in honesty.
- Disabled controls stay reachable and explain themselves.
- **Worse than v1:** 16 panel controls became 27 to 33. At 1280, v1's sheet had 709 px with the page aside, while v4 keeps a 340 px board and gives the sheet 380.

## Fit with Hub

It belongs. Same tokens, card recipes, type sizes, keys, and the sidebar colour on the strip. At 1280, 1366 and 1440 it reads as Hub, not a widget. Two rails with unlabelled icons on opposite edges is the one foreign note. The sheet's "With Claude" row sits well.

## Not checked

- Real screen readers, real phones or real touch hardware (emulated touch only).
- Real engine: everything here was on mock data, compared with the contract and skills by reading.
- Drag to resize, drag a card in, slash menu keyboard, History, Runs actions, Schedule, VS Code dialog, branch, export, templates.
- Compact tooltip level and Mac key labels.
- Blocked note in Ask: read in code, not seen on screen. My second message was ignored because the first turn was still running.
- Long commands and Arabic diffs were tested by editing text in my own headless page, not from a scenario.
- Light and dark were not captured at every width in every state: core layouts and flows were, in mixed pairs.

## Screenshots

Kept outside the repository, under `C:\Users\MOHMED~1\AppData\Local\Temp\claude\b4558443fa0fb976\8321ad0c-531e-486e-8e1a-71bcfdf0f2e3\scratchpad\ux-v4\shots\`. Most useful:

- `a-1440-card-paytr-ar-dark.png`, `f-plan-1280-en-1.png`: calm with a card open, three filled buttons
- `v1-1280-card-en-light.png`: v1 baseline
- `tip-stale-ask-on-plan-1280-en-light.png`: B3
- `approval-allow-tip-1280-en-light.png`: B4
- `arabic-diff-1440-dark.png`, `arabic-diff-390-light.png`: B5
- `fail-end-1280-en-light.png`, `fail-fix-report-tall-en-light.png`: failed check, then its erased history
- `doc-draft-1280-en-light.png`, `conflict-1440-en-dark.png`, `doc-duplicate-1280-en-light.png`: doc flow
- `phone-explain-mode-tip-ar-dark.png`, `phone-fail-end-ar-dark.png`, `state-unknown-390-en-light.png`: phone
- `state-signed_out-1440-ar-dark.png`: dead end, with Allow still live
- `approval-long-cmd-1280-ar-dark.png`, `tablet-touch-768-en-light.png`, `rich-all-open-1280-en-light.png`
