---
version: v2-quiet-figures
title: Quiet figures
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-10
tokens: inherit # inherit | override (see tokens.css)
touches-components:
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
  - src/components/ui/sar-icon.tsx
  - src/components/layout/dashboard-header.tsx
  - src/components/layout/dashboard-sidebar.tsx
  - src/features/flights/tables/booking-columns.tsx
  - src/features/flights/**/booking-overview.tsx
ported: # branch / commit once ported
---

# Quiet figures

## Idea
Typography does the work. The number is the hero and keeps the surrounding size, weight and colour; the currency sign and the K/M/B unit are
lighter and muted, cents are lighter than the integer part in detail views (never in compact values), and one treatment (official sign,
else the ISO code; Latin digits; sign left of the number with a space inside one LTR isolate) is used on every surface. Conversion is
announced quietly: a small dotted underline under converted aggregate numbers opens a "how this number was calculated" receipt (source
currency, rate basis, period, record count, "raw provider rate, no customer margin", estimated days). Transactions keep their own currency;
the display-currency equivalent is in a tooltip (tables) or a muted second line (details). Balances stay in USD with a tiny `USD` tag. The
page is a showcase: a faithful, interactive header replica (switcher between theme and fullscreen; sub-item of the user menu and drawer entry
below `sm`), a live demo that really converts mock data shaped like the API (decimal strings, BigInt maths), the compaction ladder, tables,
charts, the sign lab, states and accessibility notes, plus a floating Decisions panel for the five open design questions.

Entry: `/lab/frame-dashboard.html#/amount-display/v2-quiet-figures?lang=ar&theme=dark`. Files: `parts/money-core.ts` (the reference prototype to
port to `src/lib/money`, with a self-test button in section 4), `parts/amount.tsx`, `parts/currency-sign.tsx`, `parts/switcher.tsx`,
`parts/header-replica.tsx`, `parts/receipt.tsx`, `parts/convert.ts` + `parts/data.ts` (mock API + conversion rules), `parts/kpi.tsx`,
`parts/ladder.tsx`, `parts/table-demo.tsx`, `parts/charts.tsx`, `parts/sign-lab.tsx`, `parts/states.tsx`, `parts/a11y.tsx`,
`parts/surfaces.tsx`, `parts/decisions-panel.tsx`. Screenshots in `shots/` (`<width>-<rtl|ltr>-<light|dark>.png` are full-page).

## Key decisions
- **Hierarchy by weight and tone, not colour**: sign and unit use `text-muted-foreground` and a lighter weight; unit at 0.8em; cents at 60% opacity; no coloured stripes on cards (neutral surface, coloured icon only). The component inherits the surrounding font size (`SparkStatCard` keeps `text-4xl sm:text-3xl font-black`).
- **One isolate**: `<bdi dir="ltr" role="img" aria-label="exact amount + currency name">` holding `[sign][space][-][number][unit]`; sign `aria-hidden`; identical picture in AR and EN (SAMA rules 1-4).
- **Sign** = CSS mask in `currentColor`, one `<style>` rule per currency (`SignStyles`), `print-color-adjust: exact`, `forced-colors` -> `CanvasText`. SAR box 0.725em, offset -0.055em, gap 0.25em, never mirrored. Seven official SVGs copied from the backend seed; other currencies fall back to the code in small size.
- **Exact value without nested buttons in tables**: tables use a tooltip on a focusable span (equivalent, rate and day, exact value when the column is compacted). KPI / chart / list use a Popover opened by mouse hover, keyboard focus-visible and touch tap, so touch and keyboard get the same card as the mouse (Radix tooltips do not open by touch).
- **Compaction** exactly as plan 5.3 (kpi >= 10,000; chart/list >= 1,000; table = per-column decision at a 1M value; detail/inline never; 3 significant digits; `999,950 -> 1M`; `1,500 -> 1.5K`). Chart axis ticks are compact text without the sign. 35 self-test cases in `money-core.ts` all pass.
- **Conversion rules** implemented in `convert.ts`: aggregate = per-day USD x day rate, except a record whose own currency equals the display currency counts its original amount (the mock freezes `usd` with a 1.2% customer margin so the effect is visible); averages and ratios from converted sums; rankings by USD; balances USD with the equivalent "at today's rate"; estimated days flagged by a small tag and listed in the receipt.
- **Mobile switcher**: below `sm` the header has no room, so it is an entry in the user menu that expands in place (a fly-out sub-menu does not fit in a menu that is 100vw wide) and an expandable entry in the drawer, both with 44px rows. A one-time chip "At each transaction's day rate" appears under the header after the first choice.
- **Charts** are hand-drawn SVG (the lab has no Recharts); time axis direction follows decision (b); keyboard arrows move the tooltip.
- The page does not import project code: the money core and every component are lab-local prototypes.

## Open questions
- The five design questions are live in the Decisions panel: (a) Arabic negative `⃁ -1,250.00` vs `⃁ 1,250.00-`; (b) Arabic chart axis LTR vs RTL; (c) `$` vs `USD` in multi-currency tables; (d) `≈` before converted equivalents; (e) sign box 0.725em vs 0.8em.
- Is a 60% opacity on cents acceptable for a 4.5:1 contrast on the muted table text (`.00` in tables is quiet by design)? Owner decision under the preserve-design rule: this changes how the real tiles look.
- Table column compaction at 1M also compacts small mixed-currency rows ("1.25K" next to "4.25M"); keep the uniform rule or only compact the cells above 1M?
- Amount in words for irreversible confirms (SAMA rule 3) is only documented as a static example (section 10); the Arabic number-to-words function is not implemented.
- `AED` and `OMR` sign metrics (height, vertical offset) are visual estimates; check them against the final official files when Unicode 18 fonts exist.
- Not verified: Safari / iOS rendering of CSS masks, a real screen reader, the real print dialog, and forced-colors on a real Windows high-contrast theme (simulated only).
