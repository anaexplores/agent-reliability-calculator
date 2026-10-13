"""Does the retry ICC hold on models from August-September 2026? (checked 2026-09-29)
Corpus: Terminal-Bench 4.0, public leaderboard harbor-framework/terminal-bench, leaderboard/submissions/*.json
(66 tasks x 5 attempts; the rules require >=5 attempts and public trials).

From the unbiased pass@1..pass@5 at n=5 the distribution N_c (the number of tasks solved c times
out of 5) is recovered uniquely (6 equations, 6 unknowns). The solution must be integer;
this is a self-check: a non-integer solution means the data are not of the kind we assume.

ICC in two ways:
  - ANOVA (one-way, groups = tasks);
  - beta-binomial, method of moments on p1 and pass^2 = E[p^2] (the same estimator as in the
    tau2-bench analysis, measurement/analyze_tau2bench.mjs):
    s = (p1 - p2) / (p2 - p1^2), ICC = 1/(s+1).

Input: a folder of leaderboard submission JSON files (metrics.n_trials, metrics.successes,
metrics.pass_at_2..5, metadata). The task count is derived per submission as n_trials / 5.
Output: a console table and a JSON file (default: tb40_icc.json next to this script).
The Terminal-Bench 2.1 leaderboard (harbor-framework/terminal-bench-2-1, 89 tasks x 5) is processed
by measurement/analyze_tb21.py, which reuses the functions below and writes tb21_icc.json.
Backs docs/measurements/06_icc_on_2026_models.md.

    python measurement/analyze_tb40.py <folder_with_json> [out_json]
"""
import sys, os, json, glob
from math import comb
from fractions import Fraction
sys.stdout.reconfigure(encoding='utf-8')
N_TRY = 5


def recover(n_tasks, successes, pk):
    """Solve the linear system exactly (Fraction); return N_0..N_5 and the max deviation from integer."""
    rows, rhs = [[1] * (N_TRY + 1)], [Fraction(n_tasks)]
    rows.append([c for c in range(N_TRY + 1)]); rhs.append(Fraction(successes))  # Σ c·N_c = successes
    for k in range(2, N_TRY + 1):
        rows.append([Fraction(1) - Fraction(comb(N_TRY - c, k), comb(N_TRY, k)) for c in range(N_TRY + 1)])
        rhs.append(Fraction(str(pk[k])) * n_tasks)
    A = [list(map(Fraction, r)) + [b] for r, b in zip(rows, rhs)]
    n = len(A)
    for i in range(n):  # Gaussian elimination
        p = next(r for r in range(i, n) if A[r][i] != 0)
        A[i], A[p] = A[p], A[i]
        for r in range(n):
            if r != i and A[r][i] != 0:
                f = A[r][i] / A[i][i]
                A[r] = [a - f * b for a, b in zip(A[r], A[i])]
    x = [float(A[i][-1] / A[i][i]) for i in range(n)]
    xi = [round(v) for v in x]
    return xi, max(abs(a - b) for a, b in zip(x, xi))


def icc_anova(N):
    k, g = N_TRY, sum(N)
    tot = sum(c * n for c, n in enumerate(N)); mean = tot / (g * k)
    ssb = sum(n * k * (c / k - mean) ** 2 for c, n in enumerate(N))
    ssw = sum(n * c * (1 - c / k) for c, n in enumerate(N))
    msb, msw = ssb / (g - 1), ssw / (g * (k - 1))
    return (msb - msw) / (msb + (k - 1) * msw)


def icc_bb(N):
    g = sum(N)
    p1 = sum(n * c / N_TRY for c, n in enumerate(N)) / g
    p2 = sum(n * c * (c - 1) / (N_TRY * (N_TRY - 1)) for c, n in enumerate(N)) / g
    den = p2 - p1 * p1
    return None if den <= 0 else 1 / ((p1 - p2) / den + 1), p1


def main(folder, out_path=None):
    out = []
    for f in sorted(glob.glob(os.path.join(folder, '*.json'))):
        if os.path.basename(f) == 'list.json':
            continue
        d = json.load(open(f, encoding='utf-8'))
        m, meta = d['metrics'], d['metadata']
        n_trials, succ = m['n_trials'], m['successes']
        n_tasks = n_trials // N_TRY
        assert n_tasks * N_TRY == n_trials, f
        pk = {k: m[f'pass_at_{k}'] for k in range(2, N_TRY + 1)}
        N, err = recover(n_tasks, succ, pk)
        bb, p1 = icc_bb(N)
        row = dict(model=meta['model_display']['label'], date=meta['date'], agent=d['source_filter']['agent'],
                   effort=meta.get('reasoning_effort'), n_tasks=n_tasks, p1=p1, N=N, int_err=err,
                   icc_anova=icc_anova(N), icc_bb=bb, disq=len(d.get('disqualified_trials', [])))
        out.append(row)
    print(f'{"model":22s} {"date":10s} {"p1":>5s} {"N_0..N_5":>22s} {"dev.":>6s} {"ICC anova":>9s} {"ICC bb":>7s}')
    for r in sorted(out, key=lambda r: r['date']):
        print(f'{r["model"][:22]:22s} {r["date"]:10s} {r["p1"]:5.3f} {str(r["N"]):>22s} {r["int_err"]:6.3f}'
              f' {r["icc_anova"]:9.3f} {r["icc_bb"]:7.3f}')
    out_path = out_path or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tb40_icc.json')
    json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
