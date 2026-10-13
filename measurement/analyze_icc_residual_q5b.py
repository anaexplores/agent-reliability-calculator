"""Q5b (EXPLORATORY, post hoc: not among the hypotheses and criteria fixed before the analysis):
does the ICC differ between configurations AT EQUAL pass@1?

Null: configuration ICC = a + b·pass@1 (a common linear dependence, fitted to the observed data),
attempts are beta-binomial. Statistic: variance of the ICC residuals after a linear fit on pass@1
(the fit is repeated in every simulation).

Input: a trials CSV with columns model, task, reward and 5 attempts per task (tb40_trials.csv from
measurement/fetch_tb40_trials.py, or tb20_q5_trials.csv from measurement/prep_tb20_for_q5.py);
optional number of simulations (default 2000). Output: JSON on stdout.
Backs docs/measurements/08_defects_and_icc_tb40.md.

    python measurement/analyze_icc_residual_q5b.py <trials.csv> [nsim]
"""
import sys, csv, json, random
from collections import defaultdict
from statistics import mean, pvariance
from analyze_icc_heterogeneity_q5 import icc_anova, sim_groups

sys.stdout.reconfigure(encoding='utf-8')


def resid_var(x, y):
    mx, my = mean(x), mean(y)
    b = sum((a - mx) * (c - my) for a, c in zip(x, y)) / sum((a - mx) ** 2 for a in x)
    a0 = my - b * mx
    return pvariance([c - (a0 + b * a) for a, c in zip(x, y)]), a0, b


def main(path, nsim):
    S = defaultdict(lambda: defaultdict(list))
    for r in csv.DictReader(open(path, encoding='utf-8')):
        S[r['model']][r['task']].append(1 if float(r['reward'] or 0) >= 1 else 0)
    ms = sorted(S); tasks = sorted(next(iter(S.values())))
    p1 = [mean(x for t in tasks for x in S[m][t]) for m in ms]
    icc = [icc_anova([S[m][t] for t in tasks]) for m in ms]
    v_obs, a0, b = resid_var(p1, icc)
    rnd = random.Random(20261012); vs = []
    for _ in range(nsim):
        sim = [icc_anova(sim_groups(rnd, p, min(max(a0 + b * p, 0.02), 0.95), len(tasks))) for p in p1]
        vs.append(resid_var(p1, sim)[0])
    vs.sort()
    print(json.dumps({'n_configs': len(ms), 'fit_icc_vs_pass1': [round(a0, 4), round(b, 4)], 'resid_var_obs': round(v_obs, 5),
                      'null_median': round(vs[nsim // 2], 5), 'null_p95': round(vs[int(0.95 * nsim)], 5),
                      'p': sum(1 for v in vs if v >= v_obs) / nsim}, indent=1))


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2000)
