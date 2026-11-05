---
version: v2-rich-table-panel
title: Rich table + detail panel
status: ported
base: v1-baseline
created: 2026-10-28
tokens: inherit
touches-components:
  - src/components/data-grid/ (column sets as tabs, hover row actions, density, mobile card layout, status rail)
  - src/features/finance/finance-currencies-page.tsx
  - src/features/finance/components/currencies/fx-refresh-card.tsx (becomes KPI strip + dry-run diff sheet)
  - src/features/finance/components/currencies/payment-mode-dialog.tsx (moves into the detail panel)
  - src/features/finance/components/currencies/pin-rate-dialog.tsx (kept as dialog, adds expiry presets)
  - new: CurrencyMark (SVG glyph badge + freshness ring), Sparkline, SpreadBar, side detail panel, bottom sheet
ported: feat/currency-symbols@23c5807 (Goteav-Dashboard) + backend feat/currency-symbols@bf1bc5d9
---

# Rich table + detail panel

Open: `http://localhost:6200/#/dashboard/finance-currencies/v2-rich-table-panel` (frame URL
`/frame-dashboard.html#/finance-currencies/v2-rich-table-panel?lang=ar&theme=dark`).
Demo scenarios: append `&scenario=loading` or `&scenario=error` to the frame hash.

## Idea
The catalogue stays one scannable table of exactly 10 currencies; everything that does not fit a row lives
in a side panel for the selected currency, so the list never loses context. Column sets (Rates / Pricing /
Status) replace horizontal scroll. Each currency has an original SVG glyph mark whose outer ring is its
freshness (fills as the rate ages, dashed red when stale), so no "stale" column is needed. Under each rate a
spread bar shows raw vs effective (a pin icon replaces the dot when a manual override holds the rate). Refresh
is a dry run: a diff sheet lists old to new, flags moves of 5% or more (unchecked by default), shows pinned
currencies as kept, then Apply or Discard.

## Key decisions
- Table chrome follows the real DataGrid exactly (read from `data-grid/styles.ts`, `toolbar/grid-toolbar.tsx`, `data-grid.tsx`, `toolbar/bulk-bar.tsx`, `pagination/grid-pagination.tsx`): `rounded-2xl border bg-card shadow-sm pb-4` frame; header bar (`bg-muted/50 border-b border-border/60 px-5 py-4`, title `text-15 font-bold text-primary`, description `text-12 text-muted-foreground`); icon-only `size-9 rounded-lg` outline buttons with tooltips (view options, export); `gridAction` slot holds Refresh rates; search + quick-filter row (`h-9` search control, `h-6 text-11` pill chips with tone dot and `text-9` count badge); table in `mx-4 rounded-xl` with `bg-muted` sticky header row (`h-11`, `text-12 font-medium`, ArrowUp/ArrowDown/ChevronsUpDown sort glyphs), `border-b` rows, `hover:bg-muted/40`, selected `bg-primary/5`; DataGrid density paddings; shared Checkbox; BulkBar (`mx-4 rounded-xl border p-2 shadow-lg`, count badge, divider, ghost Clear at the end); pagination footer (range text, rows select `h-8 w-[72px]`, first/prev/pages/next/last `size-8` outline buttons, active page filled primary); mobile cards use the DataGrid card look (`rounded-xl border bg-card`, selected `border-primary/40 bg-primary/5`).
- Our additions sit in natural DataGrid slots: Rates/Pricing/Status tabs in the header-bar action group (where DataGrid puts its table/map view toggle); density and column visibility in one View options menu (DataGrid keeps them in View options); KPI tiles remain above the frame and act as quick filters; hover quick actions stay in the row actions cell; bulk bar carries Show/Hide/Export like DataGrid bulk actions.
- Table model reused from DataGrid: search (code, 3 names, 3 abbreviations), quick-filter chips with counts,
  column visibility, sort (aria-sort), density (3), selection + bulk bar, CSV export (selection or filtered),
  pagination (5/10), sticky header and sticky identity column.
