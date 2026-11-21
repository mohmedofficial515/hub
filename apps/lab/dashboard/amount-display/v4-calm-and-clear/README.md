---
version: v4-calm-and-clear
title: Calm and clear
status: approved # draft | review | approved | rejected | ported
base: v2-quiet-figures
created: 2026-11-10
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/lib/money/ (new: decimal, compact (K/M/B/T), column scale, parts, text, words; prototype in parts/money-core.ts + parts/words.ts)
  - src/components/shared/amount/ (new: amount.tsx, currency-sign.tsx, reveal, chart-formatters.ts)
  - src/components/analytics/stats/spark-stat-card.tsx
  - src/components/analytics/stats/stat-card.tsx
  - src/components/analytics/stats/top-value-list-card.tsx
  - src/components/analytics/charts/donut-chart.tsx
  - src/components/analytics/charts/chart-tip.tsx
  - src/components/analytics/charts/series-report-plot.tsx
  - src/components/data-grid/cells/primitives/currency-cell.tsx
  - src/components/shared/money-text.tsx
  - src/components/shared/money.tsx
  - src/components/shared/currency-symbol.tsx
  - src/components/shared/locale-format.ts
  - src/components/ui/sar-icon.tsx (removed)
  - src/components/layout/dashboard-header.tsx (switcher between theme and fullscreen; user-menu sub-item below sm; 44px hit areas below sm)
  - src/components/layout/dashboard-sidebar.tsx (drawer entry)
  - src/components/layout/ (new: display-currency-switcher.tsx, basis-line.tsx under the topbar)
  - src/features/flights/tables/booking-columns.tsx
  - src/features/flights/**/booking-overview.tsx
  - new: conversion receipt (Sheet), amount-in-words for irreversible confirmations (refund, wallet top-up)
ported: # branch / commit once ported
decided-at: 2026-11-10T16:53:24.396Z
decided-by: Owner
decision-note: "اعتماد المالك (2026-11-10): v4 أساس النقل. تُنفَّذ قبل/أثناء النقل: صيغ الجر العربية، رفض الكسور الزائدة في المبلغ بالحروف، حقل تصحيح في المراجعة اللغوية، الرسم باللمس واتجاه تلميح سعر الصرف، أهداف اللمس وزر التأكيد المعطّل وaria-describedby. صياغة المبلغ بالحروف تبقى لمراجعة المالك اللغوية قبل تنفيذها. «عرض بـ» محذوفة من الإصدار الأول."
---

