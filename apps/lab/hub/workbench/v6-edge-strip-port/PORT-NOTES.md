# Port notes: v6-edge-strip-port

For the agent porting this into `apps/web`. D55: port with no further lab approval. The owner judges it live, after an independent review of the running app. Decisions are in `docs/16-workbench.md` D49 to D55 and "§7.2 as built". The design's data contract is `packages/contracts/src/chat.ts`.

## What is mock
Everything in `core/mock.ts`, `core/scripts.ts`, `core/smart.ts`'s canned replies, and `play`, `serverReport`, `send` and `checkEngine` in `core/store.ts`. Delete them, and render from the hooks.

- `serverReport` copies the server's rule so the mock cannot lie. The server already has it.
- **Prototype only, do not port:** the flask (`DemoMenu`), `?wb=`, `?wbfast=1`, `Check again` clearing on the second press, seeds, and `startTask`'s variants.
- `{ ar, en }` on server strings exists because the prototype renders both languages. The real fields are plain strings, in whatever language Claude wrote.
- Prev and Next (`useSiblings`) walk same-type open cards. The real one reads the page's own list and filters.

## What comes from which hook
Hooks and reducers are in `apps/web/src/features/chat/` (see `apps/web/README.md` § The chat panel's engine). Check names against that README, since I read only `live.ts`.

| Design part | Source |
|---|---|
| Thread items | `ChatFullDto.messages[]`: `steps`, `approvals`, `questions`, `reports`, `docDrafts`, `notices`, `stages`, `plan`, `structuredPlan`, `changedFiles`, kept live by `chat.event` through `live.ts` |
| Honest states, composer on or off, Check again | `honestStateOf` (`live.ts`), `useRecheckEngine`. `EngineNotice`'s table follows it. `billing`, `overloaded`, `session_missing`, `folder_*` and `unknown` are last-turn failures: the composer stays open |
| Pending counts | `pendingQuestions` and pending approvals across chats |
| Draft on a Save | `draftOfApproval`. Save is Allow on `save_doc` with `doc: { content?, claims? }`. Flags use `openFlags` and the preview uses `applyClaimAnswers` from `chat-results.ts` |
| Run this plan | `planToPrompt`, fills the composer |
| Checklist | `checklistOf` |
| Suggestions | `ChatSuggestion` from `chat-suggestions.ts`: `onPress`, `mode`, words in `chat.json`. Replace `core/smart.ts` |
| Effect line | `chat.json` `categories.<category>`, the twin of `APPROVAL_EFFECTS` |
| Question answer | `answerApprovalSchema.answers`, keyed by question text, a multi-select's labels joined with commas |
| Report's Go to the step | `stepId` to `chat_steps` in the same chat |
| "Edits came after this run" | Client-side: a Write or Edit step with `startedAt` after the run's. Not a server field |

**Fields the design needs that the contract lacks, so settle or drop them:** a question's `variant`, `diff`, `changedOn` (the conflict's diff; in the real flow a stale save is `doc.draft.updated` with `refusedCode`, and the owner needs the changed text from somewhere), `stoppedBy` (derive it from the device state and the turn's failure), and `revoked` / `limit_open` as demo states, which are real `honestStateOf` outcomes.

## Shell and sheet changes in `apps/web`
- `components/shell/shell.tsx`: panel, grip and strip in the layout; second skip link; `F6`; page width state. The skip link to content must fall to the sheet title when the page is aside.
- **`parts/layout.tsx` holds the D54 rule, port it as is:** measure the sidebar with a `ResizeObserver`; `pageMin` by view (400 list-like, 520 otherwise); the page steps aside only while the panel is open, and never by Follow; with the panel closed and under 400 px the sheet overlays the page, and the page is `inert`.
- **Tasks' List under 520:** here the layout writes `?view=list`. Port it as a prop or context on the Tasks page, so the URL and a chosen view stay the owner's.
- `components/cards/card-sheet.tsx`: when docked it is a plain `<section>`, not a Radix dialog (a non-modal dialog still loops focus). Title focus, not an action. Esc only from inside. `stepAside` swaps Close for Back to {page}, with Prev and Next and `j`/`k`. Keep it open after an action with the panel open (here `useStayingPerform` reopens it; the real one should not close). Primary steps down while `panelOwes`.
- `components/shell/shortcuts-dialog.tsx`: the panel group and F6. `components/common/toast.tsx`: position clear of the panel.
- Docs page: this version carries a copy in `parts/`, because the doc bar and revisions live there and it reads the page's width.
- **Hide until their slices ship (review L4):** strip run icons, Runs, Schedule, Do next, the VS Code dialog.

## Page grids need container queries
v5's pages read the viewport, so beside the panel they keep desktop lanes. `[data-wb-page-narrow]` in `core/workbench.css` forces them down under 960 px. In the port, give the page a `container-type: inline-size`, and move those grids (`lg:grid-cols-12`, `md:grid-cols-4/5`, spans) to container variants. Then delete the override.

## CSS that was only for the prototype
In `core/workbench.css`:
- **Delete:** the utility stand-ins (`.max-h-48` to `.md:min-h-7.5`), which exist because the lab's dev server had not compiled them.
- **Replace with a prop:** `[data-wb-sheet-open] [data-wb-page] button.bg-primary`, which forces row buttons to outline. Pass the variant instead.
- **Replace:** `[data-wb-page-narrow]`, as above.
- **Keep, as tokens or components:** the coarse-pointer 44 px rule (`pointer: coarse`, not width), the grip's hit area, `.wb-hover-reveal`, `.wb-command`, `.wb-danger`, `.wb-diff-*`, `[data-wb-tipbox]` and its wrapper's `pointer-events: none`.
- `.wb-sheet-measure` is only needed where a stepped-aside sheet gets wide.

## Rules to keep
No coloured side or top edge. Allow and Deny have no tooltip, which is a recorded exception to §7.1. A question's option is filled only when its label says "(Recommended)". Keys, commands and paths stay LTR. Tooltip text lives in `core/tips-copy.ts`; move it to `chat.json`.
