# finance/currencies - v1-baseline: component inventory

Page: `F:/Goteav/Goteav-Dashboard/src/features/finance/finance-currencies-page.tsx`
Route: `/{ar|en}/finance/currencies`. Gate: `useFxAbilities().view` else `ForbiddenState permission="fx.read"`.

## Page structure (top to bottom)
1. `FxRefreshCard` - section card: title "rates vs USD base", meta (provider, safety margin %, stale-after minutes), outlined "Refresh rates" GatedButton, warning strip when stale currencies exist. Loading: Skeleton h-28; error: red bordered alert.
2. Info note (inline `<p>`): primary/5 tinted box with `Info` icon, text `finance.currencies.payment.note`.
3. `DataGrid` (id `finance-currencies`) - currency catalogue joined with rates. Title/description in the grid frame.
4. `OverridesCard` (only if `viewOverrides`) - section card "pinned rates": `SwitchField` "active only", list `<ul>` of override rows (code, rate, StatusBadge state, created/expires DateText, note, Revoke GatedButton when active), empty text, skeleton, error.
5. Dialogs (mounted on demand): `PaymentModeDialog`, `PinRateDialog`; `ConfirmAction` for revoke; `ConfirmAction` + result `Dialog` (old to new diff table) inside `FxRefreshCard`.

## Shared components used
| Component | File | Used for |
|---|---|---|
| FinanceCurrenciesPage / Currencies / PaymentModeCell / OverridesCard | `src/features/finance/finance-currencies-page.tsx` | page, grid cell, pins card |
| FxRefreshCard (+ `diffRates`, `FX_OUTLIER_PERCENT = 5`) | `src/features/finance/components/currencies/fx-refresh-card.tsx` | rate summary + refresh flow + diff dialog (outlier rows >=5% flagged red) |
| PaymentModeDialog | `src/features/finance/components/currencies/payment-mode-dialog.tsx` | CHARGEABLE / DISPLAY_ONLY + charge-in currency (uses `FormDialogFrame`, `RadioCardField`, `SelectField`) |
| PinRateDialog | `src/features/finance/components/currencies/pin-rate-dialog.tsx` | manual USD rate, expiry, note; type the rate back to confirm (uses `FormDialog`, `TextField`, `TextareaField`, `WizardFieldIcon`, react-hook-form + zod) |
| DataGrid + `DataGridConfig` | `src/components/data-grid/` (`data-grid.tsx`, `types.ts`, `index.ts`) | the table engine, see below |
| StatusBadge | `src/components/shared/status-badge.tsx` | source (provider/manual), payment mode, override state; tones: success, secondary, warning, outline |
| DateText | `src/components/shared/date-text.tsx` | fetchedAt, createdAt, expiresAt |
| Switch (`ui/switch`) | `src/components/ui/switch.tsx` | per-row "shown to customers" toggle (applies at once with Undo toast) |
| SwitchField | `src/components/shared/form` | "active only" in OverridesCard |
| ConfirmAction | `src/components/shared/confirm-action.tsx` | refresh confirm, revoke confirm |
| GatedButton | `src/components/shared/permission-gate.tsx` | Refresh, Revoke: disabled + tooltip naming missing permission, `pending` state |
| ForbiddenState | `src/components/shared/forbidden-state.tsx` | no `fx.read` |
| toastUndo / toastRetry | `src/components/shared/feedback-toasts.ts` | show/hide currency feedback |
| Skeleton, Button, Dialog* | `src/components/ui/` | loading, actions, diff dialog |
| lucide icons | - | CreditCard (payment action), Pin (pin action), Info, RefreshCw, AlertTriangle |
| useTranslation | `src/lib/i18n/use-translation` | all text; keys under `finance.currencies.*` |

Visual vocabulary of the page: cards are `rounded-2xl border border-border/70 bg-card p-4`; titles `text-14 font-bold`; helper text `text-12 text-muted-foreground`; numbers `tabular-nums` in `dir="ltr"`; codes `font-mono font-bold`; warnings `text-warning` / `bg-warning/10`.

## Data model (from `src/apiEndpoint/fx`, generated DTOs)
**Currency** (`CurrencyDto`, row of the grid; page adds `rate: FxRate | undefined`)
| Field | Type | Meaning |
|---|---|---|
| code | string | ISO 4217, immutable, row id |
| name | string | display name |
| symbol | string \| null | |
| decimalDigits | number | minor units |
| enabled | boolean | shown to customers |
| paymentMode | CHARGEABLE \| DISPLAY_ONLY | owner-set |
| effectivePaymentMode | same | what actually applies |
| chargeCurrency | string \| null | display-only charged in this (null = USD) |
| effectiveChargeCurrency | string | currency actually charged now |
| gatewaySupported | boolean | an enabled gateway settles it |
| degraded | boolean | CHARGEABLE but no gateway: behaves display-only (warning shown) |
| marginPercentOverride | number \| null | per-currency margin, null = default |

