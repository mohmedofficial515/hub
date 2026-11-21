# Port plan: v5-live-plan, batch 1 of 4 (foundation)

Branch `feat/plan-page-v5` (from `feat/first-release`). Batches 2 (live run with Claude over SSE, Claude card, approval box,
activity feed, celebration), 3 (step evidence images and video, compare slider) and 4 (Hams explainer video) are out of this
batch: their UI is left out, not stubbed.

## Impact map

| Shared piece touched | Used by | Classification |
|---|---|---|
| `packages/contracts/src/cards/plan.ts` (`planPhaseSchema`, `phases` on create/update, `phaseId` and server-set `doneAt` on steps) | API plan actions, MCP `create_plan` / `update_plan` (flattened from the schemas), web types | Additive. A plan with no phases reads exactly as before |
| `packages/contracts/src/cards/read-models.ts` `planDetailSchema` | OpenAPI snapshot, generated web client | Additive fields |
| `packages/contracts/src/errors.ts` (2 new codes) | API catalogue, arch test | Additive |
| `apps/api` `PlanDetail` (+ `phases` JSONB column), `plan-steps.ts`, `plan-actions.ts`, MCP `render.ts`, tool descriptions | Plans REST + MCP only | Unaffected elsewhere |
| `apps/web/src/features/cards/types.ts`, `map.ts` (default `phases: []`) | Every plan reader (lists, focal card, sheet, studio) | Additive optional fields; no visual change |
| `apps/web/src/features/planning/model.ts` `mergeSteps` (keeps `phaseId`) | Plan sheet form (optimistic save), studio save | No visual change; fixes phase loss on a form save |
| `apps/web/src/components/cards/sheet-sections/plan.tsx` (form keeps `phaseId`) | The plan sheet's edit form (Planning page and sheet) | No visual change |
| `apps/web/src/components/planning/detail-parts.tsx` `StepsTimeline` (plan numbers, optional title button that opens the drawer) | Only `planning/detail.tsx` | Plan detail page only |
| `apps/web/src/components/planning/detail.tsx` | Planning `?plan=KEY` for plans and ideas | Plan page redesigned; the idea page keeps its `Hero`, body and aside unchanged |
| `apps/web/src/app/globals.css` (+ one `@import` of `components/planning/journey.css`) | All pages | Classes are prefixed `pj-` and only used by the plan page |
| `apps/web/messages/{ar,en}/planning.json` (`detail.journey.*`) | Planning | Additive keys |

`detail-parts.tsx` exports used elsewhere (`LivePill`, `ProgressMeter`, `StagePill` in `planning/parts.tsx`) are not changed.
No page outside Planning's plan detail needs a visual check or its own redesign entry.

## New files

- `apps/api/prisma/migrations/0015_plan_phases/migration.sql`
- `apps/web/src/features/planning/journey.ts` (+ spec): `phaseGroups`, `numberedSteps`, `effortOf`, `blockersOf`,
  `finishEstimate`, `phaseState`, `toneOf`, `SIZE_WEIGHT`.
- `apps/web/src/components/planning/journey.css`, `journey-map.tsx`, `plan-charts.tsx` (ring, roles), `phase-focus.tsx`,
  `phase-list.tsx`, `step-drawer.tsx`, `plan-hero.tsx`.

## Data used

`plan.phases[] { id, title, note? }`, `step.phaseId?`, `step.size/after/why/acceptance` (exist since d72e97f), `step.doneAt?`
(new, server-set when a step becomes done) with the task's `closedAt` as fallback for the estimate.

## Rules

- A step's `phaseId` must name a phase of the plan (`hub.plans.unknown_phase`).
- Removing a phase that steps still name is refused (`hub.plans.phase_in_use`): move or clear those steps in the same save.
- Phase ids are unique, at most 20 phases. A plan saved before phases has `phases: []` and shows one unnamed list.

## Risks

- A form or studio save that rebuilds steps without `phaseId` would drop the step out of its phase. The sheet form and
  `mergeSteps` now carry `phaseId`; the studio writes new steps (no phase), which is valid and shows them in the unnamed group.
- Contract changes need an API restart in dev (NOTES.md, "Dev mode").

