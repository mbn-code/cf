/**
 * @file template.cpp
 * @author Your Name
 * @brief Standard C++ competitive programming template with fast I/O
 * @date 2026
 *
 * This template includes:
 * - Fast I/O configuration (crucial for competitive programming)
 * - Common headers and macros
 * - Standard competitive programming structure
 * - Example implementation
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

// ==================== UTILITY FUNCTIONS ====================

/**
 * @brief Read an integer
 * @return Integer from input
 */
int readInt() {
    int x;
    cin >> x;
    return x;
}

/**
 * @brief Read n integers into a vector
 * @param n Number of integers to read
 * @return Vector of n integers
 */
vi readVector(int n) {
    vi v(n);
    for (int i = 0; i < n; i++)
        cin >> v[i];
    return v;
}

/**
 * @brief Print vector with space separation
 * @param v Vector to print
 */
void printVector(const vi& v) {
    for (int x : v)
        cout << x << " ";
    cout << el;
}

// ==================== MAIN ALGORITHM ====================

/**
 * @brief Solve the problem
 * Place your main algorithm logic here
 */
void solve() {
    int n;
    cin >> n;
    
    vi arr = readVector(n);
    
    // TODO: Implement your solution
    // Example: Find sum of array
    ll sum = 0;
    for (int x : arr)
        sum += x;
    
    cout << sum << el;
}

// ==================== MAIN ENTRY POINT ====================
int main() {
    FAST_IO;
    
    // For multiple test cases, uncomment:
    // int t;
    // cin >> t;
    // while (t--) {
    //     solve();
    // }
    
    // For single test case:
    solve();
    
    return 0;
}

// ==================== EXAMPLE INPUT/OUTPUT ====================
/*

Example 1:
Input:
5
1 2 3 4 5

Output:
15

Explanation:
Sum of array = 1 + 2 + 3 + 4 + 5 = 15

*/
