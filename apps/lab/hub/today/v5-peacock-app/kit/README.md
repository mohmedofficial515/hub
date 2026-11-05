# Hub app kit (v5-peacock-app)

Everything a page needs. Read this, then `pages/today/` as the worked example. Import from `../../kit`.

```
v5-peacock-app/
  page.tsx          lab entry, renders shell/shell.tsx
  tokens.css        Night Peacock tokens, Arabic type rules, scoped to .peacock-app
  i18n.ts           shell strings only
  shell/            router, views registry, sidebar, header, palette, new-card and shortcuts dialogs
  kit/              shared components, the card store, the sheet
  pages/<view>/     page.tsx + i18n.ts + parts/ you create
  shared/mocks/hub-app/       the card catalogue (outside this folder, import @lab/mocks/hub-app)
```

## Add a page

Only touch `pages/<view>/`. The view is already routed, in the sidebar, the palette, the breadcrumb and the `g` keys.

1. `pages/<view>/i18n.ts` exports `messages = { ar: {...}, en: {...} }`. All visible text goes there. Card vocabulary (type,
   status, role, action names) comes from `kitMessages`, do not repeat it.
2. `pages/<view>/page.tsx` default-exports a component with no props. The shell draws the sidebar and header, and the sheet,
   palette and toasts are already mounted. Start with `<PageContainer>` and `<PageHeader>`. Reading any card? Use `useCards()`.
3. Page-specific data goes in a new `shared/mocks/hub-app/<domain>.ts`, imported as `@lab/mocks/hub-app/<domain>`. Do not edit
   `shared/mocks/hub-app/index.ts` for that. Add a card to its catalogue only if you need a key that does not exist.
4. Local components go in `pages/<view>/parts/`. If a second page needs it, it belongs in `kit/`: add it, export it from
   `kit/index.ts`, and document it here.

