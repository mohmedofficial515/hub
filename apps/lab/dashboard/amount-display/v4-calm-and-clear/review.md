# Review — dashboard/amount-display/v4-calm-and-clear   (2026-11-10)

Method: one isolated Playwright context (Chromium), one page at a time, 390 / 768 / 1440 x ar-RTL / en-LTR x light / dark; real touch emulation (`hasTouch`, `isMobile`) at 390; computed colours blended against the real background; `PerformanceObserver` layout-shift during a 160-step slow wheel scroll; the words engine (`parts/words.ts`) run in Node on every value asked for; forced-colors and reduced-motion emulation. Console: 0 errors. Not covered: Safari/iOS, a real screen reader, real print, real touch hardware, comparison against the real dashboard source.

| Pillar (1-5) | Score | One-line verdict |
|---|---|---|
| Hierarchy | 4 | Number is the hero, sign/unit/cents are quiet, the basis line says one thing once; the ladder demo and a 24px table trigger dilute it |
| Accessibility | 3 | Real fixes landed (single live region, 7.7:1 cents, focus trap, Esc, roving radios), but 18px touch targets, a non-focusable disabled Confirm, no dialog description and a scrub that dies on finger lift remain |
| RTL / LTR | 4 | Layout, arrows, axis and header mirror correctly; two bidi slips (chart tooltip rate, "بـ" + name) |
| Conversion clarity | 4 | Basis line + receipt with per-source breakdown is clear for a finance user; at 390 the currency control is two taps deep |
| Switcher UX | 4 | Trigger is now a control (sign + code + chevron, 32px), live previews are useful, focus returns; KWD row duplicates its code, mobile entry is buried |
| Visual polish | 4 | Calm, consistent, no coloured card stripes, Latin digits only; a few demo-only rough edges |
| Language quality | 3 | Arabic words engine is grammatically sound on all values asked; UI strings around it ("بـ ليرة", "تأكيد بـ SAR") and silent rounding let it down |

## Verified-fix tally: 10 of 12 fully verified, 2 partial

| # | Claimed fix | Result | Evidence |
|---|---|---|---|
| 1 | Exact-value card no longer re-opens; selectable | VERIFIED | hover -> card open; move onto card keeps it; leave -> closed after ~0.9s, activeElement = BODY; keyboard focus opens, Esc closes and focus returns to trigger (no reopen); Enter opens; outside click closes; dblclick inside card selects text |
| 2 | Table cells reachable by touch, no nested buttons | VERIFIED (target too small) | 390 touch: tap opens card with equivalent + rate + day; tap outside closes; 9 `span[role=button]` in tables, 0 nested interactive. Trigger box 84.5 x 18.6px (see P2-5) |
| 3 | Cents contrast | VERIFIED | soft neutral cents min 7.72 light / 7.94 dark (typical 7.83 / 9.07); muted 5.47 / 5.99 (not dimmed); destructive 4.78 / 5.52 (not dimmed). All >= 4.5 |
| 4 | Basis line constant height, no CLS | VERIFIED, number in README wrong | 160 steps down + 160 up at 1440 ar, 1440 en, 390 ar: heights seen {36} / {36} / {50}, CLS 0, no layout shift entries. At 390 it is 50px (wraps to 2 lines, same in ar/en/TRY), not the documented 44px. Not sticky (position static) |
| 5 | Scrub aria-live single formatted announcement | VERIFIED | one `role=status` in the chart section; arrows give "11 Oct: SAR 876,387.57", "12 Oct: SAR 1,314,451.42"; title swap is `aria-hidden` with a constant sr-only title. Minor: "SAR" is read as letters in Arabic (P3) |
| 6 | Arabic axis not clipped | VERIFIED | SVG `direction:ltr`, last tick "9 نوفمبر" inside the SVG box, 0 text nodes outside |
| 7 | Hint toast | VERIFIED | names currency ("الأرقام الآن بـ ليرة تركية (TRY) · ..."), gone after 5.7s, close 44x44, at 390 box y 710-772 of 844 (bottom), covers body text not titles. Grammar issue in the string (P2-1) |
| 8 | Switcher trigger geometry | VERIFIED | 68 (ar) / 70 (en) x 32px vs neighbours 32x32, 4px gap, order lang, theme, currency, fullscreen, mirrored in RTL. README says 66px |
| 9 | T unit | VERIFIED | 999,950,000,000 -> 1T, 1.5T, 123T for 15 digits |
| 10 | Single-scale compact table column | PARTIAL | Real booking tables stay exact or compact in one unit, fine. The ladder column "Table (one-unit column)" prints `999.00, 1,000.00, 9,999.00, 0.01M, 1.00M, 12.50M, 1,200,000,000.00 ...`: exact, M and exact again in one column, `10,000 -> 0.01M`, `0 -> 0.00M` (P2-6) |
| 11 | No horizontal overflow | VERIFIED | all 12 combinations `scrollWidth = innerWidth - 6` (scrollbar), no element beyond viewport outside a scroll container; language table scrolls in its own container |
| 12 | Amount-in-words grammar | PARTIAL | Grammar correct on all asked values (below), but silent rounding of extra decimals (P2-2) and UI wording around it (P2-1) |

