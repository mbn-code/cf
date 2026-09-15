#!/usr/bin/env bash

################################################################################
# check.sh - Fast local quality gate (what CI runs, minus the browser suite)
#
#   1. shellcheck on every shell script
#   2. CLI test suite            (tests/cli_test.sh, real compiler)
#   3. web: lint + typecheck     (eslint, tsc --noEmit)
#   4. web: unit tests           (vitest, real compiler)
#   5. web: production build     (next build)
#
# Usage:
#   bash scripts/check.sh            # everything
#   bash scripts/check.sh --quick    # skip the production build
#   bash scripts/check.sh --no-web   # shell + CLI only
#
# For the full end-to-end gate (Playwright against a production build) run
# scripts/validate.sh instead.
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$REPO_ROOT/web"

QUICK=0
WEB=1
for arg in "$@"; do
    case "$arg" in
        --quick) QUICK=1 ;;
        --no-web) WEB=0 ;;
        -h|--help) sed -n '3,20p' "$0"; exit 0 ;;
        *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
    esac
done

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    BLUE=''; GREEN=''; RED=''; YELLOW=''; NC=''
fi

step()    { printf '%b\n' "${BLUE}==> $1${NC}"; }
ok()      { printf '%b\n' "${GREEN}PASS: $1${NC}"; }
warn()    { printf '%b\n' "${YELLOW}WARN: $1${NC}"; }
fail()    { printf '%b\n' "${RED}FAIL: $1${NC}" >&2; exit 1; }

STARTED=$(date +%s)

# ---- 1. shellcheck ----------------------------------------------------------

step "[1/5] shellcheck"
SHELL_FILES=(
    "$REPO_ROOT/scripts/cf"
    "$REPO_ROOT/scripts/check.sh"
    "$REPO_ROOT/scripts/test.sh"
    "$REPO_ROOT/scripts/validate.sh"
    "$REPO_ROOT/tests/cli_test.sh"
)
if command -v shellcheck >/dev/null 2>&1; then
    # Windows checkouts may carry CRLF; lint an LF copy so the verdict matches CI.
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    for f in "${SHELL_FILES[@]}"; do
        name=$(basename "$f")
        tr -d '\r' < "$f" > "$tmp/$name"
    done
    (cd "$tmp" && shellcheck -s bash ./*) || fail "shellcheck reported issues"
    ok "shellcheck clean (${#SHELL_FILES[@]} files)"
else
    warn "shellcheck not installed; skipping"
fi

# ---- 2. CLI tests ---------------------------------------------------------------

step "[2/5] CLI test suite"
bash "$REPO_ROOT/tests/cli_test.sh" | tail -1 || fail "CLI tests failed"
ok "CLI tests passed"

if [ "$WEB" -eq 0 ]; then
    ok "done in $(( $(date +%s) - STARTED ))s (web checks skipped)"
    exit 0
fi

# ---- 3. web lint + typecheck ---------------------------------------------------

cd "$WEB_DIR"
command -v npm >/dev/null 2>&1 || fail "npm not found; install Node.js 20+"
if [ ! -d node_modules ]; then
    step "installing web dependencies"
    npm install --include=dev --no-audit --no-fund
fi

step "[3/5] web lint + typecheck"
npm run --silent lint || fail "eslint reported issues"
npm run --silent typecheck || fail "typecheck failed"
ok "lint + typecheck clean"

# ---- 4. unit tests -----------------------------------------------------------------

step "[4/5] web unit tests (vitest)"
npm run --silent test || fail "unit tests failed"
ok "unit tests passed"

# ---- 5. production build ----------------------------------------------------------

if [ "$QUICK" -eq 1 ]; then
    warn "skipping production build (--quick)"
else
    step "[5/5] production build"
    npm run --silent build > /dev/null || fail "next build failed"
    ok "production build succeeded"
fi

# ---- version consistency ---------------------------------------------------------

CLI_VERSION=$(sed -n 's/^CF_VERSION="\(.*\)"$/\1/p' "$REPO_ROOT/scripts/cf" | tr -d '\r')
PKG_VERSION=$(node -p "require('./package.json').version")
if [ "$CLI_VERSION" != "$PKG_VERSION" ]; then
    fail "version mismatch: scripts/cf says $CLI_VERSION, web/package.json says $PKG_VERSION"
fi
ok "version $PKG_VERSION consistent across CLI and web"

ok "all checks passed in $(( $(date +%s) - STARTED ))s"
