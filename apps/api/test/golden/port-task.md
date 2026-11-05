# Port approved redesign web/wallet/v2-flight-path (GTV-261)

The owner approved version `v2-flight-path` of `web/wallet` in the lab (http://localhost:6200/#/web/wallet/v2-flight-path). Decision note: Keep the header.
Touches shared components: `Button`, `Card`

## What to do
1. Read the version README and review.md in `web/wallet/v2-flight-path` under the lab root.
2. Use the `redesign-porter` agent workflow: produce the impact map of every shared component this version changes and every page that uses them, then implement on a feature branch in `web` (ask the owner before creating the branch).
3. Keep i18n (ar/en), RTL, light/dark; wire real data; typecheck; tests; side-by-side screenshots against the lab version.
4. When merged, call `hub.mark_redesign_ported` with the branch@commit reference and log your session.