## Blocking issues (must fix before approval)
None at P0/P1. The items below marked P2 are what I would close before or during the port.

## Findings (P0-P3)

**P2-1. Arabic UI strings use "بـ" + unmarked name.** `i18n.ts` `n.hint` renders "الأرقام الآن بـ ليرة تركية (TRY)" (stray space, no article) and the confirm button "تأكيد بـ SAR" (390/1440 ar, confirm dialog). Native reading: "بالليرة التركية" / "تأكيد المبلغ (SAR)". Fix: give each currency an Arabic prepositional form (`بالليرة التركية`) or rephrase to "عملة العرض الآن: ليرة تركية (TRY)"; button: "تأكيد المبلغ بـ SAR" is still awkward, use "تأكيد (SAR)".

**P2-2. Amount in words silently rounds.** `parts/words.ts` `amountInWords`: 12.345 SAR -> "اثنا عشر ريالاً وخمس وثلاثون هللة" (35), 12.999 SAR -> "ثلاثة عشر ريالاً", 0.995 USD -> "دولار واحد", JPY 1000.5 -> "ألف وين ياباني واحد", JPY 0.50 -> "ين ياباني واحد". On a refund / top-up confirm, the words must never differ from the digits. The confirm input also accepts 12.345 for SAR (`#cf-amount`, only comma, Arabic-Indic digits, 0, negatives are invalid). Fix: treat more decimals than the currency's minor units as invalid in the input and return `null` in `amountInWords` instead of rounding.

**P2-3. Language review is a flagger, not a review tool.** `parts/language-review.tsx`. (a) The owner can only toggle a check per row; there is no field for the corrected wording and no "accept" state; the copied text contains the current (wrong) wording only (verified clipboard: `101 SAR / ar: ... / en: ...`). A non-technical owner must retype corrections elsewhere. (b) At 390 the table is 820px in a 364px scroller: the English column and the flag of rows are off screen with no hint (screenshot `390-ar-dark-language-review.png`); the scroller has no label/tabindex. (c) Clipboard failure sets `copied=false` silently (no error text); `copied` stays true after the selection changes. Fix: per-row "Correct form" input (or three states accept / fix / unsure), export "value | current | correction", show an error status on copy failure, stack columns as cards below `md`.

**P2-4. Chart scrub does not work on touch at 390.** `parts/charts.tsx` `<rect onPointerLeave={() => setActive(null)}>`. A real tap (touchscreen) on the plot leaves title and tooltip unchanged: for touch, `pointerleave` fires on lift and clears the value, so the figure can only be read while the finger is down (and a vertical drag scrolls the page; no `touch-action`). Fix: do not clear on `pointerleave` when `pointerType !== 'mouse'`; clear on outside tap / blur; add `touch-action: pan-y` on the rect. Also in Arabic the tooltip line "محوّل بسعر ذلك اليوم: 1 USD = 3.75 SAR" renders bidi-scrambled ("USD = 3.75 1", SAR wraps), screenshot `1440-ar-dark-chart-scrub.png`; wrap the rate in `<bdi dir="ltr">`.

