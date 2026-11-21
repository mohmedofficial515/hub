# Review — amount-display/v3-conversion-forward   (2026-11-10)

Reviewer: independent UX critic. Evidence: own Playwright contexts (1440 / 768 / 390, ar-RTL + en-LTR, light + dark), the
page's own `money-core.ts` executed in Node (self-test + 150 extra inputs), computed contrast via canvas, element boxes,
keyboard walks, aria snapshots. Not verified: real screen readers, real touch hardware, Safari, reduced-motion, catalog-load
layout shift (the lab server stalled during the last round; the "Equivalent column" tooltip and decisions toggles (a)-(e) were
judged from code + screenshots, not flipped live).

| Pillar | Score /5 | One-line verdict |
|---|---|---|
| Hierarchy (number vs sign chip vs unit) | 4 | Figure dominates, sign chip is calm, sign height matches digits (21.8 px vs 21.0 px at 30 px); cents are not dimmed and table codes are tiny. |
| Accessibility | 3 | One label per amount and `aria-hidden` signs are right; radiogroup has no arrow keys, scrub announces twice with raw numbers, 32 px header targets. |
| RTL / LTR | 4 | Sign left of figure in both languages, never mirrored, Latin digits only; remaining defects are a clipped table and the lang toggle glyph. |
| Conversion clarity | 4 | Basis bar + chip + receipt + "View in" tell the story well; the bar flickers on scroll and the tile chips are redundant when the bar is visible. |
| Switcher UX | 4 | Keyboard, search, focus return, live previews and RTL placement all work; user-menu variant is a weaker twin of the drawer. |
| Visual polish | 3.5 | Strong overall; uneven KPI tile heights, stranded donut legend values, 414 px overflow at 390 (en), mixed K/M units in a table column. |

## Blocking issues (must fix before approval)

**P1-1  Basis bar flickers while scrolling through y≈90 px (layout shift, CLS 0.076).**
`parts/basis-bar.tsx:16-22` toggles `collapsed` at `scrollY > 90` and swaps `display:none`/`flex`, which changes the sticky
stack height 134 -> 116 px. The browser then shifts scroll position (95 became 77), the handler flips back, and the bar
oscillates. Measured by sampling every frame during a slow wheel scroll at 1440: `96:false 78:true 96:false 90:true 108:false 102:true 114:true`.
Why it matters: the central claim of the concept is a calm persistent bar; today it visibly jitters. Fix: hysteresis
(collapse > 120, expand < 40), or make the bar non-sticky and only the header sticky, or animate to a fixed-height
collapsed state with `transform`/`grid-template-rows` so document height does not change.

**P1-2  "View in" radiogroup is not operable as a radio group.** `#live [role=radiogroup]`, 1440 en and ar: ArrowRight /
ArrowLeft do nothing (focus stays, nothing checks), both radios are `tabindex=0`. Four groups all named just "View in".
Why: WCAG 4.1.2 / APG radio pattern; keyboard users must Tab then Space on each, and screen readers cannot tell which card.
Fix: roving tabindex + arrow handling (reuse Radix ToggleGroup type=single), and `aria-label` "View in — {card title}".

**P1-3  Scrub announcements are doubled and unformatted.** After ArrowLeft on the chart, `[aria-live]` regions contain
`8 Nov·2,055,212.18` (tile title, no currency) and a second region `8 Nov: 2055212.1775 SAR` (raw 4-decimal float-looking
string, no grouping). Violates the page's own "one label per amount" rule. Fix: keep one polite region with
`amountText()` (grouped, 2 decimals, currency name) and drop `aria-live` from the tile title.

## Improvements

