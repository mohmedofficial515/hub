# Goteav Redesign Lab — Plan

Status: **Phase 0 + 1 done (2026-10-27)** · next: Phase 2 when the owner names a page

Moved into Hub as `apps/lab` on 2026-11-06 (`docs/16-workbench.md` §6). A sandbox where pages of the public site (`web/`) and the
dashboard (`Goteav-Dashboard/`) are redesigned as numbered versions, compared, reviewed,
and only after explicit approval ported into the real projects.

## Owner decisions (2026-10-27)

| Topic | Decision |
|---|---|
| Lab tech | One Vite + React 19 + TS + Tailwind v4 app (`lab/`), versions are TSX folders auto-discovered by a gallery |
| Tokens | Live import of `web/src/app/globals.css` and `Goteav-Dashboard/src/app/globals.css`; a version may override tokens locally |
| Version naming | `v{n}-{idea}` (`v1-baseline`, `v2-split-view`); status in each version README |
| Gallery | Side-by-side compare · device sizes · AR-RTL / EN-LTR · light / dark · status & notes |
| Pages | Structure + templates only; pages are added on request |
| Tooling scope | Global (`~/.claude`) so it also works inside `web/` and the dashboard |
| Agents | redesign-director · ux-critic · redesign-porter · visual-researcher |
| Skills | Design skills · browser control · shadcn + docs · design research |

## Phase 0 — Tooling (global)

| Item | What | Install |
|---|---|---|
| ui-ux-pro-max | Styles, palettes, font pairings, UX rules, stack guidance (needs Python) | `nextlevelbuilder/ui-ux-pro-max-skill` → `~/.claude/skills/ui-ux-pro-max` |
| frontend-design | Anthropic skill for bold, non-generic UI | `claude plugin install frontend-design@claude-plugins-official` |
| web-design-guidelines | Vercel UI / a11y review rules (+ react-best-practices) | `vercel-labs/agent-skills` → `~/.claude/skills` |
| Playwright MCP | Drive the browser, click, screenshot, responsive runs | `claude plugin install playwright@claude-plugins-official` |
| Chrome DevTools MCP | Perf traces, console, computed styles, element boxes | `claude mcp add -s user chrome-devtools -- npx chrome-devtools-mcp@latest` |
| shadcn MCP | Browse / pull components from shadcn registries | `claude mcp add -s user shadcn -- npx shadcn@latest mcp` |
| context7 | Current docs for Tailwind v4, Next 15/16, framer-motion, radix | `claude plugin install context7@claude-plugins-official` |
| design-research (custom) | Collect references + patterns for a page type before designing | `~/.claude/skills/design-research` |
| redesign-workflow (custom) | The conventions of this folder: create page/version, statuses, review, port checklist | `~/.claude/skills/redesign-workflow` |

Every third-party skill is read in full before it is installed.

### Agents (`~/.claude/agents/`)

| Agent | Role | Edits files? |
|---|---|---|
| `visual-researcher` | References from leading products for the page type → `research/` | writes research notes only |
| `redesign-director` | Reads the current page, proposes 2–3 distinct concepts, builds the chosen ones as versions, documents decisions | yes, inside `redesign/` only |
| `ux-critic` | Opens a version in the browser (desktop / mobile / RTL / dark), screenshots, scores hierarchy, a11y, RTL, flow | no — writes `review.md` |
| `redesign-porter` | After approval: maps affected shared components and pages, applies the version to the real page | yes, real project, on a branch |

## Phase 1 — Lab scaffold

```
redesign/
  PLAN.md  README.md
  lab/                     Vite app: gallery (index.html) + one frame per app (frame-web / frame-dashboard)
    src/styles/            web.css / dashboard.css → @import the real globals.css (live)
  shared/
    ui/                    lab-only new primitives (real ones come from @web/* and @dash/*)
    mocks/                 typed fixtures shaped like the OpenAPI models
    i18n.tsx, utils.ts     useT() / cn()
  web/<page>/...           public-site pages
  dashboard/<page>/...     dashboard pages
  _templates/              page + version templates
```

- Each version renders in an iframe that loads only its app's tokens (both apps define the same `:root`
  variables), at the real device width so breakpoints fire, scaled to fit the gallery.
- Real primitives are imported live: `@web/components/ui/*`, `@dash/components/ui/*` (their internal `@/`
  imports resolve to the right project).
- Fonts: the `--font-*` variables set by `next/font` are re-declared in the lab via Google Fonts.
- No `next/*`, `next-intl`, react-query or BFF in versions: data comes from `shared/mocks`, text
  from a tiny `t()` helper with `ar` / `en` dictionaries per version.
- `v1-baseline` = screenshots of the current page (desktop / mobile / RTL) taken with Playwright,
  plus an optional live `iframe` of the running dev server for side-by-side.
- Gallery reads `README.md` front-matter for status and notes.

## Phase 2 — Per-page workflow

1. **Brief** — owner names the page → `README.md` of the page: real route, source files, problems, goals.
2. **Baseline** — `v1-baseline/` screenshots + list of components the page uses.
3. **Research** — `visual-researcher` → `research/references.md`.
4. **Concepts** — `redesign-director` proposes 2–3 concepts (text + rough wireframe); owner picks.
5. **Build** — each picked concept becomes `v{n}-{idea}/`.
6. **Review** — `ux-critic` → `v{n}-{idea}/review.md`; fixes become a new version, never overwrite.
7. **Decision** — owner sets `approved` / `rejected`.

## Phase 3 — Porting (only on explicit request)

1. `redesign-porter` lists every shared component the version changes and every page using it.
2. Owner confirms scope; affected pages get their own redesign entries if needed.
3. Port on a feature branch in the real project; i18n + RTL guards, typecheck, tests, screenshots vs version.
4. Version status → `ported`, with branch / commit noted.

## Rules

- Visual changes to real pages happen only through an approved version (see preserve-design rule).
- Versions are immutable once in `review`; changes create the next version.
- Code + docs in English; conversation in Arabic.
