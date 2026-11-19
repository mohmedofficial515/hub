# @hub/web

The contract for anyone adding a page. Next.js 15, Tailwind v4, next-intl, TanStack Query, on the approved design
`apps/lab/hub/today/v5-peacock-app` (docs/15 D31). Look and behaviour stay that design's. Its `kit/README.md` is the
source of this file, and its `README.md` section "Review answered" and `review.md` say why things are the way they are. Read both
before porting a page.

```bash
pnpm --filter @hub/web dev      # http://localhost:7300, proxies /api/v1 to HUB_API_ORIGIN (default http://localhost:7310)
pnpm --filter @hub/web test     # vitest, jsdom
pnpm api:sync                   # after an API change: snapshot + src/lib/api/generated. Commit both
```

```
apps/web/
  messages/{ar,en}/<namespace>.json   one file per page: kit, shell, auth, workspaces, today, tasks...
  src/middleware.ts                   locale prefix, redirect to sign-in
  src/i18n/                           next-intl routing and request config (NAMESPACES list)
  src/app/[locale]/(auth)/...         sign-in, totp, forgot, invite, reset
  src/app/[locale]/workspaces/        project list, New project wizard
  src/app/[locale]/[ws]/<view>/       a page
  src/app/[locale]/[ws]/[view]/       an address that names no view: notFound() inside the shell
  src/components/kit.ts               the kit's one public import
  src/components/{ui,common,cards,shell}/
  src/features/cards/                 store.ts (queries, writes), rules.ts, map.ts, keys.ts, types.ts
  src/features/session/               useSession, useMe, useMembers, useMyCounts, useAwaiting, auth
  src/features/live/                  LiveProvider, what a stream message does to the caches
  src/lib/api/                        client.ts (ky), errors.ts (HubError), generated/ (hey-api)
```

## How the app runs

- **The signed-in app renders in the browser only** (`components/shell/workspace-gate-loader.tsx`, `ssr: false`), as the design did. `window` and `document` are safe in anything under `[ws]` and `/workspaces`. Auth pages are server-rendered, so they must not read data during render.
- **The lab is behind the web origin too.** `/lab` goes to `HUB_LAB_ORIGIN` (default `http://127.0.0.1:7320`), guarded in `middleware.ts`. See docs/16 §6. The lab's page is the `gallery` view, `components/redesign/lab-gallery.tsx`: the shell leaves out its sidebar and header there and keeps the sheet, palette and live stream. Its rules are `features/redesign/gallery.ts`, its words `features/redesign/lab-words.ts`, its colours `.lab-frame` in `globals.css`, and a version's address from anywhere is `hrefFor('gallery', { card: null, query: versionQuery(r) })`, opened with `target="_blank"`.
- **The API is behind the web origin.** `next.config.ts` rewrites `/api/v1` to `HUB_API_ORIGIN`, so cookies are first-party and SSE is same-origin. Rewrites are fixed at `next build`, so an image must have `HUB_API_ORIGIN` set when it builds. `compress: false` is required: gzip through the proxy holds SSE frames back and the stream looks dead.
- **Session.** `lib/api/client.ts` sends `X-Requested-With: hub`. On a 401 it refreshes and retries once, except on wrong credentials. Refresh is one flight across tabs (Web Locks), because the API treats a parallel refresh as token reuse and revokes the family. A failed refresh ends the session and goes to sign-in. `totp_setup_required` goes to `/totp?setup=1` and comes back afterwards. A seeded owner must enrol before any project route answers.

## Add a page

Add the view to `components/shell/views.tsx` first: that puts it in the sidebar, the palette, the breadcrumb and the `g` keys (`nav: false`
keeps it out of the sidebar). Every view has its own folder; an address with none is a "not found" inside the shell (`[ws]/[view]`).

1. Strings: `messages/{ar,en}/<view>.json` already hold the design's `pages/<view>/i18n.ts`. Edit only your own file. Remove what you do not use.
2. `src/app/[locale]/[ws]/<view>/page.tsx` is a server component that renders one client component. Put that in
   `src/components/<view>/<view>-page.tsx`, with its parts beside it. If a second page needs a part, move it to the kit and export it from `components/kit.ts`.
3. Data: `src/features/<view>/` holds your query hooks, using keys from `qk` (below).
4. Render all four states: skeleton shaped like the final rows, `EmptyState`, `ErrorState`, no permission (`forbiddenRole`).

