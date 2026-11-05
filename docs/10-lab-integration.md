# 10 — Lab integration

> **Workbench release (docs/16 §6) wins over this document.** The lab is `apps/lab`, run by `pnpm start:local` on 7320 and served by Hub's own proxy at `/lab`, same origin, for signed-in members. There is no `LAB_URL`, no `.hub/lab.config.json` and no Caddy stage yet. A write changes the file with no commit. §2 and §3 below stay as the plan for a later hosted setup. The path table in §7 is applied by the owner, from the diff the Workbench slice prepared.

How the redesign lab (`F:\Goteav\redesign`) becomes `apps/lab` inside the Hub monorepo, how Hub
reads versions into `redesign` cards, how decisions flow back into the lab's front-matter, and how
the existing redesign agents keep working. The scanner algorithm itself is specified in
`06-capture-adapters.md` (lab adapter); this document owns the folder contract, the write-back and
the UX contract. The page UX is in `09-pages.md` §10.

## 1. Folder contract (unchanged from today)

```
apps/lab/
  lab/                          Vite root: index.html (gallery) · frame-web.html · frame-dashboard.html · src/{core,frame,shell,styles}
  shared/                       i18n.tsx · utils.ts · mocks/ · ui/
  _templates/page/README.md     page brief template
  _templates/version/{README.md,page.tsx,i18n.ts}
  web/<page>/README.md          page brief (front-matter: app, page, route, live-url, sources[], status: brief|researching|designing|decided|ported)
  web/<page>/research/          references.md, screenshots (not indexed by Hub)
  web/<page>/concepts.md        optional
  web/<page>/v1-baseline/       screenshots of the current page (status `reference`, never decided)
  web/<page>/v{n}-<idea>/       README.md (front-matter below) · page.tsx · parts/ · i18n.ts · review.md · shots/*.png
  dashboard/<page>/…            same
```

Version `README.md` front-matter (the lab registry already parses it; Hub parses the same):

```yaml
---
version: v2-flight-path
title: Flight path
status: draft            # draft | review | approved | rejected | ported
base: v1-baseline
created: 2026-10-27
tokens: inherit          # inherit | override
touches-components: []   # list of real shared components the port would change
ported:                  # "<branch>@<sha> (<repo>)" once ported
# fields written by Hub (optional, additive):
hub-card: GTV-258        # the redesign card key
decision-note: ""        # owner's note on approve / reject
decided-at: 2026-11-12T09:30:00Z
decided-by: Mohamed
---
```

`review.md` first table (`| Pillar | Score /10 |`) is parsed for the review score: the mean of the
pillar scores × 10, rounded (e.g. 7.6 → 76), and the "One-line verdict" column of the first row is
not used; the review summary is the first paragraph after the table or the first two "Owner goals"
bullets, truncated to 280 chars. If `review.md` has a `score:` front-matter key it wins.

## 2. Moving `F:\Goteav\redesign` into the monorepo

Step by step (H0 task, executed on the owner's machine, no history rewrite needed because the
folder is not a Git repository today):

1. In the `hub` repo: `git mv`-equivalent copy of `F:\Goteav\redesign\*` to `apps/lab/` excluding
   `node_modules/`, `dist/`, `.vite/`, `*.log` and every `**/review/` capture folder (the ux-critic's
   raw Playwright captures; `review.md` and `shots/` stay).
2. `apps/lab/package.json`: name `@hub/lab`; scripts `dev: vite --port 7320`, `build: vite build
   --base=/lab/`, `preview: vite preview --port 7320`, `typecheck`, `test: vitest run` (new, for the
   front-matter parser). Dependencies unchanged; add `gray-matter` **only** to `apps/api` (the lab
   keeps its own `core/frontmatter.ts`).
