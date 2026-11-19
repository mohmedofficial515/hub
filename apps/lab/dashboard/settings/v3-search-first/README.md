---
version: v3-search-first
title: Search first
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (replaced by the command surface: hero search, chips, results, pinned / recent / attention / index)
  - src/features/settings/settings-cluster-page.tsx + components/cluster-layout/* (cluster nav removed; group page gets its own jump menu and scoped search)
  - src/features/settings/components/server/server-settings-group.tsx (header with related groups, sticky save bar, review sheet, history sheet with forward-only restore)
  - src/features/settings/components/server/setting-row.tsx (row anatomy, changed dot, reset to default, pin / copy link / copy key menu, deep-link highlight)
  - src/features/settings/components/server/settings-sections.tsx (sub-sections + "Advanced" fold)
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx (status chips per gateway, masked secret replace)
  - src/features/settings/components/whatsapp-provider/* (status hero + test card)
  - src/features/settings/components/tabs/* (preferences as one page of instant rows)
  - src/features/settings/lib/ (new: field search index with Arabic folding + synonyms, value formatting with Arabic plural units)
  - src/stores/use-settings-store.ts (pinned fields, theme "system" option)
  - src/components/shared/form/fields/* (number stepper with unit, segmented radio with roving tabindex, tag list with ordered up/down)
  - new: unsaved-changes tray across groups (overview), review sheet as readable sentences
ported: # branch / commit once ported
---

# Search first (البحث أولاً)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v3-search-first?lang=ar&theme=light`
Deep links: `&view=group&g=security&f=lockout.maxFailures`, `&view=prefs`, start query `&q=قفل`, filters `&chips=changed,risk`,
persona `&as=admin`, states `&scenario=loading|empty|error` (also switchable in the "Lab preview only" bar at the bottom).

## Idea
The overview is a command surface: one large centred search ("ابحث في 648 إعداداً…") is the only focal point. It reaches
every field of the 33 groups and the personal preferences (labels, help, keys, values and option names, Arabic and English,
with letter folding and a small synonym list: قفل / lockout / حظر, هامش / markup …). Filter chips (changed from default,
high risk, proposed, needs attention, by section) carry live counts and work with or without a query. Results are grouped by
group; every row shows its path (Section › Group › Subsection), the label with the match marked, and either its value or an
inline control (switch, segmented / select, stepper). Inline edits collect in a small "N unsaved changes" tray with Review &
save; preference rows apply at once. Before typing, the same surface shows Pinned fields (editable in place), Recently changed
(from history), Needs attention, and a compact index of the 8 sections → groups (A–Z inside each section), so browsing still
works. A result opens the group page as a focus view scrolled to and lit on the field. This beats the baseline, where search
only matched group names and the page read as a directory.

## Key decisions
- **One save mode per form.** Organisation groups are explicit (draft → review → save, one version per group); preferences
  are instant everywhere, also from search (marked "فوري"). Drafts live per group and survive navigation: the overview tray
  collects drafts from any group, the group page's sticky bar shows that group's count and mentions drafts elsewhere. No
  "leave page?" prompt is needed because nothing is lost by leaving.
- **Review as sentences**: "وجهة الاسترداد: البطاقة ← المحفظة", grouped by group with "الإصدار 17 ← 18". High-risk fields need
  type-to-confirm («تأكيد» / "confirm"); security controls without high risk need a checkbox; everything else saves directly.
  Changes by a non-owner to security / two-person fields become a change request ("ينتظر موافقة مدير ثانٍ"), shown as a pending
  banner and at the top of history. The Save button stays enabled (Primer) and explains what is missing.
- **History** per group with who / when / reason / approvals and readable changes. Restore is forward-only: "استعد الإصدار 12"
  shows the diff and "creates v15", then loads it as a draft that goes through the same review.
- **Markers without stripes**: changed from default = small primary dot (+ word on the group page); unsaved = amber badge;
  proposed = violet badge with proposal id that opens a popover (priority, needs backend); legacy, high risk, security / money /
  two-person controls, read only; group badges for New (`maintenance`), second approver, money controls, owner only.
- **Overlaps** are explained once in the group header (mock `notes` or an audit §9.2 sentence) with related-group chips; each
  group exists once in the index.
- **Special pages**: payment gateways = owner note + source / mode chips per gateway + masked secrets with "Replace key"
  (reveal only what you type); hidden for admins (forbidden state, results count "hidden by your permissions"). WhatsApp = status
  hero (connection, last message, sending on/off) + test message card (validates E.164, simulated send).
- **Keyboard** (review P0): only `/` focuses the page search; Ctrl/Cmd+K is left to the dashboard shell's global search.
  In the search box, ↓ moves into the results, ↑/↓ between rows, **Enter moves to the first result's own control** (switch,
  choice, number) or its label, so the results and the tray stay on screen; **Ctrl/Cmd+Enter** (also inside a row) opens the
  group, and every row has a labelled, tabbable "Open in its group" button. `Esc` clears the query, then the filters.
  The hints row lists all of this.
- **Search quality** (review P1): synonyms match only as whole words (Arabic article / conjunction stripped) or as 4+ letter
  word starts, so «سر», "fx", "key", "code" no longer match inside longer words; the row says which synonym was used
  («وُجد عبر المرادف «fraud»»). One-typo tolerance (edit distance ≤ 1, tokens of 4+ letters) runs only when nothing matches
  as typed, and the row asks «هل تقصد «lockout»». Ranking: exact label / key > label of the group itself (typing "markup"
  ranks Markup rules first) > path > help > value > synonym > typo. Self-test: `parts/search.selftest.ts`, 27 Arabic +
  English queries asserting the top 3 (e.g. «قفل» keeps fraud rules out of the top 3), 27/27 pass, 184 ms for all 27.
- **No layout shift while typing**: the hero no longer collapses; the search box stays where it is and only the area below
  swaps to results. Measured at 1440: the box moved 0 px; layout shift not caused by input 0.0006.
- **Path line**: the section shrinks first (`shrink-[12]`), so «Group › Subsection» stays readable; full path in `title`.
- **Phones**: on ≤ 767 px pinned / recent / attention show 3 items with «اعرض N أخرى», attention text is clamped to two
  lines and the index folds per section; 390 home went from ~4900 px to 2866 px.
- **Touch targets**: every tabbable control is ≥ 44 px up to 1279 px and ≥ 40 px from 1280 px (switch = 48×44 button around
  the 44×24 track, info badges in a 44 px button, steppers 44×44, chips / index links / jump menu 44 px). Measured on home,
  results, group and preferences at 390 / 768 / 1440: 0 targets below the limit.
- **Contrast**: measured by resolving every computed colour through a 1×1 canvas (oklch-safe), compositing backgrounds:
  text 4.5:1 (3:1 large) and form-field borders / switch tracks 3:1, ar + en × light + dark on home, results, group and
  preferences — all pass after strengthening field borders (`border-muted-foreground/85`) and the violet "Proposed" badge.
- **Motion**: results fade in with a short stagger, the tray springs up, the deep-linked row is lit for ~3 s; nothing
  moves on its own. `MotionConfig reducedMotion="user"` and `motion-reduce:` on every transition.
- Numbers stay left-to-right inside Arabic (`bdi`, LRI for `$`), Latin digits, Arabic plural forms via `Intl.PluralRules`
  (5 دقائق، 15 دقيقة، 30 يوماً).
- Lab note: Tailwind only picked up the new classes after `lab/src/styles/dashboard.css` was touched (mtime only, no content
  change), as noted in amount-display v4.

## Verification
- `pnpm lab:check` (2026-11-19): all 40 versions compile. `tsc --noEmit` on this folder (lab tsconfig): 0 errors.
- Search self-test (`parts/search.selftest.ts`, run in a lab frame): 27/27 pass.
- Contrast (canvas-resolved, ar/en × light/dark × home/results/group/preferences): text and form-field boundaries pass;
  the last failure (violet "Proposed" chip inside a segmented option, 4.40:1) was fixed by putting it on the card surface.
- Touch targets: 0 below 44 px (390 / 768) or 40 px (1440) on home, results, group and preferences.
- Typing layout shift: search box moves 0 px; shift not caused by input 0.0006.
- Playwright screenshots (own headless Chromium, websockets blocked): 390 / 768 / 1440 × ar-RTL / en-LTR × light / dark,
  no horizontal overflow, no page errors. `shots/`: the 12 overview shots, `search-` / `group-` / `review-` / `history-` /
  `preferences-` / `gateways-` / `whatsapp-` / `tray-` at 1440-rtl-light and 390-rtl-dark, plus `search-typo-1440-ltr-light`,
  `home-768-rtl-light-compact`, `noresults-`, `forbidden-admin-`, `loading-`, `empty-`, `error-`.

## Porting notes
- Sticky offsets use one CSS variable: `--settings-sticky-top` (height of the shell's sticky top bar; `0px` in the lab, set on
  the page root in `page.tsx`). It drives the sticky search, the group page's jump menu, the facets rail and the
  scroll-margin of deep-linked rows. The save bar uses `--settings-sticky-bottom` (0 unless the shell has a bottom bar).
  Set `--settings-sticky-top` to the shell header height when porting; nothing else needs to change.
- The lab renders every version without the dashboard shell (lab convention), so the stacking with the real top bar is
  untested until the port.

## Open questions
- The synonym list (15 sets in `parts/search.ts`) is a starting point; the owner may want to add business words.
- Should Ctrl/Cmd+K in the shell offer a "search settings" scope that hands the query to this page?
- Saving from the tray across several groups writes one version per group; a partial failure (one group 409) needs a design
  for the real API (today: all-or-nothing per group, others still saved).
- Pinned fields are kept in page state here; in the port they should live per staff member (store or server)?
- Should inline editing from results also cover strings / lists, or stay limited to boolean, enum and numbers (current)?
- The count in the placeholder (648) includes preferences and proposed fields; show only real organisation fields instead?
