# Review — dashboard/settings/v7-readiness-journey   (2026-11-19)

Reviewer: independent UX critic. Method: own headless Chromium (Playwright, one browser at a time), dev server of the lab,
screenshots in `review-shots/`. Widths 1440 / 768 / 390, ar-RTL + en-LTR, light + dark. Contrast was measured with a
canvas colour probe (resolves oklch/color-mix), touch targets and overflow with DOM boxes, focus by real Tab presses.
Baseline compared: `../v1-baseline/*.png` and `../audit.md`.

## Scores (1-5)

| Pillar | Score | One-line verdict |
|---|---|---|
| Hierarchy & focus | 4 | One clear focal point (dial + "Next: ... Continue"); the open-check list below is flat and long, so the focus is lost after the first screen. |
| Clarity / information architecture | 3.5 | The question "what is next?" is answered well, but the score mixes "waiting for you" with "waiting for backend", and Setup/Operate is a weak fit for a live platform. |
| Creativity | 4.5 | The sector dial that doubles as the section map is original and memorable; shape + colour redundancy is a real idea. |
| Visual polish | 4 | Tidy, consistent tokens, Cairo throughout, no card stripes; some density and duplication problems inside group pages. |
| RTL / bilingual | 4.5 | Logical properties only (no `ml/mr/left/right` in source), dial direction mirrored, arrows and ladders handled; small clipping of Arabic descriptions in collapsed steps. |
| Accessibility | 3 | Visible focus on every control, sound sheet focus trap, reduced motion honoured; but amber/violet marks under 3:1, 32-36px targets, focus lost after closing a sheet / picking a search result. |
| Responsiveness | 3.5 | Zero horizontal overflow at 390/768/1440 in every capture; but the 390 Setup page is ~9,200px tall and the stepper wastes 64px of gutter. |
| Completeness | 4 | Nearly the whole must-have list is present (see checklist); gaps: no "expand all" for experts, drafts and deep link `sheet=review` do not survive reload, no persistence of mode. |

## Blocking issues (P0)

None that block the concept. Two items are close to blocking and are listed as P1 because the owner may decide differently: the
score definition (P1-1) and the non-text contrast of the status marks (P1-3).

> Not verified end to end: "Save as version 15" then the score changing. During the audit the shared lab hot-reloaded
> (`[vite] hot updated /src/frame/mount.tsx`, written by someone else) every time I reached the save step and wiped the in-memory
> state, so I could neither confirm nor refute the README claim that the score animates after a save. The review sheet itself,
> the type-to-confirm field, the sentence diff and the enabled Save button were confirmed (apply3-en.png, apply3-ar.png).

## Findings

### P1

**P1-1. The score (58 %, 22/38) cannot be completed by the owner, and the red "P0" pills sit on items the owner cannot act on.**
Where: `parts/readiness.ts` (score = done/total, `BLOCKING_KINDS`), `parts/dial.tsx` (centre number), `parts/journey.tsx:224` (priority pill). Screenshot: `ov-1440-en-dark.png`, `shots/` overview.
Evidence: 38 checks = 22 done + 5 to do + 11 backend. Even if the owner finishes every item that is theirs, the dial stops at 27/38 = 71 %. 11 of the 16 "Open" cards are backend items, and four of them carry a red P0 pill (KVKK, TÜRSAB, maintenance dashboard) next to "Open field", a button that leads to a preview field that is not even sent.
Why it matters: a number that is shown big and never reaches 100 % by the person's own effort is demotivating, and red P0 on something you cannot fix creates anxiety, which is exactly the risk in the brief. The sentence under the dial ("5 wait for you, 11 wait for backend work") is honest, but the number is not.
Fix: make the headline ring = "your part" (done / (done + todo)), show "backend" as a separate, quiet hollow-ring row ("11 will count when the backend ships"); drop the red pill for `blocked` rows (use neutral text "P0 for backend"); default the filter to "To do" (5), not "Open" (16). This is the first open question in the README; my answer is to split the figure, not to hide it.

