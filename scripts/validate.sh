#!/usr/bin/env bash

################################################################################
# validate.sh - Whole-app stable-release validation gate
#
# Single source-of-truth gate that proves the cf workbench is a stable, working
# release built on top of the server execution engine, the consolidated UI, the
# e2e suite, and the docs. It ONLY orchestrates validation -- it never modifies
# any application code. It runs, end to end and failing on the first error:
#
#   1. Install the web dependencies      (npm install in web/, dev deps included)
#   2. Whole-app production build         (npm run build in web/)
#   3. Ensure the Playwright browser       (npx playwright install chromium)
#   4. Complete Playwright e2e suite       (npx playwright test in web/)
#
# The e2e suite drives the REAL Next.js production build against the REAL C++
# toolchain (no network mocking): every Run / Run-all / Stress action compiles
# and executes C++ in a tmp sandbox, so a green run validates macOS compilation,
# wall-clock timing, and verdict logic end to end.
#
# Usage:
#   bash scripts/validate.sh
#
# Exit status: 0 only if every phase succeeds; non-zero on the first failure.
################################################################################

set -euo pipefail

# ---------------------------------------------------------------------------
# Toolchain resolution.
#
# In the interactive zsh on this machine, bare `node`/`npm` are an nvm shell
# shim that does not exist for a non-interactive bash subprocess. Prepending the
# Homebrew bin directory makes node/npm/npx resolve to the real toolchain, while
# keeping /usr/bin on PATH so Apple clang (the C++ compiler the engine spawns)
# stays reachable.
# ---------------------------------------------------------------------------
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

# Force npm to install devDependencies (the e2e harness, @playwright/test, lives
# there). A CI/install run with NODE_ENV=production would otherwise omit it and
# the e2e phase could not start.
unset NODE_ENV || true

# ==================== OUTPUT HELPERS ====================

if [ -t 1 ]; then
    BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
    BLUE=''; GREEN=''; RED=''; YELLOW=''; NC=''
fi

print_header() {
    printf '%b\n' "${BLUE}========================================${NC}"
    printf '%b\n' "${BLUE}$1${NC}"
    printf '%b\n' "${BLUE}========================================${NC}"
}
print_step()    { printf '%b\n' "${BLUE}==> $1${NC}"; }
print_success() { printf '%b\n' "${GREEN}PASS: $1${NC}"; }
print_warning() { printf '%b\n' "${YELLOW}WARN: $1${NC}"; }
print_error()   { printf '%b\n' "${RED}FAIL: $1${NC}" >&2; }

# ==================== PATHS ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$REPO_ROOT/web"

# ==================== FAILURE REPORTING ====================

CURRENT_PHASE="startup"
on_error() {
    local exit_code=$?
    print_error "validation failed during: $CURRENT_PHASE (exit $exit_code)"
    print_error "The build is NOT a stable release until this passes."
    exit "$exit_code"
}
trap on_error ERR

# ==================== PREFLIGHT ====================

CURRENT_PHASE="preflight"
print_header "cf workbench - stable release validation gate"

if [ ! -d "$WEB_DIR" ]; then
    print_error "web/ directory not found at $WEB_DIR"
    exit 1
fi

command -v node >/dev/null 2>&1 || { print_error "node not found on PATH"; exit 1; }
command -v npm  >/dev/null 2>&1 || { print_error "npm not found on PATH"; exit 1; }
command -v npx  >/dev/null 2>&1 || { print_error "npx not found on PATH"; exit 1; }

# The engine compiles C++ at runtime; without a compiler the e2e suite cannot
# pass. Surface this early with a legible message instead of a deep test failure.
if command -v clang++ >/dev/null 2>&1; then
    CXX_FOUND="clang++"
elif command -v c++ >/dev/null 2>&1; then
    CXX_FOUND="c++"
elif command -v g++ >/dev/null 2>&1; then
    CXX_FOUND="g++"
else
    print_error "no C++ compiler (clang++/c++/g++) found; the engine cannot compile submissions"
    exit 1
fi

print_success "node $(node -v)  /  npm $(npm -v)  /  C++ compiler: $CXX_FOUND"
print_success "repo root: $REPO_ROOT"

cd "$WEB_DIR"

# ==================== PHASE 1: INSTALL ====================

CURRENT_PHASE="install web dependencies"
print_step "[1/4] Installing web dependencies (npm install, dev deps included)"
npm install --include=dev --no-audit --no-fund
print_success "dependencies installed"

# ==================== PHASE 2: PRODUCTION BUILD ====================

CURRENT_PHASE="production build (npm run build)"
print_step "[2/4] Building the whole app for production (npm run build)"
npm run build
print_success "production build succeeded"

# ==================== PHASE 3: BROWSER ====================

CURRENT_PHASE="install Playwright browser (chromium)"
print_step "[3/4] Ensuring the Playwright browser is installed (chromium)"
npx playwright install chromium
print_success "Playwright chromium ready"

# ==================== PHASE 4: END-TO-END SUITE ====================

CURRENT_PHASE="Playwright e2e suite (npx playwright test)"
print_step "[4/4] Running the complete Playwright e2e suite (npx playwright test)"
# The suite's webServer rebuilds + serves a production app and the specs hit the
# real /api/* routes, so this exercises macOS C++ compilation, timing, and
# AC/WA/TLE/RE/CE verdict logic with no mocking.
npx playwright test
print_success "e2e suite passed"

# ==================== DONE ====================

trap - ERR
print_header "VALIDATION PASSED"
print_success "Install + production build + full e2e suite all green."
print_success "The cf workbench is a stable, working release."
