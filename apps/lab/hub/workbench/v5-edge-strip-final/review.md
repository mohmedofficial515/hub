# Review — hub/workbench/v5-edge-strip-final   (2026-11-06)

**Overall: 7.7 / 10 (v4: 6.2). Do not port yet.** All five v4 blockers are really fixed, and the calm, the tooltips, the keyboard and the honesty are now good. The new problems are mostly in the layout change and on the phone. Three things stop approval: a page that disappears or shrinks to residue depending on the window width when the panel is closed, a phone button that drops you on another chat's approval, and a step-aside that also hides pages which work fine at 1440.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8.5 | One filled button in every state I walked. The panel owes one thing at a time. |
| Task flow & speed | 7.5 | Task and doc flows read very well. Moving between cards got slower at 1280 to 1440, and acting on a card closes it. |
| Layout & responsiveness | 6 | No overflow anywhere. The step-aside rule is width-only, wrong with the panel closed, and fires by itself through Follow. |
| RTL / bilingual | 8.5 | The Arabic diff is fixed, and keys and commands stay LTR. A few Arabic terms collide. |
| Accessibility | 8 | The trap is gone, and F6 and the skip link to the panel work. One dead skip link, one invisible Tab stop, an 8 px grip on touch. |
| Visual craft & originality | 8 | Belongs beside v5. No coloured edges. The stepped-aside sheet at 1440 is half empty. |
| Motion & feedback | 8 | The composer never moves (120 px in every state). The sheet's content still jumps about 100 px twice in a flow. |
| *Tooltips (owner's request)* | 8.5 | Neighbours are right in every test, touch no longer pops them up, the copy is strong. One reproduced miss, and five Arabic wording fixes. |
| *Honesty against the engine* | 7.5 | Field names match the contract and a refused report is exemplary. "Verified by Hub" never states the real limit, and questions are not ready for real data. |

**Severity counts: 3 blockers, 9 major, 16 medium, 7 minor.**

Everything was measured in my own headless Chromium on the mock engine. Screenshots stay outside the repository (see the end).

---

## Blocking issues (must fix before approval)

### B1. With the panel closed, the page's fate depends on the width in the wrong direction
- **Where:** `parts/layout.tsx:575-583`. `sidebarW` is guessed from `vw >= 1280`, using `clientWidth`, so a 1280 window (1265 with the scrollbar) assumes a 56 px rail while the real sidebar is 248. `pageHidden` also applies with the panel closed.
- **Measured, card open, panel closed:**

| Window | Sidebar | Page | Sheet | Close control |
|---|---|---|---|---|
| 1280 | 248 | **405 px, clipped board** | 560 | ×, because the rule thinks the page has room |
| 1366 | 248 | **hidden** | **1051 px** | Back to Tasks |
| 1440 | 248 | 565 | 560 | × |

- **Why it matters:** a wider window shows less. 1280 keeps exactly the residue this version set out to remove, and at 1366, the common laptop, someone who does not use Claude at all loses the board when opening any card, and gets a 1051 px sheet holding a 736 px column. The sheet's own accessible note says "The page comes back when you close the card or the panel", which at 1366 is false.
- **Fix:** use the real sidebar width. Step aside only while the panel is open: with it closed, keep v5's own page and sheet behaviour.

### B2. On a phone, "To the chat" and the Claude button leave your chat for another chat's approval
- **Where:** `parts/layout.tsx:666-670` and `:718-723`, both calling `revealApproval(firstWaitingChat)`.
- **Reproduced every time at 390, ar and en:** running "Document this task", with its draft on screen: To the card, then To the chat. Result: the title changes to "Run: PayTR adapter", the draft is gone, and focus lands on **Allow this push** for `git push origin feat/paytr-live`, with the composer still showing `GTV-275`. A wait for the draft then times out. See `p10-tochat-wrong.png`.
- **Why it matters:** the owner tapped "back" and is looking at a push approval from another run, under a chip for a different card. It is the riskiest moment in the product, reached by accident. The only way back to their own chat is History.
- **This is the cause of the unexplained 390 Arabic timeout (focus item 7), together with a race:** see "Flow timeout" below.
- **Fix:** To the chat and the phone button return to the chat you were in. The pending pill beside them, which already exists (`data-wb-phone-pending`), is what jumps to an approval, and it names the chat.

### B3. The step-aside rule hides working pages at 1440, so it undoes the direction's bet there
- **Where:** `parts/layout.tsx:31`, `:583`. One width for every page. The reasoning, "a board shows 1.5 clipped columns", is true of the Board only. v1, the version the owner chose, keeps all three at 1440 with these same widths (`v1-1440-en.png`).
- **Measured at 1440 with page, sheet and panel kept (CSS in my own page, sheet 460, panel 440, page 409):**

| Page at 409 px | Result |
|---|---|
| Tasks, Board | Residue: one full column and a slice, 8 of 11 cards clipped. Panel at its minimum gives 509 px: still clipped |
| Tasks, List | **A working master and detail:** key, title and specialty all read. `alt-1440-tasks-list.png` |
| Today | **Fully usable:** counts and Awaiting me read as one column. `alt-1440-today.png` |

- **What 869 px buys in exchange:** nothing visible. The sheet's column stops at 736 px, the fields spread into a wide grid, and GTV-288 fills half the height. The extra width only removes one wrapped line in the header. `real-1440-today.png` against `alt-1440-today.png` is the fairest comparison.
- **Verdict and recommendation:** see the section below. This needs the owner's decision, and I recommend changing the rule.

---

## Verdict on the step-aside layout

**Right at 1280 and 1366 with the panel open. Wrong as a blanket rule at 1440.**

**Is the page still reachable and understood? Yes, reachable and clearly labelled.** "Back to Tasks" reads well in both languages. Esc inside the sheet and the rail's Tasks link also lead back to the page. Focus returns to the card you opened, and the board's sideways scroll is kept (84 px before and after). Weak points: vertical position is not kept (700 became 17, though the focused card stays in view), and three things move at once, because the sidebar also goes 248 to 56 and back.

**Did it undo the bet? Partly.** With a card open and the panel open, "the work stays the page" now holds only at 1600 and wider, and it returns when the card closes. What the owner loses at 1280 to 1440 is the ability to move through work with a card open:

| Task at 1440 | Keep the three panes | Step aside (as built) |
|---|---|---|
| Open the next card | 1 press | 2 presses, and the sidebar and page move twice |
| See where this card sits in its list | Yes | No |
| Drag a card into the chat | Yes | **Impossible:** 0 cards on screen, and the sheet has nothing draggable |
| Read the sheet | 460 px, one wrapped header row more | 869 px, half unused |
| Board usable | No, residue | Not shown |

**Recommendation, smallest change first:**
1. **Make the threshold follow the page's content.** A Board needs 520 px. List-like pages (Tasks in List, Today, Inbox, the other queues) need about 400. So 1440 keeps three panes on those, and steps aside only on a Board. 1280 (249 px) and 1366 (335 px) still step aside everywhere, which is correct.
2. **Better, at 1440: when the Board has under 520 px, show the List in its place** rather than removing the page. My v4 review offered both. This keeps the page on every page at 1440.
3. **Whenever the page has stepped aside, add Previous and Next card to the sheet's header**, walking the list the owner came from, with keys. That replaces most of what the page gave at 1280 and 1366.
4. B1 and M1 in any case.

---

## Each earlier finding, re-tested

### v4's blockers: all fixed

| # | Result | My measurement |
|---|---|---|
| B1 Keyboard trap | **Fixed** | 90 Tabs at 1440: sheet 15, grip 1, panel 14, strip 7, then the skip links and rail, and back. At 1600 the page too. F6 cycles strip, sheet, panel (and page at 1600), Shift+F6 reverses, listed in the shortcuts dialog. Deep link focuses the title, and Enter there claims nothing. Esc in the composer keeps the card. Esc on a tooltip closes only the tooltip |
| B2 Rich cards with no source | **Fixed in substance, by D50** | Every field I checked on screen is in `chat.ts`. Gaps are M3, M4, M5, M9 and N15 |
| B3 Wrong tooltip on a neighbour | **Fixed** | 13 controls, there and back, at 1, 6 and 25 steps, en and ar: 0 failures. Full audit of 28 to 29 tips per state, slow and fast, en and ar: 0 wrong, 0 missing, 0 off screen. Tallest 204 px (was 232) |
| B4 Tip over the command, strip does not lead there | **Fixed** | No tip on Allow or Deny. With the thread scrolled up at 560 px high, the pill "An approval is waiting" appears, and it, the strip's pending button and the live run all reveal and focus the card, including from a closed panel. Enter on the card answers nothing. A press at 0 ms is ignored, and one at 500 ms counts |
| B5 Arabic diff | **Fixed** | Each line has its own `dir`. Arabic lines use Cairo, right-aligned, with the sign at the line's start. English lines keep their own direction in the same block. Hunk header computed LTR. Read at 1440 and 390 |

### v4's majors

| # | Result | My measurement |
|---|---|---|
| M1 Composer jumps | **Fixed** | 120 px at rest, starting, running, waiting and at the end (148 on a phone). Thread 697 to 706 px at 900 high: only the header's state line moves it, 9 px (N13) |
| M2 Finished task re-runs from a chip | **Fixed in the panel, left in the sheet** | No suggestions after a turn. The sheet's "Run it in steps" is still live on In review and runs on one press (M8) |
| M3 A fix erases the failure | **Fixed** | "Failed once, passed on run 2" stays on the check, with both runs, and the list stays open. But see M4 and L4 |
| M4 Passed with no proof | **Fixed, with M3 below** | Verified by Hub or Claimed by Claude, each linked to its step. Go to the step opens and focuses the real step |
| M5 Draft and conflict | **Fixed** | (a) "Answer 1 flag to save", disabled, then "Save with 1 unverified mark". (b) "Save refused. Nothing was written." with `hub.docs.stale_base`. (c) "You confirmed" carried over a redraft. (d) "Allowed by: You, once". (e) "Hub does not say which". (f) No Retry beside Redraft |
| M6 Duplicates uncheckable | **Fixed, one wording problem** | The warning is first on the draft, the path is a real link that opens the doc, with one line of overlap. "Covers most of this" overclaims (M9) |
| M7 Tips opening on touch | **Fixed** | No tip after menu, dialog or settings, at 390 and 768 |
| M8 Explain not discoverable | **Fixed** | Labelled button, one-time hint, chat menu entry, long press. Phone state line is whole. Explain did not change the mode |
| M9 Dead ends | **Fixed** | Check again on the blocked states. Signed out says "Sign-in only shows with the next message". Offline kills Allow and Stop with a sentence. Questions were missed (M6) |
| M10 Modes say less than the engine | **Fixed** | Ask and Plan tips say no terminal and no other servers' tools. Ask refuses `pnpm test` with a note and a switch. Starting line with reason. Tip says about 10 seconds |
| M11 Filled buttons, focus on Claim | **Fixed** | Never two filled on screen. Page row buttons are outline at 1600. The sheet's primary steps down while a question is open and follows the work: Mark done, Submit for review |

### v4's calm list, medium and minor
- **Fixed:** N1 (44 px on touch at 768, except the grip, N10), N2 (chip × not under 24), N3 (phone lands on the page), N4 (thread 460 of 844 with the hint showing, was 407), N5 (184 px cap, starts at the top, Show all, dangerous parts underlined), N6, N7, N9, N10 (second skip link, F6), N11, L1, L2, L3, L6.
- **Partly:** N8 (the weak ones are rewritten, but `then` still holds non-results: N9 here). L4 is a note for the port. L5 is in code, not tested with a screen reader.

---

## Improvements

### Major

| # | Where | What is wrong and why it matters | Fix |
|---|---|---|---|
| M1 | `parts/layout.tsx:583`, `tips-copy.ts:41`, `:163` | **Follow removes the page by itself.** At 1280 and 1440, starting a task from a chat while reading the board: board gone, scroll 500 to 0, sidebar folded, with no action by the owner. The same on Docs: Document this task replaces the document being read. The tip says Follow "never takes focus from you", but it takes the page. | When Follow would make the page step aside, do not open the card. Show the chip with "Open GTV-288" in the composer. Open by itself only when the page keeps its room. |
| M2 | `core/sheet.tsx:429-438`, `tips-copy.ts:165` | **Stepping aside has no way to move on, and removes drag-in.** Next card takes Back plus a click, and the sidebar and page move each time. The `attach` tip says "You can also drag any card from the page to here", false in that layout. | Previous and Next in the sheet header with keys. Drop that sentence while the page is aside, or make the sheet's key chip draggable. |
| M3 | `core/strings.ts:887`, `:890`, `:897`, `tips-copy.ts:225` | **"Verified by Hub" promises more than Hub proves.** docs/16 says it plainly: Hub proves a command ran and succeeded, not that it was the right one, and a check run before later edits still counts. No string in the panel says this (searched). The word sits under a shield icon beside a filled Mark done. The move line itself is literally accurate. | Keep the label short, and say it once where it is read: under the Checks line, "Hub saw these commands run and succeed. It does not judge whether they are the right checks." Same in the `evidence.check` tip. Then add "Edits came after this run" when a file step follows a check's last run: Hub has the order, and this catches the second gap. |
| M4 | `core/protocol.tsx:270` | **A cut-off or still-running run reads "Passed".** `run.status === 'failed' ? runFailed : runOk`, while `checkRunSchema` has `cut_off` and `running`. No scenario shows it, so I read this in code. It is the exact false statement this version exists to prevent. | One label per status, and a scenario. |
| M5 | `core/protocol.tsx:508-520`, `scripts.ts:186-187`, `chat.ts:206-217`, `:494-505` | **Questions are not ready for the real event.** (a) `option.description` appears only in a tooltip, so a phone never sees it without long press, against §7.1's "a tooltip never holds the only copy". (b) `multiSelect` is ignored. (c) `questions` is an array, shown as one. (d) `expiresAt` and the `declined`, `timed_out` and `stopped` states have no design. (e) Labels up to 200 characters, and 20 options, as a wrapping row of buttons. (f) The turn line "Error 9.1 s" sits above the question, while the real question pauses a running turn, so Stop and "waiting for you" should show. | Options as a stacked list with the label and description both visible. A checkbox for multi-select. One line "Denied automatically at 14:30", as approvals have. Reorder the mock. |
| M6 | `core/protocol.tsx:513`, `:660`, `:666`, `:890` | **A question survives a dropped bridge, and the reason text is broken.** With the bridge offline, an open question keeps its heading and two disabled buttons, with no sentence. Questions share the approval route, so it is as dead as an approval, which this version handles well. Its tip reads **"The bridge is offline on , so Hub cannot start Claude there."**, because `vars={{ device: '' }}`. | Same treatment as the approval: "the turn ended, this was not answered". Pass the real device at all four places. |
| M7 | `core/protocol.tsx:193-198`, `chat-results.ts:22` | **Plan's "Schedule it" schedules on one press at a hard-coded 22:00**, with no time choice, while Do next's Schedule opens a good dialog. The card then says "Scheduled." with no time, and no Undo. A plan runs in Execute unattended. Also: Run this plan runs at once, while the contract's `planToPrompt` says it stays in the composer until sent. | Open the same dialog. Show the time on the card. Settle Run this plan against D51 and the contract, one way. |
| M8 | `core/panels.tsx:707-708`, empty chat | **Two routes to the same act behave oppositely, side by side.** With an empty chat beside a card: the sheet's "Run it in steps" runs in Execute on a press, and the panel's "Do it with the task steps" fills the box. Sheet: Explain, Plan. Panel: Plan this, Explain what it asks. Run it in steps also stays live on In review, re-running finished work with one press. | While the empty chat shows the same three, fold the sheet's row to VS Code only. Turn Run it in steps off on In review, with a reason. |
| M9 | `core/strings.ts:948`, docs/16 "§7.2 as built" | **"Hub found a doc that covers most of this" overclaims.** The server's search is by title. The filled "Update the existing doc instead" rests on that sentence, in a card about not trusting claims. | "Hub found a doc with a similar title. A second doc would drift from it." Keep the overlap line. |

### Medium

| # | Where | What is wrong | Fix |
|---|---|---|---|
| N1 | `core/tips.tsx:233` | **Copy's missed tooltip: reproduced, with its cause.** See below. | Apply `justPressed` only to focus-origin opens, not when the pointer is over the trigger. |
| N2 | `parts/layout.tsx:801`, `i18n.ts:7`, `:14` | **"Skip to content" does nothing when the page has stepped aside:** focus stays on the link, since `#main` is hidden. The sr-only note's Arabic is in the past tense ("عادت"), and its English is false at 1366. | Point it at the sheet's title when the page is aside. "تعود الصفحة حين تغلق البطاقة". |
| N3 | `core/sheet.tsx:490` | The sheet's tab panel is a Tab stop with `outline-none` and no ring: focus disappears for one press. | Add the ring, or `tabindex={-1}` where nothing scrolls. |
| N4 | `core/protocol.tsx` report, `strings.ts:913` | **Claude's words read as the report's.** "Did what the card asks, and every check passes." sits unmarked directly under "Hub could not verify `pnpm lint`". The sheet's "Evidence from Claude" sits over "3 of 3 verified by Hub". | Label the summary "Claude says". Rename the row "Report". |
| N5 | `core/scripts.ts:139`, refused flow | **Refused report:** the wording and "Nothing reached the card" are exemplary (History adds nothing). But the step above shows `✓ report_work`, while the real server throws `hub.chats.report_contradicted`. The turn also folds to "5 of 5 stages" with a green Finished, directly above "not finished". `report_stage` is the model's word, and the real smoke shows models skip stages. | Show the step as failed. Stages are Claude's report, so a report that did not move or finish should say "Stopped at: Verify" there, as the failed flow does. |
| N6 | `core/thread.tsx:468` | "Your approval is needed" stays as the heading after Allowed, Denied, Expired, and on a dead approval. A scan of the thread reads it as open. | Change the heading with the status. |
| N7 | `core/protocol.tsx:608` | A flag's answer cannot be changed: the buttons go on the first press. A wrong "Take it out" is undone only by Discard, though the answer is not sent until Save. | Add Change on the answered row. |
| N8 | `core/tips-copy.ts` | **Arabic wording, read as a reader:** see below. | Listed below. |
| N9 | `tips-copy.ts:21`, `:29`, `tips.tsx:107` | `then` labelled "What happens" still holds non-results: `strip.toggle` (the strip stays) and `resize` (a list of keys). Compact keeps only 3 of the bridge's 5 facts, dropping Version and Folder, though its hint says nothing about facts. | Move both to `detail`. Keep all facts in Compact: it trims prose, and the values are what a status tip is for. |
| N10 | `core/resizer.tsx:78` | The grip is 8×1024 px on touch at 768, the only target under 44 in 44. | A 24 px hit area on a coarse pointer, with the visible line unchanged. |
| N11 | `core/protocol.tsx`, `thread.tsx`, `sheet` | Desktop targets at 18 px high (22 in Arabic): "5 of 5 stages", "Files", "1 claim has a source", "Show the whole command", the duplicate link. WCAG 2.5.8 wants 24. | `min-h-6`. Make the whole row of the folded protocol press. |
| N12 | `core/tips.tsx:185-194`, `tips-copy.ts:18`, `:140` | A long press on a menu trigger shows **tip and menu together** until the finger lifts. The hint says "long press any button", which is untrue there. | See the questions below. |
| N13 | `core/sheet.tsx`, `parts/layout.tsx:370` | CLS 0.164 over the failed-then-fixed flow (v4: 0.025). Two shifts are the sheet's content moving under a reader: 98 px at claim, 103 px when Evidence appears. Also 9 px on the thread when the header's state line comes and goes. | Put Evidence where it pushes nothing, or fold it into the header. Reserve the state line. |
| N14 | `core/composer.tsx:466`, `core/mock.ts:50` | Slash menu keyboard is **good**: combobox, listbox, active descendant, arrows, Enter and Tab pick without sending, Esc keeps the card. But matching is prefix only because the `/` is in the search: `/review` misses `/code-review`, `/doc` and `/hub:w` find nothing. `/hub:work` and `/hub:doc`, the two protocols, are not in the list. | Search without the slash. Add both. |
| N15 | `core/panels.tsx`, `apps/web/src/features/chat/live.ts:285-333` | **The states disagree with the hook already built.** `honestStateOf` has no blocked state for `billing`, `folder_not_allowed` or `folder_missing`, so the composer stays open, while the design disables it. Offline has `recheck: false`, and the design offers Check again. `too_old` offers VS Code, and the design does not. `revoked` has no design. A limit with no `resetsAt` lets a send try. | Settle one table before the port. |
| N16 | `core/sheet.tsx`, v5's actions | **Claim and Send back close the card.** At 1280 this is a jump: the sheet goes, the page and sidebar return, focus goes to the H1, and "With Claude" on that card is gone. To run the task just claimed, find it again. | With the panel open, keep the card open after an action. |

### Minor

| # | Where | What is wrong | Fix |
|---|---|---|---|
| L1 | `core/workbench.css:152` | In a long command, `--force` breaks after `--`, splitting the word you most need to read. | `white-space: nowrap` on `.wb-danger`. |
| L2 | Mock event | History: "commented in 2 d", a future time, and "commented" where the contract has `work_reported`. | Fix the mock. |
| L3 | `core/thread.tsx` diff | Arabic inside a hunk header stays mono and widely spaced. Readable, not pretty. | Body font for the Arabic part, or drop the heading part. |
| L4 | `core/protocol.tsx:257` | "Failed once, passed on run {n}" would say "once" after two failures. | Use the real count. |
| L5 | Conflict flow | After a redraft, Save reads "Not started" with the old note "The save was refused". | Clear the note. |
| L6 | `parts/layout.tsx:303`, `strings.ts:967` | Export is named `chat-c-8-mw4wjzvu.md`, and "without tool details" sits on a file listing each tool and input. | Use the title. "Without tool output". |
| L7 | `tips-copy.ts:69-70`, `:191-192` | `approval.allow` and `approval.deny` are unused. | Delete. |

---

## Focus questions

### Calm: is 19 to 22 fine now?
**Yes.** My count in the panel's viewport: 17 at rest with a card, 15 running, 19 to 23 at a turn's end, 20 to 25 in doc flows and gaps (v1, measured: 16; v4: 27 to 33). The extra controls appear only when there is something to decide, and at most one is filled. The flask goes at the port, so subtract one. What I would still fold:

1. The sheet's With Claude row while the empty chat is showing (M8): the same three acts, twice.
2. The sheet's Evidence box: a titled box 82 px high for one line. A plain row, and it stops pushing the content.
3. On a draft, "Only what Claude flagged is flagged…" under every draft: once per chat.

### Tooltips, read as a reader
**Strong and useful.** They say what the label cannot: "ما اكتمل يبقى، وما لم يبدأ لا يبدأ", "ما تعنيه كلمة «هذا» في رسالتك", and the off states' why and fix. These are the Arabic fixes:

| Now | Problem | Better |
|---|---|---|
| **«الدور»** for a turn (`stop`, `head.new`, `turnBusy`, `turn.line`) | Means three things on one screen: a turn, the queue ("في الدور", `next.run`) and roles ("لأدوارك" on the page). "هذا الدور ما زال يعمل" can read as a role | Turn: «الرد» or «الجولة». Queue: «الطابور», already used in `strip.run` |
| «الالتزام», «لا التزام في Git» (`mode.execute`, `draft.save`) | Reads as "commitment", and the project keeps technical names in English | «commit»: «لا يُنشئ commit في Git» |
| «التغيير يعيد تشغيل Claude» (`mode.ask`, `.plan`, `.execute`) | In Ask it follows "لا يقدر على… تغيير شيء", so it seems to mean changing a file | «تغيير الوضع يعيد…» |
| «ثم يبدأ التتبع» (`plan.run`) | Collides with «تتبّع المحادثة», which is Follow | «ثم تبدأ قائمة الخطوات» |
| «يصل Claude المفتاح فقط» (`ctx.auto`) | Word order reads as Claude reaching something, and "key" is an English calque | «لا يصل إلى Claude إلا رقم البطاقة» |

Lighter: «وهذا ما يفشل المرحلة» (`stage`) is awkward, and «مسودة فرقًا» (three places) wants «مسودة تُعرض فرقًا».

**Allow and Deny with no tooltip: right, keep it.** The sentence in the card is better than any tip. But it speaks only of Allow. Add what Deny does: "Claude is told, and carries on without it or stops." §7.1 says every control has a tooltip, so record the exception there.

**Copy's tooltip: reproduced, cause found.** It is not specific to Copy. `change()` returns on `justPressed()` (350 ms), and Radix sends its open only once per entry, so the tip never comes until the pointer leaves and returns. It needs a press within about 350 ms, and an arrival inside the 500 ms neighbour window, where there is no delay. Measured, pressing New then moving to the chat menu: no tip at 0 and 100 ms, tip at 200 ms and above. On Copy after a click elsewhere: no tip. From far away, Allow, Deny, the command text or a tipped neighbour with no press: tip every time. A real person hits this when pressing a button and moving straight to its neighbour. Fix is N1.

**Compact level works and persists:** Execute's tip goes from 204 to 84 px, and an off control still shows why and fix. See N9.

### Honesty

| Item | Result |
|---|---|
| Verified vs claimed | Correct, from a real comparison in the store. `no_matching_step` sentence is honest. **Limit not stated: M3** |
| A fixed failure | Keeps its history |
| Why it moved or stayed | Each reason has its own sentence. Matches D52. Only `all_verified` moved, in my walks |
| Refused report | Wording exemplary, nothing reaches the card. N5 for the row above it |
| Question cards | Not ready: M5, M6. `primary` is not in the contract |
| Doc draft and flags | Excellent. "Keep it, marked" previews `> Unverified: ` on its own line, Take it out strikes it, Save's label says what will be written, and "Only what Claude flagged is flagged" is the most honest line in the product |
| Duplicates | On the draft, with a working link. M9 for the wording |
| Effect line | Word for word from `APPROVAL_EFFECTS` |
| Check again | Good: "Checked at 13:52: still the same", and signed out cannot promise. A limit says it clears by itself. The second press clearing it is a declared fake. N15 for the table |
| State messages | All 13 read clearly in both languages, with no blame and a next step |

**Does it promise proof beyond the real limit? In one word, yes:** "verified". Everything else is careful. Hub never claims more than a real step in the move line, and the phrase "against a real step" is true. The owner, though, reads a shield and "Verified by Hub" beside Mark done. One sentence fixes it (M3).

### Not yet tested by anyone: now tested

| Feature | Result |
|---|---|
| Drag to resize | **Works.** 340 to 929 at 1440 with a card, clamps both ways, remembered after reload, grip correct in RTL. Arrows, Home, End and Enter work. Touch: N10 |
| Drag a card in | **Works** with the page showing: drop zone, chip, no navigation. **Impossible when stepped aside:** M2 |
| Slash menu by keyboard | **Good:** N14 for matching |
| Schedule | Dialog from Do next is **good**: select focused, folder LTR, says what happens if the machine is off. Plan's Schedule it is not: M7 |
| Branch | **Good.** New chat, "Claude receives a copy of the earlier words, not the session itself" |
| Export | **Works:** real file and toast. L6 |
| Templates | **Good.** Save, list, insert without sending. Delete not tried |
| Compact tooltips | **Works.** N9 |

### Flow timeout at 390 Arabic: reproduced, two causes
1. **Certain:** B2. Press To the card and To the chat during a doc flow, and the chat is swapped, so the draft never appears. Timed out in my run.
2. **A race:** tapping the flask right after the Claude button. The button reveals the seeded approval and moves focus to it, which dismisses the non-modal menu that just opened. 1 failure in 14 full runs (`loop-fail-4.png`), and 1 in 5 at 0 ms gap, 0 in 30 at 50 ms and above. A real person can rarely tap that fast, so this is mostly a test hazard, and B2's fix removes it.

Without these, 13 runs took 6.1 to 7.2 s to the draft, and the slower full-start flows about 13.5 s.

---

## Questions to weigh in on

**A question card with no recommendation: fill the first answer, or leave them outline? Leave them outline.** Filling is Hub recommending something that it has no basis for, in a product whose bet is not to overstate, and Allow and Deny already set equal weight as the rule. Claude Code's own convention is to put "(Recommended)" on the option's label: fill an option **only when the label says so**, so the fill is Claude's stated opinion and readable as such. Focus stays calm, since the sheet's primary already steps down while a question is open. For the conflict and duplicate cards, where Hub itself holds the reason, Hub may fill its own suggestion.

**Should a report that moved a task offer Undo, or is Send back enough? Send back is enough.** I walked it: it asks "What needs changing?", moves the task and gives its own Undo toast. An Undo on the report would treat the move as a mistake to reverse, when it is a recorded fact with a reason, and the question that matters is whether the work is right. Two small changes: the move line should name it ("Not right? Send back on the card"), because a phone shows the report without the card, and the report should note a later Send back, since it still says "Hub moved the card to In review" afterwards.

**Long-press on a menu trigger opening the menu instead of a tip: acceptable.** The menu's items carry their own second line, which is more useful than the trigger's tip, and Radix makes the alternative awkward. Three fixes: hold back the tip so the two do not show together (N12), change the hint to "or long press a button", and note that Explain mode's tap on the same trigger shows its tip and does not open the menu, which is correct.

---

## What is better than baseline (v1)

- **Same calm at rest with far more underneath:** 17 controls against 16, composer always 120 px.
- **Modes, approvals with effect lines, truth in results, flags and diffs:** v1 had none of it.
- **A phone that lands on the page,** with a real route to approvals and 44 px targets everywhere.
- **The sheet at 1280 is the same 709 px as v1,** and now with a labelled way back rather than a silent one.
- **Worse than v1:** nothing in the panel. At 1440 v1 kept the page, sheet and panel together (409, 460, 440), and this version removes the page there (B3). That is v1's own weakness on the Board, and a real loss on List and Today.

## Rules checked

| Rule | Result |
|---|---|
| No coloured side or top edge | **Pass.** Computed scan of borders, inset shadows and thin pseudo-elements in 12 states, four language and theme pairs: none. No matching class in source. The sidebar's active bar and the tab underline are v5's, and neutral |
| Keys, commands, paths LTR | **Pass** in 12 scans, and in Arabic tooltips by keyboard. Slash menu's commands LTR in RTL |
| Contrast | **Pass.** No text under 4.5:1 in panel, strip, sheet or tips across 12 scans. Disabled controls' opacity not composited, and they are exempt |
| Horizontal overflow | **Pass** at 390, 768, 1024, 1280, 1366, 1440, 1600, 1920, ar and en |
| Console errors | **None** in any run, including every state and flow |
| Reduced motion | **Pass.** No running animation mid-flow with the preference set |
| Touch targets | **Pass:** 0 of 20 and 0 of 27 under 44 at 390, 1 of 44 at 768 (N10). Allow 135×44, Deny 70×44 |
| Filled buttons | **Pass.** At most one in all walked states |
| Web interface guidelines | Source grep: no `transition: all`, no `title=` on controls, no disabled zoom, no blocked paste. Others covered by the checks above |

## Not checked

- Real screen readers, real phones, real touch hardware (emulated touch only), Safari, Firefox, Mac key labels.
- The real engine: all on mock data, compared with the contract and `live.ts` by reading.
- **Focus when Follow hides the page while focus is on the page:** my test could not place focus there, so unproven. Worth a check with M1.
- The cut-off run (M4) was read in code, since no scenario produces one.
- Keeping three panes at 1440 was tested with CSS in my own page, and with real interaction not fully tried.
- Runs actions beyond reading, History delete and Undo, VS Code dialog, template delete, the doc picker, 13 states at 390.
- Light and dark at every width in every state: layouts in all pairs, flows in mixed pairs.

## Screenshots

Kept outside the repository, under `C:\Users\MOHMED~1\AppData\Local\Temp\claude\b4558443fa0fb976\8321ad0c-531e-486e-8e1a-71bcfdf0f2e3\scratchpad\ux-v5\shots\`. Most useful:

- **Step-aside decision:** `real-1440-today.png`, `alt-1440-today.png`, `alt-1440-tasks-list.png`, `alt-1440-default.png`, `m-1440-card-en-light.png`, `m-1600-card-ar-dark.png`
- **B1:** `sa-1280-panelclosed.png`, `sa-1366-panelclosed.png`
- **B2 and the timeout:** `p10-card.png`, `p10-tochat-wrong.png`, `loop-fail-4.png`
- **M1:** `sa-1440-follow.png`, `duplicate-1280-en.png`
- **Flows:** `pass-end-1280-en.png`, `fail-question-1280-en.png`, `fail-fixed-1280-en.png`, `claimed-1280-en.png`, `refused-1280-en.png`, `improve-draft-1280-en.png`, `flag-removed.png`, `conflict-1280-en.png`, `gaps-1280-en.png`
- **Approval:** `approval-long-1280-ar.png`, `pill-scrolled.png`, `offline-during-approval.png`, `question-offline.png`
- **Arabic:** `ardiff-1440-dark.png`, `ardiff-390-light.png`, `scan-report-ar-dark.png`, `slash-ar.png`
- **Phone and tablet:** `p390-approval-ar.png`, `t-768-en-card.png`
- **M7:** `schedule-dialog-ar.png`, `schedule-dialog-do-next.png`