| Sev | Where | What | Fix |
|---|---|---|---|
| P2 | `parts/states.tsx` (States section), 390 en light and dark | Page overflows: scrollWidth 414 > 390; "Catalog loading" and "Unknown currency" cards run 12-414 px. | `min-w-0`/`grid-cols-1`, let the inner `bg-muted/40` row wrap. |
| P2 | Tables section 1440 ar (also visible in `ar-dark-tables`) | "Remaining" column of the bookings table is clipped at the card's left edge ("₺ 2.25M" cut). | Give the table `min-w` + its own `overflow-x:auto` with a visible scroll affordance, or let the facts panel go below at <1600. |
| P2 | Table columns (`table-demo.tsx`, section 5) | Column rule yields mixed units in one column (`4.25M`, `2M`, `18.8M`, `12.5K`, `1.25K`) and cents vanish: 12,450.75 shows `12.5K`. Tabular alignment is lost exactly where exactness matters. | Compact a table column only from 10M, or force one unit per column (all K or all M, one decimal), never mix. |
| P2 | Compaction ladder, my inputs | 999,999,999,999 and 1,000,000,000,000 -> `1,000B` / `1,000B`; 1.5 trillion -> `1,500B`. Same family as the author's `123,457B`. Reads as an error. | Add `T` (1T, 1.5T) or fall back to the exact grouped number above 999B; recommend adding `T`. |
| P2 | KPI tiles live demo (`kpi.tsx`) | "Average booking" tile: chip wraps to its own line, pushing the figure ~24 px lower, so the 4 tiles in the row have uneven rhythm. After override to USD the chip still says "from converted sums". | Shorten chip ("converted") or move it to the footer line; recompute chip text from the override. |
| P2 | Donut legend (`charts.tsx`, 1440) | Values column sits ~430 px away from the label/percent column; rows cannot be tracked. | Keep value adjacent (grid `auto 1fr auto`), max-width on the legend. |
| P2 | Per-tile basis chips | On a page where all tiles share one basis they are noise (6 chips + bar + "View in"). | Show a tile chip only when the tile's basis differs from the page basis (balances "USD balance", override "USD · no conversion", ratios). The bar/collapsed chip states the common basis. |
| P2 | Mobile (390) sticky stack | Header 56 + basis chip (`min-h-11` = 44) is always pinned: about 130 px (15 %) of an 844 px screen for a basis statement. | Let the bar chip scroll away on mobile; keep the header sticky. |
| P2 | `receipt.tsx` | Receipt is a table of metadata plus a flat rate sparkline (min/avg/max all 3.7500 in the mock) and no per-source breakdown ("how much of this came from TRY at which rate"). Title says "Output: Gross sales" even when opened from the generic bar. | Add a 3-5 row source breakdown (currency, share, avg rate); show a plain rate line instead of an empty chart when flat; name the figure only when opened from a tile. |
| P2 | Header targets | Mobile header buttons 32 px (lang 78x32, theme/quick/bell 32x32, burger 36); gaps 4 px. | Judgement: 32 px passes WCAG 2.5.8 (24 px) and keeps preserve-design, so do not grow them visually. Add an invisible hit-area extension to 44 px (`::after` inset -6px) on `<sm`; new controls are already 44 (menu rows 44-46, drawer rows 44). |
| P2 | Dark primary buttons | "Run self-test" / "Refund the amount..." white on green = 2.71:1 (computed). | Darken the dark-mode primary or use dark text; real-project token, check before port. |
| P3 | Switcher placement | Plan 6.1 says between theme and fullscreen; built before theme (ar: lang 450, switcher 370, theme 334). Pill is 76x32 against 32x32 neighbours. | Accept the pill (needed for sign+code), but move after theme to match the plan, or update the plan. |
| P3 | `switcher.tsx:128` | Focus ring `ring-2 ring-primary/40` is a 40 % ring, likely < 3:1. | Use `ring-ring/60` like the other new controls. |
| P3 | Switcher rows | "30-day sales" caption (10 px) repeats on all 10 rows. | Say it once in the footer/header; keep the amount only. |
| P3 | User-menu currency sub-list (390) | Radio rows with code + name only: no search, no live previews, 5 rows visible; the drawer has both. In ar the dot sits at the left. | Reuse `CurrencyList` in a sub-sheet, or link the menu item to the drawer list. |
| P3 | Amount buttons | Every compact amount is a tab stop with name = value only (15 in the live demo). | Add `aria-haspopup="dialog"` and a short description "exact value"; consider one tab stop per card. |
| P3 | Section headings | Numbering 11, 1-7, "5+", 9, 10 (no 8). | Renumber. |
| P3 | Language toggle replica | The inactive glyph is clipped at 390 en ("ε" cut) and measures 2.2-2.6:1. | Replica artefact; verify against real header before copying. |
| P3 | a11y demo code sample (ar) | `aria-label="12,345,678.50 ريال سعودي"` renders with scrambled quote order (RTL code block). | `dir="ltr"` on `<code>`. |
| P3 | Cents | Plan suggested lighter cents; not applied, so `12,345,678.50` reads flat in detail views. | Decide in the port; low value. |

## Compaction ladder — verified (Node, same `money-core.ts`)
Self-test: 38/38 PASS. My inputs: 999,950 -> `1M`; 999,500 -> `1M`; 999,499.99 -> `999K`; 1,500 chart -> `1.5K`; 1,500 kpi stays `1,500.00`
(below 10,000, matches plan); 1,049 chart -> `1.05K`; 10,049 -> `10K`; 99,999.5 -> `100K`; -999,950 -> `-1M`; 0.5 -> `0.50`;
KWD 1234.5678 -> `1,234.568`; JPY 1234.5 -> `1,235`; 15-digit -> `123,457B`; no trailing `.0` anywhere. Only the >999B case is wrong (see P2).

