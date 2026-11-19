---
app: hub
page: plan-page
route: /[locale]/[workspace]/planning?plan=KEY
live-url: http://127.0.0.1:7300/ar/goteav/planning?plan=GTV-472
sources:
  - apps/web/src/components/planning/detail.tsx
  - apps/web/src/components/planning/detail-parts.tsx
  - apps/web/src/components/cards/sheet-sections/plan.tsx
  - apps/web/src/components/common/markdown.tsx
  - apps/web/src/components/planning/NOTES.md
  - packages/contracts/src/cards/plan.ts
status: designing
---

# Plan page

A plan's own page on Planning (`?plan=KEY`). Design language: `hub/today/v5-peacock-app` (kit and `kit/README.md` contract), Night
Peacock tokens, Cairo for Arabic, RTL first, light and dark. The mock is the real card **GTV-472** (website uplift, 50 steps, 9 phases,
15 linked ideas), read from Hub on 2026-11-18, with its text from `F:/Goteav/research/web-uplift-2026-11/00-plan.md`.

## Purpose
The owner (and any role with a step in it) opens a plan to answer four things, in this order:
1. Where does it stand, and what is the next step? (status, progress, the next step in words, the one action that moves it)
2. What is the shape of the work? (phases, how far each has come, who carries each)
3. Why is it this way? (the text, with the evidence: screenshots, decisions, sources)
4. What hangs off it? (the ideas it groups, related plans, sources)

## Problems with the current page
- **Steps are one flat numbered list.** A 50-step plan is a wall; the phases written in the body (`## المراحل`) are not connected to
  the steps, so "how far is phase 3?" cannot be answered without counting.
- **Images never show.** `common/markdown.tsx:150-156` swaps every image for its alt text (09 §11: GitHub raw images need the internet).
  A plan built on research screenshots loses its evidence.
- **No place for linked ideas.** GTV-472 relates to 15 ideas plus two plans; they sit in the Links tab as a flat list with no priority.
- **No place for sources.** The research folder, the Hub source `web-uplift-research` and the showcase artifact live in the body and a
  comment, not anywhere the page can show them.
- **Decisions are a Markdown table in the body,** indistinguishable from the rest of the text.

## Goals
- Phases as a first-class structure: grouped steps, per-phase progress and role mix, collapsible, plus a compact overview of all phases.
- Screenshots inside the plan text, with captions, opening larger on click (the kit `Lightbox`).
- Linked ideas as compact rows with Now / Next / Later.
- Sources and attachments in one place, the showcase link as a source row.
- A decisions box for the owner's decisions recorded with the plan.
- Distinctive and polished, and it must work for any later plan, including one with no phases, no images and no links.

## Constraints
- RTL + LTR, light + dark, 390 / 768 / 1440.
- No coloured side or top stripe on any card or panel (D31). Neutral surface, uniform border, coloured icon plus a word.
- At most one filled button per view.
- Nothing invented: only data a plan could really have. Fields that need new API or contract work are marked in each version's README.
- Data today (`packages/contracts/src/cards/plan.ts`, `cards/read-models.ts`): plan `title`, `body` (Markdown), `priority`, `tags`,
  `status` (`draft → in_review → approved → in_progress → done`, `abandoned`), `steps[] { id, title, role?, taskKey?, done }`, card `links[]`
  (`relates`, `blocks`, …, each with the card summary incl. priority), `attachments[] { id, kind, name, url, width, height }` (read only,
  written by the lab scanner today), comments, events, revisions.

## Versions
| Version | Idea | Status |
|---|---|---|
| v1-baseline | current page, described from code (Hub needs a sign-in, no shots) | reference |
| v2-route-line | phases as stations on one route line, a reading column with figures, a side column of decisions, ideas and sources | review |

Concepts: `concepts.md`.
