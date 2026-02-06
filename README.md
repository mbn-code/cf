# cf - Codeforces Toolkit

A robust, industry-standard C++ competitive programming environment for Codeforces and similar platforms. Designed for **reliability** and **real-world usage** with built-in safety features, comprehensive testing, and production-grade error handling.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Language](https://img.shields.io/badge/language-C%2B%2B-blue.svg)](README.md)
[![Platform](https://img.shields.io/badge/platform-Linux%2BmacOS%2BWSL-green.svg)](README.md)

## Key Features

**Production-Ready Reliability**

- Timeout protection (prevents infinite loops - critical for auto-judging)
- Comprehensive input validation and bounds checking
- Automatic overflow detection for large numbers
- Error handling on every execution path
- Cross-platform compatibility (Linux, macOS, WSL)

**Development Efficiency**

- Fast I/O configuration (crucial for large inputs)
- Pre-configured competitive programming template
- One-command compilation and testing
- Integrated test validation framework
- Debug symbols and verbose output modes

**Safety & Correctness**

- Validates input against problem constraints
- Detects integer overflow before it happens
- Timeout protection (5s default)
- Output diff comparison
- Example-based validation

**Developer Experience**

- CLI tool for quick problem setup
- Auto-detection of C++ files
- VS Code integration
- Helpful error messages
- Idempotent operations

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

```bash
# Requirements
- g++ 14+ or clang++ 15+
- make
- bash 4.0+

# Compile check
cd cf && make help
```

### Windows (WSL2)

```bash
# Same as Linux - install WSL2 and follow Linux setup
# Recommended: Ubuntu 22.04 LTS or newer
```

## Usage

### Create a New Problem

```bash
# Create template for problem 1000A
cf template 1000A
cd 1000A

# Edit the solution
vim solution.cpp

# Paste problem statement into problem.txt
```

### Run Your Solution

```bash
# With input file
cf problem.txt

# Run sample #2 from problem.txt
cf --sample 2

# With inline input
cf "5\n1 2 3 4 5"

# Force interactive stdin
cf --stdin

# Interactive (pipe input)
cf

# Run with custom input file
cf custom_input.txt

# Use an explicit input flag
cf --input input.txt
```

### Run Test Suite

```bash
# Test all solutions
cf test

# Test with specific input/output
bash scripts/test.sh -i input.txt -o output.txt

# Test with 10 second timeout
bash scripts/test.sh -t 10

# Verbose output (shows mismatches)
bash scripts/test.sh -v
```

### Build & Debug

```bash
# Compile all solutions
make

# Compile and run specific problem
make run FILE=1000A

# Compile with debug symbols
make debug FILE=1000A

# Clean build artifacts
make clean
```

## Production Best Practices

### 1. Always Validate Input Ranges

```cpp
// GOOD: Validate against problem constraints
int n = readInt(1, 1000000);  // Min=1, Max=1M

// BAD: No validation
int n;
cin >> n;
```

### 2. Use Long Long for Large Numbers

```cpp
// GOOD: Prevents overflow
ll sum = 0;
for (int x : arr) {
    sum += x;  // Safe for values up to 10^18
}

// BAD: Integer overflow
int sum = 0;  // Overflows if sum > 2^31-1
for (int x : arr) {
    sum += x;
}
```

### 3. Enable Fast I/O

```cpp
// Already included in template.cpp:
ios::sync_with_stdio(false);
cin.tie(nullptr);
cout.tie(nullptr);

// This can speed up I/O 10-100x for large inputs
```

### 4. Test Edge Cases

```
- Empty input (n=0)
- Minimum size (n=1)
- Maximum size (n=10^5)
- All zeros
- All maximum values
- Mix of negative/positive
```

### 5. Handle Timeouts Gracefully

The system automatically kills programs exceeding 5 seconds. Optimize for:

- Algorithms: Use O(n log n) instead of O(n²)
- I/O: Enable fast I/O (see step 3)
- Memory: Pre-allocate vectors instead of using push_back in loops

## Configuration

You can override defaults via environment variables or a `.cfconfig` file at the repo root.

```bash
# Examples
export CF_CXXFLAGS="-std=c++23 -O2 -Wall -Wextra -Wshadow"
export CF_TIMEOUT=8
export CF_BUILD_CACHE_DIR="$HOME/.cache/cf"
export CF_FORCE_REBUILD=1
export CF_NONINTERACTIVE=1
```

### 6. Validate Output Format

```cpp
// Correct formatting
for (int i = 0; i < n; i++) {
    if (i > 0) cout << " ";
    cout << arr[i];
}
cout << "\n";

// Common mistakes:
// - Extra spaces at end
// - Missing newline
// - Wrong data type (int vs long long)
```

## Production Workflow

### Pre-Submission Checklist

```
- Run: cf test                    # Validate all solutions compile
- Check: Edge cases (n=1, n=max)
- Verify: Output format matches examples
- Ensure: Fast I/O enabled
- Review: Integer overflow risks
- Confirm: Timeout protection active
- Test: With maximum input size
```

### Common Issues & Solutions

| Issue                  | Cause                                 | Solution                                             |
| ---------------------- | ------------------------------------- | ---------------------------------------------------- |
| **Compilation fails**  | Missing headers or syntax error       | `cf 1000A` shows compilation error; fix and retry    |
| **Wrong answer (WA)**  | Logic error or output format mismatch | Compare output with `cf -v problem.txt`              |
| **Time limit (TLE)**   | Too slow algorithm                    | Use fast I/O, better algorithm (O(n log n) vs O(n²)) |
| **Runtime error (RE)** | Segfault, buffer overflow             | Use bounds checking, validate array indices          |
| **Presentation error** | Extra spaces or missing newline       | Check output format carefully                        |
| **Timeout (>5s)**      | Infinite loop or very slow code       | Add timeout protection in debug                      |

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

```bash
# Ensure you're in the cf directory
cd ~/Documents/GitHub/cf
echo $PWD  # Should show cf directory
```

#### "Compilation timeout"

```bash
# Your code has an infinite loop or is very complex
# Use debug mode to step through
make debug FILE=1000A
```

#### Template doesn't have validation functions

```bash
# Update the template
git pull origin main
# Or manually copy: cp scripts/../src/template.cpp my_solution/solution.cpp
```

## Architecture

```
cf/
├── src/                    # Solution source files
│   └── template.cpp        # Production template with validation
├── include/                # Shared headers
│   └── stl_utilities.h     # Utility functions
├── templates/              # Algorithm templates
│   ├── dp.cpp             # Dynamic programming examples
│   ├── graph.cpp          # Graph algorithms
│   └── math.cpp           # Math algorithms
├── scripts/                # Build and test tools
│   ├── cf                 # Main CLI tool
│   ├── build.sh           # Build script
│   ├── test.sh            # Test runner with validation
│   └── setup.sh           # Environment setup
├── tests/                  # Test data
│   ├── example_input.txt   # Default test input
│   └── example_output.txt  # Expected output
├── Makefile               # Build automation
└── README.md              # This file
```

## Compiler Flags Explained

```makefile
-std=c++23       # Use C++23 standard (latest features)
-O2              # Optimize for speed (production-grade)
-Wall -Wextra    # Enable all warnings (catch bugs early)
```

## Environment Variables

```bash
# Override repository root (for custom installations)
export CF_REPO_ROOT=/custom/path/to/cf

# Enable verbose debug output
export CF_VERBOSE=1

# Custom compiler (rarely needed)
export CXX=clang++
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Code style and conventions
- Performance best practices
- Algorithm template submissions
- Testing requirements

## Performance Benchmarks

Typical performance on modern hardware:

```
Compilation:     ~500ms (single file, C++23)
Execution:       <10ms (simple problems)
I/O (1M ints):   ~50ms (with fast I/O)
I/O (1M ints):   ~2s (without fast I/O)
```

## Testing

Run the test suite to verify setup:

```bash
# Test all solutions
cf test

# Test specific problem with 10s timeout
bash scripts/test.sh -t 10 -v

# Exit codes:
# 0 = All tests passed
# 1 = Test failed
# 2 = Infrastructure error
```

## Supported Platforms

| OS                    | Status          | Notes                           |
| --------------------- | --------------- | ------------------------------- |
| Linux (Ubuntu 20.04+) | Fully Supported | Tested on Ubuntu 22.04 LTS      |
| macOS 11+             | Fully Supported | Works with both g++ and clang++ |
| WSL2 (Windows)        | Fully Supported | Install Linux distro via WSL    |
| WSL1 (Windows)        | Limited         | Recommended to upgrade to WSL2  |
| Docker                | Supported       | Run `ubuntu:22.04` image        |

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Support & Documentation

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: [Full Guide](docs/GUIDE.md)
- **FAQ**: See [CONTRIBUTING.md](CONTRIBUTING.md#faq)

## Real-World Success Rate

This toolkit is designed for **99%+ reliability** on Codeforces:

- Handles all standard input/output formats
- Prevents common competitive programming errors
- Timeout protection on all executions
- Works with multi-file submissions
- Production-grade error messages

---

**Made for competitive programmers who value reliability.** Start using cf today for worry-free problem solving on Codeforces!
