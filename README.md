# cf - My C++ Toolkit for Competitive Programming

I built this toolkit to make solving problems on Codeforces faster and less error-prone. It's a simple, reliable setup for C++ competitive programming that I use every day. It handles the boilerplate, so you can focus on the algorithm.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Language](https://img.shields.io/badge/language-C%2B%2B-blue.svg)](README.md)
[![Platform](https://img.shields.io/badge/platform-Linux%2BmacOS%2BWSL-green.svg)](README.md)

## What it does

This toolkit is designed to automate the boring parts of competitive programming:

*   **Prevents common mistakes:** It protects against infinite loops with a timeout, validates input, and can even detect integer overflows.
*   **Speeds up your workflow:** You get a fast I/O template, one-command compilation and testing, and auto-parsing of example cases from the problem statement.
*   **Helps you debug:** The tool gives you clear error messages, and you can easily compile with debug symbols. It also automatically compares your solution's output against the example's expected output.
*   **Gets you started quickly:** A single command sets up a new problem directory with a clean `solution.cpp` and `problem.txt`.

## Installation

### Quick Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/mbn-code/cf.git
cd cf

# Run setup script (installs compiler, tools, and configures globally)
bash scripts/setup.sh

# Add to PATH (if not done automatically)
export PATH="$PATH:$(pwd)/scripts"
```

### Manual Setup

If you prefer, you can set it up manually. You'll need:

*   g++ 14+ or clang++ 15+
*   make
*   bash 4.0+

You can check if things are working by running `make help`.

### Windows (WSL2)

Just use WSL2 and follow the Linux setup. I'd recommend Ubuntu 22.04 or newer.

## How to Use It

### Start a New Problem

```bash
# Create a template for problem 1000A
cf template 1000A
cd 1000A
```
This creates a new directory `1000A/` with `solution.cpp` and `problem.txt`. I usually open these in VS Code: `code problem.txt solution.cpp`.

### Write Your Code
Paste the problem statement into `problem.txt` and write your code in `solution.cpp`.

### Run Your Solution

Once you're in the problem directory:

```bash
# Run with the input from problem.txt's examples
cf

# Run with sample #2 from problem.txt
cf --sample 2

# With a specific input file
cf path/to/input.txt

# With inline input
cf "5\n1 2 3 4 5"

# If you need to type input manually
cf --stdin
```

### Run the Tests
```bash
# Run the main test script
cf test
```

### Stay Updated
```bash
# Update cf to the latest version from git
cf update
```

### Using the Makefile
The `cf` script is what I use most of the time, but there's also a `Makefile` for more standard build tasks.

```bash
# Compile all solutions in src/
make

# Compile and run a specific problem's solution
make run FILE=1000A

# Compile with debug symbols
make debug FILE=1000A

# Clean build artifacts
make clean
```

## Tips for Solving Problems

A few things to keep in mind:

### 1. Always Validate Input Ranges

The template has helpers for this. Use them!

```cpp
// GOOD: Validate against problem constraints
int n = readInt(1, 1000000);  // Min=1, Max=1M

// BAD: No validation
int n;
cin >> n;
```

### 2. Use `long long` for Big Numbers

Integer overflow is a common source of wrong answers.

```cpp
// GOOD: Prevents overflow
ll sum = 0;
for (int x : arr) {
    sum += x;
}

// BAD: Integer overflow if sum > 2^31-1
int sum = 0;
for (int x : arr) {
    sum += x;
}
```

### 3. Fast I/O is Your Friend

The template enables this by default. It can make a huge difference on problems with large inputs.

```cpp
// Included in template.cpp:
ios::sync_with_stdio(false);
cin.tie(nullptr);
cout.tie(nullptr);
```

### 4. Test Edge Cases

Always think about:
*   Empty input (`n=0`)
*   Minimum size (`n=1`)
*   Maximum size (`n=10^5`)
*   All zeros, all max values
*   Negative numbers

### 5. Be Mindful of Timeouts

The tool will stop your code after 5 seconds. If you're getting a timeout, you probably need a more efficient algorithm (e.g., O(n log n) instead of O(n²)).

## Recommended Workflow

### Pre-Submission Checklist
Before submitting to Codeforces, I usually do a quick check:
- Run `cf test` to make sure everything compiles.
- Test edge cases (n=1, n=max).
- Double-check that the output format matches the examples exactly.
- Make sure fast I/O is enabled.
- Think about potential integer overflows.

### Common Issues

| Issue                  | Cause                                 | Solution                                             |
| ---------------------- | ------------------------------------- | ---------------------------------------------------- |
| **Compilation fails**  | Missing headers or syntax error       | The `cf` tool shows compilation errors; fix and retry    |
| **Wrong answer (WA)**  | Logic error or output format mismatch | Compare your output with the expected output from `cf` |
| **Time limit (TLE)**   | Too slow algorithm                    | Use fast I/O, better algorithm (O(n log n) vs O(n²)) |
| **Runtime error (RE)** | Segfault, buffer overflow             | Use bounds checking, validate array indices          |
| **Presentation error** | Extra spaces or missing newline       | Check output format carefully                        |

### Troubleshooting

#### "No C++ compiler found"

```bash
# Ubuntu/Debian
sudo apt install g++ make

# macOS
brew install gcc make

# WSL
sudo apt install build-essential
```

#### "Repository structure not found"
You're probably not in the right directory. `cd` into the cloned `cf` repo.

#### Template is outdated or missing functions
Run `cf update` to get the latest version.

## How it's Organized

```
cf/
├── src/                    # Where the main C++ solution template lives
├── problems/               # Staging area for the problem I'm currently working on
│   ├── problem.txt         # The problem description
│   └── solution.c++        # The code for the current problem
├── include/                # Shared C++ headers
│   └── stl_utilities.h     # Some helper functions
├── templates/              # Reusable code for common algorithms (DP, graphs, etc.)
├── scripts/                # The core tools
│   ├── cf                  # The main CLI script
│   ├── build.sh            # Build script
│   ├── test.sh             # Test runner
│   └── setup.sh            # Setup script
├── tests/                  # Test data and fixtures
├── docs/                   # Extra documentation
├── build/                  # Build artifacts
├── Makefile                # Makefile for traditional builds
└── README.md               # You are here
```

## Compiler Flags

The Makefile and scripts use these flags by default:

```makefile
-std=c++23       # Use modern C++
-O2              # Optimize for speed
-Wall -Wextra    # Show all warnings
```

---

I hope this helps you solve problems more efficiently. If you have any suggestions, feel free to open an issue or PR. Happy coding!