```tsx
'use client';
import { useRef } from 'react';
import { Scale } from 'lucide-react';
import {
  Button,
  CardRow,
  EmptyState,
  ErrorState,
  FilterBar,
  kitMessages,
  openCard,
  PageContainer,
  PageHeader,
  SectionHeader,
  SkeletonRows,
  StatusBadge,
  useCardsQuery,
  useFilter,
  useKeyboardList,
  useT,
} from '@/components/kit';

interface Messages {
  title: string;
  status: string;
  list: string;
  emptyTitle: string;
  emptyBody: string;
  thing: string;
}

export function DecisionsPage() {
  const t = useT<Messages>('decisions');
  const kit = useT(kitMessages);
  const status = useFilter('status');
  const query = useCardsQuery({ type: ['decision'], ...(status ? { status: [status] } : {}) });
  const rows = query.data?.items ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useKeyboardList({ ids: rows.map((c) => c.key), emptyFocusRef: heading });

  return (
    <PageContainer>
      <PageHeader title={t.title} />
      <FilterBar
        mine={{ page: 'decisions' }}
        groups={[
          { param: 'status', label: t.status, options: [{ value: 'open', label: kit.status.open ?? '' }] },
        ]}
      />
      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <SectionHeader ref={heading} id="list-title" title={t.list} count={rows.length} />
        {query.isPending ? (
          <SkeletonRows count={6} />
        ) : query.isError ? (
          <ErrorState thing={t.thing} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Scale} title={t.emptyTitle}>
            {t.emptyBody}
          </EmptyState>
        ) : (
          <ul data-hub-list className="flex flex-col gap-2">
            {rows.map((c) => (
              <li key={c.key}>
                <CardRow
                  {...list.rowProps(c.key)}
                  cardKey={c.key}
                  type={c.type}
                  title={c.title}
                  priority={c.priority}
                  meta={<StatusBadge status={c.status} />}
                  action={
                    c.awaiting === 'decide' && (
                      <Button onClick={() => openCard(c.key, { action: 'decide' })}>
                        {kit.actions.decide}
                      </Button>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
```

Differences from the design's page code when you port:

| The design                             | Here                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `from '../../kit'`                     | `from '@/components/kit'`                                                                     |
| `useT(messages)` with an `i18n.ts`     | `useT<Messages>('<view>')`                                                                    |
| `card.title[locale]`, any `{ ar, en }` | `card.title`. The API has one text                                                            |
| `useSession().loading`, `scenario`     | the query's `isPending`, `isError`. There are no scenarios                                    |
| `useCards()` with everything loaded    | `useCardsQuery(filters)`: the server filters. A row has no detail: see below                  |
| `actOn`, `patchCard`, `addCard`        | `usePerformAction`, `writeCard`, `createCard`                                                 |
| Decisions' coloured band rules         | neutral: `bg-border`, with the icon and words carrying the urgency (D31). Change this at port |
| Sparklines and trend words             | removed unless a real history exists (docs/15 §8). Never fake data                            |
| `?scenario=`, fake clock, `@lab/mocks` | gone. `nowMs()` is the real time                                                              |

## Data

Read through hooks. All keys are in `qk` (`features/cards/keys.ts`), and that is what makes a page live.

