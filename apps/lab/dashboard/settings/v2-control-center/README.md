---
version: v2-control-center
title: Control centre
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (rewritten as the status board: attention list, latest changes, section masonry)
  - src/features/settings/settings-cluster-page.tsx, components/cluster-layout/* (cluster level removed; one shell with a scope switch)
  - src/features/settings/settings-category-page.tsx (group page header, related groups, callouts)
  - src/features/settings/components/server/server-settings-group.tsx (save bar, review sheet, history drawer, restore as new version)
  - src/features/settings/components/server/settings-sections.tsx (sticky subsection index with scroll-spy from lg)
  - src/features/settings/components/server/setting-row.tsx (Edited / Not default markers, Reset, Undo, copy field link, no amber edge)
  - src/features/settings/components/server/schema-field.tsx (stepper, chips, tag list, ordered list, masked secret)
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx (provider cards with on/off from payment methods)
  - src/features/settings/components/whatsapp-provider/* (status + test aside)
  - src/features/settings/components/tabs/* + components/settings-widget.tsx (one instant-apply panel with live preview)
  - src/features/settings/catalog/ (8 sections, maintenance entry, related-group map, summary templates per group)
  - src/components/ui/switch.tsx (44 px hit area, w-11 track)
  - src/components/ui/button.tsx (dark:!text-white fails AA on the dark primary; primary text must use primary-foreground)
  - new: settings field search (combobox) with path and deep link `?focus=`
ported: # branch / commit once ported
---

# Control centre (مركز التحكم)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v2-control-center?lang=ar&theme=light`

Useful hash params: `view=group&g=refund_policy`, `&f=<field key>` (deep link + highlight), `&panel=review|history`,
`&draft=demo` (preloads edits for refund_policy / security / flights), `view=prefs&tab=tables`, `q=lockout`,
`viewer=owner|admin|none`, `scenario=loading|error|empty`.

## Idea
The overview stops being a directory. It is a **live status board**: a header with the scope switch
(Organisation | My preferences) and a field-level search (`/` focuses it), then a **Needs attention** triage list
(groups with `attention`, master switches that are off, P0 proposed gaps, plus unsaved drafts and pending approvals),
each a sentence with a **Fix** button that opens the exact field and highlights it. Beside it, the latest changes
across groups. Below, the 8 sections as a balanced masonry of calm neutral cards; every group row carries a
**live value summary** built from 2–3 real values («اختيار العميل · موافقة فوق 250 دولار · خلال 10 أيام»), a state
pill and lamp, distance from defaults, version and who/when. Everything on the board is computed from the session's
saved values, so saving a group (or fixing a tax number) changes the board.

## Key decisions
- **One shell, three views, internal routing synced to the frame hash** (Back works; every field has a copyable link).
- **Attention is rule-based, not static**: each mock `attention` has a resolve rule (tax number filled, SMS removed
  from payment link, fresh balance reading…). Severity order: blocks work → risk → missing → awaiting approval →
  draft → for your information. Maintenance "off" is treated as healthy, not as attention.
- **Drafts are kept per group** instead of blocking navigation; the board shows "Draft (n)" pills and a draft item in
  the attention list, so nothing is forgotten.
- **Group page**: header with state, version, last change and note, "Reset group to defaults", History, copy link,
  and a "What lives where" panel (overlap note from audit §9.2 + related group links). Sticky subsection index with
  scroll-spy (horizontal chip row on phones), Advanced fields folded, sticky save bar that always shows state
  ("No changes · v17 saved by…" → "3 unsaved changes · Discard · Review and save"). Save stays enabled; with errors
  it jumps to the first invalid field.
- **Review sheet**: changes as sentences grouped by subsection, never JSON; tags for high impact / security / money /
  two-person / proposed. Security controls → checkbox; high-risk fields → type the group name (diacritics folded);
  `second-approver` groups for a non-owner → "Will wait for a second approver" and "Send for approval" (creates a
  pending request shown on the group and the board). Optional reason (500).
- **History drawer**: timeline of versions with who/when/note/request/approver and readable changes; restore is
  forward only (stages the old values and goes through the same review: "Restore v15 → creates v18").
- **Field rows**: Edited pill + Was + Undo for unsaved edits; dot "Not default" + Default + Reset for saved values;
  Reset per field, per subsection and per group. Proposed fields show «مقترح · S-01 · P0» with a needs-backend tooltip;
  legacy, read-only, structured (summary + editor stub) and advanced handled.
- **Controls**: switch (44 px hit area), stepper with unit and range, money, duration with humanised hint, segmented
  (≤4 options) or select, chips, tag input, ordered list with up/down, masked secret with owner-only reveal (10 s)
  and replace, url with open, time/datetime (Istanbul time), currency/timezone selects, hex colour, uppercase
  country/IATA.
- **Special pages**: gateway keys as provider cards (connected / mode / source, link to the on/off in Payment
  methods), owner only (hidden from the board for admins, with a "one page hidden" note; direct link shows a
  forbidden state). WhatsApp: status and test message in a sticky aside, Cartat account owner only.
- **Preferences**: one compact panel, tabs as a segmented control, instant apply with an "Applied" confirmation,
  colour swatches, font cards rendered in each font, theme "system" marked proposed, and a live preview drawn in
  the chosen theme/colour/font/layout/table/notification options.
- **Owner rules**: neutral cards, colour only on icon tiles and small pills (no side/top stripes); logical classes
  only; Cairo through the dashboard tokens; reduced motion honoured (page fade, attention reveal, highlight glow,
  sheets).
- Version-local Button/Switch/Segmented instead of the dashboard ones (white text on the dark primary fails AA;
  switch under 44 px); Sheet on the Radix dialog primitive because the dashboard Sheet imports next/navigation.

## Open questions
- Should drafts survive navigation (this version) or should leaving a dirty group ask first (Primer)?
- Proposed fields are editable here and flagged in the review; should they be read-only previews until the backend exists?
- Attention resolve rules and severities are version-local; should they live in the catalog or come from the server?
- For a non-owner, should non-security changes in a `second-approver` group save directly while only the security
  ones go for approval (this version sends the whole set)?
- Summary phrases per group are hand-written templates (ar/en); acceptable to maintain, or derive from field metadata?
- Search has no synonym list yet (قفل/حظر/lockout); worth adding per field?

## Screenshots (`shots/`)
- Overview, full page: `{390,768,1440}-{rtl,ltr}-{light,dark}.png` (12).
- At 1440-rtl-light and 390-rtl-dark: `group-*` (security, deep link to `lockout.maxFailures`), `review-*` (security
  draft seen by an admin: approval note + type-to-confirm), `history-*` (platform, 5 versions), `prefs-*`,
  `search-*` (query `lockout`).
- Taken headless with reduced motion; no horizontal overflow at any width after the fix to the group grid.

## Changes after the UX review (2026-11-19, review.md)
- **Labels**: generic leaf labels («مفعّل», «النقاط», «العربية»…) now read "parent ◂ label" (e.g. «الدخول برقم الهاتف ◂ مفعّل»),
  from a version-local parent map (`i18n.ts › parents`, `model.ts › fieldLabel`), used in rows, search, review, history and attention.
- **Touch targets**: every interactive element ≥ 44 px at 390 (measured: 0 under 44 on overview, security, refund, maintenance,
  gateways, WhatsApp, fraud, preferences, review and history). Switch root is the 44 px hit area (track drawn as `::before`);
  copy-link is always visible (44 px on touch, 32 px on desktop); Reset/Undo/Reset group/tag remove 44 px on touch;
  attention «Fix», scope switch and segmented controls 44 px at every width.
- **Chips**: at most one chip per field row, chosen by importance (proposed > legacy > high impact > two-person > money > security);
  chips are plain text, not buttons. Groups that are mostly security controls say it once in the header.
- **Copy**: field help that repeats the subsection lead, the group description or an earlier field is visually hidden (kept for
  screen readers); maintenance shows one "new group" notice instead of three.
- **Long text** (messages, addresses, any free text over 40 characters) uses a textarea.
- **P2**: masonry balanced (largest sections first, then section order per column); gateway cards top-aligned and no Reset/Default
  on secrets; Latin digits in time/datetime fields (patterned text inputs "2026-11-20 23:00" instead of native pickers, which draw the browser locale's digits); stepper unit uses `end-3` inside its LTR box; breadcrumb
  chevrons use `rtl:rotate-180`; on phones the group description, meta and "what lives where" fold under «عن هذه المجموعة»;
  the prototype bar is styled as lab tooling (LAB tag, hatched dashed box, mono type).
- **Contrast** measured with a script (computed colours drawn to a canvas, alpha-composited over the real background), light and
  dark: lowest text ratio after fixes 4.66:1 (primary text on the lightest primary tint); primary tints went from /10 to /5
  because `text-primary` on `bg-primary/10` measured 4.36:1.

## Known gaps
- Sticky save bar shows mid-page in full-page captures (it sticks to the viewport bottom in use).
- The demo draft for refund_policy holds no security / two-person field, so its review shows no approval note; the
  security draft shows it.
