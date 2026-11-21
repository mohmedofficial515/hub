# Baseline inventory: Today, Inbox, Timeline (as built in `apps/web`)

Status of this baseline: the inventory below is read from the source (2026-11-16). The real-page screenshots
(Today / Inbox / Timeline, AR-RTL, dark + light, 1440 + 390) were NOT taken: signing in with the owner
credentials from `F:/Goteav/hub/.env` returned `401 invalid_credentials` from `POST /api/v1/auth/sign-in`
(the web at http://127.0.0.1:7300 and the API both answer, so the file is stale or the password was changed).
`shots/` is therefore empty. Nothing here was observed at runtime; every statement is from reading the code
and `docs/09-pages.md` sections 4, 5, 15. To finish: give a working owner login (or sign in once in the
Playwright browser) and run the screenshot pass: pages `today`, `inbox`, `timeline`; widths 1440 and 390;
dark and light; names `<page>-<width>-rtl-<theme>.png`.

All paths are under `F:/Goteav/hub/apps/web/src/`. Pages import shared parts through the kit barrel
`components/kit.ts`.

## Routes (all three are views of one client router, `components/shell/view-ids.ts`)

| Route | Entry | Page component |
| --- | --- | --- |
| `/[locale]/[ws]/today` | `app/[locale]/[ws]/today/page.tsx` | `components/today/today-page.tsx` |
| `/[locale]/[ws]/inbox` | `app/[locale]/[ws]/inbox/page.tsx` | `components/inbox/inbox-page.tsx` |
| `/[locale]/[ws]/timeline` | `app/[locale]/[ws]/timeline/page.tsx` | `components/timeline/timeline-page.tsx` |

## Page-owned components

| Page | Component | File | Role |
| --- | --- | --- | --- |
| Today | `AwaitingStack` | `components/today/awaiting.tsx` | "Needs me": urgent, next 24 h, rest; verb comes from the API per row |
| Today | `DeadlineRunway` | `components/today/runway.tsx` | 72 h time strip, marks for deadlines (those in the stack are not repeated) |
| Today | `ReadyTasks` | `components/today/ready.tsx` | tasks I can claim (`GET /tasks/ready`) |
| Today | `MorningLetter` | `components/today/letter.tsx` | the agent's brief/narrative, clamped on phone |
| Today | `SessionsWithoutSummary` | `components/today/sessions.tsx` | my sessions needing a summary + copyable command |
| Today | `SinceLastVisit` | `components/today/since.tsx` | events after `lastSeenAt`, grouped by repo; reuses timeline `EventDetail` |
| Today | `CountersBand` | `components/today/counters.tsx` | tiles that link to views (inbox, decisions, needs, handoffs, redesigns) |
| Today | `TeamWeek` | `components/today/team.tsx` | weekly totals, per-member activity, card flow |
| Today | `CaptureSources` | `components/today/sources.tsx` | source health, problems first |
| Today | `LoadingView` | `components/today/loading.tsx` | skeleton |
| Today | `PageDoNext` | `components/workbench/panels.tsx` | "Do next" queue list (only where the workbench is mounted) |
| Inbox | `InboxPage` | `components/inbox/inbox-page.tsx` | Unread / All / archive, kind-family filter, awaiting-only, mark all read |
| Inbox | `InboxRow` | `components/inbox/row.tsx` | its own row: kind icon, body line, chip, quick action, archive (swipe on touch) |
| Timeline | `TimelinePage` | `components/timeline/timeline-page.tsx` | spine, day groups, tide line (last visit), day rail at >= 1280, new-events pill |
| Timeline | `TimelineItem`, `Spine` | `components/timeline/item.tsx` | event row (actor, verb, facts, "+n" expander, inline actions on wide) |
| Timeline | `EventDetail` | `components/timeline/event-detail.tsx` | excerpt per event kind |
| Timeline | `TimelineFilters` | `components/timeline/filters.tsx` | roles, types, repo, module, member, date, mine |

## Shared atoms and shell (via `components/kit.ts`)

| Component | File | Used by |
| --- | --- | --- |
| `StatusBadge`, `PriorityBadge`, `RoleBadge`, `TypeBadge/TypeDot/TypeIcon`, `Pill`, `MineMark` | `components/cards/badges.tsx` | all three |
| `CardRow` | `components/cards/card-row.tsx` | Today stacks, Inbox lists |
| `RowAction` | `components/cards/row-action.tsx` | inline action button |
| `CardKey`, `CardChip` | `components/cards/card-key.tsx` | all three |
| `ActorChip`, `Avatar` | `components/cards/avatar.tsx` | Timeline, Today |
| type/status/tone vocabulary (`typeClass`, `statusTone`, `focusRing`, ...) | `components/cards/meta.ts` | all three |
| `PageContainer`, `PageHeader`, `SectionHeader` | `components/common/layout.tsx` | all three |
| `FilterBar`, `ChipGroup`, `useFilter(List)` | `components/common/filter-bar.tsx` | Timeline, Inbox |
| `EmptyState`, `ErrorState`, `Skeleton*`, `LoadingRegion` | `components/common/states.tsx` | all three |
| `RelativeTime`, `CopyButton`, `Bidi/Ltr/fmt` | `components/common/{relative-time,copy-button,text}.tsx` | all three |
| `Button`, `IconButton`, `Kbd`, `Segmented`, `Tooltip`, `Tip` | `components/ui/{button,segmented,tooltip,rich-tip}.tsx` | all three |
| `showToast` (Undo) | `components/common/toast.tsx` | Inbox, actions |
| `AppLink`, `openCard`, `setQuery`, `useRoute` (router, `?card=` sheet) | `components/shell/router.tsx` | all three |
| shell: sidebar with counters badges, header with live indicator, chat panel, card sheet | `components/shell/{sidebar,header,shell}.tsx`, `components/cards/sheet-sections/*` | all three |
| `useKeyboardList`, `useRoving`, `usePageWide` (container-query widths, because the chat panel and sheet narrow the page) | `lib/keyboard-list.ts`, `lib/roving.ts`, `lib/hooks.ts` | all three |

## Data and live layer

| Piece | File | Notes |
| --- | --- | --- |
| `useTimeline`, `useLastVisit`, `useSeenWhileHere` | `features/timeline/use-timeline.ts` | `GET /timeline`, 50 per page, "Load older" button, no list virtualisation |
| `reconcile`, `freshIds`, `buildDays`, `buildRail` | `features/timeline/stream.ts` | at top: prepend + fade; scrolled: rows hold still, pill counts |
| `useRunAction` | `features/timeline/run-action.ts` | inline action runner, shared with Inbox |
| `useTodayQuery`, `useSeenOnLeave`, `markSeen` | `features/today/{use-today,seen}.ts` | `GET /today`, `POST /today/seen` (one global per-user watermark) |
| `useInboxList`, `useInboxActions`, `useMarkAllRead`, `groupItems`, `KINDS_OF` | `features/inbox/{use-inbox,group}.ts` | per-item `readAt`/`archivedAt`; 14 kinds in 6 families; merge by `groupKey` within 30 min |
| `usePerformAction`, `actionsFor`, `awaitedAction` | `features/cards/{actions.tsx,rules.ts}` | optimistic status, undo where an inverse exists |
| `useCounters`, `useMyCounts`, `useAwaiting`, `useInboxCount` | `features/session/session.ts` | sidebar badges and Today tiles read these |
| SSE: `LiveProvider`, `applyCardEvent`, `createRefetchBatcher` | `features/live/{live-provider.tsx,apply-event.ts}` | `card.event` patches card lists, then batched invalidation of card/today/timeline/inbox/counters (200 ms calm gap, 2 s when busy) |
| Contracts | `packages/contracts/src/{notifications.ts,today.ts,cards/read-models.ts}` | `InboxItem`, `TimelineRow`, `Today`, `Counters` |

## Findings that drive the redesign (from source)

1. "Awaiting me" is computed three ways: `Today.awaitingMe` / `useAwaiting` (card list `awaiting=me`),
   Inbox "awaiting only" (client filter on inbox items against the same stack keys), Timeline `card.awaiting`
   (a marker on the newest row; `GET /timeline` has NO `awaiting` param, only `mine`, so docs/09 §5's
   `awaiting=me` filter is not implemented in the API).
2. Two "new" semantics: Inbox unread = per-notification `readAt`; Today/Timeline/sidebar "since last visit"
   = one global `lastSeenAt` watermark moved by `POST /today/seen` (Timeline moves it on arrival, Today on leaving).
3. Rows: Timeline hides status facts and inline actions on phones (`wide` only) and moves them to the sheet;
   Inbox shows a quick action on phones; Today uses `CardRow`. Three row shapes, three action sets.
4. Timeline rows already carry the full card (`TimelineRow.card` with `awaiting`, status, flags), and Inbox items
   carry `card` plus `data.action`, so a status chip and an inline action need no per-row request.
5. Non-card items already exist in Inbox (`brief`, `system`, `deadline_reminder`, `escalation`; link in
   `data.link = {view, query}`); Timeline has none.
6. Live: SSE `card.event` patches card lists optimistically, but the Timeline's embedded `card` only refreshes
   with the batched refetch of `qk.timeline` (not verified at runtime whether that lands inside one second).
7. No virtualisation library and no `content-visibility` in `apps/web`; lists grow by "Load older" pages of 50.
8. Cards have a single `title` string (no short or Arabic title field).
