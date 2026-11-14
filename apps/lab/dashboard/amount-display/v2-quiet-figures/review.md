# Review — dashboard/amount-display/v2-quiet-figures   (2026-11-10)

Method: isolated Playwright contexts (Chromium) at 1440/768/390 x ar-RTL/en-LTR x light/dark, keyboard walk, touch emulation, computed contrast (canvas-resolved colours), pixel measurement of the sign, accessibility snapshots, and the money-core run directly in Node. Web Interface Guidelines applied to the part files.
Limits: the lab dev server stopped answering mid-review (shared with the v3 reviewer), so these were NOT exercised live: the five decision toggles (judged from code and from what I had already seen), layout shift on catalogue load (judged from code), and the page's own self-test button (I ran `runSelfTest()` from `parts/money-core.ts` in Node instead: 35/35 pass). Tablet 768 was checked for overflow and by screenshot only.

| Pillar | Score /5 | One-line verdict |
|---|---|---|
| Hierarchy (number vs sign/unit/cents) | 4 | The number is the hero on every surface; weakness is cents at 60% stacked on muted tone. |
| Accessibility | 3 | One label per amount and sign hidden (good); but sticky hover card, no touch path in tables, 2.5-3:1 cents, "≈" lost for screen readers. |
| RTL / LTR | 3 | Isolate approach is solid and identical in both languages; chart axis labels clip in RTL, hint chip floats over content. |
| Conversion clarity | 3 | Receipt content is excellent; the cue that opens it (1.5px dotted line) is too quiet and only one tile says "converted". |
| Switcher UX | 4 | Keyboard, search, focus return, mobile menu/drawer all work at 44px; bare-glyph trigger and weak hint copy. |
| Visual polish | 4 | Calm, consistent, real dashboard measurements kept; small 9-10px codes/units and a few truncations. |

## Blocking issues (must fix before approval)

**P1-1. Hover card does not close after the mouse leaves.** `parts/amount.tsx` `Reveal`: onPointerLeave sets open=false, Radix then returns focus to the trigger, and `onFocus` + `:focus-visible` reopens it. Reproduced at 1440 (with and without a prior click): after hover then move away, `[role=dialog]` stays `data-state=open` with the trigger focused. It closes only on Esc / outside click; moving the mouse toward the card closes it, so the exact value can never be selected or copied. Fix: `onCloseAutoFocus={(e)=>e.preventDefault()}` on the content, and open on focus only when focus came from the keyboard (not programmatic).

**P1-2. Table cells give touch users no exact value and no equivalent.** `parts/table-demo.tsx` `TotalCell` (Radix Tooltip on `span[tabindex=0]`). At 390 with touch, tapping a Total cell opens nothing (screenshot `m-table-tap-en-light.png`); the note under the table itself says "Hover or Tab to a total". In a compacted column ("1.23K" KWD, "215K" EGP) the exact amount and the converted equivalent are unreachable on phones, contradicting the README claim that touch gets the same card. Fix: use `Reveal` (Popover) with `role="button"` on the span (no nested button); keep the tooltip only as the mouse affordance.

**P1-3. Cents at 60% opacity fail contrast when the amount is not plain foreground.** Measured, blended against the real background: neutral foreground cents 4.64:1 light, 6.31:1 dark (pass, light barely). Muted columns/tones (`Margin` column, `Due 0.00`, converted equivalents): 2.46:1 light, 3.06:1 dark (fail); red refunded cents lower still. `AmountView` applies `font-normal opacity-60` regardless of `tone`. Answer to the author: 60% is only acceptable on neutral foreground; never stack it on muted/semantic tones. Fix: dim cents only for `tone==='neutral'` (or 80% in light) and rely on weight (400 vs 600) elsewhere.

## Improvements

