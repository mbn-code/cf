// Codeforces 1A — Theatre Square
// ceil(n/a) * ceil(m/a); product reaches 1e18 → must be 64-bit.
#include <bits/stdc++.h>
using namespace std;

int main() {
    long long n, m, a;
    cin >> n >> m >> a;
    cout << ((n + a - 1) / a) * ((m + a - 1) / a) << '\n';
    return 0;
}
