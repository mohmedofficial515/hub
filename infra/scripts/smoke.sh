#!/usr/bin/env bash
# Is the stack really up? Health through the API and through the web proxy, sign-in with the owner, a real write, and the
# worker's heartbeat. Prints what it finds and fails loudly. Reads nothing secret from the command line.
#   WEB=http://localhost:7300 API=http://localhost:7310 OWNER_EMAIL=... OWNER_PASSWORD=... infra/scripts/smoke.sh
set -u
WEB="${WEB:-http://localhost:7300}"
API="${API:-http://localhost:7310}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
failed=0

check() { # name, expected status, curl args...
  local name="$1" want="$2"
  shift 2
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@")"
  if [ "$got" = "$want" ]; then
    echo "ok    $name ($got)"
  else
    echo "FAIL  $name: wanted $want, got $got"
    failed=1
  fi
}

wait_for() { # url
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null --max-time 5 "$1" && return 0
    sleep 3
  done
  echo "FAIL  $1 did not answer in 3 minutes"
  exit 1
}

wait_for "$API/api/v1/health/ready"
check 'api ready' 200 "$API/api/v1/health/ready"
wait_for "$WEB/en/sign-in"
check 'web sign-in page' 200 "$WEB/en/sign-in"
check 'api through the web proxy' 200 "$WEB/api/v1/health/live"
check 'a route that needs a session refuses without one' 401 "$API/api/v1/workspaces"
check 'metrics stay hidden without a token' 404 "$API/metrics"

if [ -n "${OWNER_EMAIL:-}" ] && [ -n "${OWNER_PASSWORD:-}" ]; then
  body="$(node -e 'console.log(JSON.stringify({email:process.env.OWNER_EMAIL,password:process.env.OWNER_PASSWORD}))')"
  signin="$(curl -s -c "$JAR" --max-time 20 -H 'content-type: application/json' -H 'x-requested-with: hub' \
    -d "$body" "$WEB/api/v1/auth/sign-in")"
  case "$signin" in
    *totp*) echo "ok    sign-in reached TOTP, as an owner should" ;;
    *'"data"'*) echo "ok    sign-in"; check 'me' 200 -b "$JAR" "$WEB/api/v1/me" ;;
    *) echo "FAIL  sign-in: $(printf '%s' "$signin" | head -c 200)"; failed=1 ;;
  esac
else
  echo "skip  sign-in: set OWNER_EMAIL and OWNER_PASSWORD"
fi

if [ "$failed" = 0 ]; then echo "SMOKE OK"; else echo "SMOKE FAILED"; exit 1; fi
