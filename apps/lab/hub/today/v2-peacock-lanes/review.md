# Review — hub/today/v2-peacock-lanes   (2026-11-03)

Reviewer: independent UX critic. Evidence: the live lab page (`frame-hub.html#/today/v2-peacock-lanes`) at 1440 / 1024 / 768 / 390 px, ar + en, light + dark, scenarios default / frontend / empty / loading. I also measured contrast (canvas-composited, every rendered text node, both themes), ran Tab and shortcut walks, measured target sizes, overflow, CLS and reduced motion, and read the source. The baseline is the 09 §4 wireframe only. `v1-baseline` has no screenshots.

**Overall: 6.1 / 10. Changes requested.** The concept is strong and well built. Two keyboard and phone issues block approval, and a cluster of colour and hierarchy problems weakens the triage focal point the version is built around.

| Pillar | Score /10 | One-line verdict |
|---|---|---|
| Hierarchy & focus | 6 | The lead card's only filled button is a real focal point. But the 28 px counter numerals are the largest type on the page, 7 cards are split into 6 groups, and on phone the stack sits below the fold. |
| Task flow & speed | 5 | One-click actions, j/k and Claim with a command toast are good. But focus drops to `<body>` after every action, Undo is unreachable by keyboard, Enter does nothing on a row, and Ready starts at y = 1587. |
| Layout & responsiveness | 6 | No horizontal overflow at any width, and DOM order matches the lanes. But the phone first screen has no action, the runway tooltip is clipped at 768–1100 px, and refresh collapses the page. |
| RTL / bilingual | 8 | No physical classes, consistent mirroring with a documented time rule, heatmap arrows map visually, Intl plurals and LTR keys. A few copy and percent-isolation slips. |
| Accessibility | 5 | 0 AA text failures and visible focus everywhere, and the roving grid is right. But focus is lost on mutation, the Undo window is 6 s, chips are 22 px tall on phone, Enter is missing, and single-key shortcuts cannot be turned off. |
| Visual craft & originality | 7 | A distinctive palette with a lovely letter voice, tide line and contract diff. But the decision tint and the warning pill collide, dark bronze reads muddy, light pastels are loud, and eye cyan is overused. |
| Motion & feedback | 6 | Reduced motion is honoured (verified) and CLS on load is 0.011. But `r` swaps the whole page for a short skeleton, and the breathing dots animate the healthy sources, not the failing ones. |

### Audit dimensions (as briefed)
| Dimension | Score | Justification |
|---|---|---|
| Single focal point (Awaiting me) | 6 | Desktop: the stack starts at y = 313, the filled cyan "Decide" is unique, and the tint is confined to the stack. But the counters (28 px numerals vs 18 px lead title, 22 px h1) are read first. Phone: the stack heading is at y = 777 (ar) / 835 (en) in an 844 px viewport. |
| Density / scannability (6–12 people, daily) | 5 | The stack is 978 px tall for 7 items with 6 group headers, 5 of which hold 1 card. Awaiting is counted three times (header sentence, tile, section badge). The runway re-shows 4 cards already in the stack. |
| Colour use (Night Peacock) | 6 | Vivid and mostly meaningful. The overdue pill is warning-on-decision (ΔE_ok 0.026, CR 1.00 to the card tint), overdue severity changes colour between blocks, and cyan means "act" and "busy day" at once. |
| Text contrast AA | 8 | 448 text nodes per theme: 0 failures in ar/en × light/dark. The only miss is the disabled Claim at 3.94 (exempt). Many pairs sit at exactly 4.50–4.54 on 12 px. |
| RTL correctness | 8 | Stripes, toasts and tide line are logical, and keys are `<bdi dir=ltr>`. Sparklines, heatmap and runway all flow with reading, ArrowRight = earlier in ar (verified). Percent signs in titles are not isolated. |
| Keyboard & focus order | 5 | Focus order follows the lanes and the ring is visible on every stop (57 stops checked). The heatmap is one tab stop. But focus is lost after actions, Enter does not open a row, the first action needs 11 Tabs and there is no skip link. |
| Touch targets (390) | 7 | Every button is ≥ 44 px and cards and rows are stretched links. But 10 CardChips are 82×22, and "See all 27" is 134×18. |
| Overflow / clipping | 7 | scrollWidth equals clientWidth at all 12 combos. The runway tooltip is clipped at the viewport edge (808–1048 px in a 1009 px viewport at 1024). 4 of 7 member names are truncated on phone. |
| Layout shift | 6 | Load CLS is 0.011 (font swap). Refresh drops scrollHeight from 3345 to 1080 and jumps the scroll from 1600 to 180. On phone, the skeleton order does not match the loaded order. |
| Motion & reduced motion | 7 | 45 ms stagger, layout exit, the toast and the chevron are purposeful. Under `reduce`, the breathe animation-name is `none` (verified). The healthy dots breathe forever. |
| Empty / loading | 7 | Each empty state has a next step, and "Still loading…" appears at 3 s. The loading view drops team and sources, "Updated 08:45" shows while loading, and 8 tiles say "0 · quiet all week". |
| Copy tone ar / en | 7 | Calm and factual, with no exclamation marks, real Arabic plurals and verb buttons. A few awkward Arabic labels, and the person mixes "me/my" with "you". |

