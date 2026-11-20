# Planning (docs/15 §4)

The page answers one question: **what are we thinking about, and what is planned next?** It has no v5 design, so this is the reasoning for an owner review. Shots are in `shots/`.

## Layout

From the top: the header, the filter row, one focal card across the whole width, then two lanes.

- **The two lanes are the page's answer, in the order the question asks it.** "What we are thinking about" holds ideas and "What is planned next" holds plans. They run with reading direction, because an idea becomes a plan: in Arabic ideas are on the right and plans on the left, in English the reverse. Plans get the wider lane (7 to 5), because a plan row carries more: a step count, its text, a next action.
- **Inside a lane, status is a heading, not a badge on every row.** Plans read in the order a person asks about them: waiting for approval, approved and not started, in progress, drafts. Ideas read "being explored", then "not started". Removing the repeated badge is what keeps a row to two or three lines.
- **The focal card is the one next thing this page wants from me.** A plan waiting for my approval comes first, then a finished plan to close, then work that can start, then an idea ready to become a plan (`pickFocal` in `features/planning/model.ts`, with tests). It holds the card's opening text and, for a plan, its first five steps with their tasks. Its action is the page's only filled button. If I can do nothing, the most active plan takes the spot under the words "Moving now" with no filled button, so the page still answers the question and never asks for something I cannot give. A card that is focal is not also a row.
- **On a phone** everything stacks in the same order as the DOM, so Tab and reading agree: focal, ideas, plans. The rows' buttons go full width on their own line, as Tasks does. Lanes sit side by side only from 1280 px, because below that the idea lane is too narrow for a title and a button.

## Rules kept

- **No coloured side or top edge on any card or panel** (D31). The focal card is the same neutral surface and uniform border as any card. It stands out through position and size, not colour. The type shows through the coloured icon on each lane's heading.
- **At most one filled button.** New idea and New plan are outline, since creating is never the filled button unless the page is empty. On an empty page New idea is filled and is the only one.
- **Step progress** is words first ("2 of 5"), with a thin neutral meter beside them. The meter uses `foreground` on `muted`, so it is never colour alone, and it is hidden from screen readers because the words already say it.
- **Nothing is invented.** There is no trend, no health score, no estimate: the API has none of these. An idea with no problem says so.

## Own page instead of the sheet (2026-11-09)

