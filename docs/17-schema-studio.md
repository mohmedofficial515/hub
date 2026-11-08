# 17. Schema Studio

The Database page under **Admin** (`/<locale>/<project>/schema`) is where the team sees the project's database design, names it in Arabic, and changes it through drafts that Claude reviews and applies.

## 1. What the owner asked for (2026-11-08)

- A page in the admin area for the backend, showing the project's database design.
- An Arabic name and description for every table, column and enum.
- Propose changes: add, improve, split. One press sends them to Claude, who reviews them, discusses them and applies them.
- After that, the page shows the new design. A Refresh button reads it again by hand.

## 2. Decisions

| # | Decision |
| --- | --- |
| D61 | The design is read from a project's Prisma files, through a **schema source**: one of the project's folders (`repoPaths`) and the schema folder inside it. The first source is the Goteav backend (`F:/Goteav/backend`, `prisma/schema`). A second source, such as Hub's own schema, needs no change to the page. |
| D62 | Arabic names, descriptions, notes, tags and sensitivity live in Hub (`schema_annotations`), keyed by target name: `model:Booking`, `field:Booking.status`, `enum:X`, `enumValue:X.Y`. They are written into the files as `///` comments when a draft is applied. An annotation counts as synced when its Arabic name appears in its target's `///` text after a refresh. |
| D63 | A draft is reviewed and applied in a **live panel chat**. It starts in Plan, in the source's folder: Claude reads, reviews and discusses, and edits nothing. When the owner switches to Execute, Claude saves the review, edits the files, writes the names, creates the migration with `--create-only`, runs the checks, and calls `refresh_schema` with the draft. The D41 approvals still pause sensitive steps. |
| D64 | The bridge reads the files with `schema.read`, a read-only action. It only reads `.prisma` files directly in a relative folder inside an allowlisted folder. When the folder is on the API's own machine, the API reads it itself by the same rule. |

## 3. How it works

- **Reading.** A refresh reads the files, parses them (`apps/api/src/modules/schema-studio/domain/prisma-parse.ts`) and keeps a snapshot only when the files' hash changed, up to 50 snapshots. Each snapshot stores what changed against the one before it (`snapshot-diff.ts`).
- **Relations.** Declared relations come from `@relation`. A column named after a model (`userId` beside `User`) with no `@relation` is shown as an **implied** relation, drawn dashed. Goteav has 68 declared and 67 implied.
- **Draft statuses.** `editing → in_review → applying → applied`, or `discarded`. Moves are checked by `canMoveDraft` in `packages/contracts/src/schema-studio.ts`.
- **Routes** (`/workspaces/:ws/schema`):

  | Route | What it does | Access |
  | --- | --- | --- |
  | `GET /` | The design, its names and its drafts | Read |
  | `PUT /source` | Set the source | Session only |
  | `POST /refresh` | Read the files again | |
  | `GET /snapshots` | The history | Read |
  | `PUT /annotations` | Save names and notes | |
  | `POST /drafts` | Start a draft | Session only |
  | `GET\|PATCH /drafts/:id` | Read or change a draft | |
  | `POST /drafts/:id/review` | Send a draft to review | Session only |
  | `POST /drafts/:id/chat` | Link the review's chat | Session only |

- **Permissions.** `schema.read` is for everyone. `schema.annotate`, `schema.draft` and `schema.manage` are for the owner, the pm and the backend.
- **MCP tools.** `get_schema`, `get_schema_draft`, `refresh_schema`, `update_schema_draft` and `set_schema_annotations`. In Plan, the writing tools are denied by D41.
- **Live updates.** Every change publishes `schema.changed`, and the page rereads it.

## 4. The page

The owner asked on 2026-11-09 for a page with less on it: a full-screen workspace like a design tool's, where the map is the page, responds to zoom, and is smooth, with a side panel that opens only when needed. The page follows that request.

- **Full screen.** By default the workspace covers Hub's sidebar and header, and sits under Hub's dialogs, toasts and tooltips. The full-screen button on the end bar leaves full screen or comes back to it, and coming back also asks the browser for full screen. A press that reaches Claude (Review and apply, Suggest Arabic names) leaves full screen first, because Claude answers in the panel beside the page.
- **Two floating bars on top.** The start bar holds:
  - the layers button (L);
  - the title, with the source and how many tables;
  - the three views: Map, Dictionary and Enums.

  The end bar holds Search (`/`), Suggest Arabic names, Refresh design, the side panel (I) and full screen. On a phone the two bars stack.
- **Map** (React Flow). It fills the window.
  - Domains are quiet zones and tables are neutral cards.
  - Hovering a table, or selecting it, lights its relations and fades the rest. One generated stylesheet paints this, so no table redraws.
  - A selected table wears a frame with corner handles and a label with its column count.
  - Double-click focuses on a table and its neighbours. A dragged table keeps its place in this browser.
- **Semantic zoom** (`data-zoom` and `--schema-zinv` on the canvas, again with no redraw):
  - **near**: every column.
  - **mid**: the column types fade.
  - **far**: a table is its name. Domain names stand above their zones and grow against the zoom, and implied relations step back.
  - **map**: tables are blocks with their domain's dot, and only the domains are named.
- **Toolbar** at the bottom. It shows the zoom out and zoom in buttons, the zoom level (a press fits the map) and Fit, then switches for all columns, Arabic or code names, implied relations, the 3D view, the minimap, and Arrange again. Its last item is the draft pill, with the draft's status and count. Keys: Shift+1 or F fits, 0 is 100%, + and − zoom, T tilts, M toggles the minimap.
- **3D view** (T). The map tilts in perspective: domains lie flat, tables float above them, and a hovered or selected table rises higher. Dragging is off while tilted.
- **Layers** (L). They float over the start side.
  - Each domain shows its colour, its table count and a coverage ring.
  - A domain opens to its tables, and pressing a table opens it and brings it to the middle of the map.
  - The eye shows or hides a domain, and "Only this" isolates it.
  - The layers take focus when they open, and Escape gives focus back to their toggle.
- **Side panel** (I). It floats over the end side, closed until needed, with three tabs:
  - **Details:** what is selected (table, column or enum), edited in place, with what the files say, its relations, its indexes and Propose a change. When nothing is selected, it says how to select something.
  - **Overview:** the source and its version, the counts, Arabic-name coverage overall and by domain, Suggest Arabic names, Write names to the files, the most connected tables, the legend, the design's versions and the closed drafts.
  - **Draft:** the open draft's changes in order, which you can edit, reorder or remove, and "Review and apply with Claude".
- **Dictionary and Enums.** These are the same as before, under the bars.
- **Surfaces (owner, 2026-11-08, review B3).** Hub's own:
  - every card and bar is one neutral surface with one neutral border;
  - a domain shows as its small coloured dot and a quiet zone;
  - no row is tinted, nothing has a gradient, and no shadow is deeper than `shadow-md`;
  - the selection frame uses the focus-ring colour.
- **Keyboard (review B2, M9).**
  - `/` (or Ctrl+Shift+K) opens the page's search, not the global palette.
  - Tab order runs through the bars, the toolbar, then the tables.
  - Enter or Space on a table opens it in the panel, and a table reached by Tab far out is brought close.
  - Opening from search, the dictionary or a table moves focus to the panel's heading. Escape closes it and gives focus back.

## 5. Out of the first release

- Hub's own schema as a second source.
- Editing the design by dragging on the canvas.
- Comment threads on tables.
- Live row data.