---

## Blocking issues (must fix before approval)

**B1. Keyboard users lose their place after every mutation and cannot Undo.**
- **Where:** `page.tsx:56-70` (`onAction`, `onClaim`), `awaiting-stack.tsx:145-152`, `ready.tsx:72-82`, `toast.tsx:353-357`. All widths and modes.
- **What:** I focused "قرّر" on GTV-219 and pressed Enter. `document.activeElement` became `<body>`. Reaching "تراجع" (Undo) took **46 Tabs**, and the toast closes after 6 s. After `c` on GTV-258, focus also went to `<body>`, and the next `j` jumped to the top of the page (GTV-231) instead of the next ready row.
- **Why it matters:** this breaks the page's core loop (act → next) for keyboard users (WCAG 2.4.3). It also makes the only undo effectively time-limited for them (WCAG 2.2.1). The doc says Today is the start page used many times a day.
- **Fix:**
  - Before removing a card or row, record its index. After the exit, focus the next `[data-row]` in the same list (or the previous one if it was the last).
  - When the list empties, focus the section heading (`tabIndex=-1`).
  - Give Undo a shortcut (`u`, or `Ctrl/Cmd+Z` while the toast is open) and show it in the toast ("Undo · u").
  - Do not auto-dismiss a toast that holds Undo while focus is inside the stack, or give it at least 10 s.

**B2. On phone, the focal point is not on the first screen.**
- **Where:** `page.tsx:41` (`letterCollapsed` defaults to `false`), `page.tsx:162-165`, `header.tsx:285-315`. 390 px, both languages and themes.
- **What:**
  - The header is 205 px, the counters 120 px and the expanded letter 404 px. The Awaiting heading lands at y = 777 (ar) and y = 835 (en) in an 844 px viewport.
  - The first card (and its full-width "Decide") starts at y = 841, so not a single action is visible on load. See `review/390-rtl-dark-fold.png` and `review/390-ltr-dark-fold.png`.
- **Why it matters:** Today is "phone-first" (09 §4), and P3 says Today "opens on the awaiting-me block".
- **Fix:**
  - Default the phone letter instance to the 3-line clamp (about 130 px). The toggle and shared state already exist.
  - Put Refresh in the title row as a 44 px icon button with an `aria-label`.
  - On phone, either drop the counter row or move it below the stack (it repeats the section counts there).
  - Target: the lead card's button is fully visible at 390 × 844.

---

## Improvements

### Major

**M1. Overdue looks like "decision", and overdue changes colour between blocks.**
- **Where:**
  - `awaiting-stack.tsx:70-74` and `:80-84` (`Pill tone="warning"` for overdue and due-soon), on `typeClass.decision.soft`;
  - compare `counters.tsx:366-369` (overdue = destructive), `runway.tsx:135` and `:195` (overdue = destructive-soft).
  - Lead card GTV-219 and GTV-231, all widths, both themes.
- **What:**
  - The warning-soft pill on the decision-soft card has ΔE_ok 0.026 and CR 1.00 (light) / 1.01 (dark), so the pill shape vanishes.
  - The pill text (copper) and the "Decision" label (bronze) are ΔE 0.063 apart, so the most urgent fact on the page reads as part of the type label.
  - The danger stripe and the bronze stripe have the same luminance in dark (CR 1.01) and differ only by hue at 3 px.
  - The same "overdue" is rust in the counter and runway but copper in the stack.
  - See `review/stack-1440-rtl-light.png`.