| Hook                                                                                          | Returns                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCardsQuery(filters)`                                                                      | the list query. `data.items: CardListItem[]`. `filters`: `type status role assignee q archived flags awaiting sort limit`. `archived: true` is the Deleted view («المحذوفات»), which owner, pm and a card's creator may read |
| `useCards()`                                                                                  | only the rows, for a picker or a count                                                                                                                                                                                       |
| `useCardQuery(key)`, `useCard(key)`                                                           | one `HubCard`, full: `card.decision`, `card.need`, `card.task`, `card.handoff`, `card.redesign`, `card.doc`, `card.release`, `card.change`, `card.idea`, `card.plan`                                                         |
| `useCardEvents(key)`, `useCardComments(key)`                                                  | History and Comments                                                                                                                                                                                                         |
| `useCardSearch(q, { types, limit })`                                                          | server search                                                                                                                                                                                                                |
| `useAwaiting()`                                                                               | my stack, from `GET /cards?awaiting=me`, with `group` and `action`. The API says the verb (`card.awaiting`), so it swaps as the card moves (review B2)                                                                       |
| `useReadyTasks()`                                                                             | `GET /tasks/ready`                                                                                                                                                                                                           |
| `useMyCounts()`                                                                               | the numbers on the sidebar. "Mine" comes from the same list as the rows, so they cannot disagree                                                                                                                             |
| `useSession()`                                                                                | `{ me, roles, isOwner, isManager, workspace, loading, error }`, live for the project in the URL                                                                                                                              |
| `useMembers()`, `useMember(id)`, `useMe()`, `useWorkspace()`, `useWorkspaces()`, `useToday()` |                                                                                                                                                                                                                              |

**A row is not a card.** `CardListItem` is `CardSummary`, with no detail. For a page that needs detail on rows, write a hook on the type's own list
endpoint and map with `toHubCard` from `features/cards/map.ts`. Put it under `qk.cardList(ws, { yourFilter })`, because anything under that prefix is
patched and refetched for you. All API shapes pass through `map.ts`: `*By: { id }` becomes `*ById`, and null becomes absent.

**Endpoints.** `src/lib/api/client.ts` has `get`, `getPage`, `post`, `patch`, `put`, `del`, which unwrap `{ data, meta }` and throw `HubError { code, status, message, details, requestId }`.
Branch on `code` and show `message` (it is localised). `generated/` is the hey-api SDK through the same ky instance, so `import { tasksClaim } from '@/lib/api/generated'` has the same headers,
refresh and errors. It holds every endpoint in the snapshot, so prefer its types as they land.

### Writes

```ts
const perform = usePerformAction();
perform(card.key, 'claim'); // every card action. Toast, closes the sheet, optimistic, rollback
perform(card.key, 'decide', { optionId, rationale }); // ActionPayload: see features/cards/rules.ts
```

The status moves at once from the shared machine, and if the API refuses, everything returns and a toast shows the API's words. Anything else goes through `writeCard`, the one optimistic path:

```ts
await writeCard({ key, fields: { priority: 'P0' } }, () =>
  patch(`workspaces/${ws}/cards/${key}`, { priority: 'P0' }),
);
// { removeFromLists: true } hides a row; { card: (c) => ... } changes only the full card
```

It predicts in every cache, sends, restores on failure, then invalidates what it touched. `addComment`, `addLink`, `removeLink`, `toggleWatch`, `setArchived` (delete and restore, D28), `updateCard` and `createCard` are built on it.

**Rules live in `@hub/contracts`.** `actionsFor(card, roles, me.id)` returns `CardFull.actions` while the status is the one the API answered for, and runs the same function from contracts while a write is predicted. Never write a rule in a page: if a button needs a condition, it belongs in `packages/contracts/src/cards/actions.ts`.

**Undo is only real.** A toast offers Undo where the API has an inverse: `inverseOf` in `rules.ts` (claim and unclaim, ready and backlog, submit and resume), and delete and restore. The design's Undo restored a local store. A decided decision cannot be taken back through the API, so it offers none.

## Live updates

The shell mounts one `LiveProvider` per project (`features/live/`). **You write nothing for this.** Each message patches the row and the open sheet to the new status at once, then asks a batch to read `qk.card`, `qk.events`, `qk.counters`, `qk.today`, `qk.timeline`, `qk.inbox` and the lists that may hold that card's type.
So a page is live if its queries use those keys. A new domain needs one line in `applyCardEvent`, and a list under one name that shows one type needs a line in `LIST_TYPES`.

The batch (`createRefetchBatcher`): one round of refetches at a time, starting at once when things are calm, 200 ms apart, and 2 s apart once 8 rounds fall inside 10 s. What arrives during a round joins the next. Before it, 30 tool calls in a minute cost 600 requests from two tabs, which is the per-user limit, and each refetch cancelled the one before it.

- Connection: fetch-based SSE at `GET /workspaces/{ws}/events/stream`. It resumes with `Last-Event-ID`, refreshes the session on a 401, backs off 1 s to 30 s, and refetches everything on reconnect.
- Messages it reads: the contract's `RealtimeCardEvent` (any event name, as long as `data.cardKey` is there), docs/04 §4's `card.*` shape, `counters`, `inbox.new`, `inbox.read`, `workspace.updated`.
- The indicator (`useLiveStatus`) is `connecting`, `live`, `reconnecting` (down 5 s or more) or `unavailable` (the server answered 403 or 404). It is `live` only with an open stream that has been heard from within 60 s.
- A timeline that should show a "3 new" pill instead of jumping: keep your own count from `useCardEvents`-style data rather than turning this off.

Known limits, stated so nobody hunts for them:

- Decisions, Needs, Handoffs, Redesign and Tasks on the sidebar come from `cards?awaiting=me` and `tasks/ready`, Inbox from `inbox/count`, and the rest from `GET /counters`.
- Each tab holds one stream. Over plain HTTP/1.1 a browser allows 6 connections per origin, so a seventh Hub tab on `http://localhost` would wait. HTTP/2 behind Caddy removes the limit (D33 defers Caddy).

