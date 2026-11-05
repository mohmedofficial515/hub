# shared/mocks

Typed fixture data for versions (import as `@lab/mocks/<domain>`), one file per domain:
`flights.ts`, `bookings.ts`, `customers.ts`, …

- Shape fixtures like the real API models (see `web/openapi` and `Goteav-Dashboard/openapi`),
  so a ported version swaps the import for a real hook without reshaping data.
- Include realistic edge cases: long Arabic names, missing optional fields, zero/one/many items,
  large amounts and multiple currencies.
- No network calls. Export plain data plus small helpers (`delay`, `paginate`) when a version
  needs to show loading or paging states.

`hub-app/` is the Hub app's card catalogue (`@lab/mocks/hub-app`), built on `hub-today.ts`. A page adds its own data as
`hub-app/<domain>.ts`, not by editing that index.
