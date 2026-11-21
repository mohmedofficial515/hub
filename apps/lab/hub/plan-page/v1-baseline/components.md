# Components used by today's plan page

All paths under `F:/Goteav/hub/apps/web/src/`.

| Component | File | Role on the page |
|---|---|---|
| `PlanningDetail`, `Hero`, `PlanBody`, `IdeaBody`, `Aside`, `ClaudeActions`, `MoreMenu`, `BackLink`, `DetailSkeleton` | `components/planning/detail.tsx` | the page itself |
| `Panel`, `LivePill`, `useChangeGlow`, `StageTrack`, `ProgressMeter`, `StepsTimeline`, `Outline`, `DetailRow` | `components/planning/detail-parts.tsx` | its parts |
| `Revisions` | `components/cards/sheet-sections/plan.tsx` | past texts, folded |
| plan section (edit form, to-tasks, revisions) | `components/cards/sheet-sections/plan.tsx` | `?action=edit` form, shared with the sheet |
| `EditButton` | `components/cards/sheet-sections/edit-bits.tsx` | Edit beside the approach |
| `ActionBar`, `CommentsTab`, `HistoryTab`, `LinksTab`, `Evidence` | `components/cards/card-sheet.tsx` | status actions and the other tabs |
| `CardRuns`, `StepRunMenu` | `components/queue/run-entry.tsx` | queue a step to run |
| `MarkdownView`, `headingsOf` | `components/common/markdown.tsx` | the body; images become alt text at lines 150-156 |
| kit atoms (`TypeBadge`, `StatusBadge`, `PriorityBadge`, `RoleBadge`, `CardChip`, `MineMark`, `ActorChip`, `RelativeTime`, `Button`, `IconButton`, `ConfirmDialog`, `EmptyState`, `ErrorState`, `Skeleton*`, `LoadingRegion`, `PageContainer`) | `components/kit` | vocabulary |
| `isMineHere`, `nextStepOf`, `progressOf`, `roadOf` | `features/planning/model.ts` | derived facts |
| `linkedOfType` | `features/planning/queries.ts` | source idea / became plan |
| `useClaudeOn`, `sendAndShow`, `workOn` | `components/planning/live.ts` | Claude is working on this, run, explain |
| `fillComposer`, `useMaybeWb`, `engineBlocks` | `components/workbench/store.tsx` | Develop with Claude |

Data: `GET /cards/{key}` (card full: body, links, attachments, allowedActions, actions), `GET /cards/{key}/events`, `/comments`; plan
contract `packages/contracts/src/cards/plan.ts`.
