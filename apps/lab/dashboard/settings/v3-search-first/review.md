# Review — dashboard/settings/v3-search-first   (2026-11-19)

Status of evidence (read this first). The lab server (`127.0.0.1:7320`) became unresponsive part-way through the audit
(other reviewers plus orphaned headless browsers; even `curl` timed out, then the machine ran out of process slots).
Therefore:

- MEASURED live (own headless Chromium, 1440 px, RTL-ar, light): home renders, no horizontal overflow, 0 page errors,
  0 WCAG-AA contrast failures among text nodes (computed colours via canvas), body font Cairo, no side/top stripes found by
  computed-border scan, 56 interactive elements under 44 px (sizes below). Screenshot: `review-shots/home-1440-ar-light.png`.
  An earlier run (EN-LTR light) gave the same overflow/size numbers; its contrast column was a script bug and is discarded.
- READ from source (file:line given) and from the author's own screenshots in `shots/` (not re-captured by me):
  tablet/mobile/dark, RTL logic, review sheet, save bar, search scoring, keyboard handlers, special pages, forbidden state.
- NOT VERIFIED live (server down): typed-search result lists, layout shift while typing, Tab order with visible focus,
  inline edit + tray, review sheet screenshots, history/restore, preferences, maintenance page, reduced motion, dark/EN contrast.
  Everything in those areas below is marked **[src]** (inferred from code) and should be re-checked once the server is healthy.

| Pillar | Score /5 | One-line verdict |
|---|---|---|
| Hierarchy | 4 | One dominant search box, clear chip row, calm blocks; the home below the fold is too long and equal-weight. |
| Clarity / information architecture | 4 | Field-level search with path + synonyms + "matched in" is a real step up; synonym matching is loose and there is no typo tolerance. |
| Creativity | 3.5 | Command-surface idea is strong, execution is the familiar Linear/Raycast look; hero collapse is the only signature moment. |
| Visual polish | 4 | Tidy, consistent tokens, Cairo, no stripes, good badges; some 11-12 px metadata and a very long mobile home. |
| RTL | 4 | Logical properties and locale-swapped chevrons/arrows are right; a few hard-coded `›` separators and `Send` flip need a look. |
| Accessibility | 3 | Good semantics (searchbox, status, aria-pressed, roving radios, sr-only paths); many targets under 44 px and Enter-hijack behaviour. |
| Responsiveness | 3.5 | No overflow anywhere measured/shown, but 390 px home is ~4900 px tall and the sticky search eats height. |
| Completeness | 4 | Covers nearly the whole must-have list; gaps: typo tolerance, inline edit limited to bool/enum/number, shell integration, Ctrl+K clash. |

## Blocking issues (P0)
1. **Ctrl+K hijack collides with the dashboard's own global search.** `parts/overview.tsx:61-72` binds `Ctrl/Cmd+K` on `window`
   and calls `preventDefault()`. The baseline screenshot (`v1-baseline/1440-rtl-light.png`) shows the real shell already owns
   "Ctrl K" in the top bar. When ported, two components fight for the same shortcut and the shell search becomes unreachable on
   this page. Fix: keep `/` only on this page, or scope Ctrl+K to the shell and focus our box from the shell's palette
   (e.g. "Search settings" scope); decide with the owner.
2. **Enter in the search box navigates away instead of acting.** `overview.tsx:136-138` opens the first hit's group page.
   The concept promises inline edit from results; a keyboard user who types "refund" + Enter loses the results list and
   unsaved-tray context. Fix: Enter focuses/activates the first result's control (or opens only on Ctrl+Enter), keep "open
   group" as the explicit action. [src - verify live]
3. **v3 is shown without the dashboard shell** (no sidebar/top bar, unlike baseline), so comparison is not like-for-like and
   several decisions (global search, breadcrumbs, header actions, sticky offsets `sticky top-0` in `overview.tsx:111`,
   `save-bar.tsx:40`) are unproven inside the real layout where the top bar is already sticky. Fix: render the version inside
   the same frame as baseline or document the offset assumptions; re-test sticky stacking (search + top bar + save bar).