- **Fix:**
  - Overdue uses the danger tone everywhere (rust on destructive-soft). Keep warning only for "due < 24 h".
  - Seat all status pills on `bg-card` with a 1 px tone border, as the priority badges already do, so a pill never sits tint-on-tint.
  - For urgent cards, consider a 4 px danger stripe plus a danger hairline border on the card.

**M2. Hierarchy inversion in the counter band (an undocumented deviation).**
- **Where:** `counters.tsx:358` (`text-display`, 28 px), `page.tsx:162`. 1440 and 768.
- **What:**
  - The 8 counter numerals are the largest type on the page: 28 px vs the h1 (22 px) and the lead title (18 px).
  - 3 of 8 tiles repeat counts shown just below: Awaiting 7, Tasks ready 3, Sessions 1. The header sentence repeats Awaiting a third time.
  - The 09 §4 wireframe places the counters strip at the bottom. That move is not in the README's deviation list.
- **Fix:**
  - Use 18–20 px numerals on one compact row (label and number inline, sparkline optional).
  - Drop the tiles whose section is on this page, or move the band below the lanes as the spec draws it.
  - List the move as a deviation if it is kept.

**M3. The stack is fragmented and loose.**
- **Where:** `awaiting-stack.tsx:170-177` and `:203-215`, `:111-122`. 1440.
- **What:**
  - 7 cards are split into 6 group headers, and 5 of those groups hold a single card.
  - The stack is 978 px tall, so about 4 cards fit above the fold, and "Ready for my roles" begins at y = 1587.
  - The type groups (Decisions, Needs…) repeat what the tint and the type label already say.
- **Fix:**
  - Keep only "Overdue or escalated" and "Due within 24 h" as groups, then one "Everything else" block sorted by due date and priority.
  - Hide a group header that holds 1 card.
  - Bring non-lead cards to 2 lines (meta inline with the pills, about 72 px). The doc's compact row is ≥ 44 px.

**M4. Deviations from the plan docs that the README does not flag.**
- **Where:** `awaiting-stack.tsx:105-155` and `since.tsx:11-22`.
- **What:**
  - P1 says "No page invents its own row design", and 09 §4 says "Each row is a `TimelineItem` compact". The stack uses a new `StackItem` card instead.
  - 09 §4 says "Since last visit … grouped per card". The version groups by repo.
  - Together with M2, these need an owner decision like deviations 1–7.
- **Fix:** add them to "Deviations (owner decisions needed)", or align with the docs.

**M5. The runway tooltip is clipped at the viewport edge.**
- **Where:** `runway.tsx:101-111` (an absolute `w-60` box with no collision handling). 768–~1100 px. RTL right edge (LTR left edge).
- **What:**
  - At 1024 px, the GTV-219 tooltip spans 808–1048 px in a 1009 px viewport.
  - The first word of the title ("سياسة") and "متأخر" are cut off behind the scrollbar.
  - See `review/runway-1024-rtl-tooltip-clipped.png`.
- **Fix:** anchor the tooltip to `start-0` for pins in the first 25 % of the strip and to `end-0` for the last 25 %. Or use a collision-aware popover (Radix / Floating UI).

**M6. The runway re-shows the stack and hides titles.**
- **Where:** `runway.tsx:94-98`. Default scenario, ≥ 768 px.
- **What:**
  - All 4 pins (GTV-219/231/236/240) are cards already in Awaiting me with due pills. The 232 px strip adds no new information for the owner.
  - The pins carry only the key and time, so a human has to hover each one to learn what it is.
- **Fix:**
  - At ≥ 1280 px, show a short title (truncated at about 18 ch).
  - Mark pins already in the stack (for example a small "in your stack" tick), or collapse the runway to one line when every deadline is already awaiting me.
  - Pins for cards outside the stack are the ones that earn the strip.

**M7. `r` / Refresh destroys the page.**
- **Where:** `page.tsx:44`, `:72-76`, `:158-160`, `loading.tsx`. All widths.
- **What:**
  - Pressing `r` at scrollY 1600 replaces everything with a 1080 px skeleton for 900 ms. The scroll jumps to 180, and Team and Sources vanish.
  - The 4-card skeleton does not match the 7-card stack.
  - See `review/refresh-skeleton-1440-rtl-dark.png`.
- **Fix:**
  - Refresh in place: keep the content, spin the Refresh icon, and fade only changed rows (08 §3.4: "rows fade in 160 ms").
  - Use the skeleton only for the first load, and give it the final block order and heights, including team and sources.

