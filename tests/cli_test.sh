#!/usr/bin/env bash
#
# tests/cli_test.sh - end-to-end tests for the `cf` command-line tool.
#
# Every case runs the real script against the real compiler in a throwaway
# directory, so a green run proves statement parsing, sample comparison, the
# checkers, stress testing and templating actually work on this machine.
#
# Usage: bash tests/cli_test.sh        (exit 0 = all cases passed)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CF="$PROJECT_ROOT/scripts/cf"
FIXTURE_DIR="$PROJECT_ROOT/tests/fixtures/231A"

export NO_COLOR=1
export CF_NO_EDITOR=1
export CF_NONINTERACTIVE=1

if [ ! -f "$CF" ]; then
    printf '%s\n' "Error: cf script not found: $CF" >&2
    exit 1
fi
if [ ! -f "$FIXTURE_DIR/problem.txt" ] || [ ! -f "$FIXTURE_DIR/solution.cpp" ]; then
    printf '%s\n' "Error: fixture files missing in $FIXTURE_DIR" >&2
    exit 1
fi

TMP_DIR="$(mktemp -d)"
# Keep the build cache inside the sandbox so tests never touch the real one.
export CF_BUILD_CACHE_DIR="$TMP_DIR/.cache"
trap 'rm -rf "$TMP_DIR"' EXIT

PASSED=0
FAILED=0
OUT=""

run_cf() {
    # Capture combined output and exit status without aborting the suite.
    set +e
    OUT=$(bash "$CF" "$@" 2>&1)
    STATUS=$?
    set -e
}

check() {
    local name="$1"
    local ok="$2"
    if [ "$ok" -eq 0 ]; then
        printf 'ok   %s\n' "$name"
        PASSED=$((PASSED + 1))
    else
        printf 'FAIL %s\n' "$name"
        printf '%s\n' "$OUT" | sed 's/^/     | /' | head -40
        FAILED=$((FAILED + 1))
    fi
}

expect_status() {
    local name="$1" want="$2"
    [ "$STATUS" -eq "$want" ]; check "$name (exit $want)" $?
}

expect_contains() {
    local name="$1" needle="$2"
    printf '%s' "$OUT" | grep -qF -- "$needle"; check "$name contains '$needle'" $?
}

expect_not_contains() {
    local name="$1" needle="$2"
    local found=0
    printf '%s' "$OUT" | grep -qF -- "$needle" && found=1
    check "$name lacks '$needle'" "$found"
}

# ---- version / help -------------------------------------------------------

run_cf version
expect_status "cf version" 0
expect_contains "cf version" "cf "

run_cf help
expect_status "cf help" 0
expect_contains "cf help" "stress"

run_cf
expect_status "cf with no args outside a problem" 1

# ---- statement parsing on the real fixture --------------------------------

mkdir -p "$TMP_DIR/231A"
cp "$FIXTURE_DIR/problem.txt" "$FIXTURE_DIR/solution.cpp" "$TMP_DIR/231A/"
pushd "$TMP_DIR/231A" > /dev/null

run_cf problem.txt
expect_status "run sample #1" 0
expect_contains "run sample #1" "Output matches expected"

run_cf problem.txt 2
expect_status "run sample #2 (positional)" 0
expect_contains "run sample #2 (positional)" "Output matches expected"

run_cf --sample 2
expect_status "run sample #2 (--sample)" 0

run_cf --sample 9
expect_status "run out-of-range sample falls back" 0
expect_contains "run out-of-range sample" "only 2 found"

run_cf test
expect_status "cf test in problem dir" 0
expect_contains "cf test" "Passed: 2"
expect_contains "cf test" "Max time:"

run_cf samples
expect_status "cf samples" 0
expect_contains "cf samples" "2 sample(s)"
expect_contains "cf samples" "1 1 0"

run_cf "3\n1 1 1\n1 1 1\n1 1 1"
expect_status "inline input" 0
expect_contains "inline input" "3"

popd > /dev/null

# `cf test <dir>` from outside the directory
run_cf test "$TMP_DIR/231A"
expect_status "cf test <dir> from outside" 0

# An explicit argument must win over the cwd's problem.txt
mkdir -p "$TMP_DIR/other"
printf 'Examples\nInput\n1\nOutput\n2\n' > "$TMP_DIR/other/problem.txt"
cat > "$TMP_DIR/other/solution.cpp" <<'EOF'
#include <iostream>
int main(){int x;std::cin>>x;std::cout<<x*2<<"\n";}
EOF
pushd "$TMP_DIR/other" > /dev/null
run_cf test "$TMP_DIR/231A"
expect_status "explicit problem beats cwd" 0
expect_contains "explicit problem beats cwd" "231A"
popd > /dev/null

# ---- wrong answer, runtime error, timeout ---------------------------------

mkdir -p "$TMP_DIR/wa"
printf 'Examples\nInput\n1\nOutput\n5\n' > "$TMP_DIR/wa/problem.txt"
cat > "$TMP_DIR/wa/solution.cpp" <<'EOF'
#include <iostream>
int main(){std::cout<<"4\n";}
EOF
run_cf test "$TMP_DIR/wa"
expect_status "wrong answer fails" 1
expect_contains "wrong answer" "FAILED"
expect_contains "wrong answer shows diff" "Diff:"

