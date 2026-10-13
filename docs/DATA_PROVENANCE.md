# Provenance: where every number comes from

> Project rule: every number in the calculator is either measured by us and reproducible, or explicitly flagged as a model assumption. Nothing recalled "from a paper".

## Numbers shown to the user

| Number | Source | How to check |
|---|---|---|
| ICC 0.59 (terminal tasks, 2026 models) · μ 76% | Terminal-Bench 2.1 public leaderboard, 19 submissions (89 tasks × 5 attempts, May–July 2026), medians of ICC and single-attempt success; success distributions reconstructed exactly from published pass@1…5 | `measurement/analyze_tb21.py` (same method as TB 4.0), `measurement/tb21_icc.json` |
| ICC 0.49 (hard terminal tasks) · μ 22% | Terminal-Bench 4.0 public leaderboard, 13 models (66 tasks × 5 attempts, May 28 – Sep 2, 2026), medians; includes Claude Fable 5.1 = 0.51 | `measurement/analyze_tb40.py`, `measurement/tb40_icc.json` |
| ICC 0.66 (historical, previous default) | our measurement on 52,104 Terminal-Bench 2.0 runs (0.666 when the preset was set; 0.667 after the 2026-10-13 correction below) | `measurement/analyze_v4_benchmark_defects.mjs` |
| "131,332 runs" | 52,104 (TB 2.0) + 66,483 (SWE-bench Lite) + 8,455 (TB 2.1: 19 × 445) + 4,290 (TB 4.0: 13 × 330) | the scripts above |
| "Fable 5 → Fable 5.1: 0.49 → 0.51" | TB 4.0, same harness and effort (Claude Code, max) | `measurement/tb40_icc.json` |
| ICC 0.57 (code fixing) | our measurement on 66,483 SWE-bench Lite runs | `measurement/analyze_swebench_lite.mjs` |
| ICC 0.53 (customer service) | 74 τ-bench measurements, median | `measurement/analyze_tau2bench.mjs` |
| ICC 0.22 (telecom) | same measurement, telecom domain | same |
| "the model is off by 0.6–1.5 pp" | out-of-sample validation on 71 measurements | `measurement/analyze_tau2bench.mjs`, out-of-sample section |
| "2.1× closer than the alternative" | comparison against geometric and linear models | `docs/measurements/03_tau_bench.md` §self-check |
| "46% of tasks never solved once" | SWE-bench Lite, 122 of 266 tasks over 250 attempts | `measurement/analyze_swebench_lite.mjs` |

## Model assumptions (not measurements)

These are set by the user — they are **not** taken from data:
- blind spot `b` — the share of errors structurally invisible to verification;
- verifier strength `r` (recall);
- verifier similarity `ρ`;
- cost of an error and cost of a call.

