---
version: v2-route-line
title: Route line
status: review
base: v1-baseline
created: 2026-11-18
tokens: inherit
touches-components: [apps/web/src/components/planning/detail.tsx (header with progress words and route, phases section, side column), apps/web/src/components/planning/detail-parts.tsx (StepsTimeline becomes PhaseGroup, new RouteLine, Meter reuses ProgressMeter, Panel), apps/web/src/components/common/markdown.tsx (image renderer for attachment:ID, lines 150-156), apps/web/src/components/cards/sheet-sections/plan.tsx (step editor gains a phase, plan form gains phases, decisions, sources), apps/web/src/components/cards/card-sheet.tsx (LinksTab unchanged; ideas also shown on the page), features/planning/model.ts (phaseGroups, ideaBuckets, splitBody), packages/contracts/src/cards/plan.ts]
ported:
---

# Route line

**The bet:** a plan is a journey, and Goteav sells journeys. The overview is one route across the header, a station per phase, each as
long as its step count, filling as steps finish, with the next step's phase ringed and named "You are here". It is the one bold thing on
the page, and it is also the phase index: every station jumps to its phase.

Open: `http://127.0.0.1:7320/lab/frame-hub.html#/plan-page/v2-route-line?lang=ar&theme=dark`. Scenarios (`&scenario=`):
`default` (GTV-472 as it is today, 0 of 50), `midway` (**demo state**, see below), `empty` (a plan with no phases, images, ideas or
sources), `loading`, `error`.

## Idea

The page answers the four questions in order, top to bottom:

1. **Where does it stand and what next?** The header: type, key, status, priority, title, who wrote it, then "0 of 50 steps · 9 phases ·
   15 ideas", the route, then the next step in words ("Next · Step 1 · in Phase 0: Setup and decisions", the step's title and role),
   then the buttons. The first status action is the only filled button.
2. **What is the shape of the work?** Phases, each a collapsible card: phase number tile, title and its note, progress in words with a
   neutral meter, the role mix (icon + count, names for screen readers), and "You are here" or "Done" in words. The phase holding the
   next step opens by default; "Open all phases" opens the rest. Steps keep their plan number (1-50) inside a phase.
3. **Why is it this way?** The plan text with its screenshots as figures: a run of images sits side by side with captions; a click opens
   the kit `Lightbox` on every screenshot of the plan, in text order.
4. **What hangs off it?** The side column: the owner's decisions, linked ideas in Now / Next / Later, related plans, sources and
   attachments (the showcase link first, owner only).

## Key decisions

- **No colour on any surface.** Every card and panel is `bg-card` with one `border-border`. Colour is on icons only: the plan tile and
  word, the decision scale, the idea bulb, the doc library icon, the task square. "You are here", "Next" and the ringed station use
  `foreground` (the v5 rule for "now" markers), never cyan.
- **One filled button.** The first status action (Send for review on a draft). **Finish plan is filled only when every step is done**;
  in the midway demo the page has no filled button, because the next thing it wants is the next step's work, not Finish.
- **Station length = step count,** said in words for screen readers ("Each phase is as long as its step count"). It is honest, not a
  measure of effort.
- **The route is one Tab stop** (kit `useRoving`); arrows move along it with reading direction. Each station's name is complete in its
  accessible name. Titles show from 1024 px; below that only numbers, with one line under the route naming the current phase.
- **Folding** animates `grid-template-rows` in CSS and stops under reduced motion; a folded phase is `inert`. A station click opens its
  phase, scrolls to it (instantly under reduced motion) and moves focus to its heading button.
- **A plan without phases** shows one plain list with a sentence saying how to add phases. No route, no disclosure, no repeated heading.
- **Images only from attachments.** `![alt](attachment:ID "caption")` on its own line becomes a figure; an outside URL stays alt text,
  as 09 §11 asks. A missing attachment shows a dashed "Missing screenshot" box, not a broken image.
- **API strings are isolated** (`dir="auto"` / `<bdi>`): GTV-472's text is Arabic, so in English the titles stay right-to-left and
  correctly ordered ("D2–D8 (hero، …)").
