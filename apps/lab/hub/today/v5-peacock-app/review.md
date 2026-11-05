# Review — hub/today/v5-peacock-app   (2026-11-04)

Reviewer: independent UX critic. Reviewed as one app: all 14 views, the sheet, palette, shortcuts dialog and overlays, as the owner and as Sara.

Evidence: the live lab in a real Chromium. I walked the seven tasks you asked for and read counts after each action, measured focus and layout in the DOM, sampled contrast and overflow, and read the kit and page sources. Screenshots are in `review/`. Section "What I did not check" lists the gaps.

**Overall: 6.6 / 10. Changes requested.** This is a coherent product with a strong kit, and overlays and the undo loop are better than most shipped apps. Two defects block approval. Most of the remaining weight is in things no single page author could see: what "waiting on me" means after an action, the words shared between pages, Arabic grammar produced by shared helpers, and filters that each page solved its own way.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 7 | Today, Decisions, Handoffs and Settings have the right focal point. Inbox repeats Today, Tasks fills the wrong button, Timeline leads with filters. |
| Task flow & speed | 6 | Act, next row, undo is fast and solid. But a card that still needs me leaves my counts after the first step, Inbox never clears, and claiming a redesign does nothing. |
| Layout & responsiveness | 6 | No page overflows at any sampled mode. But the Releases header collapses to a 3 px column on phone, and the Tasks board is sliced at 390 px. |
| RTL / bilingual | 6 | Mirroring and bidi isolation are very good. Arabic grammar, gender and terminology are not, and every shortcut dies on an Arabic keyboard layout. |
| Accessibility | 6 | Nested overlays are exemplary. The most common Tab stop in the app shows only an underline, focus falls out on Needs and on `v`, and filters cost up to 22 Tabs. |
| Visual craft & originality | 8 | One visual language across four authors. The docket, relay, run strip and date spines are distinctive and mostly earn their space. |
| Motion & feedback | 7 | Toasts and Undo work everywhere I tried. Weak spots: a toast slot that loses Undo, "rising" after a count falls, no running state on source fix. |

---

## Blocking issues (must fix before approval)

**B1. The Releases header collapses on phone.**
- **Where:** `pages/releases/page.tsx:127-128` (`flex flex-wrap` header, title block `min-w-0 flex-1`). Below about 560 px, all modes. See `review/releases-390-rtl-dark-fold.png`.
- **What:** the two buttons take the row and leave the title block almost nothing. Measured title width and lines: 390 px = **3 px, 9 lines**; 430 px = 43 px, 8 lines; 520 px = 133 px, 3 lines; 600 px = 2 lines. The ISO date breaks at its hyphens ("2026- / 11- / 10"), the meta text runs down the same sliver, and the buttons sit over the status badge.
- **Why it matters:** this is the page's focal element, and it is unreadable at a required breakpoint. Overflow audits cannot catch it, because nothing leaves the viewport.
- **Fix:** stack under `md`: `flex-col md:flex-row` on the header, with the action group on its own full-width row (`basis-full md:basis-auto`).

**B2. "Waiting on me" forgets cards that still wait on me.**
- **Where:** `kit/session.ts:101` (`useAwaiting` drops any card with `actedOn`), read by Today, the sidebar and Inbox. Screens: `review/flow-handoffs-after-ack-1440-rtl-dark.png`, `review/flow-needs-after-deliver-1440-rtl-dark.png`.
- **What:**

| Step (owner) | The page says | Sidebar | Today | Inbox tray |
|---|---|---|---|---|
| Acknowledge GTV-244 | Handoffs: "وواحد ينتظرك", row shows Apply | badge gone | row gone, tile 0 | row gone |
| Deliver GTV-240 | Needs: "اثنان منها ينتظرانك", filled Verify on the row | 1 | row gone | row gone |

  Reload resets the store, so the same card can behave two ways. Sara's GTV-255, acknowledged in the mock, stays in her stack with a filled Apply. A handoff acknowledged a minute ago does not.
- **Why it matters:** Apply is the real work of a handoff (09 §9), and these two surfaces exist so nobody has to remember it. It is also the exact question you asked: rows, badges and counts disagree after the action.
- **Fix:** derive the row from the card's current state, not from whether I touched it. A card stays in Awaiting while `actionsFor(card, roles, me)` has an enabled action in my role. The row swaps its verb (Acknowledge becomes Apply) and keeps focus. Remove only when no action remains.

