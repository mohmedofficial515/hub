# v1-baseline: current money display (components)

Screenshots in this folder are **replicas of the current output**, not captures of the running dashboard: `http://localhost:6001`
redirects to the login page (no session available to the lab), and the real components import `next/*`. The replicas use the measured
classes of the real files and print what `formatAmount` / `formatMoneyValue` print today (`USD 12,345,678.50`: code first, one weight,
no compaction). Files: `finance-*` (finance overview KPI), `bookings-*` (flight bookings row), `facts-*` (booking facts), each at
1440 AR-RTL light, 390 AR-RTL dark, 1440 EN-LTR light.

| Surface | Real file | What it does today |
|---|---|---|
| KPI tile | `src/components/analytics/stats/spark-stat-card.tsx` | value in `text-4xl sm:text-3xl font-black` inside `<span dir="ltr">`; optional `<SarIcon size={24}/>` image after the value when `currency` is set |
| Bookings table money cells | `src/features/flights/tables/booking-columns.tsx` | `formatAmount(value, row.currency, locale)`; USD columns (`discountUsd`, `walletAppliedUsd`...) print `USD x`; amount columns have no `align: "end"` |
| Booking facts | `src/features/flights/**/booking-overview.tsx` | label / value rows, value as plain `formatAmount` text |
| SAR mark | `src/components/ui/sar-icon.tsx` (`rs.jpg`) | a JPG: ignores text colour and dark mode |
| Formatters (8 ways) | `src/components/shared/money-text.tsx`, `money.tsx`, `currency-symbol.tsx`, `locale-format.ts` | `compactNumber` prints Arabic units on English pages and rounds 1,500 to "2K" |
| Chart pieces | `src/components/analytics/charts/` (`chart-tip`, `donut-chart`, `series-report-plot`) | compact tooltips (inventory bug 13) |
| Table cell primitive | `src/components/data-grid/cells/primitives/currency-cell.tsx` | defaults to SAR |
| Header (switcher goes here) | `src/components/layout/dashboard-header.tsx`, `toggles.tsx`, `language-toggle.tsx` | `h-14` header, end group `rounded-lg border bg-muted/80 p-1`: language pill, theme, fullscreen, divider, quick actions, notifications |

Full inventory (~390 spots): `Goteav-Dashboard/docs/amount-display/01-inventory.md`.