- **Tabs stay** (Plan, Comments, History, Links). This version only changes Plan; the others say so.
- Lab-only: buttons show a toast that they do nothing here; idea and plan rows link to the real Hub page.

## Data: what exists and what is new

Exists today (no API change): title, status, priority, creator, dates, revision, steps `{ title, role, taskKey, done }`, body, `links`
with each card's summary (priority included), `attachments { id, kind, name, url, width, height }` in the read model, comment count.

| Need | Today | Proposal |
|---|---|---|
| **Phases on steps** | none; phases are a list in the body | `plan.phases: { id, title, note? }[]` (max ~20) and `planStep.phaseId?`. Old plans have none and read as one list. `update_plan` / `create_plan` / the MCP tools and the step editor take them. `to_tasks` could put the phase in the task body |
| **Images** | `card_attachments` exists but only the lab scanner writes it; no upload | `POST /cards/{key}/attachments` (image-only, re-encoded JPEG/PNG/WebP per the image-only uploads rule, size cap), `DELETE` for the writer, and a served URL; Markdown `attachment:ID` resolved by `MarkdownView` (`markdown.tsx:150-156`). An MCP way to attach a local file for Claude |
| **Idea links** | **exists**: `relates` links. `createLinksSchema` caps a create at 10 links, so 15 ideas need `link_cards` after create | no new field. **Now / Next / Later is derived from the idea's priority** (P0, P1 now; P2 next; P3 later). It matches GTV-472's showcase exactly, so no field is needed unless the owner wants buckets independent of priority |
| **Sources** | none; a path in the body, the showcase link in a comment, a Hub source by slug in text | `plan.sources: { kind: folder \| file \| hub_source \| link, title, ref, note?, private? }[]` |
| **Decisions** | a Markdown table in the body | `plan.decisions: { topic, choice, decidedAt, decidedBy }[]`, or link real decision cards (`relates` to type `decision`) and show those. The mock moved GTV-472's table out of the body into this field |

## Mock notes (nothing invented, two marked changes)

- Everything is GTV-472 as `get_card` and `list_ideas` returned it on 2026-11-18 (`shared/mocks/hub-plan-page.ts`).
- **Changed for the design:** the six screenshots were placed in the body where the text names them (they are files from the research
  folder, copied to `media/`), under one added heading «مراجع الاتجاه B»; the decisions table moved to `decisions`.
- **`midway` is a demo state, not data:** steps 1-9 done, placeholder task keys GTV-500..511, status in progress.

## Verification

- Playwright at 390 / 768 / 1440, ar and en, light and dark; scenarios default, midway, empty, loading, error. No horizontal overflow
  in any. Lightbox opens, arrows and Escape work, focus returns to the figure by keyboard.
- `pnpm typecheck` and `tsc --noEmit` (versions) clean. No `ml- mr- pl- pr- left- right- text-left text-right`, no hex in TSX.
- Not done: an independent `ux-critic` review (no sub-agents in this session). Contrast was not measured, but every colour is a kit
  token already checked in v5.

Shots in `shots/`: `1440-ar-light.png` and `1440-ar-dark.png` (full page), `390-ar-light.png` (full page), `390-ar-light-top.png`,
`390-ar-dark.png`, `390-ar-dark-figures.png`, `768-ar-dark.png` (midway), `768-en-light.png`, `1440-en-light.png`,
`1440-ar-dark-midway.png`, `1440-ar-dark-lightbox.png`, `1440-en-light-plain-plan.png`.

## Open questions

1. **Now / Next / Later from priority:** keep it derived (no field), or give ideas a separate bucket on the plan?
2. **Decisions:** a list stored on the plan, or real decision cards linked to it? Cards give history and Hub's decision rules; a list is
   lighter and matches how this plan was written.
3. **Where should the side column go on phones?** Today it follows the text, so decisions are far down. Option: decisions right after
   the header on phones only.
4. **Fifteen ideas make the side column longer than the steps.** Fold Next and Later by default?
5. **Route stations on phones are narrower than 44 px** (9 stations in 340 px). The phase cards below are full-size targets; is that
   enough, or should the phone route be display-only?
6. **When a plan is running, should "Run the next step" (Claude) be the filled button** instead of none?
