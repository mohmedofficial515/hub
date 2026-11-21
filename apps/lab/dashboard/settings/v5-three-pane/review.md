# Review — dashboard/settings/v5-three-pane   (2026-11-19)

Reviewer: independent UX critic. Method: own headless Chromium + Playwright (not the shared MCPs), URL
`frame-dashboard.html#/settings/v5-three-pane?lang=..&theme=..`. Screenshots in `review-shots/` (mine, prefixes `land-`, `a-`, `b-`,
`group-`). The author's own `shots/` folder was used only as a stand-in for states I could not re-capture (see "Coverage and limits").

## Scores (1–5)

| Pillar | Score | One-line verdict |
|---|---|---|
| Hierarchy & focus | 4 | Clear 4-level hierarchy (rail > list > header > fields); state dots, pills and the sticky save bar read at a glance. Dense chrome above the first field at 390. |
| Clarity / information architecture | 4 | Every group is one click away, search is field-level, overlaps explained once. The "state of settings" landing is good but reachable only by deselecting. |
| Creativity | 3 | Mail-client explorer is a proven, professional pattern rather than a surprise; the inspector, scroll-spy subsection chips and "sentence" review are the original touches. |
| Visual polish | 4 | Calm neutral surfaces, consistent pills, Cairo everywhere, no stripes. Some mid-word wraps and low-emphasis text sizes (11–12px). |
| RTL | 4.5 | Logical properties, mirrored chevrons and panes, `<bdi>` for mixed values, correct pane sides. Only the dir=ltr mono key wrapping and a few clipped crumbs. |
| Accessibility | 2.5 | Good semantics (aria-current, labels, roving list keys, 44px rail) but focus is lost after every dialog/sheet/Back, and many touch targets are below 44px on phones. |
| Responsiveness | 3.5 | No horizontal overflow at 1440/768/390; drill-in orientation (Back + breadcrumb) is solid, but browser Back leaves the app and the 768 landing is cramped. |
| Completeness | 4.5 | Nearly every must-have is present and working (see checklist). Few gaps: no standalone overview route, no disabled state on type-to-confirm, proposed pill is a dead button. |

Overall: clearly better than the v1 baseline for the "find and change one setting safely" task; not yet shippable until the P0 items are fixed.

## Blocking issues (P0)

1. **Focus is lost to `<body>` after closing sheets/dialogs and after Back.**
   Evidence (390 RTL, clean run): opening the history sheet via the History button, then Esc -> `document.activeElement` = BODY. Same after the
   unsaved-changes guard Esc, after the review dialog Esc (1440), and after pressing the drill-in Back button at 390 (focus BODY, list shown).
   Why: keyboard and screen-reader users lose their place in a 3-pane app, the exact orientation problem this layout must avoid.
   Where: `parts/page.tsx` `InspectorSheet` (controlled `Dialog.Root` with no `Dialog.Trigger`, no `onCloseAutoFocus`); `parts/ui.tsx` `Modal`
   (same, used by `ReviewDialog` and `GuardDialog` in `parts/review.tsx`); `parts/editor.tsx:99` `BackBtn` navigates without moving focus.
   Fix: remember `document.activeElement` when opening, restore it in `onCloseAutoFocus` (`e.preventDefault(); prev.focus()`); after Back
   focus the list item for the group just left (`[data-group=<key>]`) and after drilling in focus the editor `h1` (tabIndex -1).
   (Inspector Esc at 1440 is fine: focus stays on the History button.)
2. **Browser Back / hardware Back leaves the app instead of going up one drill level.**
   Evidence: 390 RTL, home -> section -> group -> app Back button -> `page.goBack()` ended at `about:blank`; `writeHash` uses
   `history.replaceState` only, and `pane` is not in the hash (`?s=platform` at list level, `?g=platform` at editor level, nothing for "home").
   Why: on phones and tablets (the drill-in widths) the system Back gesture is the primary way up; dropping the user out of Settings and
   discarding drafts is a data-loss-adjacent surprise.
   Where: `parts/lib.ts:202` `writeHash`; `parts/store.tsx:110` effect and `commit()`.
   Fix: `pushState` when the drill level changes below 1024 (home/list/editor), `popstate` listener that calls `setPane`; keep
   `replaceState` for in-place changes (field focus). Route Back through the unsaved-changes guard.
