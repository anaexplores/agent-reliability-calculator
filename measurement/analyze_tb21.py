"""Retry ICC on the Terminal-Bench 2.1 public leaderboard (backs docs/measurements/06_icc_on_2026_models.md).

Source: harbor-framework/terminal-bench-2-1, leaderboard/submissions/*.json (89 tasks x 5 attempts,
models from May-July 2026). Same reconstruction as measurement/analyze_tb40.py, with two differences
required by this leaderboard:
  - submissions whose trial count is not a multiple of 5 are skipped (one submission, 447 trials);
  - successes are taken as round(accuracy * n_trials / 100), because these files have no
    `successes` field.

    python measurement/analyze_tb21.py <folder_with_json> [out_json]

Output: a console table, the median ICC, and a JSON file (default: tb21_icc.json next to this script).
"""
import sys, os, json, glob, statistics as st
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze_tb40 as A

sys.stdout.reconfigure(encoding='utf-8')


def main(folder, out_path=None):
    out = []
    for f in sorted(glob.glob(os.path.join(folder, '2026*.json'))):
        d = json.load(open(f, encoding='utf-8')); m = d['metrics']; meta = d['metadata']
        n = m['n_trials']
        if n % 5:
            print('skip (unequal attempts)', os.path.basename(f), n); continue
        nt = n // 5; succ = round(m['accuracy'] * n / 100)
        N, err = A.recover(nt, succ, {k: m[f'pass_at_{k}'] for k in range(2, 6)})
        bb, p1 = A.icc_bb(N)
        out.append(dict(file=os.path.basename(f), model=meta['model_display']['label'], agent=d['source_filter']['agent'],
                        effort=meta.get('reasoning_effort'), n_tasks=nt, p1=p1, N=N, int_err=err,
                        icc_anova=A.icc_anova(N), disq=len(d.get('disqualified_trials', []))))
    for r in out:
        print(f"{r['model'][:22]:22s} {r['agent'][:12]:12s} {str(r['effort']):6s} p1={r['p1']:.2f} N={r['N']} "
              f"err={r['int_err']:.3f} ICC={r['icc_anova']:.3f} disq={r['disq']}")
    out_path = out_path or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tb21_icc.json')
    json.dump(out, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('median ICC TB 2.1: %.3f (n=%d)' % (st.median([r['icc_anova'] for r in out]), len(out)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
