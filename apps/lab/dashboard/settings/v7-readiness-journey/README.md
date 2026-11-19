---
version: v7-readiness-journey
title: Readiness journey
status: draft # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-18
tokens: inherit # inherit | override (see tokens.css)
touches-components:
  - src/features/settings/settings-overview-page.tsx (replaced: readiness dial + journey / operate index)
  - src/features/settings/catalog/ (8 sections, maintenance + pricing entries, RELATED map)
  - src/features/settings/lib/ (new: readiness rules + evaluator, field search index, value formatter)
  - src/features/settings/components/server/server-settings-group.tsx (guided stepper, aside, sticky save bar)
  - src/features/settings/components/server/settings-sections.tsx (curated subsections as steps)
  - src/features/settings/components/server/setting-row.tsx (recommended value, why-it-matters, reset, copy link, dot marker instead of amber edge)
  - src/features/settings/components/server/schema-field.tsx (controls: stepper, chips, ordered list, masked secret)
  - review-changes dialog -> side sheet with sentences, type-to-confirm, approval note
  - history sheet (author shown, forward-only restore through review)
  - src/features/settings/components/payment-gateways/payment-gateways-panel.tsx
  - src/features/settings/components/whatsapp-provider/*
  - src/features/settings/components/tabs/* (preferences as a 3-step set with live preview)
  - src/components/shared/confirm-action.tsx (inline confirm variant)
  - src/components/ui/switch.tsx (44px hit area)
ported: # branch / commit once ported
---

# Readiness journey (مسار الجاهزية)

Open: `http://127.0.0.1:7320/lab/frame-dashboard.html#/settings/v7-readiness-journey?lang=ar&theme=light`

## Idea
The settings area answers one question first: **what is left in my hands, and what is the next thing to do?**
The overview's focal point is a **settings-health dial («جاهزية الإعدادات», "your part")**: one tick per check the owner
can act on, arranged around the circle in the 8 sections (sector gaps), so the dial *is* the section map. Shape and
colour both carry the state (long solid green bar = done, short heavy dashed strong-amber bar = to do). Checks that only
backend work can close are a separate, quiet figure under the legend («11 بانتظار الخادم», server icon), never in the
headline and never in alarm colours. Beside it: the score sentence, a
single "Next: … Continue" action, a legend and one bar per section. Below, **Setup** mode walks the 8 sections as a
route (numbered stops with a mini progress ring): open checks are "needs setup" cards (what is missing, why it matters,
now vs recommended, *Apply recommendation* / *Open field*), done checks fold away. **Operate** mode is the day-to-day
index (each group once with its live state, recent changes, personal preferences entry), so the page stays useful when
setup is finished. A group page is **guided**: subsections are numbered steps in a vertical stepper with progress,
each field shows «موصى به» and "why it matters" where a rule applies, plus the normal sticky save bar, review and history.

## Key decisions
- **Readiness rules** (`parts/readiness.ts`, 38 rules, evaluated on SAVED values only, never drafts):
  - `done` when the rule's test passes; otherwise `todo` for kinds the owner can fix now (`switch`, `value`,
    `attention`) or `blocked` ("needs backend") for `proposed` (field not in the API: S-01 KVKK, S-02 TÜRSAB,
    S-03/S-04 legal links, S-06/S-07 staff sessions, S-09 deletion wallet, S-14/S-15 block lists, S-23 booking
    cut-off, S-26 quiet hours), `env` (server-bound: E_INVOICING_PROVIDER = none, SMS_PROVIDER = none) and
    `dashboard` (maintenance group not in the dashboard, F-03).
  - Every group `attention` in the mock maps to a rule (tax ID, seller tax office, e-invoicing provider, supplier
    balance reading older than 7 days, payment link by SMS, maintenance); a future attention without a rule becomes a
    generic to-do automatically.
  - Switches that should be on: lockout, staff TOTP, admin IP allow-list (to do: office CIDR saved but list off),
    breached passwords + CAPTCHA, security wave alerts, fraud review + card testing, ledger, money check, manual
    payment and price-adjust approvals, post-booking chain, circuit breaker, supplier search/booking, retention.
  - Cross-group values: a live gateway exists (payment_methods on + gateway keys live), no gateway offered with test
    keys, loyalty product switch agrees with the programme switch, refunds have a second-approval threshold, ops alert
    recipients exist, WhatsApp working.
  - Headline figure = **your part** = owner-actionable done / owner-actionable total (mock: 22 / 27 = 81 %); it reaches
    100 % by the owner's own work. The 11 backend checks are shown apart ("11 wait for the backend, not in the figure")
    and their P0/P1 is plain grey text ("P0 backend"), never a red pill. "Apply recommendation" stages the values in the group draft, opens
    the group at the field and opens Review: it never saves silently.
- **Mode** (Setup / Operate): the hash `mode=` wins, then the viewer's last choice (localStorage, try/catch), then
  Operate when nothing waits for the owner, else Setup. The journey filter defaults to «المطلوب منك / To do» and shows
  only the sections that have something for you ("Nothing waits for you in 4 other sections" + "Show all sections");
  when your part is done it collapses into one success card.
- One save mode per form: organisation groups are explicit (draft per group survives navigation and shows as
  "Draft: n changes" in Operate); preferences are instant; gateway keys are one explicit form per gateway; WhatsApp
  switch and receipt secret are instant actions (switch-off asks first), the Cartat account is an explicit form.
- Review sheet reads as sentences (label: old → new with units), marks high impact / security / money / two-person /
  proposed; type-to-confirm (`تأكيد` or `confirm`) only when a `risk: high` field is in the diff, a checkbox for a
  security control otherwise; `second-approver` groups say the owner applies directly and others wait for a second
  approver (role Admin: the button becomes "Send for approval").
- History per group: who / when / note / request id + approver, readable changes, forward-only restore ("restore v12
  creates v15") staged through the same review.
- Search reaches fields (labels, help, keys, values, Arabic folding from the mock) with Section › Group › Subsection,
  section chips with counts, current value, keyboard combobox; picking opens the group, the right step (and the
  Advanced fold) and pulses the field (background + ring, no side stripe). Every field has "copy link"; the URL hash
  carries view, mode, group, focus, sheet, role and scenario.
- No coloured card edges anywhere: route and stepper rails are neutral lines outside cards; progress lives in rings
  and bars; tints only on small pills.
- Motion: one intro (dial ticks draw in, number counts up, section bars fill) once per page load; afterwards only the
  change animates (score after a save). Sheets slide from the inline end. All of it respects reduced motion.
- States: loading skeleton, error (503 + retry), empty = "ready for launch", no search results, role Admin hides the
  owner-only gateway page (deep link shows "owner only") and the Cartat account; role "no access" shows forbidden.
  Prototype controls at the bottom switch role and scenario (also `&scenario=` / `&role=` in the hash).

## Review fixes (review.md, 2026-11-19)
- [x] P1-1 headline = your part (81 %), backend apart and quiet, no red pills on backend rows, filter defaults to To do (5).
- [x] P1-2 mode persisted (hash + localStorage), default Operate once your part is done; hero renamed "Settings health".
- [x] P1-3 marks measured with a canvas probe on the card / track colour (light / dark): to-do tick and bar `--warning-strong`
  6.75 / 9.05 vs card, 6.17 / 7.95 vs track; done 5.19 / 5.92 vs card, 4.74 / 5.21 vs track. The backend bar segment and
  violet dial rings are gone (backend is text + icon). Text: muted 5.47 / 5.99, violet 6.27 / 6.75, warning text 10.33 / 7.29.
- [x] P1-4 to-do is striped in bars and legend, dashed on the dial, has a corner dot on the mini ring; backend shows a
  server icon + count; the step state word is visible at 390.
- [x] P1-5 "Show all steps / Collapse steps" on groups with 15+ fields (remembered), several steps can be open.
- [x] P1-6 the check card no longer repeats inside a step: each field shows "why it matters" and «موصى به» once.
- [x] P1-7 copy-link 44 px and fully visible (inline with the label), Use / Undo / Reset, chip remove, related chips,
  segmented controls (filters, preferences), tooltip pills and search chips all 44 px high; "My preferences" 44 wide.
- [x] P2-1 focus returns to the opener when a sheet closes (falls back to the page heading); a search pick focuses the field (retry).
- [x] P2-2 drafts (+ restore marker) persist in sessionStorage; `sheet=review` opens only when a draft exists.
- [x] P2-3 disabled main actions are readable (muted fill, full opacity) and say why ("Type “confirm” to enable saving",
  "No key has changed").
- [x] P2-4 collapsed step descriptions use two lines. [x] P2-5 no rail gutter below 640 px; copy-link stays on the label line.
- [x] P2-6 / P2-7 Setup at 390 shows only your sections; the "all done" state is one success card. [x] P2-9 counts under the description.
- [ ] P2-8 tick tooltips stay mouse-only (every tick is repeated in the list).

## Verification
- `pnpm lab:check` (F:/Goteav/hub): 40 versions compile. `tsc --noEmit` on this folder: 0 errors.
- Headless Chromium (standalone Playwright script, one browser at a time, not the shared MCP): 35 screenshots in `shots/`; `scrollWidth == innerWidth`
  in every capture after fixing two 390 px overflows (Operate recent changes and the WhatsApp page: grid items needed
  `min-w-0` / `grid-cols-1`); 0 page errors.
- Fixed during review: Arabic pill text clipped by `leading-none`; search highlight split Arabic words (now whole word);
  backoff ladder arrows reversed in Arabic; request id glued to the author name; copy-link rows wasting space; long
  placeholder cut at 390; section names truncated in the mobile bars.
- Screenshots: overview Setup `<390|768|1440>-<rtl|ltr>-<light|dark>.png` (full page); at `1440-rtl-light` and
  `390-rtl-dark`: `operate-`, `group-` (deep link to Security › lockout, field focused), `review-` (after "Apply
  recommendation" on the admin IP allow-list: type-to-confirm + owner note), `history-`, `preferences-`, `search-`,
  `gateways-`, `whatsapp-`, `maintenance-`; states `state-loading|error|empty|admin-hidden-1440-rtl-light.png`,
  `state-noresults-390-rtl-light.png`.
- Not verified: a real screen reader, Safari/iOS, touch devices; keyboard paths were built (combobox, radio groups with
  arrows, sheets with focus trap) but only spot-checked.

## Known gaps
- Tick tooltips on the dial are mouse-only (P2-8, by design: the list repeats them).
- `tsc` on this folder currently reports only environment errors from the dashboard's `class-variance-authority` link
  (the lab itself compiles); re-run once the dashboard's node_modules are restored.

## Open questions
- Are the rule choices right as launch gates (e.g. admin IP allow-list as a to-do rather than a suggestion)? Owner
  may want a third tier "suggestion" that does not lower the score (Supabase advisor style).
- Owner applies second-approver groups directly in this prototype; confirm the real rule for money two-person fields.
- Proposed fields are editable as a preview and say they are not sent; alternatively make them read-only until shipped.
- Gateway "Test connection", WhatsApp status check and test message are stubs.
