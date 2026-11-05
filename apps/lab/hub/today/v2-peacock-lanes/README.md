---
version: v2-peacock-lanes
title: Night Peacock · two lanes
status: review # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-11-04
tokens: override # inherit | override (see tokens.css)
touches-components: [app/globals.css (Night Peacock tokens), components/cards/card-chip.tsx, components/cards/type-badge.tsx (TypeDot, TypeBadge, new TypeLabel), components/cards/status-badge.tsx, components/cards/priority-badge.tsx, components/cards/role-badge.tsx, components/timeline/timeline-item.tsx (compact), components/common/relative-time.tsx, components/common/copy-button.tsx, components/common/empty-state.tsx, components/common/skeleton.tsx, components/common/toast.tsx, new components/today/counters-band.tsx, new components/today/awaiting-stack.tsx, new components/today/deadline-runway.tsx, new components/today/ready-tasks.tsx, new components/today/morning-letter.tsx, new components/today/since-last-visit.tsx (tide line + contract diff), new components/today/sessions-without-summary.tsx, new components/today/team-week.tsx (totals, activity heatmap, card flow), new components/today/source-health.tsx]
ported:
---

# Night Peacock · two lanes

## Idea
Today is split into two lanes that never mix: **act** and **read**. The start lane (right in Arabic) is
"Needs me": the Awaiting-me stack, the 72-hour deadline runway and the tasks ready for my roles. The end
lane is "What happened": one quiet reading column with the agent's morning letter, my sessions without a
summary and "Since your last visit" closed by a tide line. Above both sits a band of counters that read in
one glance; below both, a full-width "Team this week" band with capture-source health. The colour comes
from the Indian peafowl, dark-first: green-black plumage for the chrome, jewel hues only where they carry
meaning. The one place the hues are allowed to fill an area is the Awaiting-me stack, so the focal point of
the page is the thing you must do next. The lead card has the page's only filled button (eye cyan).

## Key decisions

### Layout
- **Desktop (≥ 1024):** a 12-column grid, start lane 7 / end lane 5. The end lane is one bordered reading
  surface (`bg-card`). The start lane sits on the page background, so the vivid cards stand out and the
  reading column stays calm.
- **Counters band:** one bordered strip with hairline dividers. It is not eight floating cards. Each tile
  has a `text-display` tabular number, a type dot (or an icon for Inbox and Awaiting me), a 7-point
  sparkline and a trend word (rising, falling, steady, quiet). The decisions tile adds "1 overdue" in words
  with a danger dot. It is 8 columns at xl, 4 × 2 at md, and a snap-scrolling row on phones. The
  Redesigns tile shows only for `owner` (docs/08 §2), so Sara sees 7 tiles.
- **Awaiting-me stack (focal point):**
  - Groups appear in a fixed order: overdue or escalated, due < 24 h, decisions, needs, handoffs,
    redesigns, reviews. An empty group hides.
  - Each card has:
    - a soft type tint and a 3 px `border-inline-start` stripe in the type dot colour;
    - a type icon and label, the key, priority and the routed role;
    - the title, then status pills (always icon + words) and the meta line;
    - one inline action.
  - Overdue or escalated cards swap the stripe to danger and say so in two pills ("15 h overdue",
    "Escalated to you").
  - "Blocks N cards" is a chip.
  - The first card is the lead: larger title and the filled primary button. Every other card uses an
    outline button.
- **72-hour runway:**
  - An overdue zone (destructive soft), then the "now" line (primary), then a faint warning band for the
    first 24 h, day boundaries named by weekday, and type-coloured pins.
  - Escalated pins have a danger outline.
  - Labels drop to a second row when they would collide.
  - The title shows on hover or keyboard focus.
  - Under 768 px the strip becomes a sorted list with "in 3 h" words; overdue rows sit on destructive soft.
- **Ready for my roles:**
  - Each row shows priority, key, title, specialty, effort chip and "Blocked by GTV-231" when blocked.
    The Claim button of a blocked row is disabled, and `aria-describedby` points to the reason.
  - Claim removes the row (layout animation) and shows a toast with a copyable `/hub:next GTV-258`.
  - The claimed task then appears as my "Working on" chip in the team heatmap.
- **Morning letter:**
  - A dateline at the inline end, then the page's only gradient (2 px: neck blue → eye cyan → tail teal).
  - The body is set in Noto Naskh Arabic / Newsreader at 16 / 1.8, with inline CardChips after each phrase
    the agent linked (`narrative.refs`).
  - It is signed "Written by your agent at 08:41".
  - It collapses to 3 lines. A copyable `/hub:start` sits beside the toggle.
