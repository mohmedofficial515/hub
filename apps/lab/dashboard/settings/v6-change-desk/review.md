# Review — dashboard/settings/v6-change-desk   (2026-11-19)

Evidence and its limits. Live (own headless Chrome, `review-shots/`): overview at 1440/768/390, ar+en, light+dark (overflow, fonts, target sizes measured); the review & apply screen as senior staff with `draft=sample` (reason required, security checkbox, type-to-confirm error: `review-1440-light.png`, `review-err2-1440-light.png`). Not reproducible live: the shared lab on :7320 was overloaded by parallel reviewers (HTML took 16 s, pages returned blank mid-run), so tray open/closed at 390, partial-failure retry, as-of, timeline, prefs, search, group page and keyboard focus order were judged from the author's `shots/` (inspected: tray-open, review, applied with `fail=last`, asof, timeline, prefs, group-staged, 390 tray) plus a read of `page.tsx` and `parts/*`. Those items are marked (author shot/code). Contrast was NOT computed from live DOM; colour remarks are visual and from tokens. No console errors seen other than one 404 asset at first load (1440 ar light).

## Scores (1–5)

| Pillar | Score | One-line verdict |
|---|---|---|
| Hierarchy | 3.5 | Strong ticket/dock metaphor, but the overview opens with an empty ticket + latest changes + as-of card and pushes the real settings index below the fold. |
| Clarity / information architecture | 3.5 | One mental model (stage → review → apply → timeline) is coherent and honest; the cost is a mandatory ticket for trivial edits and a draft that dies on reload. |
| Creativity | 4.5 | Ticket stub with perforation, impact sentences, as-of view and forward-only restore are genuinely new; the strongest concept of the set. |
| Visual polish | 3.5 | Tidy cards, good tokens and Cairo; dense long group pages, 11 px text, mixed-script rows and a permanently floating empty dock. |
| RTL | 4 | Logical properties throughout (no `ml/mr/left/right` in source), arrows mirror, `bdi` for codes; weak spots are mixed-direction strings and Western-digit date input. |
| Accessibility | 3 | Combobox/listbox, aria-expanded, reduced-motion, 44 px on mobile; but 36/28 px controls on desktop, grey "ready" button, no leave-guard, 11 px text. |
| Responsiveness | 3.5 | No horizontal overflow at 390/768/1440 (scrollWidth == clientWidth on all shots measured); mobile page is very long and the dock eats ~72 px permanently. |
| Completeness | 4 | Nearly every must-have is present; gaps are draft persistence, a real batch contract, and per-field validation errors before staging. |

## Blocking issues (P0)

1. **The draft is not persistent, contrary to the concept ("one persistent draft ticket").** `parts/store.tsx` keeps `draft` in `useState` only (no storage, no server, no `beforeunload`/router guard; grep for `localStorage|sessionStorage|beforeunload|useBlocker` finds nothing). A reload, a language/theme switch via hash or a back navigation out of the page silently discards all staged changes with no warning. For a model whose whole promise is "your edits wait for you", this is the main trust risk. Fix: persist per-staff draft (server or at least `sessionStorage`), add a `beforeunload` guard while `count > 0`, and show a "restored draft" notice.
2. **Staging makes the trivial case slower than a direct save and the feedback is quiet.** Single edit today: edit field → (silent stage, `quiet=true`) → open Review → type a ≥ 8-char reason → Apply = 4 steps and a separate page, versus edit → Save. Stage is shown only by a faint tint, a dot count on the dock and the "in draft" row; there is no toast on the first stage (`stage(..., quiet = true)`). Fix: for a one-field, low-risk ticket offer a "Save now" shortcut in the row/dock (reason optional below a risk threshold), and show a one-time coach toast "Saved to draft CHG-0427, not applied yet".
3. **Partial-failure result reads as success.** With `&fail=last` (author shot `shots/1440-ar-light-applied.png`, code `review.tsx:84`) the heading is "Applied 3 groups" with a green check while the 4th group shows a red "not applied: the group changed during your review / 409" row and a small "Retry" button. The proposal label is honest (a "Proposed" badge plus the note that the server saves one group per request), but the end state is a half-applied platform presented under a success title. Fix: when any group failed use a warning heading "3 of 4 groups applied, 1 needs attention", keep the icon amber, add links to the applied versions, and make Retry full-size (it is a `size="sm"` button). Also the failure text hard-codes "Omar Kaya" (`review.tsx:108`).

