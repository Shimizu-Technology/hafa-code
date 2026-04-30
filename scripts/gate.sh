#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="$HOME/.rbenv/shims:$PATH"

echo "== Hafa Code gate =="

echo "-- web install check"
test -d web/node_modules || npm --prefix web install

echo "-- web lint"
npm --prefix web run lint

echo "-- web build"
npm --prefix web run build

if [ -d api ]; then
  echo "-- api tests"
  (cd api && bundle exec rails test)
fi

echo "-- audit production deps"
npm --prefix web audit --omit=dev --audit-level=high

echo "Gate passed."