- **A plan or an idea opens as a page on Planning, `?plan=KEY`, never in the side sheet.** `openCard` and `AppLink` ask the card store (`setCardPage`) whether a cached key is a plan or an idea; a key not cached yet opens in the sheet and the sheet moves it to the page once its type is known. The one exception is Follow the chat on another page, which never makes the page step aside (D54): the plan stays in the sheet with an "Open its full page" button.
- **The page:** a header card (type tile, badges, title, who and when, the stage track, one sentence on what comes next, the action bar and the Claude buttons), then tabs (the plan, comments, history, links) beside a sticky side column (progress, the plan's own outline, details). Steps are a numbered timeline; the next step is marked in words, not colour alone.
- **Live:** the page reads the card through the cards' live stream. A step saved while the page is open slides in, a changed title or approach glows for a moment, and "Claude is working on this now" shows only while the open chat's running turn is on this card (`useClaudeOn`).
- **With Claude:** _Develop_ fills the composer in Execute with a request to improve the plan in place with `update_plan`, and waits for the owner's words (D51). _Run the next step_ runs `/hub:work` on the next step's task, and says why when it cannot. _Explain_ asks at once.
- **No live draft page (owner decision 2026-11-19):** `?draft=1` is gone. Any chat whose reply proposed a plan, structured or as words, opens in the Plan Studio at `?studio=plan&chat=ID` (`isPlanStudioChat` widened). A plan that came as words only shows there as written, with Save to Planning, Develop and Run. A Plan-mode turn no longer moves the page by itself: the banner on the lists offers the studio. An old `?draft=1` link lands on the studio, on the chat writing the plan when there is one. The chat's plan card and the studio save through `features/planning/proposal.ts`, so a save in one shows in the other.
- **Type sizes** step down one level from the rest of the app (rows `body-sm`, meta `caption`, titles `title-sm`/`title`), as the owner asked.

## Sheet

- **Editing is `?action=edit`.** The sheet already treats an open form as the one filled button, so the action bar goes quiet while editing, and a reload stays in the form.
- **A plan's form saves in one request**: title, body, steps, priority, tags. So one save is one revision and one event.
- **A live change while editing** does not touch the draft. A line says someone else changed the card and that saving replaces their text. The API keeps the replaced text as a revision, so nothing is lost.
- **Revisions** are folded by default, since most readers want the current text. Each past one can be read in place and restored, and a restore is itself a new revision. An entry names who replaced it, which is what the API knows, not who wrote it.
- **"Turn into a plan"** is a form that opens with the idea's problem and notes as the plan's text, and lands on the new plan's sheet.
- **"Create tasks from steps"** keeps the sheet open, unlike other actions, because the answer the member waits for is each step gaining its task there.

## Questions for the owner

1. **Is the focal order right?** Approve, finish, start, then ideas. It is one function, so changing it is one line.
2. **Parked ideas sit under "Closed".** They can reopen, so they could stay in the active lane. I moved them out so that lane holds only what is being thought about now.
3. **There is no plan owner.** A plan has no assignee or role in the API, so "Mine" here means what I wrote, plus ideas and steps routed to my roles.

## Limits

- The page reads `GET /ideas` and `GET /plans`, up to 1000 of each. A plan row shows no text, because a list row carries no body. The focal plan reads its own card for it.
- The sidebar's Planning badge waits for `GET /counters` (README, Known limits). The page's own numbers come from its rows.

## Idea Studio (2026-11-09)

- **New idea opens the studio, `?studio=idea`, not a form.** The owner writes the idea in one prompt; Claude runs `/hub:idea` (team-pack) in a new chat in Plan, which reads only. The page is that chat's own view (`&chat=ID`), so the side panel folds while it is open and comes back after.
- **What Claude does:** checks Hub (ideas, plans, cards, docs), then the code (Grep, Glob, Read), then the web when it may, and returns one report with `propose_idea`: a verdict and `overlap` (how much already exists, 0 to 100), each match with where it lives and its own overlap, problem and value, a flow (nodes and edges), findings with numbered sources, suggestions, a draft plan, risks and open questions. Every refinement sends the whole report again, and the page shows the latest.
- **The research is shown as it happens,** from the chat's real steps (`researchActs` in `features/planning/idea-studio.ts`): five stages, with the count of steps in each, and the last eight things it searched, read or opened. A stage it never used says so once the turn ends; nothing is shown as done that did not happen.
- **The flow is drawn here, not by a library** (`studio/diagram.tsx`): longest-path columns that follow the reading direction, and top to bottom once the flow is longer than four steps, so the words are never shrunk. Colours are theme tokens.
- **Accept** saves the report as an idea card through the normal create path: its text is the whole report, its problem and value are the idea's, and each Hub card it matched is linked as `relates` (saved again without links if one is refused). Then Turn it into a plan opens the idea's page on its plan form. Which report became which idea is kept in this browser.
- **The verdict follows the number:** `cleanIdea` corrects a report that says `new` at 80%.
- **The conversation is the studio's own** (`studio/conversation.tsx`), not the panel's thread: the idea as a card, quick prompts shown by their name, Claude's steps in plain words grouped by Hub, the code and the web (open while they run, folded after with counts and time), each report with what changed since the last, and a head that says what Claude is doing now, for how long and in how many steps. Approvals and questions are the panel's own components. Esc stops a running turn; the box stays writable meanwhile.
- **Flexible layout:** beside the report on wide screens, at a normal or wide width (remembered in this browser); below that, two tabs, Report and Conversation, with a live dot on Conversation while Claude works. Develop opens the conversation; Show the report goes back to its head.
- **Next:** the same engine for plans (a Plan Studio), so a plan starts from one prompt too.

## Studio review and the Plan Studio (2026-11-10)

Reviewed against a real idea (a customer refund tracker) and a real plan (hotels in four weeks), watched turn by turn.

- **Research board, not a tool log.** While the first report is written, the page shows what Claude has really found: the cards it read (as chips), the files it opened (inside the project, without the drive), what it searched and the pages it opened. Steps are named once, in `features/planning/studio-acts.ts`, for the board and the conversation alike; plumbing (`ToolSearch`, `report_stage`) is never counted.
- **One label per state.** "Updating" only when an earlier turn reported; the board goes once a report exists, and a refinement runs as one line above the report. When Claude asks something, the page says it waits for you and takes you to the question.
- **Counts in Arabic plural forms** (`stepCount`): «خطوة واحدة», «خطوتان», «3 خطوات».
- **Steps fold after the turn**; while it runs a group shows its last six. A failed turn shows its reason.
- **A request written while Claude works waits in line** (one per chat, kept outside the component) and goes when the turn ends. Apply on a suggestion and answers to the open questions go through the same line, and read back in the thread as what they mean, not as the instruction sent.
- **Accept once per session.** A refined report after Accept offers "Update GTV-x" (`saveIdea`), never a second idea. Same for a saved plan (`savePlan` rewrites its text and steps).
- **Sticky contents** with the section being read marked; the conversation sits below the app header (`top-18`).
- **Diagram**: nodes narrow to the room before the drawing scrolls; loops back run in their own lane on one side, sized to their label.
- **Plan Studio** at `?studio=plan`: a topic or an open idea, `/hub:plan` in Plan, and a structured plan: goal, approach, who does what, steps with size and `after`, flow, checks, risks, out of scope, questions, sources. `proposedPlanSchema` grew these as optional fields, so older plans still read. Save makes a draft plan, or turns the idea it started from into it. "Write it yourself" keeps the old form for a plan whose steps are known.
- **Skills**: `/hub:idea` and `/hub:plan` reply in at most three lines (the page holds the report), weigh the risks before writing, ask one question only when the work cannot go on, and keep untouched parts as they were on a refinement.

## Real cards, and questions as a deck (2026-11-10)

- **Saved text in the page's language**: `planToMarkdown` and `ideaToMarkdown` take the reader's words (`usePlanWords`, `useIdeaWords`). A step title over 200 characters ends at its last clause with an ellipsis (`fitStepTitle`).
- **One save record** for the panel's Save to Planning and the Plan Studio, by message: one plan is never saved twice.
- **Turn it into a plan** (Idea Studio) and **Plan it with Claude** (idea page) open the Plan Studio on that idea.
- **Open questions** (`reportQuestionSchema`): plain words, or `{text, options, recommended, why, multi}`. The page shows one question at a time with dots, the options as cards (one pick, or several when `multi`), the recommended option and why, a note on any pick, and Other for the owner's own words. Take the recommendations fills what is left; one Send carries every answer (`answersMessage`), read back in the conversation as the owner's answers.
- **Dev mode**: the API reads `@hub/contracts` from source but restarts only on its own files. After a contract change, restart Hub (`pnpm hub:service stop` then `start`) so the MCP tools serve the new shape.

## The plan page as a journey (v5-live-plan, batch 1 of 4, 2026-11-20)

The owner approved `apps/lab/hub/plan-page/v5-live-plan` (2026-11-19) and chose to port it in four batches. This is the first: phases in the data,
and the page without its live layer. Batch 2 (a run with Claude on the page: stages over SSE, Claude's card, the approval box, the activity feed,
the celebration), batch 3 (evidence on steps and the compare slider) and batch 4 (the Hams explainer video) are left out, not stubbed.

- **Phases are data** (`plan.phases[] { id, title, note? }`, `step.phaseId`, migration `0015_plan_phases`). Claude writes them with
  `create_plan` / `update_plan`; `get_plan` lists the steps under them. A step must name a phase of the plan, and a phase that steps still name
  cannot be removed in a save that leaves them there (`hub.plans.unknown_phase`, `hub.plans.phase_in_use`). The sheet's form edits phases
  (`sheet-sections/plan-phases.tsx`, `features/planning/phase-edit.ts`): add, rename, a note, reorder, remove, and each step's phase. Removing a
  phase that steps use asks where they go (another phase or none) and moves them in the same save, so the form never meets the 409. A new step
  joins the last phase.
- **All phases** starts folded except the phase holding the next step (owner, 2026-11-20).
- **A plan saved before phases** shows the head and one plain list, with no ring, map or roles chart, and a line saying how phases come.
- **Files:** `plan-page.tsx` (the page and its head), `journey-map.tsx`, `phase-focus.tsx` (the chapter, waffle, size and lock chips),
  `phase-list.tsx` (every phase, folding, around the existing `StepsTimeline`), `plan-charts.tsx` (ring, roles), `step-drawer.tsx`,
  `journey.css` (`pj-` classes and the eight phase tones), `features/planning/journey.ts` (groups, effort, blockers, estimate). The idea page
  keeps `detail.tsx`; what both pages share moved to `detail-shared.tsx`.
- **Effort** weighs S 1, M 3, L 8 (a step with no size is M). **The finish estimate** needs three dated done steps: Hub dates a step when it
  becomes done (`step.doneAt`, kept while it stays done, never invented for a step that arrives done), and the page falls back to the task's close
  time. With fewer, it is hidden.
- **Kept from the page before:** the action bar and the Claude buttons, the live mark, the idea it came from (`PathStrip`), the step's run menu,
  task status and evidence in the list, the plan text, evidence, runs, revisions, the outline and the facts. The stage track is gone: the status
  pill says the stage, as the version does.

## The live plan (v5-live-plan, batch 2 of 4, 2026-11-20)

Built only on what Hub already has, with no new event (`plan-live.tsx`, `features/planning/live-run.ts`):

- **Claude's run** is the member's agent queue: a `plan_step` run on this plan (its `planStep` is the step's place), or a `task` run on a step's task
  (the queue turns a step with a task into that task's run). Waiting runs come first, then the last started. The queue is read only where runs
  can happen (a page with the workbench), as the runs list is, and the stream rereads it on `queue.changed` and `chat.changed`.
- **The five stages** are the run's own `report_stage` reports, read from its chat turn (`stages` on the message), which `chat.event` keeps live.
  A task run reports them through `/hub:work`; a `plan_step` run's prompt now asks for them too (`runPrompt` in contracts).
- **Waiting for you** is the run's `waitingOn`. Approve and Deny answer the run's own approval on its chat (`POST chats/{id}/approvals/{id}`), the
  same route and the same 400 ms arming as the panel, with equal weight. A question is not answered here: the box opens the chat. With the
  device offline the buttons are off and say why.
- **The feed** is built from stored times (a run's start and end, the active turn's approvals and questions, `step.doneAt`, a phase's last
  `doneAt`), so a reload shows the same; "back online" is the only line only this page sees.
- **Halo** on the map stop of the running step's phase, the live row in the chapter (stages in place, the waffle cell ringed), the chapter
  following Claude whenever the running step or its phase changes (owner, 2026-11-20; never scrolling), the done-count running up, and a celebration when a phase completes while the page is open.
  Every loop and the confetti stop under reduced motion; the banner stays.
- **Not here:** the lab's simulation bar, Claude's per-step file and commit lines (Hub has no such event), a run's live note beyond the stage
  note, and other members' runs (the queue is each member's own; project-wide visibility of runs is a later batch, owner
  2026-11-20).
- **Owner's answers (2026-11-20):** Approve and Deny keep equal weight, every phase completion celebrates, a new step joins the last phase.

## Evidence on steps (v5-live-plan, batch 3 of 4, 2026-11-20)

- **Stored in the database:** an upload is a `card_attachments` row (kind `evidence`) with its bytes in `card_attachment_files` (migration
  `0016`), so a backup holds them with the card. A step names its files in `step.evidence` (attachment id, kind, caption, type, size,
  when and how it came); that list is Hub's, kept across every plan save, and the form never sends it.
- **Read from the bytes, then drawn again:** PNG, JPEG and WebP up to 8 MB, MP4 and WebM up to 40 MB, whatever the name or type says; SVG,
  HTML and the rest are refused (`hub.plans.evidence_type`). The byte checks are the first gate; then `sharp` (0.35.5, pinned) draws a picture
  again in its own type, so none of its metadata survives, applies its EXIF turn, caps it at 2560 wide and 16000 high (a full-page screenshot
  stays readable) and makes a 480 px WebP thumbnail for the grids (`…/file?size=thumb`). A clip is kept as it came.
- **Routes:** `POST /plans/{key}/steps/{stepId}/evidence` (multipart: `file`, `kind`, `caption`), `DELETE …/evidence/{attachmentId}`, and
  `GET /cards/{key}/attachments/{id}/file` (its own type only, `nosniff`, a CSP that runs nothing, a range for a clip). Adding is everyone's,
  like a work report (`plan.add_evidence`). The plan's owner, a pm and its creator remove any file (`plan.remove_evidence`); whoever added a
  file removes that one (`plan.remove_own_evidence`, judged on the file's `addedBy`).
- **Claude:** `add_step_evidence` takes a file's absolute path inside a registered project folder or a Hub worktree of one, read on the
  machine Hub runs on (links followed, then checked again); `remove_step_evidence` asks first in a bridge run. A plan step run's prompt asks for
  a screenshot when the step changes something a person sees.
- **Page:** the drawer's Evidence section, with its own picker (drop a file, or choose it; its name and size; a wrong type or size said at once) (before and after on one slider, by pointer or by keys in reading direction; each clip in a player;
  every picture in the lightbox; add and remove for who may), and the count on the step's row in the chapter.
- **Later batches:** reading evidence files from the team's paired machines through the bridge (today `add_step_evidence` reads only on the
  machine Hub runs on), and project-wide visibility of runs. A one-off failure of the plans, MCP and queue API e2e run together was seen once
  and not again in eight runs; it is noted, not chased further.