## The chat panel's engine

`features/chat/` (`docs/16` §7) holds everything the panel needs, so the port is only UI. `LiveProvider` already routes `chat.event` and `chat.changed` into these caches, so **`useChat(id)` is live with no code of yours**, and the reread on reconnect is the catch-up.

| Hook                                                                                | Does                                                                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `useChats({ deleted })`, `useChat(id)`                                              | history by project, pinned first; one chat with messages, steps and approvals                       |
| `useCreateChat()`                                                                   | `{ device, folder, mode, model, effort, title }`                                                    |
| `useSendMessage(id)`                                                                | `{ text, context: { page, card, attachments }, mode, model, effort }`                               |
| `useStopTurn(id)`, `useRetryTurn(id)`                                               | stop at any time; send the last message again                                                       |
| `useAnswerApproval(id)`                                                             | `{ approval, decision, note?, doc?: { content?, claims? } }`. The first answer wins. `doc` is Save  |
| `useAnswerQuestion(id)`                                                             | `{ question, answers? }`. By question text. No answers declines                                     |
| `useRecheckEngine(device)`                                                          | Check again: asks the device past its cache, and fills `useEngine`                                  |
| `useWorkReports(key)`                                                               | a card's reports, newest first, for its evidence and primary action                                 |
| `useUpdateChat(id)`                                                                 | rename, pin, or set the next turn's mode, model, effort                                             |
| `useBranchChat(id)`, `useDeleteChat(id)`, `useRestoreChat(id)`, `useExportChat(id)` | as named                                                                                            |
| `useEngine(device)`                                                                 | found, version, tested range, sign-in, `effortSupported`: what the selectors and honest states read |
| `useChatDiff(id, path)`                                                             | one changed file's diff, read only                                                                  |
| `usePromptTemplates()`, `useSavePromptTemplate()`, `useDeletePromptTemplate()`      | per project                                                                                         |
| `useSuggestions({ page, card, roles, memberId })`                                   | words are `suggestions.<id>` in the `chat` namespace, with `{key}`                                  |

Also: `useOpenInVsCode()` takes `{ device, folder, cardKey?, chatId? }` and answers `{ sent: true, prompt }`, where `sent` means handed over, never opened. With no bridge, copy `vscodePrompt(...)` from `@hub/contracts`, the same text. `useTurnStatus(chatId)` is what the engine is doing now, `{ state, attempt?, retryInMs?, at }` or null, filled by the stream only. A report and a saved draft reread their card and document by themselves. `useDocRevisions(key)` and `useRestoreDocRevision(key)` (`{ revision, baseHash? }`) are in `features/docs/queries.ts`. From `@hub/contracts`: `doNext(cards, { role, limit, nowMs })` ranks what to start, with reason codes whose words are the web's, and `HUB_SKILLS` lists the commands for the slash menu.

**Browser specs on a real engine:** `e2e/support/scripted-engine.ts` gives a test an `engine` fixture, with the real bridge and `claude` binary against a scripted model. Its header has an example.

`live.ts` also has `pendingApprovals(chat)`, `pendingQuestions(chat)`, `runningMessage(chat)`, `draftOfApproval(message, approval)` and `checklistOf(message)`, the live checklist of `/hub:work` and `/hub:doc`. Place a step in the reply's text by its `textOffset`. A refused write throws `HubError`: `hub.chats.turn_running`, `hub.chats.approval_answered`, `hub.chats.approval_device_offline`, `hub.docs.draft_flags_open`, `hub.devices.offline`.

**Honest states:** `honestStateOf(chat, lastMessage, engine, now)` is the one rule, and it returns `kind`, whether `recheck` and `openInVsCode` apply, whether the `composer` can send, whether approvals can be answered, `resetsAt`, and D53's `warning`. Words are `honest.*` and `failures.<code>`. No state is a dead end.

**Structured results on a message** (`docs/16` §7.2). Show what was verified apart from what was claimed.