## Findings (P1)

- **Overview first screen (1440 ar light, `review-shots/ov-1440-ar-light.png`)**: the ticket card ("no changes in the draft", with three how-to tiles) + "latest changes" + as-of card occupy the whole first screen; the 8-section settings index starts below 900 px. The empty dock then repeats the same "no changes" message a second time. Responsible: `parts/overview.tsx`, `parts/tray.tsx`. Fix: collapse the ticket card to a one-line strip when empty, keep how-to tiles for first run only, put the section index first.
- **Permanent empty dock** (`tray.tsx` renders the dock even at `count === 0`, on every page including prefs and as-of): covers ~56 px of content at 1440 and ~72 px at 390 (`pb-40` on the page compensates but the page is 4,800 px tall on mobile). Fix: show the dock only when `count > 0`, or reduce to a small ticket button.
- **Touch/pointer targets (measured)**: overview at 1440 has 10 controls under 44 px: search input 416x40, tab buttons 36 px (`page.tsx` `sm:min-h-9`), role segmented buttons 28 px ("المالك" 56x28, "موظف أول" 81x28), "open the timeline" link 32 px. At 390 (ar dark) the overview has zero controls under 44 px, so mobile passes. On the review screen at 1440 there are 19 controls under 44 px (tabs 36, role 28, back button 36). All pass WCAG 2.2 AA (24 px) but fail the brief's 44 px rule on desktop; acceptable for a mouse-driven admin, but the role switch at 28 px is the worst and is a lab-only control anyway.
- **Tiny text**: `text-11` is used 25 times (field keys, badges, impact meta); 11 px Arabic Cairo is hard to read. Raise to 12 px minimum.
- **Mixed-script rows** (as-of and latest changes): lines like "Europe/Istanbul: المنطقة الزمنية" and "SAW → ESB" and the margin rule line "… 10 داخل تركيا 20 … TRY ← 3٪" run bidi-confusingly; wrap value fragments in `<bdi>` per token and keep the label outside. (`parts/format.ts`, `parts/entry.tsx`, `ov-1440-ar-light.png` latest-changes card.)
- **Date field** shows `10/03/2026` (Western digits, month-first in the overview, `٠٣/١٠/٢٠٢٦` in as-of) – two formats for the same date on the same page; ambiguous for a Turkish/Arabic audience. Use an explicit `d MMM yyyy` display next to the native input.
- **Impact arithmetic**: markup sample "1,000 → 1,062 → 1,067" at 6 → 6.5 % is consistent only if a fixed ≈ 2 USD component exists; this is not shown, so the reader sees 6 % = 1,062 and may think the engine is wrong. Tax sample "1,000 + 200 = 1,200 at 20 %" is correct; lockout "1 → 5 → 15 → 60 min" and refund "7 days vs 10" read correctly; approval threshold sample uses 300 USD while README says 500. Fix: show "6 % + 2 USD fixed fee" and unify the sample amount.
- **Review button looks disabled but is clickable** (`opacity-80` on the primary Apply when `!ready`, `review.tsx:285`) and its feedback is the checklist only; use `aria-disabled` + a real disabled style, or keep enabled with the error summary focused.
- **Type-to-confirm** placeholder is `text-muted-foreground/60` (below 4.5:1); the typed text is forced uppercase-compared (`chg-0427` accepted) which is fine, but say so.
- **Search**: per README `/` focuses it; field-level results with path and value are good (author shot `1440-ar-light-search.png`); deep link `f=` pulses the field. Ensure the pulse is not the only cue (respect reduced motion).
- **Role switch "العرض بصلاحية"** in the header is a prototype control; label it "lab only" so it is not ported.
- **Long group pages** (wallet top-up 11 fields, `1440-ar-light-group-staged.png` is 4,400 px tall) have no sticky "N staged" in-page summary other than the dock; subsection index is sticky only from `lg`.

## Improvements (P2)

- Offer "Review" keyboard shortcut and a visible "Esc closes tray" hint.
- Timeline: JSON button is secondary – good; add a filter-result count aria-live and "clear filters".
- History restore buttons read "restore v33 (creates v35)" – good; add the target diff before staging.
- Preferences: clearly instant (banner "تطبق فوراً ولا تدخل تذكرة التغييرات" + dock note). Keep, but put the same one-liner in the dock on every non-prefs page title so users learn the split.
- Gateway keys / WhatsApp credentials save at once while their switches stage: add a small inline "saved at once" vs "in draft" badge per control (author describes it in README but both live on one form).
- Color swatches: keyboard radio group verified in code; add visible selected check for colour-blind users (the ring is the only cue).

