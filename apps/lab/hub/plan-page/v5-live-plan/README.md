---
version: v5-live-plan
title: Live plan
status: ported
base: v4-plan-story
created: 2026-11-19
tokens: override
touches-components: [apps/web/src/components/planning/detail.tsx (live badge, Claude card, effort and estimate, video section, live feed, step drawer), apps/web/src/components/planning/detail-parts.tsx (JourneyMap halo and moving selection, PhaseFocus live rows, PlanRing by effort), apps/web/src/lib/sse.ts (plan events on the page), features/planning/model.ts (effortOf, blockersOf, finishEstimate), packages/contracts/src/cards/plan.ts (phases, evidence, explainer), packages/contracts/src/events.ts (run_stage)]
ported:
---

# Live plan

v4-plan-story (ring, journey map, chapter, phase tones), made live with Claude, with evidence on steps, dependencies, effort, a
finish estimate and an explainer video. Motion is rich on purpose (owner's choice on 2026-11-19) and all of it stops under
`prefers-reduced-motion`.

Open: `http://127.0.0.1:7320/lab/frame-hub.html#/plan-page/v5-live-plan?lang=ar&theme=dark&scenario=live`.

Scenarios (`&scenario=`):
- `live`: Claude runs step 10 (recorded events, autoplay after 1.2 s). The lab bar at the bottom plays, pauses, sets 1×/2×/4×,
  finishes the phase, drops the connection and starts over.
- `midway`: the plan as it stands, video ready, no run.
- `default`: GTV-472 at 0 of 50.
- `many`: 20 phases (the video starts as "not made", since the lab film has 9 phase chapters).
- `legacy` (or `empty`): a plan saved before phases exist. It shows the header and one plain list, with no ring, map or video. This is
  how every old plan will look until it has phases.
- `loading`, `error`.

## What is on the page

1. **Header.** Live badge ("Live", or "Reconnecting…" with a turning dot). The ring is weighted by effort (S 1, M 3, L 8). The numbers
   count up when a step finishes. "Effort 24 of 160 points" and "Estimated finish …" have tooltips that explain how each is worked out.
2. **Claude at work.** While a run is on, Claude's card takes the place of the next-step callout. It shows the step, five stages
   (Understand, Plan, Execute, Verify, Report) on a track that fills, what Claude is doing now (the line slides when it changes) and
   for how long. When Claude needs a command approved, the card turns amber with Approve and Deny. If you deny, the run stops at Execute
   with a failed mark.
3. **Map.** A dashed halo turns around the phase Claude works in, with a small Claude badge. The selection ring moves between stops
   (framer `layoutId`). Stops pop in one after another on load. A finished phase turns into a check with a spring, and its stretch of
   the path draws itself.
4. **Chapter.** It slides in from the side you moved towards. The running step carries its stages in place. A blocked step shows a
   lock and "Waits for step 11". A finished step pops its check and flashes once, and its waffle square pops. Pointing at a square
   outlines the squares it depends on. Steps show their size (S/M/L) and their evidence count. Any step opens the drawer.
5. **Step drawer** (from the page's end edge, spring). It holds: why the step exists, the acceptance checks, "Depends on" and "Opens
   the way to" (each links to that step), Claude's stages when it is running, and the evidence. The evidence is a before / after
   compare with a drag handle (keyboard: arrows, Home, End, with a sweep to the middle on first show), the clip, and the screenshots in
   the lightbox. "Run with Claude" adds the step to the queue (a toast in the lab).
6. **Explainer video, made by Hams** (`F:/tools/hams`). It has a chapter per phase plus an intro, with Arabic captions. While it
   plays, the current chapter is marked and its phase lights up on the map. States:
   - Not made: "Ask for an explainer".
   - Asking: the Hams panel opens in place.
   - Making: five stages. Claude writes the script, the voice is made with the chosen voice, Hams builds the scenes, Hams renders,
     and chapters and captions are added.
   - Ready: shows "Hams · style · voice · aspect", with "Open the project in Hams" and "Make it again" (it reopens the panel with the
     last choices).

   **The panel** uses native radios, so arrows move within each group:
   - **Style:** hand-drawn whiteboard (recommended), animated slides, motion graphics, kinetic text, numbers and charts, mixed.
   - **Voice:** **Google (Gemini TTS) by default** with its eight voices (`Charon` by default), Hams' local voice (VoiceTut on the
     graphics card, nothing leaves the machine), or no narration.
   - Dialect (Egyptian by default, or simple Modern Standard), aspect (16:9, 9:16, 1:1), length (a chapter per phase, or about a
     minute) and captions.
   - A plain sentence on what is sent to Google.

   The step drawer also has "Ask for a video explaining this step" (Hams with the Google voice; a toast in the lab).
7. **Live activity** at the top of the side column. Entries slide in with a layout animation: started, commit, approval asked,
   approved or denied, evidence, step done, phase complete, back online. They show "now" or "12s ago".
8. **Phase complete.** Confetti in the phase tones and a banner that springs in and leaves after about 4 s (banner only under reduced
   motion).

Colour: phases keep their tones. Claude is the kit primary (cyan): halo, stages, live row. Waiting for the owner is the kit warning
(amber), so phase tone 2 moved from amber to olive to keep the two apart.

## What Hub needs for the port

| Need | Today | To add |
|---|---|---|
| Live updates on the page | SSE stream `/workspaces/{ws}/events/stream` with `plan_steps_changed`, `work_reported`, `commit`, `pr_opened` | Subscribe on the plan page; refetch the card on those kinds |
| Claude's stages on a plan step | `report_stage` reaches the chat only; the queue runs `plan_step` sources | Link a run to its plan and step. Publish a NEW card event `run_stage { stepId, stage, state, note }` and `run_waiting { command }` on the plan card |
| Approve / deny from the page | Approvals live in the inbox and the chat panel | The same decision endpoint, called from the card |
| Phases | Body text only | `plan.phases[]`, `planStep.phaseId` (as v2 proposed) |
| Size, dependencies, why, acceptance | **Exist**: `size`, `after`, `why`, `acceptance` on steps | Nothing; the page reads them |
| Finish estimate | Step `done` follows its task, with no date | `planStep.doneAt` (or read the task's completion time) |
| Evidence on steps | `card_attachments` exists, written only by the lab scanner | Image / video upload `POST /cards/{key}/attachments` (re-encoded, size cap); NEW `planStep.evidence[{ attachmentId, kind: before\|after\|video, caption }]`; an MCP way for Claude to attach a screenshot when it finishes a step |
| Explainer video | none | NEW `plan.explainer { attachmentId, captionsId, chapters[{ phaseId\|null, start }], revision, request }`, made by Hams (below). Hub stores and plays it |
| Explainer defaults | none | A project setting `explainer.defaults` = the panel's choices. **Voice `google`, `Charon`** by default |

## Hams integration (for the port)

Hams (`F:/tools/hams`, «همس») is a local video platform: a HyperFrames studio (API on 4701), a voice studio (4610), a local Egyptian
TTS (VoiceTut, 7860), Google Gemini TTS, and Claude inside every project. Hub does not make video itself; it asks Hams.

1. **Request.** Hub's API calls Hams `POST /api/projects` with wizard answers built from the plan and the panel:

   | Hub field | Hams answer |
   |---|---|
   | Plan title | `name`, and `nameEn` for the folder `<topic>-<YYYYMMDD>` |
   | Body and phases | The idea text, and `script[]`: one line per chapter (an intro, then one per phase) with the phase id in the line id |
   | `style` | `whiteboard` → category `whiteboard`. Otherwise category `explainer` with the video type `slides`, `motion`, `kinetic`, `data` or `mixed` (Hams' `VIDEO_TYPES`) |
   | `voice` | `voice.mode`: `google` (default, with `voiceName`), `voicetut`, or `none` |
   | `dialect` | `voice.dialect` |
   | `aspect` | `aspect` (`landscape`, `portrait`, `square`) |
   | `captions` | On-screen captions |

2. **Produce.** `POST /api/p/<id>/produce` starts Claude in the project. With `google`, Hams' brief tells Claude to use Gemini TTS:
   - Model `gemini-3.8-flash-tts`, falling back to `gemini-3.8-flash-lite-tts` on a 429.
   - The free tier allows 3 requests a minute and 10 a day, so a plan should be voiced in one request per part.
   - The key is the user env var `GEMINI_API_KEY`. It is set on this machine, and Hub never reads or stores it.

   Hub follows `GET /api/p/<id>` (stages) or the SSE `GET /api/p/<id>/stream`, and shows them as the five making stages.
3. **Render and bring back.**
   - `POST /api/p/<id>/render` renders the video, and Hub copies the mp4 from `renders/` into the card's attachments.
   - Chapters come from the line timings: the start of each phase's first scene (`chapters.json` of the film: `{ phase, title, start }`).
   - Captions come from the script lines and their timings, as WebVTT.
4. **Where it runs.** Hams runs on the owner's machine, as Hub does. A run is a queue job of a new source `explainer` (one at a time,
   counted in the daily runs). "Open the project in Hams" links to `http://127.0.0.1:4700/projects/<id>` for edits in Hams' own editor
   (timeline, script tab, re-voicing a line).
5. **Privacy.** With the Google voice, only the script text goes to Google. With VoiceTut nothing leaves the machine. The panel says so.

## Demo data (not from the plan)

All marked in `parts/demo.ts`:
- **Sizes:** a fixed cycle.
- **Dependencies:** read from the step titles.
- **Why and acceptance:** written for steps 10 and 11 only.
- **`doneAt`:** one a day for the nine done steps.
- **Evidence:** the v2 rail ("before") and the v3 rail ("after") from this lab session, not screenshots of the website.
- **Explainer video** (`media/video`): a real Hams film of GTV-472 (3:14, 1080p), made with `engine/plan-film` in Hams
  (`node engine/plan-film/build.mjs gtv-472 voice|build|render|export`). Egyptian narration by Gemini TTS (voice `Charon`, one
  request); every scene drawn with the pattern its content needs (`engine/plan-film/PATTERNS.md`): the audit's real screenshots of
  the site in a browser (the white 404, the results with no sort), the real files of `F:/Goteav/web` in a VS Code window, the real
  lab, the real `loyalty_accounts` columns and `nextTier.remainingSpendUsd` field, the design audit's real counts (171 gradient lines
  falling to 7 over five batches), whiteboards for the decisions and the assist tools, a wireframe for navigation. The calendar API is
  a proposal and its prices and the table's rows are examples; the film says so on screen. `plan-explainer.chapters.json` gives each
  chapter's real start (intro, phases 0–8, close); `plan-explainer.ar.vtt` is cut from Whisper's word times.
- **Live script** (`parts/live.ts`): the commit, file, command and "42 tests passed" are invented for the demo.

## Key decisions

- **Phrases are stored as keys**, not text. Claude's note and every feed entry are rendered with the page's words when shown, so
  switching the language mid-run updates them (tested: Arabic, then English, during an approval).
- **The live layer never moves the page by itself.** Only the chapter follows Claude when a run starts in another phase; the page does
  not scroll.
- **Screen readers:**
  - The Claude card is a region.
  - Its note and the feed are `aria-live="polite"`.
  - The approval box is `role="alert"`.
  - The stages are a list, each with its state in words.
  - The waffle and ring stay pointer shortcuts, hidden from screen readers.
- **On a phone** only the running stage keeps its word on screen, so the stage track fits in 390 px.
- **Lab only:**
  - The simulation bar (dashed border, its own title).
  - The video making is simulated.
  - The elapsed time pauses while Claude waits for you, because the clock is the simulation's own.
- **Layout and sizes in CSS.** Utilities Tailwind did not emit for a new folder live in `story.css` and `live.css` as `ps-*` classes.

## Verification

- Playwright, end to end in `live` at 4×:
  - Claude starts.
  - The stages advance.
  - Approval is asked, and Approve continues the run.
  - The step finishes: evidence arrives, the next step moves to 11, and step 14 stays locked behind 11.
  - The drawer opens, the compare slider moves with the arrows (50 to 54), and Esc closes the drawer.
  - "Finish the phase" plays the celebration banner ("Phase 1 complete"), which leaves by itself, and the feed holds 11 entries.
- The deny path stops at Execute. Changing the language mid-run updates the note and the feed.
- Video: the Hams film, 194.5 s, 11 chapters at their real starts; picking "أساس نظام التصميم" plays from 1:17 and marks it, one captions track is loaded, no page errors.
- Hams panel:
  - The defaults are whiteboard, Google, `Charon`, Egyptian, 16:9, a chapter per phase.
  - The arrows move the style radio, and picking `Kore` carries into the stage "Making the voice with Google: Kore".
  - The ready line reads "همس · شرائح متحركة · Google: Kore · عرضي 16:9".
  - No overflow at 390 px.
- 390 px: no horizontal overflow during the approval or with the drawer open.
- `tsc --noEmit` over every version: clean. `pnpm lab:check`: 43 versions compile. No physical direction classes or hex in TSX.
- Not done:
  - An independent `ux-critic` review.
  - A contrast check of the new olive tone: same formula as the other tones, not measured.

Shots in `shots/`: `live-2-approval`, `live-3-step-done`, `live-4-drawer`, `live-5-celebration`, `live-6-after-phase`,
`video-chapter`, `1440-ar-dark-midway` (full page), `1440-en-light-live`, `1440-en-light-denied`, `1440-ar-dark-legacy`,
`390-ar-light-approval`, `390-ar-light-drawer`, `hams-request`, `hams-making`, `390-hams-request`.

## Open questions

1. **Approving from the page:** should Approve here act directly, or open the same approval sheet as the inbox (with the full command and
   the folder)?
2. **Following a run:** should the chapter keep following the step Claude works on, or stay where the owner left it?
3. **Video freshness:** should a new revision of the plan mark the Hams video as out of date and offer "Make it again"?
4. **The celebration:** keep it at every phase, or only at the last phase and the finish line?