```tsx
import { useRef } from 'react';
import { Scale } from 'lucide-react';
import { useLocale, useT } from '@lab/i18n';
import { Button, CardRow, EmptyState, FilterBar, kitMessages, openCard, PageContainer, PageHeader, SectionHeader, SkeletonRows, StatusBadge, useCards, useFilter, useKeyboardList, useSession, type DecisionCard } from '../../kit';
import { messages } from './i18n';

export default function Page() {
  const t = useT(messages);
  const kit = useT(kitMessages);
  const locale = useLocale();
  const { loading } = useSession();
  const status = useFilter('status');
  const rows = useCards().filter((c): c is DecisionCard => c.type === 'decision' && (!status || c.status === status));
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useKeyboardList({ ids: rows.map((c) => c.key), emptyFocusRef: heading });

  return (
    <PageContainer>
      <PageHeader title={t.title} />
      <FilterBar mine={{ page: 'my-view' }} groups={[{ param: 'status', label: t.status, options: [{ value: 'open', label: kit.status.open }] }]} />
      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <SectionHeader ref={heading} id="list-title" title={t.list} count={rows.length} />
        {loading ? (
          <SkeletonRows count={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Scale} title={t.emptyTitle}>{t.emptyBody}</EmptyState>
        ) : (
          <ul data-hub-list className="flex flex-col gap-2">
            {rows.map((c) => (
              <li key={c.key}>
                <CardRow
                  {...list.rowProps(c.key)}
                  cardKey={c.key}
                  type={c.type}
                  title={c.title[locale]}
                  priority={c.priority}
                  meta={<StatusBadge status={c.status} />}
                  action={c.status === 'open' && <Button onClick={() => openCard(c.key, { action: 'decide' })}>{kit.actions.decide}</Button>}
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

## Rules

**Tokens.** Token classes only, never hex in TSX (`bg-card`, `text-muted-foreground`, `border-border`, `bg-(--heat-2)`). No palette
classes (`bg-red-500`), no literal sizes (`text-[13px]`). Hex lives in `tokens.css`.

**Colour.**
- **A card is one neutral surface (`bg-card`) with one uniform neutral border (`border-border`) on all four sides. The type shows through its
  coloured icon and type word. No card or panel has a coloured or thicker side or top edge, in any form: border, pseudo-element, inset shadow or
  positioned bar (owner decision 2026-11-04).** Urgent or overdue: a uniform rust hairline on all four sides (`border-destructive/70`), plus the danger pill and icon.
  If a row reads flat, fix it with spacing and type. Never tint a row or a card. Soft tints
  (`bg-type-*-soft`, `bg-*-soft`) are for small badges only.
- Bright cyan (`bg-primary`, `text-primary`) means the one primary action of a view, links, and the focus ring. Nothing else. A
  page has at most one filled button. Selected states and "now" markers use `foreground`.
- **The filled-button rule: filled means the next thing this page wants from me. Creating is never it, unless the page is empty.**
  "New task" and "Invite" are outline, and the first Ready task I can claim is filled. On an empty page the create button is filled, in
  the `EmptyState`, and the header's copy is hidden. A form's save takes over while its form is open, so the sheet's header button goes
  outline. Verifying my own delivery is allowed and never filled. A page with no next step (Timeline, Docs) has no filled button.
- Overdue, escalated, failed and breaking are the danger tone everywhere (`tone="danger"`, `text-destructive-soft-foreground`).
  Warning is only for "due within 24 h", stale and no-summary.
- Coloured text uses the `*-fg` or `*-soft-foreground` tokens (at least 4.9:1 on card, background, accent and their own tint).
  Do not use `opacity-*` on text and do not use `text-destructive`.
- No gradients, and no shadow deeper than `shadow-md` (popovers and sheets only).
- Status is never colour alone: icon + words, or words beside the dot. A count on a badge gets words in `aria-label`.

**Type.** Named sizes only: `text-caption` `text-body-sm` `text-body` `text-body-lg` `text-title-sm` `text-title` `text-headline`
`text-display`. Arabic gets a step more through `tokens.css`, automatically, so do not branch on the locale.
- Meta lines are `text-body-sm`, not `text-caption`. Caption is for badges, keys and small legend labels.
- Hierarchy: the page title (`hub-page-title text-headline`, via `PageHeader`) > numerals (`text-title font-bold`) > card titles
  (`text-body-lg font-semibold`, lead `text-title-sm`). Do not use `text-display` for counters.
- Weights: `font-normal` reading, `font-medium` labels and badges, `font-semibold` headings and card titles, `font-bold` numerals
  and emphasis in prose. 800 is the page title only. Keep Cairo everywhere for Arabic, and do not add another face.

**RTL.**
- Logical properties only: `ms- me- ps- pe- start- end- text-start text-end border-s border-e rounded-s rounded-e`. Never `ml- mr-
  pl- pr- left- right- text-left text-right`.
- Keys, branches, paths, commands, numbers with units: `<Ltr mono>`, `<Ltr>` or `<code dir="ltr" translate="no" className="key">`.
- API strings: wrap in `<Bidi>{title}</Bidi>`. It isolates `2%`, `GTV-231`, `v7-twin-tanks`, `POST /path`.
- Our own sentences: `fill(template, { key: <Ltr mono>{k}</Ltr> })` for nodes, `fmt(template, { n })` for strings. Never concatenate.
- Plurals: `plural(n, locale, forms)` with `{ zero, one, two, few, many, other }` for Arabic. Numbers: `num(n, locale)` (Latin digits).
- Dates: `RelativeTime`, or `when`, `rel`, `time`, `longDate`, `shortDate`, `absolute` from `format.ts`, never `toLocaleString`.
- Directional icons mirror with `rtl:-scale-x-100` (arrows, chevrons, LogOut). Clocks, checks, git and the brand mark do not.
- Time axes run with reading on every axis: start = earlier, end = later (the sparkline, heatmap and runway all do).

**Interaction.**
- `motion-safe:` for any CSS animation. framer-motion only for the sheet and list reordering (`layout`), and it honours reduced
  motion through the shell's `MotionConfig`. No decorative motion and no hover movement.
- 44 px targets on phones. `Button` and `IconButton` already do this. Small inline links get `hit-44`.
- Visible focus: `focusRing` (or `focusRingInset` inside a clipped parent) on anything custom.
- Actions by Decide, Deliver, Acknowledge and so on open the sheet on that action: `openCard(key, { action })`. Only actions with no
  form (Claim) run in the row, through `usePerformAction`.
- **Read keys through `matchKey(e, key)`, never `e.key`** (`kit/keys.ts`). Letters match `e.code`, so a shortcut survives an Arabic
  layout; `'j'` is without Shift, `'E'` with it; `'?'` takes `؟` and `'/'` takes the Slash key. Ctrl+K is `e.ctrlKey && matchKey(e, 'k')`.
- **A group of chips or segments is one Tab stop.** `Segmented` and `ChipGroup` do this with `useRoving`; arrow keys follow reading direction.
- **Mine, on every page: off by default, with mine marked (`MineMark`) and sorted first.** An explicit choice is remembered per member and page.
  A stream keeps its order and only marks. Pass `mine={{ page }}` to `FilterBar`, and call `rememberMine(page, me.id, false)` where a page clears its filters.
- **Words.** Handoff is «إحالة» and Need delivery is «تسليم», never the same word. Toasts and History use verbal nouns, so nothing picks a gender.
  Source states come from `kit.sourceStatus`. A word that depends on the card goes through `actionName(t, card.type, action)`.

**Dev server.** Tailwind scans sources when `lab/src/styles/hub.css` is built, and the running server may not notice a new file or
new class. If a new class has no style, run `touch F:/Goteav/redesign/lab/src/styles/hub.css`. Do not edit that file.

## Router (`shell/router.tsx`, re-exported by the kit)

URL: `#/today/v5-peacock-app/<view>[/<cardKey>]?lang=ar&theme=dark&scenario=frontend[&action=decide&tab=comments]`. The query
string is preserved. On a view change, only `lang theme scenario w notes dir live` survive; your page's own filters are dropped.