3. **Touch targets below 44px on phone/tablet, including the key switch control.**
   Evidence (390, measured boxes): switch `32x18` (every boolean field); subsection chips `x36`; language/segmented options `40`; filter chips
   `127x36 / 52x36 / 67x36` (28px at 768 and 1440); breadcrumb crumbs `51x18` / `88x18`; history and field-info icon buttons `32x32` at md (768 is a touch
   width but `IconBtn` is `size-11 md:size-8`, `parts/ui.tsx:106`); sheet tab `57x44` ok. 77 controls < 44px at 1440 (mostly 28–36, acceptable with a mouse).
   Why: the owner manages settings from a phone ("many devices"), and misfiring a high-risk switch is costly.
   Fix: give switch, chips and crumbs a 44px hit area on coarse pointers (`@media (pointer:coarse)` or `max-md`), switch to `md` -> `lg`
   breakpoints for `IconBtn`; keep visual size via padding/`::after`.

## Improvements

### P1
- **Contrast not verified numerically.** My computed-contrast pass was invalidated (the tokens are `oklch()`; my first parser read them as rgb) and
  the dev server hung before the re-run. Visually, risk spots to re-measure: `text-11`/`text-12` muted text (`oklch(.52 .02 256)` on `bg-muted`),
  the warning "غير محفوظ" and "جديد" pills, the pale placeholder `security` in the type-to-confirm input (`parts/review.tsx:116`), muted old
  value (struck-through, 12px). Target 4.5:1 for all of these.
- **Mid-word wrapping of the monospace key in the inspector**: `security.adminIpAllowlist.ena|bled` (`a-guard-1440-rtl-light.png`, `parts/inspector.tsx`).
  Likely `break-all`; break on dot boundaries instead (`<wbr>` after each `.`) or use a copy chip with horizontal scroll.
- **Focus lands nowhere visible after "drill in" at 390**: after tapping a section (list) or a group (editor) `activeElement` = BODY. Move focus to the
  new pane heading so TalkBack/VoiceOver announce the context change (`parts/page.tsx` pane switch).
- **Proposed pill is a button that does nothing** (`parts/field-row.tsx:94`): it is a tab stop with only a tooltip, and at 390 touch there is no hover.
  Make it a non-interactive `<span>` with `aria-describedby`, or open the inspector Field tab on press.
- **Type-to-confirm button is enabled while the input is empty** (`a-review-1440-rtl-light.png`, red "حفظ كإصدار 15"). Validation fires on click.
  Disable until it matches (or `aria-disabled` + helper text), so the danger button is not clickable by reflex.
- **Browser tab order is long**: rail (13 stops) + search + chips + every list row are separate tab stops before the editor. The list uses arrow
  keys (`listKeys`) but is not a roving tabindex group. Make the list a single tab stop (roving) and add a "skip to editor" link
  (`parts/page.tsx`); Tab order measured at 1440: rail > search > 3 chips > 6 groups > crumbs > history > inspector toggle > subsection chips > fields (logical, just long).
- **390 first fold is mostly chrome**: path strip (~100px with chips) + header + description + overlap note + group title before the first field;
  the save bar adds ~66px. See `b-editor-390-rtl-light.png`. Collapse the overlap note behind the "related" disclosure on phones, and truncate
  the header description to one line.
- **Redundant Back + breadcrumb "Settings"** at 390 (`b-list-390-rtl-light.png`): both go to the same place; the crumb is an 18px target. Keep Back
  and make crumbs non-interactive below `md`, or drop the root crumb.
- **768 landing is cramped**: the landing and the full 34-group list sit side by side with a 370px editor column (`land-768-rtl-light.png`) —
  the stats grid wraps to 2x2 and the attention rows truncate with "...". Either hide the landing at md (show only the list) or show a 2-column
  rail+editor with the list as a flyout (the open question in the README; I recommend the flyout).
- **Save bar text clipped at 390**: "لا تغييرات · الإصدار 9 · Sara Haddad, قبل س..." (`b-editor-390-rtl-light.png`). Show only version on phones.