3. `apps/lab/vite.config.ts`:
   - replace the two constants with a resolver:
     ```ts
     const cfg = readJsonIfExists(path.resolve(ROOT, '.hub/lab.config.json')) ?? {};
     const WEB_SRC  = path.resolve(ROOT, process.env.LAB_WEB_SRC  ?? cfg.sources?.web  ?? '../../../Goteav/web/src');
     const DASH_SRC = path.resolve(ROOT, process.env.LAB_DASH_SRC ?? cfg.sources?.dashboard ?? '../../../Goteav/Goteav-Dashboard/src');
     ```
   - `server.port = 7320`, `strictPort: true`, `server.fs.allow` includes both resolved roots.
   - `base` from the CLI flag (`/lab/` in build; `/` in dev) — the gallery's hash routes are
     unaffected, the frame URLs are built relative to `import.meta.env.BASE_URL`.
   - Keep `projectAlias()` and `watchVersions()` as they are.
4. Commit `apps/lab/.hub/lab.config.json.example` with the two paths; `.hub/lab.config.json` itself
   is gitignored (per machine). Developers with the standard layout (`F:\Goteav\{web,Goteav-Dashboard,hub}`)
   need no config file because the defaults above resolve to the sibling checkouts.
5. `apps/lab/README.md` and `PLAN.md`: replace `F:/Goteav/redesign` with `apps/lab` (in the hub
   repo), port `6200` with `7320`, and add a "Hub" section pointing here.
6. Root `.gitignore` additions for the lab: `apps/lab/node_modules`, `apps/lab/dist`,
   `apps/lab/.vite`, `apps/lab/**/review/`, `apps/lab/.hub/lab.config.json`.
7. Leave `F:\Goteav\redesign` in place until the import (§4) is verified, then delete it (owner
   confirms; the `goteav-redesign-lab` memory and the agents are updated per §7).

Publication: the lab is published **as part of the `hub` repository** (D14); there is no separate
lab repository. `git log` history starts at the move commit; the old folder had none.

## 3. Serving

- Production (host): the `lab` image builds `apps/lab` with `vite build --base=/lab/` after cloning
  `Alremaal-Co/Goteav` and `Alremaal-Co/Goteav-Dashboard` at build time into the paths the config
  expects (`LAB_WEB_SRC`, `LAB_DASH_SRC` build args), copies `dist/` into a volume that Caddy serves
  at `/lab/*` with `file_server` and SPA fallback for `index.html`, `frame-web.html`,
  `frame-dashboard.html`. Exact Dockerfile and build args: `13-operations.md` §5. The **same
  volume** also exposes the raw version folders (`README.md`, `review.md`, `shots/`) so Caddy can
  serve `/lab/web/wallet/v2-flight-path/shots/desktop-ar-light.png` (the `CardAttachment.url`
  format) — the build stage copies `web/` and `dashboard/` trees minus `page.tsx`/`parts/` into
  `dist/`.
- The API reads the lab **source** tree (not `dist`) from the host clone of the hub repo mounted at
  `/repos/hub` (`Source.config.root = apps/lab`); front-matter writes go to that clone (§6).
- Development: `pnpm --filter @hub/lab dev` on 7320; Hub's web app links to
  `NEXT_PUBLIC_LAB_URL` (`http://localhost:7320/` in dev, `/lab/` in production). The compare dialog
  builds frame URLs as `${LAB_URL}frame-<app>.html#/<page>/<version>?w=…&lang=…&theme=…&notes=…`.
- Rebuild trigger on the host: `infra/scripts/update.sh` rebuilds the lab image when
  `apps/lab/**` changed in the pulled commit; screenshots and READMEs change far more often than the
  gallery code, so the raw-folder copy is a cheap stage and the Vite build is cached by layer.

## 4. Importing the current versions

Run once by the lab adapter (`POST /sources/{lab}/run` with `{ mode: 'import' }` or automatically on
the first scan of a source with an empty cursor):