**P1-2. Setup/Operate resets to Setup on every visit; for a platform that is already live the first screen is the wrong one.**
Where: `parts/store.tsx` `writeHash` (mode only in the hash, only when not `setup`), `parts/overview.tsx`. Screenshot: `operate-1440-ar-light.png` (the Operate page is the better daily page).
Evidence: the header is "Launch readiness" and the subtitle "Get the platform ready for launch" even though the mock has live gateways, 14 versions of the security group and a staff team. Operate has no persisted preference; an expert returns to Setup each time and must click Operate.
Fix: persist the last mode (localStorage, wrapped in try/catch), default to Operate when readiness >= a threshold or when any gateway is live, and rename the Setup hero for a live system ("Hardening checklist" / "Open recommendations") instead of "Launch". Keep a compact readiness chip on Operate (it already exists and is good, `operate-1440-ar-light.png` top row).

**P1-3. Non-text contrast of the status marks fails 3:1 in the light theme, and the "backend" bar segment fails in both themes.**
Where: `parts/dial.tsx:115` (`stroke-warning`), `dial.tsx:202` (`bg-accent-violet/45`), `dial.tsx:236` MiniRing track. Measured with the canvas probe (card background):

| Mark | Light | Dark |
|---|---|---|
| done tick (green) | 5.19 | 5.92 |
| to-do tick (amber, 7 px) | **2.29** | 8.39 |
| backend ring (violet outline) | 4.40 | 3.64 |
| section bar, amber segment vs its track | **2.10** | 7.38 |
| section bar, backend segment (violet at 45 %) vs track | **1.73** | **1.41** |

Why it matters: the "waiting for you" state is the one the person must find, and in light mode its amber is the weakest mark. In the section bars the backend segment is almost invisible; the shape cue exists on the dial but not in the bars.
Fix: use the darker amber token already used for text (`warning-strong`) for strokes; give the backend bar segment a 2 px violet outline or diagonal hatch instead of 45 % alpha; in `MiniRing` draw the backend share (today it is painted exactly like the empty track, so a stop with only backend items looks "0 % done, nothing to do").

**P1-4. "Waiting for you" vs "waiting for server": legible without colour on the dial and cards, not in the section bars, mini rings, step markers at 390.**
Where: `dial.tsx` (bars), `dial.tsx:223-245` MiniRing, `group-page.tsx:277-286` step marker, `group-page.tsx:309` (text pill is `hidden sm:inline-flex`).
Evidence: on the dial the shapes differ (long bar / short heavy bar / hollow ring): good. On check cards an icon (CircleDot vs ServerCog) plus pill text ("Proposed S-01", "New F-03", env name) carries it: good. But the section bars separate the three states by colour only, the MiniRing by colour only, and at 390 the step state text is `sr-only`, leaving amber solid circle vs violet dashed circle (a weak, borderline cue).
Fix: add the text/shape cue to bars and rings (see P1-3) and show the state word at 390 in the step header (it fits under the title).

**P1-5. The stepper is good for a first-time walk, but slows experts on groups with many fields.**
Where: `group-page.tsx:142-240` (`active` = one open step), `group-page.tsx:289` (`ps-12` rail gutter). Screenshots: `group-1440-ar-light.png`, `group-ip-390-ar-dark.png`.
Evidence: Security has 4 steps and about 15 fields; opening step 3 collapses step 2; there is no "expand all" and no jump list; moving between fields in two steps costs 2 clicks and a re-scroll. Search and related-chips do skip it, which helps, but a returning expert who knows the group has no way to see it flat.
Fix: add "Show all steps" (a toggle next to the progress bar that opens every step and remembers the choice per user); allow more than one open step; keep the numbered rail as navigation only. For groups with a single subsection hide the stepper entirely.

**P1-6. Duplicated explanation inside one step.**
Where: `group-page.tsx:331-335` (CheckCard compact in the step) plus `field-row.tsx` (own "why it matters" + "Recommended: On  Use"). Screenshots: `apply3-en.png` (left), `group-ip-390-ar-dark.png`.
Evidence: for the admin IP allow-list the same "Why it matters: Limits the dashboard to the office network 85.105.12.0/24" appears twice within about 250px, and "Recommended On" appears three times (card pill, field pill, "Matches the recommendation" after apply). At 390 this pushes the real control about 700px below the step title.
Fix: when a CheckCard is shown for a field, suppress the field's own why-box and recommended pill, or collapse the card to one line that scrolls to the field. This is the "overlaps explained without duplication" item of the must-have list; it is only half met.