| Field                            | What it holds                                                                                                                                                    | Words                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `reports[]`                      | `checks[]` with `verified`, `basis` and `runs` (every real run, failures included), `changedFiles`, `filesFrom`, `notChecked`, `droppedChecks`, `counts`, `move` | `report.*`                                                         |
| `structuredPlan`, `plan`         | The structured plan when `propose_plan` was used. `plan` is the text, always                                                                                     | `plan.*`                                                           |
| `questions[]`                    | `AskUserQuestion`, as choice cards                                                                                                                               | `question.*`                                                       |
| `docDrafts[]`                    | `baseText`, `draft`, server `duplicates` with `url`, `claims` with `answer`, `status`, `refusedCode`                                                             | `draft.*`                                                          |
| `notices[]`                      | `turn.starting`, `engine.warning`, `tool.blocked`, `report.refused`, in order                                                                                    | `starting.*`, `honest.newerVersion`, `blocked.*`, `report.refused` |
| `approvals[].effect`, `.draftId` | The deterministic line, and the draft a `save_doc` would save. Words are `categories.<category>`                                                                 | `categories.*`                                                     |

From `@hub/contracts`: `lineDiff(base, draft)` for the draft's diff, `applyClaimAnswers(text, claims)` for the preview of what Save writes, `openFlags(claims)` for what still blocks it, `planToPrompt(plan)` for Run this plan. Run this plan fills the composer in Execute and sends nothing.

**A suggestion's data says what pressing it does (D51).** `onPress: 'fill'` puts the words in the composer. `onPress: 'run'` sends them, in `mode`. When a `run` is in `execute`, show `suggestions.<id>.runs` first, so it never runs in Execute unannounced.

## The chat panel

`components/workbench/` is the approved `v6-edge-strip-port` on the engine above. The shell mounts `WorkbenchProvider` and `WorkbenchLayout` on every view but `gallery`.

- **State.** `store.tsx`: `useWb()` is the chat, device, folder, engine state and pending count, from the hooks, plus what the panel keeps itself. The acts (`send`, `stopTurn`, `answerApproval`, `saveDraft`, ...) are plain functions, so a menu or a key can call them. `useMaybeWb()` is for what also shows on the lab's page.
- **The thread** is `itemsOf(chat)` in `features/chat/thread-items.ts`, pure and tested. A new event on a message means a line there and a case in `thread.tsx`. `chatStatusOf` and `engineStateOf` say what a chat is doing and which notice shows.
- **Words** are in `chat.json`: `panel` and `tips`. A test holds the languages together.
- **The rich tooltip** is in the kit: `<Tip k="send" off="empty" vars={{ device }} facts={[[label, value]]} keys={['Enter']}>`. `k` is a key of `tips.items`, `off` of `tips.off` or `{ why, fix }`. Render inside `TipProvider`.
- **A page beside the panel.** Layout that reads the viewport is `lg:@page-lg:grid-cols-12`, and in code `usePageWide(1024)`: both are the plain viewport rule with the panel closed, and fold beside it. A dialog is portalled out of the page, so it keeps plain `md:`. `usePageRoom().boardTight` says a Board has no room.
- **The sheet.** `CardSheet` is a plain `<section>`, not a dialog. Find it in a test with `[data-card-sheet]`. With the panel open it stays open after an action.
- **`Button variant="primary"`** on a page steps down to outline while a card is open (`QuietPrimary`). Nothing to do.

Layers: strip and panel are in the layout, a phone's panel is 45, its sheet 50. Touch targets follow `pointer: coarse` (`workbench.css`).

## The agent queue