# Batch 1 follow-ups and batch 2 (live), 2026-11-20 — not committed, for owner review

## Impact map

| Piece touched | Used by | Classification |
|---|---|---|
| `apps/web/src/components/cards/sheet-sections/plan.tsx` (+ new `plan-phases.tsx`) | The plan's edit form (plan page and sheet) | Gains a Phases fieldset and a Phase select per step; the rest of the form is unchanged |
| `apps/web/src/features/planning/queries.ts` `savePlan` | Plan form, studio save | Optimistic copy carries `phases` |
| `apps/web/src/features/queue/queries.ts` `useQueue` | Queue page, card runs, plan page | Additive `enabled` option |
| `packages/contracts/src/agent-queue.ts` `runPrompt` (plan_step) | Queue dispatcher | The prompt asks for `report_stage`; tasks unchanged |
| `apps/web/src/components/planning/{plan-page,phase-focus,journey-map}.tsx`, `journey.css` | Plan page only | Live layer; `active` and `run` props default to none |
| `apps/web/messages/{ar,en}/planning.json` | Planning | Additive keys (`plan.*` phases, `detail.liveRun.*`, `detail.journey.claudeHere`) |

## New files

`features/planning/phase-edit.ts` (+ spec), `features/planning/live-run.ts` (+ spec), `components/cards/sheet-sections/plan-phases.tsx`,
`components/planning/plan-live.tsx` (+ spec), `e2e/specs/plan-live.spec.ts`.

## Data used (all existing)

Queue runs (`source`, `cardKey`, `planStep`, `state`, `waitingOn`, `chatId`, `messageId`, `startedAt`, `endedAt`), the run's chat turn
(`stages`, `approvals`, `questions`, `deviceOnline`), `POST chats/{id}/approvals/{id}`, `step.doneAt`, the stream's status. No new event:
`run_stage` / `run_waiting` from the README are covered by the chat's stage reports and the run's `waitingOn`.

Owner's answers (2026-11-20): equal-weight Approve/Deny, a celebration at every phase, new steps join the last phase, and the chapter follows
Claude whenever the running step or its phase changes. Project-wide visibility of other members' runs is a later batch.

# Batch 3 (evidence on steps), 2026-11-20 — not committed, for owner review

New: migration `0016_card_attachment_files`, `plans/domain/evidence-media.ts`, `plans/application/plan-evidence.service.ts`,
`plans/presentation/http/plan-evidence.controller.ts`, actions `plan.add_evidence` / `plan.remove_evidence`, MCP `add_step_evidence` /
`remove_step_evidence`, web `compare.tsx`, `step-evidence.tsx`, `features/planning/evidence.ts`. Shared pieces touched: contracts `plan.ts`
(step `evidence`, Hub-owned), `errors.ts`, `permissions.ts` (+ docs/04 rows), MCP `tools.ts`, the bridge's D41 lists, `plan-steps.ts`
(evidence kept and canonical), the step drawer and the chapter rows. Departure from the README: one route that stores and links in one call
(`POST /plans/{key}/steps/{stepId}/evidence`) instead of a generic `POST /cards/{key}/attachments` followed by a plan save.

Owner's answers on batch 3 (2026-11-20): whoever added a file may remove it (`plan.remove_own_evidence`); pictures are drawn again with
`sharp` 0.35.5 (metadata gone, 2560×16000 cap, 480 px WebP thumbnails); a custom picker with drag and drop. Later batches: evidence files read
from paired machines through the bridge, and project-wide run visibility. The one-off API e2e failure is noted only.

# Batch 4 (the plan on video with Hams), 2026-11-20 — not committed, for owner review

New: migration `0017_plan_explainer`, `plans/application/{attachment-store,plan-explainer.service}.ts`, `plan-explainer.controller.ts`,
actions `plan.request_explainer` / `plan.attach_explainer`, MCP `request_plan_explainer` / `attach_plan_explainer`, the queue source
`explainer` and its prompt, the `film` stage protocol (chat words in ar/en), web `plan-video.tsx`, `explainer-request.tsx`,
`features/planning/explainer.ts`. Hams (`F:/tools/hams`) is read only: Hub asks a Claude run to use its `engine/plan-film`.
