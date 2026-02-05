#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CF_SCRIPT="$PROJECT_ROOT/scripts/cf"
FIXTURE_DIR="$PROJECT_ROOT/tests/fixtures/231A"

if [ ! -f "$CF_SCRIPT" ]; then
    printf '%s\n' "Error: cf script not found: $CF_SCRIPT" >&2
    exit 1
fi

if [ ! -f "$FIXTURE_DIR/problem.txt" ] || [ ! -f "$FIXTURE_DIR/solution.cpp" ]; then
    printf '%s\n' "Error: fixture files missing in $FIXTURE_DIR" >&2
    exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cp "$FIXTURE_DIR/problem.txt" "$TMP_DIR/problem.txt"
cp "$FIXTURE_DIR/solution.cpp" "$TMP_DIR/solution.cpp"

pushd "$TMP_DIR" > /dev/null

printf '%s\n' "Running parser sample #1..."
bash "$CF_SCRIPT" problem.txt > /dev/null

printf '%s\n' "Running parser sample #2 (positional)..."
bash "$CF_SCRIPT" problem.txt 2 > /dev/null

printf '%s\n' "Running parser sample #2 (--sample)..."
bash "$CF_SCRIPT" --sample 2 > /dev/null

popd > /dev/null

printf '%s\n' "Parser tests passed."
