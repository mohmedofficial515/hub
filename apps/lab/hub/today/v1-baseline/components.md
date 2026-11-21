# Components the Today page uses (planned, `08-ux-and-design.md` §5)

None exist in code yet. A version may build lab-local equivalents in its `parts/`; when Hub is built,
the chosen version's parts become these components in `apps/web/src/components/`.

| Component | Planned path | Use on Today |
| --- | --- | --- |
| `CardChip` (key + type dot + title) | `components/cards/card-chip.tsx` | every row |
| `TypeDot` / `TypeBadge` | `components/cards/type-badge.tsx` | colour per card type |
| `StatusBadge` | `components/cards/status-badge.tsx` | decision/need/handoff/task status |
| `PriorityBadge` | `components/cards/priority-badge.tsx` | P0–P3 |
| `RoleBadge` | `components/cards/role-badge.tsx` | routed role |
| `TimelineItem` (compact) | `components/timeline/timeline-item.tsx` | since last visit |
| `RelativeTime` | `components/common/relative-time.tsx` | due / ago |
| `CopyButton` | `components/common/copy-button.tsx` | `/hub:start`, `/hub:next` hints |
| `EmptyState` / `Skeleton` | `components/common/*` | empty and loading scenarios |
| Shell (sidebar, topbar, counters) | `components/shell/*` | page chrome |
| new: KPI tile, sparkline / activity strip, flow bars, source health row | `components/today/*` | team + sources (owner addition) |
