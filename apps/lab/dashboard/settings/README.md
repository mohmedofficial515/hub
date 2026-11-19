---
app: dashboard
page: settings
route: /[locale]/(dashboard)/settings (+ /settings/[cluster] and /settings/[cluster]/[category])
live-url: http://localhost:6001/ar/settings
sources:
  - src/app/[locale]/(dashboard)/settings/ (page, layout, [cluster], [cluster]/[category])
  - src/features/settings/settings-overview-page.tsx
  - src/features/settings/settings-cluster-page.tsx
  - src/features/settings/settings-category-page.tsx
  - src/features/settings/catalog/ (clusters, categories, sections)
  - src/features/settings/components/ (cluster-layout, controls, server, tabs, payment-gateways, whatsapp-provider)
  - backend: src/modules/settings/groups/*.settings.ts (zod schemas of the 30 server groups)
status: designing
---

# Settings

## Purpose
The owner and senior staff configure the whole platform from one place:

- **Personal preferences** (this browser, applied instantly): appearance, tables, notifications.
- **Organisation settings** (server, versioned, explicit Save): 30 backend groups bundled into 7 themed
  sections (access, customers, payments, pricing, staff, flights, system), plus two pages that are not
  groups: payment gateway keys (owner only) and the WhatsApp provider.

## Problems with the current page
- Two stacked cluster cards; the organisation cluster hides 32 entries behind a section tab list, so the
  page reads as a directory, not a control centre.
- No signal of state: which groups are on/off, recently changed, risky, or need attention.
- Group pages render a long generic schema form; no grouping inside a group, no impact hints, weak diff
  before Save.
- Search only filters group names/descriptions, not individual fields.
- Some groups overlap in meaning (security vs security_alerts vs abuse_protection, payment_methods vs
  payment gateways, flights vs flight_provider vs flight_guards) without the page explaining the split.

## Goals (owner, 2026-11-18)
- 4 versions, each a creative, professional, clearly different structure for the WHOLE settings
  experience: overview, group page (fields, Save, change diff, version history) and personal
  preferences. No duplication, tidy and advanced.
- Review every sub-page's settings against the backend schemas; missing settings go in `audit.md` and are
  shown inside the versions marked "proposed". No real backend/dashboard code changes at this stage.
- Process: research with screenshots → 6 concepts → owner picks 4 → build → ux-critic review.

## Constraints
- RTL + LTR, light + dark; Cairo for Arabic; no coloured side/top stripes on cards (owner rule).
- Data shape: `SettingsGroupSummary` (key, version, updatedAt, description) + each group's JSON schema
  (from zod) and values; mock in `shared/mocks/settings/` (import `@lab/mocks/settings`); field audit and proposals in `audit.md`.
- Permissions: some entries are visible only to holders (payment gateways, WhatsApp provider).

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page | reference |
| v2-control-center | live status board: attention strip + 8 section cards with live value rows | draft |
| v3-search-first | command surface: field-level search, filters, inline edit, pinned/recent | draft |
| v4-living-sentences | policy book: groups as readable sentences with inline editable values | draft |
| v5-three-pane | persistent explorer: section rail, group list, editor + inspector | draft |
| v6-change-desk | staged change ticket across groups, impact preview, timeline, as-of-date | draft |
| v7-readiness-journey | launch readiness score, setup checklist, guided group steps, Setup/Operate | draft |

## Owner decisions (2026-11-18)
- Missing settings: report in `audit.md` + shown in versions as "proposed"; no backend change now.
- Each version covers the full flow (overview, group page, preferences, special pages).
- 6 concepts proposed, owner chose all 6 → v2–v7.
- 8 sections (Finance controls split out of Payments), per audit §9.1.
