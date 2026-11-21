# Review: Hub / Agent queue (slice 5), 2026-11-08

Independent UX review of the agent queue as built (docs/16 §9 "Slice 5" and "Slice 5 as built", D56, D57; `apps/web/README.md` § The agent queue). I did not design or build it.

**How it was checked.** Owner's real instance at `http://localhost:7300`, signed in as the owner, Playwright (Chromium). Viewports 1440×900, 834×1112 and 390×844, in `ar` (RTL) and `en` (LTR), light and dark. Nothing was submitted. No Run now, Schedule, Save, pause, cancel, reorder, Claim, Send or approval was pressed. Dialogs and menus were opened only to look, then closed with Cancel or Escape.

- **The owner's queue is empty.** To judge the populated page, the card sheet's Runs and the usage-limit banner, the browser's `GET …/queue` answer was replaced with sample runs **inside the test browser only** (`page.route`). A second guard aborted every non-GET API request from that tab. The server and the database were never touched. Screenshots built this way are named `queue-mock-*` and `sheet-runs-5-*`.
- **One browser-side preference was set and then removed.** To open the Schedule dialog at all, I set `hub-panel:device` and `hub-panel:folder:goteav` in the test browser's localStorage (see B1). I removed both afterwards and put `hub-panel:open` back to `true`.
- **No plan cards exist** in `goteav` or `hub`. The plan step menu and "Schedule it" on a proposed plan were reviewed from code only.

| Pillar | Score /10 | One-line verdict |
| --- | --- | --- |
| Hierarchy & focus | 7 | Clear sections, a single filled button (Answer), and a calm header. The empty state's body is too long. |
| Task flow & speed | 3 | Run now and Schedule are disabled everywhere for a browser that never picked a device. The card sheet's Runs can bury the sheet. |
| Layout & responsiveness | 5 | No horizontal overflow and CLS is 0.0004. At 390 px the action column squeezes titles to one or two words a line, and the sheet's Runs is outside the scroll area. |
| RTL / bilingual | 6 | Logical layout is correct in both directions. Times read "في غدًا" / "At tomorrow", and «التالي» means two different things on one screen. |
| Accessibility | 7 | Focus rings are visible, the focus order is logical, focus returns after dialogs and menus, and contrast is at least 5.6:1 everywhere. Every row menu has the same name, and the free-text prompt has no secret check. |
| Visual craft & consistency | 8 | Neutral cards, coloured icons only, and no side or top stripes (owner rule met). It uses Hub's kit, as Tasks and Inbox do. |
| Motion & feedback | 6 | The spinner is `motion-safe` and the toasts work. Cancel (which ends a weekly repeat) has no confirm and no undo. A past time silently runs at once. |

## Blocking issues (must fix before approval)

### B1. Run now and Schedule are disabled for anyone who never picked a device by hand, and the tooltip blames a device that is online
- **Where:** `apps/web/src/components/queue/run-bits.tsx:273-296` (`useRunPlace`, `useRunOff`). Seen on the card sheet bar (GTV-37) and in the panel's Do next, at 1440 in `ar` and `en`, with the panel open and with it closed. See `sheet-task-ar-light-1440.png` and `sheet-runnow-disabled-tip-ar-1440.png`.
- **What:** `useRunPlace` reads `wb.deviceId` and `wb.folder`. These are the raw localStorage picks (`hub-panel:device`, `hub-panel:folder:<ws>`), spread from `localState` in `workbench/store.tsx:731-732`. The panel itself resolves a device and folder with fallbacks: the first online device and the project's first folder (`store.tsx:614-617`, `scope = { deviceId: device?.id, folder: folderNow }` at line 722). On the owner's instance the bridge reads "متصل", the device `Mohmed__Ahmed` is online and the composer shows `backend`. Still, Run now and Schedule are `aria-disabled`, and the tooltip says «لماذا هو معطّل: لا جهاز مقترن متصل الآن، فينتظر التشغيل حتى يتصل جهاز. كيف تفعّله: ». After `hub-panel:device` and `hub-panel:folder:goteav` were set, both buttons turned on.
- **Why it matters:** these are the feature's main entry points: the sheet, Do next, the plan step menu, and the dialog's Save. They are dead on any new browser or device until the owner happens to change the device in the composer. The reason shown is false, so the owner cannot find the fix. The e2e gate (`apps/web/e2e/specs/agent-queue.spec.ts:55,86`) adds runs through the API, so it never presses Run now in the UI. That is why this was missed.
- **Fix:** expose the panel's resolved values from the store, for example `deviceId: device?.id` and `folderNow`. Use them in `useRunPlace` in place of `localState`. Add a browser test that presses Schedule from the sheet on a fresh profile.