| API | Use |
|---|---|
| `useRoute()` | `{ base, view, cardKey, query: URLSearchParams }`, re-renders on change |
| `navigate(view, { card?, query?, replace? })` | go to a view |
| `<AppLink view="tasks" query={{ status: 'ready' }}>` / `<AppLink card="GTV-231" action="decide">` | real `<a href>`. Use it for any place |
| `hrefFor(view, opts)` | the hash string |
| `setQuery({ status: 'ready', other: null })` | set or clear params on the current view (`null` removes) |
| `openCard(key, { action?, tab?, opener? })` | open the sheet over this page. The URL carries the key |
| `closeCard()` | close it |

## Session and data

```ts
const { scenario, me, roles, isOwner, isManager, today, loading, error } = useSession();
```
- `scenario` comes from the lab toolbar: `default` (owner), `frontend` (Sara), `empty`, `loading`. `?scenario=error` works by URL. Every
  page must render all of them: skeleton shaped like the final rows for `loading`, `EmptyState` for `empty`, `ErrorState` for `error`.
- `today` is `@lab/mocks/hub-today`'s data for that persona.
- `useAwaiting()` my stack, `AwaitingCard[]` (`group: urgent | soon | rest`, `action`, `mode`, `selfVerify`). A row comes from the card's current state through
  `awaitedAction(card, roles, me.id)`: it stays while I have an awaited action, its verb follows the card, and it leaves when none remains. Keys stay stable, so focus stays too.
