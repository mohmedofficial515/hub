---
version: v5-three-pane
title: Three-pane explorer
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (replaced by the explorer shell: rail + list + editor + inspector; no separate overview page)
  - src/features/settings/components/cluster-layout/ (cluster-layout, cluster-nav, cluster-tab, cluster-header: replaced by the rail and the groups list)
  - src/features/settings/components/server/server-settings-group.tsx (editor column: path strip, subsection anchors with scroll-spy, always-present save bar, pending-request banner)
  - src/features/settings/components/server/settings-sections.tsx (curated subsections from the catalog instead of one section per compound field; "Advanced" fold)
  - src/features/settings/components/server/setting-row.tsx (row: changed-from-default dot, Edited pill, undo, reset, proposed/deprecated/risk pills, info button; no amber edge)
  - src/features/settings/components/server/schema-field.tsx (controls: stepper with range, segmented radiogroup with roving focus, chips, tag input, ordered list with up/down, masked secret with replace + reveal-for-owner, structured summary + dedicated-editor stub)
  - review-changes dialog + history sheet (inside server-settings-group.tsx): readable sentences, type-to-confirm for high risk, checkbox for security, "will wait for a second approver", forward-only restore through the same review
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx (status strip per gateway: keys source, test/live, "customers can pay" from payment_methods, test connection)
  - src/features/settings/components/whatsapp-provider/ (status panel + test message inside the same editor)
  - src/features/settings/components/tabs/ (preferences as an instant editor in the same shell; theme "system" offered and marked proposed)
  - src/features/settings/catalog/ (8 sections, maintenance added, "related" overlap notes per group, gateway index)
  - src/components/shared/form/fields/ (NumberField stepper, segmented, tag input: 44px targets below md)
  - new: settings search index over fields (ar + en, folded Arabic) with filter chips and ?g=&f= deep links
ported: # branch / commit once ported
---

# Three-pane explorer (المستكشف الثلاثي)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v5-three-pane?lang=ar&theme=light`

Deep-link and demo params (in the frame hash): `g=<group>` opens a group, `f=<field key>` highlights a field, `pref=appearance|tables|notifications`,
`s=<section>`, `q=<search>`, `tab=history`, `sheet=1` (inspector sheet below 1280), `inspector=0`, `as=admin` (senior admin instead of owner),
`scenario=loading|error`.

## Idea
Settings become a mail-client style explorer with **no separate overview page**. Three persistent columns: a narrow **rail** (overview, search,
the 8 sections, My preferences, "viewing as"), the **groups list** of the chosen section (each row: state dot, one-line summary, version,
"N changed", Unsaved / New / Pending pills), and the **editor** of the chosen group (path strip with breadcrumb + subsection anchors that follow the
scroll, field rows, always-present save bar). An end-side **inspector** explains the focused field (help, current / draft / default, allowed range,
impact, approval path, proposal id + priority, key, reset, copy link) and holds the group's **history timeline** with forward-only restore.
Switching groups is instant (the editor slides in from the end side; opacity only with reduced motion), and the unsaved-changes guard asks
"Review and save / Discard / Stay". With nothing chosen the editor column shows a short **state of settings**: counts, groups needing attention,
recently changed, proposed fields by priority. The baseline was a directory of cards three clicks deep; here every group is one click from
anywhere, and the list is a status board.

Responsive: 1440 = rail + list + editor + inline inspector (collapsible, Esc closes). 1024 = three columns, inspector as an end-side sheet.
768 = rail + editor, the groups list opens as a drawer over it (Back opens the drawer). 390 = drill-in stack (home: search + sections + state summary →
groups → editor), breadcrumb + Back on every level, inspector as a bottom sheet.

## Key decisions
- **Search lives in column 2.** Typing (or `/` from anywhere) turns the list into field results grouped by section with counts; each hit shows
  Section › Group › Subsection and the current value. Filter chips (changed from default, proposed, high impact) work without text. Opening a hit
  opens the group, scrolls to the field, focuses its control and pulses a neutral highlight (no coloured bar). Preferences fields are indexed too.
  Arabic is folded (alef / yaa / taa marbuta, diacritics). No-results state offers sample words.
- **One save mode per form.** Organisation groups: explicit save, bar always present ("No changes · v17 · who, when" → "3 unsaved changes"),
  the primary button stays enabled and says "Nothing to save" when clean (Primer), Discard appears only when dirty. Preferences: instant, with an
  "Applied just now" status and "Reset this tab to defaults"; they never share a form with server groups.
- **Review as sentences.** Each change reads "Label: old → new" under its subsection, with High impact / Security pills. High risk → type the group
  key; security control (not high) → a checkbox; otherwise plain save. For a senior admin, security / two-person fields say "Will wait for a second
  approver" and the button becomes "Send for approval" (a pending request banner + list pill follow, values unchanged); the owner sees
  "Applies at once (you are the owner)". Reason is optional (500 chars) and lands in history.
- **History** is a timeline (who, when, note, request id / approver, readable changes). "Restore v15" opens the same review with the diff back to
  that version and creates v18; nothing is removed. Groups without mock history show their current version as the first entry.
