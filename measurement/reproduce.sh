#!/usr/bin/env bash
# Reproduce every measurement behind the calculator from public data.
#
#   bash measurement/reproduce.sh            # everything
#   bash measurement/reproduce.sh tb20 swe   # only selected steps
#
# Steps (downloads are cached in data/, which is git-ignored; outputs go to data/out/):
#   tb20  Terminal-Bench 2.0 trajectories (HF, 52,104 rows, ~15 min rate-limited) -> reports 01, 04, 05
#   swe   SWE-bench Lite samples summary.json (~12 MB)                            -> report 02
#   tau   tau2-bench submissions (fetched by the script itself)                  -> report 03
#   lb    Terminal-Bench 2.1 and 4.0 leaderboard submissions (pinned commits)    -> report 06
#   hack  reward-hacking exclusion test on TB 2.0 (needs tb20)                   -> report 07
#   tb40  Terminal-Bench 4.0 per-trial results from Harbor Hub (~3,300 trials)   -> report 08 (needs tb20 for TB 2.0 replication)
#   sim   chain-model simulations and estimator self-checks
#
# Requires Node.js >= 18, Python >= 3.9 (numpy for the reward-hacking step), git, curl.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/measurement"
D="$ROOT/data"
mkdir -p "$D/out"
cd "$D"

STEPS="${*:-tb20 swe tau lb hack tb40 sim}"
has() { [[ " $STEPS " == *" $1 "* ]]; }
hdr() { printf '\n========== %s ==========\n' "$1"; }

if has tb20; then
  hdr "Terminal-Bench 2.0 (reports 01, 04, 05)"
  [ -s tb_trials.csv ] || node "$M/fetch_terminalbench.mjs" tb_trials.csv
  node "$M/analyze_overdispersion.mjs" tb_trials.csv
  node "$M/analyze_v2.mjs" tb_trials.csv
  node "$M/analyze_v3_diversification.mjs" tb_trials.csv
  node "$M/analyze_v4_benchmark_defects.mjs" tb_trials.csv
  node "$M/analyze_v4_benchmark_defects.mjs" tb_trials.csv "$M/tb21_fixed_tasks.txt"
  node "$M/analyze_v5_sensitivity.mjs" tb_trials.csv
  node "$M/analyze_v6_null_tests.mjs" tb_trials.csv
  node "$M/analyze_v6b_specificity.mjs" tb_trials.csv
fi

if has swe; then
  hdr "SWE-bench Lite samples (report 02)"
  [ -s summary.json ] || curl -fsSL -o summary.json \
    https://raw.githubusercontent.com/ScalingIntelligence/swe-bench-lite-samples/main/summary.json
  node "$M/analyze_swebench_lite.mjs" summary.json
fi

if has tau; then
  hdr "tau2-bench (report 03)"
  node "$M/analyze_tau2bench.mjs"
  cp -f tau2_icc.json out/tau2_icc.json
fi

if has lb; then
  hdr "Terminal-Bench 2.1 / 4.0 leaderboards (report 06)"
  # Pinned to the leaderboard state used in the reports (TB 2.1: 2026-08-11; TB 4.0: 2026-09-03,
  # before eight submissions added on 2026-10-05/06). Set LATEST=1 to analyze the current state instead.
  for spec in "tb21 harbor-framework/terminal-bench-2-1 7131e4375048a0e408a8fb404b5f499d726b695b"               "tb40 harbor-framework/terminal-bench 83c7a6172d629c6575b785ab12c8db787bb2e323"; do
    set -- $spec
    ref="$3"; [ "${LATEST:-0}" = 1 ] && ref=HEAD
    rm -rf "$1"
    git init -q "$1"
    git -C "$1" remote add origin "https://github.com/$2.git"
    git -C "$1" sparse-checkout set leaderboard/submissions
    git -C "$1" fetch -q --depth 1 --filter=blob:none origin "$ref"
    git -C "$1" checkout -q FETCH_HEAD
  done
  python "$M/analyze_tb21.py" tb21/leaderboard/submissions out/tb21_icc.json
  python "$M/analyze_tb40.py" tb40/leaderboard/submissions out/tb40_icc.json
  python "$M/null_icc_vs_ceiling.py"
fi

if has hack; then
  hdr "Reward hacking (report 07)"
  cp -f "$M/tb21_reward_hacking_tasks.csv" "$M/tb21_fixed_tasks.txt" .
  python "$M/analyze_h17_reward_hacking.py"
  mv -f h17_result.json out/h17_result.json
fi

if has tb40; then
  hdr "Terminal-Bench 4.0 per-trial analysis (report 08)"
  [ -s tb40_trials.csv ] || python "$M/fetch_tb40_trials.py" tb40_trials.csv
  python "$M/analyze_honest_score_tb40.py" tb40_trials.csv > out/honest_score_tb40.json
  python "$M/analyze_honest_score_q4.py" tb40_trials.csv > out/honest_score_q4.json
  python "$M/analyze_icc_heterogeneity_q5.py" tb40_trials.csv > out/icc_heterogeneity_q5.json
  if [ -s tb_trials.csv ]; then
    python "$M/prep_tb20_for_q5.py" tb_trials.csv tb20_q5_trials.csv
    python "$M/analyze_icc_heterogeneity_q5.py" tb20_q5_trials.csv > out/icc_heterogeneity_q5_tb20.json
    python "$M/analyze_icc_residual_q5b.py" tb40_trials.csv
    python "$M/analyze_icc_residual_q5b.py" tb20_q5_trials.csv
    cp -f "$M/tb21_fixed_tasks.txt" .
    python "$M/analyze_icc_slope_sensitivity.py" > out/icc_slope_sensitivity.txt
  else
    echo "tb_trials.csv missing: run the tb20 step first for the TB 2.0 replication"
  fi
fi

if has sim; then
  hdr "Simulations and self-checks"
  node "$M/sim/chain_reliability.mjs"
  node "$M/sim/blindspot_floor.mjs"
  [ -s tau2_icc.json ] || cp -f "$M/tau2_icc.json" .
  node "$M/selfcheck_pass_k.mjs"
fi

hdr "Done"
echo "Outputs in data/out/. Compare with the shipped files, e.g.: diff data/out/tb40_icc.json measurement/tb40_icc.json"