## Amount in words — linguistic check (ar / en)
| Value | Arabic output | Verdict |
|---|---|---|
| 1,250 SAR | ألف ومئتان وخمسون ريالاً سعودياً | Correct. |
| 1,000,000 SAR | مليون ريال سعودي | Correct. |
| 2,500.75 SAR | ألفان وخمسمئة ريال سعودي وخمس وسبعون هللة | Correct (feminine halala). |
| 0.50 SAR | خمسون هللة | Correct. |
| 200 SAR | مئتان ريال سعودي | **Wrong**: before the counted noun the dual drops its nun: مئتا ريال. |
| 2,000 SAR | ألفان ريال سعودي | **Wrong**: ألفا ريال. |
| 2,000,000 SAR | مليونان ريال سعودي | **Wrong**: مليونا ريال. |
| 101 SAR | مئة وواحد ريالاً سعودياً | Doubtful: cheque style is مئة وريال سعودي واحد (same for 1,001). |
| 12,345,678.90 AED | اثنا عشر مليون وثلاثمئة ... ألف ... | Missing tanween on the scaled nouns (مليوناً، ألفاً) in cheque style. |
| 1.01 / 2.10 SAR | ريال سعودي واحد وهللة واحدة / ريالان سعوديان وعشر هللات | Correct. |
English: all of 1,250 / 1,000,000 / 2,500.75 / 0.50 / 1.01 / 2.02 / KWD fils read correctly ("two US dollars and two cents"). Consider the Arabic
"فقط ... لا غير" suffix for cheque idiom. A native linguist review is still needed before the port (author already says so).

## Concept claims — verdicts
- **Basis bar**: trust, not noise, at 1440 (one calm line, "How is this calculated?" at the end). Weak points: the flicker (P1-1) and the permanent chip on mobile.
- **Per-tile chips**: too many on single-basis pages; keep only exceptions (see table).
- **"View in" per card**: not confusing: the group highlights the override, chip flips to "USD · no conversion", page pill stays SAR, and a visible "Reset to SAR" link appears. Needs P1-2 and a card-specific label.
- **Equivalent column (default off)**: not exercised live; the facts panel + hover text is acceptable because the table-row detail is reachable by keyboard (row button, `aria-pressed`). Do not add a per-cell trigger.
- **Receipt**: clear, modal semantics correct (aria-modal, labelled, Tab trapped, Esc returns focus to the opener); content needs the source breakdown.
- **Chart-scrub title swap**: works by hover and arrows (title shows `28 Oct · 1,146,843.08`), same size; announcement is the problem (P1-3).
- **Words in confirmations**: dialog is clear (amount, words, check box, disabled confirm); fix the dual forms.
- **SAMA**: sign left of figure with 0.25em space in ar and en, never mirrored (transform is only a 1.6 px nudge), `currentColor` so dark mode is automatic, negative `﷼ -1,250.00`, height 21.8 vs digits 21.0 (+3.8 %). Conforms.
- **Exact value**: hover and focus open the tooltip, Enter opens the popover, focus moves to "How is this calculated?", Esc returns to the amount. Good. aria: 100 of 100 signs `aria-hidden`.
- **Owner rules**: no coloured side/top card borders found; header 56 px and 32 px controls preserved; Latin digits only in ar.
- **Contrast** (canvas-computed): muted text passes 4.5:1 everywhere except the items listed above; table sign at opacity .7 = 6.5:1 light / 8.7:1 dark; table code (10.1 px) 5.3:1 / 6.6:1.

## Decision toggles — recommendations
- **(a) Arabic negative**: keep leading `﷼ -1,250.00` in one LTR isolate (SAMA rule 4; reference case E). Trailing form moves the minus under bidi reordering risk.
- **(b) Chart time axis**: not flipped live; recommend LTR time axis with Latin digits even in Arabic (the Y axis is already left; mirroring would move the latest point away from the tile and conflict with arrow-key semantics). Confirm with owner on a real chart.
- **(c) `$` vs `USD`**: keep "auto" (sign only when unique among enabled currencies), but decide once per page, not per surface: today KPI shows `$` while the table shows tiny `USD`.
- **(d) `≈`**: keep only on equivalents (balances "≈ ﷼ 6,909,939.00 at today's rate"); converted KPIs already carry a basis chip and need no `≈`.
- **(e) Sign box**: keep 0.725em (measured +3.8 % over digits; 0.8em would be about +14 %, breaking SAMA rule 7).

## What is better than baseline
Currency is never implied (pill, bar, chip, receipt); sign no longer flips in RTL; one label per amount; compaction is correct at the carry points; exact value is one focus away; tables are end-aligned with a single column rule; irreversible actions repeat the amount in words.

## Verdict
**Needs a fix round, then usable as the basis for the port.** Fix: P1-1 flicker, P1-2 radiogroup, P1-3 announcements, then the 390 overflow, clipped table, T unit / mixed units, tile chip policy, dual-form Arabic words.

## Screenshots
`review-shots/` (added after browsing stopped): `1440-ar-dark-top.png`, `390-en-light-top.png`, `sw-open-ar-dark.png`, `sw-open-en-light.png`, `m-drawer-ar-dark.png`, `m-usermenu-cur-ar-dark.png`, `receipt-ar-1440.png`, `viewin-usd-en.png`, `1440-ar-dark-tables.png`, `1440-ar-dark-ladder.png`, `bar-scrolled-en.png`, `scrub-kb-en.png`.
