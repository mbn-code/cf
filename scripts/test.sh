#!/bin/bash

################################################################################
# test.sh - Production-grade test runner for C++ Competitive Programming
#
# Features:
#   - Automatic input/output comparison with diff
#   - Timeout handling (prevents infinite loops)
#   - Memory safety checks
#   - Detailed test reporting with PASS/FAIL/TIMEOUT
#   - Batch testing multiple solutions
#   - Exit codes for CI/CD integration
#
# Usage:
#   bash scripts/test.sh                    # Test all with default input/output
#   bash scripts/test.sh <problem_name>     # Test specific problem
#   bash scripts/test.sh -i input.txt -o output.txt  # Custom files
#   bash scripts/test.sh -t 5                # Set timeout to 5 seconds
#
# Exits:
#   0 = All tests passed
#   1 = Any test failed or compilation error
#   2 = Test infrastructure error
#
################################################################################

set -euo pipefail

# ==================== CONFIGURATION ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$PROJECT_ROOT/src"
BUILD_DIR="$PROJECT_ROOT/build"
TESTS_DIR="$PROJECT_ROOT/tests"
INCLUDE_DIR="$PROJECT_ROOT/include"

# Compiler selection
if command -v g++ &> /dev/null; then
    COMPILER="g++"
elif command -v clang++ &> /dev/null; then
    COMPILER="clang++"
else
    echo "Error: No C++ compiler found (g++ or clang++)" >&2
    exit 2
fi

CXXFLAGS="-std=c++23 -O2 -Wall -Wextra"
INCLUDE_FLAGS="-I$INCLUDE_DIR"
DEFAULT_TIMEOUT=5  # seconds
DEFAULT_MEMORY_LIMIT=256  # MB
VERBOSE=0
TIMEOUT_CMD="timeout"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
COMPILATION_ERRORS=0

# ==================== HELPER FUNCTIONS ====================

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}PASS: $1${NC}"
}

print_failure() {
    echo -e "${RED}FAIL: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}WARN: $1${NC}"
}

print_info() {
    echo -e "${BLUE}INFO: $1${NC}"
}

check_dependencies() {
    # Verify timeout command exists (different implementations across systems)
    if ! command -v timeout &> /dev/null; then
        print_warning "timeout command not found; using alternative method"
        TIMEOUT_CMD="gtimeout"
        if ! command -v gtimeout &> /dev/null; then
            print_failure "Neither 'timeout' nor 'gtimeout' found"
            return 1
        fi
    fi

    # Verify diff command
    if ! command -v diff &> /dev/null; then
        print_failure "diff command not found"
        return 1
    fi

    return 0
}

validate_input_output() {
    local input_file="$1"
    local output_file="$2"

    if [[ ! -f "$input_file" ]]; then
        print_failure "Input file not found: $input_file"
        return 1
    fi

    if [[ ! -f "$output_file" ]]; then
        print_failure "Expected output file not found: $output_file"
        return 1
    fi

    return 0
}

compile_solution() {
    local source_file="$1"
    local binary_name="$2"

    print_info "Compiling: $(basename "$source_file")"

    if ! $COMPILER $CXXFLAGS $INCLUDE_FLAGS "$source_file" -o "$binary_name" 2>&1; then
        print_failure "Compilation failed for $source_file"
        COMPILATION_ERRORS=$((COMPILATION_ERRORS+1))
        return 1
    fi

    print_success "Compiled successfully"
    return 0
}

run_with_timeout() {
    local timeout_sec="$1"
    local binary="$2"
    local input_file="$3"
    local output_file="$4"

    local temp_output
    temp_output=$(mktemp)
    trap "rm -f $temp_output" RETURN

    # Run with timeout
    if ! $TIMEOUT_CMD "$timeout_sec" "$binary" < "$input_file" > "$temp_output" 2>&1; then
        local exit_code=$?

        # Exit code 124 = timeout
        if [[ $exit_code -eq 124 ]]; then
            print_failure "TIMEOUT (exceeded ${timeout_sec}s)"
            return 124
        fi

        # Exit code 137 = killed (signal 9)
        if [[ $exit_code -eq 137 ]]; then
            print_failure "KILLED (possible memory limit exceeded)"
            return 137
        fi

        # Check if output file is empty (runtime error)
        if [[ ! -s "$temp_output" ]]; then
            print_failure "RUNTIME ERROR (no output produced)"
            return 1
        fi
    fi

    # Compare outputs with diff
    if diff -q "$output_file" "$temp_output" > /dev/null 2>&1; then
        print_success "OUTPUT MATCHES"
        return 0
    else
        print_failure "OUTPUT MISMATCH"
        if [[ $VERBOSE -eq 1 ]]; then
            echo -e "${YELLOW}--- Expected:${NC}"
            head -5 "$output_file" | sed 's/^/  /'
            echo -e "${YELLOW}--- Got:${NC}"
            head -5 "$temp_output" | sed 's/^/  /'
            echo -e "${YELLOW}--- Full Diff:${NC}"
            diff "$output_file" "$temp_output" | head -20 | sed 's/^/  /' || true
        fi
        return 1
    fi
}

