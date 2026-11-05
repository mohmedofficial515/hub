---
version: v5-peacock-app
title: Night Peacock · full app
status: approved # draft | review | approved | rejected | ported
base: v2-peacock-lanes
created: 2026-11-04
tokens: override # inherit | override (see tokens.css)
touches-components: [app/globals.css (Night Peacock tokens, Cairo), app/(app)/[workspace]/layout.tsx (sidebar, header), components/layout/sidebar.tsx, components/layout/top-bar.tsx, components/common/command-palette.tsx, components/common/keyboard-shortcuts-dialog.tsx, components/common/confirm-dialog.tsx, components/common/toast.tsx, components/common/empty-state.tsx, components/common/error-state.tsx, components/common/skeleton.tsx, components/common/copy-button.tsx, components/common/relative-time.tsx, components/common/filter-bar.tsx, components/cards/card-row.tsx, components/cards/card-chip.tsx, components/cards/type-badge.tsx (TypeDot, TypeIcon, TypeBadge), components/cards/status-badge.tsx, components/cards/priority-badge.tsx, components/cards/role-badge.tsx, components/cards/actor-chip.tsx, components/cards/card-sheet.tsx, components/cards/sections/*, components/cards/new-card-dialog.tsx, new components/today/*]
ported:
---

# Night Peacock · full app

All 14 sidebar pages are built. The independent review is in [review.md](review.md), and its answer is below under "Review answered". Status is `approved` by the owner on 2026-11-05 for porting into `F:/Goteav/hub`, with one change at port: Decisions' coloured band rules become neutral (hub docs/15 D31). Further changes become a new version. To extend it, start at [kit/README.md](kit/README.md).

## Pages
Each page's layout idea, deviations and checks are in its own `NOTES.md`, with screenshots in `shots/`.

| Page | Layout | Notes |
|---|---|---|
| Today | Two lanes: what I act on, what I read | this README |
| Inbox | Narrow column that opens on what is unread, newest first; one line links to the cards waiting on me | [NOTES](pages/inbox/NOTES.md) |
| Timeline | Spine with hours, labelled quiet stretches, last-visit line, per-day rail | [NOTES](pages/timeline/NOTES.md) |
| Tasks | Full-width board with folding Backlog and Done rails; sortable list view | [NOTES](pages/tasks/NOTES.md) |
| Decisions | A docket by deadline; the first question I can settle is laid open | [NOTES](pages/decisions/NOTES.md) |
| Needs | A board read as a path; the delivery location is a labelled pointer, never a value | [NOTES](pages/needs/NOTES.md) |
| Handoffs | Three stations answer "was it received?"; grouped by receiving role | [NOTES](pages/handoffs/NOTES.md) |
| Redesign | The version in review laid open, others on an oldest-to-newest rail; compare | [NOTES](pages/redesign/NOTES.md) |
| Releases | The next release as a manifest; shipped ones on a date spine | [NOTES](pages/releases/NOTES.md) |
| Docs | Sticky tree, reader and outline | [NOTES](pages/docs/NOTES.md) |
| Ask | Search with cited excerpts, plus a separate panel with the `/hub:ask` command. Hub writes no answers | [NOTES](pages/ask/NOTES.md) |
| Onboarding | A numbered trail with the next step beside it | [NOTES](pages/onboarding/NOTES.md) |
| Members | Waiting to join above the team table | [NOTES](pages/members/NOTES.md) |
| Settings | Seven tabs under `?tab=`; a manager lands on Sources when one is failing | [NOTES](pages/settings/NOTES.md) |

Sign-in, TOTP, invite acceptance, password reset and the workspace list (09 §1–§2) are outside the sidebar and are not built.

## Idea
The owner picked v2's Night Peacock palette and two-lane Today, and asked for it inside the real app rather than as a lone page.
This version is that app: a grouped sidebar, a header with search and "+", a card sheet over every page, and Today rebuilt inside it
with every finding of v2's review answered. The lanes stay: the start lane is what I act on, the end lane is what I read. The change
in feel is colour. Cards are now one calm neutral surface with one neutral border and a coloured type icon, so the eye is drawn to
one filled cyan button rather than to a column of pastels. The ocellus is the one piece of decoration left, once, as the brand mark.

## Key decisions

### Owner decisions (2026-11-04)
1. **Palette and lanes kept** from v2.
2. **Cairo everywhere for Arabic**, including the morning letter. Inter for English, JetBrains Mono for keys.
3. **Neutral card + icon.** *Replaced by decision 10: this first read "neutral card + stripe + icon".* v2's full-card tints are gone. Soft tints remain on small badges only. The gradient under the letter
   is gone. The ocellus moved to the sidebar.
4. **Full sidebar with groups** per 08 §2, collapsible to icons; a drawer below 1024 px.
5. **Header** per 08 §2: breadcrumb, search that opens the palette, "+", live indicator, avatar.

### Owner decisions (2026-11-04, answering the review)
6. **Naming.** Handoff is «إحالة», plural «إحالات», page «الإحالات», in Arabic everywhere. Creating one is «أحل» or «إحالة جديدة». «استلم» and «طبّق» stay. «سلّم» and «تسليم» are for delivering a Need only. English stays Handoff; route and view id stay `handoffs`.
7. **Self-verify.** Whoever delivered a need may verify it, with a required note. History records «تحقق ذاتي», and that Verify is never the filled button. If another person verifies, nothing changes.
8. **Handoffs.** Owner and pm may acknowledge any handoff, with their name shown. Apply stays with the receiving role, disabled with a tooltip for anyone else. A handoff routed to another role shows only in Handoffs, unless it is overdue. That last rule is the director's choice inside this decision; see [Handoffs NOTES](pages/handoffs/NOTES.md).
9. **`/hub:ask`** is a skill command in the team pack, receiving the whole question. The page text does not change. See [Ask NOTES](pages/ask/NOTES.md).
10. **No coloured edge on any card, on any page.** The owner's words: do not use the coloured side or top border on any card or any page in the design. A card is one neutral surface with one uniform `border-border`. The type shows through its coloured icon and type word. Urgent or overdue is a uniform rust hairline on all four sides plus the danger pill and icon, with no thicker side. The sheet's top stripe, the Tasks column headers' coloured line and the Relay's selected bar went too. This replaces decision 3's stripe.

### Type
Cairo's weights are assigned, not inherited: 400 reading, 500 labels and badges, 600 section heads and card titles, 700 numerals and
emphasis in prose, 800 the page title only. Inter stops at 700 in the frame, so its page title is 700.

`@theme inline` bakes the named sizes into their utilities, so `tokens.css` restates them under `[lang='ar']`: caption 13, body-sm 14, body 15,
body-lg 16, title-sm 17, title 19, headline 24, with taller lines for Cairo's marks. `leading-*` still works because the rules read
`var(--tw-leading, …)`. Pages never branch on the locale.

The letter lost Naskh, which the critic praised, so its voice now comes from size and leading (Cairo 17 / 1.95) and the agent's signature.
Whether that is enough is an open question below.

### Colour
Every coloured text token was recomputed: each is at least 4.9:1 on `card`, `background`, `accent` and its own soft tint. Soft tints moved to
light L .965 C ≤ .022 and dark L .235 C ≤ .035, with dark decision shifted cooler so it no longer reads as muddy brown. The heat ramp moved
from the primary's hue to tail green, capped at L .70 in dark. The tide line moved to tail teal. "Now" on the runway and the sidebar's
selected marker are neutral `foreground`. Bright cyan is left for the primary action, links and the focus ring.

### The shell
- **Router:** `#/today/v5-peacock-app/<view>[/<cardKey>]?query`, with `action` and `tab` in the query. The last path is in sessionStorage, and
  restored whenever the third segment is missing, whether the toolbar reloaded the iframe or only changed its hash. An open card is
  restored too. Back and forward work.
- **Views:** one list in `shell/views.tsx` feeds the sidebar, the palette, the breadcrumb and the `g` keys. Each page is a lazy
  `pages/<view>/page.tsx` behind an error boundary.
- **Sidebar:** 248 px from 1280, 56 px icons from 1024 (08 §7), or whatever the member last chose (`[` and `]`, stored). Icons get a tooltip
  with label and count. Badges say their number in words through `aria-label`; red means overdue or failing. The Timeline count is a pill
  outlined differently from a badge (08 §2).
- **Palette:** built on a Radix Dialog with a `role="combobox"` input and `aria-activedescendant`, because `cmdk` is not in the lab's
  dependencies. It has Recent, Cards, Pages and Commands. An exact key jumps, and a key that does not exist opens the sheet's 404.
- **Live indicator:** `?live=off` shows the reconnecting state.
- **Skip link** to main, and focus moves to the new page's h1 on navigation.

### Today

**Deadlines, the decision the brief asked for.** A deadline already in Awaiting me is not repeated with its title. It is a mark on the time line,
because the one thing its row cannot show is how the deadlines sit against each other. Activating a mark moves to the row. Only a card outside
the stack gets a labelled pin; it carries its title from 1280 px. When everything is in the stack the runway stays a slim ribbon (76 px), and
phones list only the outside cards plus a line such as "And 4 more in Awaiting me above". `GTV-267` was added to the `hub-app` mock to show this
case: an in-progress task assigned to the owner, due Friday, not routed to him (09 §4 "routed to my roles or assigned to me").

**Awaiting me.** Urgent first, then the next 24 h, then "Everything else" by date and priority. A header shows only for a group of two or more,
plus the divider before "Everything else". Default data shows one divider rather than v2's six headers. Rows are about 72 px at two lines.

**Counters.** Tiles whose section is on this page are gone (Awaiting, Tasks ready, Sessions). What remains links away: Inbox, Decisions, Needs,
Handoffs, Redesigns (owner). The main number is mine, "of 5 open" gives the workspace from the store (Needs says "open or awaiting a check"), and "1 overdue" appears only when it is routed to me. The sparklines stay as lab-made shapes, with no trend word beside them.

### Sheet
08 §5.3–5.4, on Radix Dialog with framer-motion. Focus lands on the primary action, or inside the form when opened on one. On close it
returns to the opener, or to the row that replaced it if the action removed that row. A permission the member lacks shows a disabled button with
a tooltip naming the role. The tabs are Details, Comments, History and Links; the doc keeps Links inside Details, the brief asks for a tab, and
the brief won.

## How each review finding was addressed

| Finding | Answer |
|---|---|
| **B1** focus lost, Undo unreachable | `useKeyboardList` moves focus to the row at the removed index (last row, then the heading if empty). The sheet does the same on close. `u` and Ctrl/Cmd+Z undo, and Undo returns focus to the row. The toast holds at least 10 s and while focus is in a list. Verified: Decide → save → next row; 11 s later the toast is still there; `u` restores row and focus. |
| **B2** no action on the phone's first screen | The letter starts clamped on phones, the counters move below the lanes, and Refresh is a 44 px icon in the title row. The lead button ends at about y = 636 of 844 in Arabic. |
| **M1** overdue looks like decision | Overdue is danger everywhere; warning is only for "due < 24 h". Neutral cards end the tint-on-tint collision. Urgent rows get a uniform rust hairline (first a 4 px stripe, removed by owner decision 10). |
| **M2** counters outrank the title | 18 px numerals under a 22–24 px, heaviest-weight title. Team totals too. The repeating tiles are gone. Band position: see deviations. |
| **M3** fragmented, loose stack | See Awaiting me above. P2 and P3 are hidden in this list (08 §5.1), the role is an icon, and only a member with several roles sees it. |
| **M4** undocumented deviations | Listed below, including `CardRow` vs `TimelineItem` and repo vs per-card grouping. |
| **M5** tooltip clipped | Radix Tooltip with collision handling. |
| **M6** runway repeats the stack | See Deadlines above. |
| **M7** refresh destroys the page | Refresh keeps the content and spins the icon. The skeleton is for first load only, with the final order and blocks, team and sources included, at each width. |
| **M8** Enter does nothing | `Enter` and `o` open the row. `d` and `a` act on a row whose action matches, with `aria-keyshortcuts`. |
| **M9** numbers do not match | "Mine" matches the link and the rows, with the workspace total in words, per persona. Sara's Decisions tile says 0 of 5, with no overdue that is not hers. |
| **M10** tints too loud | No tinted cards. Soft tints lowered for badges. |
| **M11** cyan means everything | Heat ramp in tail green, tide in teal, "now" and selection neutral. |
| **M12** 12 px at the AA edge | Meta lines moved to `text-body-sm`. Arabic caption is 13 px, and body text is 14–15 px. All coloured text pairs at least 4.9:1 by token. Measured numbers are under Verification. |
| Touch targets | Chips and "See all" have a 44 px hit area on phones through `hit-44`, without taller sentences. |
| Truncated names | First names beside the 7 phone cells; the full name is in `title`. |
| Motion on healthy sources | Healthy dots are still. A failing dot pulses twice on load, `motion-safe` only. |
| Single-key shortcuts | A preference in the `?` dialog turns them off; Ctrl/Cmd+K and Esc stay. |
| `c` on a blocked row | Answers with a toast naming the blocker. |
| Phone loading order, "Updated" while loading | Skeleton matches the loaded order at each width. No "Updated" while loading. |
| Heatmap speaks twice | The readout is no longer a live region. |
| Redundant chrome | The routed dot is gone from the stack. Since shows one count and "See all". Repo headings no longer contain counts. |
| Runway details | The type shows as an icon on pins and in the tooltip; the zones have a dashed boundary and a label. |
| Percent isolation | `Bidi` isolates `2%`, keys, version slugs and endpoints in API strings. |
| Arabic and English copy | All listed strings changed. The act lane speaks as "me", the read lane to "you". The ready row no longer repeats the specialty. Date appears once on phone. |
| Small desktop targets | Row actions 36 px, compact copy 32 px. |
| Online colour only | `title` in words, and sr-only text beside the name. |
| `translate="no"`, `touch-action` | Added to keys and commands; `touch-action: manipulation` is set on controls in `tokens.css`. |
| Polish: 8 tiles of zero | Collapses to "A quiet week: nothing is open." |
| Polish: lab-made sparklines | Kept because the brief asks the band to show trends. Flagged in deviation 6 so they are not approved as real data. |
| Polish: phone totals, Undo look | Equal-height rows, "no change". Undo is an outline button with its key. |
| Kept from the critic's praise | Tide line, contract diff (now `ContractChange` in the kit), RTL mirroring, time direction (a "later" arrow added), heatmap keyboard model, colourless deltas, no ranking. |

## Review answered (2026-11-04)

Answers [review.md](review.md). "Walks" means `flows.cjs`, the critic's seven task walks plus the state checks below, scripted in headless Chromium as owner and Sara, reading counts on the sidebar, Today, the page and Inbox after each action. "Audit" is the run described under Results.

### Owner decisions taken during the answer

| Decision | What changed | How it was checked |
|---|---|---|
| **6 Naming** | «إحالة» for Handoff in the kit, shell, every page, mocks and History. Every تسليم and سلّم was classified by meaning, not replaced blindly. | Grep after the change: what remains is Need delivery, and one audit sentence naming both. |
| **7 Self-verify** | See M3. | Walks. |
| **8 Handoffs** | Owner and pm may acknowledge any handoff, with their name shown. Apply stays with the receiving role. A handoff of another role reaches the owner's stack only when overdue. | Walks: owner acknowledges GTV-238, name on the row, Apply disabled, row leaves Today, sidebar handoffs falls to 0. |
| **9 `/hub:ask`** | Page text unchanged. Ask's NOTES record it. | Read. |
| **10 No coloured edge** | Every coloured side and top stripe is gone: `CardRow` in all tones, the sheet's top stripe, Timeline, Tasks column headers, Decisions, Handoffs, Redesign, Releases, Ask, Inbox, Settings' source panels, skeletons and the Relay's selected bar. `typeClass[].stripe` and `typeTopStripe` no longer exist. Urgent is a uniform rust hairline. | A DOM measurement in the audit; numbers under Results. Looked at the shots in both themes. |

### Blocking

| Finding | What changed | How it was checked |
|---|---|---|
| **B1** Releases header collapses | The manifest's header stacks under `md`, with the action group on its own row. | Audit: title widths and a sliver check (text under 90 px wide on 2.5+ lines) on all 14 views at 320, 390, 430. Looked at the 390 shot. |
| **B2** Awaiting forgets cards | `buildAwaiting` derives each row from the card through `awaitedAction` (first enabled of decide, deliver, verify, acknowledge, apply, approve, claim). The verb swaps, the key stays, so focus stays. A fact from the old state (due date, meta) goes when the state moves on. Today, sidebar and Inbox read it. | Walks: Acknowledge then Apply on GTV-244 (owner), Apply on GTV-255 (Sara), Deliver then Verify on GTV-240 (owner), reading all surfaces. Focus stays on the swapped button. |

### Major

| Finding | What changed | How it was checked |
|---|---|---|
| **M1** Inbox never clears | `usePerformAction` marks the card's notifications read. Undo restores exactly those. | Walks: Decide falls 9 to 8 on sidebar and tile, `u` returns 9. Deliver, Claim. |
| **M2** Claim is a no-op | `actionsFor` offers Claim on an approved redesign only while its port task is ready. `perform` acts on that task (GTV-288 for GTV-261; approval creates one if the card has none, 09 §10) with `/hub:next` in the toast. No target means no write and no toast. Once claimed, the sheet offers only Mark ported. I read every `showToast` call: the rest write the lab's state or say they are lab stand-ins, such as the workspace switch and the archive. | Walks as Sara: toast names GTV-288 and the command, row leaves, s-03 read, card in Claimed on her board, sheet has no Claim. |
| **M3** Self-verify | **Owner decision 7.** `selfVerify` on the payload, `selfVerified` on the event and need, required note, «تحقق ذاتي» in History, never filled. | Walks: Verify not filled on GTV-240, empty note refused with focus on it, History reads it. GTV-247 verified by another person needs no note. |
| **M4** Numbers | Ready count from the store in one hook (`useReadyTasks`). One since-last-visit count on sidebar and Today, cleared by visiting Timeline. The pill says "arrived while you were here". Trend words gone, sparklines kept. Needs tile says "open or awaiting a check". Redesign's subtitle comes from the rows and hides when empty. Today's Sources reads `admin-store`, and fixing a source marks its Inbox item read. | Walks: Apply gives 4 on sidebar, Today and Tasks. 25 to 0 after a Timeline visit. Source fix reaches Today and Inbox. |
| **M5** Words | **First row: owner decision 6.** Need: «احتياج جديد». Cancel: «ألغِ الطلب», «ألغِ المهمة», and «ليس الآن» to close a form. Dismiss: «تجاهل». Source states from `kit.sourceStatus`. Mine: «يخصّني» for the filter, «يخصّك» for the marker (`MineMark`). Subtitles speak to "you". Roles definite in the kit, kit role names in Audit. «جوتيف» in Arabic prose. | Grepped every تسليم, سلّم and التسليمات and classified each by meaning: what remains is Need delivery. "سلم القفل" in the mock is a ladder, and stays. |
| **M6** Filters | `FilterBar` rewritten: status segment, Mine, "Filters (n)". Timeline and Tasks fold everything else at all widths, others under 768 px. Removable chips while folded. Groups are one Tab stop with arrows, names visible. Mine off by default, marked, sorted first, explicit choice remembered. All 9 pages adopt it, and `FilterDisclosure` is gone. | Walks: Tabs from h1 to first row are 4 on Timeline (was 22) and 7 on Tasks (was 15). Arrows move, Tab leaves, chip removes the filter, Mine remembered over a reload. |
| **M7** Filled button | Rule written in `kit/README.md`. Tasks fills the first claimable Ready row, including in the table, which gained a move column. New task and Invite are outline. | Walks: one filled button in the stack and in the sheet. Looked at the shots. |
| **M8** Empty states | One recipe, documented on `EmptyState`. Decisions, Needs, Handoffs, Releases, Tasks and Members show the next step once, filled, with the header's copy and redundant subtitle hidden. Onboarding addresses the manager and points at Settings › General. | Audit scenario `empty` on all 14. Looked at the shots. |
| **M9** Inbox | Opens on Unread, newest first, with the quick action on each row. One line links to Today for the waiting cards. | Walks and shots. |
| **M10** Needs rule | One line, always visible, not dismissible. `LocationPointer` and the Deliver form unchanged. | Shots at 390 and 1440. First action on phone is now at about y = 565, read from the shot (was 677). |
| **M11** Lead decision | The filled Decide is gone. The recommended option's button is filled (first if none). On a phone each option folds pros and cons behind a disclosure. | Shot at 390. A question with no options keeps a filled Decide. |
| **M12** Board at 390 | Under 768 px the page opens on the list, and an explicit choice is remembered. At 768 px columns are 208 px, so three whole ones show. | Walks: phone opens on list, board choice remembered over a reload. |
| **M13** Dual | `duration` returns the oblique dual by default, since nearly every use follows a preposition or adverb. `{ nominative: true }` for the one subject use («تبقّى يومان»). `rel` inherits it. | Read in the rendered pages ("قبل يومين", "من كريم، قبل يومين"). Needs a native reader, as the review says. |
| **M14** Gender | Toasts and History use verbal nouns or passives. "الحجز: {name}", "دعوة من {name}", revoke and disable dialogs, «على الخط الآن». No gender field. | Grep for the diacritic forms finds none. Walks read the toasts. Mock prose in `hub-today.ts` still has some, listed below. |
| **M15** Copy | All nine rows. History shows kit status and field names, and "no description" only when the section has no text either. | Read in the shots and the History shot. |
| **M16** Arabic keys | `kit/keys.ts`: `matchKey` on `e.code`, `e.key` as fallback, `؟` and Slash. Every handler in the app goes through it; `e.key` now appears only in that file. | Walks: real `j`; synthetic ت/KeyJ, Ctrl+ن/KeyK, ؟/Slash, ظ/Slash, `g k` on an Arabic layout. No physical keyboard. |
| **M17** Focus | The stretched link's whole hit area takes a ring. Inbox, Today, Timeline, Redesign too. | Walks read the pseudo-element's shadow. Looked at the shot. |
| **M18** Focus lost | When the opener is gone, focus goes to its row by id. `v` follows the same card, or stays on the toggle if it is folded away. | Walks: GTV-240 after Deliver, GTV-258 across `v`. |
| **M19** Shortcuts dialog | One row per view from `views[].goKey`, one per new-card key. `d` answers on a row I cannot act on. | Walks: dialog lists `g k`. Sara's `d` gives a toast. |

### Minor

| Finding | What changed | How it was checked |
|---|---|---|
| Sidebar shift | `scrollbar-gutter: stable` on the page. | Audit: the sidebar's left edge at 1440 across all 14 views. |
| False `unblocked` | Emitted only when nothing else blocks the card. | Walks: GTV-259 after deciding GTV-231. |
| Toast slot | Two slots. A plain notice stacks above the Undo. | Walks: blocked `c` after a claim, both on screen. |
| Inbox `e` | Lead item only, and groups never mix read and unread. | Walks: 9, 8, 9. |
| Two filled in the sheet | The header button goes outline while a form is open. | Walks: count 1. |
| Loading states | Onboarding's title no longer depends on data. Every loading view has an `h1` and a status region. | Audit scenario `loading` on all 14. |
| Error codes | `hub.docs.unavailable`, `hub.ask.unavailable`. | Audit scenario `error`. |
| Source fix | A Running pill during the fix, and 21:05 in both Settings and Inbox. | Walks. |
| Onboarding bar | Each cell maps to its own step. | Looked at Sara's shot from the walks. |
| Docs tree | A word and a `title` on stale, `hideType` on recents and the board. | Shot. |
| Form errors | `Field` sets `aria-invalid`, `aria-describedby`, and takes focus. `ActionPanel` focuses the first invalid after a refused submit, including a secret. | Walks: empty Decide, refused secret, empty self-verify note. New decision, New need and other dialogs were not submitted empty. |
| Palette, sheet, Esc | Lands on the `h1`. | Walks. |
| Placeholders, tile copy, «نشطون» | Ellipsis on search placeholders, Ask's is a keyword example. Tile scope and Members fixed. | Read in shots. |

### Not fixed, and why

- **Sidebar badges with eight meanings:** left as they are, as instructed. It stays a note.
- **`hub-today.ts` is off limits,** so some of its strings remain: «سارة استلمته» in Today's Since detail, and other actor-verb mock prose, including in `settings.ts` audit seeds I did not rewrite beyond the role names. I overrode only the one row addressing Sara in the feminine, and the one team total named «تسليمات».
- **Dvorak and AZERTY:** matching on `e.code` means a shortcut follows the key's position on a Latin layout that moves letters. This follows the brief, and is noted in `kit/keys.ts`.
- **Audit keeps its own filter bar:** date inputs and CSV export, not in M6's table.
- **Today can show `hub-today`'s mock meta** on a row whose state has not moved. It clears once the state moves.
- **The critic's Tasks answer stands open:** moves stay hidden from non-claimers. It is noted in Tasks' NOTES as still the owner's call.
- **`F:/Goteav/project-hub/docs`:** not edited, as instructed. The orchestrator is updating them.

### Results

Everything below ran after the last source edit (05:04), in one sitting from 05:41 to 05:49, in a separate headless Chromium. Only Markdown changed afterwards, plus the walk screenshots copied into `pages/*/shots/`.

- **`pnpm typecheck`:** clean, run after the last source edit and before this section was written.
- **Walks:** 80 of 80 checks passed, as owner and Sara, with no console errors. Some are only as strong as their selector, so these are spot checks, not a test suite.
- **14 views × 390, 768, 1440 × ar, en × light, dark (168 pages, 21,340 text nodes):** 0 overflow, 0 slivers. AA: 2 readings under 4.5:1, both on Today at 1440 en light ("Redesign" 4.37, "Need" 4.45). They are rows still fading in when the page was measured. Remeasured on that mode at once and after 2.5 s: 0 failures in 413 nodes. The audit does not wait for motion, so one other transient could have been caught the same way; none was.
- **Five scenarios (default, frontend, empty, loading, error) × 14 views × 2 modes (140 pages):** 0 overflow, 0 AA failures, 0 slivers. Every loading view has an `h1` and a status region. Every error view has an alert.
- **Headers at 320, 390, 430 (42 pages):** 0 overflow, 0 slivers. The narrowest `h1` is 100 px, on one line.
- **Sheets, all 8 types at 390, 768 and 1440 in both themes (32 pages):** 0 overflow, 0 AA failures.
- **Sidebar:** the same left edge on all 14 views at 1440.
- **No coloured edge:** computed styles on every element of those 382 pages, including `::before`, `::after` and inset box-shadows. **0 of 7,152 cards and panels have a side or top border that differs from its others.** 0 coloured or thick one-sided edges, 0 pseudo-element stripes, 0 offset inset shadows. 1,578 neutral 1 px dividers between rows were counted apart, as allowed. The bar check flagged one element, on 2 pages: Onboarding's loading skeleton of its progress bar, which is neutral and is not an edge.
- **Kept, by name, and left out of that count:** sidebar selected marker, tab underline, Timeline day rail, Today's runway chart, the tide line, Onboarding's trail, and Decisions' band rules. The band rules are the one coloured line among them: a 1 px rust or amber rule beside "Overdue" and "Due in 24 h". It is a section divider and I left it, for the owner to judge. Two neutral markers the check did not meet in this default state: Docs' selected tree row and its outline, and a blockquote's neutral side line in a doc.
- **Shots:** 102 refreshed at 05:17, after the last source edit: the version's 12 and each page's. The walks' new ones are in `pages/today`, `needs`, `handoffs` and `tasks`. I looked at a sample in both themes, at the three widths for key pages, not at all of them.

### Not checked

- No screen reader, no physical Arabic keyboard, no touch device.
- PM and accountant personas have no scenario.
- Dialogs not submitted: New decision, New need, New handoff, New release, New card, Invite, Roles, source Add and Edit, Create token.
- Not refreshed, because they are overlays set up by hand: Redesign's three compare shots and its lightbox, Members' `invite-created`, and Settings' `tokens-created` shots. They predate the stripe removal.
- Widths 1024 to 1279 were not in this audit.
- Arabic needs one read by a native editor before port, especially «يخصّني / يخصّك», «على الخط الآن», the dual in `duration`, and the verbal nouns in History.

## Deviations from the plan docs

Items 1, 2 and 4 are owner-approved. The rest need an owner decision.

1. **Owner-approved: Cairo instead of IBM Plex Sans Arabic** (08 §3.2).
2. **Owner-approved: full sidebar groups and neutral cards, with no coloured edge.** 08 §5 asks for a coloured start stripe and a top stripe on the sheet; owner decision 10 removes them. These otherwise follow 08 and replace v2's tinted stack, so v2's deviations 1 and 2 are closed.
3. **Closed: the sheet opens from the end edge**, per 08 §5.3. It first shipped on the start edge from a line in the brief; the review moved it because the end edge keeps the action lane in view.
4. **Owner-approved: the ocellus** uses type hues once, as the brand mark (decorative, `aria-hidden`).
5. **The counters band sits under the title**, as in v2. 09 §4 draws it at the bottom. On phones it moves below the lanes.
6. **Lab-made sparklines.** The API has no counter history, so the series in the band is derived. It is not real data. Trend words are gone until a history endpoint exists.
7. **`CardRow`, not `TimelineItem compact`** (09 §4, P1). There is one row component for the whole app, but it is not the timeline's. The Timeline page may
   want to build on it or may need its own; decide when that page exists.
8. **Since groups by repo**, while 09 §4 says per card. The commit ticks read as a story by repo; per-card grouping adds little to a list of mostly single events.
9. **No routed dot in Awaiting me** (P3). Everything there is routed to me.
10. **Letter hint when no narrative exists**, kept from v2: 09 §4 says the block is absent. The acceptance test should target the `article`.
11. **GTV-219 is promoted into Awaiting me**, kept from v2, and GTV-238 joins as an overdue handoff of another role (owner decision 8), so the owner's stack shows 8 while `counters.awaitingMe` is 6.
12. **Unchosen decision options are muted, not 70 % opacity** (08 §5.4). The doc's dim falls to 3.4:1, under AA.
13. **The palette and tooltips are not `cmdk` and shadcn.** It is a proposal for the real build, which should use `cmdk`.
14. **The toast lasts longer than 08 §5.5's 3 s** when it carries Undo or a command, per the review.

## Verification (2026-11-04, before the review; the current results are under "Review answered")
Run in a separate headless Chromium launched for this work, not the shared browser. `pnpm typecheck` is clean.

- **Contrast:** canvas-composited check of every rendered text node, 1440 / 768 / 390 × ar / en × light / dark: Today (311–421 nodes per mode), 9 sheets covering all 8 types, the palette, a
  placeholder, and the frontend, empty and loading scenarios. 0 AA failures. Lowest pair on Today is 5.23:1 dark and 5.36:1 light, and none is under 4.8:1. The first audit found three real
  failures, all fixed: a deep-linked sheet that portalled outside the tokens, `opacity-80` tab counts, and the doc's 70 % dim on unchosen options.
- **Overflow:** none in those 12 modes, nor in the scenarios or sheets.
- **Phone first screen:** the lead button ends at y = 636 (ar) and 572 (en) of 844. 0 controls under 44 px, counting `hit-44` and stretched-link hit areas, which are pseudo-elements. Heatmap cells are 20 px and are not tap targets.
- **Type sizes on Today:** Arabic has nothing under 13 px. English has 42 % of nodes at 12 px (badges, keys, small labels), and meta lines and body are 13–14 px.
- **Shell:** collapse 248 → 56, persists across reload, `[` `]`, tooltips on icons. Phone drawer opens, Esc closes, focus returns to the menu button, nav closes it.
- **Router:** third segment restored after a hash-only change and after a reload, with an open card; language, theme and scenario kept; Back works. All 13 placeholders load, breadcrumb right, focus on the h1.
- **Palette:** Ctrl+K, `/`, exact key jump, unknown key shows the 404, arrows and `aria-activedescendant`, Esc returns focus.
- **Sheet:** Enter, `o`, Decide all open it; focus trapped over 25 Tabs; Esc returns to the row; a chip inside swaps the card and Esc still returns to the first opener; decide, deliver with the secret filter, comment, add link, watch, withdraw's required reason and archive all run. Restore was not clicked.
- **Keyboard:** `j` `k`; after an action focus is on the next row; toast still open after 11 s with focus in the list; `u` restores row and focus; `c` on a blocked row answers; shortcuts off stops `j` while Ctrl+K works; refresh keeps scroll 1600 and height 3548.
- **Tooltips:** all 5 runway marks at 768, 900, 1024, 1100 and 1280 in ar and en: 0 clipped.
- **Reduced motion:** 0 elements animating; otherwise only the failing source's two pulses.
- **Rule greps:** no hex, physical direction classes, palette classes, literal sizes or gradients in TSX. Every key in `hub-today` is in the catalogue.

Not exercised in a browser: `FilterBar`, which no page uses yet, and the 1100–1279 px sidebar default beyond the tooltip pass. No screen reader was run; names and roles were read from the DOM.

**Shots:** `shots/<width>-<rtl|ltr>-<light|dark>.png`, 12 files of Today, full page. In a full-page shot the sticky sidebar ends at the first viewport; that is the capture, not the layout.

## Data and shared changes
- **New `shared/mocks/hub-app/index.ts`:** the card catalogue, all 8 types with the detail fields of 03 §6, reading its rows from `hub-today`. Adds `GTV-267`.
- `hub-today.ts` was not edited. `lab/src/styles/hub.css` was only touched to rebuild Tailwind; its content did not change.

## Not built here
- The per-type fields of `NewCardDialog`: it creates with type, title, role, priority and details, then opens the card. Decisions, Needs, Handoffs and Releases have their own full dialogs.
- Overflow menu items other than Copy link and Archive/Restore (08 §5.3 also lists edit, priority, role, due, tag).
- Comment `@` and `GTV-` autocomplete, and the swipe-to-archive gesture.

## Open questions
- **Doc conflicts:** `ops` and `docs` specialty mapping (09 §4, 04 §2, 07); Settings read access (04 §2, 09 §18); `request_changes` (10 §6, 04); decision reason length (09, 04); `awaiting=me` (09) or `mine` (04) on Tasks.
- **Backend proposals the design relies on:** the source `diagnosis` object and hourly run strip (not in 04 §3.7); an endpoint for `in_review → in_progress`.
- **Since-last-visit count:** 25 for the owner, on the sidebar and Today, cleared by a Timeline visit. The stream holds more than that in this lab, because each page's mock adds events.
- **Is the letter's voice enough in Cairo?** The critic's favourite detail was Naskh. Please read it on your screen.
- **Time direction in Arabic:** still to test with 2 Arabic-first members. A "later" arrow now states it on the runway.
- **Mock "now" is a Wednesday,** while the spec and mock call it Tuesday (from v2).
- **Missing endpoints:** counter history, `GET /stats/team`.
- **Activity cell:** what does one cell count, and should it be weighted? (from v2)
- **Deadline window:** doc 07 says 48 h; doc 09 and this page say 72 h (from v2).