- Candidates are the persona's routed cards. A manager also gets a handoff of another role, but only once it is overdue (`isHandoffStale`).
- `useClearedCount()` rows that left my stack. `useDeadlines()` my deadlines. `useReadyTasks()` tasks ready for my roles, the one number the sidebar, Today and Tasks show. `sinceVisitCount(today)` the since-last-visit number.
- `useMyCounts()` `{ inbox, newEvents, tasksReady, decisions: { mine, all, overdue }, needs, handoffs, redesigns, onboarding, invites, sourceProblems }`,
  scoped to me. Link numbers to what they count: "mine" goes with `?awaiting=me`.

**`@lab/mocks/hub-app`** exports `cards: HubCard[]`, `cardByKey`, `cardsOfType`, `deadlinesFor`, `navExtras`, `members`, `NOW`, `workspace`,
`today`, `todayFor`, and all the types (`HubCard`, `TaskCard`, `DecisionCard`, … `CardEvent`, `CardComment`, `CardLink`, `DecisionOption`,
`OasdiffChange`…). Narrow on `card.type` to reach `card.decision`, `card.need`, `card.task`, `card.change`, `card.handoff`, `card.redesign`,
`card.doc` or `card.release`. Shapes follow `project-hub/docs/03-data-model.md` §5–§6. Visible strings are `{ ar, en }`: read `x[locale]`.

**Read cards through the store, not the mock**, or your page will not see actions taken in the sheet:

| Store API | Use |
|---|---|
| `useCards({ archived? })` | all cards with changes applied, re-renders on change |
| `useCard(key)` / `getCard(key)` | one card (the hook re-renders) |
| `usePerformAction()` | `perform(key, action, payload?, { cmd? })`: writes, marks the card's notifications read, closes the sheet, toast with Undo (which restores all of it), focus restored on Undo. A claim adds its `/hub:next` command, and on a redesign acts on the port task. No target means no write and no toast. **Use this for all actions** |
| `actionsFor(card, roles, memberId)` | `AvailableAction[]` for a status, first = primary. `enabled: false` + `needsRole` for a disabled button |
| `actedOn(key)` | the action taken this session, or undefined. Do not use it to decide whether a card still waits on me: use `awaitedAction` |
| `portTaskOf(card)` | a redesign's port task (09 §10) |
| `markTimelineSeen()`, `isTimelineSeen()` | the Timeline's visit clears the one since-last-visit count |
| `addComment`, `addLink`, `toggleWatch`, `setArchived`, `createCard`, `searchCards(q, locale)` | the other writes and search |
| `openBlockers(card)` | keys in `blocked_by` that are still open. Deciding or finishing the blocker frees the task on every page |
| `updateTask(key, memberId, { priority?, branch? })` | `PATCH /tasks/{key}`, with a `field_changed` event per field |
| `useInbox(scenario)`, `unreadCount(scenario)`, `markInboxRead(ids)`, `markInboxUnread(ids)`, `markCardsRead(keys)`, `markSourceRead(id)`, `archiveInbox(ids)`, `restoreInbox(ids)` | `kit/inbox-store.ts`, the Inbox's read and archive state. The sidebar badge reads it. Writes return their undo |
| `patchCard(key, update)`, `addCard(card)`, `nextCardKey()`, `notifyCardStore()` | a write that is not a status action (release notes), a card type `createCard` does not build, and a re-render for state kept outside the store (onboarding progress) |

Workspace admin data (members, invites, sources, tokens, settings, audit) lives in `kit/admin-store.ts`: `useAdmin(scenario)`, `updateAdmin(fn)`, `writeAudit(row)`, `isSourceProblem(source)`. `useMyCounts` reads `invites` and `sourceProblems` from it.

`ActionPayload`: `{ optionId, optionTitle, rationale, location, note, reason }`. Actions (`CardAction`): `decide withdraw deliver start verify
cancel acknowledge apply dismiss approve reject request_changes claim unclaim submit done review send_to_review mark_ported release mark_ready reopen`.

## Components

All accept `className`. Sizes are desktop; phones grow to 44 px.

