#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
for toolchain_shims in "$HOME/.nodenv/shims" "$HOME/.rbenv/shims"; do
  if [ -d "$toolchain_shims" ]; then
    PATH="$toolchain_shims:$PATH"
  fi
done
export PATH

echo "== Hafa Code gate =="

echo "-- web install check"
test -d web/node_modules || npm --prefix web install

echo "-- web lint"
npm --prefix web run lint

echo "-- web tests"
npm --prefix web test

echo "-- web build"
npm --prefix web run build

reset_classroom_fixtures() {
  exit_code=$?
  trap - EXIT
  echo "-- reset classroom fixtures"
  if ! (cd api && RAILS_ENV=test DATABASE_URL="${E2E_DATABASE_URL:-postgresql:///hafa_code_e2e}" bundle exec rails e2e:reset); then
    echo "Classroom fixture reset failed." >&2
    if [ "$exit_code" -eq 0 ]; then
      exit_code=1
    fi
  fi
  exit "$exit_code"
}

trap reset_classroom_fixtures EXIT

echo "-- classroom browser tests"
npm --prefix web run test:e2e

if [ -d api ]; then
  echo "-- api tests"
  (cd api && bundle exec rails test)
fi

echo "-- audit all web deps"
npm --prefix web audit --audit-level=high

echo "Gate passed."
