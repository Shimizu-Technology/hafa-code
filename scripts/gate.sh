#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Hafa Code gate =="
echo "-- lint"
npm run lint

echo "-- build"
npm run build

echo "-- audit production deps"
npm audit --omit=dev --audit-level=high

echo "Gate passed."
