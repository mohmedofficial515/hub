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

- **Header.** The source and when it was read, the counts, the Arabic-name coverage, and how many names are not in the files yet. Actions: Search (`/`), Suggest Arabic names, Write names to the files, Refresh design.
- **Domains.** One per Prisma file, each with a colour, its table count and a coverage ring. You can show, hide or isolate a domain, or ask Claude to name it.
- **Diagram** (React Flow).
  - Each domain is a quiet zone with its coloured dot, and each table shows its Arabic or code name and its key columns (or all of them).
  - Hovering or selecting a table lights up its relations and fades the rest. Double-clicking focuses on a table and its neighbours.
  - Dragging a table keeps it there in this browser.
  - Zoomed far out, the domain names grow so the map stays readable.
  - It also has a minimap, a legend, marks for what changed in the last version, and ghost marks for what the draft proposes. The minimap and the legend step aside while a table is open, and fitting or centring keeps clear of the toolbar and the dock.
- **Inspector.** For a table, a column or an enum: the Arabic fields, saved on blur; what the files say; the relations both ways; indexes; and Propose a change.
- **Dictionary.** Every column in one table that you can search and filter, with the Arabic name edited in place. It exports as Markdown.
- **Enums.** Each enum with its values, each value named on its own.
- **History.** The versions of the design with what changed, and the closed drafts with Claude's review.
- **Draft dock.** The changes in order, which you can edit, reorder or remove. Its button is "Review and apply with Claude". While Claude reviews or applies it, a status pill says so.
- **Surfaces (owner, 2026-11-08, review B3).** Hub's own: every card is one neutral surface with one neutral border, a domain shows as its small coloured dot, no row is tinted, nothing has a gradient, no shadow is deeper than `shadow-md`. What changed in the last version is a sparkle icon, a proposed change a small badge or icon.
- **Keyboard (review B2, M9).** `/` (or Ctrl+Shift+K) opens the page's search, not the global palette. The diagram's toolbar comes before its tables in Tab order; Enter or Space on a table opens it in the inspector, and a table reached by Tab far out is brought close. Opening from search, the dictionary or a table moves focus to the inspector's heading; Escape closes it and gives focus back. Below 68rem the domains are a drawer that takes focus and closes on Escape.

## 5. Out of the first release

- Hub's own schema as a second source.
- Editing the design by dragging on the canvas.
- Comment threads on tables.
- Live row data.