---

## Major

### Real tasks

**M1. Inbox never clears when the work is done elsewhere.**
- **Where:** `kit/inbox-store.ts`, `kit/card-actions.tsx:104-118`. See `review/flow-inbox-after-triage-1440-rtl-dark.png`.
- **What:** I decided, delivered, acknowledged, applied and approved. Today fell from 7 to 3. Inbox still said **"9 unread"**, in the sidebar and on Today's tile. GTV-219 sat unread in "To read" with the status "مُحسوم".
- **Why it matters:** a morning of triage ends with the number untouched, so members learn to ignore it or do the work twice.
- **Fix:** acting on a card marks that card's notifications read, and Undo restores them. This also answers the Inbox author's second question: yes, a read notification on an acted card may stay as history, but it must not stay unread.

**M2. Claiming a redesign port does nothing, and says it worked.**
- **Where:** `kit/card-actions.tsx:52` and `:73`, Sara's Today stack row GTV-261. See `review/sara-after-claim-today-1440-rtl-dark.png`, `review/sara-gtv261-after-claim-sheet.png`.
- **What:** the toast says "حجزتَ GTV-261". There is no `/hub:next` command, because `cmd` is only added for type `task`. The status stays "موافَق عليه", and the sheet and Inbox still offer Claim. Tasks shows "محجوزة 0". The card has left Today and is nowhere she would look for it.
- **Fix:** 09 §10 makes approval create a port task. Claim should act on that task, so it lands on her board with the command in the toast. If the card itself must be claimable, give redesign a `claimedById`, show it in the sheet and swap Claim for Mark ported.

**M3. An owner can sign off his own delivery, with the page's filled button.**
- **Where:** `kit/card-actions.tsx:55`. Its comment says "so whoever delivered does not sign off their own delivery", but `managers` always includes the owner.
- **What:** one second after delivering GTV-240, the only filled button on Needs is Verify on that same card. See `review/flow-needs-after-deliver-1440-rtl-dark.png`.
- **Fix:** exclude the deliverer from Verify unless no one else holds the role. Otherwise require a note and label it "تحقق ذاتي" in History. This one needs an owner decision.

**M4. Numbers that still disagree.**