# Calm and clear

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/amount-display/v4-calm-and-clear?lang=ar&theme=dark`

## Idea
This version **merges v2 (quiet figures) and v3 (conversion forward)** after the two UX reviews and the owner's decisions of 2026-11-10.
From v2 it keeps the calm typography (the number is the hero; sign and K/M/B/T unit are lighter; cents soften only on plain text), the
faithful header replica, the switcher, the ladder, tables, charts, sign lab, states, accessibility notes and the floating decisions panel.
From v3 it takes what the owner chose: **one persistent basis line** under the header, the **conversion receipt**, the **chart-scrub
title swap**, a calm **live preview** per currency in the switcher list, and **amount in words** in irreversible confirmations. Dropped on
purpose: the per-card "View in" override (one page-wide currency from the header only) and a basis chip on every tile: a small badge now
appears only where the basis DIFFERS (balances "USD · no conversion", ratios "from converted sums", estimated days).

Files: `parts/money-core.ts` (pure BigInt core, K/M/B/T, one-scale columns, 41 self-tests), `parts/words.ts` (amount in words ar/en +
50 tests + the 30 language-review samples), `parts/amount.tsx` (Amount, Reveal), `parts/basis-line.tsx`, `parts/receipt.tsx` (popover short
receipt + full receipt sheet), `parts/hint-toast.tsx`, `parts/segmented.tsx` (radio group with roving tabindex), `parts/confirm.tsx`,
`parts/language-review.tsx`, `parts/switcher.tsx`, `parts/header-replica.tsx`, `parts/overlay.tsx`, and the v2 parts (kpi, ladder,
table-demo, charts, sign-lab, states, a11y, surfaces, decisions-panel, convert, data, env). Screenshots in `shots/`
(`<width>-<rtl|ltr>-<light|dark>.png` are full-page).

Sections: 1 before/after, 2 live demo, 3 KPI tiles, 4 ladder + self-test, 5 tables and details, 6 charts, 7 sign lab, 8 decisions,
9 states, 10 accessibility, **11 amount in words (refund / wallet confirm)**, **12 language review (30 samples)**.

## Key decisions
- **Basis line, no flicker**: v3's bar toggled its height at a scroll threshold (CLS 0.076, oscillation). Here the line is not sticky, has a
  constant height per breakpoint (36px from sm, 44px below) and reacts only to the display currency. Measured on a slow wheel scroll
  (160 steps of 8px down and back, 1440, ar and en): basis-line height always 36px, its CLS contribution 0. Page total CLS 0 (en) and
  0.0040 (ar, two tiny shifts at scroll ~950 from the Arabic web font arriving late, unrelated to the line).
- **Exact value (Reveal)**: trigger is a `span role="button"` (no nested buttons in tables), hover (mouse), focus-visible and tap open the
  same selectable card; hovering the card keeps it open; `onCloseAutoFocus` is prevented so closing never re-opens it; Escape returns focus
  by hand with an open-on-focus guard. Table cells use it, so touch gets the exact value and the equivalent.
- **Cents**: softened (opacity .75, weight 400) ONLY with `tone=neutral` on normal foreground and never inside muted parents (callers pass
  `softCents={false}` in muted columns, equivalents, refunded lines). Compact values never show cents.
- **Compaction T**: 1,000B is `1T`, 1.5 trillion `1.5T`, 999,950,000,000 carries to `1T`; 15 digits print `123T`.
- **Table columns use ONE scale**: a column compacts only when its largest value is >= 1M AND every non-zero row is >= 0.01 of that unit;
  then every row prints in the unit of the maximum with two decimals (`4.25M`, `0.04M`, `12.60M`) so decimal points line up, and the exact
  value is one tap away. Otherwise the whole column stays exact (page 1 of the demo table mixes 1,234 and 18,750,000 and therefore stays
  exact, page 3 compacts). I tried "always compact from 1M" first: a mixed-currency column printed most rows as `<0.01M`, which loses
  the row, so the rule falls back to exact instead of mixing K and M.
- **Amount in words** (`words.ts`): Arabic cheque style by the last two digits of the count (1 = noun + واحد, 2 = dual, 3-10 plural,
  11-99 accusative singular, multiples of 100 genitive singular), construct dual before the noun (مئتا ريال، ألفا ريال، مليونا ريال),
  tanween on scale nouns that are not adjacent to the counted noun, feminine lira/halala; English standard ("One thousand two hundred
  fifty Saudi riyals"). Currencies: SAR, USD, AED, KWD, TRY, JPY. 50 unit tests.
- **Switcher trigger** from `sm`: sign + ISO code + chevron in the same 32px height (66px wide); rows show a muted preview of the 30-day
  sales in that currency (hidden below sm, stated once in the footer); search input 44px on touch.
- **Hint toast**: a fixed, bottom, portal-free toast rendered at the page root (a `fixed` child of the blurred sticky header would be
  trapped by `backdrop-filter`), names the currency ("Figures now in Turkish lira (TRY) · converted at each transaction's day rate"),
  auto-dismisses after 6s (paused while hovered/focused), 44px close target.
- **One dollar decision**: `$` while no other dollar currency is enabled, otherwise `USD`, for the whole page (decisions panel has a CAD
  switch to see it). Arabic negative stays `⃁ -1,250.00`; chart axis LTR (SVG forced to `direction: ltr`); `≈` only on equivalents, with
  visually-hidden "approximately"; sign box 0.725em / gap 0.25em.
- **Header** keeps its real geometry (32px controls, allowed by WCAG 2.5.8). Below `sm` an invisible `::after` extends the hit area of the
  existing controls (theme, quick, bell, language, burger) and the new switcher to 44px tall; new mobile entries (menu rows, chips, close,
  confirm) are 44px.
- **Radio groups** (quick pick, table pages, facts picker, KPI ladder, decisions panel, confirm kind/currency) use one `Segmented`
  component: roving tabindex, arrows move and select, Home/End, arrows follow reading direction.
- The lab's Tailwind scans files at start: new classes only appeared after the CSS root was re-saved (`touch lab/src/styles/dashboard.css`,
  mtime only, no content change). Not needed in the real project.

## Review fixes
v2 review (`v2-quiet-figures/review.md`)
- [x] P1-1 hover card re-opens after closing: fixed (Reveal; verified hover/leave, Esc, outside click and tap outside never re-open; card is selectable).
- [x] P1-2 no touch access in table cells: fixed (same Reveal, `span role="button"`; verified by tap at 390: exact value, equivalent, rate and day).
- [x] P1-3 cents contrast on muted columns: fixed (softening only for neutral tone). Measured: neutral cents 7.83:1 light / 9.07:1 dark; muted-column cents 5.47 / 5.99 (not dimmed); refunded (destructive) cents 4.78 / 5.52 (not dimmed). Before: 2.46 / 3.06 on muted.
- [x] P2-1 area-chart time axis clipped in Arabic: fixed (`direction: ltr` on the SVG; "9 نوفمبر" complete).
- [x] P2-2 switcher trigger bare glyph: fixed (sign + code + chevron from sm, 32px high).
- [x] P2-3 hint chip: fixed (toast, names the currency, auto-dismiss 6s, 44px close, bottom placement, does not cover titles at 390).
- [x] P2-4 conversion cue too quiet: fixed (2px dotted underline, full muted colour + the persistent basis line + receipt link in the card).
- [x] P2-5 `≈` lost for screen readers: fixed (visually-hidden "approximately / تقريباً").
- [x] P2-6 touch targets: search input 44px, toast close 44px, new rows 44px; existing 32px header buttons keep their look with a 44px-tall invisible hit area below sm (theme, quick, bell verified at +-5px; burger extended by 4px; the language pill's hit area was verified above but not below, see open questions).
- [x] P2-7 tiny text: codes, units and tags have an 11px floor (`max(11px, 0.72em)`, measured unit 11px).
- [~] P2-8 sign colour vs "never dim the mark": kept muted (passes 5.47/5.99); owner call, not changed.
- [x] P3-10 receipt record count grouped (14,498).
- [x] P3-11 ladder edges: T unit added.
- [ ] P3-9 `tabular-nums` at weight 900 in Cairo: font limitation, not changed (tables use weight 600 and are fine).
- [ ] P3-12 "Owner default" badge truncation in the 390 drawer: badge is now 11px; truncation of the name still possible on very narrow lists (not re-checked).
- [ ] P3-13 mixed-currency decimal alignment: documented, not solvable by design (KWD 3, JPY 0).
- [ ] P3-14 floating Decisions button covers cells at the bottom corner: lab-only.
- [ ] P3-15 catalogue-load shift: not measured.
- [ ] P3-16 `right-1` physical in the SparkStatCard replica: kept on purpose (copied from the real card), flagged for the port.

v3 review (`v3-conversion-forward/review.md`)
- [x] P1-1 basis bar flicker: fixed (constant height, not sticky); CLS 0 for the line, see Key decisions.
- [x] P1-2 radio group keyboard: the "View in" feature is dropped; every kept radio group now has roving tabindex and arrows (verified in LTR and RTL, and in the decisions panel).
- [x] P1-3 scrub announcements doubled / unformatted: fixed (one polite region from `amountText()`: "9 Nov: TRY 13,049,726.11"; title swap is `aria-hidden`; 1 live region in the chart section).
- [x] P2 States overflow at 390 en (414): fixed (`min-w-0`, one column); scrollWidth 390.
- [x] P2 Arabic "remaining" column clipped: the bookings table here has no such column; the table sits in its own focusable `overflow-x-auto` region; no clipped element at 1440 ar.
- [x] P2 mixed K/M units in one column: fixed (one scale per column or exact; see Key decisions).
- [x] P2 beyond billions: T unit added.
- [x] P2 Arabic amount-in-words grammar: fixed and tested (200 -> مئتا ريال سعودي, 2,000 -> ألفا ريال سعودي, 2,000,000 -> مليونا ريال سعودي, 101 -> مئة وريال سعودي واحد, 3 -> ثلاثة ريالات سعودية, 11 -> أحد عشر ريالاً سعودياً, 12,345,678.90 AED with tanween, sub-units with the same rules). One open wording point: the sub-unit "خمسون هللةً" takes the accusative tanween by the 11-99 rule while the review accepted "خمسون هللة"; flagged in section 12.
- [x] P2 tile chip policy: chips only where the basis differs.
- [x] P2 KPI tile uneven heights: the badge is in the title row and short ("from converted sums"), no wrapping line pushes the figure down.
- [x] P2 donut legend value far from label: kept adjacent (v2 layout).
- [x] P2 mobile sticky stack: only the header is sticky; the basis line scrolls away.
- [x] P2 receipt content: per-source-currency breakdown, rate min/avg/max, plain "constant rate" note instead of a flat chart, figure name only when opened from a tile, mini sparkline when the rate moves.
- [x] P2 header targets: see P2-6 above.
- [ ] P2 dark primary buttons 2.71:1 (white on green): real-project token, not touched here; check before the port.
- [x] P3 switcher placement: between theme and fullscreen as in the plan.
- [x] P3 switcher focus ring: `ring-ring` like the neighbours.
- [x] P3 switcher rows "30-day sales" caption repeated: said once in the footer.
- [ ] P3 user-menu currency sub-list lacks search/previews: unchanged from v2 (inline list); the drawer has the searchable list.
- [x] P3 amount buttons: `aria-haspopup="dialog"` added.
- [x] P3 section numbering: 1 to 12 in order.
- [ ] P3 language toggle replica clipped glyph: replica artefact, not re-checked against the real header.
- [ ] P3 a11y demo code sample scrambled in ar: not re-checked.
- [x] P3 cents: soft on neutral text.

## Verification
- `pnpm lab:check` (from `F:/Goteav/hub`): all versions compile. `tsc --noEmit` on this folder: 0 errors (the only errors in the program are in `shared/` because the isolated config has no vite types).
- Self-test button (section 4): 91 of 91 (41 money-core + 50 amount-in-words); also run in Node.
- Browser (Chromium via Playwright, 390 / 768 / 1440 x ar-RTL / en-LTR x light / dark): `scrollWidth == innerWidth` in all 12 combinations, 0 console errors. Keyboard: switcher (Enter, type, Enter, focus returns), Reveal (focus opens, Esc closes and keeps focus), chart (arrows scrub), radio groups (arrows in RTL and LTR), confirm dialog. Touch (390, `hasTouch`): table cell tap opens the card, tap outside closes it, mobile user-menu currency rows 44px.
- Screenshots: `shots/` (1440 and 390 in ar-rtl light and dark, en-ltr light, plus `switcher-open`, `receipt`, `exact-value`, `confirm-in-words`, `language-review`, `basis-line`, `table-compact-ar`, `m-*`).

## Open questions
- Language review (section 12): accept or correct the wording. Points to decide: "مئة وريال سعودي واحد" (cheque style) vs "مئة وواحد ريالاً"; accusative tanween on sub-units ("خمسون هللةً") vs none; "ينان يابانيان" for 2 yen; add the cheque idiom "فقط ... لا غير"; English without "and" between hundreds and tens.
- The language pill's 44px hit area was not confirmed below the control (the probe at +5px hit another element); the other new/existing controls were.
- Table compaction: confirm "one unit, two decimals, or stay exact" (a mixed-currency column rarely compacts). Alternative: never compact tables.
- The persistent basis line is not sticky. If the owner wants it pinned on desktop only, it can be pinned with a constant height (no layout change) but would take 36px of the sticky stack.
- Mixed-currency columns cannot align decimals (KWD 3 digits, JPY 0): documented for the port.
- Not verified: Safari/iOS (CSS masks), a real screen reader, real print and Windows high contrast, a real touch device, the real header's language toggle.
