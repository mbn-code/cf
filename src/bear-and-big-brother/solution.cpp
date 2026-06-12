// Codeforces 791A — Bear and Big Brother
#include <bits/stdc++.h>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    int years = 0;
    while (a <= b) { a *= 3; b *= 2; years++; }
    cout << years << '\n';
    return 0;
}