**P2-5. Touch/AT details.** (a) Table-cell exact-value trigger is 84 x 18.6px at 390 (`table [role=button]`), below WCAG 2.5.8 24px with no spacing offset; add `py-1.5` / `min-h-6` with negative margin or an invisible ::after. (b) Confirm dialog: the disabled Confirm button is not focusable (Tab cycles close > checkbox > Cancel only), so keyboard and SR users are never told it exists or why it is off; use `aria-disabled="true"` with the checkbox as `aria-describedby`. (c) `[role=dialog]` has `aria-label` but no `aria-describedby`, so the lead sentence is not announced. (d) At 390 the display-currency control is only in the account menu (Account menu > Display currency > row) while the basis line shows the currency but is inert; make the basis currency chip open the same list.

**P2-6. Ladder "one-unit column" contradicts the rule.** `parts/ladder.tsx` / README "one scale per column". See tally #10. It also shows `999,950 -> 1.00M` and `0 -> 0.00M`. Either render this column from one real column max, or relabel it "per-value rule" so reviewers do not read it as the table behaviour.

**P3 list**
1. Switcher rows: KWD (and other sign-less codes) show the code in the medallion and again in the code column ("KWD KWD") - `parts/switcher.tsx` `Medallion`/`CommandItem`.
2. Live announcement uses the code "SAR": Arabic readers hear letters. Use `amountLabel` wording.
3. Forced-colors section (`parts/a11y.tsx`) is a black-box simulation; real emulation passes (`.cur-sign` bg = CanvasText, rgb(0,0,0) on Canvas) but the section should say "simulated, verified with emulation" and not imply a real test. Print block is a styled div, not `@media print`; still unverified on paper.
4. Words: "ينان يابانيان" (2 yen) is stilted; yen is invariable in everyday use, consider "ينان" only on explicit owner approval, else "ين ياباني" with the number. English "One hundred one" lacks "and" (cheque convention in KSA/UAE/UK: "One hundred and one").
5. Language-review table scroller has no `tabindex`/label (usable through the flag buttons only).
6. Decisions panel: no Esc to close, covers the bottom-end corner of tables (lab only).
7. Basis line text uses `text-border` separators (decorative, fine) but wraps to 50px at 390 and the README says 44.
8. Language row `bg-or/10` highlight resolves to `oklab(.76 .08 .16 / .1)` (orange tint on a "checked" state with a primary-coloured button): colour semantics are mixed.

## Amount in words: Arabic and English check (values you listed + the 30 samples)
All forms below are what the engine prints; native-speaker verdict in the last column.

| Value | SAR (ar) | Verdict |
|---|---|---|
| 1 | ريال سعودي واحد | correct (cheque style) |
| 2 | ريالان سعوديان | correct |
| 3 / 10 | ثلاثة / عشرة ريالات سعودية | correct (3-10 plural) |
| 11 | أحد عشر ريالاً سعودياً | correct (11-99 accusative singular) |
| 100 | مئة ريال سعودي | correct (multiples of 100 genitive singular) |
| 101 | مئة وريال سعودي واحد | acceptable cheque idiom; unusual in running text; owner call |
| 200 | مئتا ريال سعودي | correct (dual loses nun in construct) |
| 1000 / 2000 | ألف ريال / ألفا ريال سعودي | correct |
| 2,500.75 | ألفان وخمسمئة ريال سعودي وخمس وسبعون هللةً | correct (هللة feminine: خمس وسبعون) |
| 1,000,000 / 2,000,000 | مليون ريال / مليونا ريال سعودي | correct |
| 0.50 | خمسون هللةً | correct (tanween optional; consistent with the 11-99 rule) |

Other currencies are consistent with the same rules: USD (دولاراً / سنتاً), AED (درهم masc., فلساً), KWD (ديناران, 0.50 -> خمسمئة فلس, 2,500.75 -> ... وسبعمئة وخمسون فلساً), TRY (feminine: ثلاث ليرات, إحدى عشرة ليرةً تركيةً, ليرتان تركيتان; 21 -> إحدى وعشرون ليرةً تركيةً; 8.50 -> ثماني ليرات تركية وخمسون قرشاً), JPY (no minor unit: ثلاثة ين ياباني, أحد عشر يناً يابانياً). Samples 9, 16, 18, 19, 23, 24, 29, 30 checked: scale nouns take tanween only when not adjacent to the counted noun (اثنا عشر مليوناً وثلاثمئة وخمسة وأربعون ألفاً وستمئة وثمانية وسبعون درهماً), `ألف ومئتان وخمسون ريالاً` and `مليون وخمسمئة ألف دولار أمريكي وسنت واحد` correct. None of the 30 rows is wrong; the only wording judgments are 101/2001 style (`ألفان وريال سعودي واحد`), the yen dual, and optional tanween on sub-units. English: wording correct ("Two thousand five hundred Saudi riyals and seventy-five halalas", "Japanese yen" invariable, "fils", "kuruş"); add "and" after hundreds if the owner wants cheque convention.

