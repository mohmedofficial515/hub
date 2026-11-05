#!/bin/sh
# One-shot before the api starts: applies migrations, then the first owner if HUB_OWNER_EMAIL is set. Safe to run again.
set -e
pnpm prisma:deploy
if [ -n "$HUB_OWNER_EMAIL" ] && [ -n "$HUB_OWNER_PASSWORD" ]; then
  NODE_ENV=development pnpm seed:owner
else
  echo "HUB_OWNER_EMAIL or HUB_OWNER_PASSWORD is empty: no owner seeded."
fi