**M8. `Enter` / `o` do nothing on a row focused with j/k.**
- **Where:** `page.tsx:78-107`.
- **What:**
  - `j` focuses `article[aria-labelledby=aw-GTV-231]`, then Enter leaves focus and URL unchanged.
  - 09 §4 ("`Enter` open") and 08 §12 ("`Enter` / `o` open focused row") require it.
  - There is also no shortcut for the row's own action (08 §12 lists `a` acknowledge).
- **Fix:** Enter or `o` on `[data-row]` clicks its stretched link. Consider `a` for acknowledge and `d` for decide on the focused card, shown with `aria-keyshortcuts`.

**M9. The counter numbers do not match their links or the persona.**
- **Where:** `page.tsx:115-133` and the mock counters. Frontend scenario.
- **What:**
  - "قرارات مفتوحة 5 · قرار واحد متأخر" is a workspace-wide number but links to `/decisions?awaiting=me`.
  - Sara sees a rust "1 overdue" decision that is not hers. "Handoffs pending 2" sits beside 1 handoff in her stack.
  - For the owner, Decisions 5 vs 3 in his stack.
  - The README claims "no two numbers disagree". They do, in meaning.
- **Fix:** label the scope ("5 open · 3 mine"), or count "mine" to match the link. Show the overdue word only when the overdue item routes to me.

**M10. The tint strength is too loud for all-day use (owner question, with evidence).**
- **Where:** `tokens.css:58-80` (light soft tints) and `:161-184` (dark).
- **What:**
  - Light: four saturated pastels (peach, pink, sky, lavender) fill a 980 px column, and the decision peach is the same family as warning.
  - Dark: the bronze tint `#332506` reads as muddy brown across three cards in a row.
  - See `review/stack-1440-rtl-light.png` and `review/stack-1440-rtl-dark.png`.
- **Fix:**
  - Answer the README's open question with "lower". Light soft to about L 0.975, C ≤ 0.02. Dark to C 0.035 as the research proposes, and shift decision dark soft towards a cooler bronze.
  - Or tint only the lead card and keep stripe + label for the rest. This is also the README's documented fallback for deviation 1.

**M11. Eye cyan means "act", "now", "you were here", "routed", "focus" and "busy day" all at once.**
- **Where:** `tokens.css:136` (primary), `:207` (`--heat-4` ≈ `#02D0FD`), `since.tsx:198-204`, `runway.tsx:166`, `atoms.tsx:180`.
- **What:**
  - In dark, the heatmap's top step is the same luminous cyan as the lead "Decide", so the band below the fold becomes a wall of primary-coloured squares.
  - The "only filled button" stops being unique. See `review/heatmap-focus-1440-rtl-dark.png`.
- **Fix:** reserve full-strength primary for the action, focus and now. Build the heat ramp on tail teal (`--type-doc`), or cap `--heat-4` at L ≈ 0.70.

**M12. 12 px dominates, at the AA edge.**
- **Where:** `text-caption` everywhere.
- **What:**
  - 324 of 448 rendered text nodes (72 %) are 12 px.
  - Every type label and status pill measures 4.50–4.54:1 (for example "متأخر 15 ساعة" is `#C97945` on `#3B200F` = 4.50).
  - IBM Plex Sans Arabic reads visibly smaller than Latin at the same size (research §5).
- **Fix:**
  - 13 px for Arabic captions (or for pills and meta in both locales).
  - Move pill text 1–2 L steps further from its tint so each pair is ≥ 5:1, leaving headroom for anti-aliasing.

### Minor
- **Touch targets on phone:**
  - **Where:** `atoms.tsx:201-215` (CardChip `leading-5`), `since.tsx:188-193`. 390 px.
  - **What:** 10 chips are 82×22 (5 in the letter, 5 team focus chips), and "اعرض الـ 27 في الخط الزمني" is 134×18. In the letter, two chips sit on adjacent lines about 7 px apart.
  - **Fix:** `min-h-11` hit area through padding plus negative margin on phone, or a `::after` hit slop.
- **Member names truncated on the phone heatmap:**
  - **Where:** `team.tsx:73`.
  - **What:** "Moha…", "Omar Sul…", "Yousef Alq…", "Layla Mans…" (4 of 7), with no `title` and no full name in view.
  - **Fix:** use the first name on phone, or put the name row above the 7 cells.