### P2
- Overview is not a first-class route: at 1440 the "state of settings" disappears as soon as a group is opened and the rail icon is unlabeled
  (icons only; labels appear via the expand toggle). The user who "just wants a status picture" must know the first rail icon is "overview". Add a persistent
  "Overview" row at the top of the list column and show attention dots in the rail with a text count (already partly there). At 390 the status
  is *below* the 8 section rows (`land-390-rtl-light.png`) — consider the stats strip first, sections second.
- Rail icon-only by default: 51x44 buttons with tooltips; an expanded toggle exists but its icon (`ChevronsLeftRight`) does not say "expand".
- Subsection chips in the sticky strip use a filled dark pill for the current one: strong, but when the path strip has 7 chips they scroll
  off the edge at 390 with only a clipped chip as the cue (`b-editor-390-rtl-light.png`); add a fade or arrows.
- The `Custom colour` input in preferences is empty with no placeholder (`shots/prefs-1440-rtl-light.png`).
- `Pill` text is `text-11` (11px) with tone tints; fine as supporting info, but "High impact" must not be the only cue for a dangerous field.
- Mock-only copy "تُطبَّق فوراً في هذا المتصفح" sits top-left in the prefs path strip on desktop and is easy to miss; repeat it in the page header.

## Findings by area (checks you asked for)

| Check | Result | Evidence |
|---|---|---|
| Horizontal overflow | None at 1440 / 768 / 390, RTL + LTR, light + dark (`scrollWidth - clientWidth = 0`) | `land-*`, `b-*` |
| Layout shift | No visible shift in my captures; editor enters with `x:±18` + opacity (reduced motion: opacity only, `editor.tsx:159`) | source + shots |
| Reduced motion | Handled in code: `useReducedMotion`, `motion-reduce:animate-none` on sheets/overlays, smooth scroll becomes `auto`, flash highlight does not pulse | `editor.tsx:86,159`, `field-row.tsx:77`, `page.tsx` sheet |
| Selected list item | Neutral `bg-muted` fill + bold title + primary icon tile, no coloured edge bar | `list.tsx:176`, `a-group-1440-rtl-light.png` |
| Coloured side/top card stripes | None found (callouts are neutral surfaces with a coloured icon) | `editor.tsx:188-195`, shots |
| RTL logical properties | `ps/pe/ms/me/start/end`, `border-s/e`, `rtl:rotate-180` used throughout; panes and sheets mirror correctly | shots |
| Cairo | `Cairo, sans-serif` as body font in AR and EN | computed style |
| Keyboard | `/` focuses search; Esc closes inline inspector at xl; arrow keys move in lists; Enter opens a result and focuses the field; Radix traps focus in dialogs; guard dialog focuses the safe "Stay" option | runs A/C scripts, `page.tsx`, `list.tsx` |
| Visible focus | `focus-visible:ring-2` on all tab stops measured; the switch and text input show the ring inside the row (inputs use border+ring/40, low emphasis) | tab-order run |
| Console errors | None in all captured runs | |

### Must-have checklist
- Field-level search with path + deep link: present (`/`, results show Section > Group > Subsection + current value, `?g=&f=`).
- Dirty state + sticky save: present (save bar always visible, "1 unsaved change" count, list shows "غير محفوظ" pill, subsection chip shows a dot).
- Readable review, no JSON: present (sentences "Label: old -> new", plus high-impact/security pills and "applies at once (you are the owner)").
- Confirmations: present (type group key for high risk, checkbox for security, optional reason); see P1 on disabled button.
- History + forward-only restore: present (timeline, "Restore vN" creates vN+1 through the same review).
- Reset to default: per field, per subsection, and per preference tab.
- Proposed marking: present (`مقترح` + id pills); see P1 on its dead button.
- Control per field type: stepper with range, segmented radiogroup, tag input, ordered list, masked secret.
- Overlaps explained without duplication: neutral "related" note + chips under the header, "Stored in" pill on moved fields.
- States: loading/error/no-results/permission-hidden/pending approval are implemented; I verified no-results and hidden only via the author's shots (`shots/noresults-390-rtl-light.png`, `shots/hidden-1440-ltr-light.png`).