## Improvements
### P1
1. **Touch targets under 44 px (56 elements on home, 1440).** Examples measured: filter chips 40 px high (`overview.tsx:181`
   uses `min-h-11 sm:min-h-10`), path/crumb links on pinned rows 26 px high, stepper buttons 44x42, toggle 44x24, row
   "result" button ~26 px high (`results.tsx:94`, `py-0.5`). Desktop pointer use is tolerable, but the brief asks 44 px and
   the 390 px layout reuses these. Fix: drop the `sm:` reductions for chips/steppers, give result buttons `min-h-11` hit area
   (padding or pseudo-element), increase the switch hit area (wrap in 44 px label).
2. **Synonym matching is substring-based and too loose.** `search.ts:71-87,187-192`: 2-3 letter synonyms (`سر`, `fx`, `key`,
   `code`, `lock`, `block`) are searched as substrings across help/value/path text, so a search like `سر` or `key` will
   match words such as "سرعة", "monkey", "blocked". README already admits "found through a synonym" surprises (قفل matches
   fraud "block"). Fix: match synonyms on word boundaries / whole tokens, require >= 3 chars, cap synonym hits at lower rank
   and group them under a "related" divider, and offer the toggle the README asks about. [src - verify live with `سر`, `key`]
3. **No typo tolerance.** Scoring is `startsWith/includes` only (`search.ts:153-165`); `lokcout` / `refudn` / `ضريبه` variants
   beyond the folding rules return nothing. For a 648-field surface this is the main "search first" failure mode. Fix: add a
   cheap edit-distance-1 fallback for tokens >= 4 chars when no hit, with "did you mean" suggestion.
4. **Mobile/tablet home is a very long scroll** (`shots/390-rtl-light.png` is 4941 px; 768 px about 3400 px): Recently
   changed (6 rows, long markup-rule text), Needs attention (5 paragraphs) and the full 33-group index are all open. The
   baseline home was a bounded grid. Fix: collapse Recently changed to 3 and Needs attention to a one-line list on < md,
   make the index an accordion per section on mobile, keep the pinned block first.
5. **Hero collapse causes layout shift when typing starts.** `overview.tsx:88-106` animates hero height to 0 while the
   search bar glides (`layout="position"`), so the input moves under the cursor on the first keystroke and results jump.
   CLS was not measured live. Fix: reserve the hero space until results render, or move the search once on focus, not on
   input; measure with a PerformanceObserver after the server is back. [src]
6. **Unsaved tray and the group page both claim drafts** across groups; a user who edits from results, navigates, and
   returns relies on the tray alone for orientation (`save-bar.tsx:71-73` only prints "+N in other groups"). Add a link
   from that sentence to the tray/review, otherwise the cross-group drafts are not reachable from the group page.
7. **Path line is truncated** (`results.tsx:81` `truncate`, 12 px). Seen in `review-shots/home-1440-ar-light.png`: the pinned
   path "المدفوعات والمحفظة › سياسة الاسترداد › وجهة الاستر…" loses the last (most specific) segment. Fix: truncate the start
   (keep group + subsection), or wrap to two lines, and expose the full path in `title`/popover.
8. **Inline edit scope** (booleans, enums, numbers only) means strings/lists and secrets always require leaving the page;
   the decision is open in the README. Recommend: keep, but show a visible "open to edit" affordance (a labelled button, not
   only the chevron with `tabIndex={-1}` at `results.tsx:144`) so keyboard users have a non-hover path to the group page.

9. **Synonym matches do not say which synonym matched.** `i18n.ts:85,417` + `results.tsx:74-75` show only "وُجد عبر: كلمة مرادفة"
   ("Found through: a synonym"), so a surprising hit (e.g. fraud "block" for قفل) is unexplained. Fix: print the actual word
   ("وُجد عبر «block»") so the user can judge and trust the result.

### P2
1. `ui.tsx:63,372,79` and `home-blocks.tsx:158,216` use 11-12 px for badges/kbd; fine for secondary info, but the "Needs
   attention" card descriptions and the sub-12 px "%" unit next to steppers (visible at 1440) are hard to read in Arabic.
2. Chip row has 4 filters + "By section" menu with counts that are static (132/67/16/133) - confirm they update with the query
   (README says live) and that `aria-pressed` chips announce the count change via `search-status`.
3. `special.tsx:153` `rtl:-scale-x-100` on the Send icon is correct for a directional icon; check no other directional icons
   (undo `Undo2` in `review-sheet.tsx:189`, history restore) need the same flip in RTL.
