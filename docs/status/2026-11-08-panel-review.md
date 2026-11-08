# Review — Hub workbench panel (real app)   (2026-11-08)

Reviewed on the owner's live Hub at `http://localhost:7300`, signed in as the owner and signed out through the UI at the end. Design source: lab `hub/workbench/v6-edge-strip-port` (D55). Read first: `docs/16-workbench.md` §7, §7.1, §7.2, "Panel as built". Items that section lists as dropped from v6 are not reported.

**Score: 7 / 10.** The layout, D54, F6, the resizer, the honest offline and no-folder notices and the gallery are solid, and nearly every v4/v5 blocker that can be checked without a running chat is fixed. But the tooltips, the one thing the owner named, are missing exactly on the mode switch, where a wrong idea does the most harm. A status tip also states something false, and two empty states are not honest.

> **Incident during the review (owner action needed).** At about 14:42 local time I pressed Enter while checking the skip link at 1280 on `/en/goteav/tasks?card=GTV-34`. The sheet's deep link had put focus on the title, so the first Tab landed on **Claim**, and the Enter claimed **GTV-34**. It was Ready and is now Claimed by Owner. A toast offered Undo. I tried to press it, the session's permission layer refused, and I did not work around that. **Please press Unclaim on GTV-34 (or Undo in its History)** to put it back to Ready. Nothing else was changed. No message was sent, and nothing was approved, linked, sent to VS Code, created or deleted.
>
> This incident is also a finding (see m9): after a deep link, focus lands on the title and the next Tab reaches a filled, state-changing button. Enter on it acts with no confirmation and only a short Undo.

## Outcomes (2026-11-08, same day)

Fixed on `feat/first-release`. Details in `docs/16-workbench.md`, "After the panel review".

| Finding | Outcome |
|---|---|
| B1 | **Fixed** (`84113c4`). Key typed with `as const`, no cast. `tip-keys.spec.ts` checks every tip key in both catalogs, template keys included. The browser test reads the Plan tip's text |
| M1 | **Fixed** (`7f053d3`, test `6bee9e5`). "Last seen", and State is one word |
| M2 | **Fixed** (`7f053d3`). Two empty lines: no chats yet, or none matching |
| M3 | **Fixed** (`7f053d3`). Offline, the sheet keeps its acts, disabled, with their reasons. Browser test in the offline case |
| M4 | **Fixed** (`f4588d1`). Panel `inert` under the card, focus follows both switches. Browser test at 390 |
| M5 | **Fixed** (`f4588d1`). Opens by default only where the page keeps 400 px beside the 440 px panel: closed at 768 and 820. Browser test at 768 |
| M6 | **Fixed** (`79c6773`). Key and chips never split, and the way back folds to its arrow under 448 px of sheet |
| m1 | **Fixed** (`ef2369c`). `Modal` gained `returnFocus` |
| m2 | **Fixed** (`97f5c68`). The stray span is gone; the toggle keeps `aria-keyshortcuts` |
| m3 | **Fixed** (`97f5c68`). Only one copy shows on the page (the line beside the title). The second was the title's tip saying the same sentence, which now says what Do next is |
| m4 | **Fixed** (`97f5c68`). The strip's `what`, without its "second press closes" line, which is not true for the phone tabs |
| m5 | **Fixed** (`97f5c68`). One row on touch when there is no state line; two rows stay while a state shows |
| m6 | **Fixed** (`97f5c68`). Device name on the chip with no folder, and one line "The device … is also offline" |
| m7 | **Partly fixed** (`97f5c68`). Timeline is list-like now (measured at 409). Planning and Docs were not measured, so they still step aside |
| m8 | **Fixed** (`97f5c68`). Closing after Previous or Next returns to the last card's row |
| m9 | **Fixed, owner's choice (2026-11-08).** The sheet's order stays. A claim's toast is `sticky`: Undo stays until the owner dismisses it or another action replaces it (`toast.tsx`, `features/cards/actions.tsx`, `toast.spec.tsx`) |
| m10 | **Fixed** (`ef2369c`). The control's `what` comes first, above Why and How to fix |
| m11 | **Skipped.** The tallest tip measured 225 px. Letting the box grow past the available height would put its end off screen, which is worse than the scroll it has now |
| m12 | **Fixed** (`97f5c68`). The fold runs in a layout effect, before paint. Not re-measured in the real app |
| Arabic table | **Fixed** (`4622b49`), every row. The offline title is «جهاز {device} غير متصل». The chat menu's actions use the verbal noun throughout |
| Incident GTV-34 | **Left for the owner**, as asked. Nothing touched it |

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 8 | Calm panel. The card's action stays the one filled button (QuietPrimary works), and the notice and composer read in the right order. |
| Task flow & speed | 7 | Ctrl /, F6, the strip, Previous and Next on the stepped-aside sheet are fast. Offline, the sheet's "With Claude" row is left as a bare label. |
| Layout & responsiveness | 7 | D54 holds at 1440/1366/1280. At 768 the panel opens by default and squeezes the page to 340 px, and the sheet header breaks at 353 px. |
| RTL / bilingual | 8 | Mirrors correctly (chevrons, Back arrow, resizer keys, tip direction). Some Arabic still reads as translated. |
| Accessibility | 6 | Good roving groups, separator semantics, AA contrast everywhere I measured. On a phone the panel under the card stays tabbable and hidden, and focus drops to body. |
| Visual craft & originality | 8 | Neutral, no stripes. Clean dark mode. The edge strip is a good idea, well executed. |
| Motion & feedback | 8 | Load CLS 0.016 to 0.097. Smooth scroll respects reduced motion. No `transition-all`. |

