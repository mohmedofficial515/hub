# Plan page: concepts (2026-11-18)

Data and states the page must support (from `detail.tsx`, `plan.ts`, `read-models.ts`): title, key, status on the road
(`draft → in_review → approved → in_progress → done`, `abandoned`), priority, tags, creator and dates, steps `{ title, role?, taskKey?, done }`,
the next step (first not done), Markdown body, links (`relates` ideas and plans, `blocks`…), attachments, comments, history, revisions,
the status actions (one filled), the Claude actions (Develop, Run the next step, Explain), Edit, archive. States: loading, not found,
error, empty plan (no steps), archived, live change.

New for this brief: **phases**, **images in the text**, **linked ideas with Now / Next / Later**, **sources**, **decisions**.

All three keep the v5 rules: neutral surfaces with a uniform border, one filled button, colour only on icons and small badges.

---

## A. Route line (`route-line`) — built as v2

**Thesis.** A plan is a journey, and Goteav sells journeys: the overview is one route line across the page, each phase a station whose
length follows its step count, filled in `foreground` as steps finish, with the next step as a ringed "you are here". Below it the page
is a reading column (phases with their steps, then the plan text with its figures) beside a quiet side column of what the plan rests on:
decisions, linked ideas, sources. The route line is the one bold thing; everything else stays calm.

```
Desktop 1440 (RTL)
┌ header ────────────────────────────────────────────────────────────────┐
│ ◇ Plan GTV-472 · Draft · P1                                    [⋯]     │
│ Title                                                                  │
│ 0 of 50 steps · 9 phases · 15 ideas      Next: step 1 «…» · Owner      │
│ [Send for review]  [Create tasks]   ✦ [Develop] [Explain]              │
└────────────────────────────────────────────────────────────────────────┘
 ●━━━━━━○──────────○──────○──────○────────○──────────○─────○────○──○
 0 4    1 10        2 4    3 5    4 6      5 9        6 5   7 4  8 3     ← stations, length ∝ steps
┌ main (phases, text) ───────────────────────┐ ┌ side ────────────────┐
│ ▾ Phase 0 · Setup & decisions   0/4  ♛3 ▣1 │ │ Decisions (6)         │
│    1 Legal texts ……………… Owner   [Next]    │ │ Ideas: Now 7 Next 6…  │
│    2 …                                     │ │ Sources (5)           │
│ ▸ Phase 1 · Urgent fixes        0/10  ▣10  │ │ Related plans (2)     │
│ ▸ Phase 2 …                                │ └───────────────────────┘
│ The plan text, with figures  [img][img]    │
└────────────────────────────────────────────┘

Phone 390
 header (actions full width)
 route line: 9 segments in one bar, "Phase 0 of 8 · Setup" under it
 phases (collapsed, current one open) → text with figures (one per row)
 decisions → ideas → sources
```

- **Improves:** answers "how far is each phase" at a glance (hierarchy), jumps to any phase in one tap (task speed), 50 steps fold to 9
  rows (density), evidence and ideas are on the page instead of a tab (discoverability).
- **Risks:** a route with stations can read decorative if it does not navigate; it must be the phase index. Station length by step count
  is honest but not effort.
- **Touches when ported:** `planning/detail.tsx`, `detail-parts.tsx` (`StepsTimeline` → phase groups, new `RouteLine`, `PhaseGroup`,
  `Figure`), `common/markdown.tsx` (image renderer), `cards/sheet-sections/plan.tsx` (phase field in the step editor), contracts
  `cards/plan.ts`.

## B. Field guide (`field-guide`)

**Thesis.** Read the plan like a well-set document: one long column, phases as chapters with a sticky contents rail on the inline start
that doubles as progress (each chapter title with its own small count). Figures sit in the text at full column width; ideas and sources
are margin notes beside the paragraph that mentions them, and collect at the end as an index.

```
Desktop                                          Phone
┌ rail ───────┐┌ document ──────────────────┐   header
│ Decisions   ││ Title, status, next step    │   [Contents ▾] sticky
│ 0 Setup 0/4 ││ ## Decisions (box)          │   document, one column
│ 1 Fixes 0/10││ ## Phase 0 ……  margin: idea │   margin notes inline
│ 2 …         ││   steps as a checklist      │   under their paragraph
│ Ideas  15   ││ figure ───────────────────  │
│ Sources  5  ││ ## Phase 1 ……               │
└─────────────┘└─────────────────────────────┘
```

- **Improves:** best for reading and reviewing a draft; text, steps and evidence stay together per phase.
- **Risks:** weak for running a plan (no single overview of progress); margin notes need wide screens; mixing body text and steps per
  phase needs the body split by phase, which is a bigger contract change than a phase field on steps.
- **Touches:** `detail.tsx` layout, `markdown.tsx` (images, notes), `Outline` becomes the rail.

## C. Phase board (`phase-board`), the bold one

**Thesis.** Phases are columns on a horizontal board that scrolls with reading direction; each step is a small card with its role and
task, and the board's header row is the overview. A signature "zoom": pinch or press `-` to collapse each column to a single tile that
shows only its count and roles, so 9 phases fit one screen; `+` opens them again. The text and evidence move to a second tab.

```
Desktop
 header
 [Board] [Text 6 figures] [Ideas 15] [Sources 5]
┌ 0 Setup 0/4 ┐┌ 1 Fixes 0/10 ┐┌ 2 Tokens 0/4 ┐┌ 3 Lab 0/5 ┐ → scroll
│ [step card] ││ [step card]  ││ …            ││ …         │
│ [step card] ││ …            ││              ││           │
└─────────────┘└──────────────┘└──────────────┘└───────────┘
Phone: one column at a time, swipe, dots show the phase
```

- **Improves:** strongest when the plan is running (who carries which phase, what is stuck).
- **Risks:** a board duplicates Tasks; horizontal scroll hides most phases at 1440 and all but one on a phone; the text, the reason for
  the plan, is pushed to a tab; the zoom gesture needs teaching.
- **Touches:** new board component, `detail.tsx` tabs, `markdown.tsx` images.

## Pick

**A, route line,** built as `v2-route-line` without waiting for a pick (owner's instruction). It answers the four questions in order on
one screen, scales down to a plan with no phases (one unnamed group, no route line), and needs the smallest contract change: a phase on
each step plus a phases list. B is the better reading view and could become A's "Text" mode later; C belongs to Tasks.
