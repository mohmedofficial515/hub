---
version: v3-conversion-forward
title: Conversion forward
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-10
tokens: inherit
touches-components:
  - src/lib/money/ (new: decimal, compact, group, parts, text, words; prototype in parts/money-core.ts)
  - src/components/shared/amount/ (new: amount.tsx, currency-sign.tsx, amount-exact.tsx, chart-formatters.ts)
  - src/components/layout/dashboard-header.tsx (display-currency switcher between theme and fullscreen; user-menu sub-item below sm)
  - src/components/layout/ (new: display-currency-switcher.tsx, basis bar under the topbar; drawer entry)
  - src/components/analytics/stats/spark-stat-card.tsx (amount prop, basis chip in the existing badge slot, title swap)
  - src/components/analytics/stats/top-value-list-card.tsx (Amount context list)
  - src/components/analytics/charts/ (chart-tip exact tooltip + converted note, donut centre Amount, amountTick axis)
  - src/components/data-grid/cells/primitives/currency-cell.tsx (returns Amount, optional "Display equivalent" column)
  - src/features/flights/tables/booking-columns.tsx and components/bookings/booking-overview.tsx (end-aligned, equivalent line, USD tags)
  - src/components/ui/sar-icon.tsx and rs.jpg (removed)
  - new: conversion receipt (Sheet), "View in" segmented control, amount-in-words for irreversible confirmations
ported:
---

# Conversion forward

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/amount-display/v3-conversion-forward?lang=ar&theme=dark`

## Idea
Trust first, explicit second. The display currency is never implied: it sits in a topbar pill (sign + code), in a calm
**basis bar** under the topbar ("SAR · converted at each transaction's day rate · balances in USD · How is this
calculated?", collapsing to a one-line chip on scroll and below sm), in a small neutral **basis chip** on every KPI tile
("SAR · day rates", "USD balance"), and in a per-card **View in: USD | SAR** switch that overrides the page currency for
that card only. Converted equivalents never hide behind decoration: in tables they live in an optional "Display
equivalent" column (off by default, a tooltip otherwise), in details as a muted line with the rate and day. Anything that
moves money (refund, wallet credit) repeats the amount in words (SAMA rule 3). The full calculation is one click away in
a **conversion receipt**. This is the opposite bet of the sibling "quiet figures" version, which hides the same
information behind dotted underlines.

The page is a showcase, not a route: a faithful replica of the dashboard shell with a really interactive header, a live
demo that converts a 30-day mock series (decimal strings, BigInt), the compaction ladder, tables, sign lab, states,
accessibility and a floating decisions panel.

## Key decisions
- **Money core is pure** (`parts/money-core.ts`, the prototype of `src/lib/money`): decimal strings parsed to BigInt
  (`BigInt(10)`, no `10n`), no Intl for grouping or compaction, 3 significant digits, no trailing ".0", correct carry
  (999,950 -> 1M, 9,999 -> 10K in a chart, 1,500 -> 1.5K), minor digits KWD 3 / JPY 0, FSI/PDI isolates in `amountText`,
  `amountInWords` (ar/en) for SAR, USD, AED, EUR, GBP, KWD, JPY, TRY, EGP, CAD. "Run self-test" in section 4 lists 37
  PASS/FAIL cases.
- **Conversion engine** (`parts/engine.ts`) implements plan D3/D4/D7/D8: per-day USD x day rate; own-currency
  transactions keep their original amount; averages and ratios come from converted sums; ranking ordered by USD;
  balances USD; a day without a rate carries the last rate and is tagged "estimated" (hollow dot on the chart).
- **Amount** inherits the font size from its context. One `<bdi dir="ltr">` isolate holds [sign][space][-][number][unit]
  (SAMA rules 1-4 in both languages). Sign = SVG mask in `currentColor`, one CSS rule per currency, box 0.725em, drop
  7.5% of the box, gap 0.25em, never mirrored; the 7 official signs come from the backend seed, others show the ISO code.
  KPI and detail: sign/code in a small neutral chip (`bg-muted`, no coloured border). Tables: plain and muted sign.
  K/M/B same weight as the figure.
- **Exact value** on compacted kpi/chart/list figures: hover and keyboard focus open a tooltip, tap/Enter opens a Popover
  (exact figure, name, basis sentence, "How is this calculated?"). Tooltip and Popover share one trigger. No trigger in
  table cells (hover text only; exact value in the facts block). One `aria-label` per amount (exact figure + currency
  name), sign `aria-hidden`.
- **Tables:** column decision made once per column (max >= 1M compacts the whole column; below 1K stays exact).
  Equivalent column off by default, toggled from the column menu (real DropdownMenu checkbox items).
- **Header** keeps the real geometry and the real 32px controls (preserve-design). The switcher is a Popover + Command
  list: row = [sign in a circle (SAMA rule 9 padding)][code + name][live preview of 30-day sales in that currency][check],
  default first, footer sentence. Below sm it becomes a sub-item inside the user menu AND an entry in the drawer.
  Disabled with a tooltip while the feature flag is off; skeleton rows while the catalog loads.
- **Mobile preview** of the header is an iframe of the same page at 390px (`&only=header`), so real breakpoints fire.
- **Decisions panel** (floating, state-driven, persists nothing): (a) Arabic negative, (b) chart time axis LTR/RTL,
  (c) `$` vs `USD` in multi-currency tables (auto = `$` only when unique among enabled currencies; CAD is in the demo
  catalog to make `$` ambiguous), (d) `≈`, (e) sign box 0.725em vs 0.8em.
- Own `Overlay` (portal, focus trap, Esc, focus restore) instead of the project Sheet/Dialog because those read the
  project i18n, which does not run in the lab. The port uses the real Sheet and Dialog.
- Charts are hand-written SVG (Recharts is not available to lab versions); axis ticks without sign; tooltip exact with
  "from USD x rate"; keyboard arrows scrub; hovering the chart rewrites the "Gross sales" tile title (same size).

## Open questions
- Header controls stay 32px like the real header (preserve-design); the brief asks 44px on mobile. All NEW controls are
  44px on mobile (View in, menu rows, chips, decisions). Should the existing 32px header buttons grow too?
- The hover tooltip on a table cell is not keyboard reachable on purpose (no nested interactive controls); the exact
  value is in the facts block. Acceptable, or add a row-level "details" action?
- Arabic amount-in-words is a cheque-style approximation (counted noun by last two digits, dual forms, feminine for lira
  and halala). A linguist should review before porting.
- Beyond 999,999,999,999 the figure stays `123,457B` (nothing wider than B exists). Add T, or keep?
- Rankings use the period's effective rate per currency (not per-day per-destination); the server must decide the exact rule.
- A hover chip + basis bar + per-card View in is the loudest version of "state the basis". Is the per-tile chip too much on
  pages where every figure shares one basis (finance overview)?
- The five decisions (panel, section 8) still need the owner's answers.

## Verification
Checked in the running lab at 1440 / 768 / 390, RTL and LTR, light and dark (`shots/`): no horizontal page overflow
(scrollWidth <= viewport), no console errors. Exercised: header switcher (desktop), user-menu sub-item and drawer (390),
per-card View in + reset, basis bar collapse on scroll, receipt, exact value by focus and tap, chart scrub, confirm in words,
decisions panel, self-test (38 cases). Not verified: real screen readers, real forced-colors/print (only simulated blocks),
touch hover behaviour on a real device, Safari.
