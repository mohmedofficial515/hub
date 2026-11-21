---
app: dashboard
page: amount-display
route: (component) every money surface of the dashboard + the topbar display-currency switcher
live-url: # no single route; see sources
sources:
  - src/components/shared/money-text.tsx
  - src/components/shared/money.tsx
  - src/components/shared/currency-symbol.tsx
  - src/components/shared/locale-format.ts
  - src/components/ui/sar-icon.tsx
  - src/components/analytics/stats/ (spark-stat-card, stat-card, top-value-list-card)
  - src/components/analytics/charts/ (chart-tip, donut-chart, series-report-plot)
  - src/components/data-grid/cells/primitives/currency-cell.tsx
  - src/components/layout/ (topbar, where the switcher goes)
  - plan: Goteav-Dashboard/docs/amount-display/README.md (+ 01-inventory.md, ~390 money spots)
status: researching
---

# Amount display (component vision)

## Purpose
Every staff member reads money all day: KPI tiles, charts, booking and payment tables, detail sheets,
confirm dialogs. This "page" is a component showcase: the one `<Amount>` component in every context it
will be used in, plus the topbar switcher that sets the dashboard's display currency.

## Problems with the current display (code review 2026-11-10)
- Large values are shown in full in KPI tiles ("USD 12,345,678.50" at text-4xl): hard to read, easy to misread.
- Eight different ways to format money; the same booking total shows as a SAR icon in one place and
  "SAR 1,250.00" text a few pixels away.
- `compactNumber` prints Arabic unit letters on English pages ("15أ") and rounds 1,500 to "2K".
- The SAR mark is a JPG (`rs.jpg`): it does not follow the text colour or dark mode.
- The exact value of a compacted amount is only in a `title` (no keyboard / touch / screen-reader access).
- Reporting totals are USD (backend), but nothing tells the reader which basis a KPI is in.

## Goals (owner decisions 2026-11-10)
- One `<Amount>` component; compaction by context: KPI >= 10K, charts and top lists >= 1K, tables >= 1M,
  details / confirmations / toasts never. Units `K / M / B` (Latin) in Arabic and English.
- Official currency symbols for every currency (backend `symbolSvg`, painted in the text colour), else the code.
- Topbar display-currency switcher for the whole dashboard; aggregates convert server-side at each
  transaction day's rate; real transactions keep their own currency with a muted converted equivalent.
- The choice is saved on the staff profile; the default is an owner setting.
- Must not change any layout or measurement of the real pages (preserve-design rule).

## Constraints
- RTL + LTR, light + dark, 390 / 768 / 1440.
- Latin digits always; amounts are decimal strings (up to 15 integer + 8 fraction digits), never floats.
- Data: mock fixtures shaped like the OpenAPI models (`stats/overview` `*Usd` fields, bookings `totals`,
  `/admin/fx/currencies` `symbolSvg` / `decimalDigits` / `names` / `abbreviations`).

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current money display (8 formatters) | reference |
