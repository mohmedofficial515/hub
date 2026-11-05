# Goteav Redesign Lab

Sandbox for redesigning pages of the public site and the dashboard. See [PLAN.md](PLAN.md).

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
pnpm install      # once
pnpm dev          # http://localhost:6200
pnpm typecheck
```

- `#/<app>/<page>/<version>?w=390|768|1440|fill&lang=ar|en&theme=light|dark&notes=1`
- `#/compare/<app>/<page>/<a>/<b>?…` — side by side
- `#/<app>/_tokens/preview` — live token preview of each project
- Each version renders in an iframe that loads only its app's `globals.css`, so breakpoints are real.
- Real primitives: `@web/components/ui/*`, `@dash/components/ui/*`; lab helpers: `@lab/i18n`, `@lab/utils`,
  `@lab/mocks/*`, `@lab/ui/*`.
- Baseline screenshots named `<width>-<rtl|ltr>-<light|dark>.png` follow the toolbar mode.
- Set `live-url` in the page README to show the running real page as a `live` entry.

Port 6200 (6071–6170 is reserved by Windows on this machine).

## Version status

`draft` → `review` → `approved` | `rejected` → `ported`

A version is not edited after it enters `review`; changes go into the next `v{n}`.
