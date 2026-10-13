"""Sensitivity of the ICC~pass@1 slope and of Q5 (added after an independent adversarial review).

Variants: TB 4.0; TB 2.0 first 5 trials; TB 2.0 without the 28 defective tasks (tb21_fixed_tasks.txt);
TB 2.0 random 5 trials (2 seeds); each one with and without the points with pass@1<0.1.
For each: OLS slope and intercept, bootstrap CI (by configurations and by tasks, 2000), Q5 p (NSIM=2000).

Inputs (opened relative to the current directory): tb40_trials.csv (from measurement/fetch_tb40_trials.py),
tb_trials.csv (TB 2.0, from measurement/fetch_terminalbench.mjs), tb21_fixed_tasks.txt.
Output: one JSON line per variant on stdout (saved as icc_slope_sensitivity.txt).
Backs docs/measurements/08_defects_and_icc_tb40.md.

Usage (input files are opened by relative path, so run from the directory that holds all three;
tb21_fixed_tasks.txt ships in measurement/):
    python measurement/analyze_icc_slope_sensitivity.py > measurement/icc_slope_sensitivity.txt
"""
import sys, csv, json, random
from collections import defaultdict
from statistics import mean, pvariance
import analyze_icc_heterogeneity_q5 as q5

sys.stdout.reconfigure(encoding='utf-8')


def load40():
    S = defaultdict(lambda: defaultdict(list))
    for r in csv.DictReader(open('tb40_trials.csv', encoding='utf-8')):
        S[r['model']][r['task']].append(1 if float(r['reward'] or 0) >= 1 else 0)
    return S


def load20(mode, seed=0, drop=frozenset()):
    raw = defaultdict(lambda: defaultdict(list)); allt = set()
    for r in csv.DictReader(open('tb_trials.csv', encoding='utf-8')):
        raw[f"{r['agent']} | {r['model']}"][r['task_name']].append(1 if float(r['reward'] or 0) >= 1 else 0); allt.add(r['task_name'])
    full5 = {c: {t for t, v in raw[c].items() if len(v) >= 5} for c in raw}
    keep = [c for c in raw if len(full5[c]) >= len(allt) - 1]
    tasks = set.intersection(*(full5[c] for c in keep)) - drop
    rnd = random.Random(seed)
    return {c: {t: (raw[c][t][:5] if mode == 'first' else rnd.sample(raw[c][t], 5)) for t in tasks} for c in keep}


def fit(x, y):
    mx, my = mean(x), mean(y)
    b = sum((a - mx) * (c - my) for a, c in zip(x, y)) / sum((a - mx) ** 2 for a in x)
    return my - b * mx, b


def stats(S, label, nsim=2000):
    out = {}
    for cut in (0.0, 0.1):
        ms = [m for m in sorted(S) if mean(x for t in S[m] for x in S[m][t]) >= cut]
        tasks = sorted(next(iter(S.values())))
        p1 = {m: mean(x for t in tasks for x in S[m][t]) for m in ms}
        icc = {m: q5.icc_anova([S[m][t] for t in tasks]) for m in ms}
        a, b = fit([p1[m] for m in ms], [icc[m] for m in ms])
        rnd = random.Random(5); bc, bt = [], []
        for _ in range(2000):
            mm = [rnd.choice(ms) for _ in ms]
            if len({round(p1[m], 6) for m in mm}) > 2:
                bc.append(fit([p1[m] for m in mm], [icc[m] for m in mm])[1])
        for _ in range(300):
            tt = [rnd.choice(tasks) for _ in tasks]
            bt.append(fit([mean(x for t in tt for x in S[m][t]) for m in ms], [q5.icc_anova([S[m][t] for t in tt]) for m in ms])[1])
        bc.sort(); bt.sort()
        q5.NSIM = nsim
        p = q5.test(S, ms, mean, random.Random(20261012))['p']
        out[f'pass1>={cut}'] = {'n': len(ms), 'n_tasks': len(tasks), 'intercept': round(a, 3), 'slope': round(b, 3),
                                'slope_ci_by_configs': [round(bc[int(.025 * len(bc))], 3), round(bc[int(.975 * len(bc)) - 1], 3)],
                                'slope_ci_by_tasks': [round(bt[7], 3), round(bt[292], 3)], 'q5_p': p}
    print(label, json.dumps(out, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    drop = frozenset(l.strip() for l in open('tb21_fixed_tasks.txt', encoding='utf-8') if l.strip())
    print('defective tasks listed:', len(drop), flush=True)
    stats(load40(), 'TB4.0')
    stats(load20('first'), 'TB2.0 first5')
    stats(load20('first', drop=drop), 'TB2.0 first5 no-defective')
    stats(load20('random', seed=1), 'TB2.0 random5 seed1')
    stats(load20('random', seed=2), 'TB2.0 random5 seed2')
