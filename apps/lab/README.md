# Goteav Redesign Lab

Sandbox for redesigning pages of the public site and the dashboard. See [PLAN.md](PLAN.md). It lives in Hub as `apps/lab`: Hub's Redesign page shows it
as its Gallery view, and Hub serves it at `/lab` (`docs/16-workbench.md` §6).

## Layout

```
web/<page-slug>/                 public site page (slug = route, e.g. flights-search)
dashboard/<page-slug>/           dashboard page (e.g. bookings-list)
  README.md                      page brief (route, sources, problems, goals)
  research/                      references and notes
  v1-baseline/                   current page: screenshots + component inventory
  v2-<idea>/                     a redesign version
    README.md                    front-matter status + decisions
    page.tsx                     entry rendered by the lab
    parts/                       version-local components
    i18n.ts                      ar / en strings
    review.md                    ux-critic report
_templates/                      copy these to start a page or a version
```

## Running the lab

```
pnpm start:local            # from the Hub root: Hub and the lab together
pnpm --filter @hub/lab dev  # only the lab: http://localhost:7320/lab/
pnpm lab:check              # names any version that does not compile
pnpm --filter @hub/lab typecheck:versions  # slow: every version and the sibling projects
```

- `#/<app>/<page>/<version>?w=390|768|1440|fill&lang=ar|en&theme=light|dark&notes=1`
- `#/compare/<app>/<page>/<a>/<b>?…` — side by side
- `#/<app>/_tokens/preview` — live token preview of each project
- Each version renders in an iframe that loads only its app's `globals.css`, so breakpoints are real.
- Real primitives: `@web/components/ui/*`, `@dash/components/ui/*`; lab helpers: `@lab/i18n`, `@lab/utils`,
  `@lab/mocks/*`, `@lab/ui/*`.
- Baseline screenshots named `<width>-<rtl|ltr>-<light|dark>.png` follow the toolbar mode.
- Set `live-url` in the page README to show the running real page as a `live` entry.

Port 7320 (`LAB_PORT`). The sibling projects are found by `LAB_WEB_SRC` and `LAB_DASH_SRC`, by default next to the Hub checkout, and the lab only reads them.

## Version status

`draft` → `review` → `approved` | `rejected` → `ported`

A version is not edited after it enters `review`; changes go into the next `v{n}`.