### Vocabulary
| Component | Props | Notes |
|---|---|---|
| `TypeIcon` | `type, labelled?, size?: 'sm'\|'md'` | coloured icon. The word is sr-only unless `labelled` |
| `TypeDot` | `type` | 8 px, always with text nearby |
| `TypeBadge` | `type` | dot + word on the soft tint |
| `StatusBadge` | `status` | any status string; tone and icon per 08 §5.1 |
| `Pill` | `tone?: danger\|warning\|success\|info\|muted, icon?, children` | for derived facts: `<Pill tone="danger" icon={Clock}>15 h overdue</Pill>` |
| `MineMark` | | the one marker for "this is mine" on a row or desk |
| `PriorityBadge` | `priority` | mono; hide P2 and P3 in dense lists (08 §5.1) |
| `RoleBadge` | `role, routed?, outline?, iconOnly?` | `routed` = filled dot: one of my roles. Skip it in lists routed to me by definition |
| `CardKey` | `k, link?` | LTR mono key; `link` opens the card |
| `CardChip` | `k, type?, title?, showTitle?, showStatus?` | inline reference that opens the card. Fills type and title from the catalogue |
| `Avatar` | `member?, size?: xs\|sm\|md, agent?, online?` | `online` adds a dot and a `title` in words |
| `ActorChip` | `kind?: user\|agent\|system, memberId?, adapter?` | who did it (08 P4) |
| `RelativeTime` | `iso` | "5 min ago", absolute after 7 days, full date in `title` |
| `CopyButton` | `text, label?, showText?, compact?` | `compact` for inside sentences; `showText={false}` for icon only |
| `Kbd` | `children` | key hint |
| `Tooltip` | `content, side?, align?, children` | collision-aware. Trigger must be focusable, and its accessible name must carry the same fact |

### Controls
| Component | Props | Notes |
|---|---|---|
| `Button` | `variant?: primary\|outline\|ghost\|destructive, size?: sm\|md, busy?` | `primary` once per view; `busy` adds a spinner and keeps width |
| `IconButton` | `label (required), variant?, children` | square, with `aria-label` and `title` |
| `Field` | `id, label, hint?, error?, required?` | bind the control with the same `id`. An error sets `aria-invalid` and `aria-describedby` on it, and the first one in a form takes focus |
| `TextInput`, `Textarea`, `Select` | native props | commands and paths: `dir="ltr" className="key text-start"`; search and free text: `dir="auto"` |
| `detectSecret(text)`, `SecretFilterError` | `pattern, id?` | every free-text form: block on a match |
| `Modal` | `open, onOpenChange, title, description?, footer?, children` | focus is trapped and returned. Mark a field `data-autofocus` to land on it: plain `autoFocus` loses to the sheet's focus trap |
| `ConfirmDialog` | `open, onOpenChange, title, description?, confirmLabel, reason?, destructive?, onConfirm(reason)` | for reject, cancel, revoke, archive, dismiss, withdraw |
| `Segmented` | `label, value, options: { value, label, count? }[], onChange` | one of a few views of the same list (Open / Decided / All). Selected is neutral `foreground`. One Tab stop |
| `ChipGroup` | `label, showLabel?, options, isActive, onPick` | named chips, one Tab stop. `FilterBar` draws its groups with it |
| `PickField` | `label, hint?, keys, onChange, picker?: card|doc, types?, multi?` | a create-form field: chips plus a button that opens `CardPicker` or `DocPicker` |
| `RowAction` | `card, action, denied?, variant?` + Button props | a row's button from `actionsFor`: opens the sheet on a form action, runs one with no form, and without the role is disabled with a tooltip naming it |
| `RowMenu` | `label, items: { label, icon?, onSelect, destructive?, disabled?, separated? }[]` | a row's `⋯` menu. A dialog opened from it returns focus to the trigger |
| `RoleChecks` | `legend, value, onChange, locked?, error?, hint?, compact?` | choose roles with checkboxes |
| `CommandBlock` | `label?, value, copyLabel` | LTR value that wraps, with a copy button |
| `ShownOnce` | `warning, exampleLabel, children` | wraps a value the API returns once: token, invite link, reset link |
| `CardPicker` | `open, onOpenChange, onConfirm(keys), title?, confirmLabel?, value?, types?, exclude?, multi?` | 09 §19: search by key or title, type filter, chips. Reads the store. `multi={false}` confirms on the first pick |
| `DocPicker` | `open, onOpenChange, onConfirm(keys), title?, confirmLabel?, value?, exclude?, docs?` | 09 §19: tree + search, returns doc card keys. Reads the store's doc cards unless you pass `docs: DocPickerItem[]` |

