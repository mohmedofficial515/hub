# Contract change GTV-255 — breaking (1 breaking, 1 notable, 1 info)

The backend OpenAPI contract changed on branch `feat/wallet` (https://github.com/example/backend/compare/aaaaaaa1111111...bbbbbbb2222222).
Source commits: GTV-250.

## Changes
- [BREAKING] `DELETE /wallet/{id}` — removed
- [NOTABLE] `GET /wallet` — new field (optional)
- [INFO] `GET /health` — description changed

## What to do
1. In `Goteav-Dashboard`: run `pnpm api:sync` (regenerates the client from the backend's `openapi.json`), then `pnpm typecheck` and fix every type error the regeneration surfaces.
2. In `web`: run `pnpm api:sync` and `pnpm typecheck`; fix the affected features.
3. For each **breaking** entry above, find every call site of the operation (search the generated client's operationId) and update request/response handling; add or adjust tests.
4. Run `pnpm check` in both projects.
5. When done, call `hub.acknowledge_handoff`/`hub.apply_handoff` for GTV-255 (or mark it applied in Hub) and log your session with `hub.log_session`, listing the files changed.
Do not change the backend. If a change cannot be applied without a backend fix, open a handoff back to `backend` with `hub.create_handoff` describing it.