**P1-7. Touch targets under 44 px (measured, interactive elements only; prototype controls at the bottom excluded).**
| Element | Size | Where |
|---|---|---|
| Copy-field-link icon (one per field) | **32 x 32** (and `opacity-60`) | `field-row.tsx:84` `size-8` |
| "Use" (recommended value) | 58 x 32 | `field-row.tsx:127` `min-h-8` |
| "Reset to default" / "Undo" | 121 x 32 | `field-row.tsx:140,153` `min-h-8` |
| Remove CIDR chip | 36 x 36 | `controls.tsx:290` `size-9` |
| Related-group chips ("Verification policy" ...) | 98-131 x 36 | `group-page.tsx:129` `min-h-9` |
| Filter segmented (Open / To do / Needs backend / Done / All) | 40 high | `ui.tsx` Segmented |
| "Proposed S-01", "New F-03", env pills (tooltip buttons) | 102-136 x 30 | `journey.tsx:281-315` |
| Theme / language chips in Preferences | 40 high | `preferences.tsx` |
| "My preferences" icon at 390 | 42 x 44 | `page.tsx` TopBar |

The README says the copy-link is 32 px: confirmed. 32 px passes WCAG 2.5.8 (24 px) but misses the brief's 44 px and the icon at 60 % opacity is also low-contrast. Fix: keep the 18 px icon, raise the hit area to 44 (`size-11` with negative margin) or move the action into a per-field "..." menu next to Reset; raise the other items to `min-h-11`.

### P2

**P2-1. Focus is dropped to `<body>` after closing the review sheet and after picking a search result.**
Where: `sheets.tsx` SideSheet close handler; `search.tsx` pick handler / `group-page.tsx:58-60` (heading focus only when no `focus`). Evidence: pressing Esc on the review sheet leaves `document.activeElement` = BODY (measured, both languages); after Enter on a search hit the active element is BODY, so the next Tab starts at the top of the page, not at the field that pulses. Fix: return focus to the opener on close; on search/deep link focus the target field's control.

**P2-2. Drafts and the `sheet=review` deep link do not survive a reload.** Where: `store.tsx` (state in memory, `sheet` written to the hash). Evidence: reload with `...&sheet=review` opens the sheet with "No changes to review" (seen once during the audit when the lab hot-reloaded). The README says drafts "survive navigation" (true in-session). Fix: either persist drafts in `sessionStorage` or stop writing `sheet=review` to the hash.

**P2-3. The Save button is disabled with 50 % opacity and no stated reason.** Where: `sheets.tsx:163`; measured opacity 0.5; `Add` in the CIDR field computes 3.36:1 (below 4.5). Evidence: while the type-to-confirm field is empty the only hint is the label above the input; the button itself gives no reason. Fix: keep it enabled-looking but `aria-disabled` with a helper line "Type 'confirm' to enable"; use `disabled:opacity-100` with a muted fill. (Disabled controls are WCAG-exempt, but this button is the main action of the sheet.) Same for "Save keys / Save account" on gateways/WhatsApp.

**P2-4. Collapsed step descriptions are cut with an ellipsis in Arabic and English** (`group-page.tsx:305`, `truncate`): "من أين وكيف يدخل الموظفون إلى لوحة التح..." (`mobile` shot of Security, 390). Fix: allow two lines (`line-clamp-2`).

**P2-5. 390 stepper: no overlap, but 64px of a 358px viewport is lost to the rail.** Evidence (measured): card x = 16 to 326, step marker 338 to 374, rail 355 to 357, so the README's "card overlapping the stepper line" is **not reproduced**; the cost is width instead. The copy-link icon also wraps to its own row beside the badges ("High impact / Security control") at 390, adding about 40px per field. Fix: at < 640 px put the number inside the step header and drop the rail gutter; keep the copy-link inline with the label (see P1-7).

