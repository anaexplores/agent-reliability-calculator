"""Null model for the ICC check on 2026 models (2026-09-29): does the recovered ICC drop near the
ceiling as an ARTIFACT of the method, when the true ICC is constant?
Truth: p_task ~ Beta(mu*s, (1-mu)*s), ICC = 1/(s+1). Each task gets k=4 attempts (as in τ²-bench).
pass^j is the unbiased τ-bench estimator: C(c,j)/C(k,j) per task, averaged over tasks.
Recovery as in analyze_tau2bench.mjs: s = (p1 - p2)/(p2 - p1^2), ICC = 1/(s+1).
Grid: true ICC 0.6 and 0.3; 50 and 114 tasks; mu from 0.25 to 0.97; 400 replications each.
No input files; prints a table of median estimates with 5%-95% ranges.
Backs docs/measurements/06_icc_on_2026_models.md.

    python measurement/null_icc_vs_ceiling.py"""
import random, math, statistics as st, sys
sys.stdout.reconfigure(encoding='utf-8')
rnd = random.Random(10)

def run(mu, icc, n_tasks, k=4, reps=400):
    s = 1 / icc - 1
    a, b = mu * s, (1 - mu) * s
    est = []
    for _ in range(reps):
        p1 = p2 = 0.0
        for _ in range(n_tasks):
            p = rnd.betavariate(a, b)
            c = sum(rnd.random() < p for _ in range(k))
            p1 += c / k
            p2 += (c * (c - 1)) / (k * (k - 1))
        p1 /= n_tasks; p2 /= n_tasks
        den = p2 - p1 * p1
        if den <= 0 or p1 - p2 < 0:
            est.append(0.0 if den <= 0 else 1.0)  # degenerate: independence / full correlation
            continue
        sh = (p1 - p2) / den
        est.append(1 / (sh + 1))
    q = st.quantiles(est, n=20)
    return st.median(est), q[0], q[-1]

print('true ICC | n tasks | mu → median estimate [5%–95%]')
for icc in (0.6, 0.3):
    for n in (50, 114):
        row = []
        for mu in (0.25, 0.5, 0.75, 0.85, 0.9, 0.95, 0.97):
            m, lo, hi = run(mu, icc, n)
            row.append(f'{mu:.2f}:{m:.2f}[{lo:.2f}–{hi:.2f}]')
        print(f'{icc} | {n} | ' + '  '.join(row))
