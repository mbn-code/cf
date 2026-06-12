// Codeforces 4A — Watermelon
// Split w into two positive even parts: possible iff w is even and w > 2.
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    int w;
    if (!(cin >> w)) return 0;
    cout << ((w % 2 == 0 && w > 2) ? "YES" : "NO") << '\n';
    return 0;
}
