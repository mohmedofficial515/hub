# shared/ui

Lab-only primitives that do not exist in either project yet (import as `@lab/ui/<file>`).

Prefer the real primitives first — they are imported live:

- public site: `@web/components/ui/<name>` (button, dialog, tabs, select, table, …)
- dashboard: `@dash/components/ui/<name>` (button, card, badge, input, sheet, table, …)

Only leaf primitives under `components/ui` are safe to import. Anything that uses `next/*`,
`next-intl`, react-query or the BFF will not run in the lab.

A primitive created here is a proposal: when its version is ported, it moves into the project's
`components/ui` and is listed in the version's `touches-components`.

## Hub helpers

- `hub-cn.ts` — `cn()` for Hub versions: registers Hub's named text sizes (`text-caption` … `text-display`)
  with tailwind-merge, which otherwise drops them when a `text-<colour>` class follows.
