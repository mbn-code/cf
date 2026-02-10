#!/bin/bash

################################################################################
# build.sh - Alternative build script for C++ Competitive Programming
#
# Usage:
#   bash build.sh              # Compile all .cpp files
#   bash build.sh problem_name # Compile and run specific problem
#   bash build.sh -c           # Clean build artifacts
#   bash build.sh -h           # Show help
#
# Features:
#   - Cross-platform (Linux/macOS/WSL)
#   - Auto-detects compiler (g++ or clang++)
#   - Fast I/O optimized
#   - Handles multi-file compilation
#
################################################################################

set -e

# ==================== CONFIGURATION ====================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
INCLUDE_DIR="$SCRIPT_DIR/include"
BUILD_DIR="$SCRIPT_DIR/build"

# Compiler selection
if command -v g++ &> /dev/null; then
    COMPILER="g++"
elif command -v clang++ &> /dev/null; then
    COMPILER="clang++"
else
    echo "Error: No C++ compiler found (g++ or clang++)"
    exit 1
fi

# Compiler flags
CXXFLAGS="-std=c++23 -O2 -Wall -Wextra"
INCLUDE_FLAGS="-I$INCLUDE_DIR"

# ==================== HELPER FUNCTIONS ====================

print_header() {
    echo "════════════════════════════════════════"
    echo "$1"
    echo "════════════════════════════════════════"
}

print_success() {
    echo "PASS: $1"
}

print_error() {
    echo "FAIL: $1" >&2
}

print_info() {
    echo "INFO: $1"
}

show_help() {
    cat << EOF
C++ Competitive Programming Build Script

Usage:
  bash build.sh              # Compile all .cpp files in src/
  bash build.sh <name>       # Compile and run specific problem
  bash build.sh -c           # Clean build artifacts
  bash build.sh -h           # Show this help
  bash build.sh -g <name>    # Compile with debug symbols

Examples:
  bash build.sh
  bash build.sh 1000A
  bash build.sh -g 1000A
  bash build.sh -c

Compiler: $COMPILER
Flags: $CXXFLAGS

EOF
}

# ==================== BUILD FUNCTIONS ====================

build_all() {
    print_header "Building all solutions"

    if [ ! -d "$SRC_DIR" ]; then
        print_error "Source directory not found: $SRC_DIR"
        exit 1
    fi

    mkdir -p "$BUILD_DIR"

    local count=0
    find "$SRC_DIR" -name "*.cpp" -type f | while read -r file; do
        # Skip template.cpp
        if [[ "$file" == *"/template.cpp" ]]; then
            continue
        fi

        local filename=$(basename "$file" .cpp)
        local output="$BUILD_DIR/$filename"
        local compiler_output

        print_info "Compiling: $filename"
        if ! compiler_output=$($COMPILER $CXXFLAGS $INCLUDE_FLAGS "$file" -o "$output" 2>&1); then
            print_error "Failed to compile: $filename"
            echo "$compiler_output" >&2
        else
            print_success "Compiled: $filename"
            ((count++))
        fi
    done

    if [ $count -gt 0 ]; then
        echo ""
        print_success "Built $count solution(s)"
    fi
}

build_and_run() {
    local problem_name="$1"

    print_header "Build and Run: $problem_name"

    # Find the .cpp file
    local cpp_file=""
    local project_root
    project_root="$(dirname "$SCRIPT_DIR")"

    if [ -f "$project_root/problems/${problem_name}.c++" ]; then
        cpp_file="$project_root/problems/${problem_name}.c++"
    elif [ -f "$SRC_DIR/$problem_name.cpp" ]; then
        cpp_file="$SRC_DIR/$problem_name.cpp"
    elif [ -f "$SRC_DIR/$problem_name/solution.cpp" ]; then
        cpp_file="$SRC_DIR/$problem_name/solution.cpp"
    else
        print_error "Could not find source file for: $problem_name"
        echo "Searched in:"
        echo "  - $project_root/problems/${problem_name}.c++"
        echo "  - $SRC_DIR/$problem_name.cpp"
        echo "  - $SRC_DIR/$problem_name/solution.cpp"
        exit 1
    fi

    mkdir -p "$BUILD_DIR"
    local output="$BUILD_DIR/$problem_name"
    local compiler_output

    print_info "Compiling with $COMPILER..."
    if ! compiler_output=$($COMPILER $CXXFLAGS $INCLUDE_FLAGS "$cpp_file" -o "$output" 2>&1); then
        print_error "Compilation failed"
        echo "$compiler_output" >&2
        exit 1
    fi
    print_success "Compiled successfully"

    echo ""
    print_info "Running: $problem_name"
    echo "───────────────────────────────────────"

    if [ -f "$SRC_DIR/../tests/${problem_name}_input.txt" ]; then
        "$output" < "$SRC_DIR/../tests/${problem_name}_input.txt"
    else
        "$output"
    fi

    echo "───────────────────────────────────────"
    print_success "Execution complete"
}

build_debug() {
    local problem_name="$1"

    print_header "Debug Build: $problem_name"

    # Find the .cpp file
    local cpp_file=""
    local project_root
    project_root="$(dirname "$SCRIPT_DIR")"

    if [ -f "$project_root/problems/${problem_name}.c++" ]; then
        cpp_file="$project_root/problems/${problem_name}.c++"
    elif [ -f "$SRC_DIR/$problem_name.cpp" ]; then
        cpp_file="$SRC_DIR/$problem_name.cpp"
    elif [ -f "$SRC_DIR/$problem_name/solution.cpp" ]; then
        cpp_file="$SRC_DIR/$problem_name/solution.cpp"
    else
        print_error "Could not find source file for: $problem_name"
        exit 1
    fi

    mkdir -p "$BUILD_DIR"
    local output="$BUILD_DIR/${problem_name}_debug"
    local compiler_output

    print_info "Compiling with debug symbols..."
    if ! compiler_output=$($COMPILER $CXXFLAGS -g $INCLUDE_FLAGS "$cpp_file" -o "$output" 2>&1); then
        print_error "Debug compilation failed"
        echo "$compiler_output" >&2
        exit 1
    fi

    print_success "Debug binary: $output"
    print_info "Run with: gdb $output (Linux) or lldb $output (macOS)"
}

clean_build() {
    print_header "Cleaning build artifacts"

    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        print_success "Removed: $BUILD_DIR"
    fi

    find "$SRC_DIR" -name "*.o" -delete 2>/dev/null || true
    print_success "Clean complete"
}

# ==================== MAIN EXECUTION ====================

main() {
    local command="${1:-all}"

    case "$command" in
        -h | --help)
            show_help
            ;;
        -c | --clean)
            clean_build
            ;;
        -g | --debug)
            if [ -z "$2" ]; then
                print_error "Usage: bash build.sh -g <name>"
                exit 1
            fi
            build_debug "$2"
            ;;
        all)
            build_all
            ;;
        *)
            build_and_run "$command"
            ;;
    esac
}

main "$@"