## New items audited
- **Receipt** (`1440-en-light-receipt.png`): clear. Result, source currency, period, record count (14,498), per-source table with share / how counted / records, min-avg-max rate, plain "constant rate, no chart" note. Good for a finance reader; the "How counted" repeats "USD x day rate (average 3.7500)" on 7 of 9 rows (could be collapsed).
- **Chart-scrub title swap**: constant 24px height before/after (no CLS), title `aria-hidden` with sr-only static title; works with mouse and arrows; broken on touch (P2-4).
- **Live preview in switcher rows**: works (39M, 10.4M, 355M ...), hidden below sm, caption stated once; calm.
- **Confirm dialog**: modal, focus lands on dialog, Tab trapped across close/checkbox/cancel, Esc closes, focus returns to the opener, checkbox gates Confirm and resets on reopen, amount read as "1,250.00 ريال سعودي", words are plain text. Gaps: P2-5 b/c.
- **Roving-tabindex radios**: tabindex 0 on checked only; in ar the first option is on the right and ArrowLeft moves to the visually left one (x 267 > 153 > 39), Home/End logical, in en mirrored correctly; focus follows selection.
- **Decisions panel defaults**: a "⃁ -1,250.00" (sign-first), b axis LTR, c auto ($ while CAD off), d "≈ on" (only on equivalents), e 0.725em: all selected by default. Flipping every option plus the CAD switch live: no console error, no overflow (scrollWidth 1434), basis line intact.
- **No coloured side/top card borders**: scan of all elements with partial borders found only neutral 1px row/section dividers (`border-b`/`border-t`, oklch .92 grey); no mixed-colour borders.
- **Latin digits only**: 0 Arabic-Indic digits in the ar page text.
- **prefers-reduced-motion**: 0 running animations after a currency switch; framer transitions gated by `useReducedMotion` (chart, toast, panel, overlay); smooth scroll gated.
- **Real dashboard measurements**: header controls 32x32, language pill 78x32, account 42px high, 4px gaps are unchanged from v2; not compared against the real dashboard source in this review.

## Improvements
1. At 390 let the basis line currency open the switcher list (fewer taps than Account menu > Display currency > row).
2. Give the Arabic currency table a "prepositional form" field to fix all "بـ" strings at once.
3. In the switcher list show a sign-less currency once (code in the medallion OR the code column).
4. Chart: add Home/End and a persistent selected point on touch.
5. Collapse repeated rows in the receipt "How counted" column.

## What is better than baseline / than v2 and v3
- One persistent basis line with measured CLS 0 and constant height replaces v3's bar that flickered (CLS 0.076) and v2's chip nobody understood.
- A finance user can now answer "which currency, which rate, which records" in one click (receipt) instead of not at all in v1 (raw `USD 12,345,678.50` with no basis).
- Exact value is reachable by touch, selectable, and no longer re-opens (v2 P1-1/P1-2).
- Cents never fall below 4.78:1 (v2 had 2.46:1).
- Irreversible confirmations repeat the amount in words with a gating checkbox (new, v3 idea executed with correct Arabic grammar).

## Verdict
Ready to approve as the basis for the port, with a short pre-port fix list (no new design round): P2-1 string forms, P2-2 reject extra decimals in words, P2-3 correction field in the language review, P2-4 touch scrub + tooltip bidi, P2-5 targets/disabled/describedby. Owner decisions still open (from README): cheque idiom 101, sub-unit tanween, yen dual, table compaction rule, basis line not sticky.

## Screenshots
`review-shots/`: `1440-ar-light-switcher-open.png`, `1440-en-light-receipt.png`, `1440-ar-dark-chart-scrub.png`, `390-en-light-hint-toast.png`, `390-ar-dark-language-review.png`, `1440-ar-light-confirm.png`, `1440-ar-light-decisions-flipped.png`, `1440-en-forced-colors.png`, `390-ar-light-table-tap.png`.
