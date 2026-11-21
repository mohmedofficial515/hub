# settings - v1-baseline: component inventory

Dashboard root: `F:/Goteav/Goteav-Dashboard/src`. Feature: `features/settings/`. Routes under
`app/[locale]/(dashboard)/settings/`. All text through `useTranslation` (`lib/i18n/use-translation`), keys under
`settings.*`.

## Structure today: overview -> cluster -> category

| Level | Route | Renders |
|---|---|---|
| Wrapper | `settings/layout.tsx` | `<div className="py-3">` only. Clusters are not in a second sidebar; the main sidebar has one "Settings" entry. |
| Overview | `/settings` (`settings/page.tsx`) | `SettingsOverviewPage`: two stacked `ClusterCard`s (see below). The page title (`WizardPageHeader`) and a 3-number stats strip exist in code but are commented out, so the page starts directly with the first card. |
| Cluster | `/settings/[cluster]` (`[cluster]/page.tsx`) | `SettingsClusterPage`: client redirect to the cluster's first category, or a not-found block. |
| Cluster frame | `[cluster]/layout.tsx` | `ClusterLayout`: `ClusterHeader` (breadcrumb back to the overview, icon, title, description, "N categories" chip) above a row of `ClusterNav` (`xl:w-72`, sticky) + the category content. Categories behind a permission are filtered with `isCategoryVisible`. |
| Category | `/settings/[cluster]/[category]` | `SettingsCategoryPage`: a personal tab (appearance / tables / notif) in one big card, or `ServerSettingsGroup` for an `org-<key>` group, or one of the two special pages (`org-payment-gateways`, `org-whatsapp-provider`). `?focus=<path>` scrolls to a field. Wrapper has `min-h-[calc(100vh-280px)]`. |

### Catalog (`features/settings/catalog/`)
- `clusters.ts`: `preferences` (local, Palette icon: `appearance`, `tables`, `notif`) and `organisation`
  (server, Building2 icon).
- `categories.ts`: `ORGANISATION_GROUPS` = 31 backend groups in display order with an icon each; code
  `org-<key with dashes>` (`organisationCategoryCode` / `settingsKeyOfCategory`). Two extra pages that are not
  groups: `org-payment-gateways` (permission `PaymentGatewaysPermission.Manage`, owner only) after
  `payment_methods`, and `org-whatsapp-provider` (permission `NotificationsPermission.ManageProviders`) after
  `notifications`. Total 33 organisation categories.
- `ORGANISATION_SECTIONS` (overview only): access 6, customers 2, payments 8 (incl. gateways), pricing 4, staff 3,
  flights 3, system 7 (incl. WhatsApp).
- `types.ts`: `CatalogCluster`, `CatalogSection`, `CatalogCategory` (+ optional `permission`), and legacy
  `CatalogSetting` / `SettingType` / `SettingVisibility` (no longer used by the server groups).