cat > "$TMP_DIR/wa/solution.cpp" <<'EOF'
#include <cstdlib>
int main(){std::abort();}
EOF
run_cf test "$TMP_DIR/wa"
expect_status "runtime error fails" 1
expect_contains "runtime error" "Runtime Error"

if command -v timeout >/dev/null 2>&1 || command -v gtimeout >/dev/null 2>&1; then
    cat > "$TMP_DIR/wa/solution.cpp" <<'EOF'
int main(){for(;;){}}
EOF
    run_cf test "$TMP_DIR/wa" --timeout 1
    expect_status "timeout fails" 1
    expect_contains "timeout" "timeout"
fi

cat > "$TMP_DIR/wa/solution.cpp" <<'EOF'
int main(){ return x; }
EOF
run_cf test "$TMP_DIR/wa"
expect_status "compile error fails" 1
expect_contains "compile error" "Compilation failed"

# ---- checkers ---------------------------------------------------------------

mkdir -p "$TMP_DIR/tok"
printf 'Examples\nInput\n1\nOutput\n1 2 3\n' > "$TMP_DIR/tok/problem.txt"
cat > "$TMP_DIR/tok/solution.cpp" <<'EOF'
#include <cstdio>
int main(){puts("1\n2\n3");}
EOF
run_cf test "$TMP_DIR/tok"
expect_status "lines checker rejects layout difference" 1

run_cf test "$TMP_DIR/tok" --checker tokens
expect_status "tokens checker accepts layout difference" 0

CF_CHECKER=tokens run_cf test "$TMP_DIR/tok"
expect_status "CF_CHECKER env selects tokens" 0

pushd "$TMP_DIR/tok" > /dev/null
run_cf problem.txt
expect_status "run reports whitespace-only mismatch" 1
expect_contains "run whitespace hint" "only whitespace differs"
popd > /dev/null

run_cf test "$TMP_DIR/tok" --checker bogus
expect_status "unknown checker is rejected" 2

# ---- stress -----------------------------------------------------------------

mkdir -p "$TMP_DIR/st"
printf 'Examples\nInput\n2 3\nOutput\n5\n' > "$TMP_DIR/st/problem.txt"
cat > "$TMP_DIR/st/solution.cpp" <<'EOF'
#include <iostream>
int main(){long long a,b;std::cin>>a>>b;std::cout<<(a+b>1500?a+b-1:a+b)<<"\n";}
EOF
cat > "$TMP_DIR/st/brute.cpp" <<'EOF'
#include <iostream>
int main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<"\n";}
EOF
cat > "$TMP_DIR/st/gen.cpp" <<'EOF'
#include <iostream>
#include <random>
#include <cstdlib>
int main(int c,char**v){std::mt19937 r(c>1?atoi(v[1]):0);std::cout<<r()%1000<<" "<<r()%1000<<"\n";}
EOF
run_cf stress "$TMP_DIR/st" -n 300
expect_status "stress finds a counter-example" 1
expect_contains "stress counter-example" "Counter-example found"
[ -f "$TMP_DIR/st/stress_fail.txt" ]; check "stress saves stress_fail.txt" $?

run_cf test "$TMP_DIR/st"
expect_status "cf test ignores brute.cpp/gen.cpp" 0
expect_not_contains "cf test ignores brute.cpp/gen.cpp" "Found 3 source"

cp "$TMP_DIR/st/brute.cpp" "$TMP_DIR/st/solution.cpp"
run_cf stress "$TMP_DIR/st" -n 50
expect_status "stress passes for a correct solution" 0
expect_contains "stress pass" "No counter-example in 50 iterations"

# ---- template ---------------------------------------------------------------

pushd "$TMP_DIR" > /dev/null
run_cf template 1000A
expect_status "cf template" 0
[ -f 1000A/solution.cpp ] && [ -f 1000A/problem.txt ]; check "template creates files" $?

run_cf template 1000A
expect_status "cf template is idempotent" 0
expect_contains "template idempotent" "already exists"

run_cf template dpprob --from dp
expect_status "cf template --from dp" 0
grep -q "dp" dpprob/solution.cpp; check "template --from dp uses templates/dp.cpp" $?

run_cf template "bad name"
expect_status "invalid template name" 1

run_cf template nope --from does-not-exist
expect_status "unknown --from template" 3
popd > /dev/null

# ---- doctor / clean ---------------------------------------------------------

run_cf doctor
expect_status "cf doctor" 0
expect_contains "cf doctor" "smoke test"

run_cf clean
expect_status "cf clean" 0
[ ! -d "$CF_BUILD_CACHE_DIR" ]; check "clean removes the cache" $?

# ---- summary ----------------------------------------------------------------

printf '\n%d passed, %d failed\n' "$PASSED" "$FAILED"
[ "$FAILED" -eq 0 ]