### Layout and states
| Component | Props | Notes |
|---|---|---|
| `PageContainer` | `children` | gutter and max width. Every page starts here |
| `PageHeader` | `title, meta?, actions?` | the h1; it takes focus on view change |
| `SectionHeader` | `id, icon?, title, count?, aside?, level?`, `ref` | h2 or h3; `tabIndex=-1`, so pass its ref to `emptyFocusRef` |
| `EmptyState` | `icon, title, children?, action?, size?: section\|page` | **One recipe: one title, one sentence, one next step.** Hide the header's copy of that step, and its subtitle when it only restates the title. Address the person who can act. Filled on a page that is empty |
| `ErrorState` | `thing?, title?, code?, requestId?, onRetry?, forbiddenRole?` | "Couldn't load <thing>"; `forbiddenRole` for a 403 |
| `Skeleton`, `SkeletonRow`, `SkeletonRows` | `className`; `withAction?`; `count?` | same height as `CardRow`; no spinners inside lists |
| `LoadingRegion` | `label, children` | wraps a loading view, and adds "Still loading…" after 3 s |
| `FilterBar` | `status?: { label, value, options, onChange }, mine?: { page, param?, value? }, groups?: { param, label, options, multi? }[], selects?: { param, label, any, options }[], searchParam?, searchPlaceholder?, extra?, extraChips?, collapse?: 'always'\|'phone', openRef?` | One order: status segment, Mine, then "Filters (n)". Everything else sits behind that button: at all widths with `collapse="always"` (Timeline, Tasks), under 768 px with `"phone"`. While folded, active filters are removable chips. Group names are visible. Read back with `useFilter(param)` / `useFilterList(param)` |

### Screenshots and markdown
| Component | Props | Notes |
|---|---|---|
| `Lightbox` | `images: { src, name, alt? }[], index, open, onOpenChange, onIndexChange` | 09 §19. Arrows follow reading direction, the file name is the caption, download included. Tall shots scroll at full width. Stacks over the sheet |
| `MarkdownView` | `source, dir?, renderLink?, renderHeadingAction?, headingOffset?, copyCodeLabel?` | Markdown as app elements through `marked.lexer`: anchored headings, framed tables, code with copy, read-only task lists. No raw HTML. Give it the doc's own `dir`. Pair with `headingsOf(source)` and `slugify` |

### Rows and keyboard
**`CardRow`**: the app's row. Any list of cards uses it (08 P1).
```tsx
<CardRow {...list.rowProps(key)} cardKey={key} type="decision" title={title} priority="P0"
  tone="type" /* or "danger": a uniform rust hairline on all four sides */
  lead={false} /* one row per triage list: larger title, full-width action on phone */
  hideType={false} /* drop the type word when every row in the list is the same type */
  variant="card" /* or "flush", inside a bordered <ul> */
  openAction="decide" /* the whole row opens the sheet on this action */
  meta={<Pill tone="warning" icon={Clock}>Due in 3 h</Pill>}
  action={<Button onClick={…}>Decide</Button>} />
```
The whole row is a stretched link that opens the card. `action` sits above the link. Keep `meta` short so the row stays at two lines.