**P2-6. The 390 Setup page is about 9,165px tall (about 10 screens).** Evidence: `ov-390-ar-dark.png`. 16 open cards each carry title, missing, why, path, now, recommended and two buttons. Fix: show the path and "why" behind a disclosure on mobile; put the 11 backend items in one collapsed "Waiting for the backend (11)" group per section (also solves P1-1).

**P2-7. Empty state ("ready to launch") keeps eight empty stops.** `state-empty-1440-ar-light.png`: 100 % with a good headline and a "Open Operate" call to action, but below it eight "Section ready / n checks done" rows fill about 1,400px of air. Fix: collapse the journey to one line "All 38 checks done" with the done list behind a disclosure; keep the CTA.

**P2-8. `title`-only tooltips on dial ticks (`dial.tsx` `<title>`) are mouse-only.** The dial has a good `aria-label` for the total, but individual ticks are not focusable; acceptable because every tick is repeated in the list below. Mention only; no change needed unless the dial becomes an interactive filter.

**P2-9. Section header count label sits far from the title on desktop** (`journey.tsx:74`, `sm:justify-between`), e.g. "1 needs backend, 5 done" at the opposite edge of the 1180px column; keep it under the description.

## Checklist: the must-have list

| Item | Result |
|---|---|
| Field-level search with path + deep link | Present: combobox, Section > Group > Subsection, chips with counts, hash carries focus. Focus is lost after the pick (P2-1). |
| Dirty state + sticky save bar | Present (`SaveBar`, "n unsaved changes", per-step "1 change" pill). |
| Readable review (no JSON) | Present: sentences `label: old -> new`, markers for high impact / security / two-person / proposed. |
| Confirmations | Present: type-to-confirm for `risk: high`, checkbox for security, owner / second-approver message. |
| History + forward-only restore | Present (`history-1440-ar-light.png`): "restore v13 creates v15", staged through review. |
| Reset to default | Present per field and per step ("Reset step to default"). |
| Proposed-field marking | Present (violet "Proposed S-xx" pill, "not sent" note). |
| Control per field type | Present: stepper, chips, ordered list, masked secret, switch. |
| Overlaps explained without duplication | Half: related chips yes; duplicated why-text inside steps (P1-6). |
| Empty / loading / no-result / permission | Present: `state-empty`, `state-loading`, `state-error`, `search-none`, `state-admin`, `state-none`. |

## Owner rules

- No coloured side/top stripes on cards: **passed** (rails are neutral 2px lines outside cards; progress lives in rings and bars; no `border-l/r/t-*` colour classes found in `parts/*.tsx`).
- RTL logical properties: **passed** (grep for `ml-/mr-/pl-/pr-/left-/right-/text-left/right/border-l/r` in the source returns nothing).
- Cairo font: **passed** (rendered text in Arabic and Latin is Cairo in every capture).
- Horizontal overflow: **0 px** in all captures at 390 / 768 / 1440, both languages and themes.
- Layout shift: CLS = 0 on first load (1440 en light). Reduced motion: 0 running animations with `prefers-reduced-motion: reduce`.
- Console: no page errors from the version.

## Keyboard walk (overview, 1440, en and ar)

Tab order: My preferences > Search > Setup/Operate switch > Continue > the 8 section bars (reading order, row by row, mirrored in Arabic) > filter (Open) > first card (Apply recommendation, Open field) > "Proposed S-01" tooltip button > Open field > ... > "5 checks done" disclosure. Every stop had a visible ring (the 3px ring token). Observations: 12 tab stops (8 section bars + filter) before the first actionable card; the "Proposed S-xx" tooltip buttons are extra stops that only reveal a tooltip, so a keyboard user passes about 16 of them. In the review sheet Tab cycles Close > Reason field > Back to editing > Save (trap works). Esc closes (focus is then lost, P2-1).

## Improvements (not defects)