P2
1. **Chart x-axis clips in the Arabic page.** `parts/charts.tsx:121` (and :114 y ticks). SVG `text-anchor` start/end follow text direction, so under `dir=rtl` the last label ("9 نوفمبر") grows outward and is cut to "مبر" at the right edge (screenshot `s-1440-ar-dark-charts.png`). Fix: `direction: ltr` on the `<svg>` or swap anchors by direction.
2. **Switcher trigger is a bare glyph.** `parts/switcher.tsx` TRIGGER: 32px circle with only the sign, muted, no code, no chevron; for EGP/KWD/JPY a 10px code. A first-time finance user sees a symbol, not a control (plan mock showed `[⃁ SAR ▾]`). Geometry otherwise exact: 32x32, 4px gap, same radius as neighbours, order lang -> theme -> currency -> fullscreen, mirrored correctly in RTL. Fix: at `lg+` show the code beside the sign (pill, still h-8) or add a tiny chevron.
3. **Hint chip copy, placement, lifetime.** `header-replica.tsx` HintChip + `env.tsx`. "At each transaction's day rate" does not say what changed; it is `absolute` inside the sticky header so it floats over content while scrolling (at 390 it covers the page title, `m-hint-ar-light.png`); no auto-dismiss (still present after 6s); dismiss target 32px; "one-time" is per page load only. Fix: "Figures now in TRY - converted at each transaction's day rate", auto-dismiss ~8s or on scroll, 44px close on touch, persisted flag in the profile.
4. **Conversion cue too quiet.** `receipt.tsx` ConvertedAmount: 1.5px dotted border at 70% muted, no touch affordance; only the Gross tile subtitle says "converted to SAR" (Net, Average, Refunded do not). Risk: "Top transactions" rows paid in JPY/TRY are printed as `⃁ 452K` and can be read as the paid amount. Fix: one persistent line when display != USD ("All totals converted to SAR at each day's rate - how it is calculated") that opens the same receipt; keep the underline per number; label ranking/list rows as converted.
5. **"≈" is aria-hidden** (`amount.tsx` Equivalent): a screen reader reads `690,940.31 Saudi riyals` as exact next to the USD balance. Add visually-hidden "approximately / تقريباً".
6. **Touch targets below 44px on mobile:** currency search input 40px, hint dismiss 32px, drawer close icon 16x16, header icon buttons 32px (theme, quick, bell: pre-existing in the real header). Switcher rows and menu/drawer entries are 44px (OK).
7. **Tiny text:** fallback codes (`EGP`, `KWD`, `JPY`) and K/M units in tables compute to 9.36px and 10.4px. Contrast fine (5.47 light / 5.99 dark) but below an 11px floor. Fix: `max(11px, 0.72em)`.
8. **Sign colour vs the research rule** ("never dim the mark more than the digits"): sign is `muted-foreground` (passes 5.47/5.99) but looks thin beside font-black KPI digits. Owner call; option: full foreground on KPI tiles only.

P3
9. `tabular-nums` does not equalise digits at weight 900 in Cairo: ten "1" = 145px vs ten "0" = 180px at 30px (400 and 600 are equal). KPI tiles change width when the value changes; tables (600) are fine.
10. Receipt prints `14498 records` ungrouped, inconsistent with grouped money (`receipt.tsx`).
11. Ladder edges: 999,950,000,000 prints `1,000B`; 15 digits `123,457B`. Acceptable per plan; make it an explicit decision (`1T`?).
12. At 390 the "Owner default" badge truncates "ريال سع…" in the drawer list.
13. Mixed-currency columns cannot align the decimal point (KWD 3, JPY 0, others 2) and K/M units shift the right edge; document it for the port.
14. Floating "Decisions" button covers table cells at the bottom start corner (lab only).
15. Layout shift when the catalogue arrives: `markKind` returns the code until `catalogReady`, then the sign (different width); not measured (server down). Sending the display currency with `me` fixes only that currency, not other table rows.
16. `kpi.tsx:57` uses physical `right-1` (copied from the real SparkStatCard so preserved on purpose; consider `end-1` in the port).