## What is better than baseline
- Baseline needed three clicks (overview card -> cluster tab -> group) and had no field search; here a group is one click from anywhere
  (rail -> list row) and any field is one `/` away. A setting is found, edited and reviewed without leaving the page.
- Baseline gave no state signal; here every list row carries state dot, version, "N changed", and unsaved / new / pending pills, and the
  landing lists the five groups needing attention with a one-sentence reason.
- Baseline save had a weak diff; here the review is a readable sentence list with risk gating and a history timeline with safe forward restore.
- Mobile: a real drill-in with Back + breadcrumb, and the inspector as a bottom sheet, rather than a squeezed desktop layout.
- Dark mode and LTR render consistently (`land-1440-ltr-dark.png`).

## Is the missing standalone overview a problem?
Partly. The landing ("State of settings": 34 groups / 626 fields / 117 changed / 5 need attention, needs-attention list, recently changed, proposed by
priority) is genuinely good and answers the "status picture" need. The problem is discoverability and persistence: at 1440 it is the first thing
you see but vanishes after the first click and can only be summoned through an unlabeled rail icon; at 390 it sits below eight section rows; at
768 it is squeezed beside the full list. For people who only want status, give it a stable address (`#/settings` with a labelled "Overview" row at the
top of the list column) and keep a one-line status strip ("5 need attention, 117 changed") in the list header on every screen.

## Coverage and limits (honest)
- Captured and inspected myself: landing 1440 (RTL/LTR x light/dark), 768 and 390 (RTL light + dark, LTR light); group editor 1440 RTL light with
  dirty state, guard, review (high-risk), history inspector; 390 list, editor, scrolled editor, history sheet. Focus order, focus return,
  touch-target, overflow and keyboard measurements are from those runs.
- The shared dev server became unresponsive during the session (other reviewers running), so these were NOT re-captured by me and rely on the
  author's `shots/` and source reading: 768 editor/back/sheet interaction, 390 LTR dark editor (blank capture, discarded), loading/error/hidden/
  gateways/WhatsApp/maintenance/preferences pages, search results, a long group at 390, and computed contrast (my first pass was invalid, see P1).
  Treat those items as "needs one more pass".
- The inspector sheet, history restore and guard flows were exercised only at 1440 RTL light and 390 RTL light.

## Screenshots (`review-shots/`)
- `land-1440-rtl-light.png`, `land-1440-rtl-dark.png`, `land-1440-ltr-light.png`, `land-1440-ltr-dark.png` — landing, desktop.
- `land-768-rtl-light.png`, `land-768-rtl-dark.png`, `land-768-ltr-light.png` — landing, tablet (cramped editor column).
- `land-390-rtl-light.png`, `land-390-rtl-dark.png`, `land-390-ltr-light.png` — mobile home (sections first, status below).
- `a-group-1440-rtl-light.png` — group editor + inspector; `a-dirty-1440-rtl-light.png` — dirty bar; `a-guard-1440-rtl-light.png` — guard;
  `a-review-1440-rtl-light.png` — review dialog (high risk); `a-history-1440-rtl-light.png` — history timeline.
- `b-list-390-rtl-light.png` — drill-in list level; `b-editor-390-rtl-light.png`, `b-editor-scrolled-390-rtl-light.png` — editor;
  `b-deeplink-390-rtl-light.png` — deep link; `b-sheet-history-390-rtl-light.png` — bottom sheet.
- `b-editor-390-ltr-dark.png` — blank (page failed to render during capture; ignore).
- `probe.png`, `group-1440-rtl-light.png` — early blank captures from a slow load; ignore.

## Verdict
V5 is the most practical-feeling of the concepts: a mail-client explorer that turns settings into a status board with field-level search, a
sentence-style review and forward-only history, and it clearly beats the baseline on speed, safety and orientation, with strong RTL craft and
no owner-rule violations. It is less surprising than creative, and its weaknesses sit in the seams: focus is dropped after every dialog,
sheet and Back, the phone drill-in is not in browser history, touch targets (the switch at 32x18 above all) are too small for the
phone-first owner, and the overview is hard to find. Fix the three P0 items and the 768 layout, re-measure contrast, and it is ready for approval.