The relationship: `b_eff = b^(1+(k−1)(1−ρ))`, `e_eff = e·[b_eff+(1−b_eff)(1−r)^k]`, success `= (1−e_eff)^N`.
This is a **simplification**: steps are treated as independent and verifier false positives are not modelled. Real chains behave worse — per-step accuracy itself degrades with length ([arXiv:2509.09677](https://arxiv.org/abs/2509.09677)).

## Theoretical basis
- Verifier correlation and the blind-spot ceiling: [arXiv:2607.13918](https://arxiv.org/abs/2607.13918) (July 2026).
- The classical form of the same phenomenon in reliability engineering: common-cause failure / beta-factor, IEC 61508.
- The verification-usefulness threshold goes back to von Neumann (1956) — reliable computation from unreliable components.

## What we measured ourselves vs what we took as given
**Ours:** the ICC measurements on all four corpora, the out-of-sample validation, the control models, the null tests, the defect and reward-hacking checks, the cost model.
**Not ours:** the run corpora themselves (public, linked in the README) and the theoretical frame (references above).

## Known limitations
1. **ICC is not a constant** — the spread across domains and models (0.03 to 0.83) is wider than the spread between corpora.
2. **τ-bench:** part of the variance comes from a stochastic user simulator — environment noise, not only the agent.
3. **SWE-bench Lite:** 2024 data, a single configuration; a low base success rate can inflate ICC.
4. **Terminal-Bench 2.0:** the version contained 28 broken tasks out of 89. We checked: the effect on ICC is small (−0.012), but it distorts tail metrics badly (see [`measurements/05_benchmark_defects_tb20_vs_21.md`](measurements/05_benchmark_defects_tb20_vs_21.md)).
6. **Terminal-Bench 2.1 / 4.0 leaderboards:** one configuration per model; harness and effort effects are not separated from model effects. TB 4.0 has 66 tasks, so per-model ICC intervals are ±0.12–0.2.
7. **Run counts differ slightly between analyses** because of filtering: e.g. the reward-hacking analysis uses 51,741 of the 52,104 TB 2.0 runs (runs with a 0/1 reward, in task × configuration cells with at least 3 runs). The headline total uses the full corpus sizes.
5. Recovering ICC from τ-bench's published percentages is sensitive to rounding — checked, and stable (±0.003).

## Correction 2026-10-13: Terminal-Bench 2.0 data
While preparing this release we re-downloaded the Terminal-Bench 2.0 corpus. The file used for the original analysis had the right number of rows (52,104) but was not the dataset: the download script skipped pages on network errors and its resume logic then wrote 6 pages (600 rows) twice while 6 other pages were missing. The script now retries failed pages and refuses to write an incomplete file. All TB 2.0 numbers in this repository are recomputed on the clean download. **One conclusion changed** (report 08, Q5: combinations do differ in ICC on TB 2.0, also on fixed tasks); every other conclusion holds.

| Number | First published | Corrected |
|---|---|---|
| ICC, TB 2.0 | 0.666 | **0.667** |
| per-attempt success / cells with k≥3 / runs in them | 39.7% / 9,279 / 51,744 | 39.5% / 9,384 / 51,741 |
| pass@5 observed / independence / gap | 61.5% / 94.8% / 33.3 pp | 60.8% / 94.5% / 33.7 pp |
| ICC change after excluding the 28 fixed tasks | −0.009 | −0.012 (still H0, threshold 0.05) |
| tasks never solved | 2 (2.2%) | 1 (1.1%) |
| hard tasks solved by someone (null gives the same) | 18/20 | 19/20 |
| configuration-to-task specificity (split-half) | +17.5 pp (one random tie-break) | +19.0 pp (mean of 200 tie-breaks; single draws 13.8–25.6) |
| reward-hacking exclusion: Δ ICC / p / excess over null at the upper bound | +0.009 / 0.60 / ≈ +0.02 | +0.012 / 0.48 / ≈ +0.026 (still H0) |
| ICC differences between combinations on fixed tasks without weak combinations (report 08, Q5) | p = 0.30, "not visible" | **p = 0.0075, present** — the one changed conclusion |
| ICC ~ pass@1 slope on TB 2.0 | 0.15–0.41 | 0.23–0.43 |

## Two corrections we made to our own claims
1. It first read "the model is 9.5× more accurate" — but that compared only against independence. After adding reasonable controls the honest figure is **2.1×**.
2. It first read "the correlation replicates everywhere" — but the spread within a single corpus turned out to be 7× wider than the spread between corpora. Correctly stated: the **medians** converge; the specific value is domain-dependent.

## Data sources and licenses

We do not redistribute raw run data. `measurement/reproduce.sh` downloads it from the original sources; the repository ships only our own derived results (ICC tables, test outputs) and short task-name lists, each with attribution.

| Source | Used for | License (per source, checked 2026-10-13) | In this repo |
|---|---|---|---|
| [yoonholee/terminalbench-trajectories](https://huggingface.co/datasets/yoonholee/terminalbench-trajectories) (Terminal-Bench 2.0) | reports 01, 04, 05, 07, 08 | Apache-2.0 | download script only (`fetch_terminalbench.mjs`) |
| [ScalingIntelligence/swe-bench-lite-samples](https://github.com/ScalingIntelligence/swe-bench-lite-samples) | report 02 | **no license stated** | download command only; no raw data, only our aggregate results |
| [sierra-research/tau2-bench](https://github.com/sierra-research/tau2-bench) leaderboard submissions | report 03 | MIT | `tau2_icc.json`: our ICC estimates from published pass^k |
| [harbor-framework/terminal-bench-2-1](https://github.com/harbor-framework/terminal-bench-2-1) leaderboard and release notes | reports 05, 06, 07 | Apache-2.0 | `tb21_icc.json` (ours); `tb21_fixed_tasks.txt` (28 task names from the release notes); `tb21_reward_hacking_tasks.csv` (task-level counts of disqualified trials, derived from submission files; see the [integrity update](https://www.tbench.ai/news/leaderboard-integrity-update)) |
| [harbor-framework/terminal-bench](https://github.com/harbor-framework/terminal-bench) leaderboard (Terminal-Bench 4.0) | reports 06, 08 | Apache-2.0 | `tb40_icc.json` (ours) |
| [Harbor Hub](https://hub.harborframework.com) public job pages (TB 4.0 per-trial results) | report 08 | no separate data license stated | download script only (`fetch_tb40_trials.py`); outputs are our aggregates |
| [Epoch AI review of Terminal-Bench 4.0](https://epoch.ai/benchmarks/terminal-bench-4/review) | report 08 | — | 30 task names flagged as defective, listed in `analyze_honest_score_tb40.py` with attribution |