- **Per-field state**: primary dot = changed from default (tooltip shows default), Reset icon per field, "Reset section to defaults" when more than
  one field differs, warning "Edited" pill + struck-through old value + Undo for draft edits. Proposed fields: info pill «مقترح» + id, tooltip with
  priority and "needs backend". Deprecated: struck label + "Legacy" pill. Read-only: lock chip. Advanced: folded per subsection. Structured lists:
  summary + "Edit in the dedicated editor" stub.
- **Overlaps**: every group appears once. A neutral "what lives where" note under the header links the neighbours (from audit §9.2; e.g. Security ↔
  Verification ↔ Abuse protection ↔ Security alerts; Flights ↔ Flight supplier ↔ Supplier guards; the post-booking switch chain). Fields stored in
  another group show "Stored in: …".
- **Special pages** reuse the editor: Payment gateways adds a strip per gateway (keys source, test/live, "Customers can pay: On/Off" that jumps to
  the matching Payment methods field, Test connection); secrets are masked, Replace opens a new-key input whose Show toggle is owner only. WhatsApp
  has a status panel (state, provider, last success/error, Check now) and a Send test message action; the Cartat account is replaced by an
  owner-only note for admins. Maintenance carries a "New" badge and an info note that it is not in the dashboard yet.
- **Permission-hidden**: as senior admin the gateways page disappears from lists and search; the payments list ends with "1 page hidden: owner only".
- **No stripes**: selection = neutral filled row + bold title + primary icon on a card tile; callouts are neutral surfaces with a coloured icon;
  tints only on small pills and dots.
- **cn()**: a local `parts/cn.ts` registers the dashboard's numeric text sizes with tailwind-merge (the lab's `@lab/utils` cn drops `text-13`
  next to `text-muted-foreground`), same as the dashboard's `src/lib/utils.ts`.

## Fixes after the UX review (2026-11-19, review.md)
- **Focus return (P0):** dialogs (`Modal` in `parts/ui.tsx`) remember the opener and hand focus back on close (onCloseAutoFocus + unmount,
  with a selector fallback); the inspector sheet captures the opener in onOpenAutoFocus. Drill-in moves focus to the new pane heading
  (`#v5-pane-title`, `#v5-list-title`, `#v5-home-title`); Back focuses the row you came from (`[data-group]` / `[data-section]`).
  Measured: history sheet Esc at 390 → History button; guard Esc and review Esc at 1440 → their openers; section → list heading, group → editor
  heading, Back → the group row.
- **Browser / device Back (P0):** `pane` is now in the hash (`p=home|list|editor`); section, group, preference tab and pane changes `pushState`,
  the focused field only `replaceState`. A `popstate` listener restores the level, and with unsaved edits it steps forward again and shows the
  "Save / Discard / Stay" guard. Measured at 390: editor → Back → list → Back → editor (previous entry) → … never leaves the app.
- **Touch targets (P0):** everything interactive is ≥44px below 1024 (switch and breadcrumbs keep their visual size with a pseudo-element hit
  area; chips, segmented options, icon buttons, tag remove, search clear, toast close grow to 44px; desktop pointers keep 32–36px). Measured:
  0 targets under 44px at 390 (home, list, security, refund policy, preferences) and 768 (security, list drawer).
- **Review (P1):** the confirm button is disabled until the group key is typed (or the impact checkbox ticked) and says why
  (`aria-describedby`). The «مقترح» badge opens the inspector's field details (it is a plain badge with a title in preferences). Keys wrap at
  dots (`<wbr>`). Save bar shows only "No changes · Version N" on narrow widths. 390 header: one-line description, "What lives where" folded.
- **768 (P1):** rail + editor; the groups list is a drawer over the editor (scrim and Esc close it), so the form gets ~700px.
- **Overview (P2):** a persistent «نظرة عامة» row at the top of the groups column with the status line (34 groups · 626 fields · 117 changed · 5 need
  attention); the rail's overview icon has a visible caption; the expand toggle uses a panel icon; the phone home shows the status line under search.
- **Contrast:** measured with a canvas probe (CSS colour → 1×1 canvas → sRGB, alpha-composited over the real background chain, opacity applied):
  minimum 4.86 (1440 en light, refund policy), 4.97 (1440 ar light landing), 4.84 (gateways light), 5.26 (dark modes), 5.33 (390 ar light); 0 failures.
  Pill text was darkened in light (primary) and lightened in dark (all tones) to get there.

## States
Loading skeletons for list and editor (`scenario=loading`), load error with Retry (`scenario=error`), no search results, empty history,
permission-hidden page, pending approval request, unsaved-changes guard, toasts for save / send / restore / discard / tests.

## Open questions
- Should the editor keep the previous group open when the user picks another section in the rail (current behaviour), or clear to the landing?
- Restore of a security group by a non-owner: should it also become a change request (currently it follows the same rule as Save)?
- Type-to-confirm uses the Latin group key (`security`); would the owner prefer typing the Arabic group title?
- 768 now uses rail + editor with the list as a drawer (review recommendation). Confirm this is the preferred tablet layout.
- Gateway order in `payment_methods.gateways` is assumed (STRIPE 0 … IYZICO 6) for the "customers can pay" link.
- The "related" notes are written in the version (`parts/related.ts`); when ported they should move to the catalog next to each group.