**`useKeyboardList({ ids, onOpen?, actions?, emptyFocusRef? })`** returns `{ rowProps(id), focusRow(id) }`.
- `j` / `k` walk all visible rows on the page, across lists, in DOM order. `Enter` or `o` opens the focused row (default: `openCard(id)`).
- `actions`: single keys on the focused row, e.g. `{ c: claim, a: acknowledge }`. Add `aria-keyshortcuts` to the matching button.
- When a focused row leaves `ids`, focus moves to the row at its index (or the last one), or to `emptyFocusRef` when empty. The sheet does
  the same on close, so a row resolved in the sheet hands focus to the next row. Nothing else is needed.
- `focusRowWhenReady(id)` focuses a row now or when it appears (Undo uses it).
- Mark the list `data-hub-list` so the toast holds Undo while focus is in it.
- Single keys respect the member's preference (`usePreference('shortcuts')`, `shortcutsEnabled()`). Add your own keys only with that check,
  and skip inputs and dialogs.

Keys already taken: `j k o u c a d w r / ? [ ]`, `g <x>`, `n <x>`, Ctrl/Cmd+K, Ctrl/Cmd+Z, Esc.

**`showToast({ message, cmd?, onUndo?, tone? })`**: at the inline end. With `onUndo` or `cmd`, it stays at least 10 s and, with Undo, for as long as focus is
in a list; `u` and Ctrl/Cmd+Z undo. Only another such toast replaces it: a plain notice stacks above, so it never costs the member an Undo. You rarely call it for actions: `usePerformAction` does.

### The card sheet
`openCard('GTV-231')`, `openCard(key, { action: 'decide' })`, `openCard(key, { tab: 'comments' })`. It is mounted once by the shell.
- Header (TypeBadge, key, status, priority, overflow menu, close), title, role, creator, action bar (from `actionsFor`), tabs
  Details / Comments / History / Links. The URL carries `key`, `action` and `tab`. An unknown key shows the 404 state.
- Per-type sections live in `kit/sheet-sections/<type>.tsx` and are registered in `sheet-sections/index.ts`. To extend one, edit its file.
  A section gets `SectionProps`: `{ card, action, cancelAction, perform }`. It shows its form when `action` is one of its own.
- Parts you can reuse on pages: `DecisionOptionCard`, `NeedStatusStepper`, `HandoffDiffList`, `ContractChange`, `Facts` + `Fact`, `SubHeading`,
  `Checklist`, `ActionPanel`, `NoteActionForm`, and `tabTriggerClass` for Radix tabs.
- Which edge it opens from is one constant, `SHEET_EDGE` in `kit/card-sheet.tsx`.

### Helpers
`cn` (from `@lab/ui/hub-cn`, knows the named sizes), `useMedia(query)`, `fmt`, `fill`, `Ltr`, `Bidi`, and `format.ts`: `num time weekday longDate
shortDate dayOfMonth absolute when duration rel plural firstName hoursFromNow nowMs DAY`. Class maps: `typeClass[type].{dot,soft,fg,edge,fill,stroke}` (`edge` outlines a chart mark, never a card),
`typeIcon`, `roleIcon`, `prioClass`, `toneClass`, `avatarClass`, `focusRing`, `focusRingInset`.

Radix overlays must portal into the version root or they lose the tokens: `<X.Portal container={portalRoot()}>` from `kit/hooks`. A Radix dialog
with no Trigger passes `onCloseAutoFocus={useFocusReturn(open)}`. Layers: header 30, sheet 40–50, toast 60, dialogs 70, menus 75, tooltips 80.

## Checklist before you hand back

- `pnpm typecheck` clean.
- 390, 768, 1440 × ar, en × light, dark: no horizontal overflow, 0 AA failures.
- All four scenarios, plus `error`.
- Tab reaches everything in visual order, focus visible, `j` `k` `Enter` work, the sheet returns focus.
- `rg "#[0-9a-f]{3,8}\b" pages/<view>`, and no `ml- mr- pl- pr- left- right- text-left text-right` in your folder.
