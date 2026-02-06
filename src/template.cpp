/**
 * @file template.cpp
 * @author Your Name
 * @brief Production-grade C++ competitive programming template with input validation
 * @date 2026
 *
 * This template includes:
 * - Fast I/O configuration (crucial for competitive programming)
 * - Input validation and bounds checking
 * - Common headers and macros
 * - Error handling patterns
 * - Standard competitive programming structure
 * - Example implementation
 *
 * BEST PRACTICES:
 * 1. Always validate input ranges against problem constraints
 * 2. Use long long for large numbers (avoid integer overflow)
 * 3. Enable fast I/O for time-sensitive problems
 * 4. Use meaningful variable names for debugging
 * 5. Test edge cases: empty input, max values, min values
 */

#include <iostream>
#include <vector>
#include <algorithm>
#include <cmath>
#include <string>
#include <deque>
#include <queue>
#include <stack>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <iomanip>
#include <bitset>
#include <cassert>
#include <climits>
#include <limits>

using namespace std;

// ==================== FAST I/O & DEBUGGING ====================
// Enable fast I/O - CRITICAL for competitive programming
#define FAST_IO                                                           \
    ios::sync_with_stdio(false);                                          \
    cin.tie(nullptr);                                                     \
    cout.tie(nullptr)

// Uncomment for debugging (slower, only for development)
// #define DEBUG
#ifdef DEBUG
#define DBG(x) cerr << #x << " = " << (x) << endl
#define DBGV(v)                                                           \
    {                                                                      \
        cerr << #v << " = [";                                             \
        for (auto x : v)                                                  \
            cerr << x << " ";                                             \
        cerr << "]\n";                                                    \
    }
#else
#define DBG(x)
#define DBGV(v)
#endif

// ==================== COMMON MACROS ====================
#define ll long long
#define ld long double
#define pii pair<int, int>
#define pll pair<ll, ll>
#define vi vector<int>
#define vll vector<ll>
#define vvi vector<vector<int>>
#define vvll vector<vector<ll>>
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()
#define pb push_back
#define mp make_pair
#define el '\n'

// Constants
const int MOD = 1e9 + 7;
const int INF = 2e9;
const ll LLINF = 9e18;
const double EPS = 1e-9;
const double PI = acos(-1.0);

// ==================== INPUT VALIDATION HELPERS ====================

/**
 * @brief Check if integer is within valid range
 * @param value The integer to validate
 * @param min_val Minimum valid value (inclusive)
 * @param max_val Maximum valid value (inclusive)
 * @return true if value is within range, false otherwise
 */
bool validateRange(ll value, ll min_val, ll max_val) {
    if (value < min_val || value > max_val) {
        cerr << "Error: Value " << value << " out of range ["
             << min_val << ", " << max_val << "]" << endl;
        return false;
    }
    return true;
}

/**
 * @brief Check if vector size is valid
 * @param v The vector to check
 * @param min_size Minimum size (inclusive)
 * @param max_size Maximum size (inclusive)
 * @return true if size is valid, false otherwise
 */
bool validateVectorSize(const vi& v, int min_size, int max_size) {
    if (sz(v) < min_size || sz(v) > max_size) {
        cerr << "Error: Vector size " << sz(v) << " out of range ["
             << min_size << ", " << max_size << "]" << endl;
        return false;
    }
    return true;
}

/**
 * @brief Check for integer overflow before multiplication
 * @param a First operand
 * @param b Second operand
 * @return true if a*b won't overflow, false otherwise
 */
bool canMultiply(ll a, ll b) {
    if (a == 0 || b == 0) return true;
    if (a > LLINF / abs(b)) {
        cerr << "Error: Multiplication overflow (" << a << " * " << b << ")" << endl;
        return false;
    }
    return true;
}

/**
 * @brief Check for integer overflow before addition
 * @param a First operand
 * @param b Second operand
 * @return true if a+b won't overflow, false otherwise
 */
bool canAdd(ll a, ll b) {
    if (b > 0 && a > LLINF - b) {
        cerr << "Error: Addition overflow (" << a << " + " << b << ")" << endl;
        return false;
    }
    if (b < 0 && a < -LLINF - b) {
        cerr << "Error: Addition underflow (" << a << " + " << b << ")" << endl;
        return false;
    }
    return true;
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * @brief Read an integer with validation
 * @param min_val Minimum valid value
 * @param max_val Maximum valid value
 * @return Integer from input (validated)
 */
int readInt(int min_val = INT_MIN, int max_val = INT_MAX) {
    int x;
    if (!(cin >> x)) {
        cerr << "Error: Failed to read integer" << endl;
        exit(1);
    }
    if (!validateRange(x, min_val, max_val)) {
        exit(1);
    }
    return x;
}

/**
 * @brief Read n integers into a vector with validation
 * @param n Number of integers to read
 * @param min_val Minimum valid value for each element
 * @param max_val Maximum valid value for each element
 * @return Vector of n validated integers
 */
vi readVector(int n, int min_val = INT_MIN, int max_val = INT_MAX) {
    vi v(n);
    for (int i = 0; i < n; i++) {
        v[i] = readInt(min_val, max_val);
    }
    return v;
}

/**
 * @brief Print vector with space separation
 * @param v Vector to print
 */
void printVector(const vi& v) {
    for (int i = 0; i < sz(v); i++) {
        if (i > 0) cout << " ";
        cout << v[i];
    }
    cout << el;
}

// ==================== MAIN ALGORITHM ====================

/**
 * @brief Solve the problem
 *
 * IMPORTANT REMINDERS:
 * - Update the constraint ranges below based on your problem!
 * - Always validate n before creating arrays of size n
 * - Watch for integer overflow when multiplying or adding
 * - Test with edge cases: n=1, n=max, all zeros, all max values
 */
void solve() {
    int n = readInt(1, 1000000);
    vi v = readVector(n, INT_MIN, INT_MAX);
    ll sum = 0;
    for (int x : v) {
        if (!canAdd(sum, x)) {
            exit(1);
        }
        sum += x;
    }
    cout << sum << el;
}

// ==================== MAIN ENTRY POINT ====================
int main() {
    FAST_IO;

    try {
        // For multiple test cases, uncomment:
        // int t;
        // cin >> t;
        // if (!validateRange(t, 1, 1000)) exit(1);
        // while (t--) {
        //     solve();
        // }

        // For single test case:
        solve();

        return 0;
    } catch (const exception& e) {
        cerr << "Exception: " << e.what() << endl;
        return 1;
    }
}
