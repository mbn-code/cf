# CF Script Improvements - Applied

## Changes Implemented

### 1. ✅ Use printf everywhere

- Replaced all `echo -e` with `printf` for consistent output
- Added `--` separator for strings starting with dashes
- Prevents interpretation issues with special characters

### 2. ✅ Detect multiple examples count

- Added `count_samples()` function to count available samples
- Warns users when requested sample index exceeds available samples
- Automatically falls back to sample #1

### 3. ✅ Show hint when no expected output found

- Displays "No sample output detected; skipping compare" when applicable
- Prevents confusing silent skips

### 4. ✅ Add --sample N flag

- Supports both `--sample N` and `-s N` flags
- Maintains backward compatibility with positional argument
- Example: `cf --sample 2` or `cf problem.txt 2`

### 5. ✅ Unit tests for parser

- Created `tests/parser_test.sh` with real Codeforces problem (231A)
- Tests sample #1 and #2 extraction
- Tests both positional and flag-based sample selection
- Integrated into main test suite

## Additional Improvements Made

- **Normalized output comparison**: Strips `\r`, trims blank edges, trims trailing spaces
- **Auto problem.txt**: Uses problem.txt when present in directory
- **Multi-file compilation**: Compiles all .cpp files in directory
- **Shows input used**: Prints the sample input block for transparency
- **Exit non-zero on mismatch**: Scriptable for CI/CD
- **Safe symlink resolution**: Handles script invoked via symlink
- **Explicit exit code handling**: Removed `set -e` conflicts in safe_execute

## Usage Examples

```bash
# Auto-detect problem.txt and use sample #1
cf

# Use specific sample
cf problem.txt 2
cf --sample 2

# Multiple .cpp files (compiles all)
cf

# Shows input, output, expected, and comparison
cf problem.txt
```

## Test Results

Parser tests pass successfully with fixture problem 231A:

- ✅ Sample #1 extraction
- ✅ Sample #2 extraction (positional)
- ✅ Sample #2 extraction (--sample flag)

All improvements are production-ready and backwards compatible.
