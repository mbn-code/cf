/**
 * @file dp.cpp
 * @brief Dynamic Programming template for competitive programming
 * @description Common DP patterns: knapsack, LCS, LIS, etc.
 */

#include <iostream>
#include <vector>
#include <algorithm>
#include <climits>

using namespace std;

#define ll long long
#define vi vector<int>
#define vvi vector<vector<int>>

const int MOD = 1e9 + 7;
const int MAXN = 1005;

// ==================== KNAPSACK PROBLEMS ====================

/**
 * @brief 0/1 Knapsack DP
 * @param n Number of items
 * @param W Knapsack capacity
 * @param weights Array of weights
 * @param values Array of values
 * @return Maximum value
 */
int knapsack01(int n, int W, const vi& weights, const vi& values) {
    vvi dp(n + 1, vi(W + 1, 0));
    
    for (int i = 1; i <= n; i++) {
        for (int w = 1; w <= W; w++) {
            if (weights[i - 1] <= w) {
                dp[i][w] = max(
                    dp[i - 1][w],
                    dp[i - 1][w - weights[i - 1]] + values[i - 1]
                );
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }
    
    return dp[n][W];
}

// ==================== LONGEST COMMON SUBSEQUENCE ====================

/**
 * @brief Longest Common Subsequence
 * @param s1 First string
 * @param s2 Second string
 * @return Length of LCS
 */
int lcs(const string& s1, const string& s2) {
    int m = s1.length();
    int n = s2.length();
    vvi dp(m + 1, vi(n + 1, 0));
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (s1[i - 1] == s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    return dp[m][n];
}

// ==================== LONGEST INCREASING SUBSEQUENCE ====================

/**
 * @brief Longest Increasing Subsequence (O(n log n))
 * @param arr Array of integers
 * @return Length of LIS
 */
int lis(const vi& arr) {
    vi tails;  // tails[i] = smallest tail of all LIS of length i+1
    
    for (int x : arr) {
        auto it = lower_bound(tails.begin(), tails.end(), x);
        if (it == tails.end()) {
            tails.push_back(x);
        } else {
            *it = x;
        }
    }
    
    return tails.size();
}

// ==================== FIBONACCI WITH MEMOIZATION ====================

vi memo;

/**
 * @brief Fibonacci with memoization
 * @param n Index
 * @return F(n) mod MOD
 */
ll fib(int n) {
    if (n <= 1) return n;
    if (memo[n] != -1) return memo[n];
    
    memo[n] = (fib(n - 1) + fib(n - 2)) % MOD;
    return memo[n];
}

// ==================== COIN CHANGE ====================

/**
 * @brief Minimum coins needed to make amount
 * @param coins Available coin denominations
 * @param amount Target amount
 * @return Minimum number of coins, or -1 if impossible
 */
int coinChange(const vi& coins, int amount) {
    vector<int> dp(amount + 1, INT_MAX);
    dp[0] = 0;
    
    for (int i = 1; i <= amount; i++) {
        for (int coin : coins) {
            if (coin <= i && dp[i - coin] != INT_MAX) {
                dp[i] = min(dp[i], dp[i - coin] + 1);
            }
        }
    }
    
    return dp[amount] == INT_MAX ? -1 : dp[amount];
}

// ==================== EXAMPLE ====================

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    // Example: 0/1 Knapsack
    vi weights = {2, 3, 4};
    vi values = {3, 4, 5};
    int result = knapsack01(3, 5, weights, values);
    cout << "Max knapsack value: " << result << endl;
    
    // Example: LCS
    string s1 = "AGGTAB";
    string s2 = "GXTXAYB";
    cout << "LCS length: " << lcs(s1, s2) << endl;
    
    // Example: LIS
    vi arr = {10, 9, 2, 5, 3, 7, 101, 18};
    cout << "LIS length: " << lis(arr) << endl;
    
    // Example: Coin Change
    vi coins = {1, 2, 5};
    cout << "Min coins for 5: " << coinChange(coins, 5) << endl;
    
    return 0;
}