**FxRate** (`AdminFxRatesDto["rates"][n]`; envelope has `base: 'USD'`, `provider`, `displayCurrencies`, `safetyMarginPercent`, `staleAfterMinutes`)
| Field | Type | Meaning |
|---|---|---|
| currency | string | ISO code |
| raw | string (decimal) | provider rate per 1 USD |
| effective | string (decimal) | after safety margin, what customers pay |
| source | provider \| manual | tone secondary / warning |
| provider | string | e.g. frankfurter, manual |
| fetchedAt | ISO string | |
| isStale | boolean | shows "stale" warning |
| expiresAt | string \| null | manual override expiry |
| rateId | string \| null | null for base |

**FxOverride** (`FxOverrideDto`, pinned rate)
| Field | Type | Meaning |
|---|---|---|
| id | string | |
| quoteCurrency | string | ISO code |
| rate | string (decimal) | units per 1 USD; immutable |
| active | boolean | in force now |
| createdAt / createdById | string / string\|null | |
| expiresAt | string \| null | auto-expiry |
| revokedAt / revokedById | string\|null | |
| note | string \| null | reason |
Derived state via `fxOverrideState(o)`: active / expired / revoked (tones success / secondary / outline). Rates are decimal strings, never converted to float.

## Current grid columns
| id | cell | notes |
|---|---|---|
| code | custom | code (mono, LTR) + symbol + name below; sortable; search keys: code, name |
| enabled | custom | Switch; select filter (on/off) + quick-filter chips (success/secondary dots) |
| payment | custom | StatusBadge chargeable/display-only, "charged in X", degraded warning; not sortable |
| effective | custom | effective rate bold + "raw" muted below, end-aligned LTR; not sortable |
| source | custom | StatusBadge + stale label |
| fetchedAt | custom | DateText |
| margin | custom | "default" or N% |
Row actions: "Payment mode" (CreditCard, needs `CurrenciesManage`), "Pin rate" (Pin, only if enabled, needs `OverridesManage`). Default sort: enabled first, then code. Grid props used: `loading`, `error`, `onRetry`, `searchPlaceholder`, `exportName="currencies"`, `urlStateKey="currencies"`, `gridTitle`, `gridDescription`.

## DataGrid features the redesign should reuse (`src/components/data-grid/types.ts`, `data-grid.tsx`)
Config shape `DataGridConfig<TData>`: `id` (key for saved view prefs), `columns: ColumnSchema[]`, `getRowId`, `searchKeys`, `searchRecents`, `onRowClick`, `emptyState {action}`, `rowActions`, `bulkActions`, `toolbarActions`, `quickFilters`, `dateFilter`, `expandableRow`, `enableRowSelection`, `mapView`.
- **Columns** (`ColumnSchema`): `id`, `accessorKey`/`accessorFn`, `header` (i18n key), `cellType` (text, number, currency, date, datetime, status-badge, tag-list, user-info, phone, email, link, boolean, progress-bar, rating, count-badge, copy, image-thumbnail, location, actions, custom + `render(row, t)`), `cellProps`, `width`, `minSize`, `align`, `enableSorting/Filtering/Hiding/Resizing`, `filterType` (text, number, select, date-range, boolean), `filterOptions`, `filterAccessorKey`, `pinned` (left/right), `hidden` (default hidden).
- **Search**: global search box over `searchKeys`, `searchPlaceholder`, recent searches (sessionStorage).
- **Filters**: filter sheet per column type (text/number operators, select, date-range, boolean), toolbar date filter, **quick-filter chips** (`columnId`, options with tone dot, `showAll`, `multiple`, `showCounts`, `defaultVisible`).
- **Sort**: column header menu; multi-state sorting saved in view state; server sort supported.
- **Columns UI**: reorder (dnd-kit), show/hide, pin, resize via view options + header menu; persisted per grid `id` in localStorage (`GridViewState`: columnOrder, visibility, pinning, sizing, sorting, density, striped, bordered, stickyHeader, showQuickFilters, showDateFilter, shapeTheme classic/modern).
- **Density**: comfortable / standard / compact.
- **Pagination**: `pageSizeOptions`, `pagination` toggle; server mode via `server`, `rowCount`, `fetching`.
- **Export**: CSV via `exportName`.
- **URL state**: `urlStateKey` prefixes search/filter/paging params (shareable links).
- **Row actions**: `RowAction` with `icon`, `inline` (max 2 icon buttons) vs overflow menu, `showLabel`, `show(row)`, `permission` (hidden if none in section, disabled + tooltip otherwise), `disabledReason`, `confirm` (ConfirmAction with optional audit reason), `ariaLabel(row)`, `variant`.
- **Bulk actions**: row checkboxes + bulk bar (not used by this page).
- **Embedding/layout**: `toolbar`, `pagination`, `frame: card|none`, `gridTitle`, `gridDescription`, `gridAction`.
- **Responsive**: below `md` table becomes stacked **mobile cards** (`mobileCards`, default on); loading skeleton, error state with retry, empty state.
- Other: `expandableRow`, `mapView` (not relevant).

## Constraints for any redesign
- Keep all permissions/gating behaviour, Undo-on-toggle (no confirm), decimal-string rates, LTR numerals inside RTL, AR + EN, light + dark.
- Reuse DataGrid features above rather than custom tables; new visual ideas should be expressible via `render`, `quickFilters`, `gridAction`, density/shape theme.
