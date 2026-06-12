/**
 * Insertable competitive-programming starter templates.
 *
 * Each template is a self-contained C++ source that compiles against the
 * bundled <bits/stdc++.h> shim. They are surfaced in the editor toolbar and,
 * for the stress harness, seed the brute-force and generator panels.
 */

export type Template = {
  id: string;
  label: string;
  description: string;
  code: string;
};

export const DEFAULT_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
`;

export const TEMPLATES: Template[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Bare main with fast I/O wiring.",
    code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    return 0;
}
`,
  },
  {
    id: "sum",
    label: "A + B",
    description: "Read two integers and print their sum.",
    code: DEFAULT_CODE,
  },
  {
    id: "fast-io",
    label: "Fast I/O + helpers",
    description: "Typedefs, macros and a multi-testcase scaffold.",
    code: `#include <bits/stdc++.h>
using namespace std;

using ll = long long;
using pii = pair<int, int>;
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()

void solve() {
    // per-testcase logic
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t = 1;
    cin >> t;
    while (t--) solve();
    return 0;
}
`,
  },
  {
    id: "brute",
    label: "Brute force",
    description: "Reference solution scaffold for stress testing.",
    code: `#include <bits/stdc++.h>
using namespace std;

// Reference / brute-force solution. Keep it simple and obviously correct.
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
`,
  },
  {
    id: "generator",
    label: "Generator",
    description: "Seeded random input generator (seed comes from argv[1]).",
    code: `#include <bits/stdc++.h>
using namespace std;

// The stress harness passes the iteration seed as argv[1].
int main(int argc, char** argv) {
    unsigned long long seed = argc > 1 ? strtoull(argv[1], nullptr, 10) : 0;
    mt19937_64 rng(seed);

    auto rnd = [&](long long lo, long long hi) {
        return (long long)(rng() % (unsigned long long)(hi - lo + 1)) + lo;
    };

    int a = (int)rnd(0, 1000);
    int b = (int)rnd(0, 1000);
    cout << a << " " << b << "\\n";
    return 0;
}
`,
  },
];

/** The brute-force template used to seed the stress panel. */
export const BRUTE_TEMPLATE =
  TEMPLATES.find((t) => t.id === "brute")?.code ?? DEFAULT_CODE;

/** The generator template used to seed the stress panel. */
export const GENERATOR_TEMPLATE =
  TEMPLATES.find((t) => t.id === "generator")?.code ?? "";
