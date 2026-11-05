---
app: dashboard
page: finance-currencies
route: /[locale]/(dashboard)/finance/currencies
live-url: http://localhost:6001/ar/finance/currencies
sources:
  - src/app/[locale]/(dashboard)/finance/currencies/page.tsx
  - src/features/finance/finance-currencies-page.tsx
  - src/features/finance/components/currencies/ (currency-grid-config, currency-cells, currency-panel, kpi-strip, rate-refresh)
  - src/features/finance/components/currencies/payment-mode-dialog.tsx
  - src/features/finance/components/currencies/pin-rate-dialog.tsx
  - src/components/data-grid/
status: ported
---

# Finance · Currencies

## Purpose
Finance/ops staff manage the FX rate card against the USD base: see effective vs raw rate, refresh from the
provider (with old → new diff), show/hide a currency for customers, set payment mode (chargeable vs
display-only charged in another currency) and pin manual rates.

## Problems with the current page
- Columns are thin: one cell mixes code + symbol + a single-language name.
- No currency flag/symbol artwork; no Arabic / English / Turkish names or abbreviations.
- Little detail: no change vs previous rate, no sparkline, no gateway/decimals/margin context.
- Actions are hidden in a row menu; the table model looks generic.
- Pinned overrides sit far below the grid, disconnected from their currency.

## Goals (owner, 2026-10-28)
- Complete visual redesign as a NEW version only (v2); the real page is untouched.
- Exactly 10 currencies for now (redesign stage).
- Each currency: name in Arabic / English / Turkish, abbreviations in all three languages, an SVG mark.
- More columns, more detail, every cell organised and professional.
- Reuse the DataGrid "table model" (search, filters, sort, sticky header, selection, export, density) but
  restyle it distinctively for this page, with richer actions.
- Direction (chosen): rich table + side detail panel.

## Constraints
- RTL + LTR, light + dark; Arabic is the conversation language, code/docs in English.
- Money/rates stay decimal strings; never converted to float.
- Data from OpenAPI fx models: Currency, FxRate, FxOverride.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page | reference |
| v2-rich-table-panel | rich table + detail side panel | ported (feat/currency-symbols) |