| Page | Versions found today | Imported status |
| --- | --- | --- |
| `web/wallet` | `v1-baseline` (reference), `v2-flight-path` … `v7-twin-tanks` | front-matter rewritten to `status: draft` for every version except those with `status: ported`; `v1-baseline` stays `reference` (no card status change, card created with `status: reference`) |
| `dashboard/finance-currencies` | `v1-baseline`, `v2-rich-table-panel` (`ported`) | `v2` keeps `ported` (O7 default); card created with `status: ported`, `portedRef` from the front-matter `ported:` line |

For each version a `redesign` card is created (`externalKey = lab:<app>/<page>/<version>`,
`source = lab`, `createdByKind = system`, `createdVia = adapter`) with the title
`"<app>/<page> · <version> — <title>"`, body = README content after the front-matter, attachments
from `shots/*.png` and any `*.png` next to the README, `reviewScore`/`reviewSummary` from
`review.md`, and an event `created` with `data.importedFrom = "F:/Goteav/redesign"`. The import
also creates the page brief as a `doc` card (`kind: other`, path `apps/lab/<app>/<page>/README.md`)
so the brief is searchable. The import writes `hub-card: <key>` into each version's front-matter
(one commit, §6) so the mapping is visible in Git.

Owner re-approval: every imported `draft` is decided again from Hub (D14). Versions that were
`review`/`approved` in the old folder are listed in the import summary so the owner can move them to
`review` quickly (bulk "Send to review" action on the Redesign page, designer/owner).

## 5. Reading: scanner contract

The lab adapter (`06-capture-adapters.md`) scans `apps/lab/{web,dashboard}/*/*/README.md` every
minute on the host (and through `chokidar` in dev). Per version it computes
`readmeHash = sha256(README.md)` and compares with `RedesignDetail.readmeHash`:

- new folder → create card (status from front-matter; `v1-baseline` → `reference`);
- hash changed → update `frontMatter`, `title`, `base`, `touchesComponents`, body; if
  `status` changed in the file and differs from the card → apply the transition as `system` with
  event `status_changed {reason: 'lab'}` (this is how a designer moving a version to `review` by
  editing the file shows up in Hub);
- `review.md` added/changed → update score/summary, event `field_changed {field: 'review'}`;
- `shots/` changed → sync attachments (add/remove rows, never delete the files);
- folder removed → card `archived` with event `archived {reason: 'lab_folder_removed'}` (D17: the
  card stays).

Precedence rule: **the file is the source of truth for `status`**; Hub never holds a status the
file does not. Hub actions first write the file (§6) and only then emit the event; if the write
fails the action fails (`409 hub.redesign.write_failed`).

## 6. Writing back: Hub → front-matter

Actions and what they write (all through `RedesignService.writeFrontMatter(version, patch)`, which
rewrites only the front-matter block with `gray-matter` and preserves the body byte-for-byte):

| Action (API) | Who | File change | Card change |
| --- | --- | --- | --- |
| `approve {note?}` | `owner`, human | `status: approved`, `decision-note`, `decided-at`, `decided-by` | status `approved`, event `approved`, port task created (§8), inbox to `designer` + `frontend` |
| `reject {note}` | `owner`, human | `status: rejected`, `decision-note`, `decided-at`, `decided-by` | status `rejected`, event `rejected`, inbox to `designer` |
| `request_changes {note}` | `owner`, human | status stays `review`; appends under `## Review notes` a line `- <date> <name>: <note>` (creates the heading if missing) | event `changes_requested`, inbox to `designer` |
| `send_to_review` | `designer`, `frontend`, `owner`, `pm` | `status: review` | status `review`, event `status_changed`, inbox to `owner` |
| `mark_ported {ref}` | `frontend`, `pm`, `owner` | `status: ported`, `ported: <ref>` | status `ported`, event `ported`, page brief `status: ported` when all approved versions are ported (brief README front-matter) |
| import / card creation | system | `hub-card: GTV-nnn` | — |

Git mechanics on the host clone `/repos/hub` (bare-minimum, status-only edits):

