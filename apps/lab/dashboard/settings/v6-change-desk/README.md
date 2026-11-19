---
version: v6-change-desk
title: Change desk
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (rewritten: draft ticket card, latest changes, as-of prompt, 8-section index with state rows)
  - src/features/settings/components/server/server-settings-group.tsx (no per-group Save bar; edits stage into the shared draft ticket; history sheet becomes EntryCard list)
  - src/features/settings/components/server/setting-row.tsx (changed-from-default dot instead of amber edge, reset per field, copy link, "in draft" line with impact)
  - src/features/settings/components/server/settings-sections.tsx (subsection index: sticky list from lg, chips below)
  - src/features/settings/components/server/schema-field.tsx (controls per type: stepper with unit, segmented/select, chips, tag list, ordered list with up/down, masked secret)
  - src/features/settings/components/cluster-layout/ (replaced by one shell: header search + Overview / Timeline / As of / My preferences)
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx (gateway on/off from payment_methods staged next to the keys)
  - src/features/settings/components/whatsapp-provider/whatsapp-provider-panel.tsx (switch stages into notifications; credentials stay instant)
  - src/features/settings/components/tabs/ (preferences on one page, instant, colour swatches as a radio group, font preview in Arabic)
  - src/components/shared/form/fields/* (NumberField with unit suffix and min/max steppers; tag list field)
  - new: features/settings/draft/ (draft ticket store across groups, tray dock, review & apply page, impact helpers)
  - new: features/settings/timeline/ (cross-group version feed) and features/settings/as-of/ (state on a date)
  - src/components/shared/confirm-action.tsx (type-to-confirm variant)
ported: # branch / commit once ported
---

# Change desk (مكتب التغييرات)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v6-change-desk?lang=ar&theme=light`
(add `&draft=sample` for a ready draft of 5 changes in 4 groups, `&role=staff` for the senior-staff view,
`&scenario=loading|error|empty` for the states; routes: `&v=group&g=<key>&f=<field>`, `&v=review`, `&v=timeline`,
`&v=asof&d=2026-10-03`, `&v=prefs`; demo flags: `&fail=last` makes the last group of an apply fail with a 409,
`&stale=<groupKey>` moves a group's server version past the staged draft).

## Idea
Settings are treated like a change desk, not a set of forms. Any edit in any group does not save: it is staged into
one persistent **draft ticket** (`CHG-0427`), shown as a ticket-shaped dock at the bottom (a sheet on mobile) that
lists every staged change across groups as a readable sentence with its **impact** ("A 1,000 USD fare (6.5% + 2 USD
fixed fee + rounded up to 0.50 USD) shows as 1,062 → 1,067 USD"; "From the next attempt: after 3 failed tries within 15 minutes the account locks for 1 → 5 →
15 → 60 min"). **Review & apply** groups the ticket by group, shows risk per change, asks for a required reason, a
security confirmation and the ticket code for high-impact changes, says who would wait for a second approver, and
then applies group after group, each getting its own new version. Because every change is versioned, the same data
gives a **timeline** of every version across all groups (filter by person, group, section, risk; forward-only
restore) and an **as-of** view ("which refund policy applied when booking GTV-58210 was made on 3 October?"). The
baseline's directory of cards becomes a status board: one slim strip (ticket state, last change, as-of date), then
the 8 sections as a compact index whose rows show version, author, master switch, changes from default, attention
and draft counts. A single low-risk change can skip the review page with **Save now**.

## Key decisions
- **Persistent draft (review P0-1)**: the ticket is saved in this browser (`localStorage`, key
  `goteav.settings.draft.v1:<viewer>`, every access in try/catch) on each change and restored on load with a
  "Draft restored (N changes) … OK" note; leaving the page with changes asks first (`beforeunload`); "Discard all"
  confirms inline and offers Undo. Each staged change keeps the group version it was staged against; when the server
  version moved on (another person saved, demo `&stale=`), the tray and the review show "X changed <group> after you
  staged your changes" with **Keep my changes on the latest**, and applying a stale group fails like a 409.
- **Fast path (review P0-2)**: when the ticket holds exactly one change that is neither high impact nor a security
  control, the field row and the dock offer **Save now** (no review page, no reason; the version note stays empty and
  a toast names the new version). The reason is required only when the ticket has high-impact or security changes;
  otherwise it is optional. The first staged change of a session shows a toast "Saved to draft CHG-0427, not applied
  yet" with an "Open ticket" action.
- **Honest apply result (review P0-3)**: with any failed group the heading is "3 of 4 groups applied, 1 needs
  attention" with an amber warning icon (green check only when all applied); applied rows link to their version;
  Retry is a full-size button; the conflicting author comes from the group's data (`updatedBy`), not a fixed name.
- **Overview opens with settings (review P1-4)**: the empty ticket, last change and as-of prompt are one slim strip;
  the dock appears only while the ticket holds changes and never on My preferences or the as-of page.
- **Sizes**: no text under 12 px; touch widths: every control ≥ 44 px; desktop: tabs, search, primary and outline
  buttons 40–44 px, inline secondary buttons 36 px, segmented choices 40 px (36 px in the small variant). The Apply
  button is really disabled until its listed steps are done, with the reason under it.
- **Dates**: one long format (`3 أكتوبر 2026` / `3 October 2026`) shown next to native date inputs (forced `en-GB`;
  the native picker itself still draws digits in the browser's locale, so the formatted date beside it is the reference); Latin digits everywhere else.
- **One save mode per form**: organisation groups always stage into the ticket; My preferences are instant and say
  so on the page and in the empty tray; gateway keys and Cartat credentials save at once (they are not settings
  documents), while the switches they share with groups (`payment_methods.gateways.N.enabled`,
  `notifications.providers.whatsapp.enabled`) stage into the ticket. Fields with `storedIn` stage into the storing group.
- **Batch apply is marked «مقترح» / Proposed** on the review screen: the backend saves one group per request, so the
  UI applies sequentially with a per-group result (applied vN / waiting for second approver with request id /
  failed with 409 and retry; `&fail=last` makes the last group fail). Failed changes stay in the draft.
- **Risk tiers**: `risk: 'high'` → type the ticket code; `control: 'security'` → explicit checkbox; money controls
  get a badge only. Second approver: for `approval: 'second-approver'` groups, a security or two-person field waits
  for a second approver when the viewer is senior staff; the owner applies directly and is told so.
- **Impact helper** (`parts/impact.ts`) covers 29 field ids (markup default rule ×6 via a real markup function whose
  sentence states the percent, the fixed fee and the rounding,
  refund days / wallet bonus / approval threshold / top-up cap, lockout ×4, invites, tax inclusive + mode, FX
  margin, loyalty earn + point value, checkout window, price lock, tolerance, maintenance, deletion grace, product
  and gateway switches). Other fields show plain before → after.
- **Ticket visual**: a stub with the ticket code, a dashed perforation with two notches, and the body. No coloured
  side or top stripes; staged rows use a faint warning tint and an "In draft" badge; changed-from-default is a dot.
- **Restore is forward only**: restoring v12 stages the differences into the ticket; applying creates the next version.
- **As-of** reconstructs each group from its history (newest first, revert `from` of later entries). Groups without
  history in the mock that changed after the date are listed separately as "log not loaded" rather than guessed;
  `maintenance` before 18 Nov shows "did not exist yet".
- **Search** reaches groups, fields (label, help, key, value; Arabic + English via the mock's folding) and
  preferences, shows Section › Group › Subsection and the current value, opens the group and pulses the field
  (`f=` deep link, also from "Copy link"). `/` focuses it; arrows + Enter work (combobox + listbox).
- Proposed fields are shown disabled with «مقترح» and a tooltip (S-id, priority, needs backend); deprecated,
  read-only, advanced (folded per subsection), structured (summary + "Open editor" stub) are handled.
- Overlaps: each group appears once; `related` links with a one-line reason in every group header (audit §9.2).
- Lab note: Tailwind in the shared 7320 lab only scans files present at start. New classes of this version appear
  after that lab restarts (or its CSS root is re-saved); screenshots were taken from a private instance on 7321.

## Open questions
- **Batch apply (backend)**: a `POST /admin/settings/_batch` (or a "change set" resource) taking
  `[{ key, expectedVersion, value }]` + reason, applied in one transaction with all-or-nothing semantics, returning
  per-group versions and a `changeSetId` stored on every history row; or, if kept sequential, a change-set id so the
  timeline can link the versions and a policy for partial failure (roll back earlier groups or keep them).
- **Second approver for a mixed ticket**: should a ticket with one security change wait as a whole, or split into
  applied groups + a change request (current prototype splits)?
- **As-of (backend)**: `GET /admin/settings/:key?asOf=<iso>` (or `/_asof?at=` for all groups) using the history rows,
  plus history paging by date; today the client would need every history row of every group.
- **Timeline (backend)**: a cross-group history feed endpoint with filters (actor, key, risk) and the actor's display
  name (`changedById` → staff name).
- Should the draft ticket persist on the server (shared, resumable, reviewable by a second person) instead of the
  browser session?
- Impact helper wording and sample amounts (1,000 USD fare, 300 USD refund for the wallet bonus and the approval
  threshold, 20% sample tax rate, 1,000 USD for FX margin and loyalty) need the owner's eye.
- Should "Save now" also cover money controls (it does today) or only plain fields?
- Type-to-confirm uses the ticket code; alternative: type the group name per high-impact group.

## Screenshots (shots/)
`<width>-<rtl|ltr>-<light|dark>.png` overview at 390 / 768 / 1440, and at 1440-ar-light and 390-ar-dark:
`-group-staged`, `-tray-open`, `-review` (senior staff), `-applied` (`&fail=last`: the last group fails with a 409),
`-timeline`, `-asof`, `-prefs`, `-search`, `-gateways`, `-whatsapp`, `-maintenance`, `-deeplink`; plus
`1440-ar-light-loading`, `-error`, `-staff-overview` (permission-hidden), `-savenow` (also `390-ar-light-savenow`),
`-restored` (draft restored after a reload), `-stale` (409-style notice) and `1440-en-light-search-none`.

## Review fixes (review.md, 2026-11-19)
- [x] P0-1 draft persistence, restore note, leave guard, stale-version notice.
- [x] P0-2 Save now for one low-risk change; reason optional unless high impact or security; first-stage toast.
- [x] P0-3 honest partial-result heading, full-size Retry, no hard-coded name.
- [x] P1 overview starts with the settings index; dock only with changes, never on prefs / as-of.
- [x] P1 targets and text sizes (measured, see Verification); Apply disabled state with reason.
- [x] P1 markup impact discloses the fixed fee and rounding; refund samples unified at 300 USD; one date format.
- [x] P1 type-to-confirm placeholder at full muted contrast; role switch labelled "Lab only".
- [x] P2 colour swatches show a check on the selected one.
- [ ] P1 long group pages: no in-page "N staged" summary beyond the dock (the dock is sticky).
- [ ] P2 restore preview of the diff before staging; "Esc closes tray" hint.

## Verification (2026-11-19, shared lab :7320, one headless Chromium at a time)
- `pnpm lab:check`: all 40 versions compile; `tsc` on this folder: 0 errors.
- Contrast (script over every visible text node, real blended backgrounds, 1440 ar): lowest ratio per page light /
  dark: overview 5.00 / 5.26, group 4.86 / 4.82, review 5.00 / 5.26, timeline 5.00 / 5.26, as-of 5.00 / 4.73,
  preferences 5.00 / 5.26; 0 text nodes under their AA threshold (disabled Apply excluded).
- Targets (390): overview 44 controls, group 145, review 21, all ≥ 44 px (switches counted through their 44 px
  label). 1440: overview and review 0 controls under 36 px; group page 26 under 36 px, all of them the 24 px
  info badges and the changed-from-default dot (tooltip triggers, ≥ 24 px per WCAG 2.5.8).
- Text: 0 text nodes under 12 px on overview, group and review (390 and 1440).
- No horizontal overflow at 390 / 768 / 1440 × ar / en × light / dark.
- Draft restore checked by seeding storage (`-restored` shot); save now, stale notice and partial result captured.