### B2. The card sheet's Runs section sits outside the sheet's scroll area and can push the tabs and body off screen
- **Where:** `apps/web/src/components/cards/card-sheet.tsx:739` (`<CardRuns>` rendered in the sheet header) and `components/queue/run-entry.tsx:91-124`. See `sheet-runs-5-ar-light-1440.png` and `sheet-runs-5-ar-light-390.png`.
- **What:** `CardRuns` shows up to 5 runs, each a full `RunRow` with a summary, meta, the moved line and a files disclosure. It sits above the tabs, in a part of the sheet that does not scroll (no ancestor has `overflow-y: auto`). Measured with 5 runs: at 1440×900 the section is 730 px tall and the tablist starts at y=1007. At 390×844 it is 1084 px tall and the tablist starts at y=1478. Mouse-wheel scrolling did not move it. Details, Comments, History and Links cannot be reached. Weekly repeats build up runs on one card, so this is the normal case over time, not an edge case.
- **Why it matters:** the sheet is Hub's main object view. With 3 or more runs on a card it stops working.
- **Fix:** move Runs inside the scrolling body, for example as its own tab («التشغيلات N») or at the top of Details. Or show only the latest run in the header, compact, with "All runs (N)". Keep the files disclosure inside the scroll area.

## Major

### M1. A scheduled time that has already passed starts the run at once, with no warning
- **Where:** `run-bits.tsx:341-360` (`ScheduleDialog`, default choice «اليوم 22:00», custom date and time with no `min`). `features/queue/queries.ts:109-114` (`quickWhen`). `packages/contracts/src/agent-queue.ts:324-328` (`firstRunAt`: "A once in the past is due at once").
- **What:** after 22:00, «اليوم 22:00» (the dialog's default) is in the past, and saving it makes the run due now. A custom date or time in the past behaves the same. The dialog says nothing, and the toast says «جُدول: 2026-11-08 22:00».
- **Why it matters:** the owner believes the run is booked for tonight while an Execute run starts in a real checkout and spends plan quota.
- **Fix:** label the quick choice from the clock: show «غدًا 22:00» once 22:00 has passed, or hide it. For a custom time in the past, show an inline line «هذا الوقت مضى، فسيبدأ فورًا» and change the button to «أضف الآن». Or block it with `min` on the date input.

### M2. "At {when}" builds broken phrases in both languages
- **Where:** `messages/ar/queue.json` `when.at` «في {when}», `banner.limit` «… عند {at} …», and the en equivalents. Filled by `kit` `when()`, which already returns "today 20:22" or "tomorrow 00:20". Used in `run-bits.tsx:96-97` and `queue-page.tsx:194`.
- **What:** seen as «في غدًا 00:20», "At tomorrow 00:20" and «يستأنف مرة واحدة عند اليوم 20:22» (`queue-mock-ar-light-1440.png`, `queue-mock-en-dark-834.png`, `queue-mock-banner-ar-light-1440.png`).
- **Why it matters:** this is the second line of every scheduled run, the line the owner reads to know when something happens. The owner's rule is that Arabic reads naturally.
- **Fix:** drop the preposition when `when()` returns a relative day («غدًا 00:20», "Tomorrow 00:20"). Or add a `whenAt()` helper that returns «غدًا الساعة 00:20» or «يوم 12 نوفمبر الساعة 08:00», and "tomorrow at 00:20" in English.

### M3. «التالي» names two different lists, stacked on top of each other in the panel
- **Where:** `components/workbench/panels.tsx:490-503`, where `RunsList` titles queued runs `q.sections.next` = «التالي». `DoNext` comes right after it under the heading «التالي» (`layout.tsx:1372-1374`). The queue page's empty state also says «أو من «التالي» في اللوحة».
- **What:** one «التالي» means *runs already queued*. The other means *cards suggested to start*. Once anything is queued, the panel's «قيد العمل» view will show two «التالي» headings in a row. The en side has the same collision ("Next" / "Do next" is only a little better).
- **Why it matters:** Run now under the suggestions «التالي» adds to the queue's «التالي». The owner cannot tell what is booked from what is only suggested.
- **Fix:** keep «التالي» (Next) for the queue. Rename the suggestions «ابدأ بهذه» / "Start with these" (or «مقترحة للبدء»), and update the empty-state copy to match.

### M4. On a phone, the action column squeezes run titles into a narrow strip
- **Where:** `run-bits.tsx:184-252` (`RunRow`: `flex items-start` with the actions `shrink-0` beside the text). At 390 in `ar` and `en`, see `queue-mock-ar-light-390.png`.
- **What:** "افتح المحادثة" plus "شغّله مجددًا" plus the menu take about 200 px. The interrupted run's title and its failure line wrap to one or two words a line, and the card grows to about 330 px tall. Running and Recent rows suffer the same way.
- **Fix:** below `sm`, put the actions on their own row under the text (`max-sm:flex-col`, actions `max-sm:justify-end`). Or fold Open chat into the row menu on phones.

### M5. Cancel is destructive and irreversible, but has no confirm and no undo
- **Where:** `run-bits.tsx:140-158` (`runMenuItems` → `act(run,'cancel')`) and the toast at 117-138, which has no `onUndo`.
- **What:** Cancel on a weekly run also ends the repeat ("Cancel ends a weekly repeat"). Cancel on a running run stops a live turn. One mis-tap in a menu where Cancel sits directly under Pause does all of that silently.
- **Fix:** use `ConfirmDialog` for Cancel when `run.repeat` is set or the run is running, and say what ends («يُلغي هذا التشغيل والتكرار الأسبوعي»). Or show an Undo toast for a queued run.

### M6. Run now spends a run in one press, with no way back
- **Where:** `run-entry.tsx:40-51` (a ghost button beside Schedule and Explain, the same weight in the sheet bar and in Do next) and `run-bits.tsx:299-319`.
- **What:** Run now starts an Execute turn in the chosen folder at once. The toast «بدأ التشغيل في F:/Goteav/backend» has no Pause or Cancel action. The owner is the one who presses it (D51), but the button sits among read-only actions such as «اشرح».
- **Fix:** add an action to the toast («أوقفه» / «افتح المحادثة»). Or separate Run now visually from the read-only actions, for example by putting Run now and Schedule in their own group.

### M7. Settings › Queue mixes Save with instant toggles, and the Save button sits under the wrong section
- **Where:** `components/settings/parts/queue.tsx:145-179`. See `settings-queue-ar-light-1440.png`.
- **What:** «احفظ الحدود» sits inside the Timezone section, so it looks like it saves only the timezone. «أوقف الطابور مؤقتًا» below it applies the moment it is ticked, with no toast on success. Concurrency, per day and quiet hours do nothing until Save. There is no dirty state, so Save is always enabled and leaving the page drops edits without a word.
- **Fix:** put Save at the end of the limit fields (its own row, or a sticky footer as other settings forms do). Keep Pause visually separate, as its own card or Segmented control like General's «نشط / متوقف مؤقتًا». Show a toast for pause. Disable Save until something changes.

### M8. The New run prompt does not check for secrets
- **Where:** `run-bits.tsx:415-424` (the `Textarea` for `asksWords`). `detectSecret` is not imported in `components/queue/*`.
- **What:** the README rule says "every free-text form uses `detectSecret`". This is the one free-text field in the feature, and its words become an Execute prompt.
- **Fix:** run `detectSecret(prompt)` on change or on save, and show the kit's `SecretFilterError`. The API filter stays the authority.

## Minor

1. **The disabled tooltip ends with an empty "how to fix".** `run-entry.tsx:40,52` passes `fix: ''`, which renders «كيف تفعّله: » with nothing after it. Pass a real fix («اختر جهازًا من شريط المحادثة») or leave the line out when it is empty.
2. **The disabled reason contradicts itself.** `noDevice` says the run *would wait* for a device («فينتظر التشغيل حتى يتصل جهاز»), yet the button is disabled. Use a separate string for "cannot add" and for "will wait".
3. **The Schedule dialog keeps its last state.** `run-bits.tsx:341-346`: cancel the dialog with «اختر وقتًا» chosen, reopen it, and «اختر وقتًا» is still selected (checked). The date is computed once at mount and goes stale across midnight. Reset the state on open.
4. **The dialog jumps up 56 px** when «اختر وقتًا» reveals the date and time row, because the modal re-centres (`schedule-dialog-*`). Anchor it to the top on desktop, or reserve the space.
5. **Native date and time follow the browser locale, not Hub's.** In `ar` they show "11/08/2026" and "10:00 PM", while everything else is 24 h ("22:00", «هدوء 22:00–07:00»). The same happens in Settings › quiet hours (`settings-queue-quiet-on-ar-1440.png`). Add `lang` on the inputs, or show the chosen value in Hub's format beside them.
6. **"Every Monday 08:00" appears twice.** It is a quick choice and also the custom time's "repeat weekly". A weekly row also shows both «كل اثنين الساعة 08:00» and the «أسبوعي» meta (`queue-mock-*`). Keep one.
7. **The header summary is cryptic.** «1 في وقت واحد · 0 من 5 اليوم» / "1 at a time · 0 of 5 today". Use «تشغيل واحد في كل مرة · 0 من 5 تشغيلات اليوم». Use `plural()` for the counts.
8. **Arabic wording:**
   - `holds.folder_busy` «دور آخر يعمل في هذا المجلد»: «دور» reads as "a turn in line". Use «تشغيل آخر يعمل في هذا المجلد».
   - Section «الأخيرة» is ambiguous ("the last one"). Use «انتهت مؤخرًا» or «الأحدث».
   - `dialog.missed` speaks of «الجهاز الرئيسي» / "main machine", which the as-built notes say does not exist ("a missed run starts when its own device is back"). Use «إن كان الجهاز مطفأً وقتها…».
9. **The scheduled toast shows a raw ISO date.** `run-bits.tsx:366` prints `${date} ${time}` («جُدول: 2026-11-08 22:00»). Use `whenText`.
10. **The empty state is long and dense.** It is three lines of rules (commit, push, delete, deploy, branch, docker) under «لا شيء في الطابور» (`queue-empty-*`). Keep one sentence plus the New run button, and move the approval rules into the dialog, which already says them.
11. **«أوقف الكل مؤقتًا» shows on an empty queue,** at the same weight as New run. Consider hiding it or making it quiet when nothing is queued.
12. **On a usage-limit pause, the header offers «استأنف الكل».** That invites resuming into the same limit. Show the reset time on the button («يستأنف 20:22») or make the action secondary.
13. **Every row's menu and chat buttons have the same name.** All are "More for this run" / «المزيد لهذا التشغيل» and "Open chat". Add the run title (`aria-label={fmt(t.actions.moreFor,{title})}`). The plan step menu (`StepRunMenu`, `run-entry.tsx:79`) reuses "More for this run" although it is a step, not a run.
14. **The focusable Next rows have no name or instructions.** `queue-page.tsx:253-259`: the `li tabIndex=0` has `aria-keyshortcuts` but no `aria-label` or `aria-describedby`. The Alt+arrow hint is shown only when there are more than 1 row. Point `aria-describedby` at the section hint and always render the hint for screen readers.
15. **No `useKeyboardList` (j/k/o) on the queue page.** The README rule says "useKeyboardList for rows", and Tasks and Inbox support it. The queue needs about 3 Tab stops per row.
16. **The live region announces only the position.** «نُقل إلى المكان 2 من 4» (`queue-page.tsx:76`) has no run title. Use «نُقل «{title}» إلى المكان 2 من 4».
17. **Touch targets.** The drag grip is 16×16 and HTML5 drag does not work on touch. The menu offers Move up and Move down, so this is acceptable, but hide the grip below `md` to avoid a promise it cannot keep. The `CardKey` link in a row is 22 px tall at 390, below the `hit-44` rule.
18. **The strip shows at most 3 live runs** (`workbench/layout.tsx:264-266`) with no "+N" when more run or wait. With `maxConcurrent` up to 5, add an overflow indicator.
19. **The sheet's Runs repeat the card.** Each row repeats the card's own title and key. Inside the card's sheet, show the run's state, time and summary only.
20. **Ended summaries are clamped to 2 lines** (`run-bits.tsx:196`) with no way to read the rest except opening the chat. Add a "more" toggle, or show the full summary in the sheet.
21. **Settings › Queue has an extra page-level header.** Its own `SectionHeader` and intro sit above the `FormSection`s; the General tab starts straight with its sections. Each section title also repeats its field label: «تشغيلات في وقت واحد» twice, «المنطقة الزمنية» twice, «أوقف الطابور مؤقتًا» twice. The «تشغيلات في وقت واحد» section also holds «تشغيلات في اليوم». Name the section «الحدود» and drop the duplicate labels, or hide the labels visually.
22. **Two timezone settings.** The project's (General) and the queue's (member-wide, defaulting to "this machine's") can differ silently. Say so in the hint: «قد تختلف عن منطقة المشروع في الإعدادات › عام».
23. **Number input clamps on every keystroke.** `queue.tsx:108`: deleting the value snaps it to 1 at once. Clamp on blur.
24. **Stale file comment.** `components/workbench/panels.tsx:6` still says the queue, Run now and Schedule "are not here at all", which is no longer true.

## What works well
- **Owner rules met.** Every run is one neutral `bg-card border-border` card. State shows as a coloured icon plus words (spinner, hand, check, warning). No coloured edges, tints or stripes. The usage-limit banner is also neutral, with only the icon in warning colour.
- **Consistent with Hub.** It uses `PageHeader`, `SectionHeader` with counts, `EmptyState`, `RowMenu`, `Modal` and the kit's buttons. The 800 px reading column matches the Inbox. The breadcrumb reads «Goteav › طابور الوكلاء», like other pages. `g q` works.
- **Clear priority.** The one filled button is «أجب» on the first run waiting. «تشغيل جديد» is filled only when the queue is empty. Hold reasons read plainly («ينتظر: دور آخر يعمل…»; see minor 8 for the wording). The failure line explains what happened and that nothing restarts by itself.
- **Keyboard.** The skip links work. Tab order runs header, then actions, then sections in reading order. The focus ring is visible (2 px offset, primary). Row menus open with Enter, close with Escape and return focus to their trigger. The Schedule dialog autofocuses «متى» (or the prompt in New run), and Escape and Cancel both return focus to the opener.
- **Contrast** (measured): muted text is 6.9:1 light and 7.7:1 dark. State icons are 5.6–6.8:1. The Answer button is 5.8:1 light and 10.4:1 dark.
- **Stability.** No horizontal overflow at 390, 834 or 1440 in either direction. CLS is 0.0004 on load. No console errors on the real pages.
- **RTL details.** Paths and commands are `dir=ltr` (`git push origin main` and folder names stay readable inside Arabic lines). Folder selects are LTR and start-aligned. Quiet-hours «من / إلى» read in the right order.

## Screenshots
All are in `docs/status/2026-11-08-queue-review/`.
- **Empty queue, real data:** `queue-empty-{ar,en}-{light,dark}-{1440,834,390}.png`
- **Populated page (sample data, browser only):** `queue-mock-ar-light-1440.png`, `queue-mock-en-light-1440.png`, `queue-mock-ar-dark-1440.png`, `queue-mock-ar-light-834.png`, `queue-mock-en-dark-834.png`, `queue-mock-ar-light-390.png`, `queue-mock-en-dark-390.png`
- **Usage-limit banner:** `queue-mock-banner-{ar,en}-light-1440.png`
- **Run menu and focus:** `run-menu-next-en-1440.png`, `focus-next-row-en-1440.png`, `focus-pause-all-ar-1440.png`
- **Settings › Queue:** `settings-queue-ar-light-1440.png`, `settings-queue-quiet-on-ar-1440.png`, `settings-queue-ar-dark-834.png`, `settings-queue-en-dark-390.png`
- **Card sheet:** `sheet-task-ar-light-1440.png` and `sheet-runnow-disabled-tip-ar-1440.png` (B1), `sheet-task-panel-open-ar-1440.png`, `sheet-runs-5-ar-light-1440.png` and `sheet-runs-5-ar-light-390.png` (B2)
- **Dialogs:** `schedule-dialog-ar-light-1440.png`, `schedule-dialog-custom-ar-light-1440.png`, `new-run-dialog-ar-light-{1440,390}.png`, `new-run-dialog-en-light-390.png`
- **Panel:** `panel-runs-ar-light-1440.png` (Do next with Run now and Schedule)
- **Consistency references:** `compare-tasks-ar-1440.png`, `compare-inbox-ar-1440.png`, `compare-releases-ar-1440.png`, `compare-settings-general-ar-1440.png`, `compare-settings-notifications-ar-1440.png`

## Not checked
- **Real runs** in Running, Waiting or Recent, real drag and Alt+arrow reorder, the live region speaking, pause, resume and cancel, and Save in settings. All of these change state. Reorder and the live region were judged from `queue-page.tsx`.
- **Plan step menu and "Schedule it" on a proposed plan.** No plan cards exist, so these were read from code (`sheet-sections/plan.tsx:411`, `workbench/protocol.tsx:361-375`). Two code-level notes. "Schedule it" is not disabled when there is no device or folder: it opens a dialog whose Save is disabled with no reason given (B1 applies). The plan's scheduled run is a `prompt` run, so it does not show in that plan card's Runs.
- **Strip run icons with real runs.** Seen only with sample data (spinner and hand shown at 1440). Mobile has no strip.
- **Screen reader output.** Inferred from the accessibility tree; NVDA and VoiceOver were not run.
- **Phone software keyboard** over the New run bottom sheet.

## Outcomes (2026-11-08, after the fixes)

Fixed alongside D58 to D60 on `feat/first-release` (commits `be99615`, `eaf36f6`). Skipped items would change a layout beyond the fix itself, or need a decision.

| Finding | Outcome | How, or why not |
| --- | --- | --- |
| B1 | Fixed | `useRunPlace` reads `wb.place`, the panel's resolved device and folder. The tip names the real reason with a fix line. Browser test presses Schedule on a task sheet in a fresh profile (`agent-queue.spec.ts`, ar and en). |
| B2 | Fixed | `CardRuns` sits at the top of Details, inside the sheet's scroll area, with the same look. |
| M1 | Fixed | "Today 22:00" reads and books "Tomorrow 22:00" once 22:00 has passed; a custom past time says it would start at once and the button reads Add now. A half-typed date is not ready. |
| M2 | Fixed | `when.at` is «يعمل {when}» / "Runs {when}"; the banner drops «عند». |
| M3 | Fixed | The panel's suggestions are «ابدأ بهذه» / "Start with these"; «التالي» stays the queue's. |
| M4 | Fixed | Below `sm`, a row's actions wrap onto their own line under the text. |
| M5 | Fixed | Cancel of a running or weekly run asks first (`RunCancelHost`, Hub's `ConfirmDialog`), saying what ends. A queued one-off cancels at once. |
| M6 | Partly | Run now's toast has Open chat (`showToast({ action })`). Stop is not in the toast: it holds one action, and Pause and Cancel stay in the run's menu. |
| M7 | Fixed | The limits save from one unsaved-changes bar with Discard, as in General; pause shows a toast. Pause stays a checkbox in its own section (a Segmented control would change the layout). |
| M8 | Fixed | New run's prompt uses `detectSecret` and `SecretFilterError`; Add stays off while a secret is there. |
| Minor 1 | Fixed | An empty fix line is no longer drawn in a tip. |
| Minor 2 | Fixed | "Cannot add" has its own strings (`off.*`); "will wait" keeps `dialog.noDevice`. |
| Minor 3 | Fixed | The dialog resets every field, and the date, on each open. |
| Minor 4 | Skipped | Anchoring the modal changes the shared Modal's layout. |
| Minor 5 | Skipped | Native date and time inputs follow the browser; replacing them is a component change. |
| Minor 6 | Partly | A scheduled weekly row no longer repeats «أسبوعي» beside "Every Monday". Both weekly entries in the dialog stay (v6's quick choice and the custom repeat). |
| Minor 7 | Partly | "of 5 runs today" / «من 5 تشغيلات اليوم». `plural()` not added to the summary. |
| Minor 8 | Fixed | folder_busy, «انتهت مؤخرًا», and the missed-run line without "main machine". |
| Minor 9 | Fixed | The scheduled toast uses Hub's time words. |
| Minor 10 | Fixed | The empty state is one sentence; the approval rules live in the dialog. |
| Minor 11, 12 | Skipped | Header actions' weight on an empty or limit-paused queue is a layout choice for the owner. |
| Minor 13 | Fixed | Each row's menu and Open chat name the run; a plan step's menu says "this step". |
| Minor 14 | Fixed | Next rows have the run's title as their name and the hint as their description, always present for screen readers. |
| Minor 15 | Skipped | `useKeyboardList` on the queue is a larger change; Tab order stays as reviewed. |
| Minor 16 | Fixed | The live region names the run it moved. |
| Minor 17 | Skipped | Hiding the grip and enlarging `CardKey` change measurements. |
| Minor 18 | Fixed | The strip shows "+N" past three live runs, opening Runs. |
| Minor 19 | Fixed | Runs in a card's own sheet leave out the card's title and key. |
| Minor 20 | Skipped | A "more" toggle on summaries is a new pattern; Open chat holds the rest. |
| Minor 21, 22 | Skipped | Settings › Queue header and section names are a layout change; the timezone hint is unchanged. |
| Minor 23 | Fixed | Runs per day is clamped on blur, not on each key. |
| Minor 24 | Fixed | `panels.tsx`'s file comment describes Runs as built. |