- Backend has 33 groups in `backend/src/modules/settings/groups/index.ts`; `pricing` (edited from the finance
  pricing-rules page) and `maintenance` (docs/32, not yet in the dashboard's generated `SettingsKey`) are not in
  the catalog.

### Overview page (`features/settings/settings-overview-page.tsx`)
- `ClusterCard`: rounded-[20px] card, header band (icon tile, title, description, storage chip "This browser"
  `MonitorSmartphone` / "Saved to server" `Cloud`), body `p-5`.
- Personal cluster: `PreferenceTile` x3 in a `sm:2 / xl:3` grid (gradient icon tile, name, description, chevron
  button, decorative `bg-primary/5` circle at the end-top corner).
- Organisation cluster: `TextField` filter (matches name, code, translated group description; shows "N matches"),
  then a `lg:grid-cols-[17rem_1fr]` split: section list as `role="tablist"` (vertical from `lg`, a horizontal
  scrolling row below; icon, title, one-line description from `lg`, count badge, start-edge accent bar on the
  selected one) and a panel with the selected section's header ("N groups" chip) and `CategoryLink` cards
  (`sm:2 / 2xl:3` grid). Only one section is visible at a time; search jumps to the first matching section.
- `CategoryLink`: icon tile, name, description (`line-clamp-2`, from the group summary or i18n), chevron, and a
  dashed footer with "Version N" (`GitCommitHorizontal`) and last change date (`DateText`), skeleton while loading.
- Data: `useSettingsGroups()` -> `SettingsGroupSummary[]` (key, version, updatedAt, description);
  `useSettingsAbilities().view` hides the organisation cluster without `settings.read`.

### Cluster frame (`features/settings/components/cluster-layout/`)
| File | Role |
|---|---|
| `cluster-layout.tsx` | header + `flex xl:flex-row` (nav aside `xl:sticky xl:top-0 xl:w-72`) + content |
| `cluster-header.tsx` | `WizardPageHeader` with breadcrumb to the overview and an "N categories" chip |
| `cluster-nav.tsx` | card with titled header ("Categories", "category X of N", count) and a search `TextField` (from `xl`); list is a horizontal scroll row below `xl`, and from `xl` a vertical list with fixed `xl:h-[calc(100vh-280px)]`, inner scroll, scrollbar hidden |
| `cluster-tab.tsx` | one category link: icon, name, description (truncated), active state |

### Organisation group editor (`features/settings/components/server/`)
| File | Role |
|---|---|
| `server-settings-group.tsx` (1076 lines) | `ServerSettingsGroup` -> `GroupEditor`: loads `useSettings(key)` + `useSettingsSchema(key)`, keeps a local draft, and renders: header card (gradient icon, name, description, chips: technical key `refund_policy`, "Version N · date", "N sections · N fields", "Security settings" when the group needs a second admin, "N changed" when dirty; actions: `ViewToolbar` + History button), read-only note, 409 conflict banner, `PendingChangeBanner` (security change request waiting), `SettingsGroupNote`, the `SettingsSections`, the sticky unsaved bar, `ReviewChanges` dialog, history `Sheet` with `HistoryPanel` |
| `settings-sections.tsx` | splits top-level fields: all simple fields share "General", every compound field (nullable object, list, nested object, map) gets its own section. Section index: a card with header + search (when many sections) and a vertical list only from `2xl` (>=1536 px); below that a horizontal tab row (`overflow-x-auto`, scrollbar hidden). Dots mark unsaved changes / errors per section. All sections stay mounted, only the selected one is shown (deep links and errors reach every field). |
| `schema-field.tsx` (1312 lines) | recursive JSON Schema renderer: leaves -> `SettingRow`; objects -> nested groups; arrays -> repeaters (add / remove); maps -> key/value list or a switch matrix (every value a set of flags) with "Edit as JSON"; unions and mixed types -> JSON editor. Labels via `WizardFieldIcon` + `settingsFieldIcon` |
| `setting-row.tsx` | one simple setting as a two-column row: name, full description, fact chips (range "Allowed: 0 to 100", default, technical key) on the start side; control on the end side sized to its kind: `SwitchField` + state word, short `NumberField` with unit, custom segmented `role="radiogroup"` for up to 3 options, `SelectField` for more, `TextField` / `DateField` / `DateTimeField` (Riyadh wall time) / `InternationalPhoneField`. Dirty rows: amber edge, "Modified", before -> after, undo. Nullable: "Set a custom value" switch. Compact density trims description and chips. |
| `group-note.tsx` | `SettingsGroupNote`: info strip under the header for `payment_methods`, `tax`, `finance_ledger`, `e_invoicing`, `mobile_app`, with a link to the owning page when permitted |

Save flow (owner decision Q16): edits stay in a local draft -> sticky bottom bar appears ("Unsaved changes",
count + first changed names, optional reason `TextField` max `SETTINGS_REASON_MAX` = 500, Discard, Review changes,
Save as `GatedButton` `settings.write`). Save sends the value with the version it was read at; 409 -> conflict
banner, "Load latest" or "Save anyway" (only through the review dialog). Server validation errors land on their
fields and open the first section with an error. Maker-checker controls need `settings.write_controls` (else
locked with a reason). Security groups: owner (`settings.security_direct`) applies directly; anyone else gets
"Send for approval" (a settings change request a second admin applies, queue page
`security-change-requests-page.tsx`). History sheet: list of versions with date and reason (the author is not shown), a diff per entry
(`diffAuditState`) and rollback through `ConfirmAction` (hidden or "for approval" per ability).

`ViewToolbar`: density segmented "Comfortable / Compact" and a "Technical keys" toggle, per viewer in
localStorage (`lib/settings-view.tsx`).

### Special organisation pages
- `components/payment-gateways/payment-gateways-panel.tsx`: gateway keys per provider (owner only).
- `components/whatsapp-provider/`: `whatsapp-provider-panel.tsx` (status + provider switch), `provider-card.tsx`,
  `cartat-credentials-card.tsx`, `cartat-webhook-card.tsx`, `whatsapp-test-card.tsx`, `whatsapp-status.ts`.

### Personal preferences (`features/settings/components/tabs/`, store `stores/use-settings-store.ts`)
- Applied at once, stored in `localStorage['dashboard-settings']` (zustand persist v2); no Save.
- `appearance-tab.tsx` stacks section cards (`controls/section.tsx`: tinted header band with gradient icon tile):
  `theme-mode-section` (light / dark previews; the store also supports `system`, not offered here),
  `primary-color-section` (8 presets + custom via `ui/color-picker`, saved colours), `layout-style-section`
  (modern / classic / floating thumbnails), `layout-section` (default / compact / no sidebar, `controls/layout-thumb.tsx`),
  `language-section`, `font-family-section` (4 Arabic fonts + a preview whose sample text is hard-coded English),
  `font-size-section` (sm / base / lg / xl).
- `tables-tab.tsx`: density, page size, table feature toggles. `notifications-tab.tsx`: e-mail / push / in-app /
  sound switches (`controls/switch-row.tsx` -> `SwitchField`).
- `controls/option-grid.tsx`: clickable single-choice cards.
- `components/settings-widget.tsx`: the floating draggable round button (bottom corner on every page, from `lg`)
  opening the same preferences in a `Sheet` with `Tabs` (`lib/settings-data.ts`). Visible in the screenshots.

### Lib (`features/settings/lib/`)
`json-schema.ts` (kinds, defaults, paths, client checks, `collectErrors`), `field-text.tsx` (localized label / help /
option names per group: `settings.server.fields.<group>["<path>"]`, RTL isolation of backend English),
`field-icon.ts` (icon from the field name / format / kind), `settings-view.tsx` (saved value + density + keys
context), `deep-equal.ts`, `security-requests.ts`.

## Shared components used (from `src/components/**`)
| Component | File | Used in settings for |
|---|---|---|
| TextField, NumberField, SelectField, SwitchField, TextareaField, CheckboxGroupField, DateField, DateTimeField, InternationalPhoneField, PasswordField | `components/shared/form/` (`fields/*.tsx`, `index.ts`) | every schema field, overview filter, nav search, reason box, WhatsApp / gateway forms |
| WizardPageHeader | `components/shared/wizard-page/wizard-page-header.tsx` | `ClusterHeader` |
| WizardFieldIcon | `components/shared/wizard-page/wizard-field-icon.tsx` | field label icons in `schema-field.tsx` |
| DateText | `components/shared/date-text.tsx` | version dates on cards and headers, history |
| formatDateTime | `components/shared/date-time.ts` | history entries |
| ConfirmAction | `components/shared/confirm-action.tsx` | rollback, gateway / WhatsApp destructive actions, change requests |
| GatedButton | `components/shared/permission-gate.tsx` | Save / Send for approval (disabled + tooltip without permission) |
| DialogBandHeader | `components/shared/dialog-band-header.tsx` | review-changes dialog header |
| ForbiddenState | `components/shared/forbidden-state.tsx` | no `settings.read`; gateway / WhatsApp pages without permission |
| StatusBadge | `components/shared/status-badge.tsx` | gateway, WhatsApp provider, change request states |
| toastDone | `components/shared/feedback-toasts.ts` | WhatsApp / gateway / change request feedback |
| EntityLink | `components/shared/entity-link.tsx` | change request and Cartat credential links |
| DataGrid | `components/data-grid/` | security change requests queue only |
| Button, Skeleton, Dialog, Sheet, Tabs, ColorPicker | `components/ui/{button,skeleton,dialog,sheet,tabs,color-picker}.tsx` | actions, loading, review dialog, history sheet, widget, colour picker |
| SettingsWidget mount | `components/layout/dashboard-shell.tsx` | floating preferences button |

Visual vocabulary: cards `rounded-2xl` / `rounded-[20px] border border-border/70 bg-card` with a soft shadow; headers
with a `from-primary/6` (or `from-muted/40`) gradient band; icon tiles `size-11 rounded-xl` either `bg-primary/10
text-primary` or a `from-primary to-primary/70` gradient with `shadow-primary/25`; titles `text-14`-`text-18
font-bold/extrabold`; helper text `text-11/12 text-muted-foreground`; chips `rounded-md border bg-muted/50 text-11`;
state colours `success` / `info` / `warning` soft tints.