## Verified correct (evidence)
- Compaction ladder vs plan 5.3: 999 -> 999, 1,000 -> 1K, 1,500 -> 1.5K, 9,999 -> 10K, 999,499 -> 999K, 999,500 / 999,950 / 999,999 -> 1M, 1,250,000 -> 1.25M, 99,950,000 -> 100M, no trailing `.0` anywhere, negative `-1.25M`, per-column rule at 1M (999,999.99 stays exact; -1,000,000 compacts), KWD 3 decimals (12,345.6789 -> 12.3K, exact 12,345.679), JPY 0 (0.5 -> 1; 999,999.5 -> 1M), `-0.004` prints `0.00` without sign, 15 digits + 8 decimals exact `123,456,789,012,345.12`; malformed input (`1e6`, `1,500`, `.5`, empty) returns null -> dash. Self-test logic 35/35.
- SAMA sign, measured at 48px: sign 32px tall vs digit "1" 32px, sign 1px below the baseline; at 14px 9px vs 9px; gap about 0.33em; sign left of the number with a space in AR and EN (one LTR isolate); never mirrored except the deliberate wrong sample; negative `⃁ -1,250.00` (mark left of minus, rule 4); colour via `currentColor` (dark 150,159,171); forced-colors and print rules present.
- Switcher keyboard: Tab order matches DOM (lang, theme, currency, ...), visible teal ring; Enter opens and focus lands in the search combobox; typing "try" filters; ArrowDown moves selection; Enter picks, closes, focus returns to the trigger; Esc closes with focus return. AR popover opens under the trigger without clipping; rows 44px. Mobile: user-menu entry (expands in place) and drawer entry (searchable) both work with 44px rows.
- Accessibility tree: each amount is one `img` with exact amount + currency name; sign and cents `aria-hidden`; compact/converted amounts are one button "How this figure was calculated: 39,003,787.02 SAR" (no double announcement); negative reads "minus/سالب". Esc closes the card and keeps focus on the trigger; touch tap opens and tap outside closes (KPI).
- Layout: no horizontal page overflow in the 12 viewport/lang/theme combinations (`scrollWidth == clientWidth`; only the section nav scrolls, by design). No coloured side/top borders; real dashboard classes kept; Latin digits only; reduced motion respected; no console errors (only the framer reduced-motion notice).
- Bidi: in Arabic sentences the isolate keeps `⃁ 1,250.00` and `$ -1,250.00` stable; the plain-text sample reproduces the break the research predicted.

## The five decisions (recommendation)
- (a) Arabic negative: keep sign-first `⃁ -1,250.00`. Satisfies SAMA rule 4, identical to English, CSV and copy/paste; a trailing minus next to Latin digits (`1,250.00-`) is easy to misread in a right-aligned column.
- (b) Chart axis in Arabic: LTR. Latin digits, same direction as English and common analytics tools; only fix the anchoring bug (P2-1).
- (c) `$` vs `USD`: `$` while no other dollar currency is enabled, with the plan's automatic fallback to the code; the mixed table read clearly. The bigger issue is the 9-10px fallback codes (P2-7).
- (d) `≈`: keep it for equivalents (tooltip, second line, balance line), not on aggregates, and expose it to screen readers (P2-5).
- (e) Sign box: 0.725em. Measured equal to digit height; 0.8em is about 10% taller than the digits (computed, not rendered) and breaks SAMA rule 7 the other way.
- Open question (table compaction at 1M): keep the uniform per-column rule (mixed "1,250.00" above "4.25M" scans worse), provided P1-2 gives touch users the exact value.

## What is better than baseline (v1-baseline: `USD 12,345,678.50` at text-4xl)
- A 12.3M KPI reads at a glance (`$ 12.3M`, 7 characters vs 18) at the same font size, with the exact value one hover/tap/Tab away.
- One picture for every currency and language; no `SarIcon`/`rs.jpg`; no mirrored riyal in RTL.
- Conversion is explained in plain words (source currency, day-rate basis, period, record count, "raw provider rate, no customer margin", estimated days) in one place instead of nowhere.

## Screenshots
`review-shots/`: full-page 1440/768/390 x ar/en x light/dark (`full-*`), ar-dark 1440 sections (`s-1440-ar-dark-*`), switcher keyboard states (`kb-*`), mobile menu/drawer/hint/receipt/table tap (`m-*`), header crops (`hdr-*`), sign measurement crops (`sign-*`).