`/[ws]/queue` (`docs/16` §9, D56). Hooks in `features/queue/queries.ts`: `useQueue({ card? })` (runs and the member's limits, live through `queue.changed` and `chat.changed`), `useAddRun`, `useRunAction` (`pause`, `resume`, `cancel`), `useReorderRuns` (optimistic), `usePauseQueue`, `useQueueSettings`. Words are `queue.json`.

Parts in `components/queue/`: `RunRow` and `RunIcon` (one neutral card, state in a coloured icon and words), `useRunLine` (what a run waits on, why it is held, when it runs, how it ended), `useRunNow`, `ScheduleDialog` (quick choices in the queue's timezone, "Choose a time", weekly), `RunButtons` (Run now and Schedule on a task), `StepRunMenu` (a plan step) and `CardRuns` (a card's runs on its sheet). A run starts only from the owner's press (D51). Settings › Queue is `settings/parts/queue.tsx`. `revealChat(id)` in the workbench store opens any chat in the panel.

- **Mode, folders and roles (D58 to D60).** `ScheduleDialog` sets How it runs (`approval` or `automatic`), the main folder, extra folders from the project's other linked folders, and roles (`ROLES`, labels from `ROLE_LABELS`). `useRunNow(target, options)` and `runAgainTarget(run)` carry them. `useSetRunMode` and `useRunPending` are the two new hooks; a run not started switches mode from its menu.
- **Where a run goes** is `useRunPlace()`, which reads `wb.place`: the device and folder the panel resolves with its own fallbacks, never the raw choices in storage (queue review B1).
- **`RunDecisions`** shows what an automatic run decided and its pending items; Run it now opens a chat on that folder where D41 still asks. In a chat, `skipped` and `auto_answered` read as closed cards, and `hasNoTimeLimit(expiresAt)` (contracts) says "no time limit" for a queued run's approval.
- **Cancel** of a running run or a weekly one asks first through `RunCancelHost`, mounted once in the shell beside the toasts. `showToast({ action })` adds one follow-up button, such as Open chat after Run now.

## Do next, suggestions with AI and New project

`docs/16` §11, D64 to D67.

- **Do next** is `DoNext` in `components/workbench/panels.tsx`, on the panel's Runs and on Today (`PageDoNext`, mounted only where the workbench is). It reads `useDoNext({ role, limit })` (`features/next/queries.ts`, `GET today/next`), which sits under `qk.today`, so the stream keeps it live. Each item says why (`panel.next.why.*`), a task or a plan step (`item.step`) offers `RunButtons`, and Ask Claude for more is `suggestWithClaude(context)` in the store: `/hub:suggest` in a new chat, in Ask, with the panel brought forward.
- **Proposals** of `/hub:suggest` are the thread item `suggestions` (`features/chat/thread-items.ts`) drawn by `ProposalsCard` (`components/workbench/proposals.tsx`). `useAnswerSuggestion(chatId)` accepts or dismisses one; the server makes it and answers `ref`. `live.ts` takes `suggestions.proposed` as the message's whole list.
- **New project** in the panel's menu is `PanelNewProject` (`components/workbench/new-project.tsx`) around the Projects page's `NewProjectWizard`, whose third step links a folder on a connected device after `POST /workspaces`, on the same press (D44).

## Skills

`/[ws]/skills` (`components/skills/`), in the Knowledge group. Hooks in `features/skills/queries.ts`: `useSkills`, `useSkill(source, name)`, `useCreateSkill`, `useUpdateSkill(name)`, `useMoveSkill`, `useSkillRevisions`, `useSkillRevision`, `useRestoreSkill`, `useSyncSkills`. A write rereads the list then and again after a few seconds, since a device's sync ends with no stream event. Parts: `SkillEditor` (new and edit, with `detectSecret`), `SkillView` (read, the folder's other files by name, earlier texts with Bring this back), `MoveDialog` (asks first; a name Hub has, or one outside Hub's naming, gets a field with a free one from `hubNameFor`). `?skill=<name>` opens a Hub skill, as an accepted proposal links. Writes show to `skill.manage` alone; Hub's protocols (`core`) have no Edit. Words are `skills.json`.

## Settings › Backups

`settings/parts/backups.tsx` (`docs/16` D61 to D63), shown to the owner alone (`settings-page.tsx` filters the tab by `isOwner`). Hooks in `features/backups/queries.ts`: `useBackups(enabled)` (the history, settings, free space and next time; every 2 s while a backup runs, else every minute, since the end comes with no stream event), `useBackUpNow`, `usePinBackup`, `useDeleteBackup`, `useSaveBackupSettings`, and `usePublishing` for Settings › Devices. The history is one neutral card with a word and an icon per state (Running, Done, Failed, Deleted, Folder missing, Kept); Delete asks with `ConfirmDialog`; the settings save together from the queue tab's bar. The restore is a command in a `CommandBlock`, never a button. Settings › Devices › Reaching Hub from other devices is `settings/parts/publishing.tsx`. Words are `settings.json` under `backups` and `devices.publishing`.

After the Slice 6 review (`docs/status/2026-11-08-slice6-review.md`): a failure reads `backupFailureKind(failure)` from `@hub/contracts` and shows `backups.failure.<kind>`, a sentence with the next step, with the API's own text under Details; Keep is "Pin" («ثبّتها», «مثبّتة») so it never reads like the keep rule, and back up is never «انسخ». The nightly time is a 24-hour text field. Publishing's steps come from `publishingProgress(facts, totpEnabled)` (`features/backups/publishing-steps.ts`), split into the main machine and each other device and marked done or next; `useRecheckPublishing()` is Check again, which sends `Cache-Control: no-cache` so the API reads Tailscale past its 30 s cache. The settings tab strip waits for the session before deciding what the member may see, and marks its hidden edges with `useScrollCue` (`lib/scroll-cue.ts`, `.scroll-cue` in `globals.css`).

## i18n

Every visible string is in both languages. `useT(kitMessages)` is card vocabulary (`types status actions done roles sheet`): never repeat it. `useT<Messages>('<view>')` is your page. Both return the namespace as an object. Use `fmt` and `fill` for `{name}`
templates and `plural(n, locale, forms)` for counts, not next-intl's `t()`, because the catalogs use the design's `#` and `{x}` forms. A new namespace needs a line in `NAMESPACES` (`src/i18n/request.ts`) and the two files.

- The UI word is Project («مشروع»); routes and code keep `workspace` (D30). Delete is «حذف», and the view is «المحذوفات» (D28).
- Handoff is «إحالة», and a need's delivery is «تسليم», never the same word. Toasts and History use verbal nouns, so nothing picks a gender.
- `locale` comes from `useLocale()`. The language switch is `setLocaleEverywhere`, the theme `setTheme` / `useTheme` (`lib/theme.ts`), never query parameters.

## Router

`/[locale]/[ws]/<view>`, with the sheet as `?card=GTV-123&action=decide&tab=comments` over any page.

| API                                                                                              | Use                                                     |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `useRoute()`                                                                                     | `{ locale, ws, view, cardKey, query: URLSearchParams }` |
| `navigate(view, { query?, replace? })`, `goTo(path)`                                             | another view; any path of the app                       |
| `<AppLink view="tasks" query={{ status: 'ready' }}>`, `<AppLink card="GTV-231" action="decide">` | a real `<a href>`. Use it for any place                 |
| `setQuery({ status: 'ready', other: null })`                                                     | filters on this view, shallow                           |
| `openCard(key, { action?, tab?, opener? })`, `closeCard()`                                       | the sheet. Shallow too                                  |

## Rules

All of `kit/README.md` § Rules stands. ESLint's `hub/no-raw-palette` (`tools/eslint/`) enforces the mechanical part in `className`, `cn()` and class variables: no palette classes, no literal sizes, no hex, no physical direction, no gradients, no coloured or thicker side edge.

- **Tokens.** `bg-card`, `text-muted-foreground`, `border-border`, `bg-(--heat-2)`. Hex lives only in `app/globals.css`.
- **A card is one neutral surface with one uniform neutral border.** The type shows through its coloured icon and word. No coloured edge in any form: border, pseudo-element, inset shadow, positioned bar (D31). Urgent is a uniform `border-destructive/70` plus the danger pill. Never tint a row. Soft tints are for small badges.
- **Cyan** (`bg-primary`, `text-primary`) is the one primary action, links and focus. Selected and "now" use `foreground`. **Filled means the next thing this page wants from me.** Creating is never it unless the page is empty. A self-verify is never filled.
- **Colour text** uses `*-fg` or `*-soft-foreground`. No `opacity-*` on text, no `text-destructive`. Overdue, escalated, failed and breaking are the danger tone. Warning is only "due within 24 h", stale and no-summary. Status is never colour alone.
- **Type.** `text-caption body-sm body body-lg title-sm title headline display`, one step larger in Arabic automatically. Meta lines are `text-body-sm`. The page title is `PageHeader`. Numerals `text-title font-bold`, not `text-display`.
- **RTL.** Logical properties. Keys, commands, numbers with units: `<Ltr mono>`. API strings: `<Bidi>{title}</Bidi>`. Sentences: `fill` and `fmt`, never concatenation. Dates: `RelativeTime`, `when`, `rel`, `absolute`. Latin digits: `num`. Directional icons `rtl:-scale-x-100`. Time axes run with reading.
- **Keys.** Read through `matchKey(e, key)`, never `e.key`, so a shortcut survives an Arabic layout. `useKeyboardList` for rows. Taken: `j k o u c a d w r / ? [ ]`, `g <x>`, `n <x>`, Ctrl/Cmd+K, Ctrl/Cmd+Z, Esc. New single keys respect `shortcutsEnabled()`, and skip inputs and dialogs.
- **Focus.** `focusRing` on anything custom. A chip group is one Tab stop (`useRoving`). After an action focus goes to the next row (`useKeyboardList` does it). Radix overlays portal into `portalRoot()`. A dialog with no Trigger passes `onCloseAutoFocus={useFocusReturn(open)}`. Layers: header 30, sheet 40 to 50, toast 60, dialogs 70, menus 75, tooltips 80.
- **Mine** is off by default, marked with `MineMark` and sorted first. `FilterBar mine={{ page }}`.
- **No fake data, ever.** No source means an honest `EmptyState`. Never echo or store a secret: every free-text form uses `detectSecret`, and the API's filter is the authority.
- 44 px targets on phones (`Button` and `IconButton` do it; `hit-44` for inline links). `motion-safe:` on CSS animation. No shadow deeper than `shadow-md`.

## Components

Props and notes are in `apps/lab/hub/today/v5-peacock-app/kit/README.md` § Components, and stand unchanged, all from `@/components/kit`: `TypeIcon TypeDot TypeBadge StatusBadge Pill MineMark PriorityBadge RoleBadge CardKey CardChip Avatar ActorChip RelativeTime CopyButton Kbd Tooltip`,
`Button IconButton Field TextInput Textarea Select detectSecret SecretFilterError Modal ConfirmDialog Segmented ChipGroup PickField RowAction RowMenu RoleChecks CommandBlock ShownOnce CardPicker DocPicker`,
`PageContainer PageHeader SectionHeader EmptyState ErrorState Skeleton SkeletonRow SkeletonRows LoadingRegion FilterBar`, `Lightbox MarkdownView`, `CardRow useKeyboardList showToast`.

Changed from the design:

- `ActorChip` and `Avatar` read `useMember`. `Member.name` is one string, and `lastActiveAt` may be absent.
- `showToast({ tone: 'error' })` for a refusal. Without `onUndo` a toast has no Undo.
- Sheet sections: `components/cards/sheet-sections/<type>.tsx`, registered in `index.ts`. A section's file-local strings are in `kit.json` under `sections.<file>`. Editing is `?action=edit`, with shared parts in `edit-bits.tsx`: task, decision, idea and plan have it. `idea.tsx` holds the "Turn into a plan" form, and `plan.tsx` holds steps and revisions.
- `RedesignSection` opens the curtain compare from `components/redesign/compare.tsx`. Screenshots are the card's attachments, served by the API from the lab folder (`features/redesign/lab.ts` reads their names).
- `to_plan`, `to_tasks` and the other Idea and Plan verbs come from the contract, so the sheet offers them already. `to_tasks` is the one action that keeps its sheet open.
- The Deleted view is `tasks?view=deleted` (`components/tasks/deleted-view.tsx`). `DeletedLink` is the way in from a filter panel.
- A list with detail: `fetchDetailRows` (`features/cards/rows.ts`). A row still has no `body`: read the card (`useCardQuery`) when you need the text.
- `DocSection` shows the API's headings and links out only when `detail.webUrl` exists.
- New: `LiveIndicator`, `AuthFrame` (`components/auth`), `NewProjectWizard`, `ProjectsPage` (`components/workspaces`).

## Tests

`pnpm test:e2e:web` (root) is Playwright, `e2e/`: the queue gate (`specs/agent-queue.spec.ts`, which restarts the throwaway API with `support/api-restart.ts`), the chat panel on the scripted engine (`support/scripted-engine.ts`, `specs/chat-panel.spec.ts`), flows F1 to F5 of docs/11 and the live-update test of docs/15 §7 in `ar` and `en`, on throwaway containers with a built API and web on 7319 and 7359. It never touches the local database, and approves only in a temp lab. `E2E_SKIP_BUILD=1` reuses the builds. Timings land in `test-results/live-timings.jsonl`. `E2E_MATRIX=1 pnpm test:e2e:web --grep matrix` runs the page matrix below, measured, and `E2E_MATRIX_PAGES` narrows it. The first run needs `pnpm --filter @hub/web exec playwright install chromium`.

`src/test/render.tsx`: `renderWithApp(ui, { locale })` uses the real catalogs and a fresh query client. `stubFetch((url) => ({ body: { data } }))` answers from a table, and an unmatched call is the API's 404. Logic first: `*.spec.ts` beside the file. A page: one render test per state. Before handing back:

- `pnpm check` for your paths.
- 390, 768, 1440 × ar, en × light, dark: no horizontal overflow, 0 AA failures, measured.
- Loading, empty, error, no permission.
- Tab reaches everything in visual order, focus visible, `j` `k` `Enter` work, the sheet returns focus.
- Next to the lab's shot of the same page.