| Thing | Where it disagrees | Fix |
|---|---|---|
| Ready tasks | After Apply created GTV-300: Tasks subtitle 4, sidebar still 3 (`session.ts:143` reads the mock's `readyTasks`) | Count from the store |
| New events | Sidebar 27, Today 25 (Sara 26), Timeline pill 3. README notes the 27, not the set of four | One "since last visit" count, cleared on visit (08 §2). The pill is a separate thing: "arrived while you were here" |
| Trend word | Decisions tile went 3 to 2 and now reads "في ازدياد" (`pages/today/parts/counters.tsx:37-42`). Lab data, but it reads as fact and inverts on every action | Hide the words until a history endpoint exists |
| Needs tile | "1 من 2 مفتوحة": my 1 is delivered, so it is not one of the 2 (Needs author's question 2) | Say "open or awaiting verification", or split them |
| Redesign, empty scenario | Subtitle "نسختان بانتظار رأيك" above "لا صفحات في المختبر بعد" | Compute from the rows on the page |
| Today's Sources | Still "متعطّل" after the fix in Settings (README knows). The Inbox row stays unread too | Read `admin-store` from Today |

### The app as one product

**M5. One Arabic word names two different things, and sibling words collide.**
- **Where:** `kit/i18n.ts:247` (`handoff: 'تسليم'`), `kit/i18n.ts:499` (`saveDeliver: 'سجّل التسليم'`), `pages/needs/i18n.ts:13`, `:55-56`.

| Concept | Wording today | Problem | Fix |
|---|---|---|---|
| Handoff vs Need delivery | Both "تسليم". The sidebar has "التسليمات" while Needs says "كل تسليم هنا مكان…" and Today has "سلّم" beside "استلم" | Two card types share one word on the same screen | Rename handoff, for example "إحالة" and "الإحالات". Keep تسليم for needs |
| Need | Type "احتياج", subtitle "طلبات", button "طلب جديد" | Others are "قرار جديد", "تسليم جديد" | "احتياج جديد" |
| Cancel | "ألغِ" (destroys the need, red) and "إلغاء" (closes the form) are in the same sheet. See `review/flow-deliver-secret-1440-rtl-dark.png` | Same word, opposite stakes | "ألغِ الطلب", and "ليس الآن" for closing the form |
| Dismiss vs Reject | Handoff dismiss is "ارفض", the same as redesign Reject | Dismiss is not a verdict | "تجاهل" |
| Source state | Settings "يفشل / سليم", Today and Inbox "متعطّل / يعمل" | Different pages, different words | One word per state in the kit |
| Mine | Today and Inbox "بانتظاري" and "ينتظر ردّي", Handoffs "دورك", Tasks "مهامي" | Four labels | Pick one for the filter and one for the row marker |
| Voice | Decisions and Handoffs "تنتظرك / أدوارك", Tasks "لأدواري / بين يدي", chip "بانتظاري" on the same line | Sibling subtitles switch person | Subtitles speak to "you", as the Read lane does |
| Role names | "إلى مصمم", "إلى فرونت إند", "إلى مدير المشروع"; Audit "PM", "QA", "frontend" | Definite and indefinite mixed, Latin in Audit | "إلى المصمم", "إلى الفرونت إند"; kit role names everywhere |
| Brand | "جوتيف" in the shell, "Goteav" in Tasks' empty state | Two spellings | "جوتيف" in Arabic prose |

**M6. Filters take a different shape on almost every page, and they come first on most of them.**

| Page | Shape | Tabs from h1 to first row | Collapses on phone |
|---|---|---|---|
| Timeline | 3 rows: 7 roles, 8 types, Awaiting and 4 selects. First event at y = 360 | **22** | yes |
| Tasks | Chips, search, 2 selects. First card at y ≈ 500 on phone | **15** | no |
| Decisions | Segmented, chips, select | | yes |
| Needs | Segmented, chips, select, toggle | | yes |
| Handoffs | Relay, 2 chip groups, select | | yes |
| Redesign, Releases | 2 chip groups, no divider | | no |
| Inbox | Chips and select | | no |
| Members | Chips and search | | no |

- **Same label, different behaviour:** on Decisions "بانتظاري" and "الكل" are lit together, because they are two groups with no separator (see `review/decisions-1440-ltr-light-fold.png`). On Inbox the same two words are one exclusive group. Handoffs, Redesign and Releases each show two identical "الكل" chips, with group names in `aria-label` only.
- **Mine by default:** Decisions on for the owner, Needs off, Handoffs off, Tasks on for Sara only. The owner reads "5 open" in the header above 3 rows.
- **Fix, in `FilterBar` so all pages inherit it:**
  - One order: status segment, then a separate Mine toggle, then "الفلاتر (n)".
  - Everything else goes behind the disclosure at all widths on Timeline and Tasks, with active filters shown as removable chips.
  - Chip groups become one Tab stop with arrow keys.
  - One rule for Mine (I would default it off, and mark and sort mine first as Needs does, so nobody is surprised by a shorter list).

**M7. "The one filled button" has no shared rule.**
- **Where:** `pages/tasks/page.tsx:244`, Members, and the outline "new" buttons on Decisions, Needs, Handoffs and Releases (which alone has no `+`).
- **What:** on Tasks the only filled control is "مهمة جديدة", while Claim, the page's stated job, is outline. On a phone it sits above the filters. Timeline has none by design, Today has one on the lead row.
- **Fix:** write the rule in `kit/README.md`: filled means the next thing this page wants from me, and creating is never it unless the page is empty. Fill the first claimable Ready row on Tasks. Make "New task" and "Invite" outline.

**M8. Empty states disagree.**
- **Where:** per page. All 14 viewed in `scenario=empty`.
- **What:**
  - Decisions and Needs repeat "new" in the header and the empty state. Handoffs and Releases offer none in the empty state, and Tasks points to Sources.
  - Inbox stacks two titles ("لا شيء غير مقروء / لا إشعارات بعد").
  - Onboarding tells the owner that "لم يحدد المالك مسار قراءة لدور المالك" and offers Docs, not Settings › General where he can set it.
- **Fix:** one recipe in `EmptyState`: one title, one sentence, one next step, and hide the header's copy of that step. Address the person who can act ("لم تحدد بعد مسار قراءة").

### Focal points

**M9. Inbox opens on a copy of Today.**
- **Where:** `pages/inbox/page.tsx`. See `review/inbox-1440-rtl-dark-fold.png` next to `review/today-1440-rtl-dark-fold.png`.
- **What:** a member arrives because the badge says 9 unread. The first screen is 7 cards, the same as Today's stack with the same filled button. Five of the 9 are small lines inside those cards, and the other 4 are in "للاطلاع", which starts below the 900 px fold. Nothing on the first screen reads as "here are your 9".
- **Fix (answering the author's first question):** default to Unread as the wireframe draws it, newest first, with the quick action on each row. Reduce the waiting tray to one line: "7 cards wait for you", linking to Today or to `awaiting=me`.

**M10. Needs spends its first screen on a rule the member already knows.**
- **Where:** `pages/needs/page.tsx:174` (`AddressRule`). See `review/needs-1440-rtl-dark-fold.png`.
- **What:** 100 px on desktop and about 165 px on phone, on every visit. The first action is at y ≈ 590 on desktop and y = 677 on phone. You asked for this idea to be visible, and it already is: `LocationPointer` and the Deliver form carry it. The form is where it matters.
- **Fix:** keep the pointer and the form. Make the banner dismissible after first read, or a one-line note. Owner call, since you requested it.

**M11. The lead decision offers three ways to do one thing.**
- **Where:** `pages/decisions/parts/on-the-table.tsx:61` and `:72`. See `review/decisions-1440-rtl-dark-fold.png`, `review/decisions-390-rtl-dark-fold.png`.
- **What:** each option has "اختر هذا", and below them a filled "قرّر" opens the same form with nothing picked. On a phone, pros and cons are hidden, so "Choose this" is blind.
- **Fix:** drop the filled Decide from the lead card and fill the recommended option's button (the first option if none is recommended). On phone, keep pros and cons behind a disclosure in each option.

**M12. The Tasks board is sliced at 390 px.**
- **Where:** the board scroller in `pages/tasks/`. See `review/tasks-390-rtl-dark-fold.png`, `review/tasks-768-rtl-light-fold.png`.
- **What:** the scroller is 1376 px inside 375 px. The Backlog rail takes the start edge, so the first card begins at x = -13 and is cut at the left. A phone user sees half a board under five rows of controls. At 768 px, the third column is cut mid-word.
- **Fix:** default to the list view under 768 px (the README already promises `CardRow`s there), and remember an explicit choice.

### Arabic

**M13. Relative times use the wrong case everywhere there is a dual.**
- **Where:** `kit/format.ts:72`. `Intl.NumberFormat` returns the nominative dual, and `rel()` puts a preposition in front of it.
- **What:** "قبل يومان" on Needs, Inbox, Members and the sheet. "خلال يومان" on the Decisions rail. `قبل ساعتان` and `خلال دقيقتان` follow from the same code.
- **Why it matters:** this is the first thing an Arabic reader will trip on, and it repeats on most pages.
- **Fix:** handle 2 by hand in `rel()`: يومين، ساعتين، دقيقتين. `duration()` alone may keep the nominative ("متأخر يومان" still needs a check by a native reader).

**M14. Sara is addressed as a man.**
- **Where:** `kit/i18n.ts:317-323` ("حجزتَ", "استلمتَ", "طبّقتَ", "وافقتَ"), `kit/i18n.ts:395`, `pages/timeline/i18n.ts:124` ("حجزها {name}"), `pages/members/i18n.ts:28` ("دعاه {name}", also used for huda@).
- **What:** the Timeline reads "سارة الحربي استلم" and "حجزها سارة". The mock addresses her correctly in one place ("استلمتِه · طبّقيه"), so the same person gets both within a few lines. Three of the seven members are women.
- **Fix:** verbless forms that avoid gender, as Handoffs already does ("الاستلام: سارة"): "تم حجز GTV-261", "الاستلام: سارة", "دعوة من محمد". Do this rather than adding a gender field.

**M15. Copy that reads as translated.**

| Where | Now | Better |
|---|---|---|
| `pages/settings/i18n.ts:105` | "ما الذي تفعله" (reads "what are you doing") | "المطلوب منك" |
| `pages/releases/i18n.ts:66` | "أعد بناء الهيكل" | "أعد توليد المسودة" |
| `pages/settings/i18n.ts:328` | Column "كل" | "الفترة" |
| Needs subtitle | "3 طلبات مفتوحة، واثنان سُلّما وينتظران التحقق. اثنان منها ينتظرانك." ("منها" points nowhere) | "3 مفتوحة و2 بانتظار التحقق. ينتظرك منها اثنان." |
| `kit/sheet-sections/decision.tsx:340` | "24 h, 2 h" | "قبل 24 ساعة وقبل ساعتين" |
| Settings › General | "الافتراضي: SUN 08:00" | "الأحد 08:00" |
| Sheet › History | "claimed → in_progress", "by:", "status:" | Kit status and field names |
| Timeline | "merged" badge | Kit status name |
| `kit/card-sheet.tsx:433` | "لا وصف لهذه البطاقة." above a filled Summary on handoffs, redesigns and tasks | Show it only when the section has no text either |

### Keyboard

**M16. Every shortcut dies on an Arabic keyboard layout.**
- **Where:** all use `e.key`: `kit/keyboard-list.ts:92`, `:109`, `:114`, `shell/shell.tsx:84`, `:111-121`, `kit/toast.tsx:90`, `kit/card-sheet.tsx:305`, `pages/inbox/page.tsx:245`, and the Today, Tasks and Timeline handlers.
- **What:** with key `ت` and code `KeyJ`, `j` does nothing. With `ن` and `KeyK`, Ctrl+K does nothing, though the README and the dialog promise it is always on. With `؟`, help does not open. Tested with synthetic events, not a physical layout switch.
- **Why it matters:** this is an Arabic-first team. Anyone typing Arabic in a comment or in search then finds shortcuts silently dead.
- **Fix:** match letters on `e.code` (`KeyJ`) with `e.key` as fallback, and accept `؟` for help and `Slash` for the palette. Put it in one helper so every page inherits it.

**M17. The most common Tab stop has almost no focus indicator.**
- **Where:** `kit/card-row.tsx:65`, `pages/inbox/parts/row.tsx:105`, `pages/today/parts/since.tsx:84`: `outline-none … focus-visible:underline`. See `review/focus-title-link-1440-rtl-dark.png`.
- **What:** Tab onto a row's title and the only change is an underline, the same as hover. `j` on the same row gives a clear cyan ring (`review/timeline-j-focus-1440-rtl-dark.png`).
- **Fix:** ring the stretched link's hit area: `focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:rounded-[inherit]`.

**M18. Focus still falls out in two places.**
- **Where:** `kit/keyboard-list.ts:71-75` and `pages/tasks/page.tsx:194`.
- **What:**
  - After Deliver on Needs, focus lands on `main`. The row survives but its opener button is gone, so `restoreFocus` gives up. This is v2's B1 back in one flow. Apply, Approve and Decide all land correctly.
  - `v` on Tasks replaces the board and focus drops to `<body>`.
- **Fix:** when the opener is disconnected, focus its row by id through `selectRow`. For `v`, focus the same card's row in the new view, or the view toggle.

**M19. The shortcuts dialog hides most of its own shortcuts.**
- **Where:** `shell/shortcuts-dialog.tsx:12`. See `review/shortcuts-dialog-1440-rtl-dark.png`.
- **What:** one row lists eight destinations and three keys (`g t`, `g i`, `g d`). Nothing says `g k` is Tasks or `g l` is Timeline, and `g t` is Today, not Tasks. The palette shows all of them correctly.
- **Fix:** render one row per view from `views[].goKey`. Also make `d` answer on a row I cannot act on, as `c` does on a blocked one. For Sara on Decisions it is silent today.

---

## Minor

- **Sidebar shifts 15 px between pages.** Ask has no scrollbar, so the shell jumps (`review/ask-1440-rtl-dark-fold.png`). Add `scrollbar-gutter: stable` in `tokens.css`.
- **A false "unblocked".** `kit/card-store.ts:207` computes `stillBlocked`, then emits `unblocked` anyway. Timeline says "زال التوقف" on GTV-259 while it is still blocked by GTV-240. Emit only when nothing blocks it.
- **Toast slot loses Undo.** Pressing `c` on a blocked row replaces the previous toast, so the earlier Undo is gone. Keep the undoable toast and stack the notice above it.
- **Inbox `e` is not symmetric.** 9, then `e` gives 8, then `e` gives 10: it marks the whole group unread, including an older read item. Toggle only the lead item.
- **Two filled buttons in the sheet.** The header's Decide stays filled above "سجّل القرار" (`review/flow-decide-empty-1440-rtl-dark.png`). Make the header button outline while its form is open.
- **Loading states.**
  - Redesign renders no `h1` and no status region while loading.
  - Onboarding says "أكملت مسارك" before it has data, and on error too.
- **Error codes:** `docs.tree_unavailable` and `search.unavailable` break the `hub.*` pattern of the other twelve pages.
- **Source fix has no in-between.** The status changes instantly with no "running" state, and the mock says 21:05 in Settings and 21:00 in Inbox.
- **Onboarding bar misleads.** For Sara, cells 1–6 are solid while steps 3 and 7 are the undone ones (`review/sara-onboarding-1440-rtl-dark.png`). Map each cell to its step.
- **Docs tree.** The stale marker is a lone orange dot on `17-admin-agent-booking`; give it a tooltip and a word on the row. Recent rows repeat "وثيقة" six times. The same type word repeats on every Tasks card, as that author noted. A `CardRow` prop to hide it fixes both.
- **Form errors do not take focus.** After an empty Decide or a refused secret, focus stays on the submit button, though the message is inline. Move focus to the first invalid field and set `aria-invalid`.
- **Sidebar badges have eight meanings** (unread, new, ready, routed, in review, invites, problems, steps left) and only `aria-label` tells them apart. Decisions shows a red 3 when one is overdue. Consider a neutral number with a red dot.
- **Palette then sheet then Esc** lands on `main`, not the page's `h1` or the row. Minor, since the palette is gone.
- **Placeholders** do not end with an ellipsis (web interface guidelines). Ask's placeholder is a full question over a keyword search; I did not test it as typed.
- **Tile copy:** "من 1 مفتوحة" after triage. **Members:** "7 أعضاء نشطين" should be "نشطون". Worth a read by a native editor.

---

## The pages side by side (default scenario, owner, 1440)

| Page | Reason to open | Focal point now | Right? | Filled button |
|---|---|---|---|---|
| Today | Start of day | Awaiting stack and lead Decide | Yes | Decide |
| Inbox | Badge says unread | Copy of Today's stack | **No**, M9 | Decide |
| Timeline | What happened | 3 rows of filters, then events | **Partly**, M6 | None (documented) |
| Tasks | Find or move work | Board, and "New task" | **Partly**, M7 | New task |
| Decisions | Settle a question | The laid-open question, on a deadline rail | Yes, minus M11 | Decide |
| Needs | Deliver or verify | Rule banner, then path | **Partly**, M10 | Deliver |
| Handoffs | Was it received? | Relay, then desks with the diff | Yes | Acknowledge |
| Redesign | The owner's verdict | Version laid open beside its review | Yes | Approve |
| Releases | Prepare or read | Manifest | Yes on desktop, B1 on phone | Mark released |
| Docs | Read | Tree and recents, then reader | Yes | None |
| Ask | Find a fact | Search | Yes | Search |
| Onboarding | New member's path | Next step beside the trail | Yes for Sara. Owner sees "done" twice | Read it / Go to Today |
| Members | Who, and pending invites | Invites above roster | Yes | Invite |
| Settings | Something is broken | What happened and what to do | Yes, best page in the app | Exclude and run |

**Layout showing off?** Little. The docket, relay and run strip all answer the page's question. Two to watch: the Needs banner (M10), and the Timeline's 30-row day rail, which is good once you need a date but carries less weight than its 150 px suggest. I would keep it only from 1280 px, as it is.

---

## Task walks: what happened

| Task | Persona | Result |
|---|---|---|
| Morning triage: Today, Decide GTV-219 | Owner | Works. Empty submit is refused, focus moves to the next row, Undo works. Sidebar 3 to 2, Today 7 to 6, Decisions and Timeline agree. **Inbox stays 9 (M1).** Trend inverts (M4). |
| Deliver a need: GTV-240 | Owner | Secret refused with the sheet open and the value kept for editing; pointer shown after. **Focus on `main` (M18), self-verify offered (M3), counts split (B2).** |
| Acknowledge, then apply: GTV-244 | Owner | Ack and Apply both good on the page. Apply created GTV-300 on the board. **Apply is gone from Today, sidebar and Inbox (B2).** Tasks 4 vs 3 (M4). |
| Reach Apply on GTV-255 | Sara | Filled Apply on her Today, her desk first on Handoffs. Good. I did not submit it as Sara. |
| Claim a task: GTV-264 | Sara | `c` works, the toast carries `/hub:next`, focus moves on, and the board and counts agree. Blocked `c` answers with a toast. Good. |
| Claim GTV-261 (redesign) | Sara | **No-op that reports success (M2).** |
| Approve GTV-252 | Owner | Note is optional, focus moves to the next version, counts agree, and GTV-265 shows as the port task. Good. Sara sees Approve disabled, as specified. |
| Find a doc | Owner | Docs search hands to Ask with scope and query, and excerpts are marked. The tree is plain links, with a fast reader that keeps a doc's own direction. Good. |
| Fix a failing source | Owner | Landing on Sources, cause and remedy beside each other, one click, Undo. Best flow in the app. **Today and Inbox do not follow (M4).** |

## Keyboard walk

- **Load:** first Tab is the skip link, then 22 sidebar and header stops. After navigation, focus is on the `h1`. Good.
- **Today:** the first row is the 30th Tab without the skip link. `j`, `a`, `c` and `r` were run there, and `Enter` on Inbox and Decisions. After an action, focus moves to the next row. `u` restored row and focus after 11 s.
- **Overlays:** all correct. Confirm inside the sheet traps (3 stops), and Esc closes only the top layer and returns to the opener. Blocks popover, Lightbox (arrows are RTL-aware), and Compare from the sheet behave the same way. Tooltip wrappers on disabled buttons take focus and name the role.
- **Shortcuts dialog:** opens on `?`, Tab cycles between Close and the checkbox, Esc returns. On closing from `body`, focus goes to `main`. List content needs M19.
- **Palette:** `Ctrl+K`, type, Enter opens the sheet. Good.

---

## v2 review: do the fixes hold?

Sampled, all hold.

| Finding | Check | Result |
|---|---|---|
| B1 focus and Undo | Ack from a row, then 11 s, then `u` | Next row focused, toast still there, row and focus restored |
| B2 phone first screen | 390 × 844, ar | Filled Decide ends at y = 636 |
| M1 overdue colour | Today, dark, by eye | Rust stripe and pill; warning only for under 24 h |
| M2 numerals | Today, 1440 | Below the title in weight and size |
| M7 refresh | `r` at scroll 1600 | Height 3548 kept, scroll 1600 kept |
| M8 Enter on row | Inbox, Decisions (`a` on Today) | Opens the sheet |
| M9 scoped numbers | Owner and Sara | "3 of 5", "0 of 5" |
| Reduced motion | Emulated | 0 running animations by 1.5 s |

## Sampled audits (lower value, as you said)

- **Contrast:** my own composited check on `main` at 768 ar light, 1440 en light, 390 en dark and 1024 ar dark across 14 pages (56 page-modes): **0 pairs under 4.5:1**. Disabled controls excluded.
- **Overflow:** 0 in the same 56 plus 390 ar dark.
- **Console:** 0 errors across every run. Only motion's reduced-motion notice as a warning.

## Answers to the authors' open questions

- **Tasks, Mine keeps Ready:** yes.
- **Tasks, hide moves from non-claimers:** yes, with the claimer named on the card. This is a different case from Decide, which should stay disabled and say why.
- **Decisions, Mine on by default:** see M6. Off, with mine marked and sorted first.
- **Needs, Mine on or off:** off. The author was right.
- **Handoffs, owner or pm acknowledging any handoff:** I would allow pm and owner to acknowledge with their name shown. The owner seeing a disabled Apply on GTV-255 with no way to help is odd. Your decision.
- **Timeline badge:** clear on visit (M4).

## What is better than baseline

The baseline is the 09 wireframes. `v1-baseline` holds only `README.md` and `components.md`, with no screenshots.
- **Decisions:** the wireframe has three flat bands, while this has the question itself open with its options, so the owner can choose without opening anything.
- **Handoffs:** the relay answers "was it received?" before the first row, and the diff opens in place, where the wireframe needs a sheet for it.
- **Settings › Sources:** cause and remedy beside each other, plus a one-click fix, replaces a table of statuses.
- **Needs:** the location is visibly a pointer (a dashed outline, a signpost, no mask), which a wireframe row could never say.
- **Redesign:** real pictures, a curtain compare and an honest rail of versions.
- **Every page:** one row component family, sheet, undo, deep links and filters in the URL.

**Worse than the wireframe:** Inbox's default (M9), and the amount of filter chrome on Timeline (M6).

## What works best (keep)

1. Act, next row, Undo: the same on every page I tried except Needs (M18), and overlays that close one layer at a time.
2. Settings' "what happened / what to do" panel. It should be the model for any failure in the app.
3. The Decisions rail and laid-open question.
4. `LocationPointer` and the Deliver form's preview. A strong idea, well drawn.
5. `Bidi` and `Ltr`: keys, paths and numbers held up at every width I read, including `map/**`, `(2%)` and wrapped endpoints.
6. Docs keeping an English document LTR inside an Arabic shell.
7. Disabled buttons that take focus and name the role.

---

## What I did not check

- **No screen reader was run.** Names and roles come from the DOM.
- **No physical Arabic keyboard or touch device.** M16 uses synthetic events. Swipe to archive was not tried.
- **Personas:** PM and accountant have no scenario, and were not seen.
- **Dialogs not submitted:** New decision, New need, New handoff, New release, New card, Invite, Roles, source Add and Edit, Create token, archive workspace. Settings tabs other than Sources were read as text and in their fold screenshot only, not operated.
- **Not exercised:** Timeline's live pill at 20 s, `?live=off`, `?worker=stale`, Back and Forward, Compare's curtain and synced scroll, doc language switch, Redesign's `x`.
- **Widths and themes:** 390 ar dark and 1440 ar dark are what I read closely. 768, 1024, en and light were captured and audited, and only a few were viewed by eye. Widths 1100–1279 were not checked.
- **Measurements:** no CLS, no performance. Chrome DevTools MCP was not used; Playwright covered the measurements.
- **Web interface guidelines:** fetched and applied to the kit and shell sources I read and to the rendered pages, not line by line across all 256 files. `name`, `autocomplete`, `color-scheme` and `theme-color` were not audited.
- **Arabic:** I flagged what I could see, but this needs one read by a native editor before port, especially M13–M15.

## Screenshots

All in `F:/Goteav/redesign/hub/today/v5-peacock-app/review/`.

- **Each view, first screen:** `<view>-1440-rtl-dark-fold.png`, `<view>-390-rtl-dark-fold.png`, `<view>-768-rtl-light-fold.png`, `<view>-1440-ltr-light-fold.png`, `<view>-390-ltr-dark-fold.png`, `<view>-1024-rtl-dark-fold.png`.
- **Blockers:** `releases-390-rtl-dark-fold.png`, `flow-handoffs-after-ack-1440-rtl-dark.png`, `flow-needs-after-deliver-1440-rtl-dark.png`.
- **Owner flows:** `flow-decide-sheet-…`, `flow-decide-empty-…`, `flow-after-decide-today-…`, `flow-decisions-after-decide-…`, `flow-inbox-after-decide-…`, `flow-deliver-sheet-…`, `flow-deliver-secret-…`, `flow-deliver-preview-…`, `flow-ack-sheet-…`, `flow-apply-sheet-…`, `flow-handoffs-after-apply-…`, `flow-approve-sheet-…`, `flow-redesign-after-approve-…`, `flow-inbox-after-triage-…`, `flow-settings-after-fix-…`, `flow-docs-search-typed-…`, `flow-docs-search-enter-…`, `docs-reader-1440-…`, `docs-reader-390-…`.
- **Sara:** `sara-today-…`, `sara-after-claim-today-…`, `sara-tasks-after-claim-…`, `sara-tasks-after-c-…`, `sara-claim-toast-…`, `sara-board-after-claim-…`, `sara-tasks-list-…`, `sara-handoffs-…`, `sara-decisions-…`, `sara-decision-sheet-…`, `sara-redesign-…`, `sara-onboarding-…`, `sara-settings-…`, `sara-inbox-…`, `sara-gtv261-after-claim-sheet.png`.
- **Keyboard and overlays:** `shortcuts-dialog-…`, `palette-…`, `focus-title-link-…`, `timeline-j-focus-…`, `overlay-confirm-in-sheet-…`, `overlay-blocks-popover-…`, `overlay-lightbox-in-sheet-…`, `overlay-compare-from-sheet-…`.
- **Other states:** `empty-<view>-1440-rtl-dark.png`, `error-<view>-…`, `loading-<view>-…` for today, tasks, decisions, needs, docs, members; `inbox-after-mark-all-…`, `inbox-to-read-…`, `bidi-handoff-390.png`.