- **Since your last visit:**
  - The breaking contract handoff is pinned on top as an endpoint diff. Before and after are labelled in
    words, and the old value is struck through, so the change is not shown by red and green alone.
  - Events follow, grouped by repo. Each group has one tick per commit, the commit count and the event
    count.
  - Each event row has the actor avatar, with an agent badge for sessions.
  - At the bottom, a tide line in primary says "You were here yesterday 11:30". Everything above it is new.
- **Team this week:**
  - Six totals with a delta vs last week, given as an arrow and words. The deltas use no colour, so no
    number is judged good or bad.
  - An activity heatmap: members × 14 days (7 on phones), one eye-cyan ramp in 5 steps, a numeric legend
    (0, 1–2, 3–5, 6–8, 9+), exact values in `title`, `aria-label` and a live readout line. It is a
    roving-focus `role="grid"` driven by the arrow keys.
  - Members are sorted by name and never ranked. Each row has the avatar colour, an online dot, role
    icons and a "Working on" chip.
  - Card flow per type: created is a solid bar in the type dot colour, closed is an outlined soft bar.
    Numbers sit beside each bar, with a net word ("3 more open").
- **Capture sources:**
  - Problems are listed first.
  - Living dots: a healthy dot breathes once every 4 s (static under reduced motion); a lagging one is
    amber with a clock and "14 min behind"; a failing one is danger with a triangle, "Last success
    yesterday 21:00" and the error text.
  - Text always follows the dot.
- **Tablet (768):** the lanes stack (Needs me first, then the reading column), and the team band follows.
- **Phone (390):** one column in the 09 §4 order: letter, awaiting, deadlines (list), ready, no-summary
  sessions, since last visit (first 5 + "see all"), then team and sources condensed. On phones the totals
  are 3 across, the heatmap shows 7 days, focus chips show the key only, and sources show status and error
  only.
- **DOM order = visual order at every width:**
  - The letter is rendered twice, as the phone instance and the md+ instance, with `display: none` on the
    one not in use. Their collapse state is shared.
  - Sessions-without-summary sits above Since-your-last-visit in the end lane, so the phone order needs no
    CSS `order` reshuffle and focus order never jumps.

### Colour: Night Peacock (research §3 B), dark-first, scoped to `.peacock` in `tokens.css`

| role | creature name | dot / stripe | badge text light / dark | soft light / dark |
|---|---|---|---|---|
| task | neck blue | `#2463D4` | `#2463D4` / `#4A8BFF` | `#E8F1FF` / `#192740` |
| decision | eye-ring bronze | `#A98844` | `#876720` / `#AB8A46` | `#FFEECF` / `#332506` |
| need | dusk magenta (extended, not in the bird) | `#C0609A` | `#A94B85` / `#CD6CA6` | `#FFE9F4` / `#391D2D` |
| change | green-grey down | `#636B60` | `#636B60` / `#899186` | `#EAF3E7` / `#232A21` |
| handoff | eye cyan (as a dot) | `#009ABC` | `#007893` / `#069CBE` | `#DBF6FF` / `#002D39` |
| redesign | twilight violet (extended) | `#9171CF` | `#7B5AB6` / `#9C7CDB` | `#F2EDFF` / `#2B223D` |
| doc | tail teal | `#16A081` | `#007D64` / `#1AA282` | `#D3FBED` / `#042F25` |
| release | tail lime-olive | `#829539` | `#647510` / `#83973B` | `#ECF5D4` / `#252B0C` |
| success | tail green | `#308639` | `#277E32` / `#4EA254` | `#DEF9DE` / `#172E18` |
| warning | copper barb | `#B86A35` | `#A45821` / `#C97945` | `#FFECE1` / `#3B200F` |
| danger | rust | `#B94839` | `#B94839` / `#DF6A59` | `#FFEBE7` / `#3D1E19` |
| primary | eye cyan | light `#006F83` + white (5.8:1) | dark `#02D0FD` + `#001218` (10.4:1) | — |

- **Neutrals:**
  - light: bg `#F4F8F3`, surface `#FDFFFD`, border `#D9E1D8`, text `#141A15`, muted `#5A635B`;
  - dark: bg `#0B100C`, surface `#131914`, border `#29302A`, text `#E4EAE2`, muted `#9EA89F`.
- **New tokens, derived by moving OKLCH lightness only:**
  - 12 avatar hues: L 0.50 with white initials (≥ 5.7:1) in light, L 0.74 with dark initials (≥ 7.9:1)
    in dark;
  - the 5-step heat ramp;
  - `--prio-p3`: `#687168` light (4.7:1), `#848D85` dark (5.6:1).
