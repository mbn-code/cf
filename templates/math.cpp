/**
 * @file math.cpp
 * @brief Mathematical algorithms for competitive programming
 * @description GCD, LCM, modular arithmetic, prime checking, etc.
 */

#include <iostream>
#include <vector>
#include <cmath>
#include <algorithm>

using namespace std;

#define ll long long
#define vi vector<int>

const int MOD = 1e9 + 7;

// ==================== GCD & LCM ====================

/**
 * @brief Greatest Common Divisor (Euclidean algorithm)
 * @param a First number
 * @param b Second number
 * @return GCD(a, b)
 */
ll gcd(ll a, ll b) {
    return b == 0 ? a : gcd(b, a % b);
}

/**
 * @brief Least Common Multiple
 * @param a First number
 * @param b Second number
 * @return LCM(a, b)
 */
ll lcm(ll a, ll b) {
    return a / gcd(a, b) * b;
}

// ==================== MODULAR ARITHMETIC ====================

/**
 * @brief Modular exponentiation: (base^exp) % mod
 * @param base Base value
 * @param exp Exponent
 * @param mod Modulus
 * @return (base^exp) % mod
 */
ll modpow(ll base, ll exp, ll mod) {
    ll result = 1;
    base %= mod;
    
    while (exp > 0) {
        if (exp & 1) result = (result * base) % mod;
        base = (base * base) % mod;
        exp >>= 1;
    }
    
    return result;
}

/**
 * @brief Modular multiplicative inverse using Fermat's little theorem
 * Requires mod to be prime
 * @param a Value
 * @param mod Prime modulus
 * @return Modular inverse of a (mod mod)
 */
ll modinv(ll a, ll mod) {
    return modpow(a, mod - 2, mod);
}

// ==================== PRIME CHECKING ====================

/**
 * @brief Check if a number is prime
 * @param n Number to check
 * @return True if prime, false otherwise
 */
bool isPrime(ll n) {
    if (n < 2) return false;
    if (n == 2) return true;
    if (n % 2 == 0) return false;
    
    for (ll i = 3; i * i <= n; i += 2) {
        if (n % i == 0) return false;
    }
    
    return true;
}

// ==================== SIEVE OF ERATOSTHENES ====================

/**
 * @brief Sieve of Eratosthenes - find all primes up to n
 * @param n Upper limit
 * @return Vector of primes
 */
vi sieve(int n) {
    vector<bool> isPrime(n + 1, true);
    isPrime[0] = isPrime[1] = false;
    
    for (int i = 2; i * i <= n; i++) {
        if (isPrime[i]) {
            for (int j = i * i; j <= n; j += i) {
                isPrime[j] = false;
            }
        }
    }
    
    vi primes;
    for (int i = 2; i <= n; i++) {
        if (isPrime[i]) primes.push_back(i);
    }
    
    return primes;
}

// ==================== FACTORIAL & COMBINATIONS ====================

/**
 * @brief Calculate factorial modulo mod
 * @param n Number
 * @param mod Modulus
 * @return n! % mod
 */
ll factorial(int n, ll mod) {
    ll result = 1;
    for (int i = 2; i <= n; i++) {
        result = (result * i) % mod;
    }
    return result;
}

/**
 * @brief Calculate nCr (combinations) modulo mod
 * Uses: nCr = n! / (r! * (n-r)!)
 * @param n Total items
 * @param r Items to choose
 * @param mod Prime modulus
 * @return nCr % mod
 */
ll nCr(int n, int r, ll mod) {
    if (r > n) return 0;
    if (r == 0 || r == n) return 1;
    
    ll num = factorial(n, mod);
    ll denom = (factorial(r, mod) * factorial(n - r, mod)) % mod;
    
    return (num * modinv(denom, mod)) % mod;
}

// ==================== DIGIT SUM & MANIPULATION ====================

/**
 * @brief Calculate sum of digits
 * @param n Number
 * @return Sum of digits
 */
ll digitSum(ll n) {
    ll sum = 0;
    while (n > 0) {
        sum += n % 10;
        n /= 10;
    }
    return sum;
}

/**
 * @brief Reverse a number
 * @param n Number
 * @return Reversed number
 */
ll reverse(ll n) {
    ll rev = 0;
    while (n > 0) {
        rev = rev * 10 + n % 10;
        n /= 10;
    }
    return rev;
}

// ==================== EXAMPLE ====================

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    cout << "GCD(48, 18) = " << gcd(48, 18) << endl;
    cout << "LCM(12, 18) = " << lcm(12, 18) << endl;
    
    cout << "2^10 mod 1000 = " << modpow(2, 10, 1000) << endl;
    
    cout << "Is 17 prime? " << (isPrime(17) ? "Yes" : "No") << endl;
    
    cout << "Primes up to 20: ";
    for (int p : sieve(20)) cout << p << " ";
    cout << endl;
    
    cout << "5! = " << factorial(5, MOD) << endl;
    cout << "5C2 = " << nCr(5, 2, MOD) << endl;
    
    cout << "Digit sum of 12345 = " << digitSum(12345) << endl;
    cout << "Reverse of 12345 = " << reverse(12345) << endl;
    
    return 0;
}