1. Merge the filter counts into plain words: "Open 16 / To do 5 / Needs backend 11" is clear, but "Done 22 / All 38" next to it dilutes it; move Done/All into a "Show done" toggle.
2. Say what counts: add a "How this score is calculated" popover (38 checks, saved values only, backend items included) next to the number; the README explains it but the product does not.
3. The Operate page is strong (`operate-1440-ar-light.png`): recent changes, one list per section with the live state, attention pills. Consider making it the landing page and putting the readiness figure in its existing chip.
4. The dial colour mapping "amber = to do" reads as a warning; for a checklist the person works through, a neutral dark tick for "to do" with the amber reserved for real problems (security attention) would calm the page (the P1-3 fix may be enough).
5. Group header: version, author and relative time sit in a 12px grey line; they matter for the history feature, so use 13px.

## What is better than the baseline

- v1 opens with a catalogue of groups behind a section list and a filter; v7 opens with one answer ("58 %, next: Admin IP allow-list, Continue"): the main task of "what should I do next?" goes from reading and scanning a tabbed grid to one click. Deep-linking from "Open field" or search lands on the exact field in the right step.
- The dial is the section map, so the overview carries two layers of information in one object. The shape redundancy (bar / heavy bar / ring) is a real accessibility idea, not decoration.
- Review-before-save is a side sheet with sentences, risk markers and type-to-confirm, instead of a flat confirm dialog; history shows author, note and forward-only restore.
- Search finds fields, not groups, and shows the path.
- Group pages explain "why it matters" and offer the recommended value with one click ("Use"), which the baseline never does.
- Sticky save bar with "n unsaved changes" replaces the baseline's per-card save.
- Contrast of all body text passed the probe in both themes and both languages (no failures except a disabled "Add" button at 3.36:1 and the lab's own "Loading..." fallback text).

## Verdict

v7 is clearly better than the baseline and is the most distinctive of the options: the dial-as-map and the Setup/Operate split show real product thinking, the technical hygiene (logical properties, Cairo, no stripes, zero overflow, zero layout shift, visible focus, reduced motion) is professional, and the review/history flow is the best treatment of risk I have seen in this lab. It is held back by one conceptual problem and a handful of craft ones: the headline number counts items the owner cannot influence and decorates them with red P0 pills, so the page can make a healthy platform look unfinished; the Setup mode is the default for a platform that is already live; amber and the backend segment are too faint to carry their state in the light theme; and several controls (32-36px) and focus-return paths miss the bar the brief sets. Fix the score definition and mode default (P1-1, P1-2), raise the mark contrast and targets (P1-3, P1-7), de-duplicate the in-step explanations (P1-6), and this version is ready for approval; none of the issues requires a change of concept.

## Screenshots

All in `review-shots/` (this folder). Naming: `<view>-<width>-<lang>-<theme>.png`.
- Overview Setup: `ov-1440-ar-light`, `ov-1440-en-light`, `ov-1440-en-dark`, `ov-768-ar-light`, `ov-768-en-dark`, `ov-390-ar-dark`, `ov-390-en-light`, `ov-390-ar-light`
- Operate: `operate-1440-ar-light`, `operate-1440-en-dark`, `operate-768-ar-light`, `operate-390-*`
- Group page / steps: `group-1440-ar-light`, `group-1440-en-dark`, `group-768-ar-light`, `group-390-*`, `group-ip-1440-ar-light`, `group-ip-390-ar-dark`
- Apply recommendation then review sheet: `apply3-en.png`, `apply3-ar.png`, `apply-review-1440-en-light.png`
- History: `history-1440-ar-light`, `history-390-ar-dark`
- Preferences: `prefs-1440-ar-light`, `prefs-390-ar-dark`
- Special pages and maintenance: `gateways-1440-ar-light`, `whatsapp-1440-ar-light`, `maintenance-1440-ar-light`, `loyalty-1440-ar-light`
- States: `state-empty-1440-ar-light`, `state-loading-1440-ar-light`, `state-error-1440-en-dark`, `state-admin-1440-ar-light`, `state-none-1440-ar-light`, `search-none-1440-en-light`, `search-typed-1440-en-light`
- Focus: `focus-after-30tabs-en.png`, `focus-after-30tabs-ar.png`, `focus-apply-en.png`, `focus-apply-ar.png`

Captures taken while the shared lab hot-reloaded were blank; they were deleted or re-captured. The files listed above were checked by eye or by a no-reload marker. The 768 px set is partial (overview, operate, group, history); 768 was otherwise checked by the overflow/target metrics only.