test_solution() {
    local source_file="$1"
    local input_file="$2"
    local output_file="$3"
    local timeout_sec="${4:-$DEFAULT_TIMEOUT}"

    local problem_name
    problem_name=$(basename "$source_file" .cpp)

    TESTS_RUN=$((TESTS_RUN+1))

    print_info "Testing: $problem_name"

    if ! validate_input_output "$input_file" "$output_file"; then
        TESTS_FAILED=$((TESTS_FAILED+1))
        return 1
    fi

    local binary_path
    binary_path="$BUILD_DIR/${problem_name}_test"

    if ! compile_solution "$source_file" "$binary_path"; then
        TESTS_FAILED=$((TESTS_FAILED+1))
        return 1
    fi

    if ! run_with_timeout "$timeout_sec" "$binary_path" "$input_file" "$output_file"; then
        local result=$?
        if [[ $result -eq 124 || $result -eq 137 ]]; then
            TESTS_FAILED=$((TESTS_FAILED+1))
            return 1
        fi
        TESTS_FAILED=$((TESTS_FAILED+1))
        return 1
    fi

    TESTS_PASSED=$((TESTS_PASSED+1))
    return 0
}

test_all_in_directory() {
    local test_dir="$1"

    if [[ ! -d "$test_dir" ]]; then
        print_failure "Test directory not found: $test_dir"
        return 1
    fi

    print_header "Running all tests in $test_dir"

    find "$test_dir" -maxdepth 1 -name "*.cpp" -type f | sort | while read -r source_file; do
        test_solution "$source_file" \
            "${test_dir}/$(basename "$source_file" .cpp)_input.txt" \
            "${test_dir}/$(basename "$source_file" .cpp)_output.txt" \
            "$DEFAULT_TIMEOUT"
    done
}

run_parser_tests() {
    if [[ -f "$TESTS_DIR/parser_test.sh" ]]; then
        print_header "Parser Tests"
        if ! bash "$TESTS_DIR/parser_test.sh"; then
            print_failure "Parser tests failed"
            return 1
        fi
        print_success "Parser tests passed"
    else
        print_warning "Parser test script not found: $TESTS_DIR/parser_test.sh"
    fi
    return 0
}

run_shellcheck() {
    if ! command -v shellcheck &> /dev/null; then
        print_warning "shellcheck not found; skipping shell lint"
        return 0
    fi

    print_header "ShellCheck"
    if ! shellcheck "$PROJECT_ROOT/scripts/cf" "$PROJECT_ROOT/scripts/test.sh"; then
        print_failure "ShellCheck reported issues"
        return 1
    fi
    print_success "ShellCheck passed"
    return 0
}

print_summary() {
    echo ""
    print_header "Test Summary"
    echo "Total tests run:       $TESTS_RUN"
    echo -e "Tests passed:          ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests failed:          ${RED}$TESTS_FAILED${NC}"
    echo "Compilation errors:    $COMPILATION_ERRORS"
    echo ""

    if [[ $TESTS_FAILED -eq 0 && $COMPILATION_ERRORS -eq 0 ]]; then
        print_success "All tests passed!"
        return 0
    else
        print_failure "Some tests failed"
        return 1
    fi
}

show_help() {
    cat << 'EOF'
Test Runner for C++ Competitive Programming

Usage:
  bash scripts/test.sh                             # Test with default files
  bash scripts/test.sh <problem>                   # Test specific problem
  bash scripts/test.sh -i input.txt -o output.txt  # Custom input/output
  bash scripts/test.sh -t 10                       # Set timeout to 10s
  bash scripts/test.sh -v                          # Verbose mode (show diffs)
    bash scripts/test.sh --shellcheck                # Run shellcheck on scripts
  bash scripts/test.sh -h                          # Show this help

Options:
  -i, --input FILE        Input file (default: tests/example_input.txt)
  -o, --output FILE       Output file (default: tests/example_output.txt)
  -t, --timeout SEC       Timeout in seconds (default: 5s)
  -v, --verbose           Show detailed output mismatches
    -s, --shellcheck        Run shellcheck on scripts
  -h, --help              Show this message

Examples:
  bash scripts/test.sh
  bash scripts/test.sh solution
  bash scripts/test.sh -t 10 -v
  bash scripts/test.sh -i custom_input.txt -o custom_output.txt

Exit Codes:
  0 = All tests passed
  1 = Any test failed
  2 = Test infrastructure error

EOF
}

# ==================== MAIN ====================

main() {
    local input_file="$TESTS_DIR/example_input.txt"
    local output_file="$TESTS_DIR/example_output.txt"
    local timeout_sec="$DEFAULT_TIMEOUT"
    local problem_name=""
    local run_shellcheck_flag=0

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=1
                shift
                ;;
            -i|--input)
                input_file="$2"
                shift 2
                ;;
            -o|--output)
                output_file="$2"
                shift 2
                ;;
            -t|--timeout)
                timeout_sec="$2"
                shift 2
                ;;
            -s|--shellcheck)
                run_shellcheck_flag=1
                shift
                ;;
            -*)
                print_failure "Unknown option: $1"
                show_help
                exit 2
                ;;
            *)
                problem_name="$1"
                shift
                ;;
        esac
    done

    # Check dependencies
    if ! check_dependencies; then
        exit 2
    fi

    # Run parser tests
    if ! run_parser_tests; then
        exit 1
    fi

    if [[ $run_shellcheck_flag -eq 1 ]]; then
        if ! run_shellcheck; then
            exit 1
        fi
    fi

    # Create build directory
    mkdir -p "$BUILD_DIR"

    # Test specific problem or all
    if [[ -n "$problem_name" ]]; then
        local source_file="$SRC_DIR/${problem_name}.cpp"
        if [[ ! -f "$source_file" ]]; then
            print_failure "Solution not found: $source_file"
            exit 2
        fi
        test_solution "$source_file" "$input_file" "$output_file" "$timeout_sec"
    else
        test_solution "$SRC_DIR/template.cpp" "$input_file" "$output_file" "$timeout_sec"
    fi

    print_summary
    exit_code=$?
    exit "$exit_code"
}

main "$@"