- **Contrast check:**
  - Every text pair was computed, then re-audited in the browser over every rendered text node in ar/en ×
    light/dark. 0 failures remain.
  - Priority badges sit on the surface colour, not on tints. The status pills use their own soft tint, so a
    rust word never lands on a bronze tint.
- **Hex lives only in `tokens.css`.** TSX uses token classes only (`bg-type-decision-soft`,
  `text-type-need-fg`, `bg-(--heat-3)`…). There are no raw palette classes and no physical direction
  classes (both grep-checked).

### Typography
- **UI:** IBM Plex Sans Arabic (ar) / Inter (en), named sizes only (`text-caption` … `text-display`).
- **Keys, branches and commands:** JetBrains Mono through `.key` or `<code dir="ltr">`.
- **The letter has its own voice:** Noto Naskh Arabic 16 / 1.8 for ar, Newsreader (optical sizes) for en,
  both loaded by `@import` in `tokens.css`. It is the only prose on the page, and a written face marks it as
  machine-written (P4).
- **New shared helper `shared/ui/hub-cn.ts`:** `tailwind-merge` did not know Hub's size names. It treated
  `text-caption` as a colour and dropped it whenever a `text-<colour>` followed, so every small label
  rendered at 16 px. Any Hub version should import `cn` from `@lab/ui/hub-cn`.

### Motion
- **One orchestrated moment:** on load, the stack cards fade up with a 45 ms stagger. Nothing else moves
  on its own except the healthy source dots.
- **Motion that answers an action:**
  - resolving a card (it fades out and the cards below slide up with `layout`, and Undo restores it);
  - claiming a task (same);
  - toast enter and exit;
  - the letter chevron.
- **Reduced motion:**
  - `MotionConfig reducedMotion="user"` drops transforms.
  - The breathing dot and the skeleton pulse are `motion-safe:` only. This was verified: the computed
    `animation-name` is `none` under `prefers-reduced-motion: reduce`.

### RTL
- **Time axis:** time runs in the reading direction on every axis (start = earlier, end = later), so all
  three axes are mirrored in Arabic: the sparklines (`rtl:-scale-x-100`), the heatmap and the runway.
  - The research suggested "now always at the inline end". That works for past-facing axes (sparklines,
    heatmap) and I kept it there.
  - The runway faces the future. "Now at the inline end" would make it run against the reading direction,
    while the heatmap on the same page runs with it.
  - So one rule (time flows with reading) beats one anchor (now at the end). On the runway, the overdue
    zone sits at the inline start, then "now", then +72 h at the inline end.
- **Isolates:**
  - Stripes, the tide line and toasts use logical properties (`border-s`, `start-`, `end-`, `ms-auto`).
  - Keys, numbers, times and percentages are LTR isolates (`<bdi dir="ltr">`).
  - Mixed strings like "أمس 11:30" are not isolated, because isolating them would reverse the word order.
- **Arabic plurals:** all six categories through `Intl.PluralRules`. "3 ساعات" and "15 ساعة" come from
  `Intl.NumberFormat` units, not from the mock's `relative()`, which always says "ساعة".

### Interaction and accessibility
- Every action button is ≥ 44 px on phones and 36 px on desktop.
- Card titles are stretched links, so the whole card or row opens the card, and the button sits above the
  link.
- The focus ring is 2 px `ring` with a 2 px offset.
- Shortcuts from 09 §4:
  - `j` / `k` move between rows (stack cards, ready rows, sessions);
  - `c` claims the focused ready task;
  - `r` refreshes (a short skeleton is shown).
- **Toast:** one at a time, at the inline end. It lasts 6 s, or 9 s when it carries a command, and pauses
  on hover or focus. It is a `role="status"` live region.
- **Counters stay in sync with the stack:**
  - A card resolved on the page also leaves the Awaiting / Decisions / Needs / Handoffs / Redesigns
    counters and the runway, so no two numbers disagree.
  - The Awaiting-me tile counts the stack itself.

### States (lab toolbar "scenario")
- **`default`:** the owner persona.
- **`frontend`:** Sara. There is no letter, so the agent-letter hint shows instead. Her stack has a
  breaking handoff and a claimable port, the runway shows its empty state, and she has 4 ready tasks and 7
  counter tiles.
- **`empty`:** every section has a friendly empty state with a next step. The counters say "quiet all
  week", all sources are healthy, and the tide line still marks the last visit.
- **`loading`:** skeletons with the final block sizes and the header summary as a skeleton. "Still
  loading…" appears after 3 s.