---

## How this was checked

**Verified in the browser** (Playwright, Chromium): widths 1440, 1366, 1280, 768, 390. ar and en, light and dark. Panel open and closed on Today, Tasks, Inbox, Timeline, Redesign, Settings. Card sheet beside the panel at every width. Hover tooltips on every panel and strip control at 1440 en (19 tips read) and at 1280 ar dark. Touch emulation at 390 (CDP `setTouchEmulationEnabled`) for Explain mode. Keyboard: Tab order from load, the skip link, F6 and Shift+F6, the roving groups, Ctrl /, the resizer's arrows, Home, End and Enter, menus and the settings dialog. Contrast computed in light and dark. Targets measured. Overflow and load CLS measured. Gallery at 1440 en and 390 ar.

**Limits.** The bridge was offline on the owner's device for the whole review (`Mohmed__Ahmed`), and neither project has any chat. So the thread, approvals, questions, stages, reports, drafts, diffs, the slash menu with real skills, suggestions in an empty chat and the usage gauge could not be seen live. Those parts are judged from code only, and are marked **[code]**. The Hub project showed the no-folder state. The Goteav project showed the offline state.

---

## Blocking issues (must fix before approval)

### B1. The mode switch's tooltips have no text: Ask, Plan and Execute say only "Shortcut: Alt 1/2/3"
- **Where:** every page, every width, ar and en, light and dark. Composer, `[data-wb-modes]`. `apps/web/src/components/workbench/composer.tsx:157`:
  ```tsx
  <Tip key={mode} k={`mode.${mode}` as 'mode:ask'} keys={[`Alt ${i + 1}`]}>
  ```
  The catalog keys are `mode:ask`, `mode:plan` and `mode:execute` (`messages/{en,ar}/chat.json:1239-1253`). The dot never matches, and the `as` cast hides it from TypeScript.
- **Verified:** hovering at 1440 en shows a 130×42 box with only "Shortcut: Alt 2" (`02-tip-plan-1440-en-light.png`). At 390 with touch and Explain on, tapping Plan shows **nothing** (`31-explain-plan-390-en-touch.png`), so on a phone the modes cannot be explained at all.
- **Why it matters:** §7.1 says "Each mode's tooltip states what it can and cannot do". The written copy is good: no terminal in Ask and Plan, pauses on push and deploy in Execute, a restart of about 10 s. Execute is the default mode, and it is the one that runs commands. This is the owner's named feature, failing on the riskiest control. Explain mode, the touch route the owner asked for, also fails here.
- **Fix:** `k={`mode:${mode}` as const}`, with the key type checked rather than cast. Add a test, as `words.spec.ts` does, that every `k=` resolves in both catalogs, template keys included. On touch, the keys line should not be the only content.

---

## Major