- **Motion draws the eye to the healthy sources:**
  - **Where:** `sources.tsx:229`.
  - **What:** four healthy dots breathe forever while the failing and lagging ones are still.
  - **Fix:** make healthy static. If any motion is kept, give the failing source a one-time pulse on load.
- **Single-key shortcuts cannot be turned off:**
  - **Where:** `page.tsx:79-107`.
  - **What:** `j/k/c/r` are global single keys (WCAG 2.1.4).
  - **Fix:** a preference to turn them off (08 §10 preferences). `?` should list them (08 §12). Today the only hint is a caption at y ≈ 3300, hidden on phone (`page.tsx:191`).
- **`c` on a blocked row is silent:**
  - **Where:** `ready.tsx:39`.
  - **Fix:** answer it with a toast: "GTV-249 is blocked by GTV-231".
- **Phone loading order differs from the loaded order:**
  - **Where:** `loading.tsx:26-59`.
  - **What:** the phone skeleton shows the stack first and the letter last, but the loaded page puts the letter first, so content jumps. "حُدّث 08:45" also shows while loading (`header.tsx:301-304`).
- **The heatmap speaks twice:**
  - **Where:** `team.tsx:216` (`aria-label`) and `:242` (`aria-live` readout).
  - **What:** every arrow move announces the cell twice.
  - **Fix:** drop `aria-live` (the focused cell's label is enough), or drop the label and keep the live line.
- **Redundant chrome:**
  - every stack card shows a "routed to your role" dot (`awaiting-stack.tsx:131`), although everything in Awaiting is routed by definition;
  - Since shows "27" plus "showing 10 of 27" plus "See all 27" (`since.tsx:143-151`, `:187-194`);
  - the repo `h3` headings contain counts ("backend 6 commits 2 events"), which makes their accessible names verbose (`since.tsx:163-178`).
- **Runway details:**
  - at 1024 px the "24 ساعة" label touches the GTV-240 stem (`runway.tsx:160-164`);
  - pins tell the type only by dot colour (the type is in the `aria-label` only);
  - in light mode the overdue zone and the 24 h band are ΔE_ok 0.009 apart, so they are separated only by the now line.
- **Percent signs not isolated:** "(2%)" in GTV-247 renders "(%2)" in RTL. Research §5 asks for `<bdi dir=ltr>` on number + unit. Apply a small title formatter for `\d+%`.
- **Arabic copy:**
  - "المواعيد خلال 72 ساعة" reads as "appointments". Use "المواعيد النهائية خلال 72 ساعة" or "الاستحقاقات خلال 72 ساعة" (`i18n.ts:241`).
  - "غير مقروء في الوارد" → "الوارد غير المقروء" (`i18n.ts:165`).
  - The zero form "لا متأخر" → "لا شيء متأخر" (`i18n.ts:174`).
- **English copy:**
  - The person mixes "Awaiting me" / "Ready for my roles" with "Nothing waits for you" / "your agent". Pick one per surface.
  - The ready-row meta repeats the specialty ("Ops · S · Ops · imported suggestion").
  - The header date repeats as the letter dateline on phone.
- **Small desktop targets:** desktop Claim is 32 px tall (`atoms.tsx:57`, `md:h-8`) while the README says 36 px. Copy buttons are 28 px.
- **Online status is a colour dot only for sighted users:** green vs grey (`atoms.tsx:250-258`). Add a `title`, or show "online" in words on wider screens.
- **Missing attributes:** `translate="no"` is missing on keys and commands, and `touch-action: manipulation` is not set on buttons (Vercel guidelines).

### Polish
- The empty scenario shows 8 tiles of "0 · quiet all week". Collapse them to one line ("A quiet week: nothing is open").
- The counter sparklines and trend words are lab-made (deviation 7), yet they read as fact ("rising"). Mark them as lab-only in the README screenshots, or hide them until the history endpoint exists, so the owner does not approve fake data.
- The phone team totals have uneven tile heights ("same as last week" wraps to 3 lines).
- The success check icon also shows on undoable "done" toasts. That is fine, but "Undo" should look like a button, not a teal ghost link.

### RTL time-axis decision (README §RTL)
I agree with "time flows with reading" on all three axes, and the code is consistent:
- sparkline dot at the inline end;
- heatmap with today at the inline end and ArrowRight = earlier in ar;
- runway with overdue → now → +72 h from the inline start.

The cost is that "now" sits near the inline start on the runway and at the inline end on the heatmap on the same page. Make the direction explicit on the runway: a small "later" arrow and label at the far inline end. Keep the README's plan to test it with 2 Arabic-first members.

---

## What is better than baseline
The baseline is the 09 §4 wireframe, with no screenshots.
- **Desktop focal point:** the wireframe stacks the full-width narrative above Awaiting me. v2 puts the letter in its own lane, so at 1440 the lead action sits at y ≈ 415 next to the letter, not under it.
- **Triage:** urgent cards come first (overdue or escalated, then < 24 h), each card has one inline verb, and the lead button is the only filled control. The wireframe has a flat list with no urgency order.
- **Deadlines:** a time picture (overdue zone, now, a 24 h band and named weekdays) plus a readable list on phone, instead of two text rows.
- **Claim loop:** the row leaves with a layout animation, the toast carries a copyable `/hub:next GTV-258`, and the claimed task appears as "Working on" in the team heatmap. The counters stay in sync after resolve and claim (verified).
- **Since your last visit reads as a story:** the breaking contract change is pinned as a before/after diff (words plus strike-through, not colour alone), and the tide line says "كنتَ هنا أمس 11:30".
- **The owner additions** (team week, sources) fit without becoming BI: no ranking, colourless deltas in words, and failing sources listed first with icon, words and error text.

It is worse than the wireframe on density. The wireframe's compact rows would fit the 7 awaiting items in about 400 px; v2 needs 978 px. The phone first screen (B2) is also worse.

## Keep (what works best)
1. The lead card: the only filled button, and full width on phone; type tint plus stripe confined to the triage block.
2. The morning letter's own voice (Noto Naskh Arabic / Newsreader at 16 / 1.8), its inline CardChips, the "Written by your agent at 08:41" byline and the copyable `/hub:start`. This is P4 made visible.
3. The contract diff with "Before / After" words and strike-through, and the tide line.
4. The heatmap:
   - a single tab stop with arrow and Home/End;
   - correct RTL arrow mapping;
   - a numeric legend and an exact-value readout;
   - members sorted by name, never ranked.
5. Team deltas as arrow plus words with no good/bad colour, and the card flow as solid vs outlined bars (not colour alone).
6. Engineering hygiene:
   - zero physical direction classes (grep-checked);
   - hex only in `tokens.css`;
   - Arabic plurals in all six categories through `Intl.PluralRules`;
   - keys, numbers and commands as LTR isolates;
   - no horizontal overflow in 12 combos;
   - CLS 0.011;
   - reduced motion verified;
   - 0 AA text failures in both themes.
7. Empty states that each give a next step ("Check the backlog", "Run /hub:start").

## Screenshots
All are in `F:/Goteav/redesign/hub/today/v2-peacock-lanes/review/`.
- Full page, default scenario:
  - `1440-rtl-dark-full.png`, `1440-rtl-light-full.png`, `1440-ltr-light-full.png`, `1440-ltr-dark-full.png`;
  - `768-rtl-dark-full.png`, `768-rtl-light-full.png`, `768-ltr-light-full.png`, `768-ltr-dark-full.png`;
  - `390-rtl-dark-full.png`, `390-rtl-light-full.png`, `390-ltr-light-full.png`, `390-ltr-dark-full.png`.
- First screen: `1440-rtl-dark-fold.png`, `1440-ltr-light-fold.png`, `768-rtl-dark-fold.png`, `390-rtl-dark-fold.png` (B2), `390-ltr-dark-fold.png` (B2).
- Awaiting stack: `stack-1440-rtl-light.png` (M1, M10), `stack-1440-rtl-dark.png` (M1, M10), `stack-390-rtl-dark.png`.
- Runway: `runway-768-rtl-dark.png`, `runway-1024-rtl-dark.png`, `runway-1024-rtl-tooltip-clipped.png` (M5), `runway-1440-ltr-light.png`, `runway-390-ltr-light.png`.
- Keyboard and feedback: `focus-j-row-1440-rtl-dark.png`, `toast-undo-1440-rtl-dark.png` (B1, the Undo reached after 46 Tabs), `heatmap-focus-1440-rtl-dark.png` (M11), `refresh-skeleton-1440-rtl-dark.png` (M7).
- Team on phone: `team-390-ltr-light.png` (truncated names).
- Scenarios: `frontend-1440-rtl-dark-full.png`, `frontend-stack-1440-rtl-dark.png` (M9), `empty-1440-ltr-dark-full.png`, `loading-390-rtl-light-full.png`.