4. The separator `›` is a literal character with `aria-hidden` (`results.tsx:84`); it does not mirror in RTL. Visually it reads
   right-to-left correctly only because the whole line is RTL, but use a `chevron` icon with locale swap for consistency.
5. Review sheet footer uses `sm:flex-row-reverse` (`review-sheet.tsx:100`) to put the primary button first; verify in LTR
   that visual order and DOM order do not mislead keyboard users (primary is first in DOM, last visually in LTR).
6. Save button stays enabled and only explains why it cannot proceed (`review-sheet.tsx:101,107-111`), using `aria-disabled`
   plus `role=status`. OK per Primer, but make sure `submit` focus returns to the missing field (type-to-confirm input).
7. Placeholder says "648" while the real organisation field count is lower (preferences + proposed included) - already an
   open question; recommend showing only organisation fields.

## What is better than baseline
- Baseline (`v1-baseline/1440-rtl-light.png`) searches only group names ("تصفية مجموعات الإعدادات") and the page is a directory of
  ~33 cards; v3 reaches every field by label, key, value and option name, shows the full path and the matched-in reason.
  Finding "lockout" goes from 3+ clicks (cluster, group, scroll) to type + Enter/Tab.
- Pinned fields editable in place plus Recently changed (from history) give a real "daily use" home; baseline has none.
- Markers without stripes (dot, badges) comply with the owner rule; no side/top borders found by computed-style scan.
- Changed-from-default, high-risk, proposed and attention filters with counts answer the audit's "where is the risk" question.
- Review-as-sentences with version step ("الإصدار 17 ← 18"), type-to-confirm only for high risk, checkbox for security,
  forward-only restore: all present and well specified in code (`review-sheet.tsx:63-69`, README).
- Arabic/Latin number handling (`bdi`, plural forms), Cairo applied, `MotionConfig reducedMotion="user"` and
  `motion-reduce:animate-none` on spinners; segmented controls use roving tabindex with reading-direction arrows (`ui.tsx:162`).
- Forbidden state for admin on payment gateways is clear and recoverable (`shots/forbidden-admin-390-rtl-light.png`).
- No horizontal overflow and no console errors at 1440 RTL/LTR light (author reports the same for all 12 combos).

## Must-have checklist (status)
| Item | Status |
|---|---|
| Field-level search with path + deep link | Yes (route.ts `view/g/f`, copy link in row menu) |
| Dirty state + sticky save | Yes (tray on home, `save-bar.tsx`) |
| Readable review, no JSON | Yes, sentences per group (source) |
| Confirmations | Yes: type-to-confirm / checkbox |
| History + forward-only restore | Yes per README (not re-verified live) |
| Reset to default | Yes (row menu / per-section) per README |
| Proposed-field marking | Yes (violet badge + popover) |
| Control per field type | Partial: inline for bool/enum/number only; others in group page |
| Overlaps explained without duplication | Yes (header note + related chips) |
| Empty / loading / no-result / permission states | Yes (author shots: empty, error, forbidden); no-result copy exists (`i18n.ts:430`) |
| Typo tolerance | **No** |

## Screenshots
- `review-shots/home-1440-ar-light.png` (mine, live). Author's reference shots in `shots/` were used for tablet/mobile/dark,
  empty/error/forbidden and gateways; baseline comparison used `../v1-baseline/1440-rtl-light.png`.
- Typed-search, keyboard focus, review sheet and history screenshots could not be captured (server unresponsive).

## Verdict
v3 is a clear improvement in findability and daily use over the directory-style baseline: the search surface reaches every
field, shows where it lives and why it matched, lets the owner flip a switch or nudge a number without leaving, and keeps a
safe review step with sentence diffs and risk-scaled confirmation, all while staying tidy, stripe-free and Cairo-correct.
It is not yet approvable: the Ctrl+K and Enter behaviours conflict with the host shell and with the inline-edit promise, the
synonym/typo behaviour of the core feature is both too loose and too brittle, hit areas fall short of 44 px, and the home is
far too long on phones. Fix the three blocking items, tighten search quality, and re-run the live checks marked [src]
(typed searches, keyboard order, CLS, review sheet, history, dark/EN contrast) before moving it to review status.