| # | Where (page · width · locale · theme · component · file) | What is wrong and why it matters | Fix |
|---|---|---|---|
| M1 | Every page · all widths · ar + en · strip bridge status tip · `workbench/layout.tsx:172` | **The bridge tip states something false.** With the device offline it reads "State: The bridge is offline on Mohmed__Ahmed" and then "**Connected since** 6 Nov 2026, 16:20" (ar: «متصل منذ»). The value is `device.lastSeenAt`. "Panel as built" says Connected since was replaced by Last seen because `DeviceDto` has no connected-since, and the catalog has `facts.lastSeen` ("آخر اتصال"), but the code still uses `f.since`. A status tip carrying a wrong real value is worse than none. Verified in `80-tip-…-1280-ar-dark.png`. | Use `f.lastSeen`. Drop the duplicate "State" line, since the device is already named. |
| M2 | History view · all widths · ar + en · `workbench/panels.tsx:607-611`, `chat.json` `historyPanel.empty` | **The empty History is not honest.** With zero chats and an empty search box it says "No chats by that name." («لا محادثات بهذا الاسم»). Verified on both projects (`72-history-1440-en-light.png`). Someone opening History for the first time is told their search failed. | Two messages: with no query, "No chats in this project yet. A chat starts when you send your first message." With a query, the current line. |
| M3 | Card sheet beside the panel · 1440, 1280, 768 · ar + en · "With Claude" row · `workbench/panels.tsx:774`, `:635` | **Offline, the sheet's Claude actions vanish with no reason.** `SheetClaudeBar` hides Run it in steps, Document, Explain and Plan whenever the panel's empty chat exists (`panelOffers`). But `EmptyChat` hides its suggestions whenever the engine is blocked (`!blocked`). Offline, neither shows them, so the sheet shows a bare label "With Claude" followed only by "VS Code" (`60-…`, `64-…`, `65-…`). §7.1 asks for a disabled control to stay reachable and say why. Here the actions are simply missing, and the label points at nothing. | Base `panelOffers` on the panel *showing* suggestions (`!engineBlocks(wb.engine)`). Then offline the sheet keeps its buttons disabled, with their existing `off` tips. Or hide the label when only VS Code is left. |
| M4 | Tasks with `?card=` · 390 · ar (en the same by code) · light · phone To the chat / To the card · `workbench/layout.tsx:1177-1183`, `:1235-1262` | **On a phone the hidden layer stays in the focus order, and focus is lost.** (a) After "To the chat" (`إلى المحادثة`), focus falls to `<body>`, because the pressed button's sheet becomes `display:none`. (b) After "To the card", the panel under the full-screen sheet is not `inert`. 40 Tabs went through 12 panel stops, all **obscured** by the sheet (Details, the context chip, the device chip, model, Add, Execute, Send, New chat, Close…). Then the skip links, then the sheet. A screen reader swipe reads the hidden panel the same way. This fails WCAG 2.4.11 (Focus Not Obscured) and 2.4.3 (Focus Order). | Make the panel `inert` while `phoneFront === 'card'`, as the page already is. After switching, focus the panel's waiting item or composer (`focusPanel`), and the sheet title on the way back. |
| M5 | Today and Tasks · 768 · ar + en · light + dark · first visit · `workbench/layout.tsx:958` | **The panel opens by default on a tablet and leaves the page 340 px.** `useRemembered('open', innerWidth >= 768)`, so a portrait tablet's first visit docks a 353 px panel beside a 340 px page. Today's titles wrap to 4 or 5 lines, and the letter's inline code chip spreads lines apart (`18-today-768-en-light-open.png`). | Default open only at 1024 and up, keeping the remembered choice after that. |
| M6 | Card sheet beside panel · 768 · en (ar the same) · light · sheet header · `cards/card-sheet.tsx` header row | **The sheet header breaks at 353 px.** With Back, Previous, Next and the menu in one row, the key wraps as "GTV-" / "34", and Ready and P0 stack on separate lines (`69-sheet-tasks-768-en-light-open.png`). The key is the card's identity, and splitting it reads as two values. | `whitespace-nowrap` on the key and chips. When the header container is narrow, put Back, Previous and Next on their own row above the chips, or fold Back to an icon with its label. |

---

## Minor

