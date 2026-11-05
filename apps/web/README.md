# @hub/web

The contract for anyone adding a page. Next.js 15, Tailwind v4, next-intl, TanStack Query, on the approved design
`F:/Goteav/redesign/hub/today/v5-peacock-app` (docs/15 D31). Look and behaviour stay that design's. Its `kit/README.md` is the
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
  src/app/[locale]/[ws]/[view]/       the placeholder for a view with no folder yet
  src/components/kit.ts               the kit's one public import
  src/components/{ui,common,cards,shell}/
  src/features/cards/                 store.ts (queries, writes), rules.ts, map.ts, keys.ts, types.ts
  src/features/session/               useSession, useMe, useMembers, useMyCounts, useAwaiting, auth
  src/features/live/                  LiveProvider, what a stream message does to the caches
  src/lib/api/                        client.ts (ky), errors.ts (HubError), generated/ (hey-api)
```

## How the app runs

- **The signed-in app renders in the browser only** (`components/shell/workspace-gate-loader.tsx`, `ssr: false`), as the design did. `window` and `document` are safe in anything under `[ws]` and `/workspaces`. Auth pages are server-rendered, so they must not read data during render.
- **The API is behind the web origin.** `next.config.ts` rewrites `/api/v1` to `HUB_API_ORIGIN`, so cookies are first-party and SSE is same-origin. Rewrites are fixed at `next build`, so an image must have `HUB_API_ORIGIN` set when it builds. `compress: false` is required: gzip through the proxy holds SSE frames back and the stream looks dead.
- **Session.** `lib/api/client.ts` sends `X-Requested-With: hub`. On a 401 it refreshes and retries once, except on wrong credentials. Refresh is one flight across tabs (Web Locks), because the API treats a parallel refresh as token reuse and revokes the family. A failed refresh ends the session and goes to sign-in. `totp_setup_required` goes to `/totp?setup=1` and comes back afterwards. A seeded owner must enrol before any project route answers.

## Add a page

The view is already in the sidebar, the palette, the breadcrumb and the `g` keys (`components/shell/views.tsx`). The placeholder route
serves it until you add the folder.

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

The shell mounts one `LiveProvider` per project (`features/live/`). **You write nothing for this.** Each message patches the row and the open sheet to the new status, then invalidates `qk.card`, `qk.events`, `qk.cards` (every list), `qk.counters`, `qk.today`, `qk.timeline` and `qk.inbox`.
So a page is live if its queries use those keys. A new domain needs one line in `applyCardEvent`.

- Connection: fetch-based SSE at `GET /workspaces/{ws}/events/stream`. It resumes with `Last-Event-ID`, refreshes the session on a 401, backs off 1 s to 30 s, and refetches everything on reconnect.
- Messages it reads: the contract's `RealtimeCardEvent` (any event name, as long as `data.cardKey` is there), docs/04 §4's `card.*` shape, `counters`, `inbox.new`, `inbox.read`, `workspace.updated`.
- The indicator (`useLiveStatus`) is `connecting`, `live`, `reconnecting` (down 5 s or more) or `unavailable` (the server answered 403 or 404). It is `live` only with an open stream that has been heard from within 60 s.
- A timeline that should show a "3 new" pill instead of jumping: keep your own count from `useCardEvents`-style data rather than turning this off.

Known limits, stated so nobody hunts for them:

- `GET /counters` does not exist in the API yet. It answers 404 and the app treats that as "no number": Timeline, Planning, Onboarding, Members and Settings show no badge. Decisions, Needs, Handoffs, Redesign and Tasks come from `cards?awaiting=me` and `tasks/ready`, and Inbox from `inbox/count`. All are live now. `toMyCounts` reads the fields of docs/04 §3.23 as soon as they land. Inbox's own hooks are for the Inbox page's author (`qk.inbox` is already invalidated).
- Each tab holds one stream. Over plain HTTP/1.1 a browser allows 6 connections per origin, so a seventh Hub tab on `http://localhost` would wait. HTTP/2 behind Caddy removes the limit (D33 defers Caddy).

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

Props and notes are in `F:/Goteav/redesign/hub/today/v5-peacock-app/kit/README.md` § Components, and stand unchanged, all from `@/components/kit`: `TypeIcon TypeDot TypeBadge StatusBadge Pill MineMark PriorityBadge RoleBadge CardKey CardChip Avatar ActorChip RelativeTime CopyButton Kbd Tooltip`,
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
- New: `LiveIndicator`, `AuthFrame` (`components/auth`), `NewProjectWizard`, `ProjectsPage` (`components/workspaces`), `ViewPlaceholder`.

## Tests

`src/test/render.tsx`: `renderWithApp(ui, { locale })` uses the real catalogs and a fresh query client. `stubFetch((url) => ({ body: { data } }))` answers from a table, and an unmatched call is the API's 404. Logic first: `*.spec.ts` beside the file. A page: one render test per state. Before handing back:

- `pnpm check` for your paths.
- 390, 768, 1440 × ar, en × light, dark: no horizontal overflow, 0 AA failures, measured.
- Loading, empty, error, no permission.
- Tab reaches everything in visual order, focus visible, `j` `k` `Enter` work, the sheet returns focus.
- Next to the lab's shot of the same page.