## Deviations from the plan docs (owner decisions needed)
1. **Needs owner OK. P2 says type colours "never on whole rows or backgrounds".**
   - Awaiting-me cards are type-tinted (soft tint + stripe).
   - The tint is confined to that one block, which is the point of the page (triage). The timeline,
     ready rows and since-last-visit rows stay neutral.
   - The fallback, if rejected: keep the stripe and the type label, and drop the tint to `bg-card`.
2. **Needs owner OK. P2 says "No gradients".** There is one 2 px gradient line under the morning letter's
   header, in three type hues. This is the only gradient on the page.
3. **The ocellus brand mark** uses four type hues as concentric rings, once, in the header. It is
   decorative and `aria-hidden`.
4. **09 §4 says the narrative block is "shown only when narrative exists".**
   - When there is no letter, this version shows a compact dashed hint instead: "Your agent has not
     written today's letter yet. Run `/hub:start`…".
   - This teaches where the letter comes from. The acceptance test would need to target the letter
     `article`, not the hint.
5. **Escalated GTV-219 is promoted into Awaiting me.**
   - The mock's `awaitingMe` omits GTV-219, although it is open, routed to `pm` (which the owner holds)
     and escalated. Per 09 §4 it is awaiting the owner, so the view promotes escalated or overdue
     deadlines routed to my roles.
   - The Awaiting-me tile therefore shows 7, while `counters.awaitingMe` is 6.
6. **End-lane order is letter → sessions → since.** The brief listed since before sessions. The swap
   keeps DOM order equal to the 09 §4 phone order (see Layout).
7. **Counter sparklines** use a lab-derived 7-day series. The API has no counter history yet.

## Data and shared changes
- **`shared/mocks/hub-today.ts`:** additive changes only, in both locales, with no shape changed:
  - `NarrativeRef` type and `narrative.refs` (the cards the letter mentions);
  - `TimelineRow.diff?` and the two endpoint diffs on the breaking handoff event `e1`.
- **`shared/ui/hub-cn.ts`:** new, the Hub-aware `cn` described under Typography.

## Verification
- `pnpm typecheck` is clean.
- Playwright checks at 1440 / 768 / 390 × RTL / LTR × light / dark, in the default scenario plus
  frontend, empty and loading:
  - no horizontal overflow at any width;
  - 0 text-contrast failures;
  - the heatmap grid keys move the right way in RTL (ArrowRight = earlier);
  - j / k / c / r work;
  - resolve, Undo and Claim update the stack, the counters, the runway and the team focus chip;
  - reduced motion stops the breathing dot.
- **Shots:** `shots/<width>-<rtl|ltr>-<light|dark>.png` (12, full page, fresh browser context each; phone
  uses a mobile context).

## Open questions
- **Tints:** approve the tinted awaiting stack (deviation 1) and the gradient line (deviation 2)?
- **Dark tint strength:** keep the research tints (L≈0.27, C≤0.05) or lower them to C 0.035? On large
  cards they read rich, not neon, but the owner should see them on his screen.
- **Light tint strength:** the pastels are vivid on the stack. Is that calm enough for all-day use?
- **Time direction in Arabic:** time runs with reading (mirrored) on every axis. Please test it with 2
  Arabic-first members, as the research also asks.
- **The mock's "now" is a Wednesday:** `NOW` is 2026-11-04, which is a Wednesday, but the spec and the
  mock call it Tuesday. Mock strings like "Thu 18:00" for GTV-236 are really a Friday. The page formats
  every date from the ISO values with Intl, so it shows Wednesday and Friday. Fix the mock (for example,
  move `NOW` to 2025-11-04, which is a Tuesday) or keep it?
- **Own events:** "Since your last visit" should exclude my own events (09 §4), but the mock includes the
  owner's own e6 and e10. The page renders the API list as it is. Should the API filter them?
- **Missing endpoints:** a counter-history endpoint (for the sparklines) and the proposed
  `GET /stats/team` are not in doc 04 yet.
- **Activity cell:** confirm what one activity cell counts. The mock's daily number is labelled "sessions,
  commits and closed cards". Should these be weighted?
- **Deadline window:** doc 07 says the brief's deadlines cover 48 h, while doc 09 and this page use 72 h.
  Which one wins?

## What this version does not do
- **No error state:** there is no `ErrorState` path. The lab toolbar has no `error` scenario, and its
  scenario list lives in lab code outside this folder.
- **No CardSheet:** in Hub, Decide / Deliver / Verify / Approve open the CardSheet on that action. Here the
  card resolves at once, with Undo, to show how the stack moves.