| # | Where | What | Fix |
|---|---|---|---|
| m1 | Panel settings dialog · 1440 en · `layout.tsx:428`, `ChatMenu` | Closing Panel settings with Esc sends focus to `#main`, not back to Chat options, because the menu item that opened it is gone. | Return focus to `[data-wb-chat-menu]` on close (`onCloseAutoFocus`). |
| m2 | Every page · `layout.tsx:1318` | A stray `<span class="sr-only">Ctrl /</span>` sits at the end of the layout. Screen readers reach the words "Ctrl /" with no context (seen in the panel's text after "Enter to send, Shift+Enter for a new line."). | Remove it, or join it to the toggle's `aria-keyshortcuts` sentence. |
| m3 | Runs view · 1440 en · `panels.tsx` `DoNext` | "Ranked from card state, with no AI: overdue, then …" appears twice, above and below the list, worded slightly differently (`73-runs-1440-en-light.png`). | Keep one, above the list. |
| m4 | Phone tabs Chat, History, Runs · 390 touch · `layout.tsx:620-623` | Their tips are one thin line ("Shows all chats by project."), while the strip's versions also say what happens on a second press. Explain mode on a phone is where these are read most. | Reuse `strip:chat`, `strip:history` and `strip:runs`. |
| m5 | Phone header · 390 touch · `layout.tsx:806-818` | Title row, then an Explain and New row with an empty state slot, then tabs, then the first-run hint: 225 px of 844 before any content. The second row is empty for a new chat. | Put Explain and New on the title row when there is no state line. |
| m6 | No-folder state · Hub project · 1440 en · composer `where` chip | The chip shows only a monitor icon and a chevron, with no device name. The notice also hides that the device is offline, though the strip's plug is orange (`95-hub-project-today-1440-en-light.png`). | Show the device name. Add one line under the notice: "The device is also offline." |
| m7 | Timeline with a card · 1440 en · `layout.tsx:112-121` | Timeline is not in `LIST_LIKE`, so at 1440 it steps aside (`62-…`). It is a single-column feed that reads well at 409 px (`54-timeline-1280-ar-dark-open.png` shows it at 517). D54 says list-like pages stay. | Add `timeline` (and probably `planning`, `docs`) to `LIST_LIKE`, or measure each page. |
| m8 | Back to Tasks after Previous or Next · 1280 ar · `card-sheet.tsx` | After walking to GTV-37 and pressing Back, focus lands on the page H1, not GTV-37's row. v5 returned to the card. | Focus the row of the last card shown. |
| m9 | Sheet deep link · all widths · `card-sheet.tsx` focus | Focus lands on the title (good, Enter there does nothing). But the next Tab is Claim, a filled, state-changing button, with a short Undo toast. This caused the incident above. | Order the sheet header so the first stop after the title is a non-mutating control (menu, Copy key), or require the Undo toast to stay until dismissed for claims. |
| m10 | Tooltips with `off` · `ui/rich-tip.tsx:153-160` | A disabled control's tip shows only Why and How to fix, never what the control does. Send's tip never says "Send". | Keep `copy.what` as the first line above Why. |
| m11 | `ui/rich-tip.tsx:349` | The tip box has `overflow-y-auto` with a max height, but focus never enters it. A long tip on a short window is cut with no keyboard way to read the rest. The tallest seen was 225 px, so this is low risk. | Cap the content length, or let the box grow. |
| m12 | Load · 1280 ar · sheet + panel | Load CLS 0.097, from the sidebar folding 248 to 56 after first paint. That is just under 0.1. | Fold before first paint when both panes are restored. |

### Arabic copy (read as a reader)

The copy is short, concrete and usually natural. These lines still read as translated:

| Key | Now | Suggested |
|---|---|---|
| `panel.empty.title` | اسأل من حيث أنت | اسأل عمّا أمامك |
| `panel.engine.offline.title` | الجسر غير متصل على {device} | الجسر متوقف على جهاز {device} (or: جهاز {device} غير متصل) |
| `panel.engine.offline.action` | يعود وحده حين يتصل الجهاز… | يزول هذا التنبيه وحده حين يعود الجهاز للاتصال… |
| `panel.engine.signed_out.body` | يسجّل الدخول Claude نفسه… | يسجّل Claude دخوله بنفسه… |
| `panel.runs`, `runsPanel.title` | التشغيلات | قيد العمل (or: الجاري) |
| `pro.menu.on/off`, `pro.settings.on/off` | يعمل / متوقف | مفعّل / معطّل |
| `pro.settings.reset` | إعادة الأصلي | استعادة العرض الافتراضي |
| `tips.facts.since` | متصل منذ | Remove (see M1). Use آخر اتصال |
| Sheet meta (card-sheet) | الإنشاء: النظام | أنشأها: النظام |
| `sheet:vscode` tip | لا يُرسل وحده: تضغط Enter هناك. | لا يُرسل تلقائيًا، فاضغط Enter هناك. |

Register also changes inside one menu: «ثبّت»، «صدّر»، «احذف» are imperatives, «إعدادات اللوحة»، «إغلاق اللوحة» are nouns. Pick one register for actions.

---

## Earlier reviews: were their blockers fixed in the real app?

| Finding | Status | Evidence |
|---|---|---|
| v4 B1 keyboard trap in the docked sheet | **Fixed** | The sheet is a `<section>`. Tab passes sheet → panel → strip → skip links. F6 cycles main, panel and strip at 1440, and Shift+F6 reverses. |
| v4 B2 rich cards with no source | **Fixed by D50 [code]** | Not visible live (no chat). |
| v4 B3 neighbour shows the wrong tip | **Fixed** | `disableHoverableContent` on the provider. 19 tips at 1440 each showed their own text, but the modes show an empty text (B1, a new bug). |
| v4 B4 tip over the command | **Fixed [code]** | No tip on Allow or Deny, the recorded exception. |
| v4 B5 Arabic diff | **Fixed [code]** | Per-line `dir`, not seen live. |
| v5 B1 page fate wrong with the panel closed | **Fixed** | 1280 with the panel closed: sidebar 248, page 405, sheet 560, page kept. 768 closed: the sheet lies over the page (`overlay`). Real sidebar width is measured (`useSidebarWidth`). |
| v5 B2 To the chat jumps to another chat's approval | **Fixed in logic**, new focus bug | Goes back to the current chat (`layout.tsx:1201`). Focus is lost (M4). |
| v5 B3 step-aside hides working pages at 1440 | **Fixed** | 1440 with a card and the panel: Tasks, Today and Inbox keep a 409 px page. Tasks shows List under 520. Timeline still steps aside (m7). |
| v5 M2 no way to move on when aside | **Fixed** | Previous and Next and "Back to Tasks" at 1280 and 1366. Correct chevrons in RTL. Next walked GTV-34 → GTV-37. |
| v5 M4 cut-off run reads "Passed" | **Fixed [code]** | `r.runStatus[run.status]`, one label per status. |
| v5 M8 sheet and panel offer the same acts | **Fixed, but over-applied** | See M3: offline, the acts are offered nowhere. |
| v5 N2 skip link when the page is aside | **Not re-tested** | The incident stopped this test. |
| v5 N10 grip target on touch | Unchanged | `w-2` grip, 8 px wide at 768 touch (desktop has no 44 px requirement). |

---

## What is better than the lab and the baseline

- **Honest states, real values.** The offline notice names the device, gives the exact command (`hub doctor`) with Copy, and Send's disabled tip says why and how to fix it. No-folder gives "Open Settings". Model and Default are honest ("What Claude Code chooses on this device").
- **D54 works on real pages.** Page widths measured: 1440 open with a card 409, 1366 and 1280 step aside to 795 and 709 with Previous and Next, 1280 closed keeps 405, 768 closed overlays. No horizontal page scroll anywhere (0 of 40 states).
- **Keyboard.** Skip to Claude panel lands on the panel. Mode and status are roving groups (one Tab stop each). The resizer is a real separator with `aria-valuenow/min/max`, arrows of 48 px, Home 340, End 777, Enter 440, double-click resets, and the width survives a reload. Ctrl / closes and reopens and returns focus to the toggle. Every Tab stop in the panel and strip showed a ring.
- **Contrast** (computed): panel title 16.5:1 and 15.7:1, inactive mode 6.9 and 7.7, device chip 5.9 and 7.1, disabled placeholder 5.9 and 7.1, sheet Claim 5.8 and 10.4. No panel text under 4.5:1 in either theme.
- **Tooltip quality, where wired, is excellent.** "What happens", "Depends on" and real values (device, folder, version, persona), placed well inside the viewport at 1280 and 1440, in the right direction in Arabic.
- **The gallery has no panel:** no panel, strip, toggle or skip link at 1440 en and 390 ar, and Ctrl / does nothing there.
- **Console:** no errors from the panel during the review. The 401s logged belong to the moment of signing out.

---

## Screenshots

All in `docs/status/2026-11-08-panel-review/`:
- `10-…25-today-{1440,1280,768,390}-{en,ar}-{light,dark}-open.png`: the panel beside Today in all 16 combinations.
- `30-today-390-en-light-touch-open.png`, `31-explain-plan-390-en-touch.png` (B1 on touch), `32-explain-where-390-en-touch.png`.
- `02-tip-plan-1440-en-light.png` (B1), `80-…85-tip-*-1280-ar-dark.png` (tips in RTL, M1 in `80-…`).
- `40-…59-{tasks,inbox,timeline,redesign,settings}-{1440-en-light,1280-ar-dark}-{open,closed}.png`.
- `60-…71-sheet-*.png`: the card sheet beside the panel (D54 at 1440, 1366, 1280, 768, 390). M3 in `60`, `64`, `65`. M6 in `69`.
- `72-history-1440-en-light.png` (M2), `73-runs-1440-en-light.png` (m3), `74-resized-*.png`, `75-gallery-*.png`, `76-…78-*-390-ar-light.png` (M4), `90-…94-*` (menus and settings), `95-hub-project-today-1440-en-light.png` (no-folder, m6).

The Playwright tool also left its own snapshot and console logs in `F:/Goteav/hub/.playwright-mcp/`. They hold no credentials, and they can be deleted.