## What is better than baseline

- Baseline directory of cards with no state → status board: version, author, attention counts, changes-from-default, draft count (`overview.tsx`).
- Review before apply is readable sentences with units, impact and risk, JSON secondary.
- No per-group Save bars; no amber edge stripes. Staged = faint tint + "In draft" badge; changed-from-default = dot. The ticket perforation is a dashed divider with two notches inside a bordered card, not a coloured side/top stripe.
- Field-level bilingual search with path + value + deep link (baseline: group names only).
- As-of view (reconstructed from history, differences highlighted as tinted pills "then" vs "today") and a cross-group timeline with filters, pagination ("show more (23 remaining)") and forward-only restore.
- Overlaps explained once with `related` chips and one-line reasons.

## Screenshots

Own captures in `review-shots/`: `ov-1440-ar-light.png`, `ov-1440-ar-light-full.png`, `ov-1440-ar-dark.png`, `ov-768-ar-dark.png`, `ov-768-en-light.png`, `ov-768-en-dark.png`, `ov-390-ar-dark.png`, `ov-390-en-light.png`, `ov-390-en-dark.png`, `review-1440-light.png`, `review-err2-1440-light.png` (blank captures caused by lab overload were deleted; 390 ar light, 768 ar light, 1440 en light and dark overview, 1440 tray/apply/retry and all group, as-of, timeline, prefs and search captures are missing, see "Evidence and its limits"). Author flows inspected: `shots/1440-ar-light-{tray-open,review,applied,asof,timeline,prefs,group-staged}.png`, `shots/390-ar-dark-tray-open.png`.

## Answers to the key UX questions

- **Simple edit slower than direct save?** Yes: stage (silent) → open Review → write a ≥ 8-char reason → Apply, on a separate page. Nothing offers a fast path for one low-risk field. See P0-2.
- **Clear what is saved vs only drafted?** Mostly. Group pages carry "your edits are added to ticket CHG-0427, nothing changes for customers yet", staged rows have a tint, "In draft" badge and a "في المسودة: old → new" line, the dock shows the count. Preferences say "applied at once" in a banner and in the dock. Weak point: gateway keys and credentials save instantly on the same page where switches stage (no per-control badge).
- **Draft on navigation/reload?** Survives in-app navigation (store lives above the router) and the dock stays; dies on reload/hash language switch, with no warning. See P0-1.
- **Impact previews:** markup (6 % → 6.5 %: 1,062 → 1,067) needs its fixed fee explained; tax (20 %: 1,000 + 200 = 1,200) correct; lockout ("after 3 failed tries in 15 min the account locks 1 → 5 → 15 → 60 min") clear; refund days and threshold clear but the threshold sample (300 USD) differs from the README (500).
- **Tray on 390** (author shot): bottom sheet with scrim, review button always visible, no overlap with sticky bars seen; but it is a full-height sheet (≈ 85 % of the viewport) with 5 changes and the "Discard all" action sits at the far end of the header; the closed dock permanently costs ~72 px.
- **Owner rules:** no coloured side/top stripes found (source has no `border-s-2/4`, no `before:` bars; staged tint + dot only); perforation is dashed divider + notches between stub and body, reads as a ticket not a stripe. Logical properties only (no physical `ml/mr/left/right/text-left` in `page.tsx` or `parts/*`). Cairo is the resolved body font at 1440 ar/en and 390 ar dark.
- **No horizontal overflow** (scrollWidth == clientWidth at 1440 ar light, 1440 en dark, 390 ar dark; tab bar scrolls inside its own container on 390).

## Verdict

v6 is the most original and the most "professional-ops" concept: it replaces a pile of forms with a single, honest change process, and its impact sentences, risk tiers, second-approver notice and time-travel views are what a settings area for money and security should have. It is held back by trade-offs it has not resolved: a non-persistent draft, an obligatory review page for one-field edits, a dock that is always present, and a first screen that explains the ticket instead of showing settings. Fix the draft persistence and add a fast path for a single low-risk change, and it becomes approvable; as it stands it is a strong draft, not ready to approve.
