# Contributing Guidelines

## Project Structure

This repository is designed for competitive programming on Codeforces and similar platforms. Here's the standard workflow:

### Creating New Solutions

1. **Generate a template:**
   ```bash
   cf template problem_1000A
   ```

2. **Edit your solution:**
   ```bash
   vim src/problem_1000A/solution.cpp
   ```

3. **Test locally:**
   ```bash
   cf problem_1000A input.txt
   ```

## Best Practices

### Code Style

- Use meaningful variable names
- Comment complex logic
- Keep functions concise and reusable
- Place helper functions at the top

### Performance

- Always enable fast I/O:
  ```cpp
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  ```

- Use appropriate data types (`int` vs `long long`)
- Avoid unnecessary memory allocations in loops
- Test with edge cases (empty input, max values, etc.)

### Template Reuse

- Save common algorithms in `templates/`
- Create headers in `include/` for shared code
- Document your algorithms with comments

## Adding Custom Templates

1. Create a new file in `templates/`:
   ```bash
   touch templates/string_algorithms.cpp
   ```

2. Add well-commented algorithm implementations

3. Test it compiles:
   ```bash
   g++ -std=c++23 templates/string_algorithms.cpp
   ```

## Testing

### With Test Files

```bash
# Create test input
echo "5
1 2 3 4 5" > tests/my_test.txt

# Run
cf problem_name tests/my_test.txt
```

### With Inline Input

```bash
cf problem_name "5
1 2 3 4 5"
```

### With Pipe

```bash
echo "5
1 2 3 4 5" | cf problem_name
```

## Debugging

### GDB (Linux)

```bash
make debug FILE=problem_name
gdb ./build/problem_name_debug
(gdb) run < tests/input.txt
(gdb) break solution.cpp:42
(gdb) continue
(gdb) print variable_name
```

### LLDB (macOS)

```bash
make debug FILE=problem_name
lldb ./build/problem_name_debug
(lldb) run < tests/input.txt
(lldb) b solution.cpp:42
(lldb) c
(lldb) p variable_name
```

## Version Control

Each problem solution goes into `src/problem_name/`:

```
src/
├── template.cpp          # Master template
├── 1000A/
│   ├── solution.cpp      # Your solution
│   ├── input1.txt        # Test case 1
│   └── input2.txt        # Test case 2
├── 1000B/
│   └── solution.cpp
└── ...
```

### Commit Message Format

```
[Problem ID] Brief description

Longer explanation if needed.

Files: src/1000A/solution.cpp
Time Complexity: O(n log n)
Space Complexity: O(n)
```

Example:
```
[Codeforces 1000A] Implements greedy sorting algorithm

Uses STL sort with custom comparator for optimal performance.
Verified with multiple test cases including edge cases.

Files: src/1000A/solution.cpp
Time Complexity: O(n log n)
Space Complexity: O(n)
```

## Common Issues & Solutions

### Issue: `cf: command not found`

**Solution:**
```bash
# Re-run setup
bash scripts/setup.sh

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

### Issue: Compilation fails with C++23

**Solution:**
```bash
# Check compiler version
g++ --version

# Install newer compiler
bash scripts/setup.sh

# Or use clang++
export CXX=clang++
```

### Issue: Slow compilation

**Solution:**
- Precompiled headers (advanced)
- Use `-O1` instead of `-O2` for development
- Split into smaller .cpp files

## Algorithm Resources

### Recommended Resources

- **Competitive Programming Handbook** by Antti Laaksonen
- **CP-Algorithms** (cp-algorithms.com)
- **Codeforces Blogs** and editorial posts
- **GeeksforGeeks** DSA tutorials

### Template Categories (in `templates/`)

- `graph.cpp` - Graph algorithms (BFS, DFS, Dijkstra)
- `dp.cpp` - Dynamic programming patterns
- `math.cpp` - Mathematical functions
- `string.cpp` - String algorithms (coming soon)
- `segment_tree.cpp` - Advanced data structures (coming soon)

## Performance Tips

### Fast I/O Alternatives

```cpp
// Option 1: Standard fast I/O
ios::sync_with_stdio(false);
cin.tie(nullptr);

// Option 2: With output optimization
ios::sync_with_stdio(false);
cin.tie(nullptr);
cout.tie(nullptr);

// Option 3: Use scanf/printf for extreme speed
#include <cstdio>
scanf("%d", &n);
printf("%d\n", result);
```

### Memory Optimization

```cpp
// Reserve space if you know size
vector<int> v;
v.reserve(1000000);  // Allocate space upfront

// Use iterators instead of indexing in hot loops
for (auto it = v.begin(); it != v.end(); ++it) {
    // Process *it
}
```

## Submitting to Codeforces

1. **Verify locally first:**
   ```bash
   cf problem_name input.txt
   ```

2. **Copy to submission:**
   ```bash
   cp src/problem_name/solution.cpp submission.cpp
   ```

3. **Submit on Codeforces** using the web interface

## Questions?

Refer to the main `README.md` or check the template files for examples.

Happy coding! 🎯