- Identity: `user.name = hub-bot`, `user.email = hub-bot@goteav.local`; pushes over HTTPS with a
  fine-grained token that has **contents: write on the `hub` repository only** (stored on the hub
  source, `Source.secretEnc`).
- Sequence per write: `git fetch origin main && git reset --hard origin/main` (the clone is
  read-only for humans) → edit the file → `git add apps/lab/<path>/README.md` → `git commit -m
  "lab(<app>/<page>): <version> → <status> [GTV-nnn]"` → `git push origin HEAD:main`.
- Conflict strategy: on push rejection, retry the whole sequence up to 3 times with a fresh reset;
  on the third failure the action fails with `409 hub.redesign.write_failed` and nothing is
  changed in Hub. Writes are serialised by a Redis lock `lab:write` (one writer at a time).
- Direct commits to `main` are deliberate: the edits are machine-generated, single-file, and
  reviewed implicitly by the Hub action (owner clicked). Branch protection on `hub` must allow
  `hub-bot` to push to `main` (or the owner creates a rule exception).
- The lab scanner sees its own commit on the next run and finds the hash equal to what Hub wrote
  (`readmeHash` updated in the same transaction), so no duplicate event is emitted.

## 7. Keeping the redesign tooling working

Exact path strings to change (owner's machine, outside the repos):

| File | Current string | New string |
| --- | --- | --- |
| `~/.claude/skills/redesign-workflow/SKILL.md` line 3 (description) | `F:/Goteav/redesign` | `F:/Goteav/hub/apps/lab` |
| same, line 8 | `` Lab root: `F:/Goteav/redesign/` `` | `` Lab root: `F:/Goteav/hub/apps/lab/` `` |
| same, line 17 | `redesign/<app>/<page-slug>/` | `apps/lab/<app>/<page-slug>/` |
| same, line 57 | `` `F:/Goteav/redesign/lab` — `pnpm dev` serves the gallery on http://localhost:6200 `` | `` `F:/Goteav/hub/apps/lab` — `pnpm dev` serves the gallery on http://localhost:7320 `` |
| `~/.claude/agents/redesign-director.md` line 3 | `(F:/Goteav/redesign)` and `Edits files only inside F:/Goteav/redesign.` | `(F:/Goteav/hub/apps/lab)` / `Edits files only inside F:/Goteav/hub/apps/lab.` |
| same, line 11 | `` Write only inside `F:/Goteav/redesign/` `` | `` Write only inside `F:/Goteav/hub/apps/lab/` `` |
| `~/.claude/agents/redesign-porter.md` line 3 | `from F:/Goteav/redesign into the real project` | `from F:/Goteav/hub/apps/lab into the real project` |
| same, line 18 | `` `redesign/<app>/<page>/<version>/port-plan.md` `` | `` `apps/lab/<app>/<page>/<version>/port-plan.md` `` |
| `~/.claude/agents/ux-critic.md` line 14 | `http://localhost:6200/#/<app>/<page>/<version>` | `http://localhost:7320/#/<app>/<page>/<version>` (or the host `https://hub.goteav.lan/lab/#/…`) |
| `~/.claude/agents/visual-researcher.md` line 9 | `redesign/<app>/<page>/research/` | `apps/lab/<app>/<page>/research/` |
| memory `goteav-redesign-lab.md` | `F:/Goteav/redesign`, port 6200 | updated by the owner's assistant after the move |

New conventions the skill gains (append to `SKILL.md`):

- Statuses `approved`/`rejected`/`ported` are set **from Hub** (owner) or by `mark_ported`; the
  agents only move `draft → review` (by editing the file or `hub.update_card`); the team pack's
  `/hub:redesign-review <app>/<page>/<version>` prompt calls `hub.card_action('send_to_review')`.
- `redesign-porter` is launched from the port task (§8) and reads the task prompt first.
- Version folders are never renamed after the card exists (`externalKey` is the path).

## 8. Port task auto-creation

On `approve`, `RedesignService` creates a `task` card:

- `title`: `Port <app>/<page> <version> — <concept title>`
- `specialty`: workspace setting `lab.port_task_specialty` (default `frontend`); `effort` from
  `touches-components` length (0–1 → `M`, 2–4 → `L`, ≥ 5 → `XL`); `priority` `P1`;
  `origin: redesign_port`; `ownerRole` = the role mapped from the specialty; status `ready`.
- links: `relates` → the redesign card; `blocked_by` → none.
- `acceptance` (markdown): "- [ ] impact map written to `apps/lab/<path>/port-plan.md`\n- [ ] every
  component in touches-components ported with i18n + RTL + dark\n- [ ] typecheck, lint, tests green\n
  - [ ] side-by-side screenshots vs the lab version attached to the PR\n- [ ] `mark_ported` called with
  the branch@sha".
- `prompt` (template `digests/templates/port-task.md`, rendered in English):

```
You are porting an owner-approved redesign version into the real project.
Load the `redesign-workflow` skill and act as `redesign-porter`.

Version: apps/lab/<app>/<page>/<version>   (Hub card <GTV-redesign>, this task <GTV-task>)
Target project: <web = F:/Goteav/web | dashboard = F:/Goteav/Goteav-Dashboard>
Real route: <route from the page brief>   Source files: <sources[] from the page brief>
Owner's note: "<decision-note>"
Shared components this version touches (from touches-components):
- <item>
…
Steps: 1) write the impact map (port-plan.md) and call hub.update_task({key, body: <summary>}) 2) ask the owner (hub.request_decision) before widening scope to other pages 3) implement on a feature branch — ask before creating it 4) run typecheck/lint/tests 5) attach screenshots in the PR 6) call hub.card_action({key: <GTV-redesign>, action: 'mark_ported', ref: '<branch>@<sha> (<repo>)'}) and hub.update_task({key, status: 'in_review', prUrl}).
```

The redesign card gets `portTaskId`; the task sheet shows the redesign chip and "Open in lab".

## 9. UX contract (summary; details in `09-pages.md` §10 and `08` §5.4)

- Gallery grouped by page, versions as cards with screenshot, status badge, review score, concept
  title; "Compare" selects two; sheet shows attachments, touches-components, review summary, and
  the owner's actions with required notes.
- Approve/Reject/Request changes are owner-only (permission depends on the role, not the actor kind, D27); all other members see them
  disabled with a tooltip.
- The lab itself (`/lab/`) stays the place to *look* at a version at real size; Hub embeds it only
  in the compare dialog.

## 10. Tests

| Level | Test |
| --- | --- |
| unit (`apps/api`) | front-matter parser round-trips every README under `apps/lab` fixtures (byte-identical body, keys preserved in order); review score from a sample `review.md` = 76; status transition table for `redesign`. |
| unit (`apps/lab`) | `core/frontmatter.ts` parses the extended keys (`hub-card`, `decision-note`) without breaking the gallery. |
| worker (`apps/api`, Testcontainers) | scanner on a temp copy of two pages: creates 9 cards with the expected statuses; editing a README to `status: review` emits `status_changed {reason: lab}`; deleting a folder archives the card; re-running is idempotent (0 created, 0 updated). |
| integration | `approve` writes `status: approved` + note into the temp README, commits with `hub-bot`, creates the port task with the rendered prompt containing the version path and every touches-components item; a simulated push rejection retries 3 times then fails with `hub.redesign.write_failed` and leaves the card unchanged. |
| CI | `pnpm --filter @hub/lab build` (with the two Goteav repos checked out by the workflow) and `typecheck` must pass; the gallery `index.html` and both frames exist in `dist/`. |
| e2e (Playwright) | flow 5 of `09-pages.md` §20: open Redesign → compare → approve → badge + task + file. |
