/**
 * @file include/stl_utilities.h
 * @brief Useful STL utilities and helper functions
 */

#ifndef STL_UTILITIES_H
#define STL_UTILITIES_H

#include <iostream>
#include <vector>
#include <algorithm>
#include <map>
#include <set>

using namespace std;

// ==================== VECTOR UTILITIES ====================

/**
 * @brief Print vector elements
 */
template <typename T>
void printVector(const vector<T>& v) {
    for (const auto& x : v) {
        cout << x << " ";
    }
    cout << endl;
}

/**
 * @brief Read vector from input
 */
template <typename T>
vector<T> readVector(int n) {
    vector<T> v(n);
    for (int i = 0; i < n; i++) {
        cin >> v[i];
    }
    return v;
}

/**
 * @brief Sort vector in ascending order
 */
template <typename T>
void sortAsc(vector<T>& v) {
    sort(v.begin(), v.end());
}

/**
 * @brief Sort vector in descending order
 */
template <typename T>
void sortDesc(vector<T>& v) {
    sort(v.begin(), v.end(), greater<T>());
}

/**
 * @brief Reverse vector
 */
template <typename T>
void reverseVec(vector<T>& v) {
    reverse(v.begin(), v.end());
}

// ==================== ARRAY UTILITIES ====================

/**
 * @brief Sum all elements in vector
 */
template <typename T>
T sumVector(const vector<T>& v) {
    T sum = 0;
    for (const auto& x : v) sum += x;
    return sum;
}

/**
 * @brief Find maximum element
 */
template <typename T>
T maxElement(const vector<T>& v) {
    return *max_element(v.begin(), v.end());
}

/**
 * @brief Find minimum element
 */
template <typename T>
T minElement(const vector<T>& v) {
    return *min_element(v.begin(), v.end());
}

/**
 * @brief Count occurrences of value
 */
template <typename T>
int countOccurrences(const vector<T>& v, const T& val) {
    return count(v.begin(), v.end(), val);
}

/**
 * @brief Check if element exists in vector
 */
template <typename T>
bool exists(const vector<T>& v, const T& val) {
    return find(v.begin(), v.end(), val) != v.end();
}

// ==================== MATRIX UTILITIES ====================

/**
 * @brief Create 2D vector of given size
 */
template <typename T>
vector<vector<T>> create2D(int rows, int cols, T init = 0) {
    return vector<vector<T>>(rows, vector<T>(cols, init));
}

/**
 * @brief Print 2D matrix
 */
template <typename T>
void print2D(const vector<vector<T>>& matrix) {
    for (const auto& row : matrix) {
        for (const auto& elem : row) {
            cout << elem << " ";
        }
        cout << endl;
    }
}

#endif // STL_UTILITIES_H