- Column sets: Rates (abbreviations, rate, change + sparkline, source, updated), Pricing (rate, margin, payment mode,
  symbol/decimals, 100 USD preview), Status (visible, freshness, pin, source, updated, gateway). Secondary columns
  step aside on tablets and while the inline panel is open below 2xl; the Columns menu still toggles every column.
- Row: status rail on the start edge (selected, stale, hidden), hover/focus quick actions (pin, copy, refresh), visibility
  switch with Undo toast, kebab with the full action set (open, pin or revoke, copy, refresh, history, payment mode, margin, show/hide).
- Panel: three-language identity (name + abbreviation), rate and 8-point trend, customer preview (100 USD converted, Pay
  disabled with the "charged in X" explanation when display-only), payment mode switch + charge currency, margin editor,
  pinned overrides with revoke, history table (text fallback of the sparkline), technical details, action footer.
- Layout: xl shows the panel inline (420px); below xl it is a bottom sheet; at 390 rows become cards.
- Numbers, codes and signs are `dir="ltr"` isolates with a leading sign plus an arrow glyph (never colour only).
  Sparklines and marks do not mirror.
- Motion: row entrance stagger, sheet/dialog/toast transitions; all of it disabled by `prefers-reduced-motion`.
- Own overlay (focus trap, Esc, focus restore) instead of the project Dialog/Sheet: those import the project i18n
  (`useTranslation` via `next/navigation`) which does not run in the lab. Port should use the real Sheet/Dialog.
- Fixtures: `shared/mocks/currencies.ts`. Real DTO shapes (Currency, FxRate, FxOverride, rates as decimal strings, BigInt
  decimal maths for margin and conversion). PROPOSED backend extension: `Currency.names` / `Currency.abbr` (ar, en, tr),
  `FX_HISTORY` (8 market points), `FX_REFRESH_PROPOSAL` (dry-run result).
- Marks are original geometric badges (strokes for $ € £ ₺, Arabic abbreviation on a pattern for Gulf/Egypt/Jordan), no flags.

## Verification
Checked at 1440 / 768 / 390 in RTL and LTR, light and dark (screenshots in `shots/`): no page or table horizontal
overflow, `pnpm typecheck` clean. Interactions exercised: pin with typed confirmation, show/hide with Undo, refresh diff
apply, bottom sheet, column tabs, panel close.

## Open questions
- Margin semantics in the fixture: effective = raw x (1 + margin). Confirm direction with backend.
- Trilingual names and abbreviations: do they live on the Currency model (proposed) or in a client dictionary?
- History source: needs an endpoint (8 daily points) or is derived from stored FxRate rows?
- Turkish abbreviations (e.g. ABD$, TL, SR, KD, QR, JD) are placeholders to be confirmed by the owner.
- Should "Payment mode" keep its confirm dialog in the real product instead of applying instantly with a toast?
- Permissions (fx.read, currencies.manage, overrides.manage) are not simulated; every action is enabled.

## Port notes (2026-10-28)
Ported into Goteav-Dashboard (branch `feat/currency-symbols`, commits 454d811, e9d1a92, f530582, 23c5807, 7cde5fa) and backend (66371cb4, cf010216, bf1bc5d9, 990d2662, da310c89). Side-by-side screenshots in `port/` (`compare-*.png`, `real-*.png`, panel and column-set shots).
Deviations from the lab (intentional):
- The real DataGrid is used as is: its toolbar, view options, filters, selection, export, paging and mobile cards replace the lab chrome. Column sets are tabs (`?tab=`) with one grid id each (own saved view). No DataGrid change was needed.
- The sign is the real `CurrencySymbol` (`symbolSvg`), else the symbol or the code; no invented marks. All currencies the API returns are listed (155 locally), not 10.
- No sparkline, change chip or price history: the API has no history endpoint. KPI tiles are informational (not filters).
- Refresh is not a dry run: the backend applies it at once, so the diff dialog is shown after the refresh (pinned currencies shown as kept, moves of 5% or more flagged).
- Payment mode keeps its confirm dialog (opened from the panel and the row menu). Margin is editable in the panel (0 to 10, Undo).
- Panel is the shared EntitySheet (side by language direction), not the lab's inline xl panel.
- Pin dialog expiry presets: deferred.
